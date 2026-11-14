"""Tests for /api/v1/space/*. Every external call is mocked."""
import httpx
import pytest

import space_cache
import space_service
from space_cache import RateLimiter, UpstreamError

LL2_ASTRONAUTS = {"results": [{
    "name": "Jane Doe", "nationality": "American", "agency": {"name": "NASA", "id": 1},
    "status": {"name": "Active"}, "profile_image": "http://img/x.jpg",
    "bio": "word " * 200, "extra": "dropped"}]}


class FakeResp:
    def __init__(self, status=200, body=None, headers=None):
        self.status_code = status
        self._body = body or {}
        self.headers = headers or {}

    def json(self):
        return self._body

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("err", request=None, response=None)


@pytest.fixture(autouse=True)
def inline_refresh(monkeypatch):
    """Run background refreshes inline so tests are deterministic."""
    monkeypatch.setattr(space_cache.cache, "_spawn", lambda fn: fn())


@pytest.fixture
def calls(monkeypatch):
    log = []

    def fake_get(url, **kw):
        log.append(url)
        return FakeResp(200, LL2_ASTRONAUTS)

    monkeypatch.setattr(space_service.httpx, "get", fake_get)
    return log


def test_first_request_serves_snapshot_then_live(client, calls):
    first = client.get("/api/v1/space/astronauts").json()
    # The first visitor gets the snapshot immediately, flagged stale.
    assert first["stale"] is True and first["_note"] == "sample data"
    second = client.get("/api/v1/space/astronauts").json()
    assert second["stale"] is False
    item = second["items"][0]
    assert set(item) == {"name", "nationality", "agency", "status", "image_url", "bio"}
    assert item["agency"] == "NASA" and len(item["bio"]) <= space_service.BIO_CHARS


def test_cache_hit_makes_no_second_upstream_call(client, calls):
    client.get("/api/v1/space/astronauts")
    client.get("/api/v1/space/astronauts")
    client.get("/api/v1/space/astronauts")
    assert len(calls) == 1


def test_expired_entry_returns_cached_and_refreshes(client, calls, monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(space_cache, "_now", lambda: now[0])
    client.get("/api/v1/space/astronauts")
    now[0] += space_service.TTL_ASTRONAUTS + 1
    resp = client.get("/api/v1/space/astronauts").json()
    assert resp["stale"] is False  # cached data returned, not the snapshot
    assert len(calls) == 2  # one background refresh


def test_429_falls_back_to_snapshot_and_honors_retry_after(client, monkeypatch):
    log = []

    def fake_get(url, **kw):
        log.append(url)
        return FakeResp(429, headers={"Retry-After": "1200"})

    monkeypatch.setattr(space_service.httpx, "get", fake_get)
    now = [1000.0]
    monkeypatch.setattr(space_cache, "_now", lambda: now[0])

    body = client.get("/api/v1/space/astronauts").json()
    assert body["stale"] is True and body["_note"] == "sample data"
    assert len(log) == 1

    # While Retry-After is active, no other LL2 resource may call LL2 either.
    now[0] += space_cache.FAILURE_BACKOFF + 1
    client.get("/api/v1/space/astronauts")
    client.get("/api/v1/space/events")
    assert len(log) == 1
    assert client.get("/api/v1/space/events").json()["stale"] is True

    # After Retry-After passes, LL2 is called again.
    now[0] += 1300
    client.get("/api/v1/space/astronauts")
    assert len(log) == 2


def test_network_error_serves_snapshot(client, monkeypatch):
    def boom(url, **kw):
        raise httpx.ConnectTimeout("t")

    monkeypatch.setattr(space_service.httpx, "get", boom)
    assert client.get("/api/v1/space/news").json()["stale"] is True


def test_limiter_caps_calls_and_recovers(monkeypatch):
    now = [0.0]
    monkeypatch.setattr(space_cache, "_now", lambda: now[0])
    lim = RateLimiter(8, 3600)
    assert [lim.acquire() for _ in range(9)] == [True] * 8 + [False]
    now[0] += 3601
    assert lim.acquire() is True


def test_shared_limiter_blocks_ll2_but_not_other_apis(client, monkeypatch):
    log = []

    def fake_get(url, **kw):
        log.append(url)
        return FakeResp(200, {"results": [], "latitude": 1.0})

    monkeypatch.setattr(space_service.httpx, "get", fake_get)
    for _ in range(space_cache.LL2_MAX_PER_HOUR):
        assert space_cache.ll2_limiter.acquire()
    with pytest.raises(UpstreamError):
        space_service.ll2_get("event/", {})
    assert log == []
    client.get("/api/v1/space/iss")
    assert client.get("/api/v1/space/iss").json()["stale"] is False  # ISS unaffected
    assert len(log) == 1


def test_upcoming_uses_the_shared_limiter():
    import upcoming_service
    for _ in range(space_cache.LL2_MAX_PER_HOUR):
        space_cache.ll2_limiter.acquire()
    with pytest.raises(upcoming_service.UpstreamError):
        upcoming_service.fetch_launches()


def test_events_missions_news_iss_trimmed(client, monkeypatch):
    def fake_get(url, **kw):
        if "event" in url:
            return FakeResp(200, {"results": [{
                "name": "E", "type": {"name": "Docking"}, "date": "2026-11-20T00:00:00Z",
                "description": "d", "agencies": [{"name": "NASA"}],
                "info_urls": [{"url": "http://info"}], "slug": "x"}]})
        if "launch/previous" in url:
            return FakeResp(200, {"results": [{
                "name": "M", "net": "2026-10-01T00:00:00Z", "status": {"name": "Success"},
                "mission": {"description": "desc"},
                "rocket": {"configuration": {"full_name": "Falcon 9"}},
                "launch_service_provider": {"name": "SpaceX"}}]})
        if "spaceflightnews" in url:
            return FakeResp(200, {"results": [{
                "title": "T", "news_site": "S", "published_at": "p", "summary": "s",
                "url": "http://a", "image_url": "dropped"}]})
        return FakeResp(200, {"latitude": 1.5, "longitude": 2.5, "altitude": 420.0,
                              "velocity": 27600.0, "visibility": "daylight",
                              "timestamp": 1, "id": 25544})

    monkeypatch.setattr(space_service.httpx, "get", fake_get)
    for path in ("events", "missions", "news", "iss"):
        client.get(f"/api/v1/space/{path}")  # first call triggers the refresh
    ev = client.get("/api/v1/space/events").json()["items"][0]
    assert ev == {"name": "E", "type": "Docking", "date": "2026-11-20T00:00:00Z",
                  "description": "d", "agencies": ["NASA"], "info_url": "http://info"}
    ms = client.get("/api/v1/space/missions").json()["items"][0]
    assert ms["rocket"] == "Falcon 9" and ms["provider"] == "SpaceX"
    assert ms["mission_description"] == "desc"
    assert set(client.get("/api/v1/space/news").json()["items"][0]) == {
        "title", "source", "published_at", "summary", "url"}
    assert client.get("/api/v1/space/iss").json()["data"]["latitude"] == 1.5


def test_api_key_is_sent_as_header_only(monkeypatch):
    seen = {}

    def fake_get(url, **kw):
        seen.update(kw)
        return FakeResp(200, {"results": []})

    monkeypatch.setenv("LL2_API_KEY", "secret123")
    monkeypatch.setattr(space_service.httpx, "get", fake_get)
    space_service.ll2_get("event/", {})
    assert seen["headers"] == {"Authorization": "Token secret123"}
    assert "secret123" not in str(seen["params"]) and seen["timeout"] == 10.0
