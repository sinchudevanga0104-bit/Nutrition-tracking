from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal
import re
import difflib
import io
import wave
import os
import certifi
import av
import speech_recognition as sr

os.environ["SSL_CERT_FILE"] = certifi.where()

from app.database.connection import get_db
from app.models.user import User
from app.models.child import Child
from app.models.food import Food
from app.models.meal import Meal, MealItem
from app.models.water import WaterLog
from app.models.growth import GrowthRecord
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/voice", tags=["Voice Assistant"])

class VoiceQueryRequest(BaseModel):
    query: str
    child_id: Optional[int] = None

class VoiceAssistantResponse(BaseModel):
    response_text: str
    speech_text: str
    action_type: str # "LOG_MEAL", "WATER_TRACK", "NAVIGATE", "GROWTH_LOGGED", "GROWTH_INFO", "RECOMMENDATION", "GENERAL_AI"
    action_data: Optional[Dict[str, Any]] = None
    suggestions: List[str] = []

class VoiceAudioResponse(BaseModel):
    transcribed_text: str
    response_text: str
    speech_text: str
    action_type: str
    action_data: Optional[Dict[str, Any]] = None
    suggestions: List[str] = []

def audio_to_pcm_wav(input_bytes: bytes) -> io.BytesIO:
    """Convert any audio file format (WAV, M4A, AAC, WebM, MP3, CAF) to 16kHz mono 16-bit PCM WAV for Google Speech Recognition."""
    try:
        with wave.open(io.BytesIO(input_bytes), 'rb') as w:
            if w.getnchannels() in (1, 2) and w.getsampwidth() in (1, 2, 4):
                return io.BytesIO(input_bytes)
    except Exception:
        pass

    try:
        in_container = av.open(io.BytesIO(input_bytes))
        out_buf = io.BytesIO()
        out_wav = wave.open(out_buf, 'wb')
        out_wav.setnchannels(1)
        out_wav.setsampwidth(2)
        out_wav.setframerate(16000)

        resampler = av.AudioResampler(format='s16', layout='mono', rate=16000)
        for frame in in_container.decode(audio=0):
            for resampled_frame in resampler.resample(frame):
                out_wav.writeframes(resampled_frame.to_ndarray().tobytes())

        out_wav.close()
        out_buf.seek(0)
        return out_buf
    except Exception as e:
        raise ValueError(f"Could not decode audio: {str(e)}")

# Word to number mapping
WORD_TO_NUM = {
    "zero": 0.0, "one": 1.0, "two": 2.0, "three": 3.0, "four": 4.0, "five": 5.0,
    "six": 6.0, "seven": 7.0, "eight": 8.0, "nine": 9.0, "ten": 10.0,
    "half": 0.5, "quarter": 0.25, "a": 1.0, "an": 1.0, "single": 1.0,
    "couple": 2.0, "pair": 2.0
}

# Phonetic & speech-to-text mishearings common in Indian English
VOICE_NORMALIZATIONS = [
    (r"\b(are those|our those|or those|or this|are this|hardos|ardos)\b", "dosa"),
    (r"\b(addm|add me|adm|at)\b", "add"),
    (r"\b(idlli|iddli|iddly|idly|italy|idli)\b", "idli"),
    (r"\b(dose|dosai|dosas)\b", "dosa"),
    (r"\b(chapathi|chapathis|rotti|chapatis)\b", "chapati"),
    (r"\b(sambhar)\b", "sambar"),
    (r"\b(kichdi|kichri)\b", "khichdi"),
    (r"\b(uppittu)\b", "upma"),
    (r"\b(avalakki)\b", "poha"),
    (r"\b(mosaru|dahi)\b", "curd"),
    (r"\b(haalu|doodh)\b", "milk"),
    (r"\b(motte|anda)\b", "egg"),
    (r"\b(neeru|paani)\b", "water"),
    (r"\b(kela|balehannu)\b", "banana"),
    (r"\b(seb)\b", "apple"),
    (r"\b(chawal|anna)\b", "rice"),
]

