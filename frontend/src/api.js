import axios from "axios";

export const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// Long timeout: the Render free tier can take about a minute to cold start.
const client = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 60000,
});

export const getFeatures = () => client.get("/features").then((r) => r.data);
export const getEdaStats = () => client.get("/eda-stats").then((r) => r.data);
export const getUpcoming = () => client.get("/upcoming").then((r) => r.data);
export const getSpaceAstronauts = () =>
  client.get("/space/astronauts").then((r) => r.data);
export const getSpaceEvents = () => client.get("/space/events").then((r) => r.data);
export const getSpaceMissions = () => client.get("/space/missions").then((r) => r.data);
export const getSpaceNews = () => client.get("/space/news").then((r) => r.data);
export const getSpaceIss = () => client.get("/space/iss").then((r) => r.data);
export const predict =(payload) =>
  client.post("/predict", payload).then((r) => r.data);

// Turn an axios error into a readable message.
export function errorMessage(err) {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`)
      .join("; ");
  }
  if (typeof detail === "string") return detail;
  if (err?.code === "ECONNABORTED") {
    return "The server took too long to respond. It may be waking up, please retry.";
  }
  if (!err?.response) {
    return "Could not reach the server. It may be waking up, please retry.";
  }
  return `Request failed (${err.response.status}).`;
}
