# Weather-Conditioned Rocket Launch Success Predictor

Final-year Data Science project (module CS6P05ES), London Metropolitan University.
Student: M H M Shamly (E291042). Supervisor: Ms. Ishani Gunaratne.

An end-to-end pipeline that merges historical rocket launch records (GCAT) with historical weather (Open-Meteo), trains classical ML classifiers to estimate launch anomaly risk, and serves the result through a FastAPI backend and a React frontend.

## Status (update this section as you go)

| Stage | Status |
|---|---|
| Data ingestion (GCAT + Open-Meteo) | Done, 17,063 rows, 13,593 with full weather |
| Cleaning, EDA, preprocessing | Done |
| Baseline models (Logistic Regression, Random Forest) | Done, reproduced in `notebooks/modelling.ipynb` |
| Imbalance handling (SMOTE, tuned threshold, grid search) | Done, results in `docs/PROJECT_CONTEXT.md` |
| Backend rewiring (`/predict`, `/features`, `/eda-stats`) | To do |
| Frontend (prediction tab, EDA tab) | To do |
| Deployment on Render | To do |
| Final report | Due 9 November 2026 |

## Repository structure

```
backend/      FastAPI app (main.py, routes, model/ holds the saved model and metadata.json)
frontend/     React app
data/         merged_gcat_meteo.csv (raw source files are not committed)
notebooks/    eda_analysis.ipynb, modelling.ipynb
scripts/      ingest_data.py (GCAT + Open-Meteo ingestion with checkpointing)
reports/      figures and metric tables produced by the notebooks
docs/         proposal, interim report, project context notes
```

## Run it locally (macOS)

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
pip install jupyter ipykernel matplotlib seaborn
jupyter notebook          # or open the notebooks in VS Code and pick the venv kernel
```

Backend:

```bash
cd backend
uvicorn main:app --reload      # docs at http://127.0.0.1:8000/docs
```

Frontend:

```bash
cd frontend
npm install
npm start                      # http://localhost:3000
```

If SciPy crashes on import on macOS with a `__thread_bss` error, pin `scipy==1.14.1`.

## Data sources

- GCAT, General Catalog of Artificial Space Objects (Jonathan McDowell): https://planet4589.org/space/gcat/
- Open-Meteo Historical Weather API: https://open-meteo.com/en/docs/historical-weather-api

## Secrets

Never commit API keys. Keys live in `.env` files (ignored by git) and in the Render dashboard.
