#!/usr/bin/env python3
"""Repair missing weather in data/merged_gcat_meteo.csv.

Re-fetches only rows whose api_status is not SUCCESS, using the same Open-Meteo
archive endpoint, daily variables, timezone and column names as the original
scripts/ingest_data.py, so repaired rows are comparable to existing ones.

Efficiency: rows are grouped by site (Latitude, Longitude) and by date window of
at most 14 days, so one request (1 API call on the free tier) covers every
launch in that window instead of one request per launch.

The input is never modified. The full run writes data/merged_gcat_meteo_v2.csv.
Runs with --limit or --verify are test runs: they write to a fresh temp
directory and never touch the v2 file.

Usage (from the repo root, root venv active):
    python scripts/refetch_missing.py --limit 5
    python scripts/refetch_missing.py --only-lv "Falcon 9" --limit 3
    python scripts/refetch_missing.py --verify 20
    python scripts/refetch_missing.py            # full run, resumable
"""
import argparse
import json
import os
import random
import sys
import tempfile
import time
from collections import deque
from pathlib import Path

import numpy as np
import pandas as pd
import requests

try:
    from tqdm import tqdm
except ImportError:  # minimal fallback so the script runs without tqdm installed
    class tqdm:  # noqa: N801
        def __init__(self, iterable, desc="", **_):
            self.it, self.desc = list(iterable), desc

        def __iter__(self):
            total = len(self.it)
            for k, x in enumerate(self.it, 1):
                if k % 10 == 0 or k == total:
                    print(f"{self.desc}: {k}/{total}", flush=True)
                yield x

        @staticmethod
        def write(msg):
            print(msg, flush=True)

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / "data" / "merged_gcat_meteo.csv"
OUTPUT = ROOT / "data" / "merged_gcat_meteo_v2.csv"
PARTIAL = OUTPUT.with_name(OUTPUT.name + ".partial")
STATE = OUTPUT.with_name(OUTPUT.name + ".state.json")

URL = "https://archive-api.open-meteo.com/v1/archive"
DAILY = ["temperature_2m_mean", "precipitation_sum", "wind_speed_10m_max"]
# API variable -> dataframe column (same names as the original ingestion)
VAR_TO_COL = {
    "temperature_2m_mean": "temp_mean",
    "precipitation_sum": "precipitation",
    "wind_speed_10m_max": "max_wind_speed",
}
WEATHER_COLS = list(VAR_TO_COL.values())
REQUIRED_COLS = ["LV_Type", "Latitude", "Longitude", "Launch_Date", "api_status"] + WEATHER_COLS
EXPECTED_ROWS = 17063

WINDOW_DAYS = 14          # max span per request (keeps each request at 1 API call)
PACE_SECONDS = 1.0        # minimum gap between requests
HOURLY_CAP = 4500         # pause when this many calls were made in the last hour
MAX_ATTEMPTS = 6
BACKOFF_BASE = 5.0
BACKOFF_MAX = 300.0
TIMEOUT = 30
CHECKPOINT_EVERY = 50     # requests
ABORT_AFTER_FAILED_WINDOWS = 5
SUMMARY_LVS = ["Falcon 9", "Soyuz-U"]

CSV_KW = {"float_precision": "round_trip", "low_memory": False}


# ----------------------------------------------------------------- rate limiter
class Limiter:
    """Spaces requests and keeps a rolling one-hour call counter."""

    def __init__(self, times=()):
        now = time.time()
        self.times = deque(t for t in sorted(times) if t > now - 3600)
        self.last = 0.0

    def wait(self):
        now = time.time()
        while self.times and self.times[0] <= now - 3600:
            self.times.popleft()
        if len(self.times) >= HOURLY_CAP:
            pause = self.times[0] + 3600 - now + 1
            tqdm.write(f"Hourly cap ({HOURLY_CAP}) reached; pausing {pause / 60:.1f} min")
            time.sleep(max(pause, 1))
        gap = PACE_SECONDS - (time.time() - self.last)
        if gap > 0:
            time.sleep(gap)
        self.last = time.time()
        self.times.append(self.last)