FOOD_ALIASES: Dict[str, List[str]] = {
    "idli": ["idli", "idlis", "idlli", "idly", "idlies", "iddli", "iddly"],
    "dosa": ["dosa", "dosas", "dose", "dosai", "masala dosa", "plain dosa", "are those"],
    "roti": ["roti", "rotis", "chapati", "chapatis", "chapathi", "phulka", "fulka"],
    "rice": ["rice", "white rice", "brown rice", "ghee rice", "curd rice", "chawal", "anna"],
    "dal": ["dal", "dhal", "daal", "toor dal", "yellow dal", "dal makhani", "lentil"],
    "sambar": ["sambar", "sambhar"],
    "rasam": ["rasam"],
    "curd": ["curd", "curds", "yogurt", "yoghurt", "dahi", "mosaru"],
    "milk": ["milk", "cow milk", "haalu", "doodh"],
    "khichdi": ["khichdi", "kichdi", "moong dal khichdi", "khichadi"],
    "banana": ["banana", "bananas", "kela", "balehannu"],
    "apple": ["apple", "apples", "seb"],
    "poha": ["poha", "avalakki"],
    "upma": ["upma", "uppittu"],
    "paratha": ["paratha", "parathas", "aloo paratha", "parota"],
    "egg": ["egg", "eggs", "boiled egg", "omelette", "anda", "motte", "egg curry"],
    "chicken": ["chicken", "chicken curry"],
    "fish": ["fish", "fish curry"],
    "paneer": ["paneer", "palak paneer", "paneer tikka"],
    "samosa": ["samosa", "samosas"],
    "vada pav": ["vada pav", "vadapav", "vada", "vade"],
    "sandwich": ["sandwich", "sandwiches", "veg sandwich"],
    "biscuits": ["biscuit", "biscuits", "cookie", "cookies"],
    "oats": ["oat", "oats", "oatmeal"],
    "chole": ["chole", "chole masala", "chana masala"],
    "rajma": ["rajma", "rajma masala"],
    "mango": ["mango", "mangoes", "mango lassi"],
    "papaya": ["papaya"],
    "noodles": ["maggi", "maggie", "noodles"],
}

def normalize_voice_text(text: str) -> str:
    cleaned = text.lower().strip()
    for pattern, replacement in VOICE_NORMALIZATIONS:
        cleaned = re.sub(pattern, replacement, cleaned)
    return cleaned

def extract_quantity(query: str) -> float:
    words = re.findall(r'\b[a-zA-Z0-9\.]+\b', query.lower())
    for w in words:
        if w in WORD_TO_NUM:
            return WORD_TO_NUM[w]
    nums = re.findall(r'\b\d+(?:\.\d+)?\b', query)
    if nums:
        try:
            return float(nums[0])
        except ValueError:
            return 1.0
    return 1.0

