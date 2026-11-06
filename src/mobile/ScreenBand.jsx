import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useAnimate, useMotionValue, useReducedMotion } from "framer-motion";
import { CREAM, SANS, SR_ONLY, BAND_STOPS, slickBg } from "../design-tokens.js";

// A screen's top band and the cream sheet below it (Modules, Forecasts,
// Progress).
// The band runs to the screen's edges on a phone (out past the column's
// 20px padding and up under the top inset); where the column is narrower
// than the screen it's a rounded panel instead. On a phone the sheet
// overlaps the band's foot with rounded corners.
// `tone`: "light", the soft green-to-gold of Modules; "dark", the card
// stack's oil slick, with anything drawn past its edges cut off; "red" and
// "amber", the light band warning (Progress near the £100k trap).
// A figure printed on the band is as big as one on a stack's card.
// On a phone the band runs on BLEED px under the sheet, for the sheet's
// pull (useSheetPull) to show; the dark band's slick keeps its shape above
// that and carries on into it.
// The light band's colours are registered properties, so a change of tone
// (Progress's Tax shield in the £100k trap) fades rather than jumps; a
// browser without @property just switches.
// The reel (BandReel) runs out to the band's edges and is cut off there.
const BLEED = 200;
const tone = ([a, b, c]) => `--band-a: ${a}; --band-b: ${b}; --band-c: ${c};`;
const CSS = `
@property --band-a { syntax: "<color>"; inherits: false; initial-value: transparent; }
@property --band-b { syntax: "<color>"; inherits: false; initial-value: transparent; }
@property --band-c { syntax: "<color>"; inherits: false; initial-value: transparent; }
.screen-band { --hero-fig: 52px; --bleed: ${BLEED}px; }
@media (max-width: 379px) { .screen-band { --hero-fig: 44px; } }
@media (min-width: 1000px) { .screen-band { --hero-fig: 72px; } }
.screen-band { margin: calc(-16px - env(safe-area-inset-top, 0px)) -20px calc(-28px - var(--bleed)); padding: calc(22px + env(safe-area-inset-top, 0px)) 20px calc(52px + var(--bleed)); }
.screen-band.light { ${tone(BAND_STOPS.light)} }
.screen-band.red { ${tone(BAND_STOPS.red)} }
.screen-band.amber { ${tone(BAND_STOPS.amber)} }
.screen-band:not(.dark) { background: linear-gradient(160deg, var(--band-a) 0%, var(--band-b) 50%, var(--band-c) 100%); transition: --band-a 0.45s ease, --band-b 0.45s ease, --band-c 0.45s ease; }
.screen-band.dark { background: ${slickBg("calc(100% - var(--bleed))")}; overflow: hidden; }
.band-reel { margin: 0 -20px; padding: 0 20px; overflow-x: clip; }
.band-reel > div { display: grid; }
.band-reel > div > * { grid-area: 1 / 1; min-width: 0; }
.screen-sheet { position: relative; margin: -28px -20px 0; padding: 20px 20px 0; background: ${CREAM}; border-radius: 28px 28px 0 0; box-sizing: border-box; min-height: ${28 + BLEED}px; }
@media (min-width: 581px) {
  .screen-band { --bleed: 0px; margin: 0; padding: 22px 20px; border-radius: 28px; }
  .screen-sheet { margin: 0; padding: 20px 0 0; border-radius: 0; min-height: 0; }
}
`;

export function ScreenBand({ tone = "light", children, ...rest }) {
  return (
    <>
      <style>{CSS}</style>
      <div className={`screen-band ${tone}`} {...rest}>{children}</div>
    </>
  );
}

export function ScreenSheet({ children }) {
  const ref = useRef(null);
  useSheetPull(ref);
  return <div ref={ref} className="screen-sheet">{children}</div>;
}

