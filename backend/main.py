import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI

from middlewares.rockets_middleware import setup_cors
from model_service import load_service
from space_service import start_warmup
from routes.rockets_routes import health, rocketsRouter
from routes.space_routes import spaceRouter


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the model bundle and metadata once at startup.
    app.state.service = load_service()
    # Warm the space cache in the background; never blocks startup or requests.
    stop = threading.Event()
    start_warmup(stop)
    yield
    stop.set()


app = FastAPI(title="Rocket Launch Anomaly Risk API", lifespan=lifespan)

setup_cors(app)

app.include_router(rocketsRouter, tags=["rockets"], prefix="/api/v1")
app.include_router(spaceRouter, tags=["space"], prefix="/api/v1")
# Also expose /health at the root for Render health checks.
app.add_api_route("/health", health, methods=["GET"], tags=["rockets"])
