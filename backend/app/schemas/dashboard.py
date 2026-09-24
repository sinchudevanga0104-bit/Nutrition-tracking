from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import date
from app.schemas.recommendation import RecommendationResponse

class DashboardSummary(BaseModel):
    child_id: int
    date: date
    today_calories: Decimal
    today_protein: Decimal
    latest_bmi: Optional[Decimal]
    latest_recommendation: Optional[RecommendationResponse]
    today_water_ml: Optional[int] = 0
    target_water_ml: Optional[int] = 1500

    class Config:
        orm_mode = True
