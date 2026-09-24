# NutriTrack AI - TODO List

## Phase 1: Planning (In Progress)
- [x] Create project structure
- [x] Create PROJECT_PLAN.md
- [x] Create TODO.md
- [x] Create architecture documentation
- [x] Create database schema SQL file

## Phase 2: Backend Setup
- [ ] Initialize Python environment
- [ ] Install FastAPI, Uvicorn, SQLAlchemy, PyMySQL, etc.
- [ ] Create `main.py`
- [ ] Setup database connection config
- [ ] Test FastAPI health check endpoint

## Phase 3: Database & Authentication
- [ ] Run `schema.sql` to initialize MySQL DB
- [ ] Create SQLAlchemy models for Users
- [ ] Create Pydantic schemas for Auth
- [ ] Implement JWT token utility
- [ ] Create `POST /auth/register`
- [ ] Create `POST /auth/login`
- [ ] Create `GET /auth/profile`

## Phase 4: Mobile App Foundation
- [ ] Run `npx create-expo-app mobile`
- [ ] Install `react-navigation`, `axios`, `@react-native-async-storage/async-storage`, `react-native-paper`
- [ ] Setup folder structure inside `mobile/src`
- [ ] Create Bottom Tab Navigator
- [ ] Create Splash Screen
- [ ] Create Onboarding Screen
- [ ] Create Login & Registration Screens
- [ ] Implement mobile Auth Context using AsyncStorage

## Phase 5: Child Management
- [ ] Backend: Children CRUD endpoints
- [ ] Mobile: API service for Children
- [ ] Mobile: Add/Edit/Delete Child UI
- [ ] Mobile: Child Selection UI

## Phase 6: Food & Meals
- [x] Backend: Food & Meal endpoints
- [x] Backend: Provide sample Indian food dataset script
- [ ] Mobile: Food Search UI
- [ ] Mobile: Add Meal UI (Breakfast, Lunch, Snacks, Dinner)

## Phase 7: Nutrition & Growth
- [ ] Backend: Calculate BMI, nutrition score, fetch growth history
- [ ] Mobile: BMI UI
- [ ] Mobile: Growth Charts UI (`react-native-chart-kit`)
- [ ] Mobile: Nutrition Dashboard UI

## Phase 8: Recommendations
- [ ] Backend: Simple AI/rules-based recommendation engine endpoints
- [ ] Mobile: Recommendations UI

## Phase 9: Dashboard & Water
- [ ] Backend: Dashboard summary endpoint
- [ ] Mobile: Home Dashboard UI
- [ ] Mobile: Water Tracking UI

## Phase 10: Reports & Notifications
- [ ] Backend: Reports endpoint
- [ ] Mobile: Notifications setup (Expo)
- [ ] Mobile: Reports UI

## Phase 11: Testing & Polish
- [x] Write backend unit tests
- [ ] Write mobile unit tests / manual testing checklist
- [ ] Polish UI/UX (Healthcare theme)
- [ ] Final documentation
