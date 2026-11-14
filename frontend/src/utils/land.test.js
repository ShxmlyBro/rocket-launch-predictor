import { prepareLand, splitPolygon } from "./land";

const ring = (pts) => [...pts, pts[0]];

test("polygons that stay on one side are returned untouched", () => {
  const poly = [ring([[10, 10], [20, 10], [20, 20], [10, 20]])];
  expect(splitPolygon(poly)).toEqual([poly]);
});

test("a polygon crossing +-180 is cut into two pieces within [-180, 180]", () => {
  // Spans 170 east to 170 west, written the way a cut topology stores it.
  const poly = [
    ring([[170, 0], [180, 0], [-180, 0], [-170, 0], [-170, 10], [-180, 10], [180, 10], [170, 10]]),
  ];
  const pieces = splitPolygon(poly);
  expect(pieces).toHaveLength(2);
  pieces.forEach((p) => {
    p[0].forEach(([x]) => {
      expect(x).toBeGreaterThanOrEqual(-180);
      expect(x).toBeLessThanOrEqual(180);
    });
    const xs = p[0].map((q) => q[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(10.0001);
  });
});

test("slivers that only touch the cut line are dropped", () => {
  const poly = [ring([[179, 70], [180, 70], [-180, 71], [-180, 70.5]])];
  const out = splitPolygon(poly);
  out.forEach((p) => {
    const xs = p[0].map((q) => q[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1e-4);
  });
});

test("prepareLand flattens MultiPolygons into Polygon features", () => {
  const out = prepareLand([
    {
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [ring([[0, 0], [5, 0], [5, 5]])],
          [ring([[10, 10], [15, 10], [15, 15]])],
        ],
      },
    },
    { geometry: null },
  ]);
  expect(out).toHaveLength(2);
  expect(out.every((f) => f.geometry.type === "Polygon")).toBe(true);
});