// Pulled down from the top of the page, the sheet gives a little, showing
// more of the band behind it, and springs back on release, in place of the
// page's own bounce (and the browser's pull to refresh). Only for the feel:
// nothing reloads. Phone width and touch only; not from a pop-out, a field
// or a graph read by dragging, nor while a pop-out is open (the sheet's
// transform would carry a fixed pop-out with it). Only from the page's own
// band and sheet (their parent), not the tab bar or Assist floating over it.
// The drag is set straight on the sheet's style, not through React, so it
// keeps up with the finger. While it's pulling, the band's swipe stands down
// (`sheetPulling`), so a pull that drifts sideways doesn't switch the view.
const PULL_MAX = 150; // the most it can give, however far it's pulled
const SETTLE = "transform 0.55s cubic-bezier(0.2, 1.3, 0.35, 1)"; // a slight overshoot as it rights
let sheetPulling = false;
function useSheetPull(ref) {
  useEffect(() => {
    const sheet = ref.current;
    const page = sheet?.parentElement;
    if (!page) return;
    const phone = window.matchMedia("(max-width: 580px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    // The browser's own bounce and pull to refresh off only where this pull
    // takes their place.
    const root = document.documentElement;
    const overscroll = root.style.overscrollBehaviorY;
    const fit = () => { root.style.overscrollBehaviorY = phone.matches ? "none" : overscroll; };
    fit();
    phone.addEventListener("change", fit);
    let start = null, pulling = false;
    const end = () => {
      start = null;
      if (!pulling) return;
      pulling = sheetPulling = false;
      sheet.style.transition = reduce.matches ? "transform 0.2s ease-out" : SETTLE;
      sheet.style.transform = "";
    };
    const onStart = e => {
      start = null;
      if (!phone.matches || e.touches.length !== 1 || window.scrollY > 0) return;
      if (e.target.closest?.("[role=dialog], input, textarea, select, [data-scrub]")) return;
      if (page.querySelector("[role=dialog]")) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onMove = e => {
      if (!start) return;
      if (e.touches.length !== 1) return end();
      const dx = e.touches[0].clientX - start.x, dy = e.touches[0].clientY - start.y;
      if (!pulling) {
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        // Up, or more sideways than down (the band's swipe): not a pull.
        if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) { start = null; return; }
        pulling = sheetPulling = true;
        sheet.style.transition = "none";
      }
      if (e.cancelable) e.preventDefault();
      const give = PULL_MAX * (1 - 1 / (Math.max(0, dy) * 0.55 / PULL_MAX + 1));
      sheet.style.transform = `translate3d(0, ${give.toFixed(1)}px, 0)`;
    };
    const onSettled = e => { if (e.target === sheet && !pulling) sheet.style.transition = ""; };
    page.addEventListener("touchstart", onStart, { passive: true });
    page.addEventListener("touchmove", onMove, { passive: false });
    page.addEventListener("touchend", end);
    page.addEventListener("touchcancel", end);
    sheet.addEventListener("transitionend", onSettled);
    return () => {
      page.removeEventListener("touchstart", onStart);
      page.removeEventListener("touchmove", onMove);
      page.removeEventListener("touchend", end);
      page.removeEventListener("touchcancel", end);
      sheet.removeEventListener("transitionend", onSettled);
      phone.removeEventListener("change", fit);
      sheetPulling = false;
      root.style.overscrollBehaviorY = overscroll;
    };
  }, [ref]);
}

// A band with several views (Forecasts, Progress), swiped between or picked
// by the dots on its caption row. A mostly sideways drag switches the view,
// as the card stack's does (CardStack.jsx); the browser cancels the pointer
// when it takes an up or down drag as a page scroll. Touch and pen only: a
// mouse drag selects text, and the dots are there for a mouse. Not from a
// radio group, a field or a graph read by dragging (`data-scrub`), which
// take their own drags, nor while a pop-out card is open (a drag on its
// backdrop is to close it). Spread `bandProps` on the ScreenBand.
// The view on the band follows a sideways drag a little (held back) before
// it lets go; pass `reel` to BandReel for that and the slide between views.
export function useBandViews(count) {
  const [view, setView] = useState(0);
  const [dir, setDir] = useState(1); // 1: the next view comes in from the right
  const moved = useRef(false); // nothing announced until the first switch
  const swipe = useRef(null), swipedAt = useRef(0);
  const dragX = useMotionValue(0);
  const reduce = useReducedMotion();
  const showView = (i, d) => {
    if (i === view) return;
    moved.current = true;
    setDir(d ?? (i > view ? 1 : -1));
    setView(i);
  };
  const letGo = () => { if (dragX.get()) animate(dragX, 0, { type: "spring", stiffness: 380, damping: 36 }); };
  const bandProps = {
    style: { touchAction: "pan-y" },
    onPointerDown: e => {
      const open = e.currentTarget.querySelector("[role=dialog]");
      swipe.current = open || e.pointerType === "mouse" || e.target.closest("[role=radiogroup], input, [data-scrub]") ? null : { x: e.clientX, y: e.clientY };
    },
    onPointerMove: e => {
      const s = swipe.current;
      if (s && sheetPulling) { swipe.current = null; letGo(); return; }
      if (!s || reduce) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (!s.sideways && (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy))) return;
      s.sideways = true;
      dragX.set(dx * 0.35);
    },
    onPointerUp: e => {
      if (sheetPulling) swipe.current = null;
      if (!swipe.current) return;
      const dx = e.clientX - swipe.current.x, dy = e.clientY - swipe.current.y;
      swipe.current = null;
      if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) {
        swipedAt.current = Date.now();
        const d = dx < 0 ? 1 : -1;
        showView((view + d + count) % count, d);
      }
      letGo();
    },
    onPointerCancel: () => { swipe.current = null; letGo(); },
    // A swipe that ends on a button isn't also a tap. Only the click straight
    // after it: a touch swipe often fires none, and a later tap or key press
    // must still work.
    onClickCapture: e => {
      if (Date.now() - swipedAt.current > 400) return;
      swipedAt.current = 0;
      e.stopPropagation();
      e.preventDefault();
    },
  };
  return { view, showView, moved: moved.current, bandProps, reel: { view, dir, dragX } };
}

