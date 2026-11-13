import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(scope="module")
def client():
    """Test client; the with block runs the lifespan so the model is loaded."""
    with TestClient(app) as c:
        yield c
