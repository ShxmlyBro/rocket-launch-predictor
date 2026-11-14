// Pure helpers for the Explore tab, kept out of components so they can be unit tested.

const norm = (s) => String(s || "").trim().toLowerCase();

// Rank used for sorting: lower comes first.
// 0 in space, 1 active, 2 anything else (neutral, middle), 3 deceased (last).
export function statusRank(status) {
  const s = norm(status);
  if (/deceased|\bdead\b/.test(s)) return 3;
  if (/in[\s-]?space|on orbit|in orbit/.test(s)) return 0;
  if (/\bactive\b/.test(s)) return 1;
  return 2;
}

// Bootstrap badge colour for a status: green, neutral grey or dark.
export function statusTone(status) {
  const rank = statusRank(status);
  if (rank <= 1) return "success";
  if (rank === 3) return "dark";
  return "secondary";
}

export function sortAstronauts(list) {
  return [...list].sort(
    (a, b) =>
      statusRank(a.status) - statusRank(b.status) ||
      String(a.name || "").localeCompare(String(b.name || ""))
  );
}

export function uniqueSorted(list, key) {
  return [...new Set(list.map((x) => x[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

// query matches name, nationality or agency; agency and status are exact ("" = any).
export function filterAstronauts(list, { query = "", agency = "", status = "" } = {}) {
  const q = norm(query);
  return list.filter((a) => {
    if (agency && a.agency !== agency) return false;
    if (status && a.status !== status) return false;
    if (!q) return true;
    return [a.name, a.nationality, a.agency].some((v) => norm(v).includes(q));
  });
}

// Upcoming events first (soonest first), then past events (most recent first).
export function orderEvents(events, nowMs) {
  const time = (e) => {
    const t = Date.parse(e.date);
    return Number.isNaN(t) ? null : t;
  };
  const upcoming = events.filter((e) => time(e) !== null && time(e) >= nowMs);
  const past = events.filter((e) => time(e) === null || time(e) < nowMs);
  upcoming.sort((a, b) => time(a) - time(b));
  past.sort((a, b) => (time(b) ?? -Infinity) - (time(a) ?? -Infinity));
  return [...upcoming, ...past];
}

// Position of a point on an equirectangular map, as percentages from the top-left.
// Returns null if the coordinates are missing or out of range.
export function mapPosition(lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { x: ((lon + 180) / 360) * 100, y: ((90 - lat) / 180) * 100 };
}
