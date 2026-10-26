# Project Context (as of 26 October 2026)

Purpose of this file: a single place that records what has been decided, built and found so far, so that any new session (or reader) can pick the project up without the original chat.

## 1. Project in one paragraph

Title: Weather-Conditioned Rocket Launch Success Predictor: An End-to-End Pipeline with Real-Time Web Interface.
Student: M H M Shamly, registration E291042, London Metropolitan University (final-year Data Science, module CS6P05ES). Supervisor: Ms. Ishani Gunaratne (confirm the exact spelling, it appears as both Gunaratne and Gunarathne).

The project merges GCAT launch records with Open-Meteo historical weather, trains classical ML classifiers (Logistic Regression and Random Forest) to estimate launch anomaly risk, and serves predictions through FastAPI and React, deployed on Render. It extends an earlier HND project (a React and FastAPI launch tracker with a single-feature Random Forest on `Space_Corrected.csv`).

## 2. Deadlines and methodology

- Topic approval: 30 April 2026 (done)
- Proposal: 30 May 2026 (submitted 1 June 2026 per cover page)
- Interim report: 1 August 2026, extended to 15 August 2026 (submitted)
- Final report: **9 November 2026**
- Methodology: Waterfall (fixed sequential phases, solo developer, fixed academic gates)
- Planned stages after interim: evaluation, backend extension, frontend extension, Render deployment, documentation, one-week buffer

## 3. Constraints set by the module

Real-world problem with measurable objective; 10k to 1M rows; full pipeline (ingestion, preprocessing, EDA, modelling, evaluation, interpretation, output); public data only; classical ML only; deployable; academic metrics; achievable by one student.

## 4. Data

- Source files: GCAT launch catalogue (`gcat.csv`, 12 MB, about 75,907 raw rows in the report) and `sites.tsv` (launch site coordinates).
- Ingestion script: `scripts/ingest_data.py`, queries Open-Meteo for each launch date and site coordinates, checkpointed. The interim report describes a run of roughly 14.5 hours.
- Merged file: `data/merged_gcat_meteo.csv`, **17,063 rows, 38 columns**.
- Weather columns actually available: `temp_mean`, `precipitation`, `max_wind_speed` (daily values). The proposal promised six variables (temperature, wind speed, gusts, precipitation, cloud cover, visibility). This is a deviation to explain in the limitations section.
- Missing weather in 3,470 rows, so **13,593 rows** are used for modelling (rows with incomplete weather are dropped, not imputed).
- `Harmonized_Outcome` is empty in all rows. The target is built from `FailCode`: present means failure/anomaly (1), absent means success (0).
- Class balance after cleaning: 12,783 successes and 810 anomalies, about 94:6.
- Split: stratified 80/20, `random_state=42`. Train 10,874 rows, test 2,719 rows (162 anomalies in test). The interim report wording around these numbers is muddled and should be corrected.
- Categorical features: `Launch_Site`, `LV_Type`, `Agency`. Numeric features: the three weather variables.

## 5. Repository and environment

Local path (Mac): `~/Documents/TopUp/Final Project/rocket-launch-predictor`. Original working folder: `~/Documents/TopUp/gcat-weather-project`.

```
backend/   FastAPI (still the old HND structure: main.py, routes/, middlewares/, pred/, tests/, data/Space_Corrected.csv)
frontend/  React (create-react-app style, src/components/LaunchSchedule.js etc.)
data/      merged_gcat_meteo.csv (raw/ is git-ignored)
notebooks/ eda_analysis.ipynb, modelling.ipynb
scripts/   ingest_data.py
reports/   figures and metric tables written by the notebooks
```

Environment notes:
- Machine: MacBook Air M2, VS Code, Terminal.
- Use the root `venv` (Python 3.10.7). Folders `.venv` and `backend/venv` also exist and should be ignored.
- **SciPy fix:** the default SciPy 1.15.3 crashed on import (`__thread_bss has a zero-fill section type`). Fixed by `pip install --force-reinstall --no-cache-dir --no-deps scipy==1.14.1`. scikit-learn is 1.7.2. Pin these in `requirements.txt` for Render.
- Packages used: pandas, scikit-learn, imbalanced-learn, joblib, matplotlib, seaborn, fastapi, uvicorn, pytest, httpx.
- `backend/requirements.txt` currently lacks `imbalanced-learn` (needed to load the saved pipeline).
- Security: the old `LaunchSchedule.js` contained an OpenWeatherMap key typed directly in the code and it appears in a submitted report. Regenerate that key and keep keys in `.env` files only.

## 6. Modelling work done (notebooks/modelling.ipynb)

