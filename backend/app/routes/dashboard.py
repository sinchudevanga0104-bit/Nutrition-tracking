from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from decimal import Decimal

from app.database.connection import get_db
from app.models.user import User
from app.models.child import Child
from app.models.meal import Meal
from app.models.growth import GrowthRecord
from app.models.recommendation import Recommendation
from app.schemas.dashboard import DashboardSummary
from app.auth.dependencies import get_current_user

from app.models.water import WaterLog, WaterGoal

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/{child_id}", response_model=DashboardSummary)
def get_dashboard_summary(
    child_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    child = db.query(Child).filter(Child.child_id == child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    today = date.today()
    
    # 1. Today's Nutrition
    meals_today = db.query(Meal).filter(Meal.child_id == child_id, Meal.meal_date == today).all()
    today_calories = sum(m.total_calories for m in meals_today) if meals_today else Decimal('0.0')
    today_protein = sum(m.total_protein for m in meals_today) if meals_today else Decimal('0.0')
    
    # 2. Latest Growth
    latest_growth = db.query(GrowthRecord).filter(GrowthRecord.child_id == child_id).order_by(GrowthRecord.record_date.desc()).first()
    latest_bmi = latest_growth.bmi if latest_growth else None
    
    # 3. Latest Recommendation
    latest_rec = db.query(Recommendation).filter(Recommendation.child_id == child_id).order_by(Recommendation.created_at.desc()).first()
    
    # 4. Today's Water
    water_logs = db.query(WaterLog).filter(WaterLog.child_id == child_id, WaterLog.log_date == today).all()
    today_water_ml = sum(w.amount_ml for w in water_logs)
    goal = db.query(WaterGoal).filter(WaterGoal.child_id == child_id).first()
    target_water_ml = goal.daily_target_ml if goal else 1500

    return DashboardSummary(
        child_id=child_id,
        date=today,
        today_calories=today_calories,
        today_protein=today_protein,
        latest_bmi=latest_bmi,
        latest_recommendation=latest_rec,
        today_water_ml=today_water_ml,
        target_water_ml=target_water_ml
    )
