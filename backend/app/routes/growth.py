from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database.connection import get_db
from app.models.user import User
from app.models.child import Child
from app.models.growth import GrowthRecord
from app.schemas.growth import GrowthRecordCreate, GrowthRecordResponse
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/growth", tags=["Growth"])

@router.get("/{child_id}", response_model=List[GrowthRecordResponse])
def get_growth_records(
    child_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify ownership
    child = db.query(Child).filter(Child.child_id == child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=403, detail="Not authorized to access this child's data")
        
    records = db.query(GrowthRecord).filter(GrowthRecord.child_id == child_id).order_by(GrowthRecord.record_date.asc()).all()
    return records

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
        
    # Calculate BMI: weight(kg) / (height(m) * height(m))
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