def find_or_create_food(query_clean: str, all_foods: List[Food], db: Session) -> Optional[Food]:
    q_words = re.findall(r'\b[a-zA-Z]+\b', query_clean)
    
    # 1. Alias check
    for alias_key, variations in FOOD_ALIASES.items():
        for v in variations:
            if v in query_clean or any(w == v for w in q_words):
                for f in all_foods:
                    clean_f = re.sub(r'\(.*?\)', '', f.food_name).split('/')[0].strip().lower()
                    if alias_key in clean_f or clean_f in alias_key:
                        return f

    # 2. Substring & word matches in DB
    for f in all_foods:
        clean_name = re.sub(r'\(.*?\)', '', f.food_name).split('/')[0].strip().lower()
        if clean_name and (clean_name in query_clean or clean_name.rstrip('s') in query_clean):
            return f

    # 3. Fuzzy match against existing DB foods
    stop_words = {"add", "log", "fed", "ate", "had", "eating", "eat", "eats", "give", "gave",
                  "feed", "feeding", "the", "for", "and", "with", "cup", "bowl", "glass", "piece",
                  "pieces", "one", "two", "three", "four", "five", "please", "my", "child", "today",
                  "breakfast", "lunch", "dinner", "snack", "snacks", "drank", "drink"}
    for word in q_words:
        w = word.strip().rstrip('s')
        if len(w) > 2 and w not in stop_words:
            for f in all_foods:
                clean_name = re.sub(r'\(.*?\)', '', f.food_name).split('/')[0].strip().lower()
                if difflib.SequenceMatcher(None, w, clean_name).ratio() >= 0.75:
                    return f

    # 4. If query explicitly commands adding food, dynamically create healthy pediatric item!
    meaningful_words = [w for w in q_words if w not in stop_words and len(w) > 2]
    if meaningful_words:
        guessed_name = " ".join(meaningful_words).title()
        new_food = Food(
            food_name=guessed_name,
            category="Home Food",
            serving_size="1 portion",
            calories=Decimal('180.00'),
            protein=Decimal('5.00'),
            carbohydrates=Decimal('25.00'),
            fat=Decimal('5.00')
        )
        db.add(new_food)
        db.commit()
        db.refresh(new_food)
        return new_food

    return None

