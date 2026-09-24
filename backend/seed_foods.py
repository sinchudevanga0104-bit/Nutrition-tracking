import os
import sys

# Add the project root to PYTHONPATH so we can import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.database.connection import SessionLocal, Base, engine
from app.models.food import Food

INDIAN_FOODS = [
    # Breakfast
    {"food_name": "Idli (2 pieces)", "category": "Breakfast", "serving_size": "2 idlis", "calories": 118, "protein": 3.2, "carbohydrates": 24, "fat": 0.4, "barcode": "8901058000010"},
    {"food_name": "Dosa (Plain)", "category": "Breakfast", "serving_size": "1 dosa", "calories": 133, "protein": 2.5, "carbohydrates": 23, "fat": 3.5, "barcode": "8901058000011"},
    {"food_name": "Poha", "category": "Breakfast", "serving_size": "1 bowl (150g)", "calories": 250, "protein": 4.5, "carbohydrates": 45, "fat": 5.0, "barcode": "8901000000005"},
    {"food_name": "Upma", "category": "Breakfast", "serving_size": "1 bowl (150g)", "calories": 192, "protein": 4.0, "carbohydrates": 35, "fat": 4.5, "barcode": "8901000000008"},
    {"food_name": "Aloo Paratha", "category": "Breakfast", "serving_size": "1 medium", "calories": 260, "protein": 5.0, "carbohydrates": 40, "fat": 8.0, "barcode": "8901000000004"},
    
    # Lunch/Dinner - Mains
    {"food_name": "Roti / Chapati", "category": "Main Course", "serving_size": "1 roti", "calories": 85, "protein": 3.0, "carbohydrates": 17, "fat": 0.5, "barcode": "8901030000011"},
    {"food_name": "White Rice", "category": "Main Course", "serving_size": "1 cup (158g)", "calories": 205, "protein": 4.3, "carbohydrates": 45, "fat": 0.4, "barcode": "8901000000009"},
    {"food_name": "Brown Rice", "category": "Main Course", "serving_size": "1 cup (195g)", "calories": 216, "protein": 5.0, "carbohydrates": 45, "fat": 1.8, "barcode": "8901000000010"},
    
    # Dals & Curries
    {"food_name": "Yellow Dal (Toor Dal)", "category": "Dal/Lentils", "serving_size": "1 bowl (150g)", "calories": 150, "protein": 9.0, "carbohydrates": 20, "fat": 3.0, "barcode": "8901000000001"},
    {"food_name": "Dal Makhani", "category": "Dal/Lentils", "serving_size": "1 bowl (150g)", "calories": 300, "protein": 10.0, "carbohydrates": 35, "fat": 14.0, "barcode": "8901000000011"},
    {"food_name": "Rajma Masala", "category": "Dal/Lentils", "serving_size": "1 bowl (150g)", "calories": 175, "protein": 8.5, "carbohydrates": 25, "fat": 4.0, "barcode": "8901000000012"},
    {"food_name": "Chole Masala", "category": "Dal/Lentils", "serving_size": "1 bowl (150g)", "calories": 250, "protein": 8.0, "carbohydrates": 30, "fat": 10.0, "barcode": "8901000000013"},
    
    # Vegetables (Sabzi)
    {"food_name": "Aloo Gobi", "category": "Vegetables", "serving_size": "1 bowl (150g)", "calories": 120, "protein": 3.0, "carbohydrates": 18, "fat": 4.5, "barcode": "8901000000014"},
    {"food_name": "Bhindi Masala", "category": "Vegetables", "serving_size": "1 bowl (150g)", "calories": 110, "protein": 3.0, "carbohydrates": 12, "fat": 6.0, "barcode": "8901000000015"},
    {"food_name": "Palak Paneer", "category": "Vegetables", "serving_size": "1 bowl (150g)", "calories": 220, "protein": 11.0, "carbohydrates": 9, "fat": 16.0, "barcode": "8901000000006"},
    {"food_name": "Mixed Veg Sabzi", "category": "Vegetables", "serving_size": "1 bowl (150g)", "calories": 95, "protein": 3.5, "carbohydrates": 14, "fat": 3.0, "barcode": "8901000000016"},
    
    # Non-Veg
    {"food_name": "Chicken Curry", "category": "Non-Veg", "serving_size": "1 bowl (150g)", "calories": 240, "protein": 20.0, "carbohydrates": 8, "fat": 14.0, "barcode": "8901000000007"},
    {"food_name": "Egg Curry (2 eggs)", "category": "Non-Veg", "serving_size": "1 bowl (150g)", "calories": 200, "protein": 14.0, "carbohydrates": 8, "fat": 13.0, "barcode": "8901000000017"},
    {"food_name": "Fish Curry", "category": "Non-Veg", "serving_size": "1 bowl (150g)", "calories": 180, "protein": 18.0, "carbohydrates": 6, "fat": 9.0, "barcode": "8901000000018"},
    
    # Snacks & Fast Food
    {"food_name": "Samosa", "category": "Snacks", "serving_size": "1 piece", "calories": 260, "protein": 3.5, "carbohydrates": 24, "fat": 17.0, "barcode": "8901000000019"},
    {"food_name": "Paneer Tikka", "category": "Snacks", "serving_size": "4 pieces", "calories": 180, "protein": 10.0, "carbohydrates": 6, "fat": 12.0, "barcode": "8901000000020"},
    {"food_name": "Vada Pav", "category": "Snacks", "serving_size": "1 piece", "calories": 300, "protein": 6.0, "carbohydrates": 40, "fat": 12.0, "barcode": "8901000000021"},
    
    # Dairy & Drinks
    {"food_name": "Milk (Cow)", "category": "Dairy", "serving_size": "1 glass (250ml)", "calories": 150, "protein": 8.0, "carbohydrates": 12, "fat": 8.0, "barcode": "8901234567890"},
    {"food_name": "Curd / Yogurt", "category": "Dairy", "serving_size": "1 bowl (100g)", "calories": 98, "protein": 11.0, "carbohydrates": 3.4, "fat": 4.3, "barcode": "8901234567891"},
    {"food_name": "Buttermilk (Chaas)", "category": "Dairy", "serving_size": "1 glass (250ml)", "calories": 40, "protein": 2.5, "carbohydrates": 4.0, "fat": 1.5, "barcode": "8901234567892"},
    {"food_name": "Mango Lassi", "category": "Dairy", "serving_size": "1 glass (250ml)", "calories": 210, "protein": 6.0, "carbohydrates": 30, "fat": 7.0, "barcode": "8901234567893"},
    
    # Fruits
    {"food_name": "Banana", "category": "Fruits", "serving_size": "1 medium", "calories": 105, "protein": 1.3, "carbohydrates": 27, "fat": 0.3, "barcode": "8901000000003"},
    {"food_name": "Apple", "category": "Fruits", "serving_size": "1 medium", "calories": 95, "protein": 0.5, "carbohydrates": 25, "fat": 0.3, "barcode": "8901000000002"},
    {"food_name": "Papaya", "category": "Fruits", "serving_size": "1 cup (145g)", "calories": 62, "protein": 0.7, "carbohydrates": 16, "fat": 0.2, "barcode": "8901000000022"},
    {"food_name": "Mango", "category": "Fruits", "serving_size": "1 cup (165g)", "calories": 99, "protein": 1.4, "carbohydrates": 25, "fat": 0.6, "barcode": "8901000000023"},
]

def seed_database():
    Base.metadata.create_all(bind=engine)
    
    # Auto-migrate: Ensure 'barcode' column exists in existing SQLite/MySQL database
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE foods ADD COLUMN barcode VARCHAR(50)"))
            conn.commit()
        except Exception:
            pass # Column already exists or table was just created

    db = SessionLocal()

    
    try:
        # Check existing foods and update their barcodes if needed
        for food_data in INDIAN_FOODS:
            existing = db.query(Food).filter(Food.food_name == food_data["food_name"]).first()
            if existing:
                existing.barcode = food_data.get("barcode")
            else:
                food = Food(
                    food_name=food_data["food_name"],
                    category=food_data["category"],
                    serving_size=food_data["serving_size"],
                    calories=food_data["calories"],
                    protein=food_data["protein"],
                    carbohydrates=food_data["carbohydrates"],
                    fat=food_data["fat"],
                    barcode=food_data.get("barcode")
                )
                db.add(food)
            
        db.commit()
        print("Database foods & barcodes updated successfully!")
        
    except Exception as e:

        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
