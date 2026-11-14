import React from "react";
import { FiMapPin, FiNavigation } from "react-icons/fi";
import {
  LaunchPill,
  ProviderChip,
  RiskArea,
  SegmentedCountdown,
  WeatherChips,
  isLimited,
} from "./LaunchParts";
import { providerHue } from "../utils/format";

export default function NextLaunchHero({ launch }) {
  const style = { "--accent": `hsl(${providerHue(launch.provider)} 75% 55%)` };
  return (
    <section
      className={`card hero-card mb-4 ${isLimited(launch) ? "limited" : ""}`}
      style={style}
      aria-label="Next launch"
    >
      <div className="card-body p-3 p-md-4">
        <div className="row g-4 align-items-center">
          <div className="col-lg-7">
            <div className="hero-kicker">
              <FiNavigation aria-hidden="true" /> Next launch
            </div>
            <h2 className="hero-title">{launch.mission}</h2>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
              <ProviderChip name={launch.provider} />
              <span className="small text-body-secondary">{launch.rocket}</span>
              <LaunchPill launch={launch} />
            </div>
            <SegmentedCountdown net={launch.net} />
            <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
              <span className="chip">
                <FiMapPin aria-hidden="true" /> {launch.pad || "Pad unknown"}
              </span>
              <WeatherChips weather={launch.weather} />
            </div>
          </div>
          <div className="col-lg-5">
            <RiskArea launch={launch} size="lg" />
          </div>
        </div>
      </div>
    </section>
  );
}
