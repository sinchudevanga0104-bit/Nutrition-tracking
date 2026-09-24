# NutriTrack AI – Project Plan

## Phase 1: Requirements Analysis & Architecture Design (Current Phase)
- [x] Inspect workspace
- [x] Create project directory structure
- [x] Create PROJECT_PLAN.md
- [x] Create TODO.md
- [x] Design architecture (docs/architecture.md)
- [x] Design database schema (database/schema.sql)

## Phase 2: System Setup & Backend Foundation
- [ ] Initialize Python virtual environment
- [ ] Install FastAPI dependencies
- [ ] Setup backend project structure (`main.py`, etc.)
- [ ] Configure MySQL database connection

## Phase 3: Database & Authentication
- [ ] Execute `schema.sql` in MySQL
- [ ] Implement user models and schemas
- [ ] Build authentication endpoints (Register, Login, Profile)
- [ ] Implement JWT token generation and validation

## Phase 4: Mobile App Foundation
- [ ] Initialize Expo React Native project
- [ ] Install navigation and UI libraries (React Native Paper)
- [ ] Setup folder structure (components, screens, navigation)
- [ ] Create basic navigation (Bottom Tabs, Stack)
- [ ] Build Splash and Onboarding screens
- [ ] Build Login and Registration screens
- [ ] Connect mobile auth to backend API

## Phase 5: Child Management Module
- [ ] Backend: CRUD endpoints for Children
- [ ] Mobile: Add Child, Edit Child, Delete Child screens
- [ ] Mobile: Child Selection screen
- [ ] Mobile: Child Profile screen

## Phase 6: Food Database & Meal Tracking
- [ ] Backend: Food search and retrieval endpoints
- [ ] Backend: Meal CRUD endpoints
- [ ] Mobile: Food Search and Details screens
- [ ] Mobile: Meal Tracking and Add Meal screens
- [ ] Mobile: Calculate approximate nutrition from meals

## Phase 7: Nutrition & Growth Tracking
- [ ] Backend: Nutrition calculation and endpoints
- [ ] Backend: Growth (Height, Weight, BMI) tracking endpoints
- [ ] Mobile: BMI Module and calculations
- [ ] Mobile: Growth Charts integration
- [ ] Mobile: Nutrition Dashboard and Scoring system

## Phase 8: AI Recommendation Engine
- [ ] Backend: Recommendation logic based on inputs (age, BMI, nutrition, allergies)
- [ ] Backend: Expose recommendations via API
- [ ] Mobile: Meal Suggestions and Recommendations screens

## Phase 9: Dashboard & Additional Features
- [ ] Backend: Dashboard summary endpoint
- [ ] Mobile: Home Dashboard (Cards, Today's meals, Alerts)
- [ ] Mobile: Water Tracking and Goals
- [ ] Mobile: Expo Notifications integration

## Phase 10: Reports & Polish
- [ ] Backend: Report generation endpoints (PDF/CSV)
- [ ] Mobile: Reports screen
- [ ] UI/UX polishing and testing
- [ ] Bug fixing and final documentation
