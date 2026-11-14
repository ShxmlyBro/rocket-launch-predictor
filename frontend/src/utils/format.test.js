import {
  countFullMatches,
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

test("pct and countFullMatches", () => {
  expect(pct(0.226)).toBe("22.6%");
  expect(
    countFullMatches([
      { match_quality: "full" },
      { match_quality: "limited" },
      { match_quality: "full" },
    ])
  ).toBe(2);
});
