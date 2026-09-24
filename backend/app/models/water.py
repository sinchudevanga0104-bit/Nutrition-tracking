from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database.connection import Base

class WaterLog(Base):
    __tablename__ = "water_logs"

    log_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    child_id = Column(Integer, ForeignKey("children.child_id", ondelete="CASCADE"), nullable=False)
    log_date = Column(Date, nullable=False, default=func.current_date())
    amount_ml = Column(Integer, nullable=False, default=200)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class WaterGoal(Base):
    __tablename__ = "water_goals"

    goal_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    child_id = Column(Integer, ForeignKey("children.child_id", ondelete="CASCADE"), nullable=False, unique=True)
    daily_target_ml = Column(Integer, nullable=False, default=1500)
    reminder_enabled = Column(Boolean, default=True)
    reminder_interval_hours = Column(Integer, default=2)
    start_time = Column(String(10), default="08:00")
    end_time = Column(String(10), default="20:00")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
