from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.recommendation import RecType

class RecommendationResponse(BaseModel):
    recommendation_id: int
    child_id: int
    generated_by: Optional[int]
    content: str
    type: RecType
    created_at: datetime

    class Config:
        orm_mode = True
