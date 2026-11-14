"""Shared plumbing for the /space endpoints and /upcoming.

- RateLimiter: one sliding-window limiter shared by every Launch Library 2 call.
- SpaceCache: stale-while-revalidate cache. A visitor request never waits on an
  external call: it gets cached data, or the bundled snapshot (stale=True), and an
  expired entry is refreshed in a background thread.
"""
import json
import logging
import threading
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent / "data"
LL2_MAX_PER_HOUR = 8  # LL2 free tier allows 15/hour, shared with /upcoming
DEFAULT_RETRY_AFTER = 600.0
MAX_RETRY_AFTER = 6 * 3600.0
FAILURE_BACKOFF = 60.0  # wait before retrying a failed refresh


class UpstreamError(Exception):
    """An external API could not be used (network error, 429, limiter, bad body)."""


def _now() -> float:
    return time.monotonic()


class RateLimiter:
    def __init__(self, max_calls: int, window: float = 3600.0):
        self.max_calls = max_calls
        self.window = window
        self._calls: deque = deque()
        self._blocked_until = 0.0
        self._lock = threading.Lock()

    def acquire(self) -> bool:
        """Take one slot. False if the cap is reached or a Retry-After is active."""
        with self._lock:
            now = _now()
            if now < self._blocked_until:
                return False
            while self._calls and now - self._calls[0] >= self.window:
                self._calls.popleft()
            if len(self._calls) >= self.max_calls:
                return False
            self._calls.append(now)
            return True

    def block_for(self, seconds: float) -> None:
        with self._lock:
            self._blocked_until = max(self._blocked_until, _now() + seconds)

    def reset(self) -> None:
        with self._lock:
            self._calls.clear()
            self._blocked_until = 0.0


# One limiter for all LL2 calls (the /space endpoints and /upcoming).
ll2_limiter = RateLimiter(LL2_MAX_PER_HOUR)


def parse_retry_after(value: Optional[str]) -> float:
    try:
        seconds = float(value)
    except (TypeError, ValueError):
        return DEFAULT_RETRY_AFTER
    return min(max(seconds, 1.0), MAX_RETRY_AFTER)


def note_rate_limited(headers) -> None:
    """Call on an LL2 429: honor Retry-After for every later LL2 call."""
    ll2_limiter.block_for(parse_retry_after(headers.get("Retry-After")))


def load_snapshot(filename: str) -> dict:
    with open(DATA_DIR / filename, encoding="utf-8") as f:
        data = json.load(f)
    data["stale"] = True  # always, whenever a snapshot is served
    return data


def _spawn_thread(fn: Callable[[], None]) -> None:
    threading.Thread(target=fn, daemon=True).start()


class SpaceCache:
    def __init__(self):
        self._lock = threading.Lock()
        self._entries: dict = {}
        self._spawn = _spawn_thread  # tests replace this to run refreshes inline

    def get(self, key: str, ttl: float, fetch: Callable[[], dict], snapshot: str) -> dict:
        """Return cached or snapshot data at once; refresh in the background if due.

        fetch() returns the resource body, e.g. {"items": [...]}.
        """
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                entry = {"payload": load_snapshot(snapshot), "ts": None,
                         "next_try": 0.0, "refreshing": False}
                self._entries[key] = entry
            now = _now()
            expired = entry["ts"] is None or now - entry["ts"] >= ttl
            due = expired and now >= entry["next_try"] and not entry["refreshing"]
            if due:
                entry["refreshing"] = True
            payload = entry["payload"]
        if due:
            self._spawn(lambda: self._refresh(key, fetch))
        return payload

    def _refresh(self, key: str, fetch: Callable[[], dict]) -> None:
        entry = self._entries[key]
        try:
            body = fetch()
            payload = {"stale": False, "as_of": datetime.now(timezone.utc).isoformat(),
                       **body}
            with self._lock:
                entry.update(payload=payload, ts=_now(), next_try=0.0)
        except Exception as exc:  # type only: never log headers or the API key
            logger.warning("Refresh of %s failed: %s", key, type(exc).__name__)
            with self._lock:
                entry["next_try"] = _now() + FAILURE_BACKOFF
        finally:
            with self._lock:
                entry["refreshing"] = False

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()


cache = SpaceCache()
