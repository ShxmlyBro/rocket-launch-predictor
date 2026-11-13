import React, { useState } from "react";
import PredictionTab from "./components/PredictionTab";
import EdaTab from "./components/EdaTab";
import "./App.css";

const TABS = [
  { id: "predict", label: "Prediction" },
  { id: "eda", label: "EDA" },
];

function App() {
  const [tab, setTab] = useState("predict");

  return (
    <div>
      <nav className="navbar navbar-dark bg-dark">
        <div className="container">
          <span className="navbar-brand">Rocket Launch Risk Estimator</span>
        </div>
      </nav>

      <div className="hero">
        <div className="container text-center text-white">
          <h1>Launch anomaly risk</h1>
          <p>
            A rough estimate from launch site, vehicle, agency and weather. Not
            a safety tool.
          </p>
        </div>
      </div>

      <main className="container my-4">
        <ul className="nav nav-tabs mb-4" role="tablist">
          {TABS.map((t) => (
            <li className="nav-item" role="presentation" key={t.id}>
              <button
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`nav-link ${tab === t.id ? "active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
        {tab === "predict" ? <PredictionTab /> : <EdaTab />}
      </main>

      <footer className="text-white py-3 text-center">
        <p>© {new Date().getFullYear()} Rocket Launch Risk Estimator | by Shamly</p>
      </footer>
    </div>
  );
}

export default App;
