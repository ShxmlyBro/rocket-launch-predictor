import React, { useId, useState } from "react";
import { FiChevronDown, FiHelpCircle } from "react-icons/fi";
import Collapse from "./Collapse";

export const hasReading = (x) => typeof x?.similar_rate === "number";

// "12%", or "less than 1%" for very small rates.
export function formatRate(rate) {
  const p = Math.round(rate * 100);
  return rate > 0 && p < 1 ? "less than 1%" : `${p}%`;
}

// Short form for the big number: "12%", or "<1%".
export const bigRate = (rate) => (formatRate(rate) === "less than 1%" ? "<1%" : formatRate(rate));

export const EXPLAINER = [
  "A model compares this launch (rocket, agency, site and weather) with past launches and gives it a score.",
  "The score is not the chance that this launch will fail.",
  "The percentages describe past launches in our dataset, which is dominated by older rockets.",
  "Most launches the model flags are false alarms, so use it as a rough guide only.",
];

export function WhatDoesThisMean() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="rr-help-wrap">
      <button
        type="button"
        className="rr-help"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <FiHelpCircle aria-hidden="true" /> What does this mean?{" "}
        <FiChevronDown aria-hidden="true" className={`chevron ${open ? "open" : ""}`} />
      </button>
      <div id={id}>
        <Collapse open={open}>
          <ul className="small mt-2 mb-0 ps-3">
            {EXPLAINER.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Collapse>
      </div>
    </div>
  );
}

// Plain-language reading built from the held-out score reference.
export default function RiskReading({ similarRate, percentile }) {
  return (
    <div className="risk-reading">
      <div className="rr-label">Risk reading</div>
      <div className="rr-big" aria-hidden="true">
        {bigRate(similarRate)}
      </div>
      <p className="rr-headline">
        Past launches with a similar score had a failure or partial failure about{" "}
        {formatRate(similarRate)} of the time
      </p>
      {typeof percentile === "number" && (
        <p className="rr-sub">Riskier than {percentile}% of past launches</p>
      )}
      <WhatDoesThisMean />
    </div>
  );
}
