// Small pure helpers so they can be unit tested without rendering.

const pad = (n) => String(n).padStart(2, "0");

// Returns { past, text } or null when there is no usable date.
export function formatCountdown(netIso, nowMs) {
  if (!netIso) return null;
  const t = Date.parse(netIso);
  if (Number.isNaN(t)) return null;
  const diff = t - nowMs;
  if (diff <= 0) return { past: true, text: "Launch time reached" };
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

export function countFullMatches(launches) {
  return launches.filter((l) => l.match_quality === "full").length;
}