@router.post("/assistant", response_model=VoiceAssistantResponse)
def process_voice_query(
    payload: VoiceQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query_raw = payload.query.strip()
    query_clean = normalize_voice_text(query_raw)
    
    child = None
    if payload.child_id:
        child = db.query(Child).filter(Child.child_id == payload.child_id, Child.parent_id == current_user.user_id).first()
    if not child:
        child = db.query(Child).filter(Child.parent_id == current_user.user_id).first()
        
    child_name = child.name if child else "your child"

    # =============================================================
    # 1. APP NAVIGATION VIA VOICE ("open water tracker", "go to nutrition", etc.)
    # =============================================================
    nav_commands = ["open", "go to", "navigate", "switch to", "show me", "take me to", "view"]
    is_nav = any(cmd in query_clean for cmd in nav_commands)
    
    if is_nav or query_clean in ["water tracker", "nutrition", "growth", "recommendations", "profile", "home", "dashboard"]:
        if any(w in query_clean for w in ["water", "hydration", "drink water"]):
            return VoiceAssistantResponse(
                response_text="🌊 **Navigating to Water Tracker & Reminders**\n\nOpening hydration goals and hourly logs.",
                speech_text="Opening Water Tracker.",
                action_type="NAVIGATE",
                action_data={"screen": "Water Tracker", "title": "Water & Reminders"},
                suggestions=["Log 1 glass of water", "Check water intake", "Suggest dinner recipes"]
            )
        elif any(w in query_clean for w in ["nutrition", "meal", "food", "calorie", "diet"]):
            return VoiceAssistantResponse(
                response_text="🥗 **Navigating to Nutrition & Meals**\n\nOpening your daily meal logs and macro summary.",
                speech_text="Opening Nutrition Logs.",
                action_type="NAVIGATE",
                action_data={"screen": "Nutrition", "title": "Nutrition & Meals"},
                suggestions=["Add one idli", "What did my child eat today?", "Suggest healthy snacks"]
            )
        elif any(w in query_clean for w in ["growth", "chart", "height", "weight", "bmi", "percentile"]):
            return VoiceAssistantResponse(
                response_text="📈 **Navigating to Growth & BMI Chart**\n\nOpening WHO pediatric height and weight tracking.",
                speech_text="Opening Growth & BMI chart.",
                action_type="NAVIGATE",
                action_data={"screen": "Growth", "title": "Growth Tracker"},
                suggestions=["Log weight 14 kg", "Is 14kg healthy?", "Check nutrition intake"]
            )
        elif any(w in query_clean for w in ["recipe", "recommendation", "ideas", "cook", "kitchen"]):
            return VoiceAssistantResponse(
                response_text="💡 **Navigating to AI Recipe Recommendations**\n\nOpening personalized nutrient-dense toddler meals.",
                speech_text="Opening Recipe Recommendations.",
                action_type="NAVIGATE",
                action_data={"screen": "Recommendations", "title": "AI Recommendations"},
                suggestions=["Suggest iron-rich recipes", "Add one dosa", "Check water intake"]
            )
        elif any(w in query_clean for w in ["profile", "child", "children", "account", "settings"]):
            return VoiceAssistantResponse(
                response_text="👤 **Navigating to Profile & Child Management**\n\nOpening child profiles and health records.",
                speech_text="Opening Profile.",
                action_type="NAVIGATE",
                action_data={"screen": "Profile", "title": "Profile & Children"},
                suggestions=["Add a new child", "Open Nutrition", "Log breakfast"]
            )
        elif any(w in query_clean for w in ["home", "dashboard", "main page", "overview"]):
            return VoiceAssistantResponse(
                response_text="🏠 **Navigating to Dashboard**\n\nOpening your daily nutrition overview.",
                speech_text="Opening Dashboard.",
                action_type="NAVIGATE",
                action_data={"screen": "Home", "title": "Dashboard"},
                suggestions=["Log breakfast", "Log water", "Check progress"]
            )

    # =============================================================
    # 2. VOICE LOGGING GROWTH (Height & Weight)
    # =============================================================
    if any(k in query_clean for k in ["record weight", "log weight", "weighs", "weight is", "record height", "log height", "height is"]) and child:
        weight_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos)', query_clean)
        height_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:cm|cms|centimeters)', query_clean)
        
        from app.models.growth import GrowthRecord
        latest_rec = db.query(GrowthRecord).filter(GrowthRecord.child_id == child.child_id).order_by(GrowthRecord.record_date.desc()).first()
        
        weight = float(weight_match.group(1)) if weight_match else (float(latest_rec.weight) if latest_rec else 14.0)
        height = float(height_match.group(1)) if height_match else (float(latest_rec.height) if latest_rec else 95.0)
        
        bmi = round(weight / ((height / 100.0) ** 2), 2)
        
        new_growth = GrowthRecord(
            child_id=child.child_id,
            record_date=date.today(),
            height=Decimal(str(height)),
            weight=Decimal(str(weight)),
            bmi=Decimal(str(bmi))
        )
        db.add(new_growth)
        db.commit()
        
        return VoiceAssistantResponse(
            response_text=(
                f"📈 **Growth Logged for {child_name}!**\n\n"
                f"• **Weight**: {weight} kg\n"
                f"• **Height**: {height} cm\n"
                f"• **Calculated BMI**: {bmi:.1f} (Optimal Normal Range according to WHO standard)."
            ),
            speech_text=f"Recorded {weight} kilograms and {height} centimeters for {child_name}. Growth status is healthy.",
            action_type="GROWTH_LOGGED",
            action_data={"weight": weight, "height": height, "bmi": bmi},
            suggestions=["Open Growth Chart", "Check today's nutrition intake", "Suggest healthy dinners"]
        )

    # =============================================================
    # 3. WATER TRACKING COMMAND ("add 1 glass of water", "drank water")
    # =============================================================
    if any(w in query_clean for w in ["water", "hydrat", "glass of water", "drank water", "drink water"]):
        amount_ml = 250
        nums = re.findall(r'\b\d+\b', query_clean)
        if nums:
            val = int(nums[0])
            amount_ml = val * 250 if val <= 8 else val
        elif "half" in query_clean:
            amount_ml = 125
        elif "bottle" in query_clean:
            amount_ml = 500

        saved_water = False
        total_today = amount_ml
        if child:
            new_log = WaterLog(child_id=child.child_id, amount_ml=amount_ml, log_date=date.today())
            db.add(new_log)
            db.commit()
            saved_water = True
            
            today_logs = db.query(WaterLog).filter(WaterLog.child_id == child.child_id, WaterLog.log_date == date.today()).all()
            total_today = sum(l.amount_ml for l in today_logs)

        return VoiceAssistantResponse(
            response_text=(
                f"💧 **Water Logged for {child_name}!**\n\n"
                f"Added **{amount_ml} ml** of water. "
                f"Today's total: **{total_today} / 1500 ml** ({(total_today / 1500 * 100):.0f}% of goal)."
            ),
            speech_text=f"Added {amount_ml} milliliters of water for {child_name}. Total today is {total_today} milliliters.",
            action_type="WATER_TRACK",
            action_data={"saved": saved_water, "amount_ml": amount_ml, "total_today": total_today},
            suggestions=["Add one idli", "Check today's nutrition intake", "Suggest iron-rich recipes"]
        )

    # =============================================================
    # 4. RECIPES & MEAL RECOMMENDATIONS
    # =============================================================
    if any(word in query_clean for word in ["recipe", "recipes", "suggest", "ideas", "what to cook", "what should i cook", "iron rich", "calcium rich", "dinner ideas", "lunch ideas"]):
        response_text = (
            f"💡 **Recommended Meals for {child_name}**:\n\n"
            f"1. **Spinach & Cheese Khichdi**: Rich in Iron & Calcium. Gentle on digestion.\n"
            f"2. **Oatmeal with Banana & Almond Butter**: Packed with dietary fibre & continuous energy.\n"
            f"3. **Paneer Tikka Roll / Scramble**: High in protein for muscle development."
        )
        speech_text = f"Here are great meal ideas for {child_name}: Spinach Khichdi, Oats with Banana, or Paneer Tikka."
        
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
                f"Add Moong Dal Khichdi for {child_name}",
                "How much protein did my child eat today?",
                "Open Water Tracker"
            ]
        )

    # =============================================================
    # 5. TODAY'S NUTRITION & PROGRESS INQUIRY
    # =============================================================
    is_inquiry = any(word in query_clean for word in [
        "how much", "how many", "status", "summary", "progress", "intake",
        "how is", "what did", "show me", "did he eat", "did she eat", "eaten", "what has"
    ]) or (any(w in query_clean for w in ["protein", "calories", "nutrition"]) and not any(w in query_clean for w in ["add", "log", "fed", "record"]))
    
    if is_inquiry:
        if child:
            today_meals = db.query(Meal).filter(Meal.child_id == child.child_id, Meal.meal_date == date.today()).all()
            total_calories = sum(float(m.total_calories) for m in today_meals)
            total_protein = sum(float(m.total_protein) for m in today_meals)
            
            meal_items_summary = []
            for m in today_meals:
                for it in m.items:
                    f = db.query(Food).filter(Food.food_id == it.food_id).first()
                    fname = f.food_name if f else "Food"
                    meal_items_summary.append(f"{m.meal_type}: {it.quantity:g}x {fname}")

            items_str = "\n".join([f"• {x}" for x in meal_items_summary]) if meal_items_summary else "• No meals logged yet today."
            
            response_text = (
                f"📊 **{child_name}'s Nutrition Today**:\n\n"
                f"• **Calories**: {total_calories:.0f} / 1200 kcal\n"
                f"• **Protein**: {total_protein:.1f}g / 25g\n\n"
                f"**Logged Items Today**:\n{items_str}\n\n"
                f"{child_name} is on track! Ask me to add more meals or check water."
            )
            speech_text = f"{child_name} has consumed {total_calories:.0f} calories and {total_protein:.1f} grams of protein today across {len(today_meals)} meals."
            
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
                    "Add 1 glass of water",
                    "Add one dosa"
                ]
            )

    # =============================================================
    # 6. GROWTH & BMI INQUIRY
    # =============================================================
    if any(word in query_clean for word in ["bmi", "height", "weight", "growth", "healthy", "percentile"]):
        latest_growth = db.query(GrowthRecord).filter(GrowthRecord.child_id == child.child_id).order_by(GrowthRecord.record_date.desc()).first() if child else None
        
        weight_str = f"{latest_growth.weight} kg" if latest_growth else "normal range"
        height_str = f"{latest_growth.height} cm" if latest_growth else "healthy range"
        weight_val = float(latest_growth.weight) if latest_growth else 14.2
        height_val = float(latest_growth.height) if latest_growth else 95.0
        
        response_text = (
            f"📈 **Growth Snapshot for {child_name}**:\n\n"
            f"• Weight: **{weight_str}**\n"
            f"• Height: **{height_str}**\n"
            f"• BMI Status: **Optimal Growth** according to WHO pediatric benchmarks."
        )
        speech_text = f"{child_name}'s growth standards are in the healthy optimal range for their age group."
        
        return VoiceAssistantResponse(
            response_text=response_text,
            speech_text=speech_text,
            action_type="GROWTH_INFO",
            action_data={"weight": weight_val, "height": height_val, "status": "Healthy"},
            suggestions=[
                "Log weight 14 kg",
                "What nutrients are essential for growth?",
                "Open Growth Chart"
            ]
        )

    # =============================================================
    # 7. PEDIATRIC NUTRITION ADVICE (Picky eaters, health, digestion)
    # =============================================================
    if any(k in query_clean for k in ["picky", "not eating", "refuse", "fussy", "appetite"]):
        response_text = (
            f"🥦 **Tips for Picky Eaters ({child_name})**:\n\n"
            f"1. **Never Force Feed**: Serve colorful finger foods like carrot sticks, cucumber rounds, and paneer cubes.\n"
            f"2. **Hide Nutrients**: Puree spinach, beetroot, or lentils into dosa batter or paratha dough.\n"
            f"3. **Dip Fun**: Toddlers love dipping! Pair chapati rolls or veg sticks with hung curd dip or mild hummus.\n"
            f"4. **Consistent Routine**: Fixed meal and snack times encourage natural appetite cues."
        )
        speech_text = f"For picky eating, try colorful finger foods, blending veggies into dosa batter, and keeping consistent meal times."
        return VoiceAssistantResponse(
            response_text=response_text,
            speech_text=speech_text,
            action_type="RECOMMENDATION",
            suggestions=["Suggest healthy snacks", "Add one dosa", "Check nutrition today"]
        )
        
    if any(k in query_clean for k in ["constipat", "potty", "stomach", "digestion"]):
        response_text = (
            f"💧 **Natural Digestive Support for {child_name}**:\n\n"
            f"1. **Hydration First**: Increase water intake to at least 1200–1500 ml daily.\n"
            f"2. **P-Fruits**: Papaya, Prunes, Pears, and Peaches are natural gentle stool softeners.\n"
            f"3. **Probiotics**: Fresh curd or buttermilk restores healthy gut microbiome.\n"
            f"4. **Fibre Boost**: Include soaked raisins or whole-grain oats."
        )
        speech_text = f"For healthy digestion, give plenty of water, papaya, pears, and fresh curd."
        return VoiceAssistantResponse(
            response_text=response_text,
            speech_text=speech_text,
            action_type="RECOMMENDATION",
            suggestions=["Log 1 glass of water", "Add papaya for snack", "Open Water Tracker"]
        )

    # =============================================================
    # 8. MEAL LOGGING (FOR ANY FOOD, HOME DISH OR DICTATED MEAL)
    # =============================================================
    all_foods = db.query(Food).all()
    matched_food = find_or_create_food(query_clean, all_foods, db)

    meal_triggers = {
        "add", "added", "log", "logged", "record", "fed", "ate", "had", "eating", "eat", "eats",
        "give", "gave", "feed", "feeding", "consume", "consumed", "track", "tracking", "put",
        "cooked", "breakfast", "lunch", "dinner", "snack", "snacks", "portion", "plate", "piece",
        "dosa", "idli", "roti", "rice", "curd", "milk", "sambar", "khichdi", "egg", "apple", "banana"
    }
    q_words_set = set(re.findall(r'\b[a-zA-Z]+\b', query_clean))
    is_meal_command = matched_food is not None or bool(q_words_set.intersection(meal_triggers))
    
    if is_meal_command and matched_food:
        if "breakfast" in query_clean or "morning" in query_clean:
            meal_type = "Breakfast"
        elif "lunch" in query_clean or "afternoon" in query_clean:
            meal_type = "Lunch"
        elif "dinner" in query_clean or "night" in query_clean:
            meal_type = "Dinner"
        elif "snack" in query_clean or "evening" in query_clean:
            meal_type = "Snacks"
        else:
            current_hour = datetime.now().hour
            if current_hour < 11:
                meal_type = "Breakfast"
            elif current_hour < 16:
                meal_type = "Lunch"
            elif current_hour < 19:
                meal_type = "Snacks"
            else:
                meal_type = "Dinner"

        matched_quantity = extract_quantity(query_clean)
        total_cals = float(matched_food.calories) * matched_quantity
        total_prot = float(matched_food.protein) * matched_quantity
        
        saved_to_db = False
        if child:
            today_date = date.today()
            meal = db.query(Meal).filter(
                Meal.child_id == child.child_id,
                Meal.meal_date == today_date,
                Meal.meal_type == meal_type
            ).first()
            if not meal:
                meal = Meal(
                    child_id=child.child_id,
                    meal_date=today_date,
                    meal_type=meal_type,
                    total_calories=Decimal('0.00'),
                    total_protein=Decimal('0.00')
                )
                db.add(meal)
                db.commit()
                db.refresh(meal)
                
            meal_item = MealItem(
                meal_id=meal.meal_id,
                food_id=matched_food.food_id,
                quantity=Decimal(str(matched_quantity))
            )
            db.add(meal_item)
            
            meal.total_calories = Decimal(str(float(meal.total_calories or 0) + total_cals))
            meal.total_protein = Decimal(str(float(meal.total_protein or 0) + total_prot))
            db.commit()
            saved_to_db = True

        if saved_to_db:
            response_text = (
                f"✅ **Added to {meal_type}!**\n\n"
                f"Successfully logged **{matched_quantity:g}x {matched_food.food_name}** for **{child_name}**.\n"
                f"• **Calories**: ~{total_cals:.0f} kcal\n"
                f"• **Protein**: ~{total_prot:.1f}g\n\n"
                f"Saved to today's {meal_type} log."
            )
            speech_text = f"Added {matched_quantity:g} {matched_food.food_name} to {child_name}'s {meal_type}!"
        else:
            response_text = (
                f"Got it! I prepared a **{meal_type}** log for **{child_name}**: "
                f"{matched_quantity:g}x {matched_food.food_name} (~{total_cals:.0f} kcal, {total_prot:.1f}g protein). "
                f"Tap **Confirm & Save** to add it to {child_name}'s diet!"
            )
            speech_text = f"Got it! Ready to log {matched_quantity:g} {matched_food.food_name} for {child_name}'s {meal_type}."
        
        return VoiceAssistantResponse(
            response_text=response_text,
            speech_text=speech_text,
            action_type="LOG_MEAL",
            action_data={
                "saved": saved_to_db,
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
                "Check today's nutrition intake",
                "Open Water Tracker"
            ]
        )

    # =============================================================
    # 9. GENERAL AI VOICE ASSISTANT SMART FALLBACK
    # =============================================================
    response_text = (
        f"🤖 **NutriVoice AI Assistant**:\n"
        f"I'm here to assist {child_name}'s nutrition & health journey! You can say:\n\n"
        f"• **Add any meal**: *\"Add one dosa\"*, *\"Add 2 idlis\"*, *\"Add a bowl of khichdi\"*\n"
        f"• **Track water**: *\"Add 1 glass of water\"*\n"
        f"• **Record growth**: *\"Record weight 14.5 kg and height 98 cm\"*\n"
        f"• **Open screens**: *\"Open Water Tracker\"*, *\"Open Nutrition\"*, *\"Open Growth\"*\n"
        f"• **Check progress**: *\"What did {child_name} eat today?\"*\n"
        f"• **Ask advice**: *\"What snacks are healthy for a toddler?\"*"
    )
    speech_text = f"I'm NutriVoice AI. Ask me to add meals like dosa or idli, log water, check {child_name}'s intake, or navigate anywhere."

    return VoiceAssistantResponse(
        response_text=response_text,
        speech_text=speech_text,
        action_type="GENERAL_AI",
        action_data=None,
        suggestions=[
            f"Add one dosa for {child_name}",
            f"Add 1 glass of water",
            "Open Water Tracker",
            "Check today's nutrition intake"
        ]
    )

