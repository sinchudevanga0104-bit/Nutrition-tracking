import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import date, timedelta

from app.main import app
from app.database.connection import Base, get_db

# Setup in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def run_around_tests():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield

def get_auth_token_and_child():
    client.post("/auth/register", json={"name": "Test User", "email": "test@example.com", "password": "password123"})
    response = client.post("/auth/login", json={"email": "test@example.com", "password": "password123"})
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    child_res = client.post("/children/", json={"name": "Alice", "dob": "2020-01-01", "gender": "Female"}, headers=headers)
    child_id = child_res.json()["child_id"]
    return token, child_id, headers

def test_create_growth_record():
    token, child_id, headers = get_auth_token_and_child()
    
    response = client.post(
        "/growth/",
        json={"child_id": child_id, "record_date": str(date.today()), "height": 100.0, "weight": 15.0},
        headers=headers
    )
    assert response.status_code == 201
    data = response.json()
    assert float(data["height"]) == 100.0
    assert float(data["weight"]) == 15.0
    
    # BMI = 15 / (1.0 * 1.0) = 15.0
    assert float(data["bmi"]) == 15.0

def test_get_growth_records():
    token, child_id, headers = get_auth_token_and_child()
    
    # Add records for different dates
    yesterday = str(date.today() - timedelta(days=1))
    today = str(date.today())
    
    client.post("/growth/", json={"child_id": child_id, "record_date": today, "height": 101.0, "weight": 15.5}, headers=headers)
    client.post("/growth/", json={"child_id": child_id, "record_date": yesterday, "height": 100.0, "weight": 15.0}, headers=headers)
    
    response = client.get(f"/growth/{child_id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    
    assert len(data) == 2
    # Ensure ordered by date ascending
    assert data[0]["record_date"] == yesterday
    assert data[1]["record_date"] == today
