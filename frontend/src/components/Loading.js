import React, { useEffect, useState } from "react";
import { FaRocket } from "react-icons/fa";

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
    <div className="waking mt-3" role="status">
      <span className="waking-orbit" aria-hidden="true">
        <FaRocket />
      </span>
      <span>
        The server is waking up. The first request after a quiet period can
        take up to a minute, thanks for waiting.
      </span>
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

export function SkeletonHero() {
  return (
    <div className="card hero-card mb-4" aria-hidden="true">
      <div className="card-body p-4">
        <div className="row g-4 align-items-center">
          <div className="col-lg-7">
            <SkeletonBlock height="0.9rem" width="25%" className="mb-3" />
            <SkeletonBlock height="2.2rem" width="70%" className="mb-3" />
            <SkeletonBlock height="1.6rem" width="45%" className="mb-3" />
            <div className="d-flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonBlock key={i} height="4.5rem" width="4.5rem" />
              ))}
            </div>
          </div>
          <div className="col-lg-5">
            <SkeletonBlock height="8rem" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 3 }) {
  return (
    <div className="row g-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div className="col-12 col-md-6 col-xl-4" key={i}>
          <div className="card h-100">
            <div className="card-body">
              <SkeletonBlock height="1.6rem" width="40%" className="mb-3 rounded-pill" />
              <SkeletonBlock height="1.4rem" width="70%" className="mb-2" />
              <SkeletonBlock width="45%" className="mb-3" />
              <SkeletonBlock height="5rem" className="mb-3" />
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
      <div className="card">
        <div className="card-body">
          <SkeletonBlock height="1.6rem" width="40%" className="mb-3" />
          <SkeletonBlock height="1rem" className="mb-2" />
          <SkeletonBlock height="1rem" className="mb-2" />
          <SkeletonBlock height="1rem" width="80%" className="mb-4" />
          <SkeletonBlock height="8rem" />
        </div>
      </div>
      <WakingNotice />
    </div>
  );
}
