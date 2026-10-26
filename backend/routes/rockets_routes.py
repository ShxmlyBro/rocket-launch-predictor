from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pred.model.rocket_launch_model import RocketLaunchPredictor

# Create a rocketsRouter instance
rocketsRouter = APIRouter()
predictor = RocketLaunchPredictor()

@rocketsRouter.get("/train/")
def train_and_save_model():
    """
    Endpoint to train and save the model.
    """
    predictor.train_and_save_model()
    return {"message": "Model trained and saved successfully."}

@rocketsRouter.get("/evaluate/")
def evaluate_model():
    """
    Endpoint to evaluate the trained model.
    """
    X_train, X_test, y_train, y_test, _ = predictor.preprocess_data()
    evaluation = predictor.evaluate_model(X_test, y_test)
    return evaluation

@rocketsRouter.get("/rockets/location")
async def predict_launch(location: str):
    try:
        prediction_result = predictor.predict_launch(location)
        return JSONResponse(content=prediction_result)
    except Exception as e:
        return JSONResponse(
            content={
                "prediction": "Error",
                "accuracy": "0%",
                "success_probability": "0%",
                "failure_probability": "0%",
                "error": str(e)
            }, 
            status_code=500
        )

@rocketsRouter.get("/rockets/locations")
async def get_all_locations():
    try:
        locations = predictor.get_all_locations()
        return JSONResponse(content={"locations": locations})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

