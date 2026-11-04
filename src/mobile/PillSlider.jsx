import { G, CDARK, MUT_ON_CDARK, WHITE, TEXT, SANS, RADIUS_PILL, FONT_SIZE, PILL_HEIGHT } from "../design-tokens.js";
import { ESTIMATE_EDGE, HAIRLINE, FILLED, EMPTY_FILL, EMPTY_TEXT, EMPTY_CLASS, OFF_FILL, OFF_EDGE, OFF_TEXT } from "./fieldState.js";

// Segmented pill control — single rounded track, equal-width options, active
// one filled solid. Used where horizontal space is tight (e.g. Forecast's
// time-horizon picker).
// `compact`: a shorter track for a control inside a tile.
// A radio group to screen readers: `label` names it, or `labelledBy` the id
// of a visible label. One Tab stop (the picked option); the arrow keys move
// and pick, as with native radio buttons.
// `state` (Edit inputs, fieldState.js): the picked option as a filled pill
// (cream, a hairline, dashed for an estimate) on a white track, the rest in
// grey, so a slider reads as quietly as the pills round it; "empty", gold
// with a sheen and the options in gold.
export function PillSlider({ value, onChange, options, compact = false, label, labelledBy, state = null }) {
  const picked = options.findIndex(o => o.value === value);
  const empty = state === "empty";
  const track = !state ? { background:CDARK } : empty ? { background:EMPTY_FILL } : { background:OFF_FILL, outline:OFF_EDGE, outlineOffset:"-1px" };
  const offText = !state ? MUT_ON_CDARK : empty ? EMPTY_TEXT : OFF_TEXT;
  const on = !state ? { background:G, color:WHITE, border:"none" }
    : { background:FILLED, color:TEXT, border:state === "estimate" ? ESTIMATE_EDGE : HAIRLINE };
  const onKey = (e, i) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = (i + step + options.length) % options.length;
    onChange(options[n].value);
    e.currentTarget.parentElement.children[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy} className={empty ? EMPTY_CLASS : undefined}
      style={{display:"flex",...track,borderRadius:RADIUS_PILL,padding:"3px",gap:"2px",height:compact ? "34px" : PILL_HEIGHT,boxSizing:"border-box"}}>
      {options.map((o, i) => (
        <button key={o.value} type="button" role="radio" aria-checked={value===o.value}
          tabIndex={i === (picked < 0 ? 0 : picked) ? 0 : -1}
          onClick={() => onChange(o.value)} onKeyDown={e => onKey(e, i)} style={{
          flex:1, borderRadius:RADIUS_PILL, boxSizing:"border-box", padding:"0 6px", height:"100%", whiteSpace:"nowrap",
          ...(value===o.value ? on : { background:"transparent", color:offText, border:"none" }),
          fontSize:compact ? "13px" : FONT_SIZE.BODY, fontWeight:600, cursor:"pointer", fontFamily:SANS, transition:"all 0.15s",
        }}>{o.label}</button>
      ))}
    </div>
  );
}
