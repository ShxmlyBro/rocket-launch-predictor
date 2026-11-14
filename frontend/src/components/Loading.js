import React, { useEffect, useState } from "react";

// Shows a "server waking up" message if loading takes longer than a few seconds
// (Render free tier cold starts can take about a minute).
export function WakingNotice({ delayMs = 4000 }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
  if (!show) return null;
  return (
    <div className="alert alert-info mt-3" role="status">
      The server is waking up. The first request after a quiet period can take
      up to a minute, thanks for waiting.
    </div>
  );
}

export function SkeletonBlock({ height = "1rem", width = "100%", className = "" }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ height, width }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCards({ count = 3 }) {
  return (
    <div className="row g-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div className="col-12 col-md-6 col-xl-4" key={i}>
          <div className="card h-100">
            <div className="card-body">
              <SkeletonBlock height="1.4rem" width="70%" className="mb-3" />
              <SkeletonBlock width="45%" className="mb-3" />
              <SkeletonBlock height="2rem" className="mb-3" />
              <SkeletonBlock height="0.8rem" className="mb-2" />
              <SkeletonBlock height="0.8rem" width="60%" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonPanel({ label = "Loading" }) {
  return (
    <div role="status" aria-label={label}>
      <SkeletonBlock height="1.6rem" width="40%" className="mb-3" />
      <SkeletonBlock height="1rem" className="mb-2" />
      <SkeletonBlock height="1rem" className="mb-2" />
      <SkeletonBlock height="1rem" width="80%" className="mb-4" />
      <SkeletonBlock height="8rem" />
      <WakingNotice />
    </div>
  );
}
