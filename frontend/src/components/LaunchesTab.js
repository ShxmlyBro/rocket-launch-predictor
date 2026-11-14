import React, { useMemo, useState } from "react";
import { FiAlertTriangle, FiRefreshCw, FiSearch } from "react-icons/fi";
import LaunchCard from "./LaunchCard";
import NextLaunchHero from "./NextLaunchHero";
import StatusPill from "./StatusPill";
import { SkeletonCards, SkeletonHero, WakingNotice } from "./Loading";
import { formatDate, nextLaunch, sortByDate, sortByRisk } from "../utils/format";

export default function LaunchesTab({ upcoming }) {
  const { data, error, loading, loadedAt, refresh } = upcoming;
  const [provider, setProvider] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("date");

  const launches = useMemo(() => data?.launches ?? [], [data]);
  const providers = useMemo(
    () => [...new Set(launches.map((l) => l.provider).filter(Boolean))].sort(),
    [launches]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = launches.filter((l) => {
      if (provider !== "all" && l.provider !== provider) return false;
      if (!q) return true;
      return [l.mission, l.rocket, l.provider, l.pad]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(q));
    });
    return sort === "risk" ? sortByRisk(list) : sortByDate(list);
  }, [launches, provider, query, sort]);

  // The hero shows the soonest future launch when no filter is active.
  // Picked when the data changes, not on every tick, so the grid does not
  // re-render each second. A launch that passes shows "Launch window open".
  const filtering = provider !== "all" || query.trim() !== "";
  const hero = useMemo(
    () => (filtering ? null : nextLaunch(launches, Date.now())),
    [filtering, launches]
  );
  const grid = hero ? visible.filter((l) => l !== hero) : visible;

  const header = (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <h2 className="h4 mb-0">
          Upcoming launches{" "}
          {data?.stale && <StatusPill kind="sample" />}
        </h2>
        {data?.note && (
          <p className="small text-body-secondary mb-0">{data.note}</p>
        )}
      </div>
      <div className="d-flex align-items-center gap-2">
        {loadedAt && (
          <span className="small text-body-secondary">
            Fetched {new Date(loadedAt).toLocaleTimeString()}
          </span>
        )}
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={refresh}
          disabled={loading}
        >
          <FiRefreshCw
            aria-hidden="true"
            className={loading ? "spin" : ""}
          />{" "}
          Refresh
        </button>
      </div>
    </div>
  );

  if (!data && loading) {
    return (
      <div>
        {header}
        <SkeletonHero />
        <SkeletonCards />
        <WakingNotice />
      </div>
    );
  }

  if (!data && error) {
    return (
      <div className="alert alert-danger">
        <p className="mb-2">Could not load upcoming launches: {error}</p>
        <button className="btn btn-outline-danger btn-sm" onClick={refresh}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {header}

      {error && (
        <div className="alert alert-warning" role="alert">
          Could not refresh: {error}. Showing the previous data.
        </div>
      )}

      {data?.stale && (
        <div className="alert alert-warning d-flex gap-2" role="alert">
          <FiAlertTriangle aria-hidden="true" className="mt-1 flex-shrink-0" />
          <span>
            Live launch data is unavailable, so this is a saved snapshot as of{" "}
            {formatDate(data.as_of)}. Countdowns may be out of date.
          </span>
        </div>
      )}

      {hero && <NextLaunchHero launch={hero} />}

      <div className="controls mb-4">
        <div className="d-flex flex-wrap gap-2 mb-3">
          <div className="input-group controls-search">
            <span className="input-group-text">
              <FiSearch aria-hidden="true" />
            </span>
            <input
              type="search"
              className="form-control"
              placeholder="Search mission, rocket or pad"
              aria-label="Search launches"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="form-select controls-sort"
            aria-label="Sort launches"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="date">Sort by date</option>
            <option value="risk">Sort by risk</option>
          </select>
        </div>
        <div className="chip-row" role="group" aria-label="Filter by provider">
          <button
            type="button"
            className={`filter-chip ${provider === "all" ? "active" : ""}`}
            aria-pressed={provider === "all"}
            onClick={() => setProvider("all")}
          >
            All
          </button>
          {providers.map((p) => (
            <button
              type="button"
              key={p}
              className={`filter-chip ${provider === p ? "active" : ""}`}
              aria-pressed={provider === p}
              onClick={() => setProvider(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-body-secondary">
          {launches.length === 0
            ? "No launches in the next 14 days."
            : "No launches match your filters."}
        </p>
      ) : (
        <div className="row g-3">
          {grid.map((l, i) => (
            <div className="col-12 col-md-6 col-xl-4" key={`${l.mission}-${l.net}-${i}`}>
              <LaunchCard launch={l} index={i} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
