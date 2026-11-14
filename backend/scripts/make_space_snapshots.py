"""Write the bundled /space snapshots from real API responses.

Run from backend/:  python scripts/make_space_snapshots.py

Makes 5 calls in total: 3 to Launch Library 2 (astronauts, events, missions), 1 to
Spaceflight News and 1 to wheretheiss.at. It reuses the service's own fetch and trim
functions, so snapshots have exactly the shape the API serves. A snapshot file is
overwritten only if its call succeeded. LL2_API_KEY is read from the environment if
set. Review the output before committing it.
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

import space_service  # noqa: E402

SOURCES = {
    "astronauts": space_service.fetch_astronauts,
    "events": space_service.fetch_events,
    "missions": space_service.fetch_missions,
    "news": space_service.fetch_news,
    "iss": space_service.fetch_iss,
}


def main() -> int:
    failed = []
    for name, fetch in SOURCES.items():
        try:
            body = fetch()
        except Exception as exc:  # type only: never print headers or keys
            print(f"{name}: FAILED ({type(exc).__name__}: {exc}), file left unchanged")
            failed.append(name)
            continue
        snapshot = {"_note": "sample data",
                    "as_of": datetime.now(timezone.utc).isoformat(), **body}
        path = BACKEND / "data" / f"space_{name}.json"
        path.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")
        count = len(body["items"]) if "items" in body else 1
        print(f"{name}: wrote {count} record(s) to {path.relative_to(BACKEND)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
