"""Upcoming launches: Launch Library 2 + Open-Meteo, scored with the saved model.

Cached in memory for 30 minutes. If Launch Library fails or returns 429, a bundled
sample snapshot is served with stale=True. The optional LL2_API_KEY is read from the
environment only and is never logged or returned.
"""
import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import httpx

from model_service import DISCLAIMER, ModelService
from space_cache import ll2_limiter, note_rate_limited

logger = logging.getLogger(__name__)

LL2_URL = "https://ll.thespacedevs.com/2.2.0/launch/upcoming/"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
SAMPLE_PATH = Path(__file__).resolve().parent / "data" / "upcoming_sample.json"

LIMIT = 10
HORIZON_DAYS = 14
CACHE_TTL = 30 * 60
FALLBACK_TTL = 60  # short, so a failing upstream is not hammered on every request
TIMEOUT = 8.0
LOW_CONFIDENCE = "low confidence"

# (substring of lowercase LL2 text, GCAT code). First match wins. Anything not listed
# is deliberately left unmapped (e.g. Starbase, Xichang, Plesetsk, Baikonur, Roscosmos).
SITE_RULES = [
    ("cape canaveral", "CC"),
    ("kennedy", "CC"),
    ("vandenberg", "VS"),
    ("wallops", "WI"),
    ("kourou", "CSG"),
    ("guiana", "CSG"),
    ("tanegashima", "TNSC"),
    ("sriharikota", "SHAR"),
    ("satish dhawan", "SHAR"),
    ("mahia", "MAHIA"),
    ("jiuquan", "JQ"),
    ("taiyuan", "TYSC"),
    ("wenchang", "WC"),
]
# Site rules whose GCAT code is only a nearby site, so the response carries a note.
APPROXIMATED_SITE_KEYS = {"kennedy", "vandenberg"}
# (substring, GCAT code, approximate?)
VEHICLE_RULES = [
    ("falcon 9", "Falcon 9", False),
    ("electron", "Electron", False),
    ("starship", "Starship V1.0 Ship", True),
    ("new glenn", "New Glenn 7x2", False),
    ("ariane 5", "Ariane 5ECA", False),
    ("soyuz", "Soyuz-U", True),
]
AGENCY_RULES = [
    ("spacex", "SPX"),
    ("indian space research", "ISRO"),
    ("isro", "ISRO"),
    ("centre national d'etudes spatiales", "CNES"),
    ("cnes", "CNES"),
]

_cache: dict = {"ts": None, "payload": None}


class UpstreamError(Exception):
    """Launch Library could not be used (network error, 429 or bad response)."""


def _now() -> float:
    return time.monotonic()


def _lookup(rules, text: str):
    low = (text or "").lower()
    for rule in rules:
        if rule[0] in low:
            return rule[1:]
    return None


def fetch_launches() -> list:
    headers = {}
    key = os.getenv("LL2_API_KEY")
    if key:
        headers["Authorization"] = f"Token {key}"
    # Shared with the /space endpoints: one hourly cap and one Retry-After for all LL2.
    if not ll2_limiter.acquire():
        raise UpstreamError("Launch Library call skipped (hourly cap or Retry-After)")
    try:
        resp = httpx.get(
            LL2_URL,
            params={"limit": LIMIT, "mode": "detailed"},
            headers=headers,
            timeout=TIMEOUT,
        )
        if resp.status_code == 429:
            note_rate_limited(resp.headers)
            raise UpstreamError("Launch Library rate limited (429)")
        resp.raise_for_status()
        return resp.json()["results"]
    except UpstreamError:
        raise
    except Exception as exc:  # log the type only, never headers or the key
        raise UpstreamError(f"Launch Library failed: {type(exc).__name__}") from None


