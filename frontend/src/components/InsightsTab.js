import React, { useCallback, useEffect, useState } from "react";
import { getEdaStats, errorMessage } from "../api";
import { SkeletonPanel } from "./Loading";

function Bar({ pct, max = 100, variant = "primary" }) {
  const width = Math.max(0, Math.min(100, (pct / max) * 100));
  return (
    <div className="progress" style={{ height: "1rem" }}>
      <div
        className={`progress-bar bg-${variant}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

const WEATHER_LABELS = {
  temp_mean: "Mean temperature (°C)",
  precipitation: "Precipitation (mm)",
  max_wind_speed: "Max wind speed (km/h)",
};

export default function InsightsTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    getEdaStats()
      .then(setData)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(load, [load]);

  if (error) {
    return (
      <div className="alert alert-danger">
        <p className="mb-2">Could not load statistics: {error}</p>
        <button className="btn btn-outline-danger btn-sm" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return <SkeletonPanel label="Loading statistics" />;
  }

  const eda = data.eda_stats || {};
  const means = eda.weather_means_by_outcome || {};
  const sites = eda.top_sites || [];
  const importance = Object.entries(data.feature_importance_by_variable || {});
  const topEncoded = Object.entries(data.top_encoded_features || {});
  const maxImp = Math.max(1, ...importance.map(([, v]) => v));
  const maxEnc = Math.max(1, ...topEncoded.map(([, v]) => v));
  const maxRate = Math.max(1, ...sites.map((s) => s.anomaly_rate));
  const successPct = eda.total_records
    ? (eda.success / eda.total_records) * 100
    : 0;

  return (
    <div className="row g-4">
      <section className="col-12">
        <h2 className="h5">Class balance</h2>
        <p className="mb-1">
          {eda.total_records?.toLocaleString()} usable launches:{" "}
          {eda.success?.toLocaleString()} successes,{" "}
          {eda.anomaly?.toLocaleString()} anomalies ({eda.anomaly_pct}%).
        </p>
        <div className="progress" style={{ height: "1.5rem" }}>
          <div className="progress-bar bg-success" style={{ width: `${successPct}%` }}>
            Success
          </div>
          <div
            className="progress-bar bg-danger"
            style={{ width: `${100 - successPct}%` }}
          />
        </div>
        <p className="text-muted small mt-1">
          Heavily imbalanced, which is why the model uses a tuned decision
          threshold instead of the default 50%.
        </p>
      </section>

      <section className="col-lg-6">
        <h2 className="h5">Top sites by anomaly rate</h2>
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Site</th>
                <th className="text-end">Launches</th>
                <th className="text-end">Anomalies</th>
                <th style={{ width: "35%" }}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.Launch_Site}>
                  <td>{s.Launch_Site}</td>
                  <td className="text-end">{s.launches}</td>
                  <td className="text-end">{s.anomalies}</td>
                  <td>
                    <Bar pct={s.anomaly_rate} max={maxRate} variant="danger" />
                    <span className="small">{s.anomaly_rate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="col-lg-6">
        <h2 className="h5">Weather means by outcome</h2>
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Variable</th>
              <th className="text-end">Anomaly</th>
              <th className="text-end">Success</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(WEATHER_LABELS).map((k) => (
              <tr key={k}>
                <td>{WEATHER_LABELS[k]}</td>
                <td className="text-end">{means.Anomaly?.[k]}</td>
                <td className="text-end">{means.Success?.[k]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-body-secondary small">
          The averages are close for anomalies and successes.
        </p>
      </section>

      <section className="col-12" aria-labelledby="weather-signal">
        <div className="alert alert-secondary mb-0">
          <h2 className="h5" id="weather-signal">
            How much does weather matter?
          </h2>
          <p className="mb-0">
            Not much. Weather alone is barely above chance. Wind speed has a
            small effect, while temperature and precipitation add nothing
            measurable. Most of the signal comes from the vehicle type and the
            agency. The importance bars below can make weather look larger than
            it is, so read them with this in mind.
          </p>
        </div>
      </section>

      <section className="col-lg-6">
        <h2 className="h5">Importance by variable</h2>
        <p className="text-body-secondary small">
          Impurity-based importance from the random forest. It tends to
          overstate numeric features such as weather.
        </p>
        {importance.map(([name, v]) => (
          <div className="mb-2" key={name}>
            <div className="d-flex justify-content-between small">
              <span>{name}</span>
              <span>{v}%</span>
            </div>
            <Bar pct={v} max={maxImp} />
          </div>
        ))}
      </section>

      <section className="col-lg-6">
        <h2 className="h5">Top encoded features</h2>
        {topEncoded.map(([name, v]) => (
          <div className="mb-2" key={name}>
            <div className="d-flex justify-content-between small">
              <span>{name}</span>
              <span>{v}%</span>
            </div>
            <Bar pct={v} max={maxEnc} variant="secondary" />
          </div>
        ))}
      </section>
    </div>
  );
}
