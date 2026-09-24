from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from app.models.child import Gender, ActivityLevel

class ChildBase(BaseModel):
    name: str
    dob: date
    gender: Gender
    blood_group: Optional[str] = None
    food_allergies: Optional[str] = None
    food_preferences: Optional[str] = None
    activity_level: Optional[ActivityLevel] = ActivityLevel.moderate

class ChildCreate(ChildBase):
    height: Optional[float] = None
    weight: Optional[float] = None

class ChildUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[Gender] = None
    blood_group: Optional[str] = None
    food_allergies: Optional[str] = None
    food_preferences: Optional[str] = None
    activity_level: Optional[ActivityLevel] = None

class ChildResponse(ChildBase):
    child_id: int
    parent_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
