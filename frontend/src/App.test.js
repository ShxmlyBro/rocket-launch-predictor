import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import * as api from "./api";

jest.mock("./api", () => ({
  getFeatures: jest.fn(),
  getEdaStats: jest.fn(),
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
  top_encoded_features: { "num__temp_mean": 10 },
};

beforeEach(() => {
  api.errorMessage.mockImplementation((e) => e.message);
  api.getFeatures.mockResolvedValue(features);
  api.getEdaStats.mockResolvedValue(eda);
  api.predict.mockResolvedValue({
    risk_probability: 0.234,
    above_threshold: true,
    threshold: 0.2,
    note: "Backend note.",
  });
});

test("prediction form fills from API and shows Model risk score", async () => {
  render(<App />);
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
  expect(screen.getByText("23.4%")).toBeInTheDocument();
  expect(screen.getByText(/not a calibrated probability/i)).toBeInTheDocument();
  expect(screen.getByText("Above threshold")).toBeInTheDocument();
  expect(screen.getAllByText(/not a safety tool/i).length).toBeGreaterThan(0);
});

test("shows error state with retry when features fail", async () => {
  api.getFeatures.mockRejectedValueOnce(new Error("boom"));
  render(<App />);
  expect(await screen.findByText(/boom/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
});

test("EDA tab shows class balance and top sites", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "EDA" }));
  expect(await screen.findByText(/Class balance/i)).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByText("Top sites by anomaly rate")).toBeInTheDocument()
  );
  expect(screen.getByText("WS")).toBeInTheDocument();
});
