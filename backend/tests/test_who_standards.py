import pytest
from datetime import date
from fastapi.testclient import TestClient
from app.main import app
from app.services.who_standards import (
    calculate_age_months,
    get_who_bmi_benchmark,
    get_who_weight_benchmark,
    get_who_height_benchmark,
    compute_who_zscore,
    zscore_to_percentile,
    classify_who_bmi,
    get_who_nutritional_targets
)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
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

def get_auth_token_and_child():
    client.post("/auth/register", json={"name": "WHO Tester", "email": "whotester@example.com", "password": "password123"})
    login_res = client.post("/auth/login", json={"email": "whotester@example.com", "password": "password123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    child_res = client.post("/children/", json={"name": "Sita", "dob": "2021-06-01", "gender": "Female"}, headers=headers)
    child_id = child_res.json()["child_id"]
    return token, child_id, headers

def test_who_math_and_interpolation():
    # 24 months girl
    bmi_bench = get_who_bmi_benchmark(24, "Female")
    assert 15.0 <= bmi_bench["median"] <= 16.5
    assert bmi_bench["minus_2sd"] < bmi_bench["median"] < bmi_bench["plus_1sd"]

    # Z-score exactly at median should be 0.0
    z = compute_who_zscore(bmi_bench["median"], bmi_bench["median"], bmi_bench["sd"])
    assert abs(z) < 0.01
    assert abs(zscore_to_percentile(z) - 50.0) < 1.0

    # Classification
    c_normal = classify_who_bmi(0.0)
    assert "Normal" in c_normal["status"]
    
    c_under = classify_who_bmi(-2.5)
    assert "Underweight" in c_under["status"]

    c_over = classify_who_bmi(2.5)
    assert "Overweight" in c_over["status"]

def test_who_nutritional_targets():
    # 4 year old child
    targets = get_who_nutritional_targets(48, "Female")
    assert targets["age_group"] == "4-6 years (Young Child)"
    assert targets["calories"] == 1350
    assert targets["protein"] == 19.0
    assert targets["who_source"] == "WHO/FAO Recommended Nutrient Intakes"

def test_who_assessment_api():
    token, child_id, headers = get_auth_token_and_child()

    # Log a growth record
    post_res = client.post(
        "/growth/",
        json={"child_id": child_id, "record_date": str(date.today()), "height": 95.0, "weight": 14.2},
        headers=headers
    )
    assert post_res.status_code == 201

    # Call WHO assessment endpoint
    res = client.get(f"/growth/{child_id}/who-assessment", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "who_standard_reference" in data
    assert "latest_assessment" in data
    assert data["latest_assessment"] is not None
    assert "who_zscore" in data["latest_assessment"]
    assert "who_percentile" in data["latest_assessment"]
    assert "status" in data["latest_assessment"]
    assert len(data["history_comparison"]) >= 1

def test_who_targets_api():
    token, child_id, headers = get_auth_token_and_child()

    res = client.get(f"/growth/{child_id}/who-targets", headers=headers)
    assert res.status_code == 200
    targets = res.json()
    assert "calories" in targets
    assert "protein" in targets
    assert "who_source" in targets
