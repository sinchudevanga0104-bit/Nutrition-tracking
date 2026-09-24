import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database.connection import Base, get_db
from app.models.food import Food

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
    
    # Seed sample food for test
    db = TestingSessionLocal()
    food = Food(food_name="Apple", category="Fruit", serving_size="1 medium", calories=95, protein=0.5, carbohydrates=25, fat=0.3)
    db.add(food)
    db.commit()
    db.close()
    yield

def get_auth_headers():
    client.post("/auth/register", json={"name": "Test User", "email": "voice@example.com", "password": "password123"})
    res = client.post("/auth/login", json={"email": "voice@example.com", "password": "password123"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_voice_meal_logging_command():
    headers = get_auth_headers()
    response = client.post(
        "/voice/assistant",
        json={"query": "I fed Aarav 2 apples for breakfast"},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["action_type"] == "LOG_MEAL"
    assert data["action_data"]["food_name"] == "Apple"
    assert data["action_data"]["quantity"] == 2.0
    assert data["action_data"]["meal_type"] == "Breakfast"

def test_voice_recipe_query():
    headers = get_auth_headers()
    response = client.post(
        "/voice/assistant",
        json={"query": "Suggest iron-rich dinner ideas for my toddler"},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["action_type"] == "RECOMMENDATION"
    assert "Khichdi" in data["response_text"] or "Spinach" in data["response_text"]

def test_voice_growth_query():
    headers = get_auth_headers()
    response = client.post(
        "/voice/assistant",
        json={"query": "Is 14 kg healthy weight for height 95cm?"},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["action_type"] == "GROWTH_INFO"
    assert "Growth" in data["response_text"] or "Optimal" in data["response_text"]
