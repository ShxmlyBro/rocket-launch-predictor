import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import App from "./App";
import * as api from "./api";

jest.mock("./api", () => ({
  getFeatures: jest.fn(),
  getEdaStats: jest.fn(),
  getUpcoming: jest.fn(),
  predict: jest.fn(),
  errorMessage: jest.fn(),
}));

const features = {
  categories: {
    Launch_Site: ["CC", "WS"],
    LV_Type: ["Falcon 9"],
    Agency: ["SpaceX"],
  },
  numeric_ranges: {
    temp_mean: { min: -60, max: 60 },
    precipitation: { min: 0, max: 500 },
    max_wind_speed: { min: 0, max: 200 },
  },
};

const eda = {
  metrics: {
    Model: "RF",
    Threshold: 0.226,
    Accuracy: 0.569,
    Precision: 0.115,
    Recall: 0.76,
    F2: 0.359,
    "PR-AUC": 0.161,
    "ROC-AUC": 0.724,
  },
  eda_stats: {
    total_records: 100,
    success: 94,
    anomaly: 6,
    anomaly_pct: 6.0,
    weather_means_by_outcome: {
      Anomaly: { temp_mean: 1, precipitation: 2, max_wind_speed: 3 },
      Success: { temp_mean: 1, precipitation: 2, max_wind_speed: 3 },
    },
    top_sites: [
      { Launch_Site: "WS", launches: 50, anomalies: 5, anomaly_rate: 10 },
    ],
  },
  feature_importance_by_variable: { LV_Type: 30 },
  top_encoded_features: { num__temp_mean: 10 },
};

const future = (hours) => new Date(Date.now() + hours * 3600 * 1000).toISOString();

const weather = { temp_mean: 24, precipitation: 0.2, max_wind_speed: 18 };

const upcoming = {
  stale: false,
  as_of: "2026-11-14T10:00:00Z",
  note: "Weather is a forecast.",
  launches: [
    {
      mission: "Starlink 10-1",
      rocket: "Falcon 9",
      provider: "SpaceX",
      pad: "Cape Canaveral",
      net: future(30),
      weather,
      risk_score: 0.31,
      threshold: 0.226,
      above_threshold: true,
      match_quality: "full",
      reasons: [],
      notes: ["Pad matched approximately."],
      verdict: "above threshold",
    },
    {
      mission: "Soyuz MS-30",
      rocket: "Soyuz 2.1a",
      provider: "Roscosmos",
      pad: "Baikonur",
      net: future(10),
      weather,
      risk_score: 0.5,
      threshold: 0.226,
      above_threshold: true,
      match_quality: "limited",
      reasons: ["Vehicle not in training categories"],
      notes: [],
      verdict: "low confidence",
    },
    {
      mission: "Crew Dragon Ax",
      rocket: "Falcon 9",
      provider: "SpaceX",
      pad: "Vandenberg",
      net: future(60),
      weather,
      risk_score: 0.1,
      threshold: 0.226,
      above_threshold: false,
      match_quality: "full",
      reasons: [],
      notes: [],
      verdict: "below threshold",
    },
  ],
};

async function openTab(name) {
  fireEvent.click(screen.getByRole("tab", { name }));
}

beforeEach(() => {
  jest.restoreAllMocks();
  api.errorMessage.mockImplementation((e) => e.message);
  api.getFeatures.mockResolvedValue(features);
  api.getEdaStats.mockResolvedValue(eda);
  api.getUpcoming.mockResolvedValue(upcoming);
  api.predict.mockResolvedValue({
    risk_probability: 0.234,
    above_threshold: true,
    threshold: 0.2,
    note: "Backend note.",
  });
});

