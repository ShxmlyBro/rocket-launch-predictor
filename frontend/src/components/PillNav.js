import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Pill navigation with a sliding active indicator. mode "tab" renders ARIA
// tabs, mode "pressed" renders toggle buttons.
export default function PillNav({ items, value, onChange, mode = "pressed", label, className = "" }) {
  const listRef = useRef(null);
  const [bar, setBar] = useState(null);

  const measure = useCallback(() => {
    const el = listRef.current?.querySelector(".pill-btn.active");
    if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth });
  }, []);

  useLayoutEffect(measure, [measure, value, items]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div
      className={`pill-nav ${className}`}
      ref={listRef}
      role={mode === "tab" ? "tablist" : "group"}
      aria-label={label}
    >
      {bar && (
        <span
          className="pill-indicator"
          aria-hidden="true"
          style={{ transform: `translateX(${bar.left}px)`, width: bar.width }}
        />
      )}
      {items.map(({ id, label: text, Icon }) => {
        const active = value === id;
        const props =
          mode === "tab"
            ? { role: "tab", "aria-selected": active }
            : { "aria-pressed": active };
        return (
          <button
            key={id}
            type="button"
            className={`pill-btn ${active ? "active" : ""}`}
            onClick={() => onChange(id)}
            {...props}
          >
            {Icon && <Icon aria-hidden="true" />} <span>{text}</span>
          </button>
        );
      })}
    </div>
  );
}
