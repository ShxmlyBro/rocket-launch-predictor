import os

import pytest
from fastapi.testclient import TestClient

# The suite never starts the startup warm-up thread (it would make real network calls).
os.environ["SPACE_WARMUP"] = "0"

from main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    """Test client; the with block runs the lifespan so the model is loaded."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def reset_shared_space_state():
    """The LL2 limiter and the space cache are process-wide; isolate each test."""
    import space_cache
    space_cache.ll2_limiter.reset()
    space_cache.cache.clear()
    yield
    space_cache.ll2_limiter.reset()
    space_cache.cache.clear()
