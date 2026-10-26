import pytest
from fastapi.testclient import TestClient
from main import app
from pred.model.rocket_launch_model import RocketLaunchPredictor

@pytest.fixture
def client():
    """
    Test client fixture for making requests to the FastAPI application
    """
    return TestClient(app)

@pytest.fixture
def predictor():
    """
    RocketLaunchPredictor fixture for testing model functionality
    """
    return RocketLaunchPredictor() 