import { useState } from "react";
import { fmt, fmtK } from "../../lib/format.js";
import { G, WHITE, MUT, TEXT, SERIF, PillSlider } from "../../CandidApp.jsx";
import { calcDrawdown, pensionIhtLine, DRAWDOWN_YEAR_OPTIONS, DEFAULT_DRAWDOWN_YEARS } from "../../lib/drawdown.js";
import { PERSONAL_ALLOWANCE, HIGHER_RATE_THRESHOLD, PA_TAPER_START, ADDITIONAL_RATE_THRESHOLD } from "../../lib/tax.js";

// "If you drew it over X years": what the pension would pay each year, the
// income tax on it, and what's left halfway. The years are the user's to
// choose, so it never says how long anyone will live (calcDrawdown).

const YEAR_OPTIONS = DRAWDOWN_YEAR_OPTIONS.map(y => ({ value: y, label: `${y} yrs` }));
const TAX_FREE_OPTIONS = [{ value: "phased", label: "25% of each" }, { value: "upfront", label: "All up front" }];
const BANDS = [
  { from: 0, to: PERSONAL_ALLOWANCE, rate: "0%" },
  { from: PERSONAL_ALLOWANCE, to: HIGHER_RATE_THRESHOLD, rate: "20%" },
  { from: HIGHER_RATE_THRESHOLD, to: PA_TAPER_START, rate: "40%" },
  { from: PA_TAPER_START, to: ADDITIONAL_RATE_THRESHOLD, rate: "60%" },
  { from: ADDITIONAL_RATE_THRESHOLD, to: Infinity, rate: "45%" },
];
const BAND_SHADES = ["rgba(22,47,36,0.06)", "rgba(22,47,36,0.14)", "rgba(22,47,36,0.26)", "rgba(192,57,43,0.32)", "rgba(22,47,36,0.42)"];

// £1.29m, not £1286k.
const money = n => n >= 1e6 ? `£${(n / 1e6).toFixed(2).replace(/0$/, "")}m` : fmtK(n);
const label = { fontSize:"9.5px", fontWeight:600, color:MUT, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:"6px" };
const row = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT, padding:"4px 0" };

// Where the first year's taxable income sits against the bands.
function BandBar({ taxable }) {
  const max = Math.max(150000, taxable * 1.15);
  return (
    <div style={{marginTop:"12px"}}>
      <div style={{position:"relative",display:"flex",height:"22px",borderRadius:"6px",overflow:"hidden"}}>
        {BANDS.map((b, i) => {
          const width = (Math.min(b.to, max) - b.from) / max * 100;
          return (
            <div key={b.rate + i} style={{width:`${width}%`,background:BAND_SHADES[i],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:600,color:i >= 2 ? WHITE : G}}>
              {width > 9 ? b.rate : ""}
            </div>
          );
        })}
        <div style={{position:"absolute",top:0,bottom:0,left:`calc(${Math.min(100, taxable / max * 100)}% - 1px)`,width:"2px",background:G}}/>
      </div>
      <div style={{fontSize:"11px",color:MUT,marginTop:"5px"}}>Taxable income {fmt(taxable)}, against the tax bands</div>
    </div>
  );
}

export default function MobileDrawdown({ d, m }) {
  const [years, setYears] = useState(DEFAULT_DRAWDOWN_YEARS);
  const [taxFree, setTaxFree] = useState("phased");
  const plan = calcDrawdown(d, m, { years, taxFree });
  if (!plan) return null;
  const first = plan.rows[0];
  const ages = p => p.fromAge === p.toAge ? `At ${p.fromAge}` : `Age ${p.fromAge} to ${p.toAge}`;
  // What changes between one run of years and the next.
  const why = (p, prev) => !prev ? null
    : p.statePension !== prev.statePension ? "The State Pension starts."
    : p.taxFree > 0 ? "The last of the tax-free cash."
    : "The tax-free cash is used up, so all of each withdrawal is taxed.";

  return (
    <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
      <div style={label}>Drawing it down</div>
      <div style={{fontSize:"15px",fontWeight:600,color:G,marginBottom:"12px"}}>If you drew it over {years} years</div>
      <PillSlider value={years} onChange={setYears} options={YEAR_OPTIONS}/>
      <div style={{...label,marginTop:"12px"}}>Tax-free cash</div>
      <PillSlider value={taxFree} onChange={setTaxFree} options={TAX_FREE_OPTIONS}/>

      <div style={{marginTop:"16px"}}>
        <div style={{fontFamily:SERIF,fontSize:"28px",color:G,fontWeight:700,lineHeight:1.1}}>{fmt(plan.yearly)}</div>
        <div style={{fontSize:"12.5px",color:MUT,marginTop:"3px"}}>
          a year from your pension{plan.upfront > 0 ? `, after ${fmt(plan.upfront)} taken tax-free now` : ""}
        </div>
      </div>

      {plan.phases.map((p, i) => (
        <div key={p.fromAge} style={{marginTop:"14px",paddingTop:i > 0 ? "12px" : 0,borderTop:i > 0 ? "1px solid rgba(22,47,36,0.1)" : "none"}}>
          <div style={{fontSize:"12px",fontWeight:700,color:G,marginBottom:"2px"}}>{plan.phases.length === 1 ? "Each year" : ages(p)}</div>
          {why(p, plan.phases[i - 1]) && <div style={{fontSize:"11.5px",color:MUT,marginBottom:"4px"}}>{why(p, plan.phases[i - 1])}</div>}
          <div style={row}><span>From your pension</span><span>{fmt(p.pension)}</span></div>
          {p.statePension > 0 && <div style={row}><span>State Pension</span><span>{fmt(p.statePension)}</span></div>}
          {p.other > 0 && <div style={row}><span>Other income</span><span>{fmt(p.other)}</span></div>}
          <div style={row}><span>Income tax</span><span>−{fmt(p.tax)}</span></div>
          <div style={{...row,fontWeight:700}}><span>After tax</span><span style={{fontFamily:SERIF}}>{fmt(p.afterTax)}</span></div>
          <div style={{fontSize:"11px",color:MUT}}>Top slice taxed at {p.topRate}%</div>
        </div>
      ))}

      <BandBar taxable={first.income - first.taxFree}/>

      <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.6,margin:"14px 0 0"}}>
        Over the {years} years, about {Math.round(plan.taxShare * 100)}% of what comes out of your pension goes in income tax.
      </p>
      {plan.halfway.pot > 0 && (
        <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.6,margin:"8px 0 0"}}>
          Halfway, at {plan.halfway.age}, about {money(plan.halfway.pot)} would still be in your pension. {pensionIhtLine(d)}
        </p>
      )}
      <p style={{fontSize:"11px",color:MUT,lineHeight:1.55,margin:"10px 0 0"}}>
        In today's money: growth of 6% a year, less 2% inflation, and the same amount each year. Tax at today's rates and bands.
        {!plan.state.started ? ` State Pension of ${fmt(plan.state.amount)} a year from ${plan.state.fromAge}.` : ""} An illustration, not a recommendation of how much to take.
      </p>
    </div>
  );
}