describe("Launches tab", () => {
  test("shows coverage banner, verdicts, and a muted low-confidence card", async () => {
    render(<App />);
    await screen.findByText("Starlink 10-1");
    expect(
      screen.getByText(/2 of 3/).textContent
    ).toMatch(/launches matched the model's training categories/);

    const full = screen.getByText("Starlink 10-1").closest(".launch-card");
    expect(within(full).getByText("Flagged")).toBeInTheDocument();
    expect(within(full).getByText("Model risk score")).toBeInTheDocument();
    expect(within(full).getByText("0.310")).toBeInTheDocument();
    expect(within(full).getByText("Threshold 0.226")).toBeInTheDocument();
    expect(
      within(full).getByText("Ranking score, not a probability")
    ).toBeInTheDocument();

    const limited = screen.getByText("Soyuz MS-30").closest(".launch-card");
    expect(limited).toHaveClass("limited");
    expect(within(limited).getByText("Low confidence")).toBeInTheDocument();
    expect(within(limited).queryByText("Flagged")).toBeNull();
    expect(within(limited).queryByText("Not flagged")).toBeNull();
    expect(within(limited).queryByText("Model risk score")).toBeNull();

    fireEvent.click(within(limited).getByRole("button", { name: /why\?/i }));
    expect(
      within(limited).getByText("Vehicle not in training categories")
    ).toBeInTheDocument();
  });

  test("fetches upcoming once and keeps it across tab switches", async () => {
    render(<App />);
    await screen.findByText("Starlink 10-1");
    await openTab("What-if");
    await screen.findByLabelText(/launch site/i);
    await openTab("Launches");
    expect(await screen.findByText("Starlink 10-1")).toBeInTheDocument();
    expect(api.getUpcoming).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => expect(api.getUpcoming).toHaveBeenCalledTimes(2));
  });

  test("filters by provider, searches, and sorts by risk", async () => {
    render(<App />);
    await screen.findByText("Starlink 10-1");

    fireEvent.change(screen.getByLabelText("Filter by provider"), {
      target: { value: "SpaceX" },
    });
    expect(screen.queryByText("Soyuz MS-30")).toBeNull();

    fireEvent.change(screen.getByLabelText("Search launches"), {
      target: { value: "vandenberg" },
    });
    expect(screen.queryByText("Starlink 10-1")).toBeNull();
    expect(screen.getByText("Crew Dragon Ax")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search launches"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Sort launches"), {
      target: { value: "risk" },
    });
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(["Starlink 10-1", "Crew Dragon Ax"]);
  });

  test("shows a stale-data notice when stale is true", async () => {
    api.getUpcoming.mockResolvedValue({ ...upcoming, stale: true });
    render(<App />);
    expect(await screen.findByText(/saved snapshot/i)).toBeInTheDocument();
  });

  test("shows error with retry when upcoming fails", async () => {
    api.getUpcoming.mockRejectedValueOnce(new Error("offline"));
    render(<App />);
    expect(await screen.findByText(/offline/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("Starlink 10-1")).toBeInTheDocument();
  });
});

describe("What-if tab", () => {
  test("prediction form fills from API and shows Model risk score", async () => {
    render(<App />);
    await openTab("What-if");
    await screen.findByLabelText(/launch site/i);
    expect(screen.getByRole("option", { name: "WS" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/mean temperature/i), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByLabelText(/precipitation/i), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText(/max wind speed/i), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /estimate risk/i }));

    expect(await screen.findByText("Model risk score")).toBeInTheDocument();
    expect(screen.getByText("0.234")).toBeInTheDocument();
    expect(screen.getByText(/threshold 0\.200/)).toBeInTheDocument();
    expect(screen.getByText(/not a calibrated probability/i)).toBeInTheDocument();
    expect(screen.getByText("Above threshold")).toBeInTheDocument();
    expect(screen.getAllByText(/not a safety tool/i).length).toBeGreaterThan(0);
  });

  test("shows error state with retry when features fail", async () => {
    api.getFeatures.mockRejectedValueOnce(new Error("boom"));
    render(<App />);
    await openTab("What-if");
    expect(await screen.findByText(/boom/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

describe("Insights tab", () => {
  test("shows class balance, top sites and the weather-signal statement", async () => {
    render(<App />);
    await openTab("Insights");
    expect(await screen.findByText(/Class balance/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Top sites by anomaly rate")).toBeInTheDocument()
    );
    expect(screen.getByText("WS")).toBeInTheDocument();
    expect(screen.getByText(/barely above chance/i)).toBeInTheDocument();
    expect(screen.getByText(/wind speed has a\s+small effect/i)).toBeInTheDocument();
    expect(
      screen.getByText(/temperature and precipitation add nothing\s+measurable/i)
    ).toBeInTheDocument();
  });
});

describe("About tab", () => {
  test("reads metrics from the API, computes false alarms, never says accuracy", async () => {
    render(<App />);
    await openTab("About the model");
    expect(await screen.findByText("0.760")).toBeInTheDocument();
    expect(screen.getByText("0.115")).toBeInTheDocument();
    expect(screen.getByText("0.359")).toBeInTheDocument();
    expect(screen.getByText("0.161")).toBeInTheDocument();
    // (1 - 0.115) / 0.115 = 7.7
    expect(screen.getByText("7.7")).toBeInTheDocument();
    expect(screen.getByText("22.6%")).toBeInTheDocument();
    expect(screen.getByText(/weather adds little signal/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/accuracy/i);
  });
});

describe("Theme", () => {
  test("toggles dark mode and survives localStorage throwing", async () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<App />);
    await screen.findByText("Starlink 10-1");
    expect(document.documentElement.getAttribute("data-bs-theme")).toBe("light");
    fireEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    expect(document.documentElement.getAttribute("data-bs-theme")).toBe("dark");
  });
});
