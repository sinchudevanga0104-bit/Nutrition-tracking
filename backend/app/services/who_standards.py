"""
Official WHO Child Growth Standards & Dietary Guidelines Service
================================================================
Based on:
1. WHO Child Growth Standards (0-60 months) - World Health Organization
2. WHO Growth Reference 5-19 years (2007) - World Health Organization
3. WHO/FAO Technical Report 935: Human Energy & Protein Requirements
"""

import math
from datetime import date
from typing import Dict, Any, List, Optional
from decimal import Decimal

# Anchor points for WHO BMI-for-Age (Months, Median BMI, Standard Deviation)
# Sourced from WHO Child Growth Standards & WHO Reference 2007
WHO_BMI_BOYS = [
    (0, 13.4, 1.2),
    (3, 16.3, 1.3),
    (6, 17.3, 1.3),
    (9, 17.0, 1.3),
    (12, 16.6, 1.2),
    (18, 16.1, 1.1),
    (24, 15.8, 1.1),
    (36, 15.5, 1.1),
    (48, 15.3, 1.1),
    (60, 15.3, 1.2),
    (72, 15.3, 1.3),
    (84, 15.5, 1.5),
    (96, 15.8, 1.7),
    (108, 16.2, 1.9),
    (120, 16.7, 2.1),
    (132, 17.3, 2.3),
    (144, 17.9, 2.5),
    (156, 18.6, 2.6),
    (168, 19.3, 2.7),
    (180, 20.0, 2.8),
    (192, 20.8, 2.9),
    (204, 21.5, 3.0),
    (216, 22.0, 3.0),
    (228, 22.4, 3.1)
]

WHO_BMI_GIRLS = [
    (0, 13.3, 1.2),
    (3, 16.0, 1.3),
    (6, 16.8, 1.3),
    (9, 16.5, 1.3),
    (12, 16.1, 1.2),
    (18, 15.6, 1.1),
    (24, 15.4, 1.1),
    (36, 15.2, 1.1),
    (48, 15.1, 1.1),
    (60, 15.2, 1.2),
    (72, 15.2, 1.4),
    (84, 15.4, 1.6),
    (96, 15.7, 1.8),
    (108, 16.2, 2.0),
    (120, 16.8, 2.2),
    (132, 17.5, 2.4),
    (144, 18.2, 2.6),
    (156, 19.0, 2.7),
    (168, 19.7, 2.8),
    (180, 20.3, 2.9),
    (192, 20.8, 2.9),
    (204, 21.2, 3.0),
    (216, 21.5, 3.0),
    (228, 21.7, 3.0)
]

# WHO Weight-for-Age Medians (kg)
WHO_WEIGHT_BOYS = [
    (0, 3.3), (6, 7.9), (12, 9.6), (24, 12.2), (36, 14.3),
    (48, 16.3), (60, 18.3), (72, 20.5), (96, 25.6), (120, 31.2),
    (144, 38.5), (168, 47.0), (192, 56.0), (228, 64.0)
]

WHO_WEIGHT_GIRLS = [
    (0, 3.2), (6, 7.3), (12, 8.9), (24, 11.5), (36, 13.9),
    (48, 16.1), (60, 18.2), (72, 20.2), (96, 25.0), (120, 31.9),
    (144, 40.0), (168, 47.5), (192, 53.0), (228, 56.5)
]

# WHO Height-for-Age Medians (cm)
WHO_HEIGHT_BOYS = [
    (0, 49.9), (6, 67.6), (12, 75.7), (24, 87.8), (36, 96.1),
    (48, 103.3), (60, 110.0), (72, 116.0), (96, 128.0), (120, 138.4),
    (144, 149.0), (168, 163.0), (192, 173.0), (228, 176.5)
]

WHO_HEIGHT_GIRLS = [
    (0, 49.1), (6, 65.7), (12, 74.0), (24, 86.4), (36, 95.1),
    (48, 102.7), (60, 109.4), (72, 115.5), (96, 127.5), (120, 138.6),
    (144, 151.0), (168, 160.5), (192, 163.0), (228, 163.5)
]

