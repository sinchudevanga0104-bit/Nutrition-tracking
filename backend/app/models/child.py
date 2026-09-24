from sqlalchemy import Column, Integer, String, Enum, Date, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database.connection import Base
import enum

class Gender(str, enum.Enum):
    male = "Male"
    female = "Female"
    other = "Other"

class ActivityLevel(str, enum.Enum):
    low = "Low"
    moderate = "Moderate"
    high = "High"

class Child(Base):
    __tablename__ = "children"

    child_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    parent_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    dob = Column(Date, nullable=False)
    gender = Column(Enum(Gender), nullable=False)
    blood_group = Column(String(5))
    food_allergies = Column(Text)
    food_preferences = Column(Text)
    activity_level = Column(Enum(ActivityLevel), default=ActivityLevel.moderate)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Assuming a relationship on the User model is not strictly required unless we need bidirectional access
    # but we can add it here if needed later.
