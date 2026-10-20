import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useElementWidth } from "../useElementWidth.js";
import { fmt } from "../../lib/format.js";
import { taxTrap, trapInView, rateCurve, lostTo, TRAP_START, TRAP_END } from "../../lib/taxTrap.js";
import { PERSONAL_ALLOWANCE } from "../../lib/tax.js";
import { kidsSituation, TFC_CAP_PER_CHILD, FUNDED_HOURS_VALUE } from "../../lib/childcare.js";
import { G, MUT, TEXT, SERIF, WHITE, CRITICAL, OPPORTUNITY_TILE_BG, OPPORTUNITY_TILE_BORDER, OPPORTUNITY_TILE_SHADOW, OPPORTUNITY_TILE_LABEL, OPPORTUNITY_TILE_FIGURE, OPPORTUNITY_TILE_BODY } from "../../design-tokens.js";

// £100k tax trap (taxTrap.js), in the order the answer runs:
//  1. What the trap costs them a year: the tax on the allowance lost and
//     the childcare their income stops. Money, so it's the module's £ on
//     Home too. Under £100k: how far, and what £1 over would do.
//  2. Why: their marginal tax rate, and a chart of it at every income from
//     £0, the trap in red.
//  3. What it costs them, a row each (the topic, a line, the £; more behind
//     the arrow), adding up to the figure at the top. Childcare is shown
//     without children too, greyed.
//  4. How to get back to £100k: each way, what it takes, and its outcome in
//     £ a year. Listed by what each leaves in their bank, not a
//     recommendation.
const K = "£100k";
const pct = r => `${Math.round(r * 1000) / 10}%`;
const pence = r => `${Math.round(r * 1000) / 10}p`;
const signed = n => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`;
const tile = { background:WHITE, borderRadius:"16px", boxShadow:"0 2px 10px rgba(22,47,36,0.06)", padding:"16px 18px", marginBottom:"16px" };
const kicker = { fontSize:"10.5px", fontWeight:700, color:MUT, letterSpacing:"0.09em", textTransform:"uppercase" };
const tileTitle = { fontSize:"15px", fontWeight:700, color:TEXT };

export default function MobileTaxTrapDeepDive({ d, m }) {
  const [chartRef, chartWidth] = useElementWidth(300);
  const t = taxTrap(d, m);
  if (!t || !trapInView(d, m.adjustedNetIncome)) {
    return (
      <p style={{fontSize:"13.5px",color:TEXT,lineHeight:1.6}}>
        {t ? `Your income is ${fmt(t.ani)}, not near ${K}, so nothing here applies yet.` : "This works from your salary, which isn't in yet."} Within {fmt(10000)} of it, or heading over it in the next few years, this module works out what it would cost you.
      </p>
    );
  }
  const shown = t.over ? t.rate.rate : t.trapRate;
  const support = t.nation === "england" || !t.nation ? "Tax-Free Childcare and funded hours" : "Tax-Free Childcare";

  return (
    <div>
      {/* 1. The answer. */}
      <div style={{background:OPPORTUNITY_TILE_BG,border:OPPORTUNITY_TILE_BORDER,boxShadow:OPPORTUNITY_TILE_SHADOW,borderRadius:"14px",padding:"16px 18px",marginBottom:"20px"}}>
        <div style={{fontSize:"10px",fontWeight:800,color:OPPORTUNITY_TILE_LABEL,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>{t.over ? `What the ${K} trap costs you` : `You're under ${K}`}</div>
        <div style={{fontFamily:SERIF,fontSize:"32px",color:OPPORTUNITY_TILE_FIGURE,fontWeight:700,lineHeight:1.1}}>
          {t.over ? fmt(t.amount) : fmt(t.headroom)}<span style={{fontSize:"18px"}}>{t.over ? " a year" : " to spare"}</span>
        </div>
        <div style={{fontSize:"12.5px",color:OPPORTUNITY_TILE_BODY,lineHeight:1.5,marginTop:"6px"}}>
          {t.over
            ? `${fmt(t.allowance.tax)} of extra tax${t.childcareLost > 0 ? ` and ${fmt(t.childcareLost)} of ${support}` : " on the tax-free allowance you've lost"}.`
            : `£1 over and your marginal tax rate jumps to ${pct(t.trapRate)}${t.childcareAtRisk > 0 ? `, and ${fmt(t.childcareAtRisk)} of ${support} stops` : ""}.`}
        </div>
      </div>

      {/* 2. Why. */}
      <section style={{marginBottom:"14px"}}>
        <div style={kicker}>Why: your marginal tax rate{t.over ? "" : ` past ${K}`}</div>
        <div style={{fontFamily:SERIF,fontSize:"40px",color:G,fontWeight:700,lineHeight:1.1,marginTop:"4px"}}>{pct(shown)}</div>
        <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"4px 0 0"}}>
          {t.over ? `${pence(shown)} of every extra £1 you earn goes in ${lostTo(t.rate)}.`
            : `Past ${K}, ${pence(shown)} of every extra £1 you earn would go in ${lostTo(t.rate)}. You're at ${pct(t.rate.rate)} now.`}
        </p>
      </section>
      <section style={tile}>
        <div style={tileTitle}>Marginal tax rate by income</div>
        <div style={{fontSize:"12px",color:MUT,marginTop:"2px"}}>The trap, {K} to {fmt(TRAP_END)}, in red.</div>
        <div ref={chartRef} style={{width:"100%",marginTop:"12px"}}>
          <RateChart points={rateCurve(d, m)} you={t.ani} width={chartWidth}/>
        </div>
      </section>

      {/* 3. What it costs them. */}
      <Costs d={d} t={t}/>

      {/* 4. How to get back to £100k. */}
      {t.options.length > 0 && <WaysBack t={t}/>}
    </div>
  );
}