Design decisions:
- Preprocessing and models live in one `imblearn` pipeline so that scaling, encoding and SMOTE only ever see training folds (no leakage).
- `OneHotEncoder(min_frequency=30)` groups rare sites, vehicles and agencies into an "infrequent" bucket, shrinking the encoded columns (1,209 in the baseline run, versus 1,288 quoted in the interim report: use the notebook's number).
- Threshold chosen from out-of-fold training predictions by maximising F2 (recall weighted above precision); test set used once.
- Grid search scored on PR-AUC (average precision), 5-fold stratified CV.
- The saved bundle (`backend/model/rocket_model.joblib`) takes a raw row of three weather values plus site, vehicle and agency, so the API does no manual column alignment. `backend/model/metadata.json` holds metrics, feature importance and EDA statistics for the `/features` and `/eda-stats` endpoints.

Results on the held-out test set (real data):

| Model | Threshold | Accuracy | Precision | Recall | F1 | F2 | PR-AUC | ROC-AUC |
|---|---|---|---|---|---|---|---|---|
| Logistic Regression (baseline) | 0.50 | 0.730 | 0.121 | 0.562 | 0.199 | 0.325 | 0.166 | 0.719 |
| Random Forest (baseline) | 0.50 | 0.932 | 0.271 | 0.080 | 0.124 | 0.093 | 0.134 | 0.703 |
| Logistic Regression (grouped) | 0.50 | 0.616 | 0.099 | 0.673 | 0.173 | 0.312 | 0.152 | 0.713 |
| Random Forest (grouped) | 0.50 | 0.929 | 0.218 | 0.074 | 0.111 | 0.085 | 0.115 | 0.690 |
| Random Forest + SMOTE | 0.50 | 0.887 | 0.128 | 0.154 | 0.140 | 0.148 | 0.104 | 0.687 |
| RF + SMOTE (tuned, default threshold) | 0.50 | 0.882 | 0.130 | 0.173 | 0.149 | 0.162 | 0.122 | 0.705 |
| **RF + SMOTE + tuned threshold (final)** | 0.167 | 0.701 | 0.119 | 0.630 | 0.200 | 0.339 | 0.122 | 0.705 |

Reference: the no-skill PR-AUC equals the anomaly rate, about 0.06.

Interpretation (to be stated honestly in the report):
- The recall gain (8% to 63%) comes mainly from moving the decision threshold, not from SMOTE. SMOTE did not improve ranking quality (PR-AUC about 0.12).
- Logistic Regression is competitive with the final Random Forest and has the best PR-AUC. Only the Random Forest has had a tuned threshold so far; a fair comparison tunes every model.
- All models are about 2 to 3 times better than chance (ROC-AUC 0.70 to 0.72). Weather plus operational features carry real but limited signal, which is consistent with the limitations already stated (surface-level daily weather, no upper-air data, mechanical causes of failure not in the data).
- Gini feature importance for the final Random Forest: LV_Type 32.45%, Agency 18.93%, Launch_Site 13.47%, max_wind_speed 12.85%, temp_mean 11.70%, precipitation 10.60%. Weather combined is 35.2% (the interim report quoted 39.6% for the baseline). Gini importance favours continuous features, so the weather share is likely inflated; permutation importance is the more reliable check. The top single feature is the "infrequent vehicle type" bucket, which acts as a proxy for vehicle maturity, not a weather effect.

Pending experiments (code was given in chat, paste into `modelling.ipynb`, then record the outputs here):
1. Threshold tuning for Logistic Regression and balanced Random Forest (fair comparison).
2. Feature ablation by cross-validated PR-AUC: site/vehicle/agency only, weather only, both, both plus launch year. This answers the research question "does weather add signal?".
3. Permutation importance on the test set.
Results to record: (fill in after running)

## 7. Remaining work and plan to 9 November 2026

| Dates | Task |
|---|---|
| 26 to 27 Oct | Finish experiments above, confirm `backend/model/` files exist |
| 28 to 30 Oct | Rewire backend: `/predict`, `/features`, `/eda-stats`, load joblib bundle at startup, add `imbalanced-learn` and pinned versions to `requirements.txt`, test in Swagger UI |
| 31 Oct to 2 Nov | Frontend prediction tab and EDA tab, `REACT_APP_API_URL` env var, CORS for the frontend URL, deploy to Render (web service for backend, static site for frontend) |
| 3 to 8 Nov | Finish the dissertation, evaluation chapter, user manual, proofreading |
| 9 Nov | Submit |

Backend notes: `/predict` accepts site, vehicle, agency and three weather values and returns the anomaly risk plus whether it is above the saved threshold. The UI must state that the output is an estimate. Render free tier sleeps after inactivity (cold start).

## 8. Known issues to fix in the written report

- Section 3.3 wording: 10,874 is the training set and 2,719 is the test set (it was written as if 2,719 were 5.96% of 10,874).
- Encoded column count: state the number the final notebook prints (1,209), not 1,288, or explain the difference.
- Weather variables: three daily variables were used, not the six in the proposal. Explain why in the limitations.
- Supervisor surname spelling: use one spelling everywhere.
- Do not present the vehicle-type importance as a weather effect.
- Be explicit that SMOTE was tested and did not improve ranking quality; the recall gain is from threshold tuning.

## 9. Other material produced in this project

- Proposal approval form text, full proposal document (SMART objectives, Waterfall, resource justification, feasibility and ethics discussion), and proposal presentation content (9 slides, with speaker notes).
- A minimalist Gantt chart (PlantUML and JSON) for presentation use.
- Source documents for the project live in `docs/`: the proposal PDF and the interim report PDF.

## 10. Writing style for the dissertation

Conversational but formal tone, varied sentence lengths, no buzzwords, no em dashes. Diagrams for methodology sections as PlantUML or draw.io-compatible code.
