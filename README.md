# Rocket Launch Risk Estimator

A final-year project (CS6P05ES). Everything runs locally; no deployment is needed. It estimates a launch anomaly risk reading from the launch site, vehicle type, agency and three daily weather values (mean temperature, precipitation, maximum wind speed). The model is a Random Forest trained on GCAT launch records merged with Open-Meteo weather (17,063 usable launches, 7.08% anomalies). It is a rough screening estimate, not a safety tool. Weather adds little signal: site, vehicle and agency carry almost all of it. The model output is a ranking score, not a probability of failure, and most launches it flags are false alarms (about 7.7 per real anomaly caught). The app translates the score into how often past launches with a similar score failed, using the held-out test set.

## Architecture

```
GCAT launches + sites          Open-Meteo archive
        |                             |
        +-------- scripts/ingest_data.py --------> data/merged_gcat_meteo.csv
                                      |
                      scripts/refetch_missing.py   (repairs rows with no weather)
                                      |
                                      v
                      data/merged_gcat_meteo_v2.csv
                                      |
                      scripts/modelling_v2.py      (SMOTE + Random Forest + tuned threshold)
                                      |
                                      v
        backend/model/rocket_model.joblib + metadata.json
        backend/scripts/make_score_reference.py --> backend/model/score_reference.json
                                      |
                                      v
   FastAPI backend (backend/)  <----- Launch Library 2 (schedule), Open-Meteo forecast,
   /api/v1/predict, /upcoming,         Spaceflight News API, wheretheiss.at
   /features, /eda-stats, /space/*
                                      |
                                      v  JSON over HTTP (REACT_APP_API_URL)
                         React frontend (frontend/)
```

- **Data pipeline:** `scripts/ingest_data.py` and `scripts/refetch_missing.py` build the merged dataset.
- **Model training:** `scripts/modelling_v2.py` trains and evaluates the model and saves a bundle (model, threshold, column lists, known categories).
- **Backend:** FastAPI loads the model bundle and the score reference once at startup. Upcoming launches come from Launch Library 2, are scored with forecast weather and cached, with a bundled snapshot as fallback. The Explore data is cached the same way, and a background thread warms the cache at startup.
- **Frontend:** React (Create React App). Tabs: Launches, What-if, Insights, About the model, Explore.

## Folder structure

```
backend/              FastAPI app (run from here)
  main.py               app and startup (loads model, starts cache warm-up)
  model_service.py      loads the model bundle, runs predictions
  score_reference.py    percentile and "similar launches" lookup
  upcoming_service.py   Launch Library 2 schedule + Open-Meteo forecast scoring
  space_service.py      Explore data (astronauts, events, missions, news, ISS)
  space_cache.py        shared rate limiter and stale-while-revalidate cache
  schemas.py            Pydantic request and response models
  routes/               rockets_routes.py, space_routes.py
  middlewares/          CORS setup
  model/                rocket_model.joblib, metadata.json, score_reference.json
  data/                 bundled snapshots (space_*.json, upcoming_sample.json)
  scripts/              make_score_reference.py, make_space_snapshots.py
  tests/                pytest suite
  requirements.txt, requirements-dev.txt
frontend/             React app (Create React App)
  src/components/       tabs, launch cards, risk gauge, What-if form
  src/components/explore/  Explore sections and the 3D ISS globe
  src/utils/            formatting, shared countdown ticker, data hooks
  public/, package.json
scripts/              data pipeline and modelling (ingest_data.py, refetch_missing.py,
                      modelling_v2.py, extra_checks_v2.py; modelling.py is the v1 run)
data/                 merged datasets (merged_gcat_meteo.csv, merged_gcat_meteo_v2.csv)
notebooks/            exploratory analysis and the v1 modelling notebook
reports/              v1 results (tables and figures)
reports_v2/           v2 results (tables, figures, run log)
docs/                 project notes, results summary, PlantUML diagrams, reports
run_local.sh          starts backend and frontend together
```

The diagrams are in `docs/architecture.puml` (components) and `docs/data_pipeline.puml` (data to model). Render them with any PlantUML tool.

