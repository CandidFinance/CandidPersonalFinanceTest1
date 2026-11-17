// The app's one bottom sheet (Account, Premium, and in time Assist and the net
// worth row pages). It rises from the bottom, can be dragged down by its
// handle (or, on a touch screen, from anywhere while scrolled to the top) to
// close, closes on Escape or a tap on the dimmed page, keeps
// keyboard focus inside while open and hands it back after, stops the page
// behind from scrolling, and hides the Assist button.
//
// <Sheet open={open} onClose={close} labelledBy="account-title">
//   <SheetHeader id="account-title" title="Account" onClose={close} />
//   ...
// </Sheet>
//
// background: the panel's colour (CREAM by default; Premium uses WHITE).
// padding:    around the content; the safe area is added at the bottom.
//             "0" lets a header run edge to edge (Premium's blue wash).
// onEscape:   what Escape does, if not closing (Account steps back a page).
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useReducedMotion } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";
import { CREAM, SANS, TILE_KICKER, RADIUS, Z } from "../../design-tokens.js";
import useDialogFocus, { useHidesAssist } from "../useDialogFocus.js";
import { IconButton } from "./IconButton.jsx";

const BACKDROP = "rgba(10,20,15,0.45)";
// Assist's thresholds: a pull past 90px, or a flick, closes it.
const CLOSE_OFFSET = 90;
const CLOSE_VELOCITY = 600;
const SPRING = { type: "spring", damping: 34, stiffness: 340 };

// On a touch screen the whole sheet pulls down, not only its handle: when
// the content is scrolled to the top, a downward swipe anywhere moves the
// sheet instead of scrolling (which on iOS bounced the content and left the
// empty panel showing behind it). Upward swipes and swipes once scrolled
// down scroll as normal.
function usePullToClose(ref, y, onClose, off) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = ref.current;
    if (!el || off) return undefined;
    let start = null;
    let pulling = false;
    let last = null;
    const onStart = (e) => {
      start = null;
      pulling = false;
      if (e.touches.length !== 1 || e.target.closest?.("[data-sheet-handle], input, textarea, select, [contenteditable]")) return;
      // Inside an inner scroller that isn't at its top, the swipe scrolls it.
      for (let n = e.target; n && n !== el; n = n.parentElement) if (n.scrollTop > 0) return;
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, top: el.scrollTop <= 0 };
      last = { y: t.clientY, t: e.timeStamp, v: 0 };
    };
    const onMove = (e) => {
      if (!start) return;
      const t = e.touches[0];
      const dy = t.clientY - start.y;
      const dx = t.clientX - start.x;
      if (!pulling) {
        if (dy === 0 && dx === 0) return;
        // Decided on the first move, so iOS never starts its own scroll.
        if (!start.top || dy <= 0 || Math.abs(dx) > Math.abs(dy)) { start = null; return; }
        pulling = true;
      }
      e.preventDefault();
      const dt = e.timeStamp - last.t;
      if (dt > 0) last = { y: t.clientY, t: e.timeStamp, v: ((t.clientY - last.y) / dt) * 1000 };
      y.set(Math.max(0, dy));
    };
    const onEnd = (e) => {
      if (pulling) {
        // A flick counts only if the finger was still moving when it lifted.
        const v = e.timeStamp - last.t > 100 ? 0 : last.v;
        if (y.get() > CLOSE_OFFSET || v > CLOSE_VELOCITY) close.current();
        // Back up either way: if the sheet does close, its exit takes over.
        animate(y, 0, SPRING);
      }
      start = null;
      pulling = false;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [ref, y, off]);
}

// Stops the page behind scrolling while any sheet is open (counted, so two
// stacked sheets don't unlock early).
let locks = 0;
let saved = "";
function useScrollLock() {
  useEffect(() => {
    if (locks === 0) {
      saved = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) document.body.style.overflow = saved;
    };
  }, []);
}

function Panel({ onClose, onEscape, labelledBy, ariaLabel, background, padding, maxWidth, panelRef, children }) {
  const ref = useRef(null);
  // The caller can hold the panel too (Account scrolls it to the top and
  // focuses it when it changes page).
  const setRef = (n) => { ref.current = n; if (panelRef) panelRef.current = n; };
  const reduced = useReducedMotion() ?? false;
  const drag = useDragControls();
  const y = useMotionValue(0);
  usePullToClose(ref, y, onClose, reduced);
  useDialogFocus(ref, { onEscape: onEscape || onClose });
  useHidesAssist();
  useScrollLock();

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.2 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: Z.sheet, background: BACKDROP, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <motion.div
        ref={setRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : ariaLabel}
        onClick={(e) => e.stopPropagation()}
        drag={reduced ? false : "y"}
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, info) => { if (info.offset.y > CLOSE_OFFSET || info.velocity.y > CLOSE_VELOCITY) onClose(); }}
        initial={reduced ? { opacity: 0 } : { y: "100%" }}
        animate={reduced ? { opacity: 1 } : { y: 0 }}
        exit={reduced ? { opacity: 0 } : { y: "100%" }}
        transition={reduced ? { duration: 0 } : SPRING}
        style={{
          y,
          // "none", not "contain": no rubber-band bounce inside the sheet,
          // which slid the content away from its own background.
          position: "relative", width: "100%", maxWidth, maxHeight: "92vh", overflowY: "auto", overscrollBehavior: "none",
          background, borderRadius: `${RADIUS.sheet} ${RADIUS.sheet} 0 0`, outline: "none", fontFamily: SANS, boxSizing: "border-box",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* The handle: pull it down to close. The close button covers the
            same for keyboard and screen-reader users. Sticky, so it stays at
            the top while the sheet scrolls; the negative margin keeps it out
            of the layout. Only the middle 120px grabs, so the header's back
            and close buttons stay tappable. */}
        <div aria-hidden="true"
          style={{ position: "sticky", top: 0, height: "22px", marginBottom: "-22px", display: "flex", justifyContent: "center", zIndex: 1, pointerEvents: "none" }}>
          <div data-sheet-handle onPointerDown={(e) => drag.start(e)}
            style={{ width: "120px", height: "22px", display: "flex", justifyContent: "center", alignItems: "center", touchAction: "none", cursor: "grab", pointerEvents: "auto" }}>
            <span style={{ width: "36px", height: "5px", borderRadius: "3px", background: "rgba(22,47,36,0.18)" }} />
          </div>
        </div>
        <div style={{ padding }}>{children}</div>
      </motion.div>
    </motion.div>
  );
}

export function Sheet({ open, onClose, onEscape, labelledBy, ariaLabel, background = CREAM, padding = "22px 16px 24px", maxWidth = "480px", panelRef, children }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <Panel key="sheet" onClose={onClose} onEscape={onEscape} labelledBy={labelledBy} ariaLabel={ariaLabel} background={background} padding={padding} maxWidth={maxWidth} panelRef={panelRef}>
          {children}
        </Panel>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// A sheet's top line: back at the left (on an inner page), the title in the
// middle, close at the right.
export function SheetHeader({ id, title, onBack, onClose, style }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 36px", alignItems: "center", gap: "8px", ...style }}>
      {onBack ? <IconButton icon={ChevronLeft} label="Back" onClick={onBack} /> : <span />}
      <h2 id={id} style={{ ...TILE_KICKER, lineHeight: 1.25, textAlign: "center", margin: 0 }}>{title}</h2>
      {onClose ? <IconButton icon={X} label="Close" onClick={onClose} /> : <span />}
    </div>
  );
}

export default Sheet;
