import React, { useEffect } from "react";
import { formatDate } from "../../utils/format";
import { Empty, SpaceResource } from "./SpaceStatus";

function Body({ items }) {
  if (!items.length) return <Empty>No mission data available.</Empty>;
  return (
    <div className="row g-3">
      {items.map((m, i) => (
        <div className="col-12 col-md-6" key={`${m.name}-${i}`}>
          <div className="card h-100 space-card">
            <div className="card-body">
              {m.status && <span className="badge text-bg-secondary mb-2">{m.status}</span>}
              <h3 className="h6">{m.name}</h3>
              <div className="small text-body-secondary mb-2">{formatDate(m.date)}</div>
              {m.mission_description && <p className="small">{m.mission_description}</p>}
              <div className="small text-body-secondary">
                {[m.rocket, m.provider].filter(Boolean).join(" | ")}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MissionsSection({ space }) {
  const { load } = space;
  useEffect(() => load("missions"), [load]);
  return (
    <SpaceResource res={space.missions} retry={() => space.retry("missions")}>
      {(p) => <Body items={p.items || []} />}
    </SpaceResource>
  );
}
