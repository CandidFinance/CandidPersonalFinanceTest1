import { useState } from "react";
import { fmt } from "../../lib/format.js";
import { G, WHITE, MUT, TEXT, SERIF, SANS, CDARK, RADIUS_PILL, PILL_HEIGHT, FONT_SIZE, PillSlider } from "../../CandidApp.jsx";
import { calcDrawdown, bestDrawdown, defaultDrawdownYears, drawdownYearOptions, phaseChange, pensionIhtLine } from "../../lib/drawdown.js";
import { GROWTH_REAL_PCT } from "../../lib/growth.js";
import { MONEY_PURCHASE_ANNUAL_ALLOWANCE } from "../../lib/pension.js";

// The drawdown strategy: drawn to 87 by default, the tax-free cash taken
// whichever way leaves more after tax (bestDrawdown), then the user's own
// choice. Four headline figures, the two choices, a table of what each
// period looks like, and everything else behind "Assumptions". Never says
// how long anyone will live.

// The two ways of taking tax-free cash, by their industry names, each with
// a short explainer.
const TAX_FREE_OPTIONS = [
  { value: "phased", label: "With each withdrawal", term: "UFPLS",
    explain: "Uncrystallised Funds Pension Lump Sum: each withdrawal is 25% tax-free and 75% taxed as income, and the rest stays invested. The first one limits payments in with tax relief to £10,000 a year." },
  { value: "upfront", label: "All in Year 1", term: "PCLS",
    explain: "Pension Commencement Lump Sum: up to 25% tax-free in one go, to the limit, with the rest moved into drawdown and taxed as income when it's taken. The lump sum alone doesn't limit payments in; income taken later does." },
];

// £132.6k, £1.05m, £850.
export const compact = n => {
  const a = Math.abs(n), sign = n < 0 ? "−" : "";
  if (a >= 1e6) return `${sign}£${(a / 1e6).toFixed(2).replace(/\.?0+$/, "")}m`;
  if (a >= 1000) return `${sign}£${(a / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${sign}£${Math.round(a)}`;
};
const pct = r => `${Math.round(r * 100)}%`;
const label = { fontSize:"9.5px", fontWeight:600, color:MUT, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:"6px" };
const strategyLine = (toAge, t) => `Drawdown to ${toAge}, ${t === "phased" ? "25% tax-free each withdrawal" : "lump sum in Year 1"}`;

// The grey "?" beside a toggle option. A span, since it sits inside the
// option's button.
function OptionHelp({ onClick, open, label }) {
  const act = e => { e.stopPropagation(); onClick(); };
  return (
    <span role="button" tabIndex={0} aria-label={label} aria-expanded={open} onClick={act}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(e); } }}
      style={{display:"inline-block",background:MUT,color:WHITE,borderRadius:"50%",width:"15px",height:"15px",fontSize:"10px",fontWeight:700,lineHeight:"15px",textAlign:"center",marginLeft:"6px",flexShrink:0,cursor:"pointer"}}>?</span>
  );
}

export function Pill({ value, caption, info }) {
  return (
    <div style={{background:"rgba(22,47,36,0.05)",borderRadius:"12px",padding:"10px 12px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
        <div style={{fontFamily:SERIF,fontSize:"20px",color:G,fontWeight:700,lineHeight:1.1}}>{value}</div>
        {info}
      </div>
      <div style={{fontSize:"11.5px",color:MUT,marginTop:"3px"}}>{caption}</div>
    </div>
  );
}

// `bare`: inside a tile (the pension screen's "Plan drawing your pension"),
// so without a card of its own.
export default function MobileDrawdown({ d, m, bare = false }) {
  const [years, setYears] = useState(() => defaultDrawdownYears(d));
  // Null until the user picks: then whichever leaves more for the years.
  const [chosenTaxFree, setChosenTaxFree] = useState(null);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [explainer, setExplainer] = useState(null);
  const best = bestDrawdown(d, m, years);
  if (!best) return null;
  const taxFree = chosenTaxFree ?? best.plan.taxFree;
  const plan = calcDrawdown(d, m, { years, taxFree });
  const isBest = taxFree === best.plan.taxFree;
  const ages = p => p.fromAge === p.toAge ? `${p.fromAge}` : `${p.fromAge}–${p.toAge}`;
  const phases = plan.phases;
  const cols = `minmax(78px, 1.2fr) repeat(${phases.length}, 1fr)`;
  const tableRows = [
    { name: "Pension", get: p => p.pension },
    { name: "Tax-free", get: p => p.taxFree, muted: true, hide: phases.every(p => !p.taxFree) },
    { name: "State Pen.", get: p => p.statePension, hide: phases.every(p => !p.statePension) },
    { name: "Other", get: p => p.other, hide: phases.every(p => !p.other) },
    { name: "Income tax", get: p => -p.tax },
    { name: "After tax", get: p => p.afterTax, bold: true },
  ].filter(r => !r.hide);

  return (
    <div style={bare ? {marginTop:"14px"} : {background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
      <div style={label}>Drawdown strategy</div>
      <div style={{fontSize:"15px",fontWeight:600,color:G,lineHeight:1.4}}>{strategyLine(plan.toAge, taxFree)}</div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginTop:"12px"}}>
        <Pill value={`${compact(plan.firstYear.afterTax)} p.a.`} caption="post-tax"/>
        <Pill value={`${compact(plan.firstYear.tax)} p.a.`} caption="income-tax"/>
        <Pill value={compact(plan.totalTax)} caption="total income tax"/>
        <Pill value={pct(plan.effectiveRate)} caption="effective tax rate"/>
      </div>
      {/* One line of insight: the lump sum, and how the other way compares. */}
      {(plan.upfront > 0 || best.saving > 0) && (
        <div style={{fontSize:"12px",color:TEXT,marginTop:"8px",lineHeight:1.5}}>
          {[
            plan.upfront > 0 && `Plus a ${compact(plan.upfront)} tax-free lump sum in Year 1`,
            best.saving > 0 && (isBest
              ? `${compact(best.saving)} more after tax than ${taxFree === "phased" ? "all in Year 1" : "with each withdrawal"}`
              : `${best.plan.taxFree === "phased" ? "With each withdrawal" : "All in Year 1"} would leave ${compact(best.saving)} more after tax`),
          ].filter(Boolean).join(" · ")}
        </div>
      )}

      <div style={{...label,marginTop:"16px"}}>Drawdown years</div>
      <PillSlider value={years} onChange={setYears} options={drawdownYearOptions(d).map(y => ({ value: y, label: `${y}` }))}/>
      <div style={{...label,marginTop:"12px"}}>Tax-free cash</div>
      <div style={{display:"flex",background:CDARK,borderRadius:RADIUS_PILL,padding:"3px",gap:"2px",height:PILL_HEIGHT,boxSizing:"border-box"}}>
        {TAX_FREE_OPTIONS.map(o => (
          <button key={o.value} type="button" onClick={() => setChosenTaxFree(o.value)} style={{
            flex:1, display:"flex", alignItems:"center", justifyContent:"center", border:"none", borderRadius:RADIUS_PILL, padding:"0 6px", height:"100%", whiteSpace:"nowrap",
            background: taxFree === o.value ? G : "transparent", color: taxFree === o.value ? WHITE : MUT,
            fontSize:FONT_SIZE.BODY, fontWeight:600, cursor:"pointer", fontFamily:SANS, transition:"all 0.15s",
          }}>
            {o.label}
            <OptionHelp label={`What's ${o.term}?`} open={explainer === o.value} onClick={() => setExplainer(e => e === o.value ? null : o.value)}/>
          </button>
        ))}
      </div>
      {explainer && (
        <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"10px 12px",marginTop:"4px",fontSize:"11.5px",color:TEXT,lineHeight:1.55}}>
          {TAX_FREE_OPTIONS.find(o => o.value === explainer).explain}
        </div>
      )}

      <div style={{...label,marginTop:"16px"}}>Year by year, by age</div>
      <div style={{fontSize:"11.5px",color:TEXT}}>
        <div style={{display:"grid",gridTemplateColumns:cols,gap:"6px",paddingBottom:"5px",borderBottom:"1px solid rgba(22,47,36,0.12)"}}>
          <span/>
          {phases.map((p, i) => (
            <span key={p.fromAge} style={{textAlign:"right"}}>
              <span style={{display:"block",fontWeight:700,color:G}}>{ages(p)}</span>
              <span style={{display:"block",fontSize:"10px",color:MUT,lineHeight:1.25}}>{phaseChange(p, phases[i - 1] || null)}</span>
            </span>
          ))}
        </div>
        {tableRows.map(r => (
          <div key={r.name} style={{display:"grid",gridTemplateColumns:cols,gap:"6px",padding:"5px 0",borderBottom:"1px solid rgba(22,47,36,0.06)",fontWeight:r.bold ? 700 : 400,color:r.muted ? MUT : r.bold ? G : TEXT}}>
            <span>{r.name}</span>
            {phases.map(p => <span key={p.fromAge} style={{textAlign:"right",fontFamily:r.bold ? SERIF : undefined}}>{r.get(p) ? compact(r.get(p)) : "–"}</span>)}
          </div>
        ))}
        <div style={{display:"grid",gridTemplateColumns:cols,gap:"6px",padding:"5px 0",color:MUT,fontSize:"11px"}}>
          <span>Top rate</span>
          {phases.map(p => <span key={p.fromAge} style={{textAlign:"right"}}>{p.topRate}%</span>)}
        </div>
      </div>

      <button type="button" onClick={() => setShowAssumptions(o => !o)} aria-expanded={showAssumptions}
        style={{marginTop:"12px",background:"none",border:"1.3px solid rgba(22,47,36,0.2)",borderRadius:"100px",padding:"6px 14px",fontSize:"12px",fontWeight:600,color:G,cursor:"pointer",fontFamily:"inherit"}}>
        {showAssumptions ? "Hide assumptions" : "Assumptions"}
      </button>
      {showAssumptions && (
        <ul style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"12px 14px 12px 28px",margin:"8px 0 0",fontSize:"11.5px",color:TEXT,lineHeight:1.55}}>
          <li>In today's money: your pension grows {GROWTH_REAL_PCT}% a year more than prices. Tax uses today's rates and bands.</li>
          <li>{compact(plan.yearly)} a year comes out before tax, more than {compact(plan.simpleYearly)} (the pot divided by {years}), because what's left keeps growing.</li>
          <li>The State Pension{plan.state.started ? "" : ` (${fmt(plan.state.amount)} a year from ${plan.state.fromAge})`} is assumed to keep pace with prices. That isn't guaranteed, and the age it starts may rise.</li>
          <li>The two ways of taking tax-free cash are compared as if cash taken at the start stayed invested at the same growth and was spent evenly.</li>
          {plan.stillWorking && <li>Your pay is counted until you stop work at {plan.stopAge}. Once you take any taxable income from a pension, payments in with tax relief are limited to {fmt(MONEY_PURCHASE_ANNUAL_ALLOWANCE)} a year.</li>}
          {plan.halfway.pot > 0 && <li>Halfway, at {plan.halfway.age}, about {compact(plan.halfway.pot)} would still be in your pension. {pensionIhtLine(d)}</li>}
          <li>An illustration, not a recommendation of how much to take.</li>
        </ul>
      )}
    </div>
  );
}
