from sqlalchemy import Column, Integer, DECIMAL, ForeignKey, Enum, Date, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.database.connection import Base
from app.models.food import Food

class MealType(str, enum.Enum):
    breakfast = "Breakfast"
    lunch = "Lunch"
    snacks = "Snacks"
    dinner = "Dinner"

class Meal(Base):
    __tablename__ = "meals"

    meal_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    child_id = Column(Integer, ForeignKey("children.child_id", ondelete="CASCADE"), nullable=False)
    meal_type = Column(Enum(MealType), nullable=False)
    meal_date = Column(Date, nullable=False)
    total_calories = Column(DECIMAL(6,2), default=0.00)
    total_protein = Column(DECIMAL(6,2), default=0.00)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship to MealItems
    items = relationship("MealItem", back_populates="meal", cascade="all, delete-orphan")


class MealItem(Base):
    __tablename__ = "meal_items"

    item_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meal_id = Column(Integer, ForeignKey("meals.meal_id", ondelete="CASCADE"), nullable=False)
    food_id = Column(Integer, ForeignKey("foods.food_id"), nullable=False)
    quantity = Column(DECIMAL(6,2), nullable=False, default=1.0) # Number of servings

    meal = relationship("Meal", back_populates="items")
    food = relationship("Food")