// What being over £100k costs, or would: a row each, adding up to the
// figure at the top. Childcare goes if either parent's income is £1 over,
// each on their own income; without children 11 or under (or none said, or
// one on the way) its rows are greyed, with what they'd be.
function Costs({ d, t }) {
  const cc = t.childcare;
  const parent = !!cc && !cc.planning;
  const england = !t.nation || t.nation === "england";
  const showHours = england && (parent ? cc.preschool > 0 : true);
  const rate = t.over ? t.rate.rate : t.trapRate;
  const either = `Each parent's income counts on its own, not added together: either one £1 over ${K} stops it for the whole year.`;
  const ifKids = parent ? "" : ` Shown ${cc?.planning ? "for once your child arrives" : kidsSituation(d) === "no" ? "in case you have children" : "for parents"}.`;
  const nationNote = t.nation === "scotland" ? " Scotland's funded hours have no income limit, so they aren't affected."
    : t.nation === "wales" ? " Wales's Childcare Offer is tested on gross income, so a pension payment doesn't change it; it isn't counted here." : "";
  const rateParts = [`${pct(t.rate.tax)} tax`, t.rate.ni > 0 ? `${pct(t.rate.ni)} National Insurance` : null, t.rate.sl > 0 ? `${pct(t.rate.sl)} student loan` : null].filter(Boolean).join(", ");
  return (
    <section style={tile}>
      <div style={tileTitle}>{t.over ? "What it costs you" : `What passing ${K} would cost you`}</div>
      <CostRow topic="Marginal tax rate" line={`${pence(rate)} of each extra £1, not ${pence(t.belowRate)}`} value={pct(rate)}
        detail={`${t.over ? rateParts : `At ${pct(rate)}`}. Over ${K}, £1 of tax-free allowance goes for every £2 earned, until it's gone at ${fmt(TRAP_END)}. Just under ${K}, it's ${pct(t.belowRate)}.`}/>
      <CostRow topic="Tax-free allowance" line={t.over ? `${fmt(t.allowance.lost)} of your ${fmt(PERSONAL_ALLOWANCE)} lost` : `£1 lost for every £2 over ${K}`} value={t.over ? fmt(t.allowance.tax) : fmt(PERSONAL_ALLOWANCE)}
        detail={t.over ? `£1 goes for every £2 over ${K}. The ${fmt(t.allowance.lost)} you've lost is now taxed at ${t.allowance.lost ? Math.round(t.allowance.tax / t.allowance.lost * 100) : 40}%, costing ${fmt(t.allowance.tax)} a year.`
          : `Your ${fmt(PERSONAL_ALLOWANCE)} would go £1 for every £2 over ${K}, all of it by ${fmt(TRAP_END)}.`}/>
      {showHours && (
        <CostRow topic="30 funded hours" line={`Stops if either parent is over ${K}`} value={fmt(parent ? cc.hours : FUNDED_HOURS_VALUE)} greyed={!parent}
          detail={`30 hours a week for 38 weeks, in England, from 9 months until school${parent ? `, for ${cc.preschool === 1 ? "your child" : `your ${cc.preschool} children`}` : ", for each child"}. ${either}${ifKids}`}/>
      )}
      <CostRow topic="Tax-Free Childcare" line={`Stops if either parent is over ${K}`} value={fmt(parent ? cc.tfc : TFC_CAP_PER_CHILD)} greyed={!parent}
        detail={`The government adds £2 for every £8 you pay for childcare, up to ${fmt(TFC_CAP_PER_CHILD)} a child a year, to age 11. ${either}${ifKids}${nationNote}`}/>
      {t.over && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",paddingTop:"12px"}}>
          <span style={{fontSize:"13.5px",fontWeight:700,color:TEXT}}>In all, a year</span>
          <span style={{fontFamily:SERIF,fontSize:"20px",fontWeight:700,color:G}}>{fmt(t.amount)}</span>
        </div>
      )}
      {!t.over && (
        <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,margin:"12px 0 0"}}>A rise or bonus that would take you over can go into your pension by salary sacrifice instead.</p>
      )}
    </section>
  );
}

