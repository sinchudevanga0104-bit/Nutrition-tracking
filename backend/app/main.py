from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.connection import engine, Base

app = FastAPI(
    title="NutriTrack AI API",
    description="Backend API for Child Nutrition Tracking Platform",
    version="1.0.0"
)

# Create all database tables (if they don't exist yet)
@app.on_event("startup")
def on_startup():
    if engine is not None:
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            print(f"Warning: Could not create tables on startup. Is MySQL running? Error: {e}")

# CORS configuration
origins = [
    "*"  # Allows all origins for development
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routes import auth, children, meals, growth, recommendations, dashboard, reports, voice, water
app.include_router(auth.router)
app.include_router(children.router)
app.include_router(meals.router)
app.include_router(growth.router)
app.include_router(recommendations.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(voice.router)
app.include_router(water.router)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "NutriTrack AI API is running"}