## Requirements

- Python 3.10.7
- Node 20 (with npm)
- Internet access for the first install. After that, the app runs locally with no deployment. The live-data features (upcoming launches, Explore) call public APIs and fall back to bundled sample data if they cannot be reached.

## Setup

From the repository root:

```
python3.10 -m venv venv
source venv/bin/activate
pip install -r backend/requirements-dev.txt
cd frontend
npm install
cd ..
```

`requirements-dev.txt` adds `pytest` on top of `requirements.txt`. `scikit-learn==1.7.2` and `scipy==1.14.1` are pinned on purpose (SciPy 1.15.3 crashes on the author's Mac).

The data and modelling scripts also import `requests`, `tqdm` and `matplotlib`, which are not in `requirements-dev.txt`. Install them only if you want to rerun the scripts: `pip install requests tqdm matplotlib`.

## Run locally

Quick way, from the repository root: `./run_local.sh`. It checks the setup, refuses to start if port 8000 or 3000 is busy, starts both servers, prints the URLs and stops both on Ctrl+C.

Or start them yourself in two terminals.

Backend (from `backend/`, virtual environment active):

```
cd backend
uvicorn main:app --reload
```

It serves on http://localhost:8000. Interactive API docs are at http://localhost:8000/docs.

Frontend (from `frontend/`):

```
cd frontend
npm start
```

It serves on http://localhost:3000. The frontend finds the API through `REACT_APP_API_URL`. If it is not set, the app uses `http://localhost:8000`, which is what you want locally. To set it explicitly, copy the example file, which contains only that one line:

```
cp frontend/.env.example frontend/.env
```

```
REACT_APP_API_URL=http://localhost:8000
```

Restart `npm start` after changing it. Backend environment variables are all optional:

| Variable | Purpose |
|---|---|
| `CORS_ORIGINS` | Extra allowed origins, comma separated. `http://localhost:3000` is always allowed. |
| `LL2_API_KEY` | Optional Launch Library 2 token for a higher request limit. Keep it in a git-ignored `.env`, never in code. |
| `SPACE_WARMUP` | Set to `0` to skip the background cache warm-up at startup. |

## How to use the app

1. Open http://localhost:3000. The Launches tab lists upcoming launches with a risk reading, a gauge and a countdown. Filter by provider, search, or sort by date or risk.
2. Open "Details" on a card for the technical reading, the pad and the forecast weather. Launches the model does not know well are marked "Low confidence" and get no verdict.
3. The What-if tab scores your own combination of site, vehicle, agency and weather.
4. Insights and About the model show the data and the test results. Explore has astronauts, events, missions, news, a live ISS view (3D globe or 2D map) and a space glossary.
5. Read the "What does this mean?" note on any risk reading: it describes how often similar past launches failed, not the chance that this launch will fail.

## API endpoints

All routes are under `/api/v1`, except the extra root `/health`. Interactive docs are at `/docs`.

| Method and path | What it returns |
|---|---|
| `GET /health` (also `GET /api/v1/health`) | `status` and whether the model is loaded |
| `POST /api/v1/predict` | Model risk score, `above_threshold`, `threshold`, a plain-language note, and `risk_percentile`, `similar_rate`, `similar_n` from the score reference. Body: `launch_site`, `lv_type`, `agency`, `temp_mean`, `precipitation`, `max_wind_speed`. Invalid input returns 422. |
| `GET /api/v1/features` | Known categories and numeric ranges for the form |
| `GET /api/v1/eda-stats` | Test metrics, dataset statistics and feature importance from `metadata.json` |
| `GET /api/v1/upcoming` | Launches in the next 14 days from Launch Library 2, scored with forecast weather. Each is `full` or `limited` match quality. Cached for 30 minutes, with a bundled snapshot (`stale: true`) as fallback. |
| `GET /api/v1/space/astronauts` | Astronaut profiles (Launch Library 2) |
| `GET /api/v1/space/events` | Space events (Launch Library 2) |
| `GET /api/v1/space/missions` | Missions (Launch Library 2) |
| `GET /api/v1/space/news` | News headlines (Spaceflight News API) |
| `GET /api/v1/space/iss` | Current ISS position (wheretheiss.at) |

The `/space/*` and `/upcoming` responses are cached. A request never waits on an external call: it gets cached data, or the bundled sample snapshot with `stale: true`, and an expired entry is refreshed in the background. The backend also warms this cache in the background at startup.

## Run the tests

```
cd backend
python -m pytest -q
```

```
cd frontend
npm test -- --watchAll=false
```

The tests make no real network calls and use a stub for the 3D globe.

## Reproduce the model

Rerunning these is optional: the trained model is already in `backend/model/`. Run the scripts from the repository root unless noted, with the virtual environment active. The raw GCAT files are not in the repository.

| Step | Command | Reads | Writes | Time |
|---|---|---|---|---|
| 1. Ingest | `python <repo>/scripts/ingest_data.py`, run from the folder that holds the raw files (the script uses relative file names) | `gcat.csv`, `sites.tsv` (GCAT), Open-Meteo archive API | `merged_gcat_meteo.csv` in the same folder (move it to `data/`) | about 14.5 hours (checkpointed every 500 rows) |
| 2. Repair | `python scripts/refetch_missing.py` | `data/merged_gcat_meteo.csv`, Open-Meteo archive API | `data/merged_gcat_meteo_v2.csv` (plus a resume state file while running) | about 45 minutes, resumable |
| 3. Train | `cd scripts && python modelling_v2.py` | `data/merged_gcat_meteo_v2.csv` | `backend/model_v2/rocket_model.joblib`, `backend/model_v2/metadata.json`, tables and figures in `reports_v2/` | about 1 minute |

Notes:
- The first ingestion run was rate limited by Open-Meteo (HTTP 429) and left 3,470 rows without weather: 3,460 rate limited, 5 connection errors and 5 timeouts. `refetch_missing.py` repaired all of them, grouping launches by site and date window so one request covers many rows. Without the repair, the model would have been trained mostly on older vehicles (for example Falcon 9 kept only 2 of 139 rows).
- `refetch_missing.py` accepts `--limit N` and `--verify N` for small test runs that do not touch the v2 file.
- `modelling_v2.py` writes to `backend/model_v2/`, but the app loads `backend/model/`. To use a retrained model, copy the two files into `backend/model/`, then rebuild the score reference. The saved v2 model was already promoted this way.
- Score reference (from the repository root): `cd backend && ../venv/bin/python scripts/make_score_reference.py`. It scores the held-out test set only and writes `backend/model/score_reference.json`. It stops if the test size (3,413), anomaly count (242) or recall (184 of 242) does not match.
- `scripts/extra_checks_v2.py` re-runs extra checks on the v2 model and writes `reports_v2/extra_checks.csv`.

## v2 results

Trained on the repaired dataset (17,063 rows, 1,208 anomalies, 7.08%). Stratified 80/20 split with `random_state=42`: 13,650 training rows (966 anomalies) and 3,413 test rows (242 anomalies). A model that ranks at random scores a PR-AUC of about 0.071.

Final model: Random Forest with SMOTE and a tuned decision threshold of 0.226 (chosen by maximum F2 on out-of-fold training predictions). Best parameters: `max_depth` None, `max_features` sqrt, `min_samples_leaf` 3. On the test set: recall 0.760, precision 0.115, F2 0.359, PR-AUC 0.161, ROC-AUC 0.724. Confusion matrix `[[1759, 1412], [58, 184]]`, about 7.7 false alarms per anomaly caught. Bootstrap 95% intervals: recall 0.706 to 0.813, precision 0.099 to 0.131, F2 0.321 to 0.392, PR-AUC 0.132 to 0.197.

Model comparison (test set):

| Model | Threshold | Precision | Recall | F2 | PR-AUC | ROC-AUC |
|---|---|---|---|---|---|---|
| Logistic Regression (baseline) | 0.5 | 0.145 | 0.583 | 0.364 | 0.186 | 0.720 |
| Random Forest (baseline) | 0.5 | 0.190 | 0.066 | 0.076 | 0.160 | 0.713 |
| Logistic Regression (grouped) | 0.5 | 0.125 | 0.690 | 0.363 | 0.168 | 0.716 |
| Random Forest (grouped) | 0.5 | 0.172 | 0.062 | 0.071 | 0.139 | 0.703 |
| Random Forest + SMOTE | 0.5 | 0.176 | 0.244 | 0.226 | 0.134 | 0.703 |
| RF + SMOTE (grid-searched, 0.5) | 0.5 | 0.164 | 0.397 | 0.309 | 0.161 | 0.724 |
| RF + SMOTE + tuned threshold (final) | 0.226 | 0.115 | 0.760 | 0.359 | 0.161 | 0.724 |
| LR (grouped) + tuned threshold | 0.501 | 0.126 | 0.690 | 0.364 | 0.168 | 0.716 |
| RF (balanced, no SMOTE) + tuned threshold | 0.037 | 0.125 | 0.674 | 0.359 | 0.139 | 0.703 |

All models perform about the same. A simple Logistic Regression with a tuned threshold matches the final Random Forest, and the recall gain comes from the threshold tuning. In a 5-fold CV check on the training set, SMOTE made no meaningful difference (PR-AUC 0.1726 with SMOTE, 0.1770 with balanced class weights).

Feature ablation (5-fold CV PR-AUC):

| Feature set | PR-AUC | Std | ROC-AUC |
|---|---|---|---|
| Site + vehicle + agency only | 0.179 | 0.012 | 0.734 |
| Weather only | 0.088 | 0.004 | 0.546 |
| Weather + site + vehicle + agency | 0.177 | 0.016 | 0.732 |
| Above + launch year | 0.196 | 0.010 | 0.758 |

Permutation importance (PR-AUC drop when shuffled): LV_Type 0.0430, Agency 0.0354, max_wind_speed 0.0092, Launch_Site 0.0075, precipitation -0.0008, temp_mean -0.0039. Weather alone is only slightly above chance, and adding it to the categorical features does not help.

The "similar launches" percentages in the app come from five equal-count score bands on the held-out test set of 3,413 launches. Observed anomaly rates rise from 1.2% in the lowest band to 15.8% in the highest.

## Data sources and credits

- GCAT, the General Catalog of Artificial Space Objects by Jonathan McDowell: historical launches, sites, vehicles, agencies and outcomes.
- Open-Meteo: archived daily weather for past launches and forecasts for upcoming ones.
- Launch Library 2 (The Space Devs): the upcoming launch schedule, astronauts, events and missions.
- Spaceflight News API (The Space Devs): news headlines in the Explore tab.
- wheretheiss.at: the live ISS position.
- Land outlines: Natural Earth (public domain), via world-atlas, used for the 3D globe.

## Known limitations

- Weather adds little or no measurable signal. Site, vehicle and agency carry most of it.
- The score is a ranking score, not a probability. The model was trained on oversampled data, so the raw score is not calibrated.
- Precision is low (0.115). At the chosen threshold most flagged launches are false alarms.
- The training data is dominated by older vehicles, mainly sounding rockets and military missiles. Many modern vehicles are poorly represented, so those launches are marked "low confidence" and get no flagged or not-flagged verdict.
- The model was trained on observed weather, but upcoming launches are scored with a forecast, which is less exact.
- Launch Library 2 allows about 15 anonymous requests per hour. The app caps its own calls at 8 per hour and serves cached data or a bundled snapshot (shown as sample data) when live data is unavailable. Open-Meteo and the other free APIs also have rate limits.
- Right after the backend starts, the Explore tab can briefly show sample data (marked "Sample data") while the cache warms up. The page retries once after about 10 seconds, and the Refresh button on the notice refetches.
- Pad-to-site matching for upcoming launches is approximate in some cases.
- The 3D globe needs WebGL. Without it the app shows a 2D map instead.
