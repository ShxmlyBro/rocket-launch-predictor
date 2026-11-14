import React, { useState } from "react";
import AstronautsSection from "./explore/AstronautsSection";
import BasicsSection from "./explore/BasicsSection";
import EventsSection from "./explore/EventsSection";
import IssSection from "./explore/IssSection";
import MissionsSection from "./explore/MissionsSection";
import NewsSection from "./explore/NewsSection";

const SECTIONS = [
  { id: "astronauts", label: "Astronauts" },
  { id: "events", label: "Events" },
  { id: "missions", label: "Missions" },
  { id: "news", label: "News" },
  { id: "iss", label: "ISS now" },
  { id: "basics", label: "Space basics" },
];

export default function ExploreTab({ space }) {
  const [section, setSection] = useState("astronauts");
  return (
    <div>
      <ul className="nav nav-pills flex-wrap gap-1 mb-3" aria-label="Explore sections">
        {SECTIONS.map(({ id, label }) => (
          <li className="nav-item" key={id}>
            <button
              type="button"
              aria-pressed={section === id}
              className={`nav-link py-1 ${section === id ? "active" : ""}`}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>

      {/* Only the active section is mounted, so the ISS poll stops when it is left. */}
      {section === "astronauts" && <AstronautsSection space={space} />}
      {section === "events" && <EventsSection space={space} />}
      {section === "missions" && <MissionsSection space={space} />}
      {section === "news" && <NewsSection space={space} />}
      {section === "iss" && <IssSection />}
      {section === "basics" && <BasicsSection />}

      <p className="small text-body-secondary mt-4 mb-0">
        Sources: The Space Devs (Launch Library 2 and Spaceflight News API) and wheretheiss.at.
      </p>
    </div>
  );
}
