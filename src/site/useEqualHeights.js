import { useLayoutEffect, useRef } from "react";

// Site-wide rule: tiles that belong to the same set (e.g. the four "How it
// works" steps, or a row of calculator cards) must match each other's box
// size, not just their padding/font/colour — so a tile with more copy makes
// the rest of the set size up to match it, rather than the set looking
// uneven. CSS Grid's default `align-items: stretch` already gives this for
// granted for tiles that land in the same row, but it can't do it across
// separate rows (a 2x2 grid) or down a vertical list (a flex column) — both
// layouts size each item by its own content unless told otherwise. This hook
// covers those cases by measuring every tile's natural height and setting
// them all to the tallest one found.
//
// Re-measures on window resize, since word-wrap (and so each tile's own
// natural height) changes with viewport width. Resets every node's
// min-height to 0 before re-measuring, otherwise a tile stretched tall on a
// previous pass would be measured at that stretched height forever.
export function useEqualHeights(count) {
  const nodes = useRef([]);

  useLayoutEffect(() => {
    function apply() {
      const els = nodes.current.filter(Boolean);
      if (els.length < 2) return;
      els.forEach(el => { el.style.minHeight = "0px"; });
      const max = Math.max(...els.map(el => el.offsetHeight));
      els.forEach(el => { el.style.minHeight = `${max}px`; });
    }
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [count]);

  return function registerRef(i) {
    return function (el) { nodes.current[i] = el; };
  };
}
