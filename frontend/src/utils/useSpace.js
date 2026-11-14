import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSpaceAstronauts,
  getSpaceEvents,
  getSpaceMissions,
  getSpaceNews,
  errorMessage,
} from "../api";

const FETCHERS = {
  astronauts: getSpaceAstronauts,
  events: getSpaceEvents,
  missions: getSpaceMissions,
  news: getSpaceNews,
};

export const STALE_RETRY_MS = 10000;

// Sample (snapshot) data: the backend sets stale, and a _note, on it.
const isStale = (d) => !!(d && (d.stale || d._note));

const initial = () =>
  Object.fromEntries(
    Object.keys(FETCHERS).map((k) => [k, { data: null, error: null, loading: false }])
  );

// Holds the four static Explore resources in App-level state so they survive
// tab switches. Each is fetched once, the first time its section is shown.
// There is no polling here (the ISS poll lives in its own component).
//
// A stale (sample data) response gets exactly one automatic refetch after about
// 10 s, because the server may only just have started. If that response is stale
// too, we stop and the notice stays. `active` is false while another app tab is
// open: pending timers are cleared then, and a refetch still owed is scheduled
// again when the Explore tab returns, so it never runs more than once.
export default function useSpace(active = true) {
  const [state, setState] = useState(initial);
  const started = useRef(new Set());
  const timers = useRef({});
  const owed = useRef(new Set()); // stale resources waiting for their one retry
  const retried = useRef(new Set()); // resources whose one retry is used up
  const activeRef = useRef(active);
  const runRef = useRef(null);

  const schedule = useCallback((name) => {
    if (timers.current[name]) return;
    timers.current[name] = setTimeout(() => {
      delete timers.current[name];
      owed.current.delete(name);
      retried.current.add(name);
      runRef.current(name);
    }, STALE_RETRY_MS);
  }, []);

  const run = useCallback(
    (name) => {
      setState((s) => ({ ...s, [name]: { ...s[name], loading: true, error: null } }));
      FETCHERS[name]()
        .then((data) => {
          setState((s) => ({ ...s, [name]: { data, error: null, loading: false } }));
          if (isStale(data) && !retried.current.has(name)) {
            owed.current.add(name);
            if (activeRef.current) schedule(name);
          } else {
            owed.current.delete(name);
          }
        })
        .catch((e) =>
          setState((s) => ({
            ...s,
            [name]: { ...s[name], loading: false, error: errorMessage(e) },
          }))
        );
    },
    [schedule]
  );
  runRef.current = run;

  // Manual refresh or error Retry: counts as the one retry and cancels the timer.
  const retry = useCallback(
    (name) => {
      clearTimeout(timers.current[name]);
      delete timers.current[name];
      owed.current.delete(name);
      retried.current.add(name);
      run(name);
    },
    [run]
  );

  useEffect(() => {
    activeRef.current = active;
    if (active) {
      owed.current.forEach((name) => schedule(name));
    } else {
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
    }
  }, [active, schedule]);

  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
    },
    []
  );

  // Safe to call on every render of a section: only the first call fetches.
  const load = useCallback(
    (name) => {
      if (started.current.has(name)) return;
      started.current.add(name);
      run(name);
    },
    [run]
  );

  return { ...state, load, retry };
}
