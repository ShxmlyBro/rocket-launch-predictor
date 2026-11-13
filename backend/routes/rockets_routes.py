from fastapi import APIRouter, HTTPException, Request

from model_service import NUMERIC_RANGES, ModelService
from schemas import FeaturesResponse, PredictRequest, PredictResponse, UpcomingResponse
from upcoming_service import get_upcoming

rocketsRouter = APIRouter()


def get_service(request: Request) -> ModelService:
    service = getattr(request.app.state, "service", None)
    if service is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")
    return service


@rocketsRouter.get("/health")
def health(request: Request):
    return {
        "status": "ok",
        "model_loaded": getattr(request.app.state, "service", None) is not None,
    }


@rocketsRouter.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest, request: Request):
    service = get_service(request)
    return service.predict(body.model_dump())


@rocketsRouter.get("/features", response_model=FeaturesResponse)
def features(request: Request):
    service = get_service(request)
    return {
        "categories": {k: list(v) for k, v in service.known_categories.items()},
        "numeric_ranges": NUMERIC_RANGES,
    }


@rocketsRouter.get("/upcoming", response_model=UpcomingResponse)
def upcoming(request: Request):
    return get_upcoming(get_service(request))


@rocketsRouter.get("/eda-stats")
def eda_stats(request: Request):
    service = get_service(request)
    meta = service.metadata
    return {
        "eda_stats": meta.get("eda_stats", {}),
        "feature_importance_by_variable": meta.get("feature_importance_by_variable", {}),
        "top_encoded_features": meta.get("top_encoded_features", {}),
    }
