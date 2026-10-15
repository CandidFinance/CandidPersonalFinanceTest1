import { G, CDARK, MUT, WHITE, SANS, RADIUS_PILL, FONT_SIZE, PILL_HEIGHT } from "../design-tokens.js";

// Segmented pill control — single rounded track, equal-width options, active
// one filled solid. Used where horizontal space is tight (e.g. Forecast's
// time-horizon picker).
// `compact`: a shorter track for a control inside a tile.
export function PillSlider({ value, onChange, options, compact = false }) {
  return (
    <div style={{display:"flex",background:CDARK,borderRadius:RADIUS_PILL,padding:"3px",gap:"2px",height:compact ? "34px" : PILL_HEIGHT,boxSizing:"border-box"}}>
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{
          flex:1, border:"none", borderRadius:RADIUS_PILL, padding:"0 6px", height:"100%", whiteSpace:"nowrap",
          background: value===o.value ? G : "transparent",
          color: value===o.value ? WHITE : MUT,
          fontSize:compact ? "13px" : FONT_SIZE.BODY, fontWeight:600, cursor:"pointer", fontFamily:SANS, transition:"all 0.15s",
        }}>{o.label}</button>
      ))}
    </div>
  );
}
