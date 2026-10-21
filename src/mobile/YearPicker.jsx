import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { G, MUT, TEXT, WHITE, CDARK } from "../design-tokens.js";

// A year from a known range ({ min, max }, e.g. studentLoan.js
// slFinishYearRange), on a wheel that turns like a tombola drum: newest year
// at the top, the one in the middle band is the answer. Scrolled, dragged,
// tapped (a year moves to the middle) or moved with the arrow keys; the
// answer lands once the wheel stops. `blankLabel`: a first row meaning no
// answer ("" — "Not sure"), or null for none. `value` is the stored answer
// (a string, or ""); `onChange` gets a string, or "".
export const yearInRange = (v, { min, max }) => v !== "" && v != null && Number.isInteger(+v) && +v >= min && +v <= max;

const ROW = 44;
const VISIBLE = 5; // odd, so one row sits in the middle
const PAD = ROW * ((VISIBLE - 1) / 2);
const SETTLE_MS = 120;

export default function YearPicker({ value, onChange, range, label = "", blankLabel = "Not sure" }) {
  const { min, max } = range;
  const items = [
    ...(blankLabel ? [{ value: "", label: blankLabel }] : []),
    ...Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => ({ value: String(max - i), label: String(max - i) })),
  ];
  const at = Math.max(0, items.findIndex(o => o.value === (yearInRange(value, range) ? String(+value) : "")));

  const ref = useRef(null);
  const [top, setTop] = useState(at * ROW);
  const touched = useRef(false); // the user moved it, not a re-render
  const settle = useRef(null);
  const frame = useRef(null);

  // Onto the stored answer: on opening, and when it changes from outside
  // (or the range does), unless the wheel is being moved.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || touched.current) return;
    el.scrollTop = at * ROW;
    setTop(at * ROW);
  }, [at, min, max]);
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
      if (items[i].value !== (yearInRange(value, range) ? String(+value) : "")) onChange(items[i].value);
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
      <div ref={ref} role="listbox" tabIndex={0} aria-label={label || "Year"}
        onScroll={onScroll} onKeyDown={onKeyDown} onWheel={markTouched} onPointerDown={markTouched} onTouchStart={markTouched}
        style={{
          position:"relative", height:"100%", overflowY:"scroll", scrollSnapType:"y mandatory", scrollbarWidth:"none",
          padding:`${PAD}px 0`, boxSizing:"border-box", outline:"none", perspective:"500px",
          WebkitMaskImage:"linear-gradient(transparent, #000 32%, #000 68%, transparent)",
          maskImage:"linear-gradient(transparent, #000 32%, #000 68%, transparent)",
        }}>
        {items.map((o, i) => {
          // How far from the middle, in rows: tipped back and faded with it.
          const off = Math.max(-3, Math.min(3, (i * ROW - top) / ROW));
          const on = Math.abs(off) < 0.5;
          return (
            <div key={o.value || "blank"} role="option" aria-selected={i === at} onClick={() => moveTo(i)} style={{
              height:ROW, display:"flex", alignItems:"center", justifyContent:"center", scrollSnapAlign:"center", cursor:"pointer",
              fontSize:on ? "17px" : "15px", fontWeight:on ? 700 : 600, color:on ? (o.value ? G : TEXT) : MUT,
              transform:`rotateX(${-off * 22}deg)`, opacity:Math.max(0.25, 1 - Math.abs(off) * 0.3), userSelect:"none",
            }}>{o.label}</div>
          );
        })}
      </div>
    </div>
  );
}
