import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { errorMessage, getSpaceIss } from "../../api";
import { mapPosition, pushTrail } from "../../utils/space";
import { SkeletonPanel } from "../Loading";
import { StaleNotice } from "./SpaceStatus";

// three.js and the globe live in their own chunk, fetched only when this section opens.
const IssGlobe = lazy(() => import("./IssGlobe"));

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

// Catches errors thrown while rendering the globe (or loading its chunk).
// Errors from library callbacks and timers are not caught here, so the globe
// also reports those through its onFail prop.
class GlobeBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function GlobeFallback({ map }) {
  return (
    <div>
      <p className="small text-body-secondary mb-2" role="status">
        3D view unavailable on this device
      </p>
      {map}
    </div>
  );
}

const lastUpdated = (d) => {
  const t = typeof d.timestamp === "number" ? d.timestamp * 1000 : NaN;
  return Number.isNaN(t) ? null : new Date(t).toLocaleTimeString();
};

export default function IssSection() {
  const [state, setState] = useState({ payload: null, error: null });
  const [trail, setTrail] = useState([]);
  const [view, setView] = useState("3d");
  const [globeFailed, setGlobeFailed] = useState(false);
  const onGlobeFail = useCallback(() => setGlobeFailed(true), []);

  // Polls every 15 s, but only while this section is mounted and the browser tab
  // is visible. The cleanup clears the interval, so leaving the sub-section, the
  // Explore tab or the page stops all requests.
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (document.hidden) return;
      getSpaceIss()
        .then((payload) => {
          if (cancelled) return;
          setState({ payload, error: null });
          const d = payload?.data || {};
          setTrail((t) => pushTrail(t, d.latitude, d.longitude, 20));
        })
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
  const updated = lastUpdated(d);
  const map = <IssMap lat={d.latitude} lon={d.longitude} />;
  return (
    <>
      <StaleNotice payload={payload} />
      {error && <div className="alert alert-warning py-2" role="status">{error}</div>}
      {!hasPosition ? (
        <p className="text-body-secondary">ISS position is not available right now.</p>
      ) : (
        <div className="iss-layout">
          <div className="iss-view">
            <div className="btn-group btn-group-sm mb-2" role="group" aria-label="ISS view">
              <button
                type="button"
                className={`btn ${view === "3d" ? "btn-primary" : "btn-outline-secondary"}`}
                aria-pressed={view === "3d"}
                onClick={() => setView("3d")}
              >
                3D globe
              </button>
              <button
                type="button"
                className={`btn ${view === "2d" ? "btn-primary" : "btn-outline-secondary"}`}
                aria-pressed={view === "2d"}
                onClick={() => setView("2d")}
              >
                2D map
              </button>
            </div>
            {view === "3d" && globeFailed ? (
              <GlobeFallback map={map} />
            ) : view === "3d" ? (
              <GlobeBoundary onFail={onGlobeFail}>
                <Suspense fallback={<div className="skeleton iss-globe-skeleton" aria-label="Loading 3D globe" role="status" />}>
                  <IssGlobe lat={d.latitude} lon={d.longitude} trail={trail} onFail={onGlobeFail} />
                </Suspense>
              </GlobeBoundary>
            ) : (
              map
            )}
          </div>
          <div className="iss-readout">
            <dl className="iss-stats mb-2">
              <dt>Latitude</dt><dd>{fmt(d.latitude)}°</dd>
              <dt>Longitude</dt><dd>{fmt(d.longitude)}°</dd>
              <dt>Altitude</dt><dd>{fmt(d.altitude, 1)} km</dd>
              <dt>Velocity</dt><dd>{fmt(d.velocity, 0)} km/h</dd>
              {updated && (<><dt>Last updated</dt><dd>{updated}</dd></>)}
            </dl>
            <p className="small text-body-secondary mb-0">Refreshes every 15 seconds while this view is open.</p>
          </div>
        </div>
      )}
    </>
  );
}
