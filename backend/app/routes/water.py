from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from datetime import date, timedelta
from typing import List, Optional

from app.database.connection import get_db
from app.models.user import User
from app.models.child import Child
from app.models.water import WaterLog, WaterGoal
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/water", tags=["Water Tracker & Reminders"])

# Pydantic Schemas
class WaterLogCreate(BaseModel):
    child_id: int
    amount_ml: int = Field(gt=0, description="Amount of water in ml")
    log_date: Optional[date] = None

class WaterGoalUpdate(BaseModel):
    child_id: int
    daily_target_ml: int = Field(gt=100, le=5000)
    reminder_enabled: bool = True
    reminder_interval_hours: int = Field(default=2, ge=1, le=12)
    start_time: str = "08:00"
    end_time: str = "20:00"

@router.get("/{child_id}")
def get_water_status(
    child_id: int,
    target_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify child belongs to current user
    child = db.query(Child).filter(Child.child_id == child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")

    selected_date = target_date or date.today()

    # Get or create goal settings
    goal = db.query(WaterGoal).filter(WaterGoal.child_id == child_id).first()
    if not goal:
        goal = WaterGoal(child_id=child_id, daily_target_ml=1500)
        db.add(goal)
        db.commit()
        db.refresh(goal)

    # Fetch today's logs
    logs = db.query(WaterLog).filter(
        WaterLog.child_id == child_id,
        WaterLog.log_date == selected_date
    ).order_by(WaterLog.created_at.desc()).all()

    total_intake = sum(l.amount_ml for l in logs)
    percentage = min(100.0, round((total_intake / goal.daily_target_ml) * 100, 1))

    # Calculate streak (consecutive past days where goal was achieved)
    streak = 0
    check_day = selected_date
    for _ in range(30):
        day_total = db.query(func.sum(WaterLog.amount_ml)).filter(
            WaterLog.child_id == child_id,
            WaterLog.log_date == check_day
        ).scalar() or 0

        if day_total >= goal.daily_target_ml:
            streak += 1
            check_day -= timedelta(days=1)
        else:
            if check_day == selected_date:
                # If today not complete yet, check starting from yesterday for existing streak
                check_day -= timedelta(days=1)
                continue
            break

    return {
        "child_id": child_id,
        "date": selected_date.isoformat(),
        "total_intake_ml": total_intake,
        "daily_target_ml": goal.daily_target_ml,
        "percentage": percentage,
        "goal_achieved": total_intake >= goal.daily_target_ml,
        "streak_days": streak,
        "reminder_enabled": goal.reminder_enabled,
        "reminder_interval_hours": goal.reminder_interval_hours,
        "start_time": goal.start_time,
        "end_time": goal.end_time,
        "logs": [
            {
                "log_id": log.log_id,
                "amount_ml": log.amount_ml,
                "created_at": log.created_at.isoformat() if log.created_at else None
            }
            for log in logs
        ]
    }

@router.post("/log")
def log_water_intake(
    data: WaterLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    child = db.query(Child).filter(Child.child_id == data.child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")

    log_entry = WaterLog(
        child_id=data.child_id,
        amount_ml=data.amount_ml,
        log_date=data.log_date or date.today()
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)

    return {"message": "Water intake logged successfully", "log_id": log_entry.log_id, "amount_ml": log_entry.amount_ml}

@router.delete("/log/{log_id}")
def delete_water_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    log_entry = db.query(WaterLog).filter(WaterLog.log_id == log_id).first()
    if not log_entry:
        raise HTTPException(status_code=404, detail="Log entry not found")

    child = db.query(Child).filter(Child.child_id == log_entry.child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=403, detail="Not authorized")

    db.delete(log_entry)
    db.commit()
    return {"message": "Water log deleted successfully"}

@router.post("/goal")
def update_water_goal(
    data: WaterGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    child = db.query(Child).filter(Child.child_id == data.child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")

    goal = db.query(WaterGoal).filter(WaterGoal.child_id == data.child_id).first()
    if not goal:
        goal = WaterGoal(child_id=data.child_id)
        db.add(goal)

    goal.daily_target_ml = data.daily_target_ml
    goal.reminder_enabled = data.reminder_enabled
    goal.reminder_interval_hours = data.reminder_interval_hours
    goal.start_time = data.start_time
    goal.end_time = data.end_time

    db.commit()
    return {"message": "Water reminder settings updated successfully"}
