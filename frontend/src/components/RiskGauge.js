import React from "react";
import { prefersReducedMotion, useCountUp, useInView } from "../utils/motion";

const CX = 100;
const CY = 100;
const R = 80;

// score 0..1 maps to 180 degrees (left) .. 0 degrees (right).
const point = (v, r = R) => {
  const a = Math.PI * (1 - v);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
};
const arc = (from, to) => {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Semicircle gauge of the model risk score (0 to 1). Zones are relative to the
// threshold from the API: teal below, amber near, red at or above.
export default function RiskGauge({ score, threshold, size = "md", compact = false }) {
  const [ref, seen] = useInView();
  const s = clamp01(score);
  const hasT = typeof threshold === "number" && !Number.isNaN(threshold);
  const t = hasT ? clamp01(threshold) : null;
  const shownScore = useCountUp(score, seen);
  const animate = !prefersReducedMotion();
  const angle = (seen ? s : 0) * 180;
  const [tx1, ty1] = hasT ? point(t, R - 14) : [0, 0];
  const [tx2, ty2] = hasT ? point(t, R + 9) : [0, 0];
  const [lx, ly] = hasT ? point(t, R + 17) : [0, 0];
  const near = hasT ? t * 0.8 : 0;

  return (
    <div className={`risk-gauge ${size} ${compact ? "compact" : ""}`} ref={ref}>
      <div className="gauge-title">Model risk score</div>
      <div
        className="gauge-svg-wrap"
        role="img"
        aria-label={`Model risk score ${score.toFixed(3)}${hasT ? `, threshold ${threshold.toFixed(3)}` : ""}`}
      >
        <svg viewBox="0 0 200 124" aria-hidden="true">
          {hasT ? (
            <>
              <path d={arc(0, near)} className="zone zone-low" />
              <path d={arc(near, t)} className="zone zone-near" />
              <path d={arc(t, 1)} className="zone zone-high" />
              <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} className="threshold-tick" />
              <text x={lx} y={ly} className="threshold-label" textAnchor="middle">
                {threshold.toFixed(3)}
              </text>
            </>
          ) : (
            <path d={arc(0, 1)} className="zone zone-neutral" />
          )}
          <g
            className="needle"
            style={{
              transform: `rotate(${angle}deg)`,
              transformOrigin: `${CX}px ${CY}px`,
              transition: animate ? "transform 1s cubic-bezier(.2,.9,.3,1)" : "none",
            }}
          >
            <line x1={CX - R + 14} y1={CY} x2={CX - R - 4} y2={CY} className="needle-line" />
            <circle cx={CX - R + 10} cy={CY} r="5" className="needle-dot" />
          </g>
          <circle cx={CX} cy={CY} r="3" className="needle-hub" />
        </svg>
        <div className="gauge-value">{shownScore.toFixed(3)}</div>
      </div>
      <div className="gauge-caption">Ranking score, not a probability</div>
      {hasT && <div className="gauge-threshold">Threshold {threshold.toFixed(3)}</div>}
    </div>
  );
}
