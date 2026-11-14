from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from model_service import NUMERIC_RANGES

_T = NUMERIC_RANGES["temp_mean"]
_P = NUMERIC_RANGES["precipitation"]
_W = NUMERIC_RANGES["max_wind_speed"]


class PredictRequest(BaseModel):
    launch_site: str = Field(..., min_length=1, max_length=100)
    lv_type: str = Field(..., min_length=1, max_length=100)
    agency: str = Field(..., min_length=1, max_length=100)
    temp_mean: float = Field(..., ge=_T["min"], le=_T["max"], allow_inf_nan=False)
    precipitation: float = Field(..., ge=_P["min"], le=_P["max"], allow_inf_nan=False)
    max_wind_speed: float = Field(..., ge=_W["min"], le=_W["max"], allow_inf_nan=False)


class PredictResponse(BaseModel):
    risk_probability: float
    above_threshold: bool
    threshold: float
    note: str


class UpcomingLaunch(BaseModel):
    mission: str
    rocket: str
    provider: str
    pad: str
    net: Optional[str] = None
    weather: Optional[Dict[str, float]] = None
    risk_score: Optional[float] = None
    threshold: float
    above_threshold: Optional[bool] = None
    verdict: str
    match_quality: Literal["full", "limited"]
    reasons: List[str] = []
    notes: List[str] = []


class UpcomingResponse(BaseModel):
    stale: bool
    as_of: str
    note: str
    launches: List[UpcomingLaunch]


class FeaturesResponse(BaseModel):
    categories: Dict[str, List[str]]
    numeric_ranges: Dict[str, Dict[str, object]]
