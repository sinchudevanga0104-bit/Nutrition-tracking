from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal

class GrowthRecordCreate(BaseModel):
    child_id: int
    record_date: date
    height: float # in cm
    weight: float # in kg

class GrowthRecordResponse(BaseModel):
    record_id: int
    child_id: int
    record_date: date
    height: Decimal
    weight: Decimal
    bmi: Decimal
    created_at: datetime

    class Config:
        orm_mode = True
