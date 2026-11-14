import React, { createContext, useContext, useEffect, useState } from "react";

// One shared 1-second ticker for every countdown on the page.
// Only components that call useNow() re-render on each tick, because the
// provider's children prop keeps the same element identity.
const NowContext = createContext(Date.now());

export function NowProvider({ children }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

export const useNow = () => useContext(NowContext);
