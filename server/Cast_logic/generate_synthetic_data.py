
import numpy as np
import pandas as pd
import json
import os

RNG = np.random.default_rng(seed=42)  

COEFFS = {
    
    "height_growth_curve_cm": {
        "age_anchors": [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
        "M": [110, 116, 122, 127, 132, 137, 143, 149, 156, 163, 168, 172, 173],
        "F": [109, 115, 121, 127, 132, 138, 144, 150, 156, 160, 162, 163, 163],
        "sd_cm": 6.0,  
        "source": "ASSUMPTION (approximate published child growth averages) - replace with WHO/CDC growth chart percentiles",
    },
    "height_cm": {
        "adult_18_59":    {"M": (168, 7),  "F": (155, 6),  "source": "Paper 24 (ELANS) - verify country-specific values"},
        "elderly_60_plus": {"M": (165, 7),  "F": (152, 6),  "source": "ASSUMPTION - adjust for age-related height loss"},
    },


    "hand_length_regression": {
        "M": {"intercept": 95.86, "slope": 3.76, "source": "Illustrative published forensic anthropometry equation - replace with your cited paper's exact coefficients"},
        "F": {"intercept": 94.0,  "slope": 3.90, "source": "ASSUMPTION - derive female-specific equation from your cited papers"},
        "residual_sd_cm": 0.6, 
    },

    
    "hand_ratios": {
        "hand_breadth_of_length": (0.45, 0.02),      # mean, sd  
        "palm_length_of_hand_length": (0.55, 0.02),  
        "wrist_width_of_hand_breadth": (0.72, 0.03), 
        "finger_length_of_hand_length": {
            "thumb": (0.46, 0.02), "index": (0.63, 0.02), "middle": (0.68, 0.02),
            "ring": (0.64, 0.02), "pinky": (0.52, 0.03),
        },
    },

    
    "foot_length_of_height": (0.152, 0.006),  
    "foot_width_of_foot_length": (0.39, 0.02),
    "ankle_circumference_of_foot_length": (0.92, 0.05),  


    "clearance_mm": {
        "child_5_12":      {"clearance": 6.0, "wall_thickness": 3.0, "source": "ASSUMPTION - pediatric casts need more swelling allowance, softer tissue"},
        "adolescent_13_17": {"clearance": 5.0, "wall_thickness": 3.5, "source": "ASSUMPTION"},
        "adult_18_59":     {"clearance": 4.0, "wall_thickness": 4.5, "source": "Paper 14 reports comparable adult wall-thickness range - verify exact mm"},
        "elderly_60_plus": {"clearance": 5.0, "wall_thickness": 4.0, "source": "ASSUMPTION - elderly skin fragility considerations"},
    },
    "swelling_stage_extra_mm": {
        "acute": 3.0,      # Paper 4
        "subacute": 1.0,
        "none": 0.0,
    },
}


def age_bracket(age):
    if age <= 12:
        return "child_5_12"
    elif age <= 17:
        return "adolescent_13_17"
    elif age <= 59:
        return "adult_18_59"
    else:
        return "elderly_60_plus"


def generate_patient():
    # demographics 
    age = int(RNG.integers(5, 85))
    gender = RNG.choice(["M", "F"])
    bracket = age_bracket(age)
    region_source = RNG.choice(
        ["Colombian (Paper 25)", "Mexican (Paper 23)", "Latin American ELANS (Paper 24)"]
    )

    
    if bracket in ("child_5_12", "adolescent_13_17"):
        curve = COEFFS["height_growth_curve_cm"]
        h_mean = float(np.interp(age, curve["age_anchors"], curve[gender]))
        h_sd = curve["sd_cm"]
    else:
        h_mean, h_sd = COEFFS["height_cm"][bracket][gender]
    height_cm = float(RNG.normal(h_mean, h_sd))
    height_cm = max(height_cm, 60)  

    reg = COEFFS["hand_length_regression"][gender]
    residual_sd = COEFFS["hand_length_regression"]["residual_sd_cm"]
    
    hand_length_cm = (height_cm - reg["intercept"]) / reg["slope"]
    hand_length_cm += RNG.normal(0, residual_sd)  
    hand_length_cm = max(hand_length_cm, 5)  
    hand_length_mm = hand_length_cm * 10

   
    ratios = COEFFS["hand_ratios"]
    hand_breadth_mm = hand_length_mm * RNG.normal(*ratios["hand_breadth_of_length"])
    palm_length_mm = hand_length_mm * RNG.normal(*ratios["palm_length_of_hand_length"])
    wrist_width_mm = hand_breadth_mm * RNG.normal(*ratios["wrist_width_of_hand_breadth"])

    finger_lengths_mm = {
        finger: hand_length_mm * RNG.normal(*vals)
        for finger, vals in ratios["finger_length_of_hand_length"].items()
    }

    foot_length_mm = height_cm * 10 * RNG.normal(*COEFFS["foot_length_of_height"])
    foot_width_mm = foot_length_mm * RNG.normal(*COEFFS["foot_width_of_foot_length"])
    ankle_circumference_mm = foot_length_mm * RNG.normal(*COEFFS["ankle_circumference_of_foot_length"])

  
    injury_region = RNG.choice(["distal_radius", "forearm", "ankle"], p=[0.45, 0.25, 0.30])
    swelling_stage = RNG.choice(["acute", "subacute", "none"], p=[0.5, 0.35, 0.15])

   
    clin = COEFFS["clearance_mm"][bracket]
    swelling_extra = COEFFS["swelling_stage_extra_mm"][swelling_stage]

    if injury_region == "ankle":
        base_measurement_mm = ankle_circumference_mm
    else:
        base_measurement_mm = wrist_width_mm * np.pi  

    cast_inner_diameter_mm = ( base_measurement_mm / np.pi + clin["clearance"] + swelling_extra + RNG.normal(0, 0.4))
    wall_thickness_mm = clin["wall_thickness"] + RNG.normal(0, 0.15)
    cast_length_mm = ((palm_length_mm * 2.2 if injury_region != "ankle" else foot_length_mm * 1.1)+ RNG.normal(0, 5))

    row = {
        "age": age,
        "gender": gender,
        "height_cm": round(height_cm, 1),
        "population_source": region_source,
        "hand_length_mm": round(hand_length_mm, 1),
        "hand_breadth_mm": round(hand_breadth_mm, 1),
        "palm_length_mm": round(palm_length_mm, 1),
        "wrist_width_mm": round(wrist_width_mm, 1),
        "thumb_length_mm": round(finger_lengths_mm["thumb"], 1),
        "index_length_mm": round(finger_lengths_mm["index"], 1),
        "middle_length_mm": round(finger_lengths_mm["middle"], 1),
        "ring_length_mm": round(finger_lengths_mm["ring"], 1),
        "pinky_length_mm": round(finger_lengths_mm["pinky"], 1),
        "foot_length_mm": round(foot_length_mm, 1),
        "foot_width_mm": round(foot_width_mm, 1),
        "ankle_circumference_mm": round(ankle_circumference_mm, 1),
        "injury_region": injury_region,
        "swelling_stage": swelling_stage,
        "cast_inner_diameter_mm": round(cast_inner_diameter_mm, 1),
        "wall_thickness_mm": round(wall_thickness_mm, 2),
        "cast_length_mm": round(cast_length_mm, 1),
    }
    return row


def generate_dataset(n=3000):
    rows = [generate_patient() for _ in range(n)]
    df = pd.DataFrame(rows)
    return df

def recalibrate_from_real_sample(real_sample_csv_path):

    real_df = pd.read_csv(real_sample_csv_path)
    synth_df = generate_dataset(n=3000)

    report = {}
    for bracket in COEFFS["height_cm"].keys():
        for gender in ["M", "F"]:
            def in_bracket(df):
                return df[
                    (df["gender"] == gender)
                    & (df["age"].apply(age_bracket) == bracket)
                ]
            real_sub = in_bracket(real_df)
            synth_sub = in_bracket(synth_df)
            if len(real_sub) == 0:
                continue
            report[f"{bracket}_{gender}"] = {
                "n_real": len(real_sub),
                "real_mean_hand_length_mm": round(real_sub["hand_length_mm"].mean(), 1) if "hand_length_mm" in real_sub else None,
                "synthetic_mean_hand_length_mm": round(synth_sub["hand_length_mm"].mean(), 1),
                "real_mean_wrist_width_mm": round(real_sub["wrist_width_mm"].mean(), 1) if "wrist_width_mm" in real_sub else None,
                "synthetic_mean_wrist_width_mm": round(synth_sub["wrist_width_mm"].mean(), 1),
            }
    print(json.dumps(report, indent=2))
    
    return report

if __name__ == "__main__":
    df = generate_dataset(n=3000)

    os.makedirs("data", exist_ok=True)
    out_path = "data/synthetic_dataset.csv"
    df.to_csv(out_path, index=False)

    data_dict = {
        "age": "Uniformly sampled 5-85 (ASSUMPTION - adjust range to your target clinic population)",
        "gender": "Randomly assigned M/F, 50/50",
        "height_cm": "Sampled from age+gender-conditioned normal distribution, see COEFFS['height_cm']",
        "hand_length_mm": "DERIVED from height via regression, see COEFFS['hand_length_regression']",
        "wrist_width_mm": "DERIVED from hand_length via published ratio chain, see COEFFS['hand_ratios']",
        "foot_length_mm": "DERIVED from height via published ratio, see COEFFS['foot_length_of_height']",
        "ankle_circumference_mm": "DERIVED from foot_length, see COEFFS['ankle_circumference_of_foot_length']",
        "cast_inner_diameter_mm": "LABEL - base measurement + clinical clearance + swelling allowance, see COEFFS['clearance_mm'] and COEFFS['swelling_stage_extra_mm']",
        "wall_thickness_mm": "LABEL - from COEFFS['clearance_mm'][bracket]['wall_thickness']",
        "cast_length_mm": "LABEL - proportional to palm_length or foot_length depending on injury_region",
    }
    with open("data/data_dictionary.json", "w") as f:
        json.dump(data_dict, f, indent=2)

    print(f"Generated {len(df)} synthetic patients -> {out_path}")
    print(f"Data dictionary written -> data/data_dictionary.json")
    print("\nSample rows:")
    print(df.head(5).to_string())
    print("\nSummary statistics:")
    print(df.describe().to_string())
