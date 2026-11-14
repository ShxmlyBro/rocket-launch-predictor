import pytest
from fastapi.testclient import TestClient

from main import app


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