// One cost: the topic, a line, its value; the explainer behind the arrow.
function CostRow({ topic, line, value, detail, greyed = false }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{borderBottom:"1px solid rgba(22,47,36,0.08)",opacity:greyed ? 0.5 : 1}}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{width:"100%",display:"flex",alignItems:"center",gap:"10px",background:"none",border:"none",padding:"12px 0",textAlign:"left",fontFamily:"inherit",cursor:"pointer"}}>
        <span style={{flex:1,minWidth:0}}>
          <span style={{display:"block",fontSize:"14px",fontWeight:700,color:TEXT}}>{topic}</span>
          <span style={{display:"block",fontSize:"12.5px",color:MUT,marginTop:"2px"}}>{line}</span>
        </span>
        <span style={{fontFamily:SERIF,fontSize:"18px",fontWeight:700,color:G,whiteSpace:"nowrap"}}>{value}</span>
        <ChevronDown size={15} color={MUT} style={{flexShrink:0,transform:open ? "rotate(180deg)" : "none",transition:"transform 0.15s"}}/>
      </button>
      {open && <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"0 0 12px",paddingRight:"24px"}}>{detail}</p>}
    </div>
  );
}

// The ways back to £100k: each, what it takes, and its outcome a year.
// Listed by what each leaves in their bank (childcare back less the
// take-home it costs), not a recommendation.
function WaysBack({ t }) {
  const ways = t.options.map(o => ({ ...o, ...WAY[o.key](o, t) })).sort((a, b) => b.bank - a.bank);
  return (
    <section style={tile}>
      <div style={tileTitle}>How to get back to {K}</div>
      <div style={{fontSize:"12px",color:MUT,lineHeight:1.45,marginTop:"2px"}}>Each ends these costs. Figures a year, listed by what each leaves in your bank, not a recommendation.</div>
      {ways.map((w, i) => (
        <div key={w.key} style={{borderTop:i === 0 ? "none" : "1px solid rgba(22,47,36,0.08)",paddingTop:"14px",marginTop:"14px"}}>
          <div style={{fontSize:"14.5px",fontWeight:700,color:TEXT}}>{w.option}</div>
          <div style={{fontSize:"13px",color:TEXT,lineHeight:1.45,marginTop:"3px"}}>{w.needed}</div>
          {/* Two or four in a 2 by 2 grid; three in a row. */}
          <div style={{display:"grid",gridTemplateColumns:w.outcome.length === 3 ? "1fr 1fr 1fr" : "1fr 1fr",gap:"8px",marginTop:"10px"}}>
            {w.outcome.map(c => (
              <div key={c.label} style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"8px 10px"}}>
                <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.05em",textTransform:"uppercase"}}>{c.label}</div>
                <div style={{fontFamily:SERIF,fontSize:"17px",fontWeight:700,color:c.value < 0 ? TEXT : G,marginTop:"2px"}}>{c.text ?? signed(c.value)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

// Each way: its name, what it takes, and its outcome (taxTrap.js options).
// With childcare coming back, that and what's left in the bank; without,
// the tax it saves.
const share = s => `${Math.round(s * 1000) / 10}% of salary`;
const childcareOrTax = (o, taxLabel = "Tax saved") => o.childcare > 0
  ? [{ label: "Childcare back", value: o.childcare }, { label: "In your bank", value: o.bank }]
  : [{ label: taxLabel, value: o.taxSaved, text: fmt(o.taxSaved) }];
const WAY = {
  pension: (o, t) => ({
    option: "Pension contributions",
    needed: `Add ${fmt(o.amount)} to your pension (${share(o.share)}) by ${o.route === "sacrifice" ? "salary sacrifice" : "relief at source"}${o.fits ? "" : `: more than the ${fmt(t.aaRoom)} allowance left this year`}.`,
    outcome: [{ label: "Take-home", value: -o.takeHome }, { label: "Pension", value: o.pension }, ...childcareOrTax(o)],
  }),
  sacrifice: o => ({
    option: "Other salary sacrifice",
    needed: `Swap ${fmt(o.amount)} of salary (${share(o.share)}) for an electric car or cycle to work.`,
    outcome: [{ label: "Take-home", value: -o.takeHome }, { label: "Tax saved", value: o.taxSaved, text: fmt(o.taxSaved) },
      ...(o.childcare > 0 ? [{ label: "Childcare back", value: o.childcare }, { label: "In your bank", value: o.bank }] : [])],
  }),
  giftAid: o => ({
    option: "Charitable donations",
    needed: `Give ${fmt(o.given)} with Gift Aid: the charity gets ${fmt(o.charity)}.`,
    outcome: [{ label: "Cost to you", value: -o.takeHome }, { label: "Charity gets", value: o.charity }, ...childcareOrTax(o, "Tax back")],
  }),
  fourDay: o => ({
    option: "Reduced hours",
    needed: `Work a 4-day week: ${fmt(o.gross)} less salary${o.under ? "" : `, still over ${K}`}.`,
    outcome: [{ label: "Take-home", value: -o.takeHome }, { label: "Days off", value: o.daysOff, text: `+${o.daysOff}` }, ...childcareOrTax(o)],
  }),
};

// The marginal tax rate at every income from £0 to £130,000, with the
// £100k to £125,140 trap in red, and where they are marked.
function RateChart({ points, you, width }) {
  if (!points.length || !width) return null;
  const VW = width, VH = 170, PL = 34, PR = 8, PT = 16, PB = 22;
  const from = points[0].income, to = points[points.length - 1].income;
  const maxRate = Math.max(0.8, ...points.map(p => p.rate));
  const sx = x => PL + (x - from) / (to - from) * (VW - PL - PR);
  const sy = r => PT + (1 - r / maxRate) * (VH - PT - PB);
  const line = pts => pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.income).toFixed(1)},${sy(p.rate).toFixed(1)}`).join(" ");
  const trap = points.filter(p => p.income >= TRAP_START && p.income <= TRAP_END);
  const youX = sx(Math.min(to, Math.max(from, you)));
  const label = { fontSize:"10px", fill:MUT, fontFamily:"inherit" };
  return (
    <svg width={VW} height={VH} role="img" aria-label="Marginal tax rate at each income, from £0 to £130,000, with the £100k trap in red">
      <rect x={sx(TRAP_START)} y={PT} width={sx(TRAP_END) - sx(TRAP_START)} height={VH - PT - PB} fill={CRITICAL} opacity="0.1"/>
      {[0.2, 0.4, 0.6].map(r => (
        <g key={r}>
          <line x1={PL} x2={VW - PR} y1={sy(r)} y2={sy(r)} stroke="rgba(22,47,36,0.08)"/>
          <text x={PL - 6} y={sy(r) + 3} textAnchor="end" style={label}>{r * 100}%</text>
        </g>
      ))}
      <path d={line(points)} fill="none" stroke={G} strokeWidth="2.2" strokeLinejoin="round"/>
      {trap.length > 1 && <path d={line(trap)} fill="none" stroke={CRITICAL} strokeWidth="2.6" strokeLinejoin="round"/>}
      <line x1={youX} x2={youX} y1={PT} y2={VH - PB} stroke={G} strokeDasharray="3 3"/>
      <text x={youX} y={PT - 3} textAnchor={youX > VW - 40 ? "end" : "middle"} style={{...label,fill:G,fontWeight:700}}>You</text>
      {[0, 50000, TRAP_START, TRAP_END].map(x => (
        <text key={x} x={sx(x)} y={VH - 6} textAnchor={x === 0 ? "start" : "middle"} style={label}>£{Math.round(x / 1000)}k{x === TRAP_END ? "+" : ""}</text>
      ))}
    </svg>
  );
}
