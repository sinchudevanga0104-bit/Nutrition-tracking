from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from app.models.meal import MealType
from decimal import Decimal

class FoodCreate(BaseModel):
    food_name: str
    category: Optional[str] = None
    serving_size: Optional[str] = None
    calories: Decimal
    protein: Decimal
    carbohydrates: Decimal
    fat: Decimal
    barcode: Optional[str] = None

class FoodResponse(BaseModel):
    food_id: int
    food_name: str
    category: Optional[str]
    serving_size: Optional[str]
    calories: Decimal
    protein: Decimal
    carbohydrates: Decimal
    fat: Decimal
    barcode: Optional[str] = None

    class Config:
        orm_mode = True

class MealItemCreate(BaseModel):
    food_id: int
    quantity: float

class MealItemResponse(BaseModel):
    item_id: int
    meal_id: int
    food_id: int
    quantity: Decimal
    food: FoodResponse

    class Config:
        orm_mode = True

class MealCreate(BaseModel):
    child_id: int
    meal_type: MealType
    meal_date: date

class MealResponse(BaseModel):
    meal_id: int
    child_id: int
    meal_type: MealType
    meal_date: date
    total_calories: Decimal
    total_protein: Decimal
    created_at: datetime
    items: List[MealItemResponse] = []

    class Config:
        orm_mode = True
