import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import date

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
    # Clean up the DB before each test
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield

def get_auth_token():
    client.post(
        "/auth/register",
        json={"name": "Test User", "email": "test@example.com", "password": "password123"}
    )
    response = client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "password123"}
    )
    return response.json()["access_token"]

def test_add_child():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client.post(
        "/children/",
        json={
            "name": "Alice",
            "dob": "2020-01-01",
            "gender": "Female",
            "blood_group": "O+",
            "activity_level": "High"
        },
        headers=headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Alice"
    assert data["gender"] == "Female"
    assert data["activity_level"] == "High"
    assert "child_id" in data

def test_get_children():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    # Add two children
    client.post("/children/", json={"name": "Alice", "dob": "2020-01-01", "gender": "Female"}, headers=headers)
    client.post("/children/", json={"name": "Bob", "dob": "2022-05-10", "gender": "Male"}, headers=headers)
    
    response = client.get("/children/", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    names = [child["name"] for child in data]
    assert "Alice" in names
    assert "Bob" in names

def test_update_child():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    # Add child
    res = client.post("/children/", json={"name": "Alice", "dob": "2020-01-01", "gender": "Female"}, headers=headers)
    child_id = res.json()["child_id"]
    
    # Update child
    update_res = client.put(
        f"/children/{child_id}",
        json={"activity_level": "Low", "blood_group": "A-"},
        headers=headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["activity_level"] == "Low"
    assert update_res.json()["blood_group"] == "A-"

def test_delete_child():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    # Add child
    res = client.post("/children/", json={"name": "Alice", "dob": "2020-01-01", "gender": "Female"}, headers=headers)
    child_id = res.json()["child_id"]
    
    # Delete child
    del_res = client.delete(f"/children/{child_id}", headers=headers)
    assert del_res.status_code == 204
    
    # Verify deletion
    get_res = client.get(f"/children/{child_id}", headers=headers)
    assert get_res.status_code == 404
