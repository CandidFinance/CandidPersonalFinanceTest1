import { CDARK, TEXT, MUT, SERIF } from "../CandidApp.jsx";

// The Candid score as a ring that fills to the score, with the score in the
// centre. Presentational only: Home animates `value` (the fill on first
// showing, a gain counting up) and picks `color` (the score's band from
// scoreBand, or gold while a gain is filling in). The ring is the score's one
// coloured indicator; the figure stays plain (CLAUDE.md rule 4). `onDark`
// is for a dark background: a light track and white figures. `track` sets
// the empty ring's colour (the warm CDARK by default).
export default function ScoreDonut({ value, color, size = 112, stroke = 10, onDark = false, track = CDARK }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, value)) / 100 * circumference;
  const centre = size / 2;
  return (
    <div style={{position:"relative",width:`${size}px`,height:`${size}px`,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)",display:"block"}} aria-hidden="true">
        <circle cx={centre} cy={centre} r={r} fill="none" stroke={onDark ? "rgba(255,255,255,0.14)" : track} strokeWidth={stroke}/>
        {filled > 0 && (
          <circle cx={centre} cy={centre} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`} style={{transition:"stroke 1.2s ease"}}/>
        )}
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontFamily:SERIF,fontSize:`${Math.round(size * 0.3)}px`,fontWeight:700,color:onDark ? "#ffffff" : TEXT,lineHeight:1}}>{value}</span>
        <span style={{fontSize:"11px",color:onDark ? "rgba(255,255,255,0.6)" : MUT,marginTop:"3px"}}>/100</span>
      </div>
    </div>
  );
}
