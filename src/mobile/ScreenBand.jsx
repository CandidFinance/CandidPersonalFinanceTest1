import { useRef, useState } from "react";
import { CREAM, SANS, SR_ONLY, MODULES_BAND_BG, BAND_BG_RED, BAND_BG_AMBER, STACK_SLICK_BG } from "../design-tokens.js";

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
const CSS = `
.screen-band { --hero-fig: 52px; }
@media (max-width: 379px) { .screen-band { --hero-fig: 44px; } }
@media (min-width: 1000px) { .screen-band { --hero-fig: 72px; } }
.screen-band { margin: calc(-16px - env(safe-area-inset-top, 0px)) -20px 0; padding: calc(22px + env(safe-area-inset-top, 0px)) 20px 52px; }
.screen-band.light { background: ${MODULES_BAND_BG}; }
.screen-band.red { background: ${BAND_BG_RED}; }
.screen-band.amber { background: ${BAND_BG_AMBER}; }
.screen-band.dark { background: ${STACK_SLICK_BG}; overflow: hidden; }
.screen-sheet { position: relative; margin: -28px -20px 0; padding: 20px 20px 0; background: ${CREAM}; border-radius: 28px 28px 0 0; }
@media (min-width: 581px) {
  .screen-band { margin: 0; padding: 22px 20px; border-radius: 28px; }
  .screen-sheet { margin: 0; padding: 20px 0 0; border-radius: 0; }
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
  return <div className="screen-sheet">{children}</div>;
}

// A band with several views (Forecasts, Progress), swiped between or picked
// by the dots on its caption row. A mostly sideways drag switches the view,
// as the card stack's does (CardStack.jsx); the browser cancels the pointer
// when it takes an up or down drag as a page scroll. Touch and pen only: a
// mouse drag selects text, and the dots are there for a mouse. Not from a
// radio group, a field or a graph read by dragging (`data-scrub`), which
// take their own drags, nor while a pop-out card is open (a drag on its
// backdrop is to close it). Spread `bandProps` on the ScreenBand.
export function useBandViews(count) {
  const [view, setView] = useState(0);
  const moved = useRef(false); // nothing announced until the first switch
  const swipe = useRef(null), swipedAt = useRef(0);
  const showView = i => {
    if (i === view) return;
    moved.current = true;
    setView(i);
  };
  const bandProps = {
    style: { touchAction: "pan-y" },
    onPointerDown: e => {
      const open = e.currentTarget.querySelector("[role=dialog]");
      swipe.current = open || e.pointerType === "mouse" || e.target.closest("[role=radiogroup], input, [data-scrub]") ? null : { x: e.clientX, y: e.clientY };
    },
    onPointerUp: e => {
      if (!swipe.current) return;
      const dx = e.clientX - swipe.current.x, dy = e.clientY - swipe.current.y;
      swipe.current = null;
      if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) {
        swipedAt.current = Date.now();
        showView((view + (dx < 0 ? 1 : -1) + count) % count);
      }
    },
    onPointerCancel: () => { swipe.current = null; },
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
  return { view, showView, moved: moved.current, bandProps };
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
