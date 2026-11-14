import React from "react";

const GLOSSARY = [
  {
    term: "LEO vs GEO",
    text: "Low Earth orbit (LEO) is a few hundred to about 2,000 km up, where the International Space Station orbits. Geostationary orbit (GEO) is about 35,786 km above the equator, where a satellite takes one day to circle Earth and so stays over the same spot.",
  },
  {
    term: "NET",
    text: "NET means \"no earlier than\". A launch marked NET can slip to a later time but is not planned to go sooner.",
  },
  {
    term: "Scrub",
    text: "A scrub is a launch attempt that is called off before liftoff, for example because of weather or a technical problem. The launch is then tried again on a later date.",
  },
  {
    term: "Apogee and perigee",
    text: "Apogee is the point in an orbit around Earth that is farthest from Earth. Perigee is the point that is closest to Earth.",
  },
  {
    term: "Anomaly",
    text: "In this project, an anomaly is a launch with a failure code in the GCAT data, meaning a failure or a partial failure. The model only gives a rough estimate of how likely that is and is not a safety tool.",
  },
];

export default function BasicsSection() {
  return (
    <dl className="row g-3 mb-0 glossary">
      {GLOSSARY.map(({ term, text }) => (
        <div className="col-12 col-md-6" key={term}>
          <div className="card h-100 space-card hover-lift">
            <div className="card-body">
              <dt className="h6">{term}</dt>
              <dd className="small mb-0">{text}</dd>
            </div>
          </div>
        </div>
      ))}
    </dl>
  );
}
