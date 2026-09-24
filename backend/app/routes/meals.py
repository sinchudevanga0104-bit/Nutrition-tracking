from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from decimal import Decimal

from app.database.connection import get_db
from app.models.user import User
from app.models.child import Child
from app.models.food import Food
from app.models.meal import Meal, MealItem, MealType
from app.schemas.meal import FoodResponse, FoodCreate, MealCreate, MealResponse, MealItemCreate, MealItemResponse
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/meals", tags=["Meals"])

@router.get("/foods", response_model=List[FoodResponse])
def get_foods(
    query: str = Query(None, description="Search foods by name"),
    db: Session = Depends(get_db)
):
    if query:
        foods = db.query(Food).filter(Food.food_name.ilike(f"%{query}%")).all()
    else:
        foods = db.query(Food).limit(50).all() # Return 50 by default if no query
    return foods

@router.get("/foods/barcode/{barcode}", response_model=FoodResponse)
def get_food_by_barcode(
    barcode: str,
    db: Session = Depends(get_db)
):
    food = db.query(Food).filter(Food.barcode == barcode).first()
    if not food:
        # Fallback partial check or 404
        food = db.query(Food).filter(Food.food_name.ilike(f"%{barcode}%")).first()
    if not food:
        raise HTTPException(status_code=404, detail=f"No food item found for barcode '{barcode}'")
    return food


@router.post("/foods", response_model=FoodResponse, status_code=status.HTTP_201_CREATED)
def create_food(
    food: FoodCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Usually only admin/nutritionist can create foods, but for demo we allow it
    new_food = Food(
        food_name=food.food_name,
        category=food.category,
        serving_size=food.serving_size,
        calories=food.calories,
        protein=food.protein,
        carbohydrates=food.carbohydrates,
        fat=food.fat,
        barcode=food.barcode
    )
    db.add(new_food)
    db.commit()
    db.refresh(new_food)
    return new_food

@router.get("/", response_model=List[MealResponse])
def get_meals(
    child_id: int,
    meal_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify child belongs to parent
    child = db.query(Child).filter(Child.child_id == child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=403, detail="Not authorized to access this child's data")
        
    meals = db.query(Meal).filter(Meal.child_id == child_id, Meal.meal_date == meal_date).all()
    return meals

@router.post("/", response_model=MealResponse, status_code=status.HTTP_201_CREATED)
def create_meal(
    meal: MealCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    child = db.query(Child).filter(Child.child_id == meal.child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=403, detail="Not authorized to access this child's data")
        
    # Check if meal type for that date already exists
    existing_meal = db.query(Meal).filter(
        Meal.child_id == meal.child_id, 
        Meal.meal_date == meal.meal_date,
        Meal.meal_type == meal.meal_type
    ).first()
    
    if existing_meal:
        return existing_meal # Just return existing instead of erroring
        
    new_meal = Meal(
        child_id=meal.child_id,
        meal_type=meal.meal_type,
        meal_date=meal.meal_date
    )
    db.add(new_meal)
    db.commit()
    db.refresh(new_meal)
    return new_meal

@router.post("/{meal_id}/items", response_model=MealResponse)
def add_meal_item(
    meal_id: int,
    item: MealItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Verify meal and ownership
    meal = db.query(Meal).join(Child).filter(
        Meal.meal_id == meal_id, 
        Child.parent_id == current_user.user_id
    ).first()
    
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
        
    # 2. Get Food
    food = db.query(Food).filter(Food.food_id == item.food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Food item not found")
        
    # 3. Create Meal Item
    meal_item = MealItem(
        meal_id=meal_id,
        food_id=item.food_id,
        quantity=item.quantity
    )
    db.add(meal_item)
    
    # 4. Update Meal Totals
    added_calories = food.calories * Decimal(item.quantity)
    added_protein = food.protein * Decimal(item.quantity)
    
    meal.total_calories += added_calories
    meal.total_protein += added_protein
    
    db.commit()
    db.refresh(meal)
    return meal

@router.delete("/items/{item_id}", response_model=MealResponse)
def delete_meal_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meal_item = db.query(MealItem).join(Meal).join(Child).filter(
        MealItem.item_id == item_id,
        Child.parent_id == current_user.user_id
    ).first()
    
    if not meal_item:
        raise HTTPException(status_code=404, detail="Meal item not found")
        
    meal = meal_item.meal
    food = meal_item.food
    
    # Update Totals
    removed_calories = food.calories * meal_item.quantity
    removed_protein = food.protein * meal_item.quantity
    
    meal.total_calories -= removed_calories
    meal.total_protein -= removed_protein
    
    db.delete(meal_item)
    db.commit()
    db.refresh(meal)
    
    return meal
