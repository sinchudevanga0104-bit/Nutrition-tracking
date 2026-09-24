-- NutriTrack AI Database Schema

CREATE DATABASE IF NOT EXISTS nutritrack_db;
USE nutritrack_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('parent', 'nutritionist', 'admin') DEFAULT 'parent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Children Table
CREATE TABLE IF NOT EXISTS children (
    child_id INT AUTO_INCREMENT PRIMARY KEY,
    parent_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    dob DATE NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    blood_group VARCHAR(5),
    food_allergies TEXT,
    food_preferences TEXT,
    activity_level ENUM('Low', 'Moderate', 'High') DEFAULT 'Moderate',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 3. Food Database Table
CREATE TABLE IF NOT EXISTS foods (
    food_id INT AUTO_INCREMENT PRIMARY KEY,
    food_name VARCHAR(150) NOT NULL,
    category VARCHAR(50),
    serving_size VARCHAR(50),
    calories DECIMAL(6,2),
    protein DECIMAL(6,2),
    carbohydrates DECIMAL(6,2),
    fat DECIMAL(6,2),
    fiber DECIMAL(6,2),
    calcium DECIMAL(6,2),
    iron DECIMAL(6,2),
    vitamin_a DECIMAL(6,2),
    vitamin_c DECIMAL(6,2)
);

-- 4. Meals Table
CREATE TABLE IF NOT EXISTS meals (
    meal_id INT AUTO_INCREMENT PRIMARY KEY,
    child_id INT NOT NULL,
    meal_type ENUM('Breakfast', 'Lunch', 'Snacks', 'Dinner') NOT NULL,
    meal_date DATE NOT NULL,
    total_calories DECIMAL(6,2) DEFAULT 0,
    total_protein DECIMAL(6,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES children(child_id) ON DELETE CASCADE
);

-- 5. Meal Items Table
CREATE TABLE IF NOT EXISTS meal_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    meal_id INT NOT NULL,
    food_id INT NOT NULL,
    quantity DECIMAL(6,2) NOT NULL, -- e.g., 1.5 servings
    FOREIGN KEY (meal_id) REFERENCES meals(meal_id) ON DELETE CASCADE,
    FOREIGN KEY (food_id) REFERENCES foods(food_id)
);

-- 6. Growth Records Table
CREATE TABLE IF NOT EXISTS growth_records (
    record_id INT AUTO_INCREMENT PRIMARY KEY,
    child_id INT NOT NULL,
    record_date DATE NOT NULL,
    height DECIMAL(5,2) NOT NULL, -- in cm
    weight DECIMAL(5,2) NOT NULL, -- in kg
    bmi DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES children(child_id) ON DELETE CASCADE
);

-- 7. Daily Nutrition Records Table
CREATE TABLE IF NOT EXISTS nutrition_records (
    record_id INT AUTO_INCREMENT PRIMARY KEY,
    child_id INT NOT NULL,
    record_date DATE NOT NULL,
    total_calories DECIMAL(8,2) DEFAULT 0,
    total_protein DECIMAL(8,2) DEFAULT 0,
    total_carbs DECIMAL(8,2) DEFAULT 0,
    total_fat DECIMAL(8,2) DEFAULT 0,
    water_intake_ml INT DEFAULT 0,
    nutrition_score INT DEFAULT 0,
    UNIQUE KEY unique_child_date (child_id, record_date),
    FOREIGN KEY (child_id) REFERENCES children(child_id) ON DELETE CASCADE
);

-- 8. Recommendations Table
CREATE TABLE IF NOT EXISTS recommendations (
    recommendation_id INT AUTO_INCREMENT PRIMARY KEY,
    child_id INT NOT NULL,
    generated_by INT, -- NULL if AI, user_id if Nutritionist
    content TEXT NOT NULL,
    type ENUM('Food', 'Activity', 'General') DEFAULT 'General',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES children(child_id) ON DELETE CASCADE,
    FOREIGN KEY (generated_by) REFERENCES users(user_id)
);

-- 9. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 10. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
