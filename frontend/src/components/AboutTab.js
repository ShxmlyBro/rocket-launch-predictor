import React, { useCallback, useEffect, useState } from "react";
import { getEdaStats, errorMessage } from "../api";
import {
  FiAlertCircle,
  FiBarChart2,
  FiCloud,
  FiDatabase,
  FiInfo,
  FiShield,
  FiTarget,
} from "react-icons/fi";
import { SkeletonPanel } from "./Loading";

import { falseAlarmsPerCaught, pct } from "../utils/format";

const Card = ({ icon: Icon, title, children, className = "" }) => (
  <div className={`card h-100 hover-lift ${className}`}>
    <div className="card-body p-3 p-md-4">
      <h3 className="section-title h5">
        <Icon aria-hidden="true" /> {title}
      </h3>
      {children}
    </div>
  </div>
);
// Metrics are read from the API. The raw key is intentionally not rendered
// generically, so only the metrics listed here are ever shown.
const METRIC_ROWS = [
  { key: "Recall", help: "Share of real anomalies the model flags." },
  { key: "Precision", help: "Share of flagged launches that really were anomalies." },
  { key: "F2", help: "Score that weights recall higher than precision." },
  { key: "PR-AUC", help: "Ranking quality on the rare anomaly class (no-skill is about the anomaly rate)." },
  { key: "ROC-AUC", help: "Ability to rank anomalies above successes." },
];

const LIMITATIONS = [
  "Weather adds little signal. Weather alone is barely above chance, and vehicle type and agency carry most of what the model uses.",
  "Forecast versus observed weather. The model was trained on observed weather, but upcoming launches use forecasts, which are less exact.",
  "The historical data is skewed to older vehicles, mainly sounding rockets and military missiles, so modern vehicles are poorly represented. That is why many upcoming launches are shown as low confidence.",
  "Many false alarms at the chosen threshold. The threshold favours catching anomalies over being right when it flags one.",
];

export default function AboutTab() {
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

  const metrics = data?.metrics || {};
  const threshold = metrics.Threshold;
  const falseAlarms = falseAlarmsPerCaught(metrics.Precision);
  const total = data?.eda_stats?.total_records;

  return (
    <div className="row g-4">
      <section className="col-12">
        <Card icon={FiInfo} title="About the model">
          <p className="mb-0">
            A random forest, trained with oversampling of the rare anomaly
            class, that gives each launch a <strong>model risk score</strong>{" "}
            from launch site, vehicle type, agency and three weather values. It
            is a rough estimate for learning and screening, not a safety tool.
          </p>
        </Card>
      </section>

      <section className="col-12">
        <Card icon={FiShield} title="Please read this first" className="disclaimer-card">
          <p className="mb-0">
            This project gives a rough estimate only. Do not use it for safety
            decisions. The model risk score ranks relative risk, it is not a
            probability, and most flagged launches turn out to be false alarms.
          </p>
        </Card>
      </section>

      <section className="col-12">
        <Card icon={FiBarChart2} title="Test-set results">
          {error && (
            <div className="alert alert-danger">
              <p className="mb-2">Could not load model results: {error}</p>
              <button className="btn btn-outline-danger btn-sm" onClick={load}>
                Retry
              </button>
            </div>
          )}
          {!data && !error && <SkeletonPanel label="Loading model results" />}
          {data && (
            <div className="stat-grid">
              {METRIC_ROWS.filter((m) => typeof metrics[m.key] === "number").map(
                (m) => (
                  <div className="stat-tile" key={m.key}>
                    <div className="stat-name">{m.key}</div>
                    <div className="stat-value">{metrics[m.key].toFixed(3)}</div>
                    <div className="stat-help">{m.help}</div>
                  </div>
                )
              )}
            </div>
          )}
          {data && total && (
            <p className="small text-body-secondary mt-3 mb-0">
              Based on {total.toLocaleString()} usable historical launches.
            </p>
          )}
        </Card>
      </section>

      <section className="col-lg-6">
        <Card icon={FiTarget} title="What the threshold means">
          <p>
            The model risk score is a ranking, not a calibrated probability. A
            launch is flagged when its score reaches the decision threshold
            {typeof threshold === "number" && (
              <>
                , currently <strong>{pct(threshold)}</strong>
              </>
            )}
            . The threshold was tuned to catch most anomalies.
          </p>
          {falseAlarms !== null && (
            <p className="mb-0">
              The price is false alarms: about{" "}
              <strong>{falseAlarms.toFixed(1)}</strong> flagged launches per real
              anomaly caught, computed as (1 - precision) / precision.
            </p>
          )}
        </Card>
      </section>

      <section className="col-lg-6">
        <Card icon={FiCloud} title="The three weather features">
          <ul className="mb-0">
            <li><strong>temp_mean</strong>: mean daily temperature (°C).</li>
            <li><strong>precipitation</strong>: daily precipitation total (mm).</li>
            <li><strong>max_wind_speed</strong>: maximum daily wind speed (km/h).</li>
          </ul>
        </Card>
      </section>

      <section className="col-lg-6">
        <Card icon={FiDatabase} title="Data sources">
          <ul className="mb-0">
            <li>GCAT launch catalogue: historical launches, sites, vehicles, agencies and outcomes.</li>
            <li>Open-Meteo: archived daily weather for past launches and forecasts for upcoming ones.</li>
            <li>Launch Library 2: the upcoming launch schedule, cached for 30 minutes.</li>
            <li>The Space Devs (Launch Library 2 and Spaceflight News API): astronauts, events, missions and news in the Explore tab.</li>
            <li>wheretheiss.at: the live ISS position in the Explore tab.</li>
            <li>Land outlines: Natural Earth (public domain), via world-atlas.</li>
          </ul>
        </Card>
      </section>

      <section className="col-lg-6">
        <Card icon={FiAlertCircle} title="Limitations">
          <ul className="mb-0">
            {LIMITATIONS.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
