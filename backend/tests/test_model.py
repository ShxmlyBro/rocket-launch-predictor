import pytest
import numpy as np
import pandas as pd

def test_model_initialization(predictor):
    """Test model initialization"""
    assert predictor is not None
    assert hasattr(predictor, 'model')
    assert hasattr(predictor, 'preprocess_data')
    assert hasattr(predictor, 'predict_launch')

def test_data_preprocessing(predictor):
    """Test data preprocessing functionality"""
    X_train, X_test, y_train, y_test, _ = predictor.preprocess_data()
    
    # Check if data is split correctly
    assert X_train is not None
    assert X_test is not None
    assert y_train is not None
    assert y_test is not None
    
    # Check data types (pandas DataFrame/Series)
    assert isinstance(X_train, pd.DataFrame)
    assert isinstance(X_test, pd.DataFrame)
    assert isinstance(y_train, (pd.Series, np.ndarray))
    assert isinstance(y_test, (pd.Series, np.ndarray))
    
    # Check shapes
    assert len(X_train.shape) == 2
    assert len(X_test.shape) == 2

def test_model_prediction(predictor):
    """Test model prediction functionality"""
    # Test prediction with a valid location
    result = predictor.predict_launch("Cape Canaveral")
    assert isinstance(result, dict)
    assert "prediction" in result
    assert "accuracy" in result
    assert "success_probability" in result
    assert "failure_probability" in result
    
    # Verify probability values are valid
    assert 0 <= float(result["success_probability"].strip('%')) <= 100
    assert 0 <= float(result["failure_probability"].strip('%')) <= 100

def test_model_evaluation(predictor):
    """Test model evaluation metrics"""
    X_train, X_test, y_train, y_test, _ = predictor.preprocess_data()
    metrics = predictor.evaluate_model(X_test, y_test)
    
    assert isinstance(metrics, dict)
    assert "accuracy" in metrics
    assert "classification_report" in metrics
    
    # Check metrics in classification report
    report = metrics["classification_report"]["macro avg"]
    assert "precision" in report
    assert "recall" in report
    assert "f1-score" in report
    
    # Check if metrics are within valid range
    assert 0 <= float(metrics["accuracy"].strip('%')) <= 100
    assert 0 <= report["precision"] <= 1
    assert 0 <= report["recall"] <= 1
    assert 0 <= report["f1-score"] <= 1

def test_get_locations(predictor):
    """Test getting all available locations"""
    locations = predictor.get_all_locations()
    assert isinstance(locations, list)
    assert len(locations) > 0
    assert all(isinstance(loc, str) for loc in locations) 