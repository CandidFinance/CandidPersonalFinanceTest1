import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { MODULE_META } from "../../lib/moduleStatus.js";
import { monthsThisYear, yearsWithCandid } from "../../lib/yearRecord.js";
import { fmt } from "../../lib/format.js";
import { taxYearShort } from "../../lib/taxYear.js";
import { G, MUT, TEXT, SERIF, SANS, PROGRESS_GREEN, MODULE_CHART_COLOR } from "../../design-tokens.js";
import { PillSlider } from "../../mobile/PillSlider.jsx";
import { DARK } from "../../mobile/CardStack.jsx";
import { useElementWidth } from "../../mobile/useElementWidth.js";
import { Tile, helpText, kicker } from "./ProgressParts.jsx";

// The year-end record on Home, below the hero (src/lib/yearRecord.js): what
// the changes made have saved in each tax year, against what was still
// open. This year: the total so far and how it's built up month by month.
// All years (once one is over): a row per tax year, each opening to its
// modules. Saved is £ that's built up; still open is a £ a year, so the two
// are never drawn as one bar. Not shown until something's been saved: until
// then it would only repeat the hero's Still left.

const MONTHS = ["A", "M", "J", "J", "A", "S", "O", "N", "D", "J", "F", "M"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TITLE = Object.fromEntries(MODULE_META.map(mm => [mm.key, mm.title]));

export default function YourYears({ d }) {
  const now = new Date();
  const years = yearsWithCandid(d, now);
  const months = monthsThisYear(d, now);
  const hasPast = years.some(y => y.closed);
  const [view, setView] = useState("year");
  const [open, setOpen] = useState(null);
  const shown = hasPast ? view : "year";
  const thisYear = years[0];
  if (!hasPast && !months.length) return null;

  return (
    <div style={{marginTop:"22px"}}>
      <Tile title="Your years with Candid">
        {hasPast && (
          <div style={{marginTop:"12px"}}>
            <PillSlider compact value={shown} onChange={setView} label="Which years"
              options={[{ value: "year", label: "This year" }, { value: "all", label: "All years" }]}/>
          </div>
        )}
        {shown === "year" ? (
          <div style={{marginTop:"12px"}}>
            {/* The total in its own tile, the timeline beside it. */}
            <div style={{display:"flex",alignItems:"stretch",gap:"12px"}}>
              {/* In the hero's oil slick (CardStack's DARK), as the figure it
                  ties to: £ so far, of the hero's £ a year. */}
              <div style={{flex:"0 0 auto",minWidth:"25%",background:DARK.bg,border:DARK.border,boxShadow:DARK.shadow,borderRadius:"12px",padding:"12px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
                <span style={{fontFamily:SERIF,fontSize:"39px",fontWeight:700,color:DARK.figure,lineHeight:1,letterSpacing:"-0.01em"}}>{fmt(thisYear.saved)}</span>
                <span style={{fontSize:"11px",color:DARK.body,lineHeight:1.35,marginTop:"6px"}}>
                  of {fmt(thisYear.savedPerYear)} a year<br/>in {taxYearShort(thisYear.year)}
                </span>
              </div>
              <MonthLine months={months}/>
            </div>
            <ModuleRows perYear saved={thisYear.savedPerYearByModule} open={thisYear.stillOpenByModule}/>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",marginTop:"8px"}}>
            {years.map(y => (
              <div key={y.year} style={{borderTop:"1px solid rgba(22,47,36,0.08)"}}>
                <button type="button" onClick={() => setOpen(o => (o === y.year ? null : y.year))} aria-expanded={open === y.year}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:"10px",background:"none",border:"none",padding:"12px 0",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                  <span style={{fontSize:"13px",fontWeight:700,color:G,minWidth:"64px"}}>{taxYearShort(y.year)}{y.closed ? "" : " so far"}</span>
                  <span style={{flex:1,display:"flex",flexDirection:"column",gap:"2px",minWidth:0}}>
                    <span style={{fontSize:"12.5px",color:TEXT}}>Saved <b style={{fontFamily:SERIF}}>{fmt(y.saved)}</b></span>
                    <span style={{fontSize:"12px",color:MUT}}>Still open{y.closed ? " at year end" : ""} {fmt(y.stillOpen)} a year{asAtNote(y)}</span>
                  </span>
                  <ChevronRight size={16} color={MUT} style={{transform:open === y.year ? "rotate(90deg)" : "none",transition:"transform .2s",flexShrink:0}}/>
                </button>
                {open === y.year && <div style={{paddingBottom:"12px"}}><ModuleRows saved={y.savedByModule} open={y.stillOpenByModule} savedLabel={`Saved in ${taxYearShort(y.year)}`}/></div>}
              </div>
            ))}
          </div>
        )}
        <p style={{...helpText,marginTop:"12px"}}>
          The £ so far counts each change you've marked as made day by day, from when you made it. This year's module figures are a £ a year, as at the top of Home. A past year's still open is as it stood at that year's end.
        </p>
      </Tile>
    </div>
  );
}

// ", as at 12 Feb" when a past year's still open was last worked out before
// its final week.
function asAtNote(y) {
  if (!y.closed || !y.asOf || y.asOf >= `${y.year + 1}-03-29`) return "";
  const [, mo, day] = y.asOf.split("-").map(Number);
  return `, as at ${day} ${SHORT_MONTHS[mo - 1]}`;
}

// This tax year's saved so far at each month end, April to March: a line
// with a soft fill under it, faint gridlines, and the months to come as a
// dashed track. Drawn at its real width (useElementWidth), so nothing
// stretches.
function MonthLine({ months }) {
  const [ref, W] = useElementWidth(240);
  const H = 84, TOP = 8, BASE = H - 16, X0 = 6;
  const max = Math.max(...months.map(x => x.total), 1);
  const slot = mo => (+mo.slice(5, 7) + 8) % 12; // April is 0
  const x = i => X0 + i * (W - 2 * X0) / 11;
  const y = v => BASE - v / max * (BASE - TOP);
  const pts = months.map(m => [x(slot(m.month)), y(m.total)]);
  const first = pts[0], last = pts[pts.length - 1];
  const line = pts.map(p => p.join(",")).join(" ");
  // This month, April being 0: where the line ends and the dashes begin.
  const nowSlot = (new Date().getMonth() + 9) % 12;
  return (
    <figure ref={ref} style={{flex:1,minWidth:0,margin:0}} aria-label={`Saved so far by month, ${months.map(m => `${SHORT_MONTHS[+m.month.slice(5, 7) - 1]} ${fmt(m.total)}`).join(", ")}`}>
      <svg width={W} height={H} style={{display:"block",overflow:"visible"}}>
        <defs>
          <linearGradient id="years-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PROGRESS_GREEN} stopOpacity="0.28"/>
            <stop offset="100%" stopColor={PROGRESS_GREEN} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[TOP, (TOP + BASE) / 2].map(gy => <line key={gy} x1={X0} x2={W - X0} y1={gy} y2={gy} stroke="rgba(22,47,36,0.06)"/>)}
        <line x1={X0} x2={x(nowSlot)} y1={BASE} y2={BASE} stroke="rgba(22,47,36,0.14)"/>
        <line x1={x(nowSlot)} x2={W - X0} y1={BASE} y2={BASE} stroke="rgba(22,47,36,0.18)" strokeDasharray="2 4"/>
        {last && <>
          <polygon points={`${first[0]},${BASE} ${line} ${last[0]},${BASE}`} fill="url(#years-fill)"/>
          <polyline points={line} fill="none" stroke={PROGRESS_GREEN} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
          <circle cx={last[0]} cy={last[1]} r="6" fill={PROGRESS_GREEN} opacity="0.18"/>
          <circle cx={last[0]} cy={last[1]} r="3.5" fill={PROGRESS_GREEN}/>
        </>}
        {MONTHS.map((l, i) => (
          <text key={i} x={x(i)} y={H - 2} textAnchor="middle" fontSize="9.5" fontFamily={SANS}
            fill={i === nowSlot ? G : MUT} fontWeight={i === nowSlot ? 700 : 400}>{l}</text>
        ))}
      </svg>
    </figure>
  );
}

// Each module with anything saved or still open: its colour, name, saved
// and still open, largest saved first. `perYear`: saved as a £ a year too,
// so this year's columns add up to Home's hero (Saved and Still left).
// Without it (a past year), saved is the £ that year came to,
// `savedLabel` naming the year.
function ModuleRows({ saved, open, perYear = false, savedLabel = "Saved" }) {
  const keys = [...new Set([...Object.keys(saved), ...Object.keys(open)])]
    .sort((a, b) => (saved[b] || 0) - (saved[a] || 0) || (open[b] || 0) - (open[a] || 0));
  if (!keys.length) return null;
  const num = { fontFamily:SERIF, fontSize:"13px", fontWeight:700, color:TEXT, textAlign:"right", minWidth:"72px" };
  const yr = <span style={{fontFamily:SANS,fontSize:"10.5px",fontWeight:600,color:MUT}}>/yr</span>;
  return (
    <div style={{marginTop:"14px",display:"flex",flexDirection:"column",gap:"8px"}}>
      <div style={{display:"flex",gap:"10px"}}>
        <span style={{...kicker,flex:1}}>By module</span>
        <span style={{...kicker,minWidth:"72px",textAlign:"right"}}>{savedLabel}</span>
        <span style={{...kicker,minWidth:"72px",textAlign:"right"}}>Still open</span>
      </div>
      {keys.map(k => (
        <div key={k} style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <span style={{flex:1,display:"flex",alignItems:"center",gap:"8px",fontSize:"12.5px",color:TEXT,minWidth:0}}>
            <span aria-hidden="true" style={{width:"8px",height:"8px",borderRadius:"50%",background:MODULE_CHART_COLOR[k] || MUT,flexShrink:0}}/>
            {TITLE[k] || k}
          </span>
          <span style={num}>{saved[k] ? <>{fmt(saved[k])}{perYear && yr}</> : "–"}</span>
          <span style={num}>{open[k] ? <>{fmt(open[k])}{yr}</> : "–"}</span>
        </div>
      ))}
    </div>
  );
}
