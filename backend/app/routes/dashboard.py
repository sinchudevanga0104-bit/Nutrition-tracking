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
from app.services.who_standards import (
    calculate_age_months,
    get_who_bmi_benchmark,
    compute_who_zscore,
    classify_who_bmi,
    get_who_nutritional_targets
)

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
    gender_str = str(child.gender.value if hasattr(child.gender, "value") else child.gender)
    
    # 1. WHO Guidelines for child
    who_targets = get_who_nutritional_targets(child.dob, gender_str)
    
    # 2. Today's Nutrition
    meals_today = db.query(Meal).filter(Meal.child_id == child_id, Meal.meal_date == today).all()
    today_calories = sum(m.total_calories for m in meals_today) if meals_today else Decimal('0.0')
    today_protein = sum(m.total_protein for m in meals_today) if meals_today else Decimal('0.0')
    
    # 3. Latest Growth & WHO Status
    latest_growth = db.query(GrowthRecord).filter(GrowthRecord.child_id == child_id).order_by(GrowthRecord.record_date.desc()).first()
    latest_bmi = latest_growth.bmi if latest_growth else None
    
    who_status = "Optimal Normal Growth"
    who_badge_color = "#2E7D32"
    if latest_growth:
        age_m = calculate_age_months(child.dob, latest_growth.record_date)
        who_b = get_who_bmi_benchmark(age_m, gender_str)
        z = compute_who_zscore(float(latest_growth.bmi), who_b["median"], who_b["sd"])
        c = classify_who_bmi(z)
        who_status = c["status"]
        who_badge_color = c["badge_color"]
        
    # 4. Latest Recommendation
    latest_rec = db.query(Recommendation).filter(Recommendation.child_id == child_id).order_by(Recommendation.created_at.desc()).first()
    
    # 5. Today's Water
    water_logs = db.query(WaterLog).filter(WaterLog.child_id == child_id, WaterLog.log_date == today).all()
    today_water_ml = sum(w.amount_ml for w in water_logs)
    goal = db.query(WaterGoal).filter(WaterGoal.child_id == child_id).first()
    target_water_ml = goal.daily_target_ml if goal else who_targets["water_ml"]

    return DashboardSummary(
        child_id=child_id,
        date=today,
        today_calories=today_calories,
        today_protein=today_protein,
        target_calories=who_targets["calories"],
        target_protein=who_targets["protein"],
        latest_bmi=latest_bmi,
        who_status=who_status,
        who_badge_color=who_badge_color,
        latest_recommendation=latest_rec,
        today_water_ml=today_water_ml,
        target_water_ml=target_water_ml,
        who_guidelines=who_targets
    )
