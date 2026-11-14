import { useCallback, useRef, useState } from "react";
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

const initial = () =>
  Object.fromEntries(
    Object.keys(FETCHERS).map((k) => [k, { data: null, error: null, loading: false }])
  );

// Holds the four static Explore resources in App-level state so they survive
// tab switches. Each is fetched once, the first time its section is shown.
// There is no polling here (the ISS poll lives in its own component).
export default function useSpace() {
  const [state, setState] = useState(initial);
  const started = useRef(new Set());

  const run = useCallback((name) => {
    setState((s) => ({ ...s, [name]: { ...s[name], loading: true, error: null } }));
    FETCHERS[name]()
      .then((data) =>
        setState((s) => ({ ...s, [name]: { data, error: null, loading: false } }))
      )
      .catch((e) =>
        setState((s) => ({
          ...s,
          [name]: { ...s[name], loading: false, error: errorMessage(e) },
        }))
      );
  }, []);

  // Safe to call on every render of a section: only the first call fetches.
  const load = useCallback(
    (name) => {
      if (started.current.has(name)) return;
      started.current.add(name);
      run(name);
    },
    [run]
  );

  return { ...state, load, retry: run };
}
