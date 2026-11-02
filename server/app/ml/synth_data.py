"""
Literature-anchored synthetic dataset (fallback when no real dataset is available).

Every person is generated as a correlated chain, never as independent random draws:
    age, gender -> height -> hand length -> palm / wrist width
                          -> foot length -> foot width / ankle circumference
Labels (cast dimensions) come from clinical clearance rules.
All numbers marked ASSUMPTION must be replaced or cited before final submission.
"""
import numpy as np
import pandas as pd

SW_IDX = {"none": 0, "subacute": 1, "acute": 2}

# ASSUMPTION: approximate average child heights (replace with WHO/CDC growth charts)
_AGE_ANCHORS = np.arange(5, 18)
_H_M = np.array([110, 116, 122, 127, 132, 137, 143, 149, 156, 163, 168, 172, 173], float)
_H_F = np.array([109, 115, 121, 127, 132, 138, 144, 150, 156, 160, 162, 163, 163], float)

# ASSUMPTION: station diameter = limb diameter * ratio + clearance
_WRIST_RATIOS = np.array([1.00, 1.25, 1.45])   # wrist end, mid-forearm, proximal end
_ANKLE_RATIOS = np.array([1.00, 1.28, 1.52])   # ankle, mid-shin, proximal end


def generate_dataset(n: int = 8000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # age mix: fractures cluster in children and the elderly (ASSUMPTION)
    u = rng.random(n)
    age = np.where(u < 0.30, rng.integers(5, 18, n),
                   np.where(u < 0.75, rng.integers(18, 60, n), rng.integers(60, 86, n)))
    male = rng.random(n) < 0.5

    h_child = np.where(male, np.interp(age, _AGE_ANCHORS, _H_M),
                       np.interp(age, _AGE_ANCHORS, _H_F)) + rng.normal(0, 6.0, n)
    h_adult = (np.where(male, 167.0, 154.0) - np.where(age >= 60, 2.0, 0.0)
               + rng.normal(0, np.where(male, 7.0, 6.5)))   # ASSUMPTION: adult stature
    height = np.clip(np.where(age < 18, h_child, h_adult), 95, 205)

    # proportional chain (ratio method extrapolates correctly to children)
    hand = np.clip(
    height * 10 * rng.normal(np.where(male, 0.107, 0.105), 0.0045),
    90,
    230,
)

    foot = np.clip(
        height * 10 * rng.normal(0.152, 0.006, n),
        120,
        330,
    )    
    palm = hand * rng.normal(0.55, 0.02, n)
    wrist = hand * rng.normal(0.31, 0.016, n)
    
    foot_w = foot * rng.normal(0.39, 0.02, n)
    ankle = foot * rng.normal(0.92, 0.045, n)

    # clinical context
    sw = rng.choice([0, 1, 2], size=n, p=[0.15, 0.35, 0.50])      # none / subacute / acute
    extra = np.array([0.0, 1.0, 3.0])[sw]                          # ASSUMPTION (see paper 4)
    base = np.select([age <= 12, age <= 17, age <= 59], [6.0, 5.0, 4.0], default=5.0)
    clear = base + extra
    wall_base = np.select([age <= 12, age <= 17, age <= 59], [3.0, 3.5, 4.5], default=4.0)

    def stations(limb, ratios):
        jitter = np.array([0.0, 1.0, 1.0]) * rng.normal(0, 0.03, (n, 1))
        r = ratios[None, :] + jitter
        return limb[:, None] * r + clear[:, None] + rng.normal(0, 0.4, (n, 3))

    w = stations(wrist, _WRIST_RATIOS)
    a = stations(ankle / np.pi, _ANKLE_RATIOS)

    df = pd.DataFrame({
        "age": age, "gender": np.where(male, "M", "F"), "height_cm": height,
        "swelling_stage": np.array(["none", "subacute", "acute"])[sw],
        "hand_length_mm": hand, "palm_length_mm": palm, "wrist_width_mm": wrist,
        "foot_length_mm": foot, "foot_width_mm": foot_w, "ankle_circumference_mm": ankle,
        "wrist_d1_mm": w[:, 0], "wrist_d2_mm": w[:, 1], "wrist_d3_mm": w[:, 2],
        "wrist_wall_mm": wall_base + rng.normal(0, 0.15, n),
        "wrist_length_mm": palm + 1.05 * hand + rng.normal(0, 6, n),
        "ankle_d1_mm": a[:, 0], "ankle_d2_mm": a[:, 1], "ankle_d3_mm": a[:, 2],
        "ankle_wall_mm": wall_base + rng.normal(0, 0.15, n),
        "ankle_length_mm": 1.15 * foot + rng.normal(0, 6, n),
    })
    return df.round(2)