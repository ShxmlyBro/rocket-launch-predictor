import json

import numpy as np
import pytest

from model_service import ModelService
from score_reference import EMPTY, ScoreReference, load_reference

# 101 evenly spaced scores from 0.0 to 1.0, and 5 bands over [0, 1].
QUANTILES = [i / 100 for i in range(101)]
BANDS = [
    {"lower": 0.0, "upper": 0.2, "n": 100, "anomalies": 1, "observed_rate": 0.01},
    {"lower": 0.2, "upper": 0.4, "n": 100, "anomalies": 3, "observed_rate": 0.03},
    {"lower": 0.4, "upper": 0.6, "n": 100, "anomalies": 5, "observed_rate": 0.05},
    {"lower": 0.6, "upper": 0.8, "n": 100, "anomalies": 8, "observed_rate": 0.08},
    {"lower": 0.8, "upper": 1.0, "n": 101, "anomalies": 20, "observed_rate": 0.2},
]


@pytest.fixture
def ref():
    return ScoreReference({"quantiles": QUANTILES, "bands": BANDS, "n_test": 501})


def test_band_lookup_inside_range(ref):
    assert ref.band(0.05)["observed_rate"] == 0.01
    assert ref.band(0.2)["observed_rate"] == 0.03  # an edge belongs to the upper band
    assert ref.band(0.59)["observed_rate"] == 0.05
    assert ref.band(0.95)["observed_rate"] == 0.2
    assert ref.band(1.0)["observed_rate"] == 0.2  # the maximum is in the last band


def test_percentile_is_share_strictly_below(ref):
    assert ref.percentile(0.505) == 50
    assert ref.percentile(0.875) == 87
    assert ref.percentile(0.5) == 49  # a score equal to a quantile point is not below itself


def test_edge_values_below_min_and_above_max(ref):
    assert ref.percentile(-0.5) == 0
    assert ref.percentile(0.0) == 0
    assert ref.percentile(1.5) == 100
    assert ref.band(-0.5)["observed_rate"] == 0.01
    assert ref.band(7.0)["observed_rate"] == 0.2
    assert ref.lookup(7.0) == {"risk_percentile": 100, "similar_rate": 0.2, "similar_n": 101}


def test_lookup_has_no_probability_field(ref):
    assert "probability" not in ref.lookup(0.3)


def test_missing_file_gives_none(tmp_path):
    assert load_reference(tmp_path / "nope.json") is None


def test_unreadable_file_gives_none(tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text("{not json", encoding="utf-8")
    assert load_reference(bad) is None
    bad.write_text(json.dumps({"quantiles": []}), encoding="utf-8")
    assert load_reference(bad) is None


class _StubModel:
    def __init__(self, p):
        self.p = p

    def predict_proba(self, frame):
        return np.array([[1 - self.p, self.p]])


def _service(reference, p=0.3):
    bundle = {
        "model": _StubModel(p), "threshold": 0.226,
        "num_cols": ["temp_mean", "precipitation", "max_wind_speed"],
        "cat_cols": ["Launch_Site", "LV_Type", "Agency"],
        "known_categories": {},
    }
    return ModelService(bundle, {}, reference)


VALUES = {"launch_site": "a", "lv_type": "b", "agency": "c",
          "temp_mean": 1, "precipitation": 0, "max_wind_speed": 1}


def test_predict_adds_reading_fields_and_keeps_existing(ref):
    out = _service(ref).predict(VALUES)
    assert out["risk_probability"] == 0.3
    assert out["above_threshold"] is True
    assert out["risk_percentile"] == 29
    assert out["similar_rate"] == 0.03
    assert out["similar_n"] == 100
    assert "probability" not in out  # only the legacy risk_probability name exists


def test_predict_without_reference_has_null_fields():
    out = _service(None).predict(VALUES)
    assert {k: out[k] for k in EMPTY} == EMPTY
    assert out["risk_probability"] == 0.3
