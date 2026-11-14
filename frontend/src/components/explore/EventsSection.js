import React, { useEffect, useMemo } from "react";
import { FiExternalLink } from "react-icons/fi";
import { formatDate } from "../../utils/format";
import { orderEvents } from "../../utils/space";
import { Empty, SpaceResource, safeUrl } from "./SpaceStatus";

function Body({ items }) {
  const ordered = useMemo(() => orderEvents(items, Date.now()), [items]);
  if (!ordered.length) return <Empty>No event data available.</Empty>;
  return (
    <div className="row g-3">
      {ordered.map((e, i) => {
        const link = safeUrl(e.info_url);
        return (
          <div className="col-12 col-md-6" key={`${e.name}-${i}`}>
            <div className="card h-100 space-card">
              <div className="card-body">
                {e.type && <span className="badge text-bg-info mb-2">{e.type}</span>}
                <h3 className="h6">{e.name}</h3>
                <div className="small text-body-secondary mb-2">{formatDate(e.date)}</div>
                {e.description && <p className="small">{e.description}</p>}
                {e.agencies?.length > 0 && (
                  <div className="small text-body-secondary">{e.agencies.join(", ")}</div>
                )}
                {link && (
                  <a className="small" href={link} target="_blank" rel="noopener noreferrer">
                    More info <FiExternalLink aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function EventsSection({ space }) {
  const { load } = space;
  useEffect(() => load("events"), [load]);
  return (
    <SpaceResource res={space.events} retry={() => space.retry("events")}>
      {(p) => <Body items={p.items || []} />}
    </SpaceResource>
  );
}
