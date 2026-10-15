import { useEffect, useRef, useState } from "react";

// A chart's width in real CSS pixels, kept current with a ResizeObserver, so
// its SVG viewBox matches the rendered width 1:1 (stretching a fixed viewBox
// scales strokes and text unevenly). Returns [ref, width]: put `ref` on the
// element to measure. `fallback` is the width before the first measurement,
// or whenever the element measures 0. `deps` re-measure when they change,
// e.g. once a section holding the chart opens.
export function useElementWidth(fallback, deps = []) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || fallback);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measures on the caller's deps
  }, deps);
  return [ref, width];
}
