from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database.connection import get_db
from app.models.user import User
from app.models.child import Child
from app.models.growth import GrowthRecord
from app.models.meal import Meal
from app.models.recommendation import Recommendation, RecType
from app.schemas.recommendation import RecommendationResponse
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])

@router.get("/{child_id}", response_model=List[RecommendationResponse])
def get_recommendations(
    child_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    child = db.query(Child).filter(Child.child_id == child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    recs = db.query(Recommendation).filter(Recommendation.child_id == child_id).order_by(Recommendation.created_at.desc()).all()
    return recs

@router.post("/{child_id}/generate", response_model=List[RecommendationResponse])
def generate_recommendations(
    child_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    child = db.query(Child).filter(Child.child_id == child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=403, detail="Not authorized")

    # 1. Fetch latest growth record
    latest_growth = db.query(GrowthRecord).filter(GrowthRecord.child_id == child_id).order_by(GrowthRecord.record_date.desc()).first()
    
    # 2. Fetch meals from the last 7 days to calculate average daily protein/calories
    # For MVP, we just get the most recent meals
    recent_meals = db.query(Meal).filter(Meal.child_id == child_id).order_by(Meal.meal_date.desc()).limit(10).all()
    
    new_recs = []

    # Rule Engine Logic
    # Rule 1: Growth / BMI
    if latest_growth:
        if latest_growth.bmi > 18.5:
            new_recs.append(Recommendation(
                child_id=child_id,
                content="BMI indicates potential overweight status. Encourage at least 60 minutes of active play daily (e.g., cycling, swimming, tag).",
                type=RecType.activity
            ))
        elif latest_growth.bmi < 14.0:
            new_recs.append(Recommendation(
                child_id=child_id,
                content="BMI indicates potential underweight status. Consider incorporating more healthy fats like avocados, nuts, and whole milk.",
                type=RecType.food
            ))
        else:
            new_recs.append(Recommendation(
                child_id=child_id,
                content="Growth trend looks very healthy! Keep up the balanced diet and consistent activity.",
                type=RecType.general
            ))
    else:
        new_recs.append(Recommendation(
            child_id=child_id,
            content="Please log a Growth Measurement (Height and Weight) to receive personalized physical activity insights.",
            type=RecType.activity
        ))

    # Rule 2: Nutrition 
    if recent_meals:
        avg_protein = sum(m.total_protein for m in recent_meals) / len(recent_meals)
        if avg_protein < 15:
            new_recs.append(Recommendation(
                child_id=child_id,
                content="Recent meals show low protein intake. Try adding eggs, beans, or lean meats to the next meal.",
                type=RecType.food
            ))
        else:
            new_recs.append(Recommendation(
                child_id=child_id,
                content="Protein intake looks adequate. Ensure to balance it with enough fiber from fruits and vegetables.",
                type=RecType.food
            ))
    else:
        new_recs.append(Recommendation(
            child_id=child_id,
            content="Start logging daily meals to receive AI-powered dietary suggestions tailored to your child's nutrition gaps.",
            type=RecType.food
        ))

    # Save to DB
    for rec in new_recs:
        db.add(rec)
        
    db.commit()
    
    # Return newly generated
    for rec in new_recs:
        db.refresh(rec)
        
    return new_recs
