import json
from pathlib import Path

import pytest

METADATA = Path(__file__).resolve().parents[1] / "model" / "metadata.json"

VALID = {
    "launch_site": "CC",
    "lv_type": "Atlas V",
    "agency": "NASA",
    "temp_mean": 20.0,
    "precipitation": 1.0,
    "max_wind_speed": 15.0,
}


def test_health(client):
    for path in ("/health", "/api/v1/health"):
        r = client.get(path)
        assert r.status_code == 200
        assert r.json() == {"status": "ok", "model_loaded": True}


def test_features(client):
    r = client.get("/api/v1/features")
    assert r.status_code == 200
    data = r.json()
    assert set(data["numeric_ranges"]) == {"temp_mean", "precipitation", "max_wind_speed"}
    assert len(data["categories"]) == 3
    for values in data["categories"].values():
        assert isinstance(values, list) and values


def test_eda_stats(client):
    r = client.get("/api/v1/eda-stats")
    assert r.status_code == 200
    data = r.json()
    expected = json.loads(METADATA.read_text(encoding="utf-8"))["eda_stats"]["total_records"]
    assert data["eda_stats"]["total_records"] == expected
    assert "LV_Type" in data["feature_importance_by_variable"]
    assert data["top_encoded_features"]
    meta_metrics = json.loads(METADATA.read_text(encoding="utf-8"))["metrics"]
    assert data["metrics"] == meta_metrics
    assert data["metrics"]["Precision"] > 0


def test_predict_valid(client):
    r = client.post("/api/v1/predict", json=VALID)
    assert r.status_code == 200
    data = r.json()
    assert 0.0 <= data["risk_probability"] <= 1.0
    assert isinstance(data["above_threshold"], bool)
    assert data["threshold"] == pytest.approx(client.app.state.service.threshold)
    assert "not a safety tool" in data["note"]


def test_predict_unknown_categories(client):
    body = {
        **VALID,
        "launch_site": "ZZZ-NOT-A-SITE",
        "lv_type": "Imaginary Rocket 9000",
        "agency": "NOT-AN-AGENCY",
    }
    r = client.post("/api/v1/predict", json=body)
    assert r.status_code == 200
    assert 0.0 <= r.json()["risk_probability"] <= 1.0


def test_predict_missing_field(client):
    body = {k: v for k, v in VALID.items() if k != "agency"}
    assert client.post("/api/v1/predict", json=body).status_code == 422


def test_predict_wrong_type(client):
    assert client.post("/api/v1/predict", json={**VALID, "temp_mean": "hot"}).status_code == 422


@pytest.mark.parametrize(
    "field,value",
    [("max_wind_speed", -1), ("precipitation", 5000), ("temp_mean", 500)],
)
def test_predict_out_of_range(client, field, value):
    assert client.post("/api/v1/predict", json={**VALID, field: value}).status_code == 422
