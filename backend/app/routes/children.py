from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database.connection import get_db
from app.models.user import User
from app.models.child import Child
from app.schemas.child import ChildCreate, ChildUpdate, ChildResponse
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/children", tags=["Children"])

@router.get("/", response_model=List[ChildResponse])
def get_children(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    children = db.query(Child).filter(Child.parent_id == current_user.user_id).all()
    return children

from datetime import date
from app.models.growth import GrowthRecord

@router.post("/", response_model=ChildResponse, status_code=status.HTTP_201_CREATED)
def add_child(child: ChildCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    child_data = child.dict(exclude={'height', 'weight'})
    new_child = Child(**child_data, parent_id=current_user.user_id)
    db.add(new_child)
    db.commit()
    db.refresh(new_child)
    
    if child.height and child.weight and child.height > 0:
        height_in_m = child.height / 100
        bmi = round(child.weight / (height_in_m * height_in_m), 2)
        growth_record = GrowthRecord(
            child_id=new_child.child_id,
            record_date=date.today(),
            height=child.height,
            weight=child.weight,
            bmi=bmi
        )
        db.add(growth_record)
        db.commit()

    return new_child

@router.get("/{child_id}", response_model=ChildResponse)
def get_child(child_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    child = db.query(Child).filter(Child.child_id == child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    return child

@router.put("/{child_id}", response_model=ChildResponse)
def update_child(child_id: int, child_update: ChildUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    child = db.query(Child).filter(Child.child_id == child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    
    update_data = child_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(child, key, value)
        
    db.commit()
    db.refresh(child)
    return child

@router.delete("/{child_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_child(child_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    child = db.query(Child).filter(Child.child_id == child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    
    db.delete(child)
    db.commit()
    return None
