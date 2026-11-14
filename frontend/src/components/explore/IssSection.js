import React, { useEffect, useState } from "react";
import { errorMessage, getSpaceIss } from "../../api";
import { mapPosition } from "../../utils/space";
import { SkeletonPanel } from "../Loading";
import { StaleNotice } from "./SpaceStatus";

export const ISS_POLL_MS = 15000;

const fmt = (v, digits = 2) => (typeof v === "number" ? v.toFixed(digits) : "n/a");

// Simple lat/long grid (no coastlines): lines every 30 degrees, equator and
// prime meridian marked, and the ISS dot.
function IssMap({ lat, lon }) {
  const pos = mapPosition(lat, lon);
  const vLines = [-150, -120, -90, -60, -30, 30, 60, 90, 120, 150];
  const hLines = [-60, -30, 30, 60];
  return (
    <figure className="iss-map-wrap mb-0">
      <svg viewBox="0 0 360 180" className="iss-map" role="img"
           aria-label="Approximate ISS position on a latitude and longitude grid">
        <rect x="0" y="0" width="360" height="180" className="iss-map-bg" />
        {vLines.map((l) => (
          <line key={`v${l}`} x1={l + 180} y1="0" x2={l + 180} y2="180" className="iss-grid" />
        ))}
        {hLines.map((l) => (
          <line key={`h${l}`} x1="0" y1={90 - l} x2="360" y2={90 - l} className="iss-grid" />
        ))}
        <line x1="0" y1="90" x2="360" y2="90" className="iss-axis" />
        <line x1="180" y1="0" x2="180" y2="180" className="iss-axis" />
        <text x="3" y="87" className="iss-label">Equator</text>
        <text x="183" y="9" className="iss-label">Prime meridian</text>
        {pos && (
          <>
            <circle cx={pos.x * 3.6} cy={pos.y * 1.8} r="7" className="iss-pulse" />
            <circle cx={pos.x * 3.6} cy={pos.y * 1.8} r="3.5" className="iss-dot" />
          </>
        )}
      </svg>
      <figcaption className="small text-body-secondary">
        Approximate position on a simple latitude and longitude grid, without coastlines.
      </figcaption>
    </figure>
  );
}

export default function IssSection() {
  const [state, setState] = useState({ payload: null, error: null });

  // Polls every 15 s, but only while this section is mounted and the browser tab
  // is visible. The cleanup clears the interval, so leaving the sub-section, the
  // Explore tab or the page stops all requests.
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (document.hidden) return;
      getSpaceIss()
        .then((payload) => !cancelled && setState({ payload, error: null }))
        .catch((e) =>
          !cancelled && setState((s) => ({ ...s, error: errorMessage(e) }))
        );
    };
    tick();
    const id = setInterval(tick, ISS_POLL_MS);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const { payload, error } = state;
  if (!payload) {
    return error ? (
      <div className="alert alert-danger" role="alert">{error}</div>
    ) : (
      <SkeletonPanel label="Loading ISS position" />
    );
  }
  const d = payload.data || {};
  const hasPosition = typeof d.latitude === "number" && typeof d.longitude === "number";
  return (
    <>
      <StaleNotice payload={payload} />
      {error && <div className="alert alert-warning py-2" role="status">{error}</div>}
      {!hasPosition ? (
        <p className="text-body-secondary">ISS position is not available right now.</p>
      ) : (
        <div className="row g-3 align-items-center">
          <div className="col-12 col-lg-7"><IssMap lat={d.latitude} lon={d.longitude} /></div>
          <div className="col-12 col-lg-5">
            <dl className="row mb-2 iss-stats">
              <dt className="col-6">Latitude</dt><dd className="col-6">{fmt(d.latitude)}°</dd>
              <dt className="col-6">Longitude</dt><dd className="col-6">{fmt(d.longitude)}°</dd>
              <dt className="col-6">Altitude</dt><dd className="col-6">{fmt(d.altitude, 1)} km</dd>
              <dt className="col-6">Velocity</dt><dd className="col-6">{fmt(d.velocity, 0)} km/h</dd>
            </dl>
            <p className="small text-body-secondary mb-0">Refreshes every 15 seconds while this view is open.</p>
          </div>
        </div>
      )}
    </>
  );
}
