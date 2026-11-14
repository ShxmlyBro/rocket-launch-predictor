import React, { useEffect, useRef, useState } from "react";

// Smooth expand and collapse. Content mounts on first open and then stays.
export default function Collapse({ open, children }) {
  const everOpen = useRef(open);
  if (open) everOpen.current = true;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!open) {
      setShown(false);
      return undefined;
    }
    const id =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(() => setShown(true))
        : null;
    if (id === null) setShown(true);
    return () => id !== null && cancelAnimationFrame(id);
  }, [open]);
  return (
    <div className={`collapse-wrap ${open && shown ? "open" : ""}`} aria-hidden={!open}>
      <div className="collapse-inner">{everOpen.current && children}</div>
    </div>
  );
}