# ---------------------------------------------------------------------- fetching
def _backoff(attempt):
    return min(BACKOFF_BASE * 2 ** attempt, BACKOFF_MAX) + random.uniform(0, 1)


def fetch_window(session, limiter, lat, lon, start, end):
    """Fetch daily weather for [start, end] (YYYY-MM-DD strings).

    Returns (data, status). data maps 'YYYY-MM-DD' -> {col: value}, or None on
    failure; status is 'SUCCESS' or an original-style failure label.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start,
        "end_date": end,
        "daily": DAILY,
        "timezone": "UTC",
    }
    status = "ERROR_Unknown"
    for attempt in range(MAX_ATTEMPTS):
        limiter.wait()
        delay = _backoff(attempt)
        try:
            resp = session.get(URL, params=params, timeout=TIMEOUT)
        except requests.RequestException as exc:
            status = f"ERROR_{type(exc).__name__}"
        else:
            if resp.status_code == 200:
                try:
                    daily = resp.json()["daily"]
                    out = {}
                    for i, day in enumerate(daily["time"]):
                        out[day] = {
                            VAR_TO_COL[v]: (np.nan if daily[v][i] is None else float(daily[v][i]))
                            for v in DAILY
                        }
                    return out, "SUCCESS"
                except (KeyError, ValueError, TypeError):
                    return None, "FAILED_BAD_RESPONSE"
            if resp.status_code == 429:
                status = "RATE_LIMITED"
                retry_after = resp.headers.get("Retry-After")
                try:
                    delay = min(float(retry_after), 3700) + 1
                except (TypeError, ValueError):
                    pass
            elif resp.status_code >= 500:
                status = f"FAILED_{resp.status_code}"
            else:
                return None, f"FAILED_{resp.status_code}"  # 4xx other than 429: no retry
        if attempt < MAX_ATTEMPTS - 1:
            tqdm.write(f"  {status} for {lat},{lon} {start}..{end}; retry in {delay:.0f}s "
                       f"({attempt + 1}/{MAX_ATTEMPTS - 1})")
            time.sleep(delay)
    return None, status


def build_windows(df, idx):
    """Group row labels by site, then into windows spanning <= WINDOW_DAYS days."""
    sub = df.loc[idx, ["Latitude", "Longitude", "Launch_Date"]].copy()
    sub["d"] = pd.to_datetime(sub["Launch_Date"], errors="coerce")
    sub["Latitude"] = pd.to_numeric(sub["Latitude"], errors="coerce")
    sub["Longitude"] = pd.to_numeric(sub["Longitude"], errors="coerce")
    bad = sub[sub[["Latitude", "Longitude", "d"]].isna().any(axis=1)]
    sub = sub.drop(bad.index)
    windows = []
    for (lat, lon), g in sub.groupby(["Latitude", "Longitude"], sort=True):
        cur = None
        for i, d in g.sort_values("d")["d"].items():
            if cur is not None and (d - cur["start"]).days < WINDOW_DAYS:
                cur["rows"].append(i)
                cur["end"] = d
            else:
                cur = {"lat": lat, "lon": lon, "start": d, "end": d, "rows": [i]}
                windows.append(cur)
    for w in windows:
        w["start_s"] = w["start"].strftime("%Y-%m-%d")
        w["end_s"] = w["end"].strftime("%Y-%m-%d")
    return windows, list(bad.index)


def row_key(df, i):
    return pd.to_datetime(df.at[i, "Launch_Date"]).strftime("%Y-%m-%d")


# ---------------------------------------------------------------------- helpers
def atomic_csv(df, path):
    tmp = Path(str(path) + ".tmp")
    df.to_csv(tmp, index=False)
    os.replace(tmp, path)


def atomic_json(obj, path):
    tmp = Path(str(path) + ".tmp")
    tmp.write_text(json.dumps(obj))
    os.replace(tmp, path)


def check_columns(df, label):
    missing = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing:
        sys.exit(f"ERROR: {label} is missing required columns: {missing}\n"
                 f"Found: {list(df.columns)}")


def success_counts(df):
    rows = {"Overall": (int((df["api_status"] == "SUCCESS").sum()), len(df))}
    for lv in SUMMARY_LVS:
        m = df["LV_Type"] == lv
        rows[lv] = (int((m & (df["api_status"] == "SUCCESS")).sum()), int(m.sum()))
    return rows


def print_summary(before, after, df):
    print("\n=== SUCCESS counts (before -> after) ===")
    for k in ["Falcon 9", "Soyuz-U", "Overall"]:
        b, n = before[k]
        a, _ = after[k]
        print(f"{k:10s} {b:6d} -> {a:6d}  of {n}  (+{a - b})")
    remaining = df.loc[df["api_status"] != "SUCCESS", "api_status"].value_counts()
    print("Remaining non-SUCCESS:", {k: int(v) for k, v in remaining.items()} if len(remaining) else "none")


def final_checks(out, orig):
    """Hard assertions before the v2 file is written."""
    assert len(out) == EXPECTED_ROWS, f"row count {len(out)} != {EXPECTED_ROWS}"
    assert list(out.columns) == list(orig.columns), "column order changed"
    ok = (orig["api_status"] == "SUCCESS").to_numpy()
    for c in WEATHER_COLS:
        a = orig.loc[ok, c].to_numpy(dtype=float)
        b = out.loc[ok, c].to_numpy(dtype=float)
        assert np.array_equal(a, b, equal_nan=True), f"existing SUCCESS values changed in {c}"
    assert (out.loc[ok, "api_status"] == "SUCCESS").all(), "existing SUCCESS status changed"
    other = [c for c in orig.columns if c not in WEATHER_COLS + ["api_status"]]
    pd.testing.assert_frame_equal(out[other], orig[other], check_dtype=False, check_exact=True)


# ------------------------------------------------------------------------- modes
def run_verify(df, args):
    pool = df[df["api_status"] == "SUCCESS"]
    if args.only_lv:
        pool = pool[pool["LV_Type"] == args.only_lv]
    sample = pool.sample(n=min(args.verify, len(pool)), random_state=42)
    windows, bad = build_windows(df, sample.index)
    print(f"Verify: {len(sample)} SUCCESS rows -> {len(windows)} window requests "
          f"({len(bad)} rows skipped for bad coords/date)")
    session, limiter = requests.Session(), Limiter()
    checked, mismatches, failed = 0, [], 0
    for w in tqdm(windows, desc="Verifying"):
        data, status = fetch_window(session, limiter, w["lat"], w["lon"], w["start_s"], w["end_s"])
        if data is None:
            failed += len(w["rows"])
            tqdm.write(f"  fetch failed ({status}) for {w['rows']}")
            continue
        for i in w["rows"]:
            new = data.get(row_key(df, i))
            if new is None:
                failed += 1
                continue
            checked += 1
            for c in WEATHER_COLS:
                old = df.at[i, c]
                if not np.isclose(old, new[c], rtol=1e-6, atol=1e-6, equal_nan=True):
                    mismatches.append((i, df.at[i, "LV_Type"], df.at[i, "Launch_Date"], c, old, new[c]))
    print(f"\nVerify result: checked {checked}, fetch failures {failed}, mismatching values {len(mismatches)}")
    for m in mismatches[:50]:
        print("  row %s %s %s %s: stored=%s refetched=%s" % m)
    return 1 if mismatches or failed else 0


def run_repair(df, orig, args, test_mode, partial, state_path, out_path):
    before = success_counts(df)
    targets = df.index[df["api_status"] != "SUCCESS"]
    if args.only_lv:
        targets = targets[(df.loc[targets, "LV_Type"] == args.only_lv).to_numpy()]
    if args.limit is not None:
        targets = targets[: args.limit]
    windows, bad = build_windows(df, targets)
    print(f"Targets: {len(targets)} non-SUCCESS rows -> {len(windows)} window requests "
          f"(at ~{PACE_SECONDS:.0f}s each: ~{len(windows) * PACE_SECONDS / 60:.0f} min minimum)")
    if bad:
        print(f"Skipping {len(bad)} rows with missing coordinates or date")

    times = []
    if not test_mode and state_path.exists():
        try:
            times = json.loads(state_path.read_text()).get("call_times", [])
        except (ValueError, OSError):
            times = []
    limiter = Limiter(times)
    session = requests.Session()

    def checkpoint():
        atomic_csv(df, partial)
        atomic_json({"call_times": list(limiter.times)}, state_path)

    consecutive_failed, completed = 0, True
    try:
        for n, w in enumerate(tqdm(windows, desc="Refetching"), 1):
            data, status = fetch_window(session, limiter, w["lat"], w["lon"], w["start_s"], w["end_s"])
            for i in w["rows"]:
                new = data.get(row_key(df, i)) if data else None
                if new is not None:
                    for c in WEATHER_COLS:
                        df.at[i, c] = new[c]
                    df.at[i, "api_status"] = "SUCCESS"
                else:
                    df.at[i, "api_status"] = status if data is None else "FAILED_MISSING_DATE"
            consecutive_failed = consecutive_failed + 1 if data is None else 0
            if n % CHECKPOINT_EVERY == 0:
                checkpoint()
            if consecutive_failed >= ABORT_AFTER_FAILED_WINDOWS:
                print(f"\nStopping: {consecutive_failed} windows in a row failed (last: {status}). "
                      "Progress is saved; wait a while and re-run to resume.")
                completed = False
                break
    except KeyboardInterrupt:
        print("\nInterrupted. Saving checkpoint; re-run the same command to resume.")
        completed = False
    checkpoint()

    print_summary(before, success_counts(df), df)
    if not completed:
        print(f"Checkpoint: {partial}")
        return 2

    final_checks(df, orig)
    print("Checks passed: 17,063 rows, column order identical, existing SUCCESS values unchanged.")
    assert Path(out_path).resolve() != INPUT.resolve()
    if test_mode:
        assert Path(out_path).resolve() != OUTPUT.resolve()
    atomic_csv(df, out_path)
    print(f"Wrote {out_path}")
    if not test_mode:
        for p in (partial, state_path):
            if p.exists():
                p.unlink()
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, help="process only the first N non-SUCCESS rows (test run, temp output)")
    ap.add_argument("--verify", type=int, metavar="N",
                    help="re-fetch N existing SUCCESS rows and report mismatches (test run, writes nothing)")
    ap.add_argument("--only-lv", metavar="LV_TYPE", help='only rows with this exact LV_Type, e.g. "Falcon 9"')
    args = ap.parse_args()
    test_mode = args.limit is not None or args.verify is not None

    if not INPUT.exists():
        sys.exit(f"ERROR: input not found: {INPUT}")
    orig = pd.read_csv(INPUT, **CSV_KW)
    check_columns(orig, "input")
    if len(orig) != EXPECTED_ROWS:
        sys.exit(f"ERROR: input has {len(orig)} rows, expected {EXPECTED_ROWS}")

    if args.verify is not None:
        return run_verify(orig, args)

    if test_mode:
        tmp = Path(tempfile.mkdtemp(prefix="refetch_test_"))
        partial, state_path, out_path = tmp / "partial.csv", tmp / "state.json", tmp / "merged_gcat_meteo_v2.test.csv"
        df = orig.copy()
        print(f"TEST RUN: output goes to {out_path}")
    else:
        partial, state_path, out_path = PARTIAL, STATE, OUTPUT
        base = next((p for p in (PARTIAL, OUTPUT) if p.exists()), INPUT)
        if base != INPUT:
            print(f"Resuming from {base}")
        df = pd.read_csv(base, **CSV_KW)
        check_columns(df, str(base))
        if len(df) != EXPECTED_ROWS or list(df.columns) != list(orig.columns):
            sys.exit(f"ERROR: {base} does not match the input's shape or column order")
    return run_repair(df, orig, args, test_mode, partial, state_path, out_path)


if __name__ == "__main__":
    sys.exit(main())
