// Small pure helpers so they can be unit tested without rendering.

const pad = (n) => String(n).padStart(2, "0");

// Returns { past, text } or null when there is no usable date.
export function formatCountdown(netIso, nowMs) {
  if (!netIso) return null;
  const t = Date.parse(netIso);
  if (Number.isNaN(t)) return null;
  const diff = t - nowMs;
  if (diff <= 0) return { past: true, text: "Launch window open" };
  const total = Math.floor(diff / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { past: false, text: `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` };
}

export function formatDate(iso) {
  if (!iso) return "Date to be confirmed";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return String(iso);
  return new Date(t).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// risk values from the API are fractions between 0 and 1.
export const pct = (x, digits = 1) => `${(x * 100).toFixed(digits)}%`;

// Expected false alarms for every real anomaly caught: (1 - precision) / precision.
export function falseAlarmsPerCaught(precision) {
  if (typeof precision !== "number" || !(precision > 0) || precision > 1) {
    return null;
  }
  return (1 - precision) / precision;
}

export const hasScore = (l) => typeof l?.risk_score === "number";

const timeOf = (l) => {
  const t = Date.parse(l?.net);
  return Number.isNaN(t) ? Infinity : t;
};

// Any numeric score ranks (full or limited); unscored launches sort last.
// Ties keep date order.
export function sortByRisk(launches) {
  return [...launches].sort((a, b) => {
    const sa = hasScore(a);
    const sb = hasScore(b);
    if (sa !== sb) return sa ? -1 : 1;
    if (sa && sb && a.risk_score !== b.risk_score) return b.risk_score - a.risk_score;
    return timeOf(a) - timeOf(b);
  });
}

export const sortByDate = (launches) =>
  [...launches].sort((a, b) => timeOf(a) - timeOf(b));

// Soonest launch that has not happened yet, or null.
export function nextLaunch(launches, nowMs) {
  const future = launches.filter((l) => timeOf(l) > nowMs && timeOf(l) !== Infinity);
  return sortByDate(future)[0] || null;
}

// Days, hours, minutes, seconds for the segmented countdown, or null.
export function countdownParts(netIso, nowMs) {
  const t = Date.parse(netIso);
  if (!netIso || Number.isNaN(t)) return null;
  const diff = t - nowMs;
  if (diff <= 0) return { past: true, d: 0, h: 0, m: 0, s: 0 };
  const total = Math.floor(diff / 1000);
  return {
    past: false,
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

// Generic coloured initials for a provider (no logos).
export function providerInitials(name) {
  const words = String(name || "?")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function providerHue(name) {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