def fetch_weather(lat: float, lon: float, day: str) -> Optional[dict]:
    """Daily forecast for one date, or None if unavailable.

    wind_speed_unit=kmh matches the training data: scripts/ingest_data.py (since
    removed, see git d6ffd26^) set no unit, so Open-Meteo's km/h default applied.
    Do not change it without retraining.
    """
    try:
        resp = httpx.get(
            OPEN_METEO_URL,
            params={
                "latitude": lat,
                "longitude": lon,
                "daily": "temperature_2m_mean,precipitation_sum,wind_speed_10m_max",
                "wind_speed_unit": "kmh",
                "timezone": "UTC",
                "start_date": day,
                "end_date": day,
            },
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        daily = resp.json()["daily"]
        values = {
            "temp_mean": daily["temperature_2m_mean"][0],
            "precipitation": daily["precipitation_sum"][0],
            "max_wind_speed": daily["wind_speed_10m_max"][0],
        }
        if any(v is None for v in values.values()):
            return None
        return values
    except Exception as exc:
        logger.warning("Open-Meteo failed: %s", type(exc).__name__)
        return None


def _infrequent(service: ModelService) -> dict:
    """Per column, categories the fitted OneHotEncoder grouped as infrequent."""
    cached = getattr(service, "_infrequent_cache", None)
    if cached is not None:
        return cached
    result = {col: set() for col in service.cat_cols}
    try:
        enc = service.model.named_steps["prep"].named_transformers_["cat"]
        for col, inf in zip(service.cat_cols, enc.infrequent_categories_):
            result[col] = set(inf) if inf is not None else set()
    except Exception as exc:
        logger.warning("Could not read infrequent categories: %s", type(exc).__name__)
    service._infrequent_cache = result
    return result


def _match(service: ModelService, col: str, raw: str, mapped: Optional[str],
           approximate: bool, label: str):
    """Returns (value to feed the model, list of reasons it is not a full match)."""
    if mapped is None:
        return raw, [f"{label}: '{raw}' is not mapped to a model category"]
    reasons = []
    if approximate:
        reasons.append(f"{label}: approximate match ('{raw}' -> '{mapped}')")
    if mapped not in set(service.known_categories.get(col, [])):
        reasons.append(f"{label}: '{mapped}' is not in the model's known categories")
    elif mapped in _infrequent(service).get(col, set()):
        reasons.append(
            f"{label}: '{mapped}' is rare in training data (grouped as infrequent)"
        )
    return mapped, reasons


def _score(service: ModelService, launch: dict, weather: Optional[dict]) -> dict:
    pad = launch.get("pad") or {}
    location = (pad.get("location") or {}).get("name", "")
    rocket = ((launch.get("rocket") or {}).get("configuration") or {})
    rocket_name = rocket.get("full_name") or rocket.get("name") or ""
    provider = (launch.get("launch_service_provider") or {}).get("name", "")

    site_hit = _lookup(SITE_RULES, f"{pad.get('name', '')} {location}")
    veh_hit = _lookup(VEHICLE_RULES, rocket_name)
    ag_hit = _lookup(AGENCY_RULES, provider)

    site_text = f"{pad.get('name', '')} {location}".lower()
    matched_key = next((r[0] for r in SITE_RULES if r[0] in site_text), None)
    notes = (["site approximated from pad name"]
             if matched_key in APPROXIMATED_SITE_KEYS else [])

    reasons = []
    values = {}
    for col, raw, hit, label in (
        ("Launch_Site", location or pad.get("name", ""), site_hit, "site"),
        ("LV_Type", rocket_name, veh_hit, "vehicle"),
        ("Agency", provider, ag_hit, "agency"),
    ):
        mapped = hit[0] if hit else None
        approx = bool(hit and len(hit) > 1 and hit[1])
        value, found = _match(service, col, raw, mapped, approx, label)
        values[col] = value
        reasons.extend(found)

    out = {
        "mission": launch.get("name", ""),
        "rocket": rocket_name,
        "provider": provider,
        "pad": f"{pad.get('name', '')}, {location}".strip(", "),
        "net": launch.get("net"),
        "weather": weather,
        "risk_score": None,
        "threshold": service.threshold,
        "above_threshold": None,
        "verdict": LOW_CONFIDENCE,
        "match_quality": "limited" if reasons else "full",
        "reasons": reasons,
        "notes": notes,
    }
    if weather is None:
        out["match_quality"] = "limited"
        out["reasons"].append("weather: forecast unavailable, launch not scored")
        return out
    pred = service.predict({
        "launch_site": values["Launch_Site"],
        "lv_type": values["LV_Type"],
        "agency": values["Agency"],
        **weather,
    })
    out["risk_score"] = pred["risk_probability"]  # always kept, for display only
    if out["match_quality"] == "full":
        # Only a full match earns a threshold call. Limited matches stay null.
        out["above_threshold"] = pred["above_threshold"]
        out["verdict"] = "above threshold" if pred["above_threshold"] else "below threshold"
    return out


def _live(service: ModelService) -> dict:
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=HORIZON_DAYS)
    launches = []
    for launch in fetch_launches():
        try:
            net = datetime.fromisoformat(launch["net"].replace("Z", "+00:00"))
        except (KeyError, AttributeError, ValueError):
            continue
        if not (now - timedelta(hours=6) <= net <= cutoff):
            continue
        pad = launch.get("pad") or {}
        try:
            lat, lon = float(pad["latitude"]), float(pad["longitude"])
            weather = fetch_weather(lat, lon, net.date().isoformat())
        except (KeyError, TypeError, ValueError):
            weather = None
        launches.append(_score(service, launch, weather))
    return {"stale": False, "as_of": now.isoformat(), "launches": launches}


def _snapshot() -> dict:
    with open(SAMPLE_PATH, encoding="utf-8") as f:
        data = json.load(f)
    data["stale"] = True  # always, whenever the snapshot is served
    return data


def get_upcoming(service: ModelService) -> dict:
    ts = _cache["ts"]
    if ts is not None and _now() - ts < _cache["ttl"]:
        return _cache["payload"]
    try:
        payload, ttl = _live(service), CACHE_TTL
    except UpstreamError as exc:
        logger.warning("Serving sample snapshot: %s", exc)
        payload, ttl = _snapshot(), FALLBACK_TTL
    _cache.update(ts=_now(), ttl=ttl, payload=payload)
    payload["note"] = DISCLAIMER
    return payload


def clear_cache() -> None:
    _cache.update(ts=None, ttl=0, payload=None)
