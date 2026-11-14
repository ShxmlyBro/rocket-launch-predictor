import React, { useState } from "react";
import { FiChevronDown, FiClock, FiMapPin } from "react-icons/fi";
import Collapse from "./Collapse";
import {
  Countdown,
  LaunchPill,
  ProviderChip,
  RiskArea,
  WeatherChips,
  isLimited,
} from "./LaunchParts";
import { formatDate, hasScore, providerHue } from "../utils/format";

export default function LaunchCard({ launch, index = 0 }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const limited = isLimited(launch);
  const scored = hasScore(launch);
  const reasons = launch.reasons || [];
  const notes = launch.notes || [];
  const style = {
    "--accent": `hsl(${providerHue(launch.provider)} 75% 55%)`,
    "--i": Math.min(index, 12),
  };

  return (
    <div className={`card h-100 launch-card ${limited ? "limited" : ""}`} style={style}>
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <ProviderChip name={launch.provider} />
          <span className="flex-shrink-0">
            <LaunchPill launch={launch} />
          </span>
        </div>
        <h3 className="h5 mb-0">{launch.mission}</h3>
        <div className="small text-body-secondary mb-3">{launch.rocket}</div>

        <div className="mb-2">
          <FiClock aria-hidden="true" className="me-1" />
          <Countdown net={launch.net} />
        </div>
        <div className="mb-3">
          <WeatherChips weather={launch.weather} />
        </div>

        <div className="mb-3">
          <RiskArea launch={launch} />
        </div>

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

        {limited && (
          <Collapse open={showWhy}>
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
          </Collapse>
        )}

        <Collapse open={showDetails}>
          <dl className="small mt-3 mb-0 details">
            <dt>
              <FiMapPin aria-hidden="true" /> Pad
            </dt>
            <dd>{launch.pad || "Unknown"}</dd>
            <dt>Launch time (NET)</dt>
            <dd>{formatDate(launch.net)}</dd>
            {scored && (
              <>
                <dt>Technical reading</dt>
                <dd>
                  Model risk score {launch.risk_score.toFixed(3)}
                  {typeof launch.similar_n === "number" &&
                    `. Compared with ${launch.similar_n.toLocaleString()} past launches in the same score band.`}
                </dd>
              </>
            )}
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
        </Collapse>
      </div>
    </div>
  );
}
