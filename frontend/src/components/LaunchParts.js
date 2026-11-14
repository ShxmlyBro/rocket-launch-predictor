import React from "react";
import { FiCloudRain, FiThermometer, FiWind } from "react-icons/fi";
import RiskGauge from "./RiskGauge";
import RiskReading, { hasReading } from "./RiskReading";
import StatusPill from "./StatusPill";
import { useNow } from "../utils/NowContext";
import {
  countdownParts,
  formatCountdown,
  hasScore,
  providerHue,
  providerInitials,
} from "../utils/format";

export const isLimited = (l) => l.match_quality === "limited";

// Only components that call useNow() re-render on each tick of the shared ticker.
export function Countdown({ net }) {
  const now = useNow();
  const c = formatCountdown(net, now);
  if (!c) return <span className="text-body-secondary">Date to be confirmed</span>;
  return (
    <span className={`countdown ${c.past ? "text-body-secondary" : ""}`}>
      {c.text}
    </span>
  );
}

function Seg({ value, label }) {
  const text = String(value).padStart(2, "0");
  return (
    <div className="seg">
      <span className="seg-num" key={text}>
        {text}
      </span>
      <span className="seg-label">{label}</span>
    </div>
  );
}

export function SegmentedCountdown({ net }) {
  const now = useNow();
  const c = countdownParts(net, now);
  if (!c) return <p className="mb-0 text-body-secondary">Date to be confirmed</p>;
  if (c.past) return <p className="window-open mb-0">Launch window open</p>;
  return (
    <div className="seg-row" role="timer" aria-label="Countdown to launch">
      <Seg value={c.d} label="Days" />
      <Seg value={c.h} label="Hours" />
      <Seg value={c.m} label="Min" />
      <Seg value={c.s} label="Sec" />
    </div>
  );
}

export function ProviderChip({ name }) {
  const hue = providerHue(name);
  return (
    <span className="provider-chip" style={{ "--accent": `hsl(${hue} 75% 55%)` }}>
      <span className="avatar" aria-hidden="true">
        {providerInitials(name)}
      </span>
      {name || "Unknown provider"}
    </span>
  );
}

export function WeatherChips({ weather }) {
  if (!weather) {
    return <span className="chip text-body-secondary">No forecast weather</span>;
  }
  return (
    <span className="d-inline-flex flex-wrap gap-1" title="Forecast weather at the pad">
      <span className="chip">
        <FiThermometer aria-hidden="true" /> {weather.temp_mean}°C
      </span>
      <span className="chip">
        <FiCloudRain aria-hidden="true" /> {weather.precipitation} mm
      </span>
      <span className="chip">
        <FiWind aria-hidden="true" /> {weather.max_wind_speed} km/h
      </span>
    </span>
  );
}

// Flagged / Not flagged only for full matches that have a score.
// Limited matches never get a verdict.
export function LaunchPill({ launch }) {
  if (isLimited(launch)) return <StatusPill kind="low" />;
  if (!hasScore(launch)) return null;
  return <StatusPill kind={launch.above_threshold ? "flagged" : "clear"} />;
}

export function RiskArea({ launch, size }) {
  if (!hasScore(launch)) {
    return (
      <div className="gauge-missing">Forecast not available yet</div>
    );
  }
  const limited = isLimited(launch);
  return (
    <div>
      {hasReading(launch) && (
        <RiskReading
          similarRate={launch.similar_rate}
          percentile={launch.risk_percentile}
        />
      )}
      <RiskGauge
        score={launch.risk_score}
        threshold={launch.threshold}
        size={size}
        compact={hasReading(launch)}
      />
      {limited && (
        <p className="small low-note text-center mb-0 mt-2">
          Some inputs were not in the training data, so treat this as indicative only.
        </p>
      )}
    </div>
  );
}
