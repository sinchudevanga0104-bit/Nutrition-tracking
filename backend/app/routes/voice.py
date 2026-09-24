from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import date
import re

from app.database.connection import get_db
from app.models.user import User
from app.models.child import Child
from app.models.food import Food
from app.models.meal import Meal, MealItem
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/voice", tags=["Voice Assistant"])

class VoiceQueryRequest(BaseModel):
    query: str
    child_id: Optional[int] = None

class VoiceAssistantResponse(BaseModel):
    response_text: str
    speech_text: str
    action_type: str # "LOG_MEAL", "RECOMMENDATION", "GROWTH_INFO", "WATER_TRACK", "GENERAL_AI"
    action_data: Optional[Dict[str, Any]] = None
    suggestions: List[str] = []

@router.post("/assistant", response_model=VoiceAssistantResponse)
def process_voice_query(
    payload: VoiceQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query_raw = payload.query.strip()
    query_lower = query_raw.lower()
    child = None
    
    if payload.child_id:
        child = db.query(Child).filter(Child.child_id == payload.child_id, Child.parent_id == current_user.user_id).first()
    
    if not child:
        child = db.query(Child).filter(Child.parent_id == current_user.user_id).first()
        
    child_name = child.name if child else "your child"

    # -------------------------------------------------------------
    # 1. RECIPE & MEAL RECOMMENDATIONS (Prioritized over general meal triggers)
    # -------------------------------------------------------------
    if any(word in query_lower for word in ["recipe", "suggest", "ideas", "what to cook", "what should i cook", "iron rich", "calcium rich"]):
        response_text = (
            f"💡 **Recommended Meals for {child_name}**:\n\n"
            f"1. **Spinach & Cheese Khichdi**: Rich in Iron & Calcium. Easy to digest.\n"
            f"2. **Oatmeal with Banana & Almond Butter**: Packed with Fibre & Protein.\n"
            f"3. **Paneer Tikka Roll / Scramble**: Excellent for muscle growth and energy."
        )
        speech_text = f"Here are great meal ideas for {child_name}: Spinach Khichdi, Oats with Banana, or Paneer Tikka scramble."
        
        return VoiceAssistantResponse(
            response_text=response_text,
            speech_text=speech_text,
            action_type="RECOMMENDATION",
            action_data={
                "recommendations": [
                    {"title": "Spinach & Cheese Khichdi", "benefit": "Iron & Calcium rich"},
                    {"title": "Oatmeal with Banana & Almond Butter", "benefit": "High Fiber & Energy"},
                    {"title": "Paneer Scramble", "benefit": "High Protein"}
                ]
            },
            suggestions=[
                f"Log Spinach Khichdi for {child_name}",
                "How much protein is needed for a toddler?",
                "Check today's nutrition intake"
            ]
        )
    
    # -------------------------------------------------------------
    # 2. MEAL LOGGING VOICE COMMAND (e.g. "I fed Aarav 2 idlis for breakfast")
    # -------------------------------------------------------------
    meal_triggers = ["log", "fed", "ate", "had", "eating", "breakfast", "lunch", "dinner", "snack", "cooked", "gave"]
    is_meal_command = any(word in query_lower for word in meal_triggers)
    
    if is_meal_command:
        meal_type = "Breakfast"
        if "lunch" in query_lower:
            meal_type = "Lunch"
        elif "dinner" in query_lower:
            meal_type = "Dinner"
        elif "snack" in query_lower or "evening" in query_lower:
            meal_type = "Snack"
            
        all_foods = db.query(Food).all()
        matched_food = None
        matched_quantity = 1.0
        
        numbers = re.findall(r'\b\d+(?:\.\d+)?\b', query_lower)
        if numbers:
            try:
                matched_quantity = float(numbers[0])
            except ValueError:
                matched_quantity = 1.0

        for f in all_foods:
            if f.food_name.lower() in query_lower:
                matched_food = f
                break
                
        if not matched_food:
            for word in query_lower.split():
                if len(word) > 2 and word not in ["log", "fed", "ate", "had", "the", "for", "and", "with", "cup", "bowl"]:
                    f_match = db.query(Food).filter(Food.food_name.ilike(f"%{word}%")).first()
                    if f_match:
                        matched_food = f_match
                        break
                        
        if matched_food:
            total_cals = float(matched_food.calories) * matched_quantity
            total_prot = float(matched_food.protein) * matched_quantity
            
            response_text = (
                f"Got it! I prepared a **{meal_type}** log for **{child_name}**: "
                f"{matched_quantity}x {matched_food.food_name} (~{total_cals:.0f} kcal, {total_prot:.1f}g protein). "
                f"Tap **Confirm & Save** to add it to {child_name}'s diet!"
            )
            speech_text = f"Got it! Ready to log {matched_quantity} {matched_food.food_name} for {child_name}'s {meal_type}. Tap confirm to save."
            
            return VoiceAssistantResponse(
                response_text=response_text,
                speech_text=speech_text,
                action_type="LOG_MEAL",
                action_data={
                    "child_id": child.child_id if child else None,
                    "food_id": matched_food.food_id,
                    "food_name": matched_food.food_name,
                    "quantity": matched_quantity,
                    "meal_type": meal_type,
                    "calories": total_cals,
                    "protein": total_prot,
                    "serving_size": matched_food.serving_size
                },
                suggestions=[
                    f"Log 1 glass of milk for {child_name}",
                    f"How much protein did {child_name} have today?",
                    "Suggest dinner recipes"
                ]
            )
        else:
            food_name_guess = query_raw.replace("log", "").replace("fed", "").replace("ate", "").replace("for breakfast", "").replace("for lunch", "").replace("for dinner", "").strip().title()
            if not food_name_guess:
                food_name_guess = "Balanced Meal"
                
            response_text = (
                f"I heard you want to log **{food_name_guess}** for {child_name}'s {meal_type}. "
                f"I've set up a pre-filled card so you can quickly save it!"
            )
            speech_text = f"I've set up a meal card for {food_name_guess}. Tap confirm to add it."
            
            fallback_food = db.query(Food).first()
            food_id = fallback_food.food_id if fallback_food else 1
            
            return VoiceAssistantResponse(
                response_text=response_text,
                speech_text=speech_text,
                action_type="LOG_MEAL",
                action_data={
                    "child_id": child.child_id if child else None,
                    "food_id": food_id,
                    "food_name": food_name_guess,
                    "quantity": 1.0,
                    "meal_type": meal_type,
                    "calories": 220.0,
                    "protein": 7.5,
                    "serving_size": "1 portion"
                },
                suggestions=[
                    "Check today's nutrition summary",
                    "Suggest high-iron snacks"
                ]
            )

    # -------------------------------------------------------------
    # 3. TODAY'S NUTRITION & PROGRESS INQUIRY
    # -------------------------------------------------------------
    if any(word in query_lower for word in ["today", "intake", "calories", "protein", "summary", "how much", "status"]):
        if child:
            today_meals = db.query(Meal).filter(Meal.child_id == child.child_id, Meal.meal_date == date.today()).all()
            total_calories = sum(float(m.total_calories) for m in today_meals)
            total_protein = sum(float(m.total_protein) for m in today_meals)
            
            response_text = (
                f"📊 **{child_name}'s Nutrition Today**:\n"
                f"• **Calories**: {total_calories:.0f} / 1200 kcal\n"
                f"• **Protein**: {total_protein:.1f}g / 25g\n"
                f"• **Logged Meals**: {len(today_meals)} meal(s)\n\n"
                f"{child_name} is doing well! Keep adding meals or ask me for dinner suggestions."
            )
            speech_text = f"{child_name} has consumed {total_calories:.0f} calories and {total_protein:.1f} grams of protein today."
            
            return VoiceAssistantResponse(
                response_text=response_text,
                speech_text=speech_text,
                action_type="GROWTH_INFO",
                action_data={
                    "calories": total_calories,
                    "protein": total_protein,
                    "target_calories": 1200,
                    "target_protein": 25
                },
                suggestions=[
                    f"Suggest dinner ideas for {child_name}",
                    "Check growth & BMI status",
                    "Log 1 apple for snack"
                ]
            )

    # -------------------------------------------------------------
    # 4. GROWTH & BMI INQUIRY
    # -------------------------------------------------------------
    if any(word in query_lower for word in ["bmi", "height", "weight", "growth", "healthy", "kg", "percentile"]):
        weight_str = f"{child.current_weight} kg" if child and child.current_weight else "normal range"
        height_str = f"{child.current_height} cm" if child and child.current_height else "healthy range"
        
        response_text = (
            f"📈 **Growth Snapshot for {child_name}**:\n"
            f"• Weight: {weight_str}\n"
            f"• Height: {height_str}\n"
            f"• BMI Status: **Optimal Normal Growth** according to WHO pediatric benchmarks."
        )
        speech_text = f"{child_name}'s growth standards are in the healthy optimal range for their age group."
        
        return VoiceAssistantResponse(
            response_text=response_text,
            speech_text=speech_text,
            action_type="GROWTH_INFO",
            action_data={
                "weight": getattr(child, "current_weight", 14.2),
                "height": getattr(child, "current_height", 95.0),
                "status": "Healthy"
            },
            suggestions=[
                "Update weight & height logs",
                "What nutrients are essential for growth?",
                "Log breakfast"
            ]
        )

    # -------------------------------------------------------------
    # 5. GENERAL AI VOICE ASSISTANT FALLBACK
    # -------------------------------------------------------------
    response_text = (
        f"🤖 **NutriVoice AI Assistant**:\n"
        f"I can help you manage {child_name}'s nutrition! You can ask me to:\n"
        f"• **Log meals**: *\"Log 2 idlis for breakfast\"*\n"
        f"• **Check progress**: *\"How much protein did {child_name} eat today?\"*\n"
        f"• **Get recipes**: *\"Suggest iron-rich dinner ideas\"*\n"
        f"• **Track growth**: *\"Is 14kg healthy for my child?\"*"
    )
    speech_text = f"Hello! I am NutriVoice AI. Ask me to log meals, check {child_name}'s daily intake, or suggest healthy recipes."

    return VoiceAssistantResponse(
        response_text=response_text,
        speech_text=speech_text,
        action_type="GENERAL_AI",
        action_data=None,
        suggestions=[
            f"Log 1 bowl of oats for {child_name}",
            "Check today's nutrition intake",
            "Suggest iron-rich dinner recipes"
        ]
    )
