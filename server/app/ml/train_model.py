"""
Train the cast-dimension models.
    python -m app.ml.train_model                    # synthetic dataset
    python -m app.ml.train_model --csv guide.csv    # your guide's dataset (same column names)

CSV columns required: age, gender (M/F), swelling_stage (none/subacute/acute),
wrist_width_mm, palm_length_mm, hand_length_mm, foot_length_mm, ankle_circumference_mm,
and targets: {wrist|ankle}_{d1_mm,d2_mm,d3_mm,wall_mm,length_mm}
"""
import argparse
import json
import time

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split

from .. import config
from .synth_data import SW_IDX, generate_dataset

FEATURES = {
    "wrist": ["age", "gender_m", "wrist_width_mm", "palm_length_mm", "hand_length_mm", "swelling_idx"],
    "ankle": ["age", "gender_m", "foot_length_mm", "ankle_circumference_mm", "swelling_idx"],
}
TARGETS = ["d1_mm", "d2_mm", "d3_mm", "wall_mm", "length_mm"]


def _prep(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if "gender_m" not in df:
        df["gender_m"] = (df["gender"].astype(str).str.upper().str[0] == "M").astype(float)
    if "swelling_idx" not in df:
        df["swelling_idx"] = df["swelling_stage"].map(SW_IDX).astype(float)
    return df


def models_ok() -> bool:
    meta = config.MODELS_DIR / "meta.json"
    if not meta.exists():
        return False
    try:
        m = json.loads(meta.read_text(encoding="utf-8"))
        if m.get("xgboost_version") != xgb.__version__:
            return False
        for region in FEATURES:
            for t in TARGETS:
                if not (config.MODELS_DIR / f"{region}_{t}.json").exists():
                    return False
        return True
    except Exception:
        return False


def ensure_models():
    if not models_ok():
        train()


def train(csv: str = None, n: int = 8000, seed: int = 42) -> dict:
    config.ensure_dirs()
    if csv:
        df = pd.read_csv(csv)
        source = f"csv:{csv}"
    else:
        df = generate_dataset(n=n, seed=seed)
        source = "synthetic literature-anchored (rule-based labels)"
    df = _prep(df)

    meta = {
        "trained_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "xgboost_version": xgb.__version__,
        "n_rows": int(len(df)),
        "source": source,
        "interval_method": "split-conformal 95% (calibration residual quantile)",
        "regions": {},
    }

    for region, feats in FEATURES.items():
        cols = [f"{region}_{t}" for t in TARGETS]
        missing = [c for c in feats + cols if c not in df.columns]
        if missing:
            raise ValueError(f"Dataset is missing columns: {missing}")
        X = df[feats].astype(float)
        Y = df[cols].astype(float)
        X_tr, X_tmp, Y_tr, Y_tmp = train_test_split(X, Y, test_size=0.30, random_state=seed)
        X_cal, X_te, Y_cal, Y_te = train_test_split(X_tmp, Y_tmp, test_size=0.50, random_state=seed)

        rmeta = {"features": feats, "ranges": {}, "targets": {}, "importance": {}}
        for f in feats:
            rmeta["ranges"][f] = [float(X[f].min()), float(X[f].max())]
        imp_total = {f: 0.0 for f in feats}

        for t in TARGETS:
            col = f"{region}_{t}"
            m = xgb.XGBRegressor(
                n_estimators=400, max_depth=4, learning_rate=0.05, subsample=0.9,
                colsample_bytree=0.9, min_child_weight=3, reg_lambda=1.0,
                tree_method="hist", n_jobs=2, random_state=seed,
            )
            m.fit(X_tr, Y_tr[col])

            res_cal = np.abs(Y_cal[col].values - m.predict(X_cal))
            k = len(res_cal)
            q = float(np.quantile(res_cal, min(1.0, np.ceil((k + 1) * 0.95) / k)))
            err = Y_te[col].values - m.predict(X_te)
            ss_res = float(np.sum(err ** 2))
            ss_tot = float(np.sum((Y_te[col].values - Y_te[col].values.mean()) ** 2))
            rmeta["targets"][t] = {
                "mae": float(np.mean(np.abs(err))),
                "rmse": float(np.sqrt(np.mean(err ** 2))),
                "r2": 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0,
                "interval_95_halfwidth": q,
                "coverage_95": float(np.mean(np.abs(err) <= q)),
            }
            m.save_model(str(config.MODELS_DIR / f"{region}_{t}.json"))
            score = m.get_booster().get_score(importance_type="gain")
            tot = sum(score.values()) or 1.0
            for f in feats:
                imp_total[f] += score.get(f, 0.0) / tot

        rmeta["importance"] = {f: v / len(TARGETS) for f, v in imp_total.items()}
        rmeta["n_test"] = int(len(X_te))
        meta["regions"][region] = rmeta

    (config.MODELS_DIR / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print("Training complete. Source:", source, "| rows:", len(df))
    for region, r in meta["regions"].items():
        print(f"\n[{region}] test MAE (mm) / R2 / 95% interval half-width / coverage")
        for t, s in r["targets"].items():
            print(f"  {t:10s} MAE {s['mae']:.2f}  R2 {s['r2']:.3f}  +/-{s['interval_95_halfwidth']:.2f}  cov {s['coverage_95']:.2f}")
    return meta


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=None)
    ap.add_argument("--n", type=int, default=8000)
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()
    train(csv=a.csv, n=a.n, seed=a.seed)