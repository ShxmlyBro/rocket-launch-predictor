import React from "react";

// Horizontal gauge of the model risk score (0 to 100%) with a marker at the threshold.
export default function RiskGauge({ score, threshold }) {
  const s = Math.max(0, Math.min(1, score));
  const t = Math.max(0, Math.min(1, threshold));
  const above = s >= t;
  return (
    <div>
      <div className="d-flex justify-content-between small mb-1">
        <span>Model risk score</span>
        <strong>{score.toFixed(3)}</strong>
      </div>
      <div className="small text-body-secondary mb-1">
        Ranking score, not a probability
      </div>
      <div
        className="risk-gauge"
        role="img"
        aria-label={`Model risk score ${score.toFixed(3)}, threshold ${threshold.toFixed(3)}`}
      >
        <div
          className={`risk-gauge-fill ${above ? "above" : "below"}`}
          style={{ width: `${s * 100}%` }}
        />
        <div className="risk-gauge-marker" style={{ left: `${t * 100}%` }} />
      </div>
      <div className="small text-body-secondary mt-1">
        Threshold {threshold.toFixed(3)}
      </div>
    </div>
  );
}
