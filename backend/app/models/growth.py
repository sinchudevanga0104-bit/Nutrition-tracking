from sqlalchemy import Column, Integer, DECIMAL, ForeignKey, Date, DateTime
from sqlalchemy.sql import func
from app.database.connection import Base

class GrowthRecord(Base):
    __tablename__ = "growth_records"

    record_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    child_id = Column(Integer, ForeignKey("children.child_id", ondelete="CASCADE"), nullable=False)
    record_date = Column(Date, nullable=False)
    height = Column(DECIMAL(5,2), nullable=False) # in cm
    weight = Column(DECIMAL(5,2), nullable=False) # in kg
    bmi = Column(DECIMAL(5,2), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
