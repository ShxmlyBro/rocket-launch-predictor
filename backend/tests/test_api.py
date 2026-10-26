import pytest
from fastapi import status

def test_train_endpoint(client):
    """Test the model training endpoint"""
    response = client.get("/api/v1/train/")
    assert response.status_code == status.HTTP_200_OK
    assert "message" in response.json()
    assert response.json()["message"] == "Model trained and saved successfully."

def test_evaluate_endpoint(client):
    """Test the model evaluation endpoint"""
    response = client.get("/api/v1/evaluate/")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "accuracy" in data
    assert "classification_report" in data
    report = data["classification_report"]["macro avg"]
    assert "precision" in report
    assert "recall" in report
    assert "f1-score" in report

def test_predict_launch_endpoint(client):
    """Test the launch prediction endpoint"""
    response = client.get("/api/v1/rockets/location?location=Cape Canaveral")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "prediction" in data
    assert "accuracy" in data
    assert "success_probability" in data
    assert "failure_probability" in data

    response = client.get("/api/v1/rockets/location?location=InvalidLocation")
    data = response.json()
    assert "prediction" in data
    assert data["prediction"] == "Invalid location"
    assert data["accuracy"] == "0%"
    assert data["success_probability"] == "0%"
    assert data["failure_probability"] == "0%"

def test_get_locations_endpoint(client):
    """Test the get all locations endpoint"""
    response = client.get("/api/v1/rockets/locations")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "locations" in data
    assert isinstance(data["locations"], list)
    assert len(data["locations"]) > 0 