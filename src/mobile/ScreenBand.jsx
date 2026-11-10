import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useAnimate, useMotionValue, useReducedMotion } from "framer-motion";
import { CREAM, G, SANS, SR_ONLY, BAND_STOPS, slickBg } from "../design-tokens.js";

// A screen's top band and the cream sheet below it (Modules, Forecasts,
// Progress).
// The band runs to the screen's edges on a phone (out past the column's
// 20px padding and up under the top inset); where the column is narrower
// than the screen it's a rounded panel instead. On a phone the sheet
// overlaps the band's foot with rounded corners.
// `tone`: "light", the soft green-to-gold of Modules; "dark", the card
// stack's oil slick, with anything drawn past its edges cut off; "red" and
// "amber", the light band warning (Progress near the £100k trap); "green",
// the brand's dark green, flat (Progress's net worth and its row pages).
// A figure printed on the band is as big as one on a stack's card.
// On a phone the band runs on BLEED px under the sheet, for the sheet's
// pull (useSheetPull) to show; the dark band's slick keeps its shape above
// that and carries on into it.
// The light band's colours are registered properties, so a change of tone
// (Progress's Tax shield in the £100k trap) fades rather than jumps; a
// browser without @property just switches.
// The reel (BandReel) runs out to the band's edges and is cut off there.
const BLEED = 200;
// Text on the dark band, softer than its figures, and the dots not showing.
export const CREAM_SOFT = "rgba(250,247,240,0.7)";
export const CREAM_FAINT = "rgba(250,247,240,0.35)";
const tone = ([a, b, c]) => `--band-a: ${a}; --band-b: ${b}; --band-c: ${c};`;
// What fades as the sheet comes up (useBandCover): everything on the band
// but its headline, marked `data-band-keep`. Only the outermost of each
// (a child of the band, or of something holding a kept part, that holds
// none itself), so nothing fades twice over. Inside a carried part (a
// card, which moves whole), only what's marked `data-band-fade`: a part
// inside a kept one that still fades (Modules' bar and the rest of its card
// below the figure).
// The colour Safari paints the status bar with on each band (theme-color).
// In the Safari browser the page starts under the status bar, which Safari
// fills flat, so there the band's top runs into it from that flat colour
// (`flush-top`) and there's no seam under the time and battery. Where the
// page runs on under the status bar (saved to the home screen, the app),
// the band's own slick fills it, as a native app's would.
const STATUS = { dark: "#0e2219", green: G, light: BAND_STOPS.light[0], red: BAND_STOPS.red[0], amber: BAND_STOPS.amber[0] };
const TOP_BLEND = 32;
const FADES = ":is(.screen-band, .screen-band :has([data-band-keep])) > :not([data-band-keep]):not(:has([data-band-keep])):not(style):not([data-band-keep='carry'] *)";
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
.screen-band.green { ${tone(BAND_STOPS.green)} }
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
.screen-band { --cover-tint: rgba(22,47,36,0.10); --top-solid: var(--band-a); }
.screen-band.dark, .screen-band.green { --cover-tint: rgba(4,12,8,0.5); }
.screen-band.dark { --top-solid: ${STATUS.dark}; }
@media (max-width: 580px) {
  .screen-band { position: sticky; top: 0; z-index: 0; }
  .screen-band::before { content: ""; position: absolute; inset: 0; z-index: -1; background: var(--cover-tint); opacity: var(--cover, 0); pointer-events: none; }
  ${FADES}, .screen-band [data-band-fade] { opacity: calc(1 - var(--cover, 0)); }
  .screen-band.covered :is(${FADES}, [data-band-fade]) { pointer-events: none; }
  .screen-band.flush-top::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: ${TOP_BLEND}px; z-index: -1; background: linear-gradient(var(--top-solid), transparent); pointer-events: none; }
  .screen-sheet { box-shadow: 0 -12px 28px rgba(10,20,15,calc(var(--lift, 0) * 0.16)); }
  .screen-band.band-cap { position: fixed; top: 0; margin: 0; z-index: 20; pointer-events: none; }
}
`;

export function ScreenBand({ tone = "light", children, ...rest }) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta || !STATUS[tone] || !window.matchMedia("(max-width: 580px)").matches) return;
    const was = meta.content;
    meta.content = STATUS[tone];
    return () => { meta.content = was; };
  }, [tone]);
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
  useBandCover(ref);
  return <div ref={ref} className="screen-sheet">{children}</div>;
}

// On a phone, scrolling down, the band stays put (sticky) and the sheet
// comes up over it, as a sheet over the page (the Account and Premium
// sheets): the band's background darkens a little and all but its headline
// fades. The headline moves up with it to the same place on every screen:
// its title (`data-band-keep="title"`: Left on the table, a view's name, a
// row page's back link) at half the band's top padding, its figure
// (`data-band-keep="figure"`) shrinking to half the band's figure size,
// just under the title (the same size on every screen, so a smaller figure,
// net worth's, shrinks less). Both
// lock there as the sheet arrives under the figure, leaving about a tenth
// of the screen above it, and the sheet's content then scrolls on beneath
// a rounded edge there (the cap, below). `data-band-keep="carry"`: a
// part that holds the title and moves with it (Modules' card). With no
// title it runs to the top of the screen. Follows the scroll, so it's the
// same with reduced motion.
// The sheet's locked edge is the cap: a live copy of the band (cloned, hidden
// from screen readers, every change on the band copied across as it
// happens), fixed over the top of the screen, cut to the line with the
// sheet's rounded corners cut out of its foot. Before the sheet arrives it
// looks just as the band beneath it, so it can't be seen; once it has, the
// sheet's content scrolls on beneath it. As it's always there, the edge
// holds however fast the page is flicked: on an iPhone, Safari scrolls a
// flick ahead of the page's code by several frames, and anything set from
// the scroll (a cut-off, or the cap shown on arrival) fell behind it, the
// sheet running on over the headline or to the top of the screen. Hidden at
// the top of the page (nothing to hold there), so a swipe of the band's
// views shows as it is. Taps go through it to the band until the sheet's
// arrived; then it takes them (the sheet's content beneath is hidden), a
// back link on it passing a tap to the real one.
const BAND_PAD = 22; // the band's top padding, under the top inset
const TITLE_LINE = 14; // a title's line (11px caps); a taller title, a back link's 44px tap area, centres on it
const FIGURE_GAP = 2; // the title's foot to the figure, locked
const FIGURE_SCALE = 0.5; // the locked figure, against the band's figure size
const DOCK_GAP = 10; // the figure's foot to the sheet's edge, locked
const SHEET_RADIUS = 28; // the sheet's top corners (.screen-sheet)
const TAPPABLE = "[data-band-keep]:is(button, a), [data-band-keep] :is(button, a)";
// Every element and text under `root`, in order (a clone's match its original's).
const walk = root => {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const all = [root];
  while (w.nextNode()) all.push(w.currentNode);
  return all;
};
function useBandCover(ref) {
  useEffect(() => {
    const sheet = ref.current;
    const page = sheet?.parentElement;
    const band = page?.querySelector(".screen-band");
    if (!band) return;
    const phone = window.matchMedia("(max-width: 580px)");
    let frame = 0, dirty = true, stale = true, laid = null, cap = null, shield = null, capStyle = null, twin = new Map(), tapCopies = new Set(), touching = false;
    // Not until the page has come in (MobileLayout's PageEnter slides and
    // fades it; the cap, out on the page, would stand still over it).
    let ready = false;
    // The band's classes but those set here: a change of tone measures again.
    const toneOf = () => [...band.classList].filter(c => c !== "covered" && c !== "flush-top").join(" ");
    let tone = toneOf();
    const moving = () => [...band.querySelectorAll('[data-band-keep="carry"], [data-band-keep="title"], [data-band-keep="figure"]')];
    // Where each part sits unmoved (the band's pinned, so that's fixed on
    // screen), and where it locks.
    const measure = () => {
      const els = moving();
      els.forEach(el => { el.style.transform = ""; });
      const at = new Map(els.map(el => [el, el.getBoundingClientRect()]));
      const titles = els.filter(el => el.dataset.bandKeep === "title" && at.get(el).height);
      const figures = els.filter(el => el.dataset.bandKeep === "figure" && at.get(el).height);
      const inset = parseFloat(getComputedStyle(band).paddingTop) - BAND_PAD;
      band.classList.toggle("flush-top", inset < 1);
      const titleTo = inset + BAND_PAD / 2;
      const figureTo = titleTo + (titles.length ? TITLE_LINE : 0) + FIGURE_GAP;
      const fig = parseFloat(getComputedStyle(band).getPropertyValue("--hero-fig")) || 52;
      // Each figure's height locked: half the band's figure (its line, 1.05).
      const lockedH = fig * 1.05 * FIGURE_SCALE;
      const scale = new Map(figures.map(el => [el, Math.min(1, lockedH / at.get(el).height)]));
      const shift = new Map();
      for (const el of titles) shift.set(el, titleTo - (at.get(el).height - TITLE_LINE) / 2 - at.get(el).top);
      for (const el of figures) shift.set(el, figureTo - at.get(el).top);
      // A carrier moves as the title inside it.
      for (const el of els.filter(e => e.dataset.bandKeep === "carry")) {
        const t = titles.find(x => el.contains(x));
        shift.set(el, t ? shift.get(t) : 0);
      }
      // Each part's own move, less what the part holding it already moves.
      const own = els.map(el => {
        const holder = els.find(x => x !== el && x.contains(el));
        return [el, (shift.get(el) ?? 0) - (holder ? shift.get(holder) ?? 0 : 0), scale.get(el) ?? 1];
      });
      // No figure on the view (Progress's Goals): the sheet stops under the title.
      const foot = figures.length ? figureTo + lockedH : titleTo + TITLE_LINE;
      laid = { own, line: titles.length ? foot + DOCK_GAP : 0 };
      dirty = false;
      stale = true;
    };
    // The band's copy, over everything but pop-outs, cut to the line. Each
    // part of the band paired with its copy (`twin`), to copy changes across.
    const makeCap = () => {
      cap?.remove();
      shield?.remove();
      cap = shield = null;
      twin = new Map();
      tapCopies = new Set();
      stale = false;
      if (!laid.line) return;
      const r = band.getBoundingClientRect();
      cap = band.cloneNode(true);
      const mine = walk(band), copy = walk(cap);
      mine.forEach((n, i) => twin.set(n, copy[i]));
      // A back link on it: a tap on the copy is a tap on the real one.
      band.querySelectorAll(TAPPABLE).forEach(el => {
        const c = twin.get(el);
        if (!c) return;
        tapCopies.add(c);
        c.style.pointerEvents = "auto";
        c.addEventListener("click", e => { e.preventDefault(); el.click(); });
      });
      cap.classList.add("band-cap");
      cap.setAttribute("aria-hidden", "true");
      cap.querySelectorAll("[id]").forEach(el => el.removeAttribute("id"));
      cap.querySelectorAll("button, a, input, [tabindex]").forEach(el => el.setAttribute("tabindex", "-1"));
      cap.querySelectorAll("[role=dialog], [role=listbox], [role=menu]").forEach(el => el.remove());
      // Down to the line, and the two corners beside the sheet's rounded top.
      const L = laid.line, R = SHEET_RADIUS;
      const mask = [
        `linear-gradient(#000, #000) 0 0 / 100% ${L}px no-repeat`,
        `radial-gradient(circle at 100% 100%, transparent ${R - 0.5}px, #000 ${R}px) 0 ${L}px / ${R}px ${R}px no-repeat`,
        `radial-gradient(circle at 0 100%, transparent ${R - 0.5}px, #000 ${R}px) 100% ${L}px / ${R}px ${R}px no-repeat`,
      ].join(", ");
      capStyle = { left: `${r.left}px`, width: `${r.width}px`, height: `${band.offsetHeight}px`, boxSizing: "border-box", mask, webkitMask: mask };
      Object.assign(cap.style, capStyle);
      // Over the line only, once the sheet's arrived: takes the taps there,
      // meant for the sheet's content now hidden beneath (the cap itself is
      // the band's full height, its cut only drawn, so it lets taps through).
      shield = document.createElement("div");
      Object.assign(shield.style, { position: "fixed", top: "0", left: capStyle.left, width: capStyle.width, height: `${L}px`, zIndex: "19", pointerEvents: "none" });
      // Out on the page, clear of the screens' own moves (MobileLayout's
      // PageEnter), which would carry a fixed part with them.
      document.body.append(shield, cap);
    };
    // A change on the band, copied to its twin on the cap.
    const mirror = list => {
      if (!cap) return;
      for (const m of list) {
        const t = m.target;
        if (t === band) {
          if (m.attributeName === "class") cap.className = `${band.className} band-cap`;
          else if (m.attributeName === "style") {
            // The band's own inline style, keeping the cap's place and cut.
            const { visibility } = cap.style;
            cap.style.cssText = band.style.cssText;
            Object.assign(cap.style, capStyle, { visibility });
          }
          continue;
        }
        const c = twin.get(t);
        if (!c) continue;
        if (m.type === "characterData") c.data = t.data;
        // Not what's set on the copy alone: no ids, out of the tab order.
        else if (m.type === "attributes" && !["id", "tabindex", "role"].includes(m.attributeName)) {
          const v = t.getAttribute(m.attributeName);
          if (v == null) c.removeAttribute(m.attributeName); else c.setAttribute(m.attributeName, v);
          if (m.attributeName === "style" && tapCopies.has(c)) c.style.pointerEvents = "auto";
        }
      }
    };
    const reset = () => {
      band.style.removeProperty("--cover");
      band.classList.remove("covered");
      moving().forEach(el => { el.style.transform = ""; el.style.transformOrigin = ""; });
      sheet.style.removeProperty("--lift");
      sheet.style.minHeight = "";
      band.classList.remove("flush-top");
      cap?.remove();
      shield?.remove();
      cap = shield = null;
      dirty = true;
    };
    const update = () => {
      frame = 0;
      if (!phone.matches) return reset();
      if (dirty) measure();
      if (stale) makeCap();
      const { own, line } = laid;
      const top = sheet.getBoundingClientRect().top;
      // Tall enough to come all the way up, however little is on it. Of the
      // screen at its tallest (lvh), so Safari's bar shrinking as the page
      // scrolls doesn't change it.
      sheet.style.minHeight = `max(${28 + BLEED}px, calc(100lvh - ${Math.ceil(line)}px))`;
      const travel = top + window.scrollY - line;
      const p = travel > 0 ? Math.min(1, Math.max(0, window.scrollY / travel)) : 0;
      band.style.setProperty("--cover", p.toFixed(3));
      band.classList.toggle("covered", p > 0.6);
      sheet.style.setProperty("--lift", p.toFixed(3));
      for (const [el, dy, k] of own) {
        el.style.transformOrigin = "0 0";
        el.style.transform = p && (dy || k !== 1) ? `translate3d(0, ${(dy * p).toFixed(1)}px, 0) scale(${(1 - (1 - k) * p).toFixed(4)})` : "";
      }
      if (cap) {
        // Not over an open list on the band (the range picker), which the
        // copy leaves out.
        const shown = ready && (window.scrollY > 0 || touching) && !band.querySelector('[aria-expanded="true"]');
        cap.style.visibility = shown ? "visible" : "hidden";
        shield.style.pointerEvents = shown && p >= 1 ? "auto" : "none";
      }
    };
    const soon = () => { if (!frame) frame = requestAnimationFrame(update); };
    const again = () => { dirty = true; soon(); };
    update();
    // Once the page has settled in (MobileLayout's PageEnter, 0.3s).
    const settled = setTimeout(() => { ready = true; again(); }, 320);
    // And once the serif's loaded, which changes the figure's size.
    let live = true;
    document.fonts?.ready.then(() => { if (live) again(); });
    window.addEventListener("scroll", soon, { passive: true });
    // A touch may be a flick from the top: the cap's there first.
    const onTouch = e => { touching = e.type === "touchstart"; soon(); };
    for (const el of [sheet, band]) {
      el.addEventListener("touchstart", onTouch, { passive: true });
      el.addEventListener("touchend", onTouch, { passive: true });
      el.addEventListener("touchcancel", onTouch, { passive: true });
    }
    window.addEventListener("resize", again);
    phone.addEventListener("change", again);
    // Parts coming or going on the band (its view switching) or its tone
    // changing: measure and copy it again. Anything else (a figure counting
    // up, a part moving or fading): copied straight across.
    const watch = new MutationObserver(list => {
      if (list.some(m => m.type === "childList")) return again();
      if (list.some(m => m.target === band && m.attributeName === "class") && toneOf() !== tone) { tone = toneOf(); again(); }
      mirror(list);
    });
    watch.observe(band, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      clearTimeout(settled);
      window.removeEventListener("scroll", soon);
      for (const el of [sheet, band]) {
        el.removeEventListener("touchstart", onTouch);
        el.removeEventListener("touchend", onTouch);
        el.removeEventListener("touchcancel", onTouch);
      }
      window.removeEventListener("resize", again);
      phone.removeEventListener("change", again);
      watch.disconnect();
      reset();
    };
  }, [ref]);
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
      if (document.querySelector("[role=dialog]")) return;
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
      // Anywhere: Forecasts' "Each month" is out on the page (a portal).
      const open = document.querySelector("[role=dialog]");
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
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",margin:"-12px 0"}}>
        <div data-band-keep="title" style={{fontSize:"11px",fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:soft}}>{views[view]}</div>
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
