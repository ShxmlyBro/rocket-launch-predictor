"""Tests for GET /api/v1/upcoming. All external calls are mocked, no network."""
from datetime import datetime, timedelta, timezone

import pytest

import upcoming_service as u

WEATHER = {"temp_mean": 20.0, "precipitation": 1.0, "max_wind_speed": 15.0}


def _launch(name, days, pad="Space Launch Complex 40",
            loc="Cape Canaveral SFS, FL, USA", rocket="Soyuz 2.1b", provider="Roscosmos"):
    net = datetime.now(timezone.utc) + timedelta(days=days)
    return {
        "name": name,
        "net": net.isoformat().replace("+00:00", "Z"),
        "pad": {"name": pad, "latitude": "28.5", "longitude": "-80.5",
                "location": {"name": loc}},
        "rocket": {"configuration": {"full_name": rocket}},
        "launch_service_provider": {"name": provider},
    }


@pytest.fixture(autouse=True)
def fresh_cache():
    u.clear_cache()
    yield
    u.clear_cache()


@pytest.fixture
def mock_apis(monkeypatch):
    calls = {"ll2": 0, "weather": 0}
    state = {"launches": [_launch("In range", 3), _launch("Too far", 30)],
             "weather": WEATHER}

    def fake_launches():
        calls["ll2"] += 1
        return state["launches"]

    def fake_weather(lat, lon, day):
        calls["weather"] += 1
        return state["weather"]

    monkeypatch.setattr(u, "fetch_launches", fake_launches)
    monkeypatch.setattr(u, "fetch_weather", fake_weather)
    return calls, state


def test_happy_path_filters_to_14_days(client, mock_apis):
    body = client.get("/api/v1/upcoming").json()
    assert body["stale"] is False
    assert "not a safety tool" in body["note"]
    assert [l["mission"] for l in body["launches"]] == ["In range"]
    launch = body["launches"][0]
    for key in ("rocket", "provider", "pad", "net", "weather", "risk_score",
                "threshold", "above_threshold", "verdict", "match_quality", "reasons"):
        assert key in launch
    assert 0.0 <= launch["risk_score"] <= 1.0
    assert launch["weather"] == WEATHER


def test_limited_match_has_null_threshold_call(client, mock_apis):
    launch = client.get("/api/v1/upcoming").json()["launches"][0]
    assert launch["match_quality"] == "limited"
    assert launch["above_threshold"] is None
    assert launch["verdict"] == "low confidence"
    assert launch["risk_score"] is not None  # kept for display only


def test_reasons_explain_unmatched_parts(client, mock_apis):
    launch = client.get("/api/v1/upcoming").json()["launches"][0]
    assert launch["match_quality"] == "limited"
    text = " | ".join(launch["reasons"])
    assert "vehicle: approximate match" in text  # Soyuz 2.1b -> Soyuz-U
    assert "agency: 'Roscosmos' is not mapped" in text  # deliberately unmapped
    assert "site: 'CC'" not in text  # CC is a frequent category


def test_known_frequent_categories_are_full(client, mock_apis, monkeypatch):
    calls, state = mock_apis
    svc = client.app.state.service
    # Pretend the encoder saw nothing as infrequent, to exercise the "full" path.
    monkeypatch.setattr(svc, "_infrequent_cache", {c: set() for c in svc.cat_cols},
                        raising=False)
    state["launches"] = [_launch("Full", 2, rocket="Falcon 9 Block 5", provider="SpaceX")]
    launch = client.get("/api/v1/upcoming").json()["launches"][0]
    assert launch["match_quality"] == "full"
    assert launch["reasons"] == []
    assert isinstance(launch["above_threshold"], bool)
    assert launch["verdict"] in ("above threshold", "below threshold")


def test_infrequent_category_is_limited(client, mock_apis):
    client.app.state.service._infrequent_cache = None  # use the real fitted encoder
    _, state = mock_apis
    state["launches"] = [_launch("Rare", 2, rocket="Falcon 9 Block 5", provider="SpaceX")]
    body = client.get("/api/v1/upcoming").json()["launches"][0]
    assert body["match_quality"] == "limited"
    assert any("rare in training data" in r for r in body["reasons"])


