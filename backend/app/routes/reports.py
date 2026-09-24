from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
import csv
from io import StringIO

from app.database.connection import get_db
from app.models.user import User
from app.models.child import Child
from app.models.growth import GrowthRecord
from app.models.meal import Meal
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/{child_id}/export")
def export_health_report(
    child_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    child = db.query(Child).filter(Child.child_id == child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Gather data
    growth_records = db.query(GrowthRecord).filter(GrowthRecord.child_id == child_id).order_by(GrowthRecord.record_date.asc()).all()
    meals = db.query(Meal).filter(Meal.child_id == child_id).order_by(Meal.meal_date.asc()).all()
    
    # Create CSV
    output = StringIO()
    writer = csv.writer(output)
    
    # Child Info
    writer.writerow(["Child Name", child.name])
    writer.writerow(["Date of Birth", child.dob])
    writer.writerow(["Gender", child.gender])
    writer.writerow([])
    
    # Growth Data
    writer.writerow(["--- GROWTH RECORDS ---"])
    writer.writerow(["Date", "Height (cm)", "Weight (kg)", "BMI"])
    for record in growth_records:
        writer.writerow([record.record_date, record.height, record.weight, record.bmi])
    writer.writerow([])
    
    # Meals Data
    writer.writerow(["--- MEALS RECORDS ---"])
    writer.writerow(["Date", "Meal Type", "Total Calories", "Total Protein (g)"])
    for meal in meals:
        writer.writerow([meal.meal_date, meal.meal_type, meal.total_calories, meal.total_protein])
        
    output.seek(0)
    csv_content = output.getvalue()
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=health_report_{child.name}.csv"}
    )
