import React, { useEffect, useRef, useState } from "react";
import { FiUser } from "react-icons/fi";
import StatusPill from "../StatusPill";
import { SkeletonCards, WakingNotice } from "../Loading";

// Only plain web links are rendered as links.
export const safeUrl = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : null);

export const REFRESH_COOLDOWN_MS = 10000;

// Optional onRefresh adds a Refresh button, disabled for 10 s after a click.
export function StaleNotice({ payload, onRefresh }) {
  const [cooling, setCooling] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!payload || !(payload.stale || payload._note)) return null;
  const click = () => {
    setCooling(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCooling(false), REFRESH_COOLDOWN_MS);
    onRefresh();
  };
  return (
    <div className="alert alert-warning py-2 d-flex flex-wrap gap-2 align-items-center" role="status">
      <StatusPill kind="sample" />
      <span>Showing sample data. Live data could not be loaded right now.</span>
      {onRefresh && (
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary ms-auto"
          onClick={click}
          disabled={cooling}
        >
          Refresh
        </button>
      )}
    </div>
  );
}

// Handles loading, error and stale states for one resource, then calls
// children(payload) with the loaded body.
export function SpaceResource({ res, retry, children }) {
  if (res.error && !res.data) {
    return (
      <div className="alert alert-danger d-flex flex-wrap gap-2 align-items-center" role="alert">
        <span>{res.error}</span>
        <button type="button" className="btn btn-sm btn-outline-danger ms-auto" onClick={retry}>
          Retry
        </button>
      </div>
    );
  }
  if (!res.data) {
    return (
      <>
        <SkeletonCards count={3} />
        <WakingNotice />
      </>
    );
  }
  return (
    <>
      <StaleNotice payload={res.data} onRefresh={retry} />
      {children(res.data)}
    </>
  );
}

// External image: lazy, no referrer, and an icon if it fails to load.
export function SpaceImage({ src, alt, className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`space-img-fallback ${className}`} role="img" aria-label={alt}>
        <FiUser aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export const Empty = ({ children }) => <p className="text-body-secondary">{children}</p>;
