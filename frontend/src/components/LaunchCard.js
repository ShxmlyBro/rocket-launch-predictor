import React, { useState } from "react";
import {
  FiChevronDown,
  FiClock,
  FiCloudRain,
  FiMapPin,
  FiThermometer,
  FiWind,
} from "react-icons/fi";
import RiskGauge from "./RiskGauge";
import { useNow } from "../utils/NowContext";
import { formatCountdown, formatDate } from "../utils/format";

// Only this small component re-renders on each tick of the shared ticker.
function Countdown({ net }) {
  const now = useNow();
  const c = formatCountdown(net, now);
  if (!c) return <span className="text-body-secondary">Date to be confirmed</span>;
  return (
    <span className={`countdown ${c.past ? "text-body-secondary" : ""}`}>
      {c.text}
    </span>
  );
}

function WeatherChip({ weather }) {
  if (!weather) {
    return <span className="chip text-body-secondary">No forecast weather</span>;
  }
  return (
    <span className="chip" title="Forecast weather at the pad">
      <FiThermometer aria-hidden="true" /> {weather.temp_mean}°C{" "}
      <FiCloudRain aria-hidden="true" className="ms-2" /> {weather.precipitation} mm{" "}
      <FiWind aria-hidden="true" className="ms-2" /> {weather.max_wind_speed} km/h
    </span>
  );
}

function Verdict({ launch }) {
  if (launch.risk_score === null || launch.risk_score === undefined) {
    return <span className="badge text-bg-secondary">Not scored</span>;
  }
  return launch.above_threshold ? (
    <span className="badge text-bg-danger">Flagged</span>
  ) : (
    <span className="badge text-bg-success">Not flagged</span>
  );
}

export default function LaunchCard({ launch }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const limited = launch.match_quality === "limited";
  const scored =
    launch.risk_score !== null && launch.risk_score !== undefined;
  const reasons = launch.reasons || [];
  const notes = launch.notes || [];

  return (
    <div className={`card h-100 launch-card ${limited ? "limited" : ""}`}>
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
          <h3 className="h6 mb-0">{launch.mission}</h3>
          {limited ? (
            <span className="badge text-bg-secondary flex-shrink-0">
              Low confidence
            </span>
          ) : (
            <span className="flex-shrink-0">
              <Verdict launch={launch} />
            </span>
          )}
        </div>
        <div className="small text-body-secondary mb-2">
          {launch.rocket} · {launch.provider}
        </div>

        <div className="mb-2">
          <FiClock aria-hidden="true" className="me-1" />
          <Countdown net={launch.net} />
        </div>
        <div className="mb-3">
          <WeatherChip weather={launch.weather} />
        </div>

        {!limited && scored && (
          <div className="mb-3">
            <RiskGauge score={launch.risk_score} threshold={launch.threshold} />
          </div>
        )}
        {!limited && !scored && (
          <p className="small text-body-secondary">
            No risk score, usually because forecast weather was unavailable.
          </p>
        )}

        <div className="mt-auto d-flex flex-wrap gap-2">
          {limited && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              aria-expanded={showWhy}
              onClick={() => setShowWhy((v) => !v)}
            >
              Why?{" "}
              <FiChevronDown
                aria-hidden="true"
                className={`chevron ${showWhy ? "open" : ""}`}
              />
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            aria-expanded={showDetails}
            onClick={() => setShowDetails((v) => !v)}
          >
            Details{" "}
            <FiChevronDown
              aria-hidden="true"
              className={`chevron ${showDetails ? "open" : ""}`}
            />
          </button>
        </div>

        {limited && showWhy && (
          <ul className="small mt-3 mb-0">
            {reasons.length ? (
              reasons.map((r, i) => <li key={i}>{r}</li>)
            ) : (
              <li>
                This launch does not match the vehicle, agency or site
                categories the model was trained on.
              </li>
            )}
          </ul>
        )}

        {showDetails && (
          <dl className="small mt-3 mb-0 details">
            <dt>
              <FiMapPin aria-hidden="true" /> Pad
            </dt>
            <dd>{launch.pad || "Unknown"}</dd>
            <dt>Launch time (NET)</dt>
            <dd>{formatDate(launch.net)}</dd>
            {launch.weather && (
              <>
                <dt>Forecast weather</dt>
                <dd>
                  Mean temperature {launch.weather.temp_mean}°C, precipitation{" "}
                  {launch.weather.precipitation} mm, max wind{" "}
                  {launch.weather.max_wind_speed} km/h. The model was trained on
                  observed weather, so a forecast is only an approximation.
                </dd>
              </>
            )}
            {!limited && scored && (
              <>
                <dt>Result</dt>
                <dd>
                  {launch.above_threshold
                    ? "The model risk score is at or above the threshold, so this launch is flagged."
                    : "The model risk score is below the threshold, so this launch is not flagged."}
                </dd>
              </>
            )}
            {notes.length > 0 && (
              <>
                <dt>Notes</dt>
                <dd>
                  <ul className="mb-0 ps-3">
                    {notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </dd>
              </>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}
