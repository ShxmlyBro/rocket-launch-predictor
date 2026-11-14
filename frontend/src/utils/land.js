// Prepares land polygons for the hexed-polygon layer. The H3 library behind it
// fails on any polygon that crosses the antimeridian (+-180 degrees), such as
// the merged Eurasia and Africa land mass in world-atlas, so those polygons are
// cut along +-180 into pieces that each stay within one half of the map.
// Pure functions with no imports, so they can be unit tested.

const same = (a, b) => a[0] === b[0] && a[1] === b[1];

// Makes longitudes continuous (no jumps larger than 180). Returns the ring and
// the total longitude drift from first to last point (0 for a normal ring).
function unwrapRing(ring) {
  const out = [ring[0].slice()];
  let offset = 0;
  for (let i = 1; i < ring.length; i++) {
    const d = ring[i][0] - ring[i - 1][0];
    if (d > 180) offset -= 360;
    else if (d < -180) offset += 360;
    out.push([ring[i][0] + offset, ring[i][1]]);
  }
  return { ring: out, drift: out[out.length - 1][0] - out[0][0] };
}

// Sutherland-Hodgman clip of a ring against one vertical line.
function clipSide(points, lon, keepGreater) {
  const inside = (p) => (keepGreater ? p[0] >= lon : p[0] <= lon);
  const cross = (a, b) => {
    const t = (lon - a[0]) / (b[0] - a[0]);
    return [lon, a[1] + t * (b[1] - a[1])];
  };
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const cur = points[i];
    const prev = points[(i + points.length - 1) % points.length];
    if (inside(cur)) {
      if (!inside(prev)) out.push(cross(prev, cur));
      out.push(cur);
    } else if (inside(prev)) {
      out.push(cross(prev, cur));
    }
  }
  return out;
}

function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

const crosses = (ring) => ring.some((p, i) => i > 0 && Math.abs(p[0] - ring[i - 1][0]) > 180);

// Splits one GeoJSON polygon (array of rings) into polygons that do not cross
// the antimeridian. Polygons that already behave are returned untouched, and so
// are polygons that enclose a pole (Antarctica).
export function splitPolygon(rings) {
  if (!rings.some(crosses)) return [rings];
  const { ring, drift } = unwrapRing(rings[0]);
  if (Math.abs(drift) > 1e-6) return [rings];

  const pieces = [];
  for (let k = -1; k <= 1; k++) {
    let pts = ring.slice(0, -1);
    pts = clipSide(pts, -180 + 360 * k, true);
    if (pts.length) pts = clipSide(pts, 180 + 360 * k, false);
    if (pts.length < 3) continue;
    const shifted = pts.map(([x, y]) => [x - 360 * k, y]);
    if (!same(shifted[0], shifted[shifted.length - 1])) shifted.push(shifted[0].slice());
    // A sliver that only touches the cut line has no area and breaks H3.
    const xs = shifted.map((q) => q[0]);
    const flat = Math.max(...xs) - Math.min(...xs) < 1e-4;
    if (shifted.length >= 4 && !flat) pieces.push([shifted]);
  }

  // Holes (lakes and inland seas) go to the piece that contains them.
  rings.slice(1).forEach((hole) => {
    const target = pieces.find((p) => pointInRing(hole[0], p[0]));
    if (target) target.push(hole);
  });
  return pieces;
}

// GeoJSON features (Polygon or MultiPolygon) in, safe Polygon features out.
export function prepareLand(features) {
  const out = [];
  features.forEach((f) => {
    const g = f.geometry;
    if (!g) return;
    const polys = g.type === "MultiPolygon" ? g.coordinates : g.type === "Polygon" ? [g.coordinates] : [];
    polys.forEach((rings) => {
      splitPolygon(rings).forEach((r) =>
        out.push({ type: "Feature", geometry: { type: "Polygon", coordinates: r } })
      );
    });
  });
  return out;
}
