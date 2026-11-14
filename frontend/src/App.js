import React, { useEffect, useState } from "react";
import {
  FiBarChart2,
  FiBookOpen,
  FiMoon,
  FiSend,
  FiSliders,
  FiSun,
} from "react-icons/fi";
import LaunchesTab from "./components/LaunchesTab";
import WhatIfTab from "./components/WhatIfTab";
import InsightsTab from "./components/InsightsTab";
import AboutTab from "./components/AboutTab";
import { NowProvider } from "./utils/NowContext";
import useUpcoming from "./utils/useUpcoming";
import "./App.css";

const TABS = [
  { id: "launches", label: "Launches", Icon: FiSend },
  { id: "whatif", label: "What-if", Icon: FiSliders },
  { id: "insights", label: "Insights", Icon: FiBarChart2 },
  { id: "about", label: "About the model", Icon: FiBookOpen },
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
      <nav className="navbar app-navbar sticky-top">
        <div className="container d-flex flex-wrap gap-2 align-items-center">
          <span className="navbar-brand mb-0">Rocket Launch Risk Estimator</span>
          <button
            type="button"
            className="btn btn-outline-light btn-sm ms-auto"
            onClick={toggleTheme}
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? <FiSun aria-hidden="true" /> : <FiMoon aria-hidden="true" />}
          </button>
        </div>
      </nav>

      <div className="rough-note" role="note">
        <div className="container">
          Rough estimate, not a safety tool. The model risk score ranks relative
          risk and most flagged launches are false alarms.
        </div>
      </div>

      <main className="container my-4">
        <ul className="nav nav-pills app-tabs mb-4" role="tablist">
          {TABS.map(({ id, label, Icon }) => (
            <li className="nav-item" role="presentation" key={id}>
              <button
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`nav-link ${tab === id ? "active" : ""}`}
                onClick={() => setTab(id)}
              >
                <Icon aria-hidden="true" /> <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div key={tab} className="tab-fade" role="tabpanel">
          {tab === "launches" && <LaunchesTab upcoming={upcoming} />}
          {tab === "whatif" && <WhatIfTab />}
          {tab === "insights" && <InsightsTab />}
          {tab === "about" && <AboutTab />}
        </div>
      </main>

      <footer className="py-3 text-center">
        <p>© {new Date().getFullYear()} Rocket Launch Risk Estimator | by Shamly</p>
      </footer>
    </NowProvider>
  );
}

export default App;
