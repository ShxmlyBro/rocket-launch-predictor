import React, { useEffect, useState } from "react";
import {
  FiBarChart2,
  FiBookOpen,
  FiCompass,
  FiMoon,
  FiSend,
  FiSliders,
  FiSun,
} from "react-icons/fi";
import { FaRocket } from "react-icons/fa";
import PillNav from "./components/PillNav";
import LaunchesTab from "./components/LaunchesTab";
import WhatIfTab from "./components/WhatIfTab";
import InsightsTab from "./components/InsightsTab";
import AboutTab from "./components/AboutTab";
import ExploreTab from "./components/ExploreTab";
import { NowProvider } from "./utils/NowContext";
import useSpace from "./utils/useSpace";
import useUpcoming from "./utils/useUpcoming";
import "./App.css";

const TABS = [
  { id: "launches", label: "Launches", Icon: FiSend },
  { id: "whatif", label: "What-if", Icon: FiSliders },
  { id: "insights", label: "Insights", Icon: FiBarChart2 },
  { id: "about", label: "About the model", Icon: FiBookOpen },
  { id: "explore", label: "Explore", Icon: FiCompass },
];

const THEME_KEY = "theme";

function initialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch (e) {
    // storage can be blocked; fall through to the system preference
  }
  try {
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch (e) {
    // ignore
  }
  return "light";
}

function App() {
  const [tab, setTab] = useState("launches");
  const [theme, setTheme] = useState(initialTheme);
  // Fetched once here so the data survives tab switches.
  const upcoming = useUpcoming();
  // Explore data is fetched lazily, once per resource, and kept here too.
  const space = useSpace(tab === "explore");

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      // not persisted, the toggle still works for this visit
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <NowProvider>
      <header className="app-header">
        <div className="container d-flex align-items-center gap-3">
          <FaRocket className="brand-icon" aria-hidden="true" />
          <span className="brand-title">Rocket Launch Risk Estimator</span>
          <button
            type="button"
            className={`theme-switch ms-auto ${theme}`}
            onClick={toggleTheme}
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            <FiSun aria-hidden="true" className="ts-sun" />
            <FiMoon aria-hidden="true" className="ts-moon" />
            <span className="ts-knob" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="container app-main">
        <PillNav
          items={TABS}
          value={tab}
          onChange={setTab}
          mode="tab"
          label="Sections"
          className="mb-4"
        />
        <div key={tab} className="tab-fade" role="tabpanel">
          {tab === "launches" && <LaunchesTab upcoming={upcoming} />}
          {tab === "whatif" && <WhatIfTab />}
          {tab === "insights" && <InsightsTab />}
          {tab === "about" && <AboutTab />}
          {tab === "explore" && <ExploreTab space={space} />}
        </div>
      </main>

      <footer className="app-footer py-3 text-center">
        <div className="container">
          <p className="mb-1">
            Rough estimate, not a safety tool. Most flagged launches are false
            alarms.
          </p>
          <p>© {new Date().getFullYear()} Rocket Launch Risk Estimator | by Shamly</p>
        </div>
      </footer>
    </NowProvider>
  );
}

export default App;
