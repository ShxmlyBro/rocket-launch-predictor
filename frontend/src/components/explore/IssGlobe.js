import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import { feature } from "topojson-client";
import land from "world-atlas/land-110m.json";
import { FiCrosshair, FiNavigation } from "react-icons/fi";
import { unwrapLon } from "../../utils/space";

// Land outlines: Natural Earth (public domain), via world-atlas. Bundled, never fetched.
const LAND = feature(land, land.objects.land).features;

const GLOBE_COLOR = "#0b1030";
const ISS_COLOR = "#fbbf24";

const reduced = () => {
  try {
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
};

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) {
    return false;
  }
}

const cssVar = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function useThemeColors() {
  const read = () => ({
    land: cssVar("--accent-1", "#818cf8"),
    glow: cssVar("--accent-2", "#22d3ee"),
  });
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setColors(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-bs-theme"] });
    return () => mo.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return colors;
}

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 320 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") {
      setSize({ w: el?.clientWidth || 320, h: 320 });
      return undefined;
    }
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      setSize({ w, h: window.innerWidth < 768 ? 320 : 440 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

// Interactive 3D globe. `trail` holds the last positions with unwrapped
// longitudes, so everything here moves the short way across +-180.
export default function IssGlobe(props) {
  // Throwing here is caught by the error boundary in IssSection (2D fallback).
  if (!webglAvailable()) throw new Error("WebGL is not available");
  return <GlobeView {...props} />;
}

function GlobeView({ lat, lon, trail }) {
  const wrapRef = useRef(null);
  const globeRef = useRef(null);
  const interacted = useRef(false);
  const markerRef = useRef({ lat, lng: lon });
  const [follow, setFollow] = useState(false);
  const { w, h } = useSize(wrapRef);
  const colors = useThemeColors();
  const noMotion = reduced();

  const lng = trail?.length ? trail[trail.length - 1].lng : lon;

  // Same object every time, so the points layer glides to the new position.
  markerRef.current.lat = lat;
  markerRef.current.lng = lng;
  const points = useMemo(() => [markerRef.current], [lat, lng]); // eslint-disable-line react-hooks/exhaustive-deps
  const rings = useMemo(() => (noMotion ? [] : [{ lat, lng }]), [lat, lng, noMotion]);

  const paths = useMemo(() => {
    if (!trail || trail.length < 2) return [];
    const n = trail.length;
    return [
      {
        coords: trail.map((p) => [p.lat, p.lng, 0.02]),
        colors: trail.map((_, i) => `rgba(251,191,36,${(0.1 + (0.9 * i) / (n - 1)).toFixed(2)})`),
      },
    ];
  }, [trail]);

  const centre = useCallback(
    (ms = 1000) => {
      const g = globeRef.current;
      if (!g) return;
      const cur = g.pointOfView();
      g.pointOfView({ lat, lng: unwrapLon(cur?.lng, lng), altitude: 1.8 }, ms);
    },
    [lat, lng]
  );

  useEffect(() => {
    if (follow) centre(1000);
  }, [follow, centre]);

  const stopRotate = useCallback(() => {
    interacted.current = true;
    const c = globeRef.current?.controls();
    if (c) c.autoRotate = false;
  }, []);

  const onReady = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    g.pointOfView({ lat, lng, altitude: 2.4 }, 0);
    g.globeMaterial().color.set(GLOBE_COLOR);
    g.globeMaterial().emissive?.set("#0a0f2e");
    const c = g.controls();
    c.enablePan = false;
    c.minDistance = 160;
    c.maxDistance = 520;
    c.autoRotate = !noMotion;
    c.autoRotateSpeed = 0.5;
    c.addEventListener("start", stopRotate);
    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }, [lat, lng, noMotion, stopRotate]);

  // Hidden browser tab: stop rendering and rotating. Back: resume.
  useEffect(() => {
    const onVis = () => {
      const g = globeRef.current;
      if (!g) return;
      if (document.hidden) {
        g.pauseAnimation();
      } else {
        g.resumeAnimation();
        const c = g.controls();
        if (c) c.autoRotate = !noMotion && !interacted.current && !follow;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [noMotion, follow]);

  // Release the WebGL context when the globe unmounts.
  useEffect(() => {
    const ref = globeRef;
    return () => {
      const g = ref.current;
      if (!g) return;
      try {
        g.controls()?.removeEventListener("start", stopRotate);
        g.pauseAnimation();
        const r = g.renderer();
        r.dispose();
        r.forceContextLoss();
        r.domElement?.remove();
      } catch (e) {
        // already torn down
      }
    };
  }, [stopRotate]);

  const toggleFollow = () => {
    stopRotate();
    setFollow((f) => !f);
  };

  return (
    <div className="iss-globe-block">
      <div
        ref={wrapRef}
        className="iss-globe"
        style={{ height: h }}
        role="img"
        aria-label={`ISS position on a 3D globe: latitude ${lat.toFixed(2)} degrees, longitude ${lon.toFixed(2)} degrees`}
      >
        {w > 0 && (
          <Globe
            ref={globeRef}
            width={w}
            height={h}
            backgroundColor="rgba(0,0,0,0)"
            rendererConfig={{ antialias: true, alpha: true, powerPreference: "low-power" }}
            showAtmosphere
            atmosphereColor={colors.glow}
            atmosphereAltitude={0.18}
            hexPolygonsData={LAND}
            hexPolygonResolution={3}
            hexPolygonMargin={0.4}
            hexPolygonColor={() => colors.land}
            hexPolygonAltitude={0.004}
            pointsData={points}
            pointLat="lat"
            pointLng="lng"
            pointAltitude={0.04}
            pointRadius={0.55}
            pointColor={() => ISS_COLOR}
            pointsMerge={false}
            pointsTransitionDuration={14000}
            ringsData={rings}
            ringLat="lat"
            ringLng="lng"
            ringColor={() => (t) => `rgba(251,191,36,${1 - t})`}
            ringMaxRadius={5}
            ringPropagationSpeed={2}
            ringRepeatPeriod={1400}
            pathsData={paths}
            pathPoints="coords"
            pathPointLat={(p) => p[0]}
            pathPointLng={(p) => p[1]}
            pathPointAlt={(p) => p[2]}
            pathColor="colors"
            pathStroke={0.35}
            pathTransitionDuration={0}
            onGlobeReady={onReady}
          />
        )}
      </div>
      <div className="iss-globe-actions">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => centre(1000)}>
          <FiCrosshair aria-hidden="true" /> Center on ISS
        </button>
        <button
          type="button"
          className={`btn btn-sm ${follow ? "btn-primary" : "btn-outline-secondary"}`}
          aria-pressed={follow}
          onClick={toggleFollow}
        >
          <FiNavigation aria-hidden="true" /> Follow ISS
        </button>
        <span className="small text-body-secondary">Drag to rotate, scroll or pinch to zoom.</span>
      </div>
    </div>
  );
}
