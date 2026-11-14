"""Startup warm-up. Every external call is mocked; no thread outlives a test."""
import threading

import pytest

import space_cache
import space_service
from space_cache import UpstreamError


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("real network call")

    monkeypatch.setattr(space_service.httpx, "get", boom)


def _patch_fetchers(monkeypatch, order):
    def make(name, body):
        def fetch():
            order.append(name)
            return body
        return fetch

    monkeypatch.setattr(space_service, "fetch_news", make("news", {"items": [{"title": "live"}]}))
    monkeypatch.setattr(space_service, "fetch_iss", make("iss", {"data": {"latitude": 1.0}}))
    monkeypatch.setattr(space_service, "fetch_astronauts", make("astronauts", {"items": [{"name": "live"}]}))
    monkeypatch.setattr(space_service, "fetch_events", make("events", {"items": [{"name": "live"}]}))
    monkeypatch.setattr(space_service, "fetch_missions", make("missions", {"items": [{"name": "live"}]}))


def test_warmup_fills_the_cache_in_order(monkeypatch):
    order = []
    _patch_fetchers(monkeypatch, order)
    waits = []

    class Stop(threading.Event):
        def wait(self, timeout=None):
            waits.append(timeout)
            return False

    space_service.warm_up(Stop(), gap=30)
    assert order == ["news", "iss", "astronauts", "events", "missions"]
    # 30 s pauses only between the three LL2 calls, none after the last.
    assert waits == [30, 30]
    for get in (space_service.get_news, space_service.get_astronauts,
                space_service.get_events, space_service.get_missions):
        payload = get()
        assert payload["stale"] is False
    assert space_service.get_iss()["data"]["latitude"] == 1.0


def test_refused_limiter_keeps_the_snapshot(monkeypatch):
    # Real LL2 fetchers, limiter exhausted: they must refuse before any HTTP call.
    space_cache.ll2_limiter.block_for(3600)
    monkeypatch.setattr(space_service, "fetch_news", lambda: {"items": []})
    monkeypatch.setattr(space_service, "fetch_iss", lambda: {"data": {}})
    space_service.warm_up(threading.Event(), gap=0)  # the no_network fixture fails on any HTTP call
    for get in (space_service.get_astronauts, space_service.get_events, space_service.get_missions):
        payload = get()
        assert payload["stale"] is True and payload["_note"] == "sample data"
        assert payload["items"]  # the bundled snapshot


def test_a_failed_call_is_not_retried(monkeypatch):
    calls = []

    def failing():
        calls.append(1)
        raise UpstreamError("down")

    monkeypatch.setattr(space_service, "fetch_news", failing)
    monkeypatch.setattr(space_service, "fetch_iss", lambda: {"data": {}})
    monkeypatch.setattr(space_service, "fetch_astronauts", lambda: {"items": []})
    monkeypatch.setattr(space_service, "fetch_events", lambda: {"items": []})
    monkeypatch.setattr(space_service, "fetch_missions", lambda: {"items": []})
    space_service.warm_up(threading.Event(), gap=0)
    assert calls == [1]
    assert space_service.get_news()["stale"] is True


def test_fresh_entries_are_skipped(monkeypatch):
    order = []
    _patch_fetchers(monkeypatch, order)
    space_service.warm_up(threading.Event(), gap=0)
    order.clear()
    space_service.warm_up(threading.Event(), gap=0)
    assert order == []


def test_warmup_disabled_by_env_starts_no_thread(monkeypatch):
    monkeypatch.setenv("SPACE_WARMUP", "0")

    def no_thread(*a, **k):
        raise AssertionError("thread started")

    monkeypatch.setattr(space_service.threading, "Thread", no_thread)
    assert space_service.start_warmup(threading.Event()) is None


def test_warmup_enabled_starts_one_daemon_thread(monkeypatch):
    monkeypatch.delenv("SPACE_WARMUP", raising=False)
    started = []

    class FakeThread:
        def __init__(self, target, args, name, daemon):
            started.append((target, daemon))

        def start(self):
            started.append("start")

    monkeypatch.setattr(space_service.threading, "Thread", FakeThread)
    t = space_service.start_warmup(threading.Event())
    assert t is not None and started == [(space_service.warm_up, True), "start"]


def test_the_test_suite_disables_warmup():
    import os
    assert os.environ["SPACE_WARMUP"] == "0"
