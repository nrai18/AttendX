import numpy as np
import lightgbm as lgb
import os

import joblib

def generate_synthetic_data(num_samples=5000):
    np.random.seed(42)
    
    # Features:
    # 0: current_attendance (0.0 to 1.0)
    # 1: consecutive_misses (0 to 10)
    # 2: day_of_week (0 to 6, Mon to Sun)
    # 3: is_lab (0 or 1)
    
    current_attendance = np.random.uniform(0.5, 1.0, num_samples)
    consecutive_misses = np.random.poisson(1.5, num_samples)
    day_of_week = np.random.randint(0, 7, num_samples)
    is_lab = np.random.randint(0, 2, num_samples)
    
    X = np.column_stack((current_attendance, consecutive_misses, day_of_week, is_lab))
    
    # Label: Risk of dropping (0.0 to 1.0)
    # High risk if current attendance is low, consecutive misses are high.
    # Friday (4) and Monday (0) might slightly increase risk.
    # Labs (1) usually have stricter attendance so lower risk.
    
    risk = (
        0.5 * (1.0 - current_attendance) +
        0.1 * consecutive_misses +
        0.05 * (day_of_week == 0) +
        0.05 * (day_of_week == 4) -
        0.1 * is_lab
    )
    
    risk = np.clip(risk + np.random.normal(0, 0.05, num_samples), 0, 1)
    
    return X.astype(np.float32), risk.astype(np.float32)

def main():
    print("Generating synthetic data...")
    X, y = generate_synthetic_data()
    
    print("Training LightGBM model...")
    model = lgb.LGBMRegressor(n_estimators=100, random_state=42)
    model.fit(X, y)
    
    os.makedirs("models", exist_ok=True)
    model.booster_.save_model("models/attendance_risk.txt")
        
    print("Model saved to models/attendance_risk.txt successfully!")

if __name__ == "__main__":
    main()
