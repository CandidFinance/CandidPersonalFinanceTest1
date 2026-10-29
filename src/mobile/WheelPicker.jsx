import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { G, MUT, TEXT, WHITE, CDARK } from "../design-tokens.js";

// One answer from a list, on a wheel that turns like a tombola drum: the row
// in the middle band is the answer. Scrolled, dragged, tapped (the row moves
// to the middle) or moved with the arrow keys; the answer lands once the
// wheel stops. `items`: [{ value, label }], a value of "" meaning no answer
// yet. `value` is the stored answer (a string, "" when none); a value not
// in the list sits on the first row. Used for years (YearPicker.jsx) and
// months (the bonus month).

const ROW = 34;
// Rows in view: the answer, with half a row above and below to show it
// turns. Kept short so a wheel never fills the screen.
const VISIBLE = 2;
const PAD = ROW * ((VISIBLE - 1) / 2);
const SETTLE_MS = 120;

export default function WheelPicker({ items, value, onChange, label = "" }) {
  const current = String(value ?? "");
  const at = Math.max(0, items.findIndex(o => o.value === current));
  const listKey = items.map(o => o.value).join("|");

  const ref = useRef(null);
  const [top, setTop] = useState(at * ROW);
  const touched = useRef(false); // the user moved it, not a re-render
  const settle = useRef(null);
  const frame = useRef(null);

  // Onto the stored answer: on opening, and when it changes from outside
  // (or the list does), unless the wheel is being moved.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || touched.current) return;
    el.scrollTop = at * ROW;
    setTop(at * ROW);
  }, [at, listKey]);
  useEffect(() => () => { clearTimeout(settle.current); cancelAnimationFrame(frame.current); }, []);

  const onScroll = () => {
    const el = ref.current;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setTop(el.scrollTop));
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      if (!touched.current) return;
      touched.current = false;
      const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)));
      if (items[i].value !== current) onChange(items[i].value);
    }, SETTLE_MS);
  };
  const moveTo = i => {
    touched.current = true;
    ref.current?.scrollTo({ top: Math.min(items.length - 1, Math.max(0, i)) * ROW, behavior: "smooth" });
  };
  const onKeyDown = e => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    moveTo(Math.round(ref.current.scrollTop / ROW) + (e.key === "ArrowDown" ? 1 : -1));
  };
  const markTouched = () => { touched.current = true; };

  return (
    <div style={{position:"relative",height:ROW * VISIBLE,background:CDARK,borderRadius:"18px",overflow:"hidden"}}>
      {/* The middle band: the answer. */}
      <div aria-hidden="true" style={{position:"absolute",left:"8px",right:"8px",top:PAD,height:ROW,background:WHITE,borderRadius:"100px",boxShadow:"0 1px 4px rgba(22,47,36,0.12)"}}/>
      <div ref={ref} role="listbox" tabIndex={0} aria-label={label}
        onScroll={onScroll} onKeyDown={onKeyDown} onWheel={markTouched} onPointerDown={markTouched} onTouchStart={markTouched}
        style={{
          position:"relative", height:"100%", overflowY:"scroll", scrollSnapType:"y mandatory", scrollbarWidth:"none",
          padding:`${PAD}px 0`, boxSizing:"border-box", outline:"none", perspective:"500px",
          WebkitMaskImage:"linear-gradient(rgba(0,0,0,0.3), #000 30%, #000 70%, rgba(0,0,0,0.3))",
          maskImage:"linear-gradient(rgba(0,0,0,0.3), #000 30%, #000 70%, rgba(0,0,0,0.3))",
        }}>
        {items.map((o, i) => {
          // How far from the middle, in rows: tipped back and faded with it.
          const off = Math.max(-3, Math.min(3, (i * ROW - top) / ROW));
          const on = Math.abs(off) < 0.5;
          return (
            <div key={o.value || "blank"} role="option" aria-selected={i === at} onClick={() => moveTo(i)} style={{
              height:ROW, display:"flex", alignItems:"center", justifyContent:"center", scrollSnapAlign:"center", cursor:"pointer",
              fontSize:on ? "16px" : "14px", fontWeight:on ? 700 : 600, color:on ? (o.value ? G : TEXT) : MUT,
              transform:`rotateX(${-off * 22}deg)`, opacity:Math.max(0.25, 1 - Math.abs(off) * 0.3), userSelect:"none",
            }}>{o.label}</div>
          );
        })}
      </div>
    </div>
  );
}
