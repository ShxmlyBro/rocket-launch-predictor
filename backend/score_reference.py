"""Held-out score reference: turns a raw model score into a percentile and the
observed anomaly rate of similar past launches. Optional: without the file every
lookup returns None and nothing else changes."""
import json
import logging
from bisect import bisect_left
from pathlib import Path
from typing import Optional

REFERENCE_PATH = Path(__file__).resolve().parent / "model" / "score_reference.json"
log = logging.getLogger(__name__)


class ScoreReference:
    def __init__(self, data: dict):
        self.quantiles = [float(q) for q in data["quantiles"]]
        self.bands = data["bands"]
        self.n_test = data.get("n_test")

    def percentile(self, score: float) -> int:
        """Share of test-set scores strictly below `score`, as an integer 0-100."""
        below = bisect_left(self.quantiles, score)  # quantile points strictly below
        return max(0, min(100, below - 1))

    def band(self, score: float) -> dict:
        """Band the score falls in. Scores outside the test range use the end bands."""
        for b in self.bands[:-1]:
            if score < b["upper"]:
                return b
        return self.bands[-1]

    def lookup(self, score: float) -> dict:
        b = self.band(score)
        return {
            "risk_percentile": self.percentile(score),
            "similar_rate": b["observed_rate"],
            "similar_n": b["n"],
        }


EMPTY = {"risk_percentile": None, "similar_rate": None, "similar_n": None}


def load_reference(path: Path = REFERENCE_PATH) -> Optional[ScoreReference]:
    try:
        with open(path, encoding="utf-8") as f:
            return ScoreReference(json.load(f))
    except FileNotFoundError:
        log.warning("score_reference.json not found; risk reading fields will be null")
    except (ValueError, KeyError, TypeError) as e:
        log.warning("score_reference.json unreadable (%s); risk reading fields will be null", e)
    return None
