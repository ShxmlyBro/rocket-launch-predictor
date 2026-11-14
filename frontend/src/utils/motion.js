import { useEffect, useRef, useState } from "react";

export function prefersReducedMotion() {
  try {
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}

// True once the element has scrolled into view. Without IntersectionObserver
// (old browsers, tests) it is true straight away.
export function useInView() {
  const ref = useRef(null);
  const supported = typeof IntersectionObserver !== "undefined";
  const [seen, setSeen] = useState(!supported);
  useEffect(() => {
    if (seen || !ref.current) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

// Counts from 0 to target once active. No animation when reduced motion is
// requested or requestAnimationFrame is missing.
const canAnimate = () =>
  !prefersReducedMotion() &&
  typeof requestAnimationFrame !== "undefined" &&
  typeof IntersectionObserver !== "undefined";

export function useCountUp(target, active, ms = 900) {
  const instant = !canAnimate();
  const [value, setValue] = useState(instant ? target : 0);
  useEffect(() => {
    if (!active || !canAnimate()) return undefined;
    let raf;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / ms);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active, ms]);
  return instant ? target : value;
}
