import React, { useMemo, useState } from "react";
import { FiAlertTriangle, FiRefreshCw, FiSearch } from "react-icons/fi";
import LaunchCard from "./LaunchCard";
import { SkeletonCards, WakingNotice } from "./Loading";
import { countFullMatches, formatDate } from "../utils/format";

const time = (l) => {
  const t = Date.parse(l.net);
  return Number.isNaN(t) ? Infinity : t;
};

// Limited-match launches carry no flagged verdict, so they are never ranked by risk.
const riskKey = (l) =>
  l.match_quality === "full" && typeof l.risk_score === "number"
    ? l.risk_score
    : -1;

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
    return [...list].sort((a, b) =>
      sort === "risk"
        ? riskKey(b) - riskKey(a) || time(a) - time(b)
        : time(a) - time(b)
    );
  }, [launches, provider, query, sort]);

  const header = (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <h2 className="h4 mb-0">Upcoming launches</h2>
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

  const fullCount = countFullMatches(launches);

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

      <div className="alert alert-info" role="status">
        <strong>Model coverage:</strong> {fullCount} of {launches.length}{" "}
        launches matched the model's training categories. The rest are shown as
        low confidence with no verdict, because the training data is dominated
        by older vehicles.
      </div>

      <div className="row g-2 mb-4">
        <div className="col-12 col-md-5">
          <div className="input-group">
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
        </div>
        <div className="col-6 col-md-4">
          <select
            className="form-select"
            aria-label="Filter by provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="all">All providers</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <select
            className="form-select"
            aria-label="Sort launches"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="date">Sort by date</option>
            <option value="risk">Sort by risk</option>
          </select>
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
          {visible.map((l, i) => (
            <div className="col-12 col-md-6 col-xl-4" key={`${l.mission}-${l.net}-${i}`}>
              <LaunchCard launch={l} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
