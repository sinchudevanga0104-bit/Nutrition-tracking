import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database.connection import Base, get_db

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

def test_water_tracker_flow():
    # Register & Login
    client.post("/auth/register", json={"name": "Water Parent", "email": "water@example.com", "password": "password123"})
    login_resp = client.post("/auth/login", json={"email": "water@example.com", "password": "password123"})
    token = login_resp.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a test child
    child_res = client.post("/children/", json={
        "name": "Water Test Child",
        "dob": "2020-01-01",
        "gender": "Male"
    }, headers=auth_headers)
    assert child_res.status_code in [200, 201]
    child_id = child_res.json()["child_id"]

    # 2. Get initial water status
    status_res = client.get(f"/water/{child_id}", headers=auth_headers)
    assert status_res.status_code == 200
    data = status_res.json()
    assert data["total_intake_ml"] == 0
    assert data["daily_target_ml"] == 1500

    # 3. Log water intake (+250 ml)
    log_res = client.post("/water/log", json={
        "child_id": child_id,
        "amount_ml": 250
    }, headers=auth_headers)
    assert log_res.status_code == 200
    assert log_res.json()["amount_ml"] == 250

    # 4. Check updated water status
    status_res2 = client.get(f"/water/{child_id}", headers=auth_headers)
    assert status_res2.status_code == 200
    data2 = status_res2.json()
    assert data2["total_intake_ml"] == 250
    assert data2["percentage"] == 16.7

    # 5. Update goal & reminder settings
    goal_res = client.post("/water/goal", json={
        "child_id": child_id,
        "daily_target_ml": 1200,
        "reminder_enabled": True,
        "reminder_interval_hours": 1
    }, headers=auth_headers)
    assert goal_res.status_code == 200
