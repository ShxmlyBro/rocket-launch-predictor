import React, { useCallback, useEffect, useState } from "react";
import { getFeatures, predict, errorMessage } from "../api";

const NUMERIC_FIELDS = [
  { key: "temp_mean", label: "Mean temperature (°C)" },
  { key: "precipitation", label: "Precipitation (mm)" },
  { key: "max_wind_speed", label: "Max wind speed (km/h)" },
];

const SELECT_FIELDS = [
  { key: "launch_site", label: "Launch site", catKeys: ["Launch_Site", "launch_site"] },
  { key: "lv_type", label: "Vehicle type", catKeys: ["LV_Type", "lv_type"] },
  { key: "agency", label: "Agency", catKeys: ["Agency", "agency"] },
];

function categoriesFor(categories, catKeys) {
  for (const k of catKeys) {
    if (categories[k]) return categories[k];
  }
  return [];
}

export default function PredictionTab() {
  const [features, setFeatures] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const load = useCallback(() => {
    setLoadError(null);
    setFeatures(null);
    getFeatures()
      .then((f) => {
        setFeatures(f);
        const init = {};
        SELECT_FIELDS.forEach((s) => {
          init[s.key] = categoriesFor(f.categories, s.catKeys)[0] || "";
        });
        NUMERIC_FIELDS.forEach((n) => {
          init[n.key] = "";
        });
        setValues(init);
      })
      .catch((e) => setLoadError(errorMessage(e)));
  }, []);

  useEffect(load, [load]);

  const onChange = (key) => (e) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setResult(null);
    const payload = { ...values };
    NUMERIC_FIELDS.forEach((n) => {
      payload[n.key] = Number(values[n.key]);
    });
    predict(payload)
      .then(setResult)
      .catch((err) => setSubmitError(errorMessage(err)))
      .finally(() => setSubmitting(false));
  };

  if (loadError) {
    return (
      <div className="alert alert-danger">
        <p className="mb-2">Could not load form options: {loadError}</p>
        <button className="btn btn-outline-danger btn-sm" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  if (!features) {
    return (
      <div className="text-center my-5" role="status">
        <div className="spinner-border" aria-hidden="true" />
        <p className="mt-3 mb-0">
          Loading form options. The server may be waking up, which can take up
          to a minute.
        </p>
      </div>
    );
  }

  const ranges = features.numeric_ranges || {};

  return (
    <div className="row g-4">
      <div className="col-lg-6">
        <form onSubmit={onSubmit}>
          {SELECT_FIELDS.map((s) => (
            <div className="mb-3" key={s.key}>
              <label htmlFor={s.key} className="form-label">
                {s.label}
              </label>
              <select
                id={s.key}
                className="form-select"
                value={values[s.key] || ""}
                onChange={onChange(s.key)}
                required
              >
                {categoriesFor(features.categories, s.catKeys).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {NUMERIC_FIELDS.map((n) => {
            const r = ranges[n.key] || {};
            return (
              <div className="mb-3" key={n.key}>
                <label htmlFor={n.key} className="form-label">
                  {n.label}
                  {r.min !== undefined && r.max !== undefined && (
                    <span className="text-muted">
                      {" "}
                      (range {String(r.min)} to {String(r.max)})
                    </span>
                  )}
                </label>
                <input
                  id={n.key}
                  type="number"
                  step="any"
                  className="form-control"
                  min={r.min}
                  max={r.max}
                  value={values[n.key]}
                  onChange={onChange(n.key)}
                  required
                />
              </div>
            );
          })}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Calculating..." : "Estimate risk"}
          </button>
        </form>
      </div>

      <div className="col-lg-6">
        {submitError && (
          <div className="alert alert-danger" role="alert">
            {submitError}
          </div>
        )}
        {result && (
          <div className="card">
            <div className="card-body">
              <h2 className="h5">Model risk score</h2>
              <p className="display-5 mb-1">
                {(result.risk_probability * 100).toFixed(1)}%
              </p>
              <p className="text-muted small">
                This score ranks relative risk. It is not a calibrated
                probability.
              </p>
              <p>
                <span
                  className={`badge ${
                    result.above_threshold ? "bg-danger" : "bg-success"
                  }`}
                >
                  {result.above_threshold
                    ? "Above threshold"
                    : "Below threshold"}
                </span>{" "}
                <span className="text-muted small">
                  (threshold {(result.threshold * 100).toFixed(1)}%)
                </span>
              </p>
              <p className="mb-0">{result.note}</p>
            </div>
          </div>
        )}
        <div className="alert alert-warning mt-3 mb-0" role="note">
          This is a rough estimate, not a safety tool. Weather adds little
          signal and precision is low, so most flagged launches will not be
          anomalies.
        </div>
      </div>
    </div>
  );
}