def calculate_age_months(dob: Any, ref_date: Optional[date] = None) -> int:
    """Calculates child age in completed months."""
    if isinstance(dob, (int, float)):
        return max(0, int(dob))
    if isinstance(dob, str):
        try:
            dob = date.fromisoformat(dob.split("T")[0])
        except Exception:
            return 36
    if not ref_date:
        ref_date = date.today()
    months = (ref_date.year - dob.year) * 12 + (ref_date.month - dob.month)
    if ref_date.day < dob.day:
        months -= 1
    return max(0, months)

def _interpolate(anchors: List[tuple], x: float) -> tuple:
    """Linear interpolation on (month, val, ...) anchors."""
    if x <= anchors[0][0]:
        return anchors[0][1:]
    if x >= anchors[-1][0]:
        return anchors[-1][1:]
    for i in range(len(anchors) - 1):
        x1 = anchors[i][0]
        x2 = anchors[i+1][0]
        if x1 <= x <= x2:
            t = (x - x1) / (x2 - x1)
            vals = []
            for j in range(1, len(anchors[i])):
                v1 = anchors[i][j]
                v2 = anchors[i+1][j]
                vals.append(v1 + t * (v2 - v1))
            return tuple(vals)
    return anchors[-1][1:]

def get_who_bmi_benchmark(age_months: int, gender: str = "Male") -> Dict[str, float]:
    """Returns official WHO BMI median and standard deviation cutoffs."""
    is_boy = str(gender).lower() in ["male", "boy", "m"]
    anchors = WHO_BMI_BOYS if is_boy else WHO_BMI_GIRLS
    
    med, sd = _interpolate(anchors, age_months)
    return {
        "median": round(med, 2),
        "minus_3sd": round(med - 3 * sd, 2),
        "minus_2sd": round(med - 2 * sd, 2), # Underweight cut-off
        "minus_1sd": round(med - 1 * sd, 2),
        "plus_1sd": round(med + 1 * sd, 2),   # Overweight threshold
        "plus_2sd": round(med + 2 * sd, 2),   # Obese threshold
        "plus_3sd": round(med + 3 * sd, 2),
        "sd": round(sd, 2)
    }

def get_who_weight_benchmark(age_months: int, gender: str = "Male") -> float:
    is_boy = str(gender).lower() in ["male", "boy", "m"]
    anchors = WHO_WEIGHT_BOYS if is_boy else WHO_WEIGHT_GIRLS
    med, = _interpolate(anchors, age_months)
    return round(med, 1)

def get_who_height_benchmark(age_months: int, gender: str = "Male") -> float:
    is_boy = str(gender).lower() in ["male", "boy", "m"]
    anchors = WHO_HEIGHT_BOYS if is_boy else WHO_HEIGHT_GIRLS
    med, = _interpolate(anchors, age_months)
    return round(med, 1)

def compute_who_zscore(measured_val: float, median: float, sd: float) -> float:
    """Calculates WHO z-score."""
    if sd <= 0:
        return 0.0
    return round((measured_val - median) / sd, 2)

def zscore_to_percentile(z_score: float) -> float:
    """Converts a z-score to percentile (0.1 to 99.9)."""
    p = 0.5 * (1.0 + math.erf(z_score / math.sqrt(2.0))) * 100.0
    return round(max(0.1, min(99.9, p)), 1)

def classify_who_bmi(z_score: float) -> Dict[str, str]:
    """Official WHO Child Growth Standards Diagnostic Classification."""
    if z_score < -3.0:
        return {
            "status": "Severe Thinness",
            "badge_color": "#D32F2F",
            "clinical_advice": "Urgent nutritional intervention recommended. Consult pediatrician."
        }
    elif z_score < -2.0:
        return {
            "status": "Underweight / Thinness",
            "badge_color": "#F57C00",
            "clinical_advice": "Below WHO healthy growth corridor. Increase calorie and protein density."
        }
    elif z_score <= 1.0:
        return {
            "status": "Optimal Normal Growth",
            "badge_color": "#2E7D32",
            "clinical_advice": "Healthy growth standards matching WHO pediatric benchmarks."
        }
    elif z_score <= 2.0:
        return {
            "status": "Risk of Overweight",
            "badge_color": "#FFA000",
            "clinical_advice": "Slightly above median. Encourage active play and balanced whole foods."
        }
    else:
        return {
            "status": "Overweight / Obese",
            "badge_color": "#E65100",
            "clinical_advice": "Above WHO standard percentile. Focus on fiber, water, and reduced sugar."
        }

