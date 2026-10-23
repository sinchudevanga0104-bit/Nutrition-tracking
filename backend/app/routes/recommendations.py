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

from app.services.who_standards import (
    calculate_age_months,
    get_who_bmi_benchmark,
    compute_who_zscore,
    zscore_to_percentile,
    classify_who_bmi,
    get_who_nutritional_targets
)

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

    current_age_months = calculate_age_months(child.dob)
    gender_str = str(child.gender.value if hasattr(child.gender, "value") else child.gender)
    who_targets = get_who_nutritional_targets(current_age_months, gender_str)

    # 1. Fetch latest growth record
    latest_growth = db.query(GrowthRecord).filter(GrowthRecord.child_id == child_id).order_by(GrowthRecord.record_date.desc()).first()
    
    # 2. Fetch recent meals
    recent_meals = db.query(Meal).filter(Meal.child_id == child_id).order_by(Meal.meal_date.desc()).limit(10).all()
    
    new_recs = []

    # Rule 1: WHO Growth / BMI Assessment
    if latest_growth:
        rec_age = calculate_age_months(child.dob, latest_growth.record_date)
        rec_who_bmi = get_who_bmi_benchmark(rec_age, gender_str)
        bmi_val = float(latest_growth.bmi)
        z_score = compute_who_zscore(bmi_val, rec_who_bmi["median"], rec_who_bmi["sd"])
        percentile = zscore_to_percentile(z_score)
        classification = classify_who_bmi(z_score)

        if z_score < -2.0:
            new_recs.append(Recommendation(
                child_id=child_id,
                content=f"WHO Child Growth Standard: BMI ({bmi_val:.1f}) is at the {percentile}th percentile ({classification['status']}). {classification['clinical_advice']}",
                type=RecType.food
            ))
        elif z_score > 1.0:
            new_recs.append(Recommendation(
                child_id=child_id,
                content=f"WHO Child Growth Standard: BMI ({bmi_val:.1f}) is at the {percentile}th percentile ({classification['status']}). {classification['clinical_advice']}",
                type=RecType.activity
            ))
        else:
            new_recs.append(Recommendation(
                child_id=child_id,
                content=f"WHO Child Growth Standard: BMI ({bmi_val:.1f}) is in the Optimal Normal range at the {percentile}th percentile (WHO 50th percentile median: {rec_who_bmi['median']:.1f}). Maintain consistent physical activity.",
                type=RecType.general
            ))
    else:
        new_recs.append(Recommendation(
            child_id=child_id,
            content="Please log a Growth Measurement (Height and Weight) to evaluate growth percentiles against WHO Child Growth Standards.",
            type=RecType.activity
        ))

    # Rule 2: WHO Dietary Targets Assessment
    target_protein = who_targets["protein_g"]
    target_cals = who_targets["calories"]
    age_group = who_targets["age_group"]

    if recent_meals:
        avg_protein = sum(m.total_protein for m in recent_meals) / len(recent_meals)
        avg_cals = sum(m.total_calories for m in recent_meals) / len(recent_meals)
        
        if avg_protein < (target_protein * 0.25):  # meal-level check
            new_recs.append(Recommendation(
                child_id=child_id,
                content=f"WHO Nutritional Guidance ({age_group}): Target is {target_protein}g protein daily. Recent meals average only {avg_protein:.1f}g protein. Boost intake with dal, pulses, eggs, or dairy.",
                type=RecType.food
            ))
        else:
            new_recs.append(Recommendation(
                child_id=child_id,
                content=f"WHO Nutritional Guidance ({age_group}): Daily targets are {target_cals} kcal and {target_protein}g protein. Ensure variety with micronutrient-rich colorful fruits and vegetables.",
                type=RecType.food
            ))
    else:
        new_recs.append(Recommendation(
            child_id=child_id,
            content=f"Start logging daily meals to track nutrition against WHO guidelines ({target_cals} kcal and {target_protein}g protein daily for {age_group}).",
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
