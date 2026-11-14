"""Read-only space data: astronauts, events, missions (Launch Library 2), news
(Spaceflight News API v4) and the ISS position (wheretheiss.at).

Every function here returns at once from the cache or a bundled snapshot. Upstream
calls happen only in background refreshes. All LL2 calls go through the shared
limiter in space_cache. The optional LL2_API_KEY comes from the environment and is
never logged or returned.
"""
import logging
import os
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from space_cache import UpstreamError, cache, ll2_limiter, note_rate_limited

LL2_BASE = "https://ll.thespacedevs.com/2.2.0/"
NEWS_URL = "https://api.spaceflightnewsapi.net/v4/articles/"
ISS_URL = "https://api.wheretheiss.at/v1/satellites/25544"
TIMEOUT = 10.0

TTL_ASTRONAUTS = 24 * 3600
TTL_EVENTS = 3 * 3600
TTL_MISSIONS = 6 * 3600
TTL_NEWS = 30 * 60
TTL_ISS = 10

BIO_CHARS = 300
DESC_CHARS = 300
SUMMARY_CHARS = 240
EVENT_LOOKBACK_DAYS = 14


def snippet(text: Optional[str], limit: int) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[: limit - 3].rstrip() + "..."


def _name(obj) -> Optional[str]:
    return obj.get("name") if isinstance(obj, dict) else None


def ll2_get(path: str, params: dict) -> dict:
    if not ll2_limiter.acquire():
        raise UpstreamError("Launch Library call skipped (hourly cap or Retry-After)")
    headers = {}
    key = os.getenv("LL2_API_KEY")
    if key:
        headers["Authorization"] = f"Token {key}"
    try:
        resp = httpx.get(LL2_BASE + path, params=params, headers=headers, timeout=TIMEOUT)
        if resp.status_code == 429:
            note_rate_limited(resp.headers)
            raise UpstreamError("Launch Library rate limited (429)")
        resp.raise_for_status()
        return resp.json()
    except UpstreamError:
        raise
    except Exception as exc:
        raise UpstreamError(f"Launch Library failed: {type(exc).__name__}") from None


def _get_json(url: str, params: Optional[dict] = None) -> dict:
    try:
        resp = httpx.get(url, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        raise UpstreamError(f"Request failed: {type(exc).__name__}") from None


# Trimmers: keep only the fields the frontend needs.

def trim_astronaut(a: dict) -> dict:
    return {
        "name": a.get("name"),
        "nationality": a.get("nationality"),
        "agency": _name(a.get("agency")),
        "status": _name(a.get("status")),
        "image_url": a.get("profile_image"),
        "bio": snippet(a.get("bio"), BIO_CHARS),
    }


def _first_url(event: dict) -> Optional[str]:
    for item in event.get("info_urls") or []:
        url = item.get("url") if isinstance(item, dict) else item
        if url:
            return url
    return event.get("news_url")


def trim_event(e: dict) -> dict:
    return {
        "name": e.get("name"),
        "type": _name(e.get("type")),
        "date": e.get("date"),
        "description": snippet(e.get("description"), DESC_CHARS),
        "agencies": [n for n in (_name(x) for x in e.get("agencies") or []) if n],
        "info_url": _first_url(e),
    }


def trim_mission(m: dict) -> dict:
    rocket = (m.get("rocket") or {}).get("configuration") or {}
    return {
        "name": m.get("name"),
        "date": m.get("net"),
        "status": _name(m.get("status")),
        "mission_description": snippet((m.get("mission") or {}).get("description"),
                                       DESC_CHARS),
        "rocket": rocket.get("full_name") or rocket.get("name"),
        "provider": _name(m.get("launch_service_provider")),
    }


def trim_article(a: dict) -> dict:
    return {
        "title": a.get("title"),
        "source": a.get("news_site"),
        "published_at": a.get("published_at"),
        "summary": snippet(a.get("summary"), SUMMARY_CHARS),
        "url": a.get("url"),
    }


def trim_iss(d: dict) -> dict:
    return {k: d.get(k) for k in
            ("latitude", "longitude", "altitude", "velocity", "visibility", "timestamp")}


# Fetchers (run only in background refreshes).

def fetch_astronauts() -> dict:
    data = ll2_get("astronaut/", {"limit": 50, "ordering": "name"})
    return {"items": [trim_astronaut(a) for a in data["results"]]}


def fetch_events() -> dict:
    since = (datetime.now(timezone.utc) - timedelta(days=EVENT_LOOKBACK_DAYS)).date()
    data = ll2_get("event/", {"limit": 20, "ordering": "date",
                              "date__gte": since.isoformat()})
    return {"items": [trim_event(e) for e in data["results"]]}


def fetch_missions() -> dict:
    data = ll2_get("launch/previous/", {"limit": 15})
    return {"items": [trim_mission(m) for m in data["results"]]}


def fetch_news() -> dict:
    data = _get_json(NEWS_URL, {"limit": 15, "ordering": "-published_at"})
    return {"items": [trim_article(a) for a in data["results"]]}


def fetch_iss() -> dict:
    return {"data": trim_iss(_get_json(ISS_URL))}


def get_astronauts() -> dict:
    return cache.get("astronauts", TTL_ASTRONAUTS, fetch_astronauts, "space_astronauts.json")


def get_events() -> dict:
    return cache.get("events", TTL_EVENTS, fetch_events, "space_events.json")


def get_missions() -> dict:
    return cache.get("missions", TTL_MISSIONS, fetch_missions, "space_missions.json")


def get_news() -> dict:
    return cache.get("news", TTL_NEWS, fetch_news, "space_news.json")


def get_iss() -> dict:
    return cache.get("iss", TTL_ISS, fetch_iss, "space_iss.json")


# Startup warm-up -------------------------------------------------------------

WARMUP_GAP_SECONDS = 30.0
_log = logging.getLogger(__name__)


def warm_up(stop: threading.Event, gap: float = WARMUP_GAP_SECONDS) -> None:
    """Fill the cache so the first visitors do not see sample data.

    News and the ISS position go first (no LL2 limiter involved), then astronauts,
    events and missions one at a time, `gap` seconds apart. Every call uses the same
    fetch functions, limiter and cache refresh as a normal request. A refused limiter
    or failed call keeps the snapshot (stale=True), is logged by the cache, and is
    not retried.
    """
    steps = (
        ("news", TTL_NEWS, fetch_news, "space_news.json"),
        ("iss", TTL_ISS, fetch_iss, "space_iss.json"),
        ("astronauts", TTL_ASTRONAUTS, fetch_astronauts, "space_astronauts.json"),
        ("events", TTL_EVENTS, fetch_events, "space_events.json"),
        ("missions", TTL_MISSIONS, fetch_missions, "space_missions.json"),
    )
    for i, (key, ttl, fetch, snapshot) in enumerate(steps):
        if stop.is_set():
            return
        cache.prime(key, ttl, fetch, snapshot)
        # No pause around the two non-LL2 calls, 30 s between the LL2 calls.
        if 2 <= i < len(steps) - 1 and stop.wait(gap):
            return


def start_warmup(stop: threading.Event):
    """Start the warm-up in a daemon thread. Returns the thread, or None if disabled."""
    if os.getenv("SPACE_WARMUP") == "0":
        _log.info("Space cache warm-up skipped (SPACE_WARMUP=0)")
        return None
    t = threading.Thread(target=warm_up, args=(stop,), name="space-warmup", daemon=True)
    t.start()
    return t
