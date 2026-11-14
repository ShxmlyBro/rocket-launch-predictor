import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import App from "./App";
import * as api from "./api";

jest.mock("./api", () => ({
  getFeatures: jest.fn(),
  getEdaStats: jest.fn(),
  getUpcoming: jest.fn(),
  predict: jest.fn(),
  errorMessage: jest.fn(),
  getSpaceAstronauts: jest.fn(),
  getSpaceEvents: jest.fn(),
  getSpaceMissions: jest.fn(),
  getSpaceNews: jest.fn(),
  getSpaceIss: jest.fn(),
}));

// WebGL and ESM-only packages cannot run in Jest, so the globe is a stub.
// Setting globalThis.__GLOBE_THROWS__ makes it throw, to test the error boundary.
jest.mock("./components/explore/IssGlobe", () => ({
  __esModule: true,
  default: ({ lat, lon, trail, onFail }) => {
    if (globalThis.__GLOBE_THROWS__) throw new Error("no webgl");
    // Simulates a library callback or timer failing after render (not catchable by a boundary).
    if (globalThis.__GLOBE_FAILS_ON_READY__) {
      setTimeout(() => onFail(), 0);
    }
    return (
      <div data-testid="globe-stub">
        globe {lat},{lon} trail {trail.length}
      </div>
    );
  },
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
      risk_percentile: 87,
      similar_rate: 0.123,
      similar_n: 683,
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
      net: future(70),
      weather,
      risk_score: 0.5,
      threshold: 0.226,
      above_threshold: true,
      risk_percentile: 96,
      similar_rate: 0.2,
      similar_n: 683,
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
      risk_percentile: null,
      similar_rate: null,
      similar_n: null,
      match_quality: "full",
      reasons: [],
      notes: [],
      verdict: "below threshold",
    },
    {
      mission: "Electron Test",
      rocket: "Electron",
      provider: "Rocket Lab",
      pad: "Mahia",
      net: future(100),
      weather: null,
      risk_score: null,
      threshold: null,
      above_threshold: null,
      match_quality: "full",
      reasons: [],
      notes: [],
      verdict: "not scored",
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
  api.getSpaceAstronauts.mockResolvedValue({ stale: false, items: [] });
  api.getSpaceEvents.mockResolvedValue({ stale: false, items: [] });
  api.getSpaceMissions.mockResolvedValue({ stale: false, items: [] });
  api.getSpaceNews.mockResolvedValue({ stale: false, items: [] });
  api.getSpaceIss.mockResolvedValue({
    stale: false,
    data: { latitude: 10, longitude: 20, altitude: 420, velocity: 27600 },
  });
  api.predict.mockResolvedValue({
    risk_probability: 0.234,
    above_threshold: true,
    threshold: 0.2,
    note: "Backend note.",
    risk_percentile: 71,
    similar_rate: 0.052,
    similar_n: 683,
  });
});

describe("Launches tab", () => {
  test("has no global banner or coverage banner, keeps a footer note", async () => {
    render(<App />);
    await screen.findByText("Starlink 10-1");
    expect(screen.queryByText(/model coverage/i)).toBeNull();
    expect(document.querySelector(".rough-note")).toBeNull();
    expect(
      within(document.querySelector("footer")).getByText(/not a safety tool/i)
    ).toBeInTheDocument();
  });

  test("hero shows the soonest launch with a segmented countdown", async () => {
    render(<App />);
    const hero = await screen.findByRole("region", { name: "Next launch" });
    expect(within(hero).getByText("Starlink 10-1")).toBeInTheDocument();
    expect(within(hero).getByText("Days")).toBeInTheDocument();
    expect(within(hero).getByText("Flagged")).toBeInTheDocument();
    expect(within(hero).getByText("0.310")).toBeInTheDocument();
  });

  test("scored cards show the plain-language reading and a keyboard-friendly explainer", async () => {
    render(<App />);
    const hero = await screen.findByRole("region", { name: "Next launch" });
    expect(
      within(hero).getByText(
        /Past launches with a similar score had a failure or partial failure about 12% of the time/
      )
    ).toBeInTheDocument();
    expect(within(hero).getByText("Riskier than 87% of past launches")).toBeInTheDocument();
    expect(within(hero).getByText("Risk reading")).toBeInTheDocument();

    const help = within(hero).getByRole("button", { name: /what does this mean/i });
    expect(help).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(help);
    expect(help).toHaveAttribute("aria-expanded", "true");
    expect(within(hero).getByText(/not the chance that this launch will fail/i)).toBeInTheDocument();
    expect(within(hero).getByText(/dominated by older rockets/i)).toBeInTheDocument();
    expect(within(hero).getByText(/false alarms/i)).toBeInTheDocument();
  });

  test("without the new fields a card falls back to score and gauge only", async () => {
    render(<App />);
    await screen.findByText("Crew Dragon Ax");
    const card = screen.getByText("Crew Dragon Ax").closest(".launch-card");
    expect(within(card).queryByText("Risk reading")).toBeNull();
    expect(within(card).queryByText(/similar score/i)).toBeNull();
    expect(within(card).getByText("0.100")).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: /details/i }));
    expect(within(card).getByText("Model risk score 0.100")).toBeInTheDocument();
  });

  test("full cards show a verdict, score, threshold and caption", async () => {
    render(<App />);
    await screen.findByText("Crew Dragon Ax");
    const full = screen.getByText("Crew Dragon Ax").closest(".launch-card");
    expect(within(full).getByText("Not flagged")).toBeInTheDocument();
    expect(within(full).getByText("Model risk score")).toBeInTheDocument();
    expect(within(full).getByText("0.100")).toBeInTheDocument();
    expect(within(full).getByText("Threshold 0.226")).toBeInTheDocument();
    expect(
      within(full).getByText("Ranking score, not a probability")
    ).toBeInTheDocument();
  });

  test("limited cards show a muted score, a pill and no verdict", async () => {
    render(<App />);
    await screen.findByText("Soyuz MS-30");
    const limited = screen.getByText("Soyuz MS-30").closest(".launch-card");
    expect(limited).toHaveClass("limited");
    // Dashed outline only: no muted or greyed styling anywhere on the card.
    expect(limited.className).not.toMatch(/muted/);
    expect(limited.querySelector(".muted")).toBeNull();
    expect(within(limited).getByText("Low confidence")).toBeInTheDocument();
    expect(
      within(limited).getByText(/about 20% of the time/)
    ).toBeInTheDocument();
    expect(within(limited).getByText("0.500")).toBeInTheDocument();
    expect(within(limited).getByText("Model risk score")).toBeInTheDocument();
    expect(
      within(limited).getByText(
        "Some inputs were not in the training data, so treat this as indicative only."
      )
    ).toBeInTheDocument();
    expect(within(limited).queryByText("Flagged")).toBeNull();
    expect(within(limited).queryByText("Not flagged")).toBeNull();

    fireEvent.click(within(limited).getByRole("button", { name: /why\?/i }));
    expect(
      within(limited).getByText("Vehicle not in training categories")
    ).toBeInTheDocument();
  });

  test("a null score shows the fallback text instead of a gauge", async () => {
    render(<App />);
    await screen.findByText("Electron Test");
    const card = screen.getByText("Electron Test").closest(".launch-card");
    expect(within(card).getByText("Forecast not available yet")).toBeInTheDocument();
    expect(within(card).queryByText("Model risk score")).toBeNull();
    expect(within(card).queryByText("Flagged")).toBeNull();
    expect(within(card).queryByText("Not flagged")).toBeNull();
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

  test("filters by provider chip, searches, and sorts by risk", async () => {
    render(<App />);
    await screen.findByText("Crew Dragon Ax");

    fireEvent.click(screen.getByRole("button", { name: "SpaceX" }));
    expect(screen.queryByText("Soyuz MS-30")).toBeNull();
    expect(screen.queryByRole("region", { name: "Next launch" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Search launches"), {
      target: { value: "vandenberg" },
    });
    expect(screen.queryByText("Starlink 10-1")).toBeNull();
    expect(screen.getByText("Crew Dragon Ax")).toBeInTheDocument();
  });

  test("sorting by risk puts scored cards (limited included) before unscored", async () => {
    render(<App />);
    await screen.findByText("Crew Dragon Ax");
    fireEvent.change(screen.getByLabelText("Sort launches"), {
      target: { value: "risk" },
    });
    // The hero holds Starlink 10-1, the soonest launch.
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(["Soyuz MS-30", "Crew Dragon Ax", "Electron Test"]);
  });

  test("a launch whose time has passed shows Launch window open", async () => {
    api.getUpcoming.mockResolvedValue({
      ...upcoming,
      launches: [{ ...upcoming.launches[0], net: future(-2) }],
    });
    render(<App />);
    expect(await screen.findByText("Launch window open")).toBeInTheDocument();
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
    expect(screen.getByText("Risk reading")).toBeInTheDocument();
    expect(screen.getByText(/about 5% of the time/)).toBeInTheDocument();
    expect(screen.getByText("Riskier than 71% of past launches")).toBeInTheDocument();
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
    expect(screen.getByText("How to read the risk numbers")).toBeInTheDocument();
    expect(screen.getByText(/held-out test set of 3,413 launches/)).toBeInTheDocument();
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

describe("Explore tab", () => {
  test("is the fifth tab and shows source credits", async () => {
    render(<App />);
    expect(screen.getAllByRole("tab")[4]).toHaveTextContent("Explore");
    await openTab("Explore");
    expect(screen.getByText(/The Space Devs \(Launch Library 2 and Spaceflight News API\)/))
      .toBeInTheDocument();
  });

  test("shows a stale notice for snapshot data", async () => {
    api.getSpaceNews.mockResolvedValue({ stale: true, _note: "sample data", items: [] });
    render(<App />);
    await openTab("Explore");
    fireEvent.click(screen.getByRole("button", { name: "News" }));
    expect(await screen.findByText(/showing sample data/i)).toBeInTheDocument();
  });

  test("news links open in a new tab with noopener noreferrer", async () => {
    api.getSpaceNews.mockResolvedValue({
      stale: false,
      items: [{ title: "Big launch", source: "Site", published_at: "2026-11-01T00:00:00Z",
                summary: "Short snippet", url: "https://example.com/a" }],
    });
    render(<App />);
    await openTab("Explore");
    fireEvent.click(screen.getByRole("button", { name: "News" }));
    const link = await screen.findByRole("link", { name: /read on site/i });
    expect(link).toHaveAttribute("href", "https://example.com/a");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  describe("stale data retry", () => {
    const stale = { stale: true, _note: "sample data", items: [] };
    const fresh = { stale: false, items: [] };

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const advance = (ms) => act(async () => { jest.advanceTimersByTime(ms); });

    async function openNews() {
      render(<App />);
      await openTab("Explore");
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "News" })); });
      await advance(0);
    }

    test("a stale response is refetched exactly once after about 10 s", async () => {
      api.getSpaceNews.mockResolvedValueOnce(stale).mockResolvedValue(fresh);
      await openNews();
      expect(screen.getByText(/showing sample data/i)).toBeInTheDocument();
      expect(api.getSpaceNews).toHaveBeenCalledTimes(1);
      await advance(9000);
      expect(api.getSpaceNews).toHaveBeenCalledTimes(1);
      await advance(1500);
      expect(api.getSpaceNews).toHaveBeenCalledTimes(2);
      expect(screen.queryByText(/showing sample data/i)).toBeNull();
      await advance(120000);
      expect(api.getSpaceNews).toHaveBeenCalledTimes(2);
    });

    test("if the second response is still stale it stops and keeps the notice", async () => {
      api.getSpaceNews.mockResolvedValue(stale);
      await openNews();
      await advance(10500);
      expect(api.getSpaceNews).toHaveBeenCalledTimes(2);
      await advance(300000);
      expect(api.getSpaceNews).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/showing sample data/i)).toBeInTheDocument();
    });

    test("leaving the Explore tab cancels the timer, coming back schedules it once", async () => {
      api.getSpaceNews.mockResolvedValueOnce(stale).mockResolvedValue(fresh);
      await openNews();
      await advance(3000);
      fireEvent.click(screen.getByRole("tab", { name: "Launches" }));
      await advance(60000);
      expect(api.getSpaceNews).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("tab", { name: "Explore" }));
      await advance(10500);
      expect(api.getSpaceNews).toHaveBeenCalledTimes(2);
      await advance(60000);
      expect(api.getSpaceNews).toHaveBeenCalledTimes(2);
    });

    test("the Refresh button refetches once and is disabled for 10 s", async () => {
      api.getSpaceNews.mockResolvedValue(stale);
      await openNews();
      const button = screen.getByRole("button", { name: "Refresh" });
      expect(button).toBeEnabled();
      await act(async () => { fireEvent.click(button); });
      expect(api.getSpaceNews).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
      // The click used up the one automatic retry, so no timer fires later.
      await advance(9000);
      expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
      await advance(1500);
      expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
      expect(api.getSpaceNews).toHaveBeenCalledTimes(2);
    });

    test("fresh data shows no notice and no Refresh button", async () => {
      api.getSpaceNews.mockResolvedValue(fresh);
      await openNews();
      expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
      await advance(60000);
      expect(api.getSpaceNews).toHaveBeenCalledTimes(1);
    });
  });

  describe("ISS polling", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      jest.useRealTimers();
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
    });

    afterEach(() => {
      delete globalThis.__GLOBE_THROWS__;
      delete globalThis.__GLOBE_FAILS_ON_READY__;
    });

    const advance = (ms) => act(async () => { jest.advanceTimersByTime(ms); });

    async function openIss() {
      render(<App />);
      await openTab("Explore");
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "ISS now" })); });
    }

    test("polls every 15 s and stops when the sub-section changes", async () => {
      await openIss();
      expect(api.getSpaceIss).toHaveBeenCalledTimes(1);
      await advance(15000);
      expect(api.getSpaceIss).toHaveBeenCalledTimes(2);
      fireEvent.click(screen.getByRole("button", { name: "News" }));
      await advance(60000);
      expect(api.getSpaceIss).toHaveBeenCalledTimes(2);
    });

    test("stops when the app tab changes", async () => {
      await openIss();
      await advance(15000);
      fireEvent.click(screen.getByRole("tab", { name: "Launches" }));
      await advance(60000);
      expect(api.getSpaceIss).toHaveBeenCalledTimes(2);
    });

    test("defaults to the lazy 3D globe and the toggle switches to the 2D map", async () => {
      await openIss();
      expect(await screen.findByTestId("globe-stub")).toBeInTheDocument();
      expect(screen.queryByRole("img", { name: /latitude and longitude grid/i })).toBeNull();
      expect(screen.getByRole("button", { name: "3D globe" })).toHaveAttribute("aria-pressed", "true");

      fireEvent.click(screen.getByRole("button", { name: "2D map" }));
      expect(screen.queryByTestId("globe-stub")).toBeNull();
      expect(screen.getByRole("img", { name: /latitude and longitude grid/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "3D globe" }));
      expect(await screen.findByTestId("globe-stub")).toBeInTheDocument();
      // The readout stays as the text source of truth.
      expect(screen.getByText("10.00°")).toBeInTheDocument();
      expect(screen.getByText("20.00°")).toBeInTheDocument();
    });

    test("falls back to the 2D map with a notice when the globe throws", async () => {
      globalThis.__GLOBE_THROWS__ = true;
      jest.spyOn(console, "error").mockImplementation(() => {});
      await openIss();
      expect(await screen.findByText("3D view unavailable on this device")).toBeInTheDocument();
      expect(screen.getByRole("img", { name: /latitude and longitude grid/i })).toBeInTheDocument();
      expect(screen.getByText("10.00°")).toBeInTheDocument();
    });

    test("falls back to the 2D map when the globe fails after render", async () => {
      globalThis.__GLOBE_FAILS_ON_READY__ = true;
      await openIss();
      await screen.findByTestId("globe-stub");
      await advance(10);
      expect(await screen.findByText("3D view unavailable on this device")).toBeInTheDocument();
      expect(screen.queryByTestId("globe-stub")).toBeNull();
      expect(screen.getByRole("img", { name: /latitude and longitude grid/i })).toBeInTheDocument();
    });

    test("globe view keeps one request per poll and stops after leaving", async () => {
      await openIss();
      await screen.findByTestId("globe-stub");
      expect(api.getSpaceIss).toHaveBeenCalledTimes(1);
      await advance(15000);
      expect(api.getSpaceIss).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("globe-stub")).toHaveTextContent("trail 1");
      fireEvent.click(screen.getByRole("tab", { name: "Launches" }));
      await advance(60000);
      expect(api.getSpaceIss).toHaveBeenCalledTimes(2);
    });

    test("stops on unmount and does not poll while the page is hidden", async () => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      const { unmount } = render(<App />);
      fireEvent.click(screen.getByRole("tab", { name: "Explore" }));
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "ISS now" })); });
      await advance(45000);
      expect(api.getSpaceIss).not.toHaveBeenCalled();
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      await advance(15000);
      expect(api.getSpaceIss).toHaveBeenCalledTimes(1);
      unmount();
      await advance(60000);
      expect(api.getSpaceIss).toHaveBeenCalledTimes(1);
    });
  });
});
