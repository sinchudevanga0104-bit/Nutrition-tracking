from sqlalchemy import Column, Integer, String, Text, ForeignKey, Enum, DateTime
from sqlalchemy.sql import func
from app.database.connection import Base
import enum

class RecType(str, enum.Enum):
    food = "Food"
    activity = "Activity"
    general = "General"

class Recommendation(Base):
    __tablename__ = "recommendations"

    recommendation_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    child_id = Column(Integer, ForeignKey("children.child_id", ondelete="CASCADE"), nullable=False)
    generated_by = Column(Integer, ForeignKey("users.user_id"), nullable=True) # Null if AI generated
    content = Column(Text, nullable=False)
    type = Column(Enum(RecType), default=RecType.general)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
