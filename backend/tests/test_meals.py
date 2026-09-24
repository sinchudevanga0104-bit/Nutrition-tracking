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

def get_auth_token_and_child():
    client.post("/auth/register", json={"name": "Test User", "email": "test@example.com", "password": "password123"})
    response = client.post("/auth/login", json={"email": "test@example.com", "password": "password123"})
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    child_res = client.post("/children/", json={"name": "Alice", "dob": "2020-01-01", "gender": "Female"}, headers=headers)
    child_id = child_res.json()["child_id"]
    return token, child_id, headers

def create_mock_food(headers):
    res = client.post(
        "/meals/foods", 
        json={
            "food_id": 0,
            "food_name": "Apple",
            "category": "Fruit",
            "serving_size": "1 medium",
            "calories": 95.0,
            "protein": 0.5,
            "carbohydrates": 25.0,
            "fat": 0.3
        },
        headers=headers
    )
    return res.json()["food_id"]

def test_get_foods():
    token, child_id, headers = get_auth_token_and_child()
    create_mock_food(headers)
    
    response = client.get("/meals/foods?query=App", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["food_name"] == "Apple"

def test_create_meal():
    token, child_id, headers = get_auth_token_and_child()
    
    response = client.post(
        "/meals/",
        json={"child_id": child_id, "meal_type": "Breakfast", "meal_date": str(date.today())},
        headers=headers
    )
    assert response.status_code == 201
    assert response.json()["meal_type"] == "Breakfast"
    assert float(response.json()["total_calories"]) == 0.0

def test_add_meal_item():
    token, child_id, headers = get_auth_token_and_child()
    food_id = create_mock_food(headers)
    
    meal_res = client.post(
        "/meals/",
        json={"child_id": child_id, "meal_type": "Breakfast", "meal_date": str(date.today())},
        headers=headers
    )
    meal_id = meal_res.json()["meal_id"]
    
    # Add food to meal
    add_res = client.post(
        f"/meals/{meal_id}/items",
        json={"food_id": food_id, "quantity": 2},
        headers=headers
    )
    
    assert add_res.status_code == 200
    data = add_res.json()
    assert float(data["total_calories"]) == 190.0 # 95 * 2
    assert float(data["total_protein"]) == 1.0   # 0.5 * 2
    assert len(data["items"]) == 1

def test_get_food_by_barcode():
    token, child_id, headers = get_auth_token_and_child()
    
    # Create mock food with barcode
    res = client.post(
        "/meals/foods", 
        json={
            "food_id": 0,
            "food_name": "Milk (Cow)",
            "category": "Dairy",
            "serving_size": "1 glass",
            "calories": 150.0,
            "protein": 8.0,
            "carbohydrates": 12.0,
            "fat": 8.0,
            "barcode": "8901234567890"
        },
        headers=headers
    )
    assert res.status_code == 201
    
    response = client.get("/meals/foods/barcode/8901234567890", headers=headers)
    assert response.status_code == 200
    assert response.json()["food_name"] == "Milk (Cow)"
    assert response.json()["barcode"] == "8901234567890"

