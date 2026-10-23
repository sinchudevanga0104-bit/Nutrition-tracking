from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import date

from app.database.connection import get_db
from app.models.user import User
from app.models.child import Child
from app.models.growth import GrowthRecord
from app.schemas.growth import GrowthRecordCreate, GrowthRecordResponse
from app.auth.dependencies import get_current_user
from app.services.who_standards import (
    calculate_age_months,
    get_who_bmi_benchmark,
    get_who_weight_benchmark,
    get_who_height_benchmark,
    compute_who_zscore,
    zscore_to_percentile,
    classify_who_bmi,
    get_who_nutritional_targets
)

router = APIRouter(prefix="/growth", tags=["Growth"])

@router.get("/{child_id}", response_model=List[GrowthRecordResponse])
def get_growth_records(
    child_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    child = db.query(Child).filter(Child.child_id == child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=403, detail="Not authorized to access this child's data")
        
    records = db.query(GrowthRecord).filter(GrowthRecord.child_id == child_id).order_by(GrowthRecord.record_date.asc()).all()
    return records

@router.get("/{child_id}/who-assessment")
def get_who_growth_assessment(
    child_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Evaluates child's growth measurements directly against the World Health Organization
    (WHO) Child Growth Standards (0-5 years) & WHO Reference 2007 (5-19 years).
    """
    child = db.query(Child).filter(Child.child_id == child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=403, detail="Not authorized to access this child's data")
        
    records = db.query(GrowthRecord).filter(GrowthRecord.child_id == child_id).order_by(GrowthRecord.record_date.asc()).all()
    
    current_age_months = calculate_age_months(child.dob)
    gender_str = str(child.gender.value if hasattr(child.gender, "value") else child.gender)
    
    who_curr_bmi = get_who_bmi_benchmark(current_age_months, gender_str)
    who_curr_weight = get_who_weight_benchmark(current_age_months, gender_str)
    who_curr_height = get_who_height_benchmark(current_age_months, gender_str)
    
    latest_rec = records[-1] if records else None
    
    assessment = None
    if latest_rec:
        rec_age_months = calculate_age_months(child.dob, latest_rec.record_date)
        rec_who_bmi = get_who_bmi_benchmark(rec_age_months, gender_str)
        
        bmi_val = float(latest_rec.bmi)
        z_score = compute_who_zscore(bmi_val, rec_who_bmi["median"], rec_who_bmi["sd"])
        percentile = zscore_to_percentile(z_score)
        classification = classify_who_bmi(z_score)
        
        assessment = {
            "bmi": bmi_val,
            "weight_kg": float(latest_rec.weight),
            "height_cm": float(latest_rec.height),
            "record_date": str(latest_rec.record_date),
            "age_months_at_record": rec_age_months,
            "who_zscore": z_score,
            "who_percentile": percentile,
            "who_median_bmi": rec_who_bmi["median"],
            "who_normal_min_bmi": rec_who_bmi["minus_2sd"],
            "who_normal_max_bmi": rec_who_bmi["plus_1sd"],
            "who_median_weight": get_who_weight_benchmark(rec_age_months, gender_str),
            "who_median_height": get_who_height_benchmark(rec_age_months, gender_str),
            "status": classification["status"],
            "badge_color": classification["badge_color"],
            "clinical_advice": classification["clinical_advice"]
        }
    
    # Calculate historical comparison points with WHO standards overlay
    history_comparison = []
    for r in records:
        r_months = calculate_age_months(child.dob, r.record_date)
        r_who = get_who_bmi_benchmark(r_months, gender_str)
        r_z = compute_who_zscore(float(r.bmi), r_who["median"], r_who["sd"])
        history_comparison.append({
            "record_id": r.record_id,
            "date": str(r.record_date),
            "age_months": r_months,
            "child_bmi": float(r.bmi),
            "child_weight": float(r.weight),
            "child_height": float(r.height),
            "who_median_bmi": r_who["median"],
            "who_lower_2sd_bmi": r_who["minus_2sd"],
            "who_upper_2sd_bmi": r_who["plus_2sd"],
            "who_zscore": r_z,
            "who_percentile": zscore_to_percentile(r_z)
        })

    return {
        "child_id": child.child_id,
        "name": child.name,
        "dob": str(child.dob),
        "gender": gender_str,
        "current_age_months": current_age_months,
        "current_age_years": round(current_age_months / 12.0, 1),
        "who_standard_reference": "WHO Child Growth Standards (0-5y) & WHO Reference (5-19y)",
        "current_who_standards": {
            "median_bmi": who_curr_bmi["median"],
            "healthy_bmi_range": f"{who_curr_bmi['minus_2sd']} - {who_curr_bmi['plus_1sd']}",
            "median_weight_kg": who_curr_weight,
            "median_height_cm": who_curr_height
        },
        "latest_assessment": assessment,
        "history_comparison": history_comparison
    }

@router.get("/{child_id}/who-targets")
def get_who_child_targets(
    child_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns official WHO/FAO daily dietary targets for this child."""
    child = db.query(Child).filter(Child.child_id == child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=403, detail="Not authorized to access this child's data")
        
    gender_str = str(child.gender.value if hasattr(child.gender, "value") else child.gender)
    return get_who_nutritional_targets(child.dob, gender_str)

@router.post("/", response_model=GrowthRecordResponse, status_code=status.HTTP_201_CREATED)
def create_growth_record(
    record: GrowthRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    child = db.query(Child).filter(Child.child_id == record.child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=403, detail="Not authorized to access this child's data")
        
    if record.height <= 0:
        raise HTTPException(status_code=400, detail="Height must be greater than zero")
        
    height_in_m = record.height / 100
    bmi = record.weight / (height_in_m * height_in_m)
    
    new_record = GrowthRecord(
        child_id=record.child_id,
        record_date=record.record_date,
        height=record.height,
        weight=record.weight,
        bmi=round(bmi, 2)
    )
    
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record