def test_kept_encoder_categories_give_full_match(client, monkeypatch):
    """A site, vehicle and agency the encoder keeps (not infrequent) must be 'full'.

    The encoder stores no counts, so 'most frequent' is taken as the first kept
    category per column from the fitted OneHotEncoder.
    """
    svc = client.app.state.service
    svc._infrequent_cache = None  # use the real fitted encoder
    enc = svc.model.named_steps["prep"].named_transformers_["cat"]
    kept = {}
    for col, cats, inf in zip(svc.cat_cols, enc.categories_, enc.infrequent_categories_):
        inf = set(inf) if inf is not None else set()
        kept[col] = next(c for c in cats if c not in inf)

    monkeypatch.setattr(u, "SITE_RULES", [("kept site", kept["Launch_Site"])])
    monkeypatch.setattr(u, "VEHICLE_RULES", [("kept rocket", kept["LV_Type"], False)])
    monkeypatch.setattr(u, "AGENCY_RULES", [("kept agency", kept["Agency"])])
    launch = _launch("Kept", 2, pad="Kept Site", loc="Kept Site",
                     rocket="Kept Rocket", provider="Kept Agency")
    out = u._score(svc, launch, WEATHER)
    assert out["match_quality"] == "full"
    assert out["reasons"] == []
    assert isinstance(out["above_threshold"], bool)


def test_cache_hit_and_expiry(client, mock_apis, monkeypatch):
    calls, _ = mock_apis
    clock = {"t": 1000.0}
    monkeypatch.setattr(u, "_now", lambda: clock["t"])
    client.get("/api/v1/upcoming")
    client.get("/api/v1/upcoming")
    assert calls["ll2"] == 1
    clock["t"] += 29 * 60
    client.get("/api/v1/upcoming")
    assert calls["ll2"] == 1
    clock["t"] += 2 * 60  # past 30 minutes
    client.get("/api/v1/upcoming")
    assert calls["ll2"] == 2


@pytest.mark.parametrize("message", ["Launch Library rate limited (429)", "timeout"])
def test_ll2_failure_serves_snapshot(client, monkeypatch, message):
    def boom():
        raise u.UpstreamError(message)

    monkeypatch.setattr(u, "fetch_launches", boom)
    body = client.get("/api/v1/upcoming").json()
    assert body["stale"] is True
    assert len(body["launches"]) >= 1
    assert "not a safety tool" in body["note"]


def test_snapshot_file_is_flagged_sample():
    import json
    data = json.loads(u.SAMPLE_PATH.read_text(encoding="utf-8"))
    assert data["_note"] == "sample data"


def test_real_429_maps_to_upstream_error(monkeypatch):
    class Resp:
        status_code = 429

    monkeypatch.setattr(u.httpx, "get", lambda *a, **k: Resp())
    with pytest.raises(u.UpstreamError):
        u.fetch_launches()


def test_weather_failure_keeps_launch_unscored(client, mock_apis):
    _, state = mock_apis
    state["weather"] = None
    launch = client.get("/api/v1/upcoming").json()["launches"][0]
    assert launch["risk_score"] is None
    assert launch["above_threshold"] is None
    assert launch["verdict"] == "low confidence"
    assert launch["match_quality"] == "limited"
    assert any(r.startswith("weather:") for r in launch["reasons"])


def test_api_key_header_only_when_set(monkeypatch):
    seen = {}

    class Resp:
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            return {"results": []}

    def fake_get(url, params=None, headers=None, timeout=None):
        seen["headers"] = headers
        return Resp()

    monkeypatch.setattr(u.httpx, "get", fake_get)
    monkeypatch.delenv("LL2_API_KEY", raising=False)
    u.fetch_launches()
    assert "Authorization" not in seen["headers"]
    monkeypatch.setenv("LL2_API_KEY", "dummy-test-key")
    u.fetch_launches()
    assert seen["headers"]["Authorization"] == "Token dummy-test-key"


def test_key_never_appears_in_error(monkeypatch):
    monkeypatch.setenv("LL2_API_KEY", "dummy-test-key")

    def fake_get(*a, **k):
        raise RuntimeError(f"failed with {k['headers']['Authorization']}")

    monkeypatch.setattr(u.httpx, "get", fake_get)
    with pytest.raises(u.UpstreamError) as err:
        u.fetch_launches()
    assert "dummy-test-key" not in str(err.value)
