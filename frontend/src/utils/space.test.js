import { filterAstronauts, orderEvents, sortAstronauts, statusRank } from "./space";

const people = [
  { name: "Zed", agency: "NASA", nationality: "American", status: "Deceased" },
  { name: "Bea", agency: "ESA", nationality: "French", status: "Mystery" },
  { name: "Cy", agency: "NASA", nationality: "American", status: "Active" },
  { name: "Al", agency: "JAXA", nationality: "Japanese", status: "In Space" },
];

test("sorts in space and active first, unknown in the middle, deceased last", () => {
  expect(sortAstronauts(people).map((p) => p.name)).toEqual(["Al", "Cy", "Bea", "Zed"]);
  expect(statusRank("")).toBe(2);
});

test("filters by search text, agency and status", () => {
  expect(filterAstronauts(people, { query: "japan" }).map((p) => p.name)).toEqual(["Al"]);
  expect(filterAstronauts(people, { agency: "NASA" })).toHaveLength(2);
  expect(filterAstronauts(people, { agency: "NASA", status: "Active" })).toHaveLength(1);
});

test("orders upcoming events soonest first, then past most recent first", () => {
  const now = Date.parse("2026-11-14T00:00:00Z");
  const ev = [
    { name: "old", date: "2026-11-01T00:00:00Z" },
    { name: "later", date: "2026-12-01T00:00:00Z" },
    { name: "soon", date: "2026-11-20T00:00:00Z" },
  ];
  expect(orderEvents(ev, now).map((e) => e.name)).toEqual(["soon", "later", "old"]);
});