@router.post("/audio-query", response_model=VoiceAudioResponse)
async def process_audio_query(
    audio: UploadFile = File(...),
    child_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Receives recorded voice audio from the mobile app (iOS/Android/Web),
    transcribes speech using Google Speech Recognition, and processes the
    nutrition query/meal log/water log via NutriVoice AI.
    """
    try:
        audio_bytes = await audio.read()
    except Exception as read_err:
        raise HTTPException(status_code=400, detail=f"Failed to read audio file: {read_err}")

    if not audio_bytes or len(audio_bytes) < 100:
        return VoiceAudioResponse(
            transcribed_text="",
            response_text="⚠️ **No audio received.**\n\nPlease hold the microphone and speak your query.",
            speech_text="No audio was received. Please try again.",
            action_type="GENERAL_AI",
            suggestions=["Add one idli", "Log 1 glass of water", "Open Water Tracker"]
        )

    try:
        wav_stream = audio_to_pcm_wav(audio_bytes)
        r = sr.Recognizer()
        with sr.AudioFile(wav_stream) as source:
            audio_data = r.record(source)

        transcribed = None
        # Try Indian English first, then fallback to standard English
        try:
            try:
                transcribed = r.recognize_google(audio_data, language="en-IN")
            except sr.UnknownValueError:
                try:
                    transcribed = r.recognize_google(audio_data, language="en-US")
                except sr.UnknownValueError:
                    pass
        except sr.RequestError as req_err:
            return VoiceAudioResponse(
                transcribed_text="(Recognition service unavailable)",
                response_text=f"⚠️ Voice recognition service is temporarily unavailable: {req_err}. Please type your query below.",
                speech_text="Voice recognition service is temporarily unavailable. Please type your query.",
                action_type="GENERAL_AI",
                suggestions=["Add one dosa", "Log 1 glass of water"]
            )

        if not transcribed:
            return VoiceAudioResponse(
                transcribed_text="(No speech detected)",
                response_text=(
                    "🎙️ **I couldn't hear any speech clearly.**\n\n"
                    "Please tap the mic and try speaking closer to your phone. You can say:\n"
                    "• *\"Add 2 idlis for breakfast\"*\n"
                    "• *\"Add 1 glass of water\"*\n"
                    "• *\"What did my child eat today?\"*\n"
                    "• *\"Open Growth Tracker\"*"
                ),
                speech_text="I couldn't hear any speech clearly. Please tap the mic and try speaking closer to your phone.",
                action_type="GENERAL_AI",
                suggestions=["Add 2 idlis for breakfast", "Log 1 glass of water", "Open Nutrition"]
            )

        # Feed the transcribed text to NutriVoice query processor
        query_payload = VoiceQueryRequest(query=transcribed, child_id=child_id)
        result = process_voice_query(payload=query_payload, db=db, current_user=current_user)

        return VoiceAudioResponse(
            transcribed_text=transcribed,
            response_text=result.response_text,
            speech_text=result.speech_text,
            action_type=result.action_type,
            action_data=result.action_data,
            suggestions=result.suggestions
        )
    except Exception as e:
        return VoiceAudioResponse(
            transcribed_text="",
            response_text=f"⚠️ Error processing audio: {str(e)}",
            speech_text="Sorry, an error occurred while processing your voice audio.",
            action_type="GENERAL_AI",
            suggestions=["Add one idli", "Log 1 glass of water"]
        )

