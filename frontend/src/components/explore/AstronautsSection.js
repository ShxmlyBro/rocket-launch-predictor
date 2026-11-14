import React, { useEffect, useMemo, useState } from "react";
import { filterAstronauts, sortAstronauts, statusTone, uniqueSorted } from "../../utils/space";
import { Empty, SpaceImage, SpaceResource } from "./SpaceStatus";

const BIO_SHORT = 110;

function AstronautCard({ a }) {
  const [open, setOpen] = useState(false);
  const long = (a.bio || "").length > BIO_SHORT;
  return (
    <div className="card h-100 space-card hover-lift">
      <div className="card-body d-flex gap-3">
        <SpaceImage src={a.image_url} alt={a.name || "Astronaut"} className="astro-img" />
        <div className="min-w-0">
          <h3 className="h6 mb-1">{a.name}</h3>
          <div className="small text-body-secondary">
            {[a.nationality, a.agency].filter(Boolean).join(" | ")}
          </div>
          {a.status && (
            <span className={`badge text-bg-${statusTone(a.status)} mt-1`}>{a.status}</span>
          )}
        </div>
      </div>
      {a.bio && (
        <div className="card-body pt-0">
          <p className={`small mb-1 ${open ? "" : "clamp-2"}`}>{a.bio}</p>
          {long && (
            <button
              type="button"
              className="btn btn-link btn-sm p-0"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Body({ items }) {
  const [query, setQuery] = useState("");
  const [agency, setAgency] = useState("");
  const [status, setStatus] = useState("");
  const agencies = useMemo(() => uniqueSorted(items, "agency"), [items]);
  const statuses = useMemo(() => uniqueSorted(items, "status"), [items]);
  const shown = useMemo(
    () => sortAstronauts(filterAstronauts(items, { query, agency, status })),
    [items, query, agency, status]
  );
  return (
    <>
      <div className="row g-2 mb-3">
        <div className="col-12 col-md-6">
          <input
            type="search"
            className="form-control"
            placeholder="Search name, nationality or agency"
            aria-label="Search astronauts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-3">
          <select className="form-select" aria-label="Filter by agency" value={agency}
                  onChange={(e) => setAgency(e.target.value)}>
            <option value="">All agencies</option>
            {agencies.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <select className="form-select" aria-label="Filter by status" value={status}
                  onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
      </div>
      {shown.length === 0 ? (
        <Empty>{items.length ? "No astronauts match your filters." : "No astronaut data available."}</Empty>
      ) : (
        <div className="row g-3">
          {shown.map((a, i) => (
            <div className="col-12 col-md-6 col-xl-4" key={`${a.name}-${i}`}>
              <AstronautCard a={a} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function AstronautsSection({ space }) {
  const { load } = space;
  useEffect(() => load("astronauts"), [load]);
  return (
    <SpaceResource res={space.astronauts} retry={() => space.retry("astronauts")}>
      {(p) => <Body items={p.items || []} />}
    </SpaceResource>
  );
}
