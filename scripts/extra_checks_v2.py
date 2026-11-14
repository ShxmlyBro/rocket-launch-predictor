#!/usr/bin/env python
# coding: utf-8
"""Extra checks on the v2 model. Reads only; writes reports_v2/extra_checks.csv.

(1) SMOTE vs class_weight="balanced" (no SMOTE), same best_params, 5-fold stratified CV
    PR-AUC on the training set only.
(2) 1,000-sample bootstrap 95% CIs on the test set for recall, precision, F2 and PR-AUC
    at the saved threshold.

Data cleaning, features, split and seeds are copied from modelling_v2.py. Run from scripts/.
"""
import os, sys, json, time, warnings
import numpy as np
import pandas as pd
import joblib
import scipy, sklearn, imblearn

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import precision_score, recall_score, fbeta_score, average_precision_score
from imblearn.pipeline import Pipeline as ImbPipeline
from imblearn.over_sampling import SMOTE

warnings.filterwarnings("ignore")
T0 = time.time()
RANDOM_STATE = 42
N_BOOT = 1000

DATA_FILE = "../data/merged_gcat_meteo_v2.csv"
MODEL_DIR = "../backend/model_v2"
OUT_CSV = "../reports_v2/extra_checks.csv"

NUM_COLS = ["temp_mean", "precipitation", "max_wind_speed"]
CAT_COLS = ["Launch_Site", "LV_Type", "Agency"]

print("Python           :", sys.version.split()[0], "|", sys.executable)
print("pandas           :", pd.__version__)
print("scikit-learn     :", sklearn.__version__)
print("imbalanced-learn :", imblearn.__version__)
print("scipy            :", scipy.__version__)
print("Data file        :", os.path.basename(DATA_FILE))

# ---- same cleaning, features and split as modelling_v2.py ----
df = pd.read_csv(DATA_FILE, low_memory=False)
data = df.dropna(subset=NUM_COLS).copy()
for c in CAT_COLS:
    data[c] = data[c].astype(str).fillna("Unknown")
data["target"] = data["FailCode"].notna().astype(int)

X = data[NUM_COLS + CAT_COLS]
y = data["target"]
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE)
print(f"Rows: {len(df)} total, {len(data)} used | train {len(X_train)} "
      f"({int(y_train.sum())} anomalies) | test {len(X_test)} ({int(y_test.sum())} anomalies)")

with open(f"{MODEL_DIR}/metadata.json") as f:
    meta = json.load(f)
best_params = meta["best_params"]  # keys look like "clf__max_depth"
print("best_params from metadata.json:", best_params)


def make_prep():
    return ColumnTransformer([
        ("num", StandardScaler(), NUM_COLS),
        ("cat", OneHotEncoder(handle_unknown="infrequent_if_exist", min_frequency=30), CAT_COLS),
    ])


rf_smote = ImbPipeline([("prep", make_prep()),
                        ("smote", SMOTE(random_state=RANDOM_STATE)),
                        ("clf", RandomForestClassifier(n_estimators=200, random_state=RANDOM_STATE, n_jobs=-1))])
rf_balanced = ImbPipeline([("prep", make_prep()),
                           ("clf", RandomForestClassifier(n_estimators=200, class_weight="balanced",
                                                          random_state=RANDOM_STATE, n_jobs=-1))])
rf_smote.set_params(**best_params)
rf_balanced.set_params(**best_params)

rows = []

# ---- (1) SMOTE vs balanced class weights, CV on the training set only ----
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
print("\n(1) 5-fold stratified CV PR-AUC on the training set")
for name, model in [("RF + SMOTE", rf_smote), ("RF class_weight=balanced, no SMOTE", rf_balanced)]:
    scores = cross_val_score(model, X_train, y_train, cv=cv, scoring="average_precision", n_jobs=-1)
    print(f"  {name:38s} mean {scores.mean():.4f} | std {scores.std():.4f} | folds {np.round(scores, 4).tolist()}")
    rows.append({"check": "cv_smote_vs_balanced", "name": name, "metric": "CV PR-AUC (mean)",
                 "value": round(float(scores.mean()), 4), "ci_low": "", "ci_high": "",
                 "std": round(float(scores.std()), 4), "n": len(scores)})
no_skill = float(y_train.mean())
print(f"  No-skill PR-AUC (train anomaly rate): {no_skill:.4f}")
rows.append({"check": "cv_smote_vs_balanced", "name": "No-skill baseline", "metric": "CV PR-AUC (mean)",
             "value": round(no_skill, 4), "ci_low": "", "ci_high": "", "std": "", "n": ""})

# ---- (2) bootstrap CIs on the test set for the saved model ----
bundle = joblib.load(f"{MODEL_DIR}/rocket_model.joblib")
model, thr = bundle["model"], float(bundle["threshold"])
prob = model.predict_proba(X_test)[:, 1]
yt = y_test.to_numpy()
pred = (prob >= thr).astype(int)

def scores_for(idx):
    t, p, pr = yt[idx], pred[idx], prob[idx]
    return {"Recall": recall_score(t, p, zero_division=0),
            "Precision": precision_score(t, p, zero_division=0),
            "F2": fbeta_score(t, p, beta=2, zero_division=0),
            "PR-AUC": average_precision_score(t, pr)}

point = scores_for(np.arange(len(yt)))
rng = np.random.default_rng(RANDOM_STATE)
boot = {k: [] for k in point}
skipped = 0
for _ in range(N_BOOT):
    idx = rng.integers(0, len(yt), len(yt))
    if yt[idx].sum() == 0:  # no positives in resample: metrics undefined
        skipped += 1
        continue
    for k, v in scores_for(idx).items():
        boot[k].append(v)

print(f"\n(2) Test-set bootstrap, {N_BOOT} resamples, threshold {thr:.3f} (skipped {skipped})")
for k in point:
    lo, hi = np.percentile(boot[k], [2.5, 97.5])
    print(f"  {k:10s} {point[k]:.3f}  95% CI [{lo:.3f}, {hi:.3f}]")
    rows.append({"check": "bootstrap_test", "name": f"saved model @ threshold {thr:.3f}", "metric": k,
                 "value": round(float(point[k]), 4), "ci_low": round(float(lo), 4),
                 "ci_high": round(float(hi), 4), "std": round(float(np.std(boot[k])), 4),
                 "n": len(boot[k])})

os.makedirs(os.path.dirname(OUT_CSV), exist_ok=True)
out = pd.DataFrame(rows)
out.to_csv(OUT_CSV, index=False)
print("\nSaved:", OUT_CSV)
print(out.to_string(index=False))

elapsed = time.time() - T0
print(f"Elapsed time: {elapsed/60:.1f} min ({elapsed:.0f} s)")