def get_who_nutritional_targets(dob: date, gender: str = "Male") -> Dict[str, Any]:
    """
    Returns official WHO / FAO Daily Nutritional Requirements based on child's exact age.
    Reference: WHO/FAO Technical Report Series 935: Human Energy Requirements
    """
    age_months = calculate_age_months(dob)
    age_years = age_months / 12.0
    is_boy = str(gender).lower() in ["male", "boy", "m"]

    if age_months < 6:
        return {
            "age_group": "0-6 months",
            "calories": 550,
            "protein": 9.1,
            "protein_g": 9.1,
            "carbs": 60,
            "fat": 30,
            "water_ml": 0, # Exclusive breastfeeding / formula
            "calcium_mg": 200,
            "iron_mg": 0.27,
            "who_source": "WHO Guidelines on Infant Feeding"
        }
    elif age_months < 12:
        return {
            "age_group": "6-12 months",
            "calories": 700,
            "protein": 11.0,
            "protein_g": 11.0,
            "carbs": 95,
            "fat": 30,
            "water_ml": 500,
            "calcium_mg": 260,
            "iron_mg": 11.0,
            "who_source": "WHO Complementary Feeding Guidelines"
        }
    elif age_years < 4:
        return {
            "age_group": "1-3 years (Toddler)",
            "calories": 1050,
            "protein": 13.0,
            "protein_g": 13.0,
            "carbs": 130,
            "fat": 35,
            "water_ml": 1100,
            "calcium_mg": 500,
            "iron_mg": 7.0,
            "who_source": "WHO/FAO Recommended Nutrient Intakes"
        }
    elif age_years < 7:
        return {
            "age_group": "4-6 years (Young Child)",
            "calories": 1350,
            "protein": 19.0,
            "protein_g": 19.0,
            "carbs": 175,
            "fat": 42,
            "water_ml": 1400,
            "calcium_mg": 600,
            "iron_mg": 10.0,
            "who_source": "WHO/FAO Recommended Nutrient Intakes"
        }
    elif age_years < 10:
        return {
            "age_group": "7-9 years (Child)",
            "calories": 1650,
            "protein": 28.0,
            "protein_g": 28.0,
            "carbs": 220,
            "fat": 50,
            "water_ml": 1600,
            "calcium_mg": 700,
            "iron_mg": 10.0,
            "who_source": "WHO/FAO Recommended Nutrient Intakes"
        }
    elif age_years < 14:
        cals = 2100 if is_boy else 1950
        prot = 42.0 if is_boy else 40.0
        return {
            "age_group": "10-13 years (Adolescent)",
            "calories": cals,
            "protein": prot,
            "protein_g": prot,
            "carbs": 260,
            "fat": 60,
            "water_ml": 1800,
            "calcium_mg": 1000,
            "iron_mg": 15.0 if is_boy else 21.0,
            "who_source": "WHO/FAO Recommended Nutrient Intakes"
        }
    else:
        cals = 2600 if is_boy else 2100
        prot = 55.0 if is_boy else 46.0
        return {
            "age_group": "14-18 years (Teen)",
            "calories": cals,
            "protein": prot,
            "protein_g": prot,
            "carbs": 300,
            "fat": 70,
            "water_ml": 2000,
            "calcium_mg": 1000,
            "iron_mg": 15.0 if is_boy else 18.0,
            "who_source": "WHO/FAO Recommended Nutrient Intakes"
        }
