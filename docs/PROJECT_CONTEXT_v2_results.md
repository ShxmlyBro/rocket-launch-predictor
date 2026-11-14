# v2 results (retrained on repaired weather data)

v1 (original, biased dataset) is preserved under git tag `v1-original-results`. v2 is the final model and the one deployed in the app.

## Data repair
- scripts/refetch_missing.py repaired 3,470 rows that had no weather: 3,460 were RATE_LIMITED (HTTP 429 from Open-Meteo during the first ingestion, which backed off 5 s and never retried), 5 ConnectionError, 5 ReadTimeout.
- Same endpoint, daily variables (temperature_2m_mean, precipitation_sum, wind_speed_10m_max), timezone UTC and default km/h wind as the original ingestion. Verification: 20 of 20 existing rows re-fetched through the new window logic matched stored values exactly.
- Output: data/merged_gcat_meteo_v2.csv (17,063 rows, all with weather). The v1 file had 13,593 usable rows.
- Bias in v1: the lost rows were concentrated in high-volume orbital vehicles (Falcon 9 kept 2 of 139 rows, Soyuz-U 2 of 350), so v1 was trained mostly on older vehicles.

## Dataset (v2)
- 17,063 rows, 1,208 anomalies (7.08%), 15,855 successes.
- Stratified 80/20 split, random_state=42: train 13,650 (966 anomalies), test 3,413 (242 anomalies).
- Encoded columns: 1,670 baseline, 227 after grouping rare categories (min_frequency=30).
- No-skill PR-AUC about 0.071.

## Final model
RF + SMOTE + tuned threshold. Best params: max_depth None, max_features sqrt, min_samples_leaf 3. Best CV PR-AUC 0.1726. Threshold 0.226 (max F2 on out-of-fold training predictions).
- Test: recall 0.760, precision 0.115, F1 0.200, F2 0.359, PR-AUC 0.161, ROC-AUC 0.724, accuracy 0.569.
- Confusion matrix [[1759, 1412], [58, 184]]: about 7.7 false alarms per anomaly caught.
- Bootstrap 95% intervals (1,000 resamples, test set, fixed threshold): recall 0.706 to 0.813, precision 0.099 to 0.131, F2 0.321 to 0.392, PR-AUC 0.132 to 0.197.

## Model comparison (test set)
| Model | Threshold | Precision | Recall | F2 | PR-AUC | ROC-AUC |
|---|---|---|---|---|---|---|
| Logistic Regression (baseline) | 0.5 | 0.145 | 0.583 | 0.364 | 0.186 | 0.720 |
| Random Forest (baseline) | 0.5 | 0.190 | 0.066 | 0.076 | 0.160 | 0.713 |
| Logistic Regression (grouped) | 0.5 | 0.125 | 0.690 | 0.363 | 0.168 | 0.716 |
| Random Forest (grouped) | 0.5 | 0.172 | 0.062 | 0.071 | 0.139 | 0.703 |
| Random Forest + SMOTE | 0.5 | 0.176 | 0.244 | 0.226 | 0.134 | 0.703 |
| RF + SMOTE (grid-searched, 0.5) | 0.5 | 0.164 | 0.397 | 0.309 | 0.161 | 0.724 |
| RF + SMOTE + tuned threshold (FINAL) | 0.226 | 0.115 | 0.760 | 0.359 | 0.161 | 0.724 |
| LR (grouped) + tuned threshold | 0.501 | 0.126 | 0.690 | 0.364 | 0.168 | 0.716 |
| RF (balanced, no SMOTE) + tuned threshold | 0.037 | 0.125 | 0.674 | 0.359 | 0.139 | 0.703 |

All models perform about the same. A simple Logistic Regression with a tuned threshold matches the final RF. The recall gain comes from threshold tuning.

## SMOTE check (same hyperparameters, 5-fold CV PR-AUC, training set only)
- RF + SMOTE: 0.1726 (std 0.0127).
- RF class_weight=balanced, no SMOTE: 0.1770 (std 0.0156).
- No meaningful difference. The apparent gain of the grid-searched SMOTE model over the default grouped RF came from hyperparameter tuning, not SMOTE.

## Ablation (CV PR-AUC)
| Feature set | PR-AUC | std | ROC-AUC |
|---|---|---|---|
| Site + vehicle + agency only | 0.179 | 0.012 | 0.734 |
| Weather only | 0.088 | 0.004 | 0.546 |
| Weather + site + vehicle + agency | 0.177 | 0.016 | 0.732 |
| Above + launch year | 0.196 | 0.010 | 0.758 |

Weather alone is only slightly above chance (0.071). Adding weather to the categorical features does not help. Launch year helps most.

## Permutation importance (PR-AUC drop when shuffled)
LV_Type 0.0430 (std 0.0088), Agency 0.0354 (0.0075), max_wind_speed 0.0092 (0.0042), Launch_Site 0.0075 (0.0064), precipitation -0.0008 (0.0054), temp_mean -0.0039 (0.0048).
Gini importance gives weather a 25.6% combined share (temp_mean 8.64, max_wind_speed 8.53, precipitation 8.43), which is inflated because Gini favours continuous features. Report the permutation result. Wind shows a small effect, which may stand in for location or climate.

## Interpretation for the report
- Site, vehicle and agency carry most of the signal. Weather adds little or nothing measurable.
- This is a screening-style tool, not a decision tool.
- Upcoming-launch weather is a forecast (Open-Meteo forecast API), whereas training used observed archive weather.
- The training data is dominated by historical sounding rockets and military missiles (for example Nike Cajun, Arcas, White Sands, Wallops), so most modern launch vehicles are poorly represented. The /upcoming endpoint flags those matches as "limited" with low confidence and no verdict.

## /upcoming endpoint (backend)
- Launch Library 2 for the schedule (anonymous limit about 15 requests per hour, so results are cached for 30 minutes with a bundled sample snapshot as fallback), Open-Meteo forecast for pad weather within 14 days.
- Names are mapped to GCAT codes. Falcon 9 / SpaceX at Cape Canaveral or Vandenberg now give "full" matches. Starship, Soyuz 2.1 and Roscosmos stay "limited" (approximate or unmapped). Any category the fitted encoder groups as infrequent is "limited".
- Pad to site matching is approximate (Kennedy to CC, modern Vandenberg to VS).

## Remaining work (as of 14 Nov 2026, report due 19 Nov)
- Frontend redesign (Launches, What-if, Insights, Astronauts, Events, About tabs).
- Deploy to Render (backend web service with /health check, frontend static site, CORS_ORIGINS and REACT_APP_API_URL set).
- Final report: Data chapter (rate-limiting problem and repair), Evaluation (v2 numbers above), Limitations (data bias, weather signal, forecast versus observed, threshold cost).
