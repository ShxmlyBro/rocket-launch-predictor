import React, { useState, useEffect } from "react";
import axios from "axios";
import "../assets/LaunchCard.css";
import Loader from "./Loader";

const LaunchCard = ({ launch, weather, location }) => {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const launchDate = new Date(launch.sort_date * 1000).toLocaleString();

  const weatherIcons = {
    Clear: "☀️",
    Clouds: "☁️",
    Rain: "🌧️",
    Snow: "🌨️",
    Thunderstorm: "⛈️",
    Drizzle: "🌦️",
    Mist: "🌫️",
    Smoke: "🌫️",
    Haze: "🌫️",
    Dust: "🌫️",
    Fog: "🌫️",
    Sand: "🌫️",
    Ash: "🌫️",
    Squall: "💨",
    Tornado: "🌪️",
    "Loading...": "🔄",
    "Forecast Unavailable": "❓",
    Error: "⚠️",
    "No data": "❌",
  };

  const predictionIcons = {
    Launchable: "🚀",
    "Unlaunchable": "⚠️",
  };

  const locationMapping = {
    "LC-576A1, Vandenberg AFB, California, USA": [
      "Vandenberg",
      "Vandenberg Space Force Base",
      "Vandenberg SFB",
      "VSFB",
    ],
    "LC-11, Cape Canaveral AFS, Florida, USA": [
      "Cape Canaveral",
      "Cape Canaveral AFS, Florida, USA",
      "Cape Canaveral SFS",
      "CCSFS",
    ],
    "Rocket Lab LC-1A, M?hia Peninsula, New Zealand":[
      "Mahia Peninsula",
      "Rocket Lab Launch Complex",
      "Rocket Lab",
      "Mahia",
      "Rocket Lab Launch Complex, Mahia Peninsula",
    ],
    "Site 5020 (LA-2A), Jiuquan Satellite Launch Center, China": [
      "Corn Ranch Spaceport",
    ],
  };

  const findBestMatchingLocation = (inputLoc, locations) => {
    for (const [key, aliases] of Object.entries(locationMapping)) {
      if (
        aliases.some(
          (alias) =>
            inputLoc.toLowerCase().includes(alias.toLowerCase()) ||
            alias.toLowerCase().includes(inputLoc.toLowerCase())
        )
      ) {
        return key;
      }
    }

    const match =
      locations.find((loc) => loc.toLowerCase() === inputLoc.toLowerCase()) ||
      locations.find(
        (loc) =>
          loc.toLowerCase().includes(inputLoc.toLowerCase()) ||
          inputLoc.toLowerCase().includes(loc.toLowerCase())
      );

    return match || inputLoc;
  };

  const getPrediction = async (locationName) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `http://localhost:8000/api/v1/rockets/location?location=${encodeURIComponent(
          locationName
        )}`
      );
      setPrediction(response.data);
    } catch (err) {
      setError("Failed to get prediction");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchAndPredict = async () => {
      try {
        const response = await axios.get(
          "http://localhost:8000/api/v1/rockets/locations"
        );
        const bestMatch = findBestMatchingLocation(
          location,
          response.data.locations
        );
        if (bestMatch) getPrediction(bestMatch);
      } catch (err) {
        setError("Failed to fetch locations");
      }
    };

    if (location) fetchAndPredict();
    // eslint-disable-next-line
  }, [location]);

  return (
    <div className="launch-card">
      <div className="launch-card__header">
        <h5 className="launch-card__title">{launch.name}</h5>
        <span className="launch-card__badge">Upcoming</span>
      </div>

      <div className="launch-card__content">
        <div className="launch-card__info">
          <div className="info-item">
            <i className="far fa-calendar-alt"></i>
            <div>
              <small>Launch Date</small>
              <p>{launchDate}</p>
            </div>
          </div>

          <div className="info-item">
            <i className="fas fa-map-marker-alt"></i>
            <div>
              <small>Location</small>
              <p>{launch.pad?.location?.name || "TBD"}</p>
            </div>
          </div>
        </div>

        <div className="launch-card__weather">
          <div className="weather-container">
            <div className="weather-icon">
              {weatherIcons[weather.condition] || weatherIcons["Loading..."]}
            </div>
            <div className="weather-info">
              <small>Weather Conditions</small>
              <p>
                {weather.condition}
                {weather.temp !== null && ` (${weather.temp}°C)`}
              </p>
            </div>
          </div>
        </div>

        <div className="launch-card__prediction">
          {loading && <Loader />}

          {error && (
            <div className="prediction-error">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          {prediction && !loading && (
            <div
              className={`prediction-result ${prediction.prediction
                .toLowerCase()
                .replace(" ", "-")}`}
            >
              <div className="prediction-main">
                <div className="prediction-icon">
                  {predictionIcons[prediction.prediction]}
                </div>
                <div className="prediction-text">
                  <small>Launch Prediction</small>
                  <p>{prediction.prediction}</p>
                </div>
              </div>

              <div className="prediction-stats">
                <div className="probability-bars">
                  <div className="prob-bar success">
                    <div className="prob-label">
                      <span>Success</span>
                      <span className="prob-value">
                        {prediction.success_probability}
                      </span>
                    </div>
                    <div className="bar-container">
                      <div
                        className="bar-fill success"
                        style={{
                          width: prediction.success_probability,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="prob-bar failure">
                    <div className="prob-label">
                      <span>Failure</span>
                      <span className="prob-value">
                        {prediction.failure_probability}
                      </span>
                    </div>
                    <div className="bar-container">
                      <div
                        className="bar-fill failure"
                        style={{
                          width: prediction.failure_probability,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="accuracy-indicator">
                  <div className="accuracy-circle">
                    <small>Accuracy</small>
                    <span className="accuracy-value">
                      {prediction.accuracy}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LaunchCard;
