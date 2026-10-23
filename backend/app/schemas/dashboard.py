from pydantic import BaseModel
from typing import Optional, Dict, Any
from decimal import Decimal
from datetime import date
from app.schemas.recommendation import RecommendationResponse

class DashboardSummary(BaseModel):
    child_id: int
    date: date
    today_calories: Decimal
    today_protein: Decimal
    target_calories: Optional[int] = 1350
    target_protein: Optional[float] = 19.0
    latest_bmi: Optional[Decimal]
    who_status: Optional[str] = "Optimal Normal Growth"
    who_badge_color: Optional[str] = "#2E7D32"
    latest_recommendation: Optional[RecommendationResponse]
    today_water_ml: Optional[int] = 0
    target_water_ml: Optional[int] = 1500
    who_guidelines: Optional[Dict[str, Any]] = None

    class Config:
        orm_mode = True
