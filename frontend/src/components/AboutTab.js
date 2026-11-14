import React, { useCallback, useEffect, useState } from "react";
import { getEdaStats, errorMessage } from "../api";
import { SkeletonPanel } from "./Loading";
import { falseAlarmsPerCaught, pct } from "../utils/format";

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
        <h2 className="h4">About the model</h2>
        <p>
          A random forest, trained with oversampling of the rare anomaly class,
          that gives each launch a <strong>model risk score</strong> from launch
          site, vehicle type, agency and three weather values. It is a rough
          estimate for learning and screening, not a safety tool.
        </p>
      </section>

      <section className="col-lg-7">
        <h3 className="h5">Test-set results</h3>
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
          <div className="table-responsive">
            <table className="table align-middle">
              <tbody>
                {METRIC_ROWS.filter((m) => typeof metrics[m.key] === "number").map(
                  (m) => (
                    <tr key={m.key}>
                      <th scope="row">{m.key}</th>
                      <td className="text-end">{metrics[m.key].toFixed(3)}</td>
                      <td className="small text-body-secondary">{m.help}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
        {data && total && (
          <p className="small text-body-secondary">
            Based on {total.toLocaleString()} usable historical launches.
          </p>
        )}
      </section>

      <section className="col-lg-5">
        <h3 className="h5">What the threshold means</h3>
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
      </section>

      <section className="col-lg-6">
        <h3 className="h5">Data sources</h3>
        <ul>
          <li>GCAT launch catalogue: historical launches, sites, vehicles, agencies and outcomes.</li>
          <li>Open-Meteo: archived daily weather for past launches and forecasts for upcoming ones.</li>
          <li>Launch Library 2: the upcoming launch schedule, cached for 30 minutes.</li>
          <li>The Space Devs (Launch Library 2 and Spaceflight News API): astronauts, events, missions and news in the Explore tab.</li>
          <li>wheretheiss.at: the live ISS position in the Explore tab.</li>
        </ul>
      </section>

      <section className="col-lg-6">
        <h3 className="h5">The three weather features</h3>
        <ul>
          <li><strong>temp_mean</strong>: mean daily temperature (°C).</li>
          <li><strong>precipitation</strong>: daily precipitation total (mm).</li>
          <li><strong>max_wind_speed</strong>: maximum daily wind speed (km/h).</li>
        </ul>
      </section>

      <section className="col-12">
        <h3 className="h5">Limitations</h3>
        <ul className="mb-0">
          {LIMITATIONS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
