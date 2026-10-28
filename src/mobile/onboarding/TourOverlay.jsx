import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import useDialogFocus from "../useDialogFocus.js";

// A tour's spotlight, shared by the Cash tour and the app tour: the page
// dimmed but for one part of it (marked `data-tour="..."`), and the step's
// card beside it. The tours own their steps and copy; this owns the light.
// `target`: the part to light (null: nothing lit, the card high on the
// screen). `round`: a circle round it (a round button). `stepKey`: changes
// with each step, to measure again and fade the card in. `onMissing`: the
// part isn't on the page. `press`: a tap acted out on the lit part, as the
// app tour does on a tab. `hidden`: the card out of sight (while it moves on).

const DIM = "rgba(22,47,36,0.55)";
const GAP = 10;   // between the lit part and its card
const TOP = 72;   // where a part is scrolled to, clear of the header
const tabBar = () => document.querySelector("[data-tab-bar]")?.getBoundingClientRect().height || 0;
// The one on screen: the tabs are in the page twice (bottom bar and desktop
// row), one of them hidden.
export const targetOf = id => [...document.querySelectorAll(`[data-tour="${id}"]`)].find(el => el.getClientRects().length) || null;

export default function TourOverlay({ target, round = false, stepKey, onMissing, onEscape, press = false, hidden = false, labelledBy, label, children }) {
  const reduce = useReducedMotion();
  const [rect, setRect] = useState(null);
  const [cardHeight, setCardHeight] = useState(0);
  const cardRef = useRef(null);
  // Tab stays in the card while the tour is open (the tours move focus to
  // each step's main button themselves).
  const boxRef = useRef(null);
  useDialogFocus(boxRef, { focusOnOpen: false });
  const latest = useRef({});
  latest.current = { onMissing, onEscape };

  // Into view, then measured; measured again as the page scrolls or resizes.
  useLayoutEffect(() => {
    const el = target ? targetOf(target) : null;
    // Gone since the tour began (the rates moved the figure, say): on.
    if (target && !el) { latest.current.onMissing?.(); return; }
    if (!el) { setRect(null); return; }
    // At most once a frame, however fast the scroll events come.
    let frame = 0;
    const measure = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; setRect(el.getBoundingClientRect()); });
    };
    const r = el.getBoundingClientRect();
    const fixed = getComputedStyle(el).position === "fixed" || el.closest("[data-tab-bar]");
    if (!fixed && (r.top < TOP || r.bottom > window.innerHeight - tabBar() - 200)) {
      window.scrollTo({ top: Math.max(0, r.top + window.scrollY - TOP), behavior: reduce ? "auto" : "smooth" });
    }
    setRect(el.getBoundingClientRect());
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    // The part itself changing size (a new target on the fund stop).
    const resized = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    resized?.observe(el);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); resized?.disconnect(); };
  }, [stepKey, target]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.getBoundingClientRect().height);
  }, [stepKey, rect]);

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") latest.current.onEscape?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Below the lit part where the card fits, above it where it fits there,
  // otherwise at the foot of the screen (a short screen). With nothing lit,
  // all at the same top line, so one flows into the next.
  const room = window.innerHeight - tabBar();
  const below = rect && rect.bottom + GAP + cardHeight <= room;
  const above = rect && rect.top - GAP - cardHeight >= 12;
  const placed = !rect ? Math.round(window.innerHeight * 0.18)
    : below ? rect.bottom + GAP
    : above ? rect.top - GAP - cardHeight
    : room - 12 - cardHeight;
  // Always wholly on screen, however tall the card or short the phone.
  const cardTop = Math.max(12, Math.min(placed, window.innerHeight - 12 - cardHeight));
  // The spotlight: round the lit part, or with nothing lit, closed to a
  // point mid-screen, its shadow dimming the whole page. A spring, so it
  // glides from part to part and follows the page as it scrolls.
  const hole = rect
    ? { top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, borderRadius: round ? (rect.width + 12) / 2 : 18 }
    : { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0, borderRadius: 0 };
  const glide = reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 24, mass: 1 };
  // The tap: the light closes in a little round the part and opens again.
  const tap = press && !reduce ? { scale: [1, 0.86, 1] } : { scale: 1 };

  return (
    // Over the page, the tab bar and Assist's button; the page can't be
    // tapped while it's open.
    <div ref={boxRef} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-label={label}
      onClick={e => e.stopPropagation()}
      style={{ position: "fixed", inset: 0, zIndex: 4700 }}>
      <motion.div aria-hidden="true" initial={false} animate={{ ...hole, ...tap }} transition={{ ...glide, scale: { duration: 0.3, times: [0, 0.45, 1] } }}
        style={{ position: "fixed", boxShadow: `0 0 0 9999px ${DIM}`, pointerEvents: "none" }}/>
      <motion.div ref={cardRef} initial={false} animate={{ top: cardTop, opacity: hidden ? 0 : 1 }} transition={{ top: glide, opacity: { duration: reduce ? 0 : 0.2 } }}
        style={{ position: "fixed", left: "16px", right: "16px", maxWidth: "548px", margin: "0 auto", maxHeight: "calc(100dvh - 24px)", overflowY: "auto", pointerEvents: hidden ? "none" : "auto" }}>
        <motion.div key={stepKey} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}>
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}
