import React, { useState } from "react";
import { FiBookOpen, FiCalendar, FiGlobe, FiRadio, FiTarget, FiUsers } from "react-icons/fi";
import PillNav from "./PillNav";
import AstronautsSection from "./explore/AstronautsSection";
import BasicsSection from "./explore/BasicsSection";
import EventsSection from "./explore/EventsSection";
import IssSection from "./explore/IssSection";
import MissionsSection from "./explore/MissionsSection";
import NewsSection from "./explore/NewsSection";

const SECTIONS = [
  { id: "astronauts", label: "Astronauts", Icon: FiUsers },
  { id: "events", label: "Events", Icon: FiCalendar },
  { id: "missions", label: "Missions", Icon: FiTarget },
  { id: "news", label: "News", Icon: FiRadio },
  { id: "iss", label: "ISS now", Icon: FiGlobe },
  { id: "basics", label: "Space basics", Icon: FiBookOpen },
];

export default function ExploreTab({ space }) {
  const [section, setSection] = useState("astronauts");
  return (
    <div>
      <PillNav
        items={SECTIONS}
        value={section}
        onChange={setSection}
        label="Explore sections"
        className="mb-3 sub-nav"
      />

      {/* Only the active section is mounted, so the ISS poll stops when it is left. */}
      {section === "astronauts" && <AstronautsSection space={space} />}
      {section === "events" && <EventsSection space={space} />}
      {section === "missions" && <MissionsSection space={space} />}
      {section === "news" && <NewsSection space={space} />}
      {section === "iss" && <IssSection />}
      {section === "basics" && <BasicsSection />}

      <p className="small text-body-secondary mt-4 mb-0">
        Sources: The Space Devs (Launch Library 2 and Spaceflight News API) and wheretheiss.at. Land outlines: Natural Earth (public domain), via world-atlas.
      </p>
    </div>
  );
}