// The band's view, on a reel: switching, the one showing slides out to one
// side as the next comes in from the other, both together (stacked in one
// grid cell, so neither leaves the page's flow), held to the band's edges.
// With reduced motion, a plain fade. Only transform and opacity move, so it
// runs on the compositor (smooth on a mid-range Android phone).
const REEL_EASE = { duration: 0.42, ease: [0.22, 0.8, 0.24, 1] };
const SLIDE = {
  enter: d => ({ x: `${d * 112}%`, opacity: 0.3 }),
  center: { x: "0%", opacity: 1 },
  exit: d => ({ x: `${-d * 112}%`, opacity: 0.3 }),
};
const FADE = { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } };
// The drag moves the views inside the reel, so the reel's cut-off edges
// stay at the band's. `measureRef`: on the reel, which is as wide as the
// band and stays put as the views come and go (Forecasts' charts).
export function BandReel({ reel: { view, dir, dragX }, measureRef, children }) {
  const reduce = useReducedMotion();
  return (
    <div ref={measureRef} className="band-reel">
      <motion.div style={{ x: dragX }}>
        <AnimatePresence initial={false} custom={dir}>
          <motion.div key={view} custom={dir} variants={reduce ? FADE : SLIDE} initial="enter" animate="center" exit="exit" transition={REEL_EASE}>
            {children}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// The sheet's content for the band's view, switched behind frosted glass:
// it blurs and fades out, the next view's content takes its place, and it
// comes in out of the frost. `children(view)` draws the view's content (the
// view it's showing lags the band's by the fade out). The blur is left out
// with reduced motion and on phones reporting under 4GB of memory, where a
// blur over the sheet's height can stutter; a fade alone there.
const GLASS = typeof navigator === "undefined" || !(navigator.deviceMemory < 4);
export function SheetGlass({ view, children }) {
  const [shown, setShown] = useState(view);
  const [scope, run] = useAnimate();
  const reduce = useReducedMotion();
  const blur = GLASS && !reduce;
  const first = useRef(true);
  const fades = useRef(0); // counts each fade, so a finished one knows if another has begun
  const fadeIn = () => {
    const el = scope.current, n = ++fades.current;
    // No filter left on afterwards: even blur(0) would hold a fixed pop-out
    // inside the sheet to the sheet instead of the screen.
    run(el, blur ? { opacity: 1, filter: "blur(0px)" } : { opacity: 1 }, { duration: 0.28, ease: "easeOut" })
      .then(() => requestAnimationFrame(() => { if (n === fades.current) el.style.filter = ""; }));
  };
  useEffect(() => {
    // Back to the view still shown before its fade out finished: back in.
    if (view === shown) { if (!first.current) fadeIn(); return; }
    fades.current++;
    let live = true;
    run(scope.current, blur ? { opacity: 0, filter: "blur(6px)" } : { opacity: 0 }, { duration: 0.16, ease: "easeIn" })
      .then(() => { if (live) setShown(view); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs as the band's view changes
  }, [view]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    fadeIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs as the shown view changes
  }, [shown]);
  return <div ref={scope}>{children(shown)}</div>;
}

// The view's name, with a dot for each view at the other end (the dots'
// 44px tap height overlapping what's below), and a line for screen readers
// saying which view has come up as each switch happens. `ink`: the dot
// that's showing; `soft`: the name; `faint`: the other dots. `marks`: by
// view, { color, note } for a dot in a colour of its own while its view
// isn't showing (Progress's Tax shield in the £100k trap), the note added
// to its label.
export function BandViewCaption({ views, view, moved, onPick, ink, soft, faint, marks }) {
  return (
    <>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",marginBottom:"-12px"}}>
        <div style={{fontSize:"11px",fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:soft}}>{views[view]}</div>
        <div style={{display:"flex",marginRight:"-10px"}}>
          {views.map((label, i) => {
            const mark = marks?.[i];
            return (
              <button key={label} type="button" onClick={() => onPick(i)} aria-label={`Show ${label}${mark ? `, ${mark.note}` : ""}`} aria-pressed={i === view}
                style={{width:"28px",height:"44px",background:"none",border:0,padding:0,cursor:"pointer",display:"grid",placeItems:"center"}}>
                <span style={{width:"7px",height:"7px",borderRadius:"50%",background:i === view ? ink : mark ? mark.color : faint,transform:i === view || mark ? "scale(1.2)" : "none",transition:"background 0.2s, transform 0.2s"}}/>
              </button>
            );
          })}
        </div>
      </div>
      <div aria-live="polite" style={SR_ONLY}>{moved ? `${views[view]}, ${view + 1} of ${views.length}` : ""}</div>
    </>
  );
}

// A page title as Modules has it, large in the sans.
export const SCREEN_TITLE = { fontFamily: SANS, fontSize: "30px", fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.1, margin: "0 0 16px" };
