# Rocket Launch Predictor (final-year project, CS6P05ES)

Deadline: final report due 19 Nov 2026. Priority is a working, deployed, honest demo. Keep changes small and tested.

## What this is
Estimates launch anomaly risk from launch site, vehicle type, agency and three daily weather values (temp_mean, precipitation, max_wind_speed). Data: GCAT launches merged with Open-Meteo weather, 13,593 usable rows, about 94:6 class balance.
Model: imblearn pipeline (preprocessing + SMOTE + RandomForest) with a tuned decision threshold. Test results: recall 0.630, F2 0.339, precision 0.119, PR-AUC 0.122. Weather adds little signal. The UI and docs must say the output is a rough estimate, not a safety tool.

## Layout
- backend/  FastAPI. Run from backend/: `uvicorn main:app --reload` (docs at /docs). Old HND code lives in routes/, pred/, tests/ and is being replaced.
- backend/model/  rocket_model.joblib and metadata.json (written by notebooks/modelling.ipynb). Do not retrain or edit these.
- frontend/  React (create-react-app style). API base URL from REACT_APP_API_URL.
- notebooks/, data/, reports/  analysis only. Do not read or edit them unless asked.

## Model bundle contract
joblib.load gives a dict: model (sklearn/imblearn pipeline taking a raw one-row DataFrame), threshold (float), num_cols, cat_cols, known_categories (dict of column to sorted list).
metadata.json keys: metrics, best_params, feature_importance_by_variable, top_encoded_features, eda_stats.
Load both once at startup, not per request.

## Target API (all under /api/v1)
- POST /predict: body has launch_site, lv_type, agency, temp_mean, precipitation, max_wind_speed. Returns risk probability, above_threshold flag, threshold, and a plain-language note. Unknown categories must not crash (the encoder groups rare ones).
- GET /features: known categories plus numeric ranges for the form.
- GET /eda-stats: eda_stats plus importance data from metadata.json.
- GET /health.
Validate input with Pydantic. Return clear 422 or 400 errors.

## Environment rules
- Python 3.10, use the root venv. Pin scikit-learn==1.7.2 and scipy==1.14.1 (SciPy 1.15.3 crashes on this Mac). imbalanced-learn and joblib are required in backend/requirements.txt.
- CORS must allow http://localhost:3000 and the Render frontend URL (read from an env var).
- Never put API keys in code. Keys go in .env files (git-ignored) and the Render dashboard. The old OpenWeatherMap key must be regenerated.
- Tests: pytest and httpx in backend/tests. Run them before saying a task is done.

## Working style
- Show a short plan and wait for approval before editing more than two files.
- One task per session. Keep diffs minimal. Do not refactor unrelated code.
- No em dashes in any prose or docs you write.
