"""Build backend/model/score_reference.json from the HELD-OUT TEST SET only.

Run from backend/:  ../venv/bin/python scripts/make_score_reference.py

Reuses the data preparation, feature columns, target and stratified 80/20 split
(random_state=42) of scripts/modelling_v2.py on data/merged_gcat_meteo_v2.csv, loads
the saved model bundle (read only) and scores the test rows. Nothing is retrained and
no model or result file is modified.

Stops without writing anything if a sanity check fails or if the observed anomaly rate
is not non-decreasing across the 5 bands (it does not smooth the rates).
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

BACKEND = Path(__file__).resolve().parent.parent
REPO = BACKEND.parent
DATA_FILE = REPO / "data" / "merged_gcat_meteo_v2.csv"
MODEL_PATH = BACKEND / "model" / "rocket_model.joblib"
OUT_PATH = BACKEND / "model" / "score_reference.json"

RANDOM_STATE = 42
NUM_COLS = ["temp_mean", "precipitation", "max_wind_speed"]
CAT_COLS = ["Launch_Site", "LV_Type", "Agency"]
N_BANDS = 5
EXPECTED_TEST, EXPECTED_ANOM, EXPECTED_HITS = 3413, 242, 184


def fail(msg: str) -> None:
    print(f"STOP: {msg}")
    sys.exit(1)


# Same preparation as modelling_v2.py.
df = pd.read_csv(DATA_FILE, low_memory=False)
data = df.dropna(subset=NUM_COLS).copy()
for c in CAT_COLS:
    data[c] = data[c].astype(str).fillna("Unknown")
data["target"] = data["FailCode"].notna().astype(int)

X = data[NUM_COLS + CAT_COLS]
y = data["target"]
_, X_test, _, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE)

bundle = joblib.load(MODEL_PATH)
threshold = float(bundle["threshold"])
frame = X_test[bundle["cat_cols"] + bundle["num_cols"]]
scores = bundle["model"].predict_proba(frame)[:, 1]
y_arr = y_test.to_numpy()

n_test, n_anom = len(y_arr), int(y_arr.sum())
hits = int(((scores >= threshold) & (y_arr == 1)).sum())
recall = hits / n_anom if n_anom else float("nan")
print(f"test size {n_test} (expect {EXPECTED_TEST}), anomalies {n_anom} (expect {EXPECTED_ANOM}), "
      f"recall at {threshold:.3f}: {hits}/{n_anom} = {recall:.3f} (expect {EXPECTED_HITS}/{EXPECTED_ANOM} = 0.760)")
if n_test != EXPECTED_TEST:
    fail(f"test size is {n_test}, expected {EXPECTED_TEST}")
if n_anom != EXPECTED_ANOM:
    fail(f"anomalies are {n_anom}, expected {EXPECTED_ANOM}")
if abs(recall - 0.760) > 0.005 or hits != EXPECTED_HITS:
    fail(f"recall at the bundle threshold is {hits}/{n_anom} = {recall:.3f}, expected 184/242 = 0.760")
print("Sanity checks passed.")

quantiles = [float(v) for v in np.quantile(scores, np.linspace(0, 1, 101))]

# 5 equal-count bands by score quantile; the last band includes the maximum.
edges = [float(v) for v in np.quantile(scores, np.linspace(0, 1, N_BANDS + 1))]
bands = []
for i in range(N_BANDS):
    lo, hi = edges[i], edges[i + 1]
    last = i == N_BANDS - 1
    mask = (scores >= lo) & ((scores <= hi) if last else (scores < hi))
    n = int(mask.sum())
    anom = int(y_arr[mask].sum())
    bands.append({"lower": lo, "upper": hi, "n": n, "anomalies": anom,
                  "observed_rate": anom / n if n else None})

print(f"\n{'band':>4} {'lower':>9} {'upper':>9} {'n':>6} {'anomalies':>9} {'observed_rate':>13}")
for i, b in enumerate(bands, 1):
    print(f"{i:>4} {b['lower']:>9.4f} {b['upper']:>9.4f} {b['n']:>6} {b['anomalies']:>9} {b['observed_rate']:>13.4f}")
if sum(b["n"] for b in bands) != n_test:
    fail("band sizes do not add up to the test size (check for ties at the edges)")

rates = [b["observed_rate"] for b in bands]
if any(later < earlier for earlier, later in zip(rates, rates[1:])):
    fail("observed rates are NOT non-decreasing across the bands. Nothing was written and the "
         "rates were not smoothed. Decide how to proceed.")

reference = {
    "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "n_test": n_test,
    "n_anomalies": n_anom,
    "threshold": threshold,
    "quantiles": quantiles,
    "bands": bands,
}
OUT_PATH.write_text(json.dumps(reference, indent=2), encoding="utf-8")
print(f"\nWrote {OUT_PATH}")
