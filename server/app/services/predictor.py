import json
import math
import threading

import pandas as pd
import xgboost as xgb

from .. import config
from ..errors import PipelineError
from ..ml.synth_data import SW_IDX
from ..ml.train_model import FEATURES, TARGETS, ensure_models

REQUIRED = {
    "wrist": ["wrist_width_mm", "palm_length_mm", "hand_length_mm"],
    "ankle": ["foot_length_mm", "ankle_circumference_mm"],
}


class Predictor:
    def __init__(self):
        self._lock = threading.Lock()
        self.meta = None
        self.models = {}

    def load(self):
        with self._lock:
            if self.meta is not None:
                return
            ensure_models()
            self.meta = json.loads((config.MODELS_DIR / "meta.json").read_text(encoding="utf-8"))
            for region in FEATURES:
                for t in TARGETS:
                    m = xgb.XGBRegressor()
                    m.load_model(str(config.MODELS_DIR / f"{region}_{t}.json"))
                    self.models[(region, t)] = m

    def predict(self, region: str, age: int, gender: str, swelling: str, m: dict) -> dict:
        self.load()
        missing = [k for k in REQUIRED[region] if m.get(k) in (None, 0)]
        if missing:
            raise PipelineError(
                "missing_measurements",
                f"Missing measurements for a {region} cast: {', '.join(missing)}",
                "Enter them manually or re-run the scan.",
            )
        row = {"age": float(age), "gender_m": 1.0 if gender == "M" else 0.0,
               "swelling_idx": float(SW_IDX[swelling])}
        for k in FEATURES[region]:
            if k not in row:
                row[k] = float(m[k])
        feats = FEATURES[region]
        df = pd.DataFrame([row], columns=feats)

        rmeta = self.meta["regions"][region]
        out, intervals = {}, {}
        for t in TARGETS:
            v = float(self.models[(region, t)].predict(df)[0])
            h = rmeta["targets"][t]["interval_95_halfwidth"]
            out[t] = v
            intervals[t] = [v - h, v + h]

        d1 = min(max(out["d1_mm"], 20.0), 200.0)
        d2 = min(max(out["d2_mm"], d1 + 2.0), 210.0)
        d3 = min(max(out["d3_mm"], d2 + 2.0), 220.0)
        wall = min(max(out["wall_mm"], 2.5), 8.0)
        length = min(max(out["length_mm"], 80.0), 520.0)

        raw = float(m["wrist_width_mm"]) if region == "wrist" else float(m["ankle_circumference_mm"]) / math.pi

        booster = self.models[(region, "d1_mm")].get_booster()
        contrib = booster.predict(xgb.DMatrix(df), pred_contribs=True)[0]
        explanation = sorted(
            [{"feature": f, "contribution_mm": round(float(c), 2)} for f, c in zip(feats, contrib[:-1])],
            key=lambda x: -abs(x["contribution_mm"]),
        )

        warnings = []
        for f in feats:
            lo, hi = rmeta["ranges"][f]
            if row[f] < lo * 0.9 or row[f] > hi * 1.1:
                warnings.append(f"{f} is outside the range the model was trained on")

        return {
            "region": region,
            "inputs": {"age": age, "gender": gender, "swelling_stage": swelling,
                       **{k: m.get(k) for k in REQUIRED[region]}},
            "station_diameters_mm": [round(d1, 1), round(d2, 1), round(d3, 1)],
            "wall_thickness_mm": round(wall, 1),
            "total_length_mm": round(length, 0),
            "intervals": {k: [round(a, 1), round(b, 1)] for k, (a, b) in intervals.items()},
            "raw_reference_mm": round(raw, 1),
            "clearance_mm": round(d1 - raw, 1),
            "explanation": explanation,
            "warnings": warnings,
            "model_info": {
                "trained_on": self.meta["source"], "n_rows": self.meta["n_rows"],
                "trained_at": self.meta["trained_at"], "interval": self.meta["interval_method"],
            },
        }


predictor = Predictor()