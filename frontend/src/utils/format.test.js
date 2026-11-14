import {
  countdownParts,
  nextLaunch,
  sortByRisk,
  falseAlarmsPerCaught,
  formatCountdown,
  pct,
} from "./format";

test("formatCountdown counts down and handles missing or past dates", () => {
  const now = Date.parse("2026-11-14T00:00:00Z");
  expect(formatCountdown("2026-11-15T01:02:03Z", now)).toEqual({
    past: false,
    text: "1d 01h 02m 03s",
  });
  expect(formatCountdown("2026-11-13T00:00:00Z", now).past).toBe(true);
  expect(formatCountdown(null, now)).toBeNull();
  expect(formatCountdown("not a date", now)).toBeNull();
});

test("falseAlarmsPerCaught is (1 - precision) / precision", () => {
  expect(falseAlarmsPerCaught(0.115)).toBeCloseTo(7.696, 2);
  expect(falseAlarmsPerCaught(0)).toBeNull();
  expect(falseAlarmsPerCaught(undefined)).toBeNull();
});

test("pct formats fractions", () => {
  expect(pct(0.226)).toBe("22.6%");
});

test("sortByRisk ranks any numeric score, scored before unscored", () => {
  const list = [
    { mission: "none-early", risk_score: null, net: "2026-01-01T00:00:00Z" },
    { mission: "low-full", risk_score: 0.1, match_quality: "full", net: "2026-01-02T00:00:00Z" },
    { mission: "high-limited", risk_score: 0.5, match_quality: "limited", net: "2026-01-03T00:00:00Z" },
    { mission: "none-late", net: "2026-01-04T00:00:00Z" },
  ];
  expect(sortByRisk(list).map((l) => l.mission)).toEqual([
    "high-limited",
    "low-full",
    "none-early",
    "none-late",
  ]);
});

test("nextLaunch skips past launches and countdownParts splits time", () => {
  const now = Date.parse("2026-11-14T00:00:00Z");
  const list = [
    { mission: "past", net: "2026-11-13T00:00:00Z" },
    { mission: "soon", net: "2026-11-15T01:02:03Z" },
    { mission: "later", net: "2026-11-20T00:00:00Z" },
  ];
  expect(nextLaunch(list, now).mission).toBe("soon");
  expect(nextLaunch([list[0]], now)).toBeNull();
  expect(countdownParts(list[1].net, now)).toEqual({ past: false, d: 1, h: 1, m: 2, s: 3 });
  expect(countdownParts(list[0].net, now).past).toBe(true);
});
