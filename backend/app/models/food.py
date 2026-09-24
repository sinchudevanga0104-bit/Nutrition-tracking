from sqlalchemy import Column, Integer, String, DECIMAL
from app.database.connection import Base

class Food(Base):
    __tablename__ = "foods"

    food_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    food_name = Column(String(150), nullable=False, index=True)
    category = Column(String(50))
    serving_size = Column(String(50))
    calories = Column(DECIMAL(6,2), default=0.00)
    protein = Column(DECIMAL(6,2), default=0.00)
    carbohydrates = Column(DECIMAL(6,2), default=0.00)
    fat = Column(DECIMAL(6,2), default=0.00)
    fiber = Column(DECIMAL(6,2), default=0.00)
    calcium = Column(DECIMAL(6,2), default=0.00)
    iron = Column(DECIMAL(6,2), default=0.00)
    vitamin_a = Column(DECIMAL(6,2), default=0.00)
    vitamin_c = Column(DECIMAL(6,2), default=0.00)
    barcode = Column(String(50), index=True, nullable=True)

