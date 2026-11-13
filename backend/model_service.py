"""Loads the trained model bundle once and runs predictions."""
import json
from pathlib import Path

import joblib
import pandas as pd

MODEL_DIR = Path(__file__).resolve().parent / "model"
MODEL_PATH = MODEL_DIR / "rocket_model.joblib"
METADATA_PATH = MODEL_DIR / "metadata.json"

# Plausible daily-weather bounds used for input validation and the form.
NUMERIC_RANGES = {
    "temp_mean": {"min": -90.0, "max": 60.0, "unit": "C"},
    "precipitation": {"min": 0.0, "max": 1000.0, "unit": "mm"},
    "max_wind_speed": {"min": 0.0, "max": 300.0, "unit": "km/h"},
}

DISCLAIMER = (
    "This is a rough statistical estimate from historical data, not a safety tool. "
    "Weather adds little signal to the model."
)


class ModelService:
    def __init__(self, bundle: dict, metadata: dict):
        self.model = bundle["model"]
        self.threshold = float(bundle["threshold"])
        self.num_cols = list(bundle["num_cols"])
        self.cat_cols = list(bundle["cat_cols"])
        self.known_categories = bundle["known_categories"]
        self.metadata = metadata

    def predict(self, values: dict) -> dict:
        """values: request fields keyed by lowercase column name."""
        lowered = {k.lower(): v for k, v in values.items()}
        row = {col: lowered[col.lower()] for col in self.cat_cols + self.num_cols}
        frame = pd.DataFrame([row], columns=self.cat_cols + self.num_cols)
        probability = float(self.model.predict_proba(frame)[0, 1])
        above = probability >= self.threshold
        if above:
            note = (
                "Estimated risk is above the model's alert threshold, so this launch "
                "profile resembles past anomalies more than typical launches. "
            )
        else:
            note = "Estimated risk is below the model's alert threshold. "
        return {
            "risk_probability": round(probability, 4),
            "above_threshold": above,
            "threshold": self.threshold,
            "note": note + DISCLAIMER,
        }


def load_service() -> ModelService:
    bundle = joblib.load(MODEL_PATH)
    with open(METADATA_PATH, encoding="utf-8") as f:
        metadata = json.load(f)
    return ModelService(bundle, metadata)
