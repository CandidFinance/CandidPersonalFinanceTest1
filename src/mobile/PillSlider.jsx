import { G, CDARK, MUT_ON_CDARK, WHITE, SANS, RADIUS_PILL, FONT_SIZE, PILL_HEIGHT } from "../design-tokens.js";

// Segmented pill control — single rounded track, equal-width options, active
// one filled solid. Used where horizontal space is tight (e.g. Forecast's
// time-horizon picker).
// `compact`: a shorter track for a control inside a tile.
// A radio group to screen readers: `label` names it, or `labelledBy` the id
// of a visible label. One Tab stop (the picked option); the arrow keys move
// and pick, as with native radio buttons.
export function PillSlider({ value, onChange, options, compact = false, label, labelledBy }) {
  const picked = options.findIndex(o => o.value === value);
  const onKey = (e, i) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = (i + step + options.length) % options.length;
    onChange(options[n].value);
    e.currentTarget.parentElement.children[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy}
      style={{display:"flex",background:CDARK,borderRadius:RADIUS_PILL,padding:"3px",gap:"2px",height:compact ? "34px" : PILL_HEIGHT,boxSizing:"border-box"}}>
      {options.map((o, i) => (
        <button key={o.value} type="button" role="radio" aria-checked={value===o.value}
          tabIndex={i === (picked < 0 ? 0 : picked) ? 0 : -1}
          onClick={() => onChange(o.value)} onKeyDown={e => onKey(e, i)} style={{
          flex:1, border:"none", borderRadius:RADIUS_PILL, padding:"0 6px", height:"100%", whiteSpace:"nowrap",
          background: value===o.value ? G : "transparent",
          color: value===o.value ? WHITE : MUT_ON_CDARK,
          fontSize:compact ? "13px" : FONT_SIZE.BODY, fontWeight:600, cursor:"pointer", fontFamily:SANS, transition:"all 0.15s",
        }}>{o.label}</button>
      ))}
    </div>
  );
}
