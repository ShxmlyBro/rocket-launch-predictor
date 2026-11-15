# Rocket Launch Predictor (final-year project, CS6P05ES)

Deadline: final report due 19 Nov 2026. Priority is a working, honest demo that runs locally from a fresh copy (see README.md). Deployment is NOT required (supervisor's decision). Keep changes small and tested.

## What this is
Estimates a launch anomaly risk reading from launch site, vehicle type, agency and three daily weather values (temp_mean, precipitation, max_wind_speed). Data: GCAT launches merged with Open-Meteo weather, v2 dataset data/merged_gcat_meteo_v2.csv, 17,063 usable rows, 1,208 anomalies (7.08%). Split: stratified 80/20, random_state=42, train 13,650, test 3,413 (242 anomalies).
Model (v2, final): imblearn pipeline (preprocessing + SMOTE + RandomForest) with a tuned decision threshold of 0.226 (max F2 on out-of-fold training predictions). Test results: recall 0.760, precision 0.115, F2 0.359, PR-AUC 0.161, ROC-AUC 0.724, about 7.7 false alarms per anomaly caught. Weather adds little signal (site, vehicle and agency carry most of it). Full tables: docs/PROJECT_CONTEXT_v2_results.md.
The output is a ranking score called "Model risk score", NOT a probability. The UI and docs must say it is a rough estimate, not a safety tool. Never use the word "accuracy" in the UI.

## Layout
- backend/  FastAPI. Run from backend/: `uvicorn main:app --reload` (docs at /docs). Files: main.py, model_service.py, score_reference.py, upcoming_service.py, space_service.py, space_cache.py, schemas.py, routes/ (rockets_routes.py, space_routes.py), middlewares/, tests/, scripts/.
- backend/model/  rocket_model.joblib, metadata.json, score_reference.json. These are generated files. Never edit them by hand and do not retrain unless asked. modelling_v2.py writes to backend/model_v2/; promoting a retrained model means copying the two files into backend/model/ and rerunning backend/scripts/make_score_reference.py.
- frontend/  React (Create React App). API base URL from REACT_APP_API_URL (default http://localhost:8000; frontend/.env.example has only that line).
- scripts/  data pipeline and modelling (ingest_data.py, refetch_missing.py, modelling_v2.py, extra_checks_v2.py). notebooks/, data/, reports/, reports_v2/ are analysis only: do not read or edit them unless asked.
- docs/  project notes, results summary, architecture.puml and data_pipeline.puml (PlantUML).
- run_local.sh  starts backend and frontend, checks ports 8000 and 3000, stops both on Ctrl+C.

## Model bundle contract
joblib.load gives a dict: model (pipeline taking a raw one-row DataFrame), threshold (float), num_cols, cat_cols, known_categories (dict of column to sorted list).
metadata.json keys: metrics, best_params, feature_importance_by_variable, top_encoded_features, eda_stats.
score_reference.json (built from the HELD-OUT test set only): generated_at, n_test, n_anomalies, threshold, quantiles (101 values), bands (5 equal-count bands with lower, upper, n, anomalies, observed_rate). It is optional: if missing, the reading fields are null.
Load all of them once at startup, not per request.

## API (all under /api/v1, plus GET /health at the root)
- GET /health (also /api/v1/health).
- POST /predict: launch_site, lv_type, agency, temp_mean, precipitation, max_wind_speed. Returns risk_probability (the model risk score, field name kept for compatibility), above_threshold, threshold, note, and risk_percentile, similar_rate, similar_n from the score reference. Never add a field named probability. Unknown categories must not crash. Pydantic validation gives 422.
- GET /features: known categories and numeric ranges for the form.
- GET /eda-stats: eda_stats plus importance data from metadata.json.
- GET /upcoming: Launch Library 2 launches within 14 days, scored with Open-Meteo forecast weather, each marked match_quality "full" or "limited". Limited ones get a score but no verdict (above_threshold null). Cached 30 minutes, with a bundled snapshot fallback (stale true).
- GET /space/astronauts, /space/events, /space/missions, /space/news, /space/iss: Explore data. Cached, with bundled snapshots in backend/data (stale true, _note "sample data"). TTLs: astronauts 24 h, events 3 h, missions 6 h, news 30 min, ISS 10 s.
- One shared rate limiter caps Launch Library 2 calls at 8 per hour for /upcoming and /space/* together. Keep it, the TTLs, the snapshots and the stale flag as they are.
- At startup a background thread warms the cache (news and ISS first, then astronauts, events and missions about 30 s apart). SPACE_WARMUP=0 skips it, and the test suite sets that.

## Frontend
Tabs: Launches (next-launch hero, launch cards, risk reading with plain-language sentence, gauge, filters), What-if, Insights, About the model, Explore. Explore has Astronauts, Events, Missions, News, ISS now and Space basics.
- Launch cards: full matches show Flagged or Not flagged; limited matches show a "Low confidence" pill, the score, no verdict, and a Why? expander. A null score shows "Forecast not available yet".
- ISS now: a 3D globe (react-globe.gl, lazy loaded in its own chunk) with a 2D map toggle. If WebGL is unavailable, the chunk fails or the globe errors, it falls back to the 2D map with "3D view unavailable on this device". The ISS poll (15 s, paused when the tab is hidden) is the only polling.
- Stale Explore data is refetched once after about 10 s, and the notice has a Refresh button.
- The globe is mocked in Jest. Do not import react-globe.gl, three, topojson-client or world-atlas in test code.
- A shared 1 second ticker drives all countdowns. Add no new polling.

## Environment rules
- Python 3.10.7 and Node 20. Use the root venv (`venv/` at the repo root). Pin scikit-learn==1.7.2 and scipy==1.14.1 (SciPy 1.15.3 crashes on this Mac). imbalanced-learn and joblib are required in backend/requirements.txt.
- CORS allows http://localhost:3000 plus any origins in the CORS_ORIGINS environment variable.
- Never put API keys in code. Keys go in git-ignored .env files. Never read or print .env files. The old OpenWeatherMap key from the earlier version of this project must be revoked (it was read from a frontend .env, and it also appears in a submitted report).
- Tests: pytest and httpx in backend/tests, run from backend/ (`python -m pytest -q`, currently 53 passing). Frontend: from frontend/ run `npm test -- --watchAll=false` (currently 47 passing in 4 suites) and `npm run build`. Run them before saying a task is done. Tests make no real network calls.

## Working style
- Show a short plan and wait for approval before editing more than two files.
- One task per session. Keep diffs minimal. Do not refactor unrelated code.
- Commit and merge only when asked. Never push unless asked.
- No em dashes in any prose, docs or UI text.
