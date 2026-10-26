from fastapi import FastAPI
from routes.rockets_routes import rocketsRouter
from middlewares.rockets_middleware import setup_cors

# Create a FastAPI instance
app = FastAPI()

# Set up CORS middleware
setup_cors(app)

# Include the rocketsRouter
app.include_router(rocketsRouter, tags=["rockets"], prefix="/api/v1")
