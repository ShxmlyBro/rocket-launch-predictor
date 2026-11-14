import { useCallback, useEffect, useRef, useState } from "react";
import { getUpcoming, errorMessage } from "../api";

// Fetches /upcoming once and keeps the result in App-level state so it
// survives tab switches. No automatic polling: refresh is manual only
// (the backend caches for 30 minutes and Launch Library 2 is rate limited).
export default function useUpcoming() {
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: true,
    loadedAt: null,
  });
  const started = useRef(false);

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    getUpcoming()
      .then((data) =>
        setState({ data, error: null, loading: false, loadedAt: Date.now() })
      )
      .catch((e) =>
        setState((s) => ({ ...s, loading: false, error: errorMessage(e) }))
      );
  }, []);

  useEffect(() => {
    if (started.current) return; // avoids a double fetch under StrictMode
    started.current = true;
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
