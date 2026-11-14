import React, { useEffect } from "react";
import { FiExternalLink } from "react-icons/fi";
import { formatDate } from "../../utils/format";
import { Empty, SpaceResource, safeUrl } from "./SpaceStatus";

// Headline, source, date and a short snippet only. Article bodies are never shown.
function Body({ items }) {
  if (!items.length) return <Empty>No news available.</Empty>;
  return (
    <div className="row g-3">
      {items.map((n, i) => {
        const link = safeUrl(n.url);
        return (
          <div className="col-12 col-md-6" key={`${n.title}-${i}`}>
            <div className="card h-100 space-card">
              <div className="card-body">
                <h3 className="h6">{n.title}</h3>
                <div className="small text-body-secondary mb-2">
                  {[n.source, formatDate(n.published_at)].filter(Boolean).join(" | ")}
                </div>
                {n.summary && <p className="small">{n.summary}</p>}
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="small">
                    Read on {n.source || "source site"} <FiExternalLink aria-hidden="true" />
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

export default function NewsSection({ space }) {
  const { load } = space;
  useEffect(() => load("news"), [load]);
  return (
    <SpaceResource res={space.news} retry={() => space.retry("news")}>
      {(p) => <Body items={p.items || []} />}
    </SpaceResource>
  );
}
