import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useElementWidth } from "../useElementWidth.js";
import { fmt } from "../../lib/format.js";
import { taxTrap, trapInView, rateCurve, lostTo, TRAP_START, TRAP_END } from "../../lib/taxTrap.js";
import { PERSONAL_ALLOWANCE } from "../../lib/tax.js";
import { kidsSituation, TFC_CAP_PER_CHILD, FUNDED_HOURS_VALUE } from "../../lib/childcare.js";
import { G, MUT, TEXT, SERIF, WHITE, CDARK, CRITICAL, RADIUS_CARD } from "../../design-tokens.js";
import OpportunityTile from "./OpportunityTile.jsx";

// £100k tax trap (taxTrap.js), in the order the answer runs:
//  1. What the trap costs them a year: the tax on the allowance lost and
//     the childcare their income stops. Money, so it's the module's £ on
//     Home too. Under £100k: how far, and what £1 over would do.
//  2. Why: their marginal tax rate, on a chart of it at every income from
//     £0, the trap in red. Touching or pointing at the chart shows the rate
//     there in its parts (tax, NI, student loan), as pills beside it, or
//     below it on a phone.
//  3. What it costs them: the total a year, then a row each (the topic, a
//     line, the £; more behind the arrow). Childcare is shown without
//     children too, greyed.
//  4. Tax-efficient options: each way back to £100k, in a tile of its own,
//     with what it takes and its outcome in £ a year, sorted by tax saved
//     or by take-home, as they choose.
const K = "£100k";
const pct = r => `${Math.round(r * 1000) / 10}%`;
const pence = r => `${Math.round(r * 1000) / 10}p`;
const signed = n => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`;
const tile = { background:WHITE, borderRadius:"16px", boxShadow:"0 2px 10px rgba(22,47,36,0.06)", padding:"16px 18px", marginBottom:"16px" };
const tileTitle = { fontSize:"15px", fontWeight:700, color:TEXT };
// The arrow's width, so a figure without one lines up with those with one.
const ARROW = 15;

export default function MobileTaxTrapDeepDive({ d, m }) {
  const t = taxTrap(d, m);
  if (!t || !trapInView(d, m.adjustedNetIncome)) {
    return (
      <p style={{fontSize:"13.5px",color:TEXT,lineHeight:1.6}}>
        {t ? `Your income is ${fmt(t.ani)}, not near ${K}, so nothing here applies yet.` : "This works from your salary, which isn't in yet."} Within {fmt(10000)} of it, or heading over it in the next few years, this module works out what it would cost you.
      </p>
    );
  }
  const support = t.nation === "england" || !t.nation ? "Tax-Free Childcare and funded hours" : "Tax-Free Childcare";

  return (
    <div>
      {/* 1. The answer. */}
      <OpportunityTile stacked over={t.over ? `What the ${K} trap costs you` : `You're under ${K}`}
        figures={[{ value: t.over ? fmt(t.amount) : fmt(t.headroom), suffix: t.over ? " a year" : " to spare" }]}
        chips={t.over
          ? [`${fmt(t.allowance.tax)} extra tax${t.childcareLost > 0 ? "" : " on the allowance you've lost"}`, t.childcareLost > 0 && `+ ${fmt(t.childcareLost)} of ${support}`]
          : [`£1 over: a ${pct(t.trapRate)} marginal rate`, t.childcareAtRisk > 0 && `${fmt(t.childcareAtRisk)} of ${support} would stop`]}/>

      {/* 2. Why. */}
      <RateTile d={d} m={m} t={t}/>

      {/* 3. What it costs them. */}
      <Costs d={d} t={t}/>

      {/* 4. Tax-efficient options. */}
      {t.options.length > 0 && <Options t={t}/>}
    </div>
  );
}

// Their marginal tax rate, and the chart of it at every income. Where they
// touch or point is shown in its parts; until then, where they are.
function RateTile({ d, m, t }) {
  const [ref, width] = useElementWidth(300);
  const points = rateCurve(d, m);
  const [at, setAt] = useState(null);
  const you = points.reduce((best, p) => Math.abs(p.income - t.ani) < Math.abs(best.income - t.ani) ? p : best, points[0]);
  // Where they are, as it is (not the chart's plain-salary figure).
  const shown = at || { ...t.rate, income: t.ani };
  // Beside the chart where there's room (a computer), below it on a phone.
  const side = width >= 420;
  const chartWidth = side ? Math.round(width * 0.75) : width;
  const pill = { display:"inline-flex", alignItems:"baseline", gap:"6px", background:CDARK, borderRadius:"100px", padding:"6px 10px", fontSize:"12px", color:TEXT, whiteSpace:"nowrap" };
  const pills = (
    <div style={{display:"flex",flexDirection:side ? "column" : "row",flexWrap:"wrap",gap:"6px",alignItems:side ? "stretch" : "center"}}>
      <div style={{fontSize:"11px",fontWeight:700,color:MUT,width:side ? "auto" : "100%"}}>At {fmt(Math.round(shown.income))}{at ? "" : ", you"}</div>
      <span style={pill}>Tax <b>{pct(shown.tax)}</b></span>
      {shown.ni > 0 && <span style={pill}>NI <b>{pct(shown.ni)}</b></span>}
      {shown.sl > 0 && <span style={pill}>Student loan <b>{pct(shown.sl)}</b></span>}
      <span style={{...pill,background:G,color:WHITE}}>Total <b>{pct(shown.rate)}</b></span>
    </div>
  );
  return (
    <section style={tile}>
      <div style={tileTitle}>Marginal tax rate by income</div>
      <div style={{display:"flex",alignItems:"baseline",gap:"8px",marginTop:"4px"}}>
        <span style={{fontFamily:SERIF,fontSize:"28px",fontWeight:700,color:G,lineHeight:1.1}}>{pct(t.rate.rate)}</span>
        <span style={{fontSize:"12.5px",color:TEXT,lineHeight:1.4}}>
          {t.over ? `yours: ${pence(t.rate.rate)} of every extra £1 you earn goes in ${lostTo(t.rate)}.` : `yours now. Past ${K} it's ${pct(t.trapRate)}.`}
        </span>
      </div>
      <div ref={ref} style={{display:"flex",flexDirection:side ? "row" : "column",gap:"12px",marginTop:"12px"}}>
        <RateChart points={points} you={you} at={at} onAt={setAt} width={chartWidth}/>
        <div style={{flex:1}}>{pills}</div>
      </div>
      <div style={{fontSize:"11.5px",color:MUT,marginTop:"8px"}}>The trap, {K} to {fmt(TRAP_END)}, in red. Touch the chart to see the rate at any income.</div>
    </section>
  );
}

// What being over £100k costs, or would: the total a year at the top,
// lined up with each row's £, then a row each. Childcare goes if either
// parent's income is £1 over, each on their own income; without children 11
// or under (or none said, or one on the way) its rows are greyed, with what
// they'd be, and not in the total.
function Costs({ d, t }) {
  const cc = t.childcare;
  const parent = !!cc && !cc.planning;
  const england = !t.nation || t.nation === "england";
  const showHours = england && (parent ? cc.preschool > 0 : true);
  const either = `Each parent's income counts on its own, not added together: either one £1 over ${K} stops it for the whole year.`;
  const ifKids = parent ? "" : ` Shown ${cc?.planning ? "for once your child arrives" : kidsSituation(d) === "no" ? "in case you have children" : "for parents"}.`;
  const nationNote = t.nation === "scotland" ? " Scotland's funded hours have no income limit, so they aren't affected."
    : t.nation === "wales" ? " Wales's Childcare Offer is tested on gross income, so a pension payment doesn't change it; it isn't counted here." : "";
  const lostRate = t.allowance.lost ? Math.round(t.allowance.tax / t.allowance.lost * 100) : 40;
  return (
    <section style={tile}>
      <div style={{display:"flex",alignItems:"baseline",gap:"10px"}}>
        <span style={{...tileTitle,flex:1}}>{t.over ? "What it costs you" : `What passing ${K} would cost you`}</span>
        {t.over && <span style={{fontFamily:SERIF,fontSize:"20px",fontWeight:700,color:G,whiteSpace:"nowrap"}}>{fmt(t.amount)}/yr</span>}
        {t.over && <span style={{width:`${ARROW}px`,flexShrink:0}}/>}
      </div>
      <CostRow topic="Tax-free allowance" line={t.over ? `${fmt(t.allowance.lost)} of your ${fmt(PERSONAL_ALLOWANCE)} lost` : `50p lost for every £1 over ${K}`}
        value={t.over ? fmt(t.allowance.tax) : `${lostRate / 2}p per £1`}
        detail={t.over ? `£1 goes for every £2 over ${K}. The ${fmt(t.allowance.lost)} you've lost is now taxed at ${lostRate}%, costing ${fmt(t.allowance.tax)} a year.`
          : `Your ${fmt(PERSONAL_ALLOWANCE)} would go £1 for every £2 over ${K}, all of it by ${fmt(TRAP_END)}. Each £1 lost is taxed at ${lostRate}%.`}/>
      {showHours && (
        <CostRow topic="30 funded hours" line={`Stops if either parent is over ${K}`} value={fmt(parent ? cc.hours : FUNDED_HOURS_VALUE)} greyed={!parent}
          detail={`30 hours a week for 38 weeks, in England, from 9 months until school${parent ? `, for ${cc.preschool === 1 ? "your child" : `your ${cc.preschool} children`}` : ", for each child"}. ${either}${ifKids}`}/>
      )}
      <CostRow topic="Tax-Free Childcare" line={`Stops if either parent is over ${K}`} value={fmt(parent ? cc.tfc : TFC_CAP_PER_CHILD)} greyed={!parent} last
        detail={`The government adds £2 for every £8 you pay for childcare, up to ${fmt(TFC_CAP_PER_CHILD)} a child a year, to age 11. ${either}${ifKids}${nationNote}`}/>
      {!t.over && (
        <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,margin:"12px 0 0"}}>A rise or bonus that would take you over can go into your pension by salary sacrifice instead.</p>
      )}
    </section>
  );
}

// One cost: the topic, a line, its £; the explainer behind the arrow.
function CostRow({ topic, line, value, detail, greyed = false, last = false }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{borderTop:"1px solid rgba(22,47,36,0.08)",marginTop:"10px",opacity:greyed ? 0.5 : 1,paddingBottom:last ? 0 : undefined}}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{width:"100%",display:"flex",alignItems:"center",gap:"10px",background:"none",border:"none",padding:"10px 0 0",textAlign:"left",fontFamily:"inherit",cursor:"pointer"}}>
        <span style={{flex:1,minWidth:0}}>
          <span style={{display:"block",fontSize:"14px",fontWeight:700,color:TEXT}}>{topic}</span>
          <span style={{display:"block",fontSize:"12.5px",color:MUT,marginTop:"2px"}}>{line}</span>
        </span>
        <span style={{fontFamily:SERIF,fontSize:"18px",fontWeight:700,color:G,whiteSpace:"nowrap"}}>{value}</span>
        <ChevronDown size={ARROW} color={MUT} style={{flexShrink:0,transform:open ? "rotate(180deg)" : "none",transition:"transform 0.15s"}}/>
      </button>
      {open && <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0",paddingRight:"24px"}}>{detail}</p>}
    </div>
  );
}

// Tax-efficient options: each way back to £100k in a tile of its own, with
// what it takes and its outcome a year. Sorted by tax saved or by take-home,
// as they choose.
const SORTS = [
  { key:"tax", label:"Tax saved", by: (a, b) => b.taxSaved - a.taxSaved },
  { key:"takeHome", label:"Take-home", by: (a, b) => a.takeHome - b.takeHome },
];
function Options({ t }) {
  const [sort, setSort] = useState("tax");
  const ways = t.options.map(o => ({ ...o, ...WAY[o.key](o, t) })).sort(SORTS.find(s => s.key === sort).by);
  return (
    <section style={tile}>
      <div style={tileTitle}>Tax-efficient options</div>
      <div style={{fontSize:"12.5px",color:MUT,lineHeight:1.45,marginTop:"2px"}}>Ways your income could come back to {K}, and what each would mean for you a year.</div>
      <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"12px"}}>
        <span style={{fontSize:"11.5px",color:MUT,marginRight:"2px"}}>Sort by</span>
        {SORTS.map(s => (
          <button key={s.key} type="button" onClick={() => setSort(s.key)} aria-pressed={sort === s.key} style={{
            border:"none",borderRadius:"100px",padding:"6px 12px",fontSize:"12px",fontWeight:600,cursor:"pointer",fontFamily:"inherit",
            background:sort === s.key ? G : CDARK, color:sort === s.key ? WHITE : MUT,
          }}>{s.label}</button>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"10px",marginTop:"12px"}}>
        {ways.map(w => (
          // Nested tiles as the Pension module's what-ifs have them (MobileWinTile).
          <div key={w.key} style={{background:WHITE,border:"1px solid transparent",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",borderRadius:RADIUS_CARD,padding:"14px 16px"}}>
            <div style={{fontSize:"14.5px",fontWeight:700,color:TEXT}}>{w.option}</div>
            <div style={{fontSize:"13px",color:TEXT,lineHeight:1.45,marginTop:"3px"}}>{w.needed}</div>
            {/* Two to a row; an odd last one across both. */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginTop:"10px"}}>
              {w.outcome.map((c, i) => (
                <div key={c.label} style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"8px 10px",gridColumn:i === w.outcome.length - 1 && w.outcome.length % 2 ? "1 / -1" : undefined}}>
                  <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.05em",textTransform:"uppercase"}}>{c.label}</div>
                  <div style={{fontFamily:SERIF,fontSize:"17px",fontWeight:700,color:c.value < 0 ? TEXT : G,marginTop:"2px"}}>{c.text ?? signed(c.value)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Each way: its name, what it takes, and its outcome (taxTrap.js options):
// always its take-home and the tax it saves (what the options sort by),
// then what it puts in (pension, charity, days off), and with children the
// childcare that comes back.
const share = s => `${Math.round(s * 1000) / 10}% of salary`;
const base = (o, costLabel = "Take-home", taxLabel = "Tax saved") => [{ label: costLabel, value: -o.takeHome }, { label: taxLabel, value: o.taxSaved, text: fmt(o.taxSaved) }];
const childcareChip = o => o.childcare > 0 ? [{ label: "Childcare back", value: o.childcare }] : [];
const WAY = {
  pension: (o, t) => ({
    option: "Pension contributions",
    needed: `Add ${fmt(o.amount)} to your pension (${share(o.share)}) by ${o.route === "sacrifice" ? "salary sacrifice" : "relief at source"}${o.fits ? "" : `: more than the ${fmt(t.aaRoom)} allowance left this year`}.`,
    outcome: [...base(o), { label: "Pension", value: o.pension }, ...childcareChip(o)],
  }),
  sacrifice: o => ({
    option: "Other salary sacrifice",
    needed: `Swap ${fmt(o.amount)} of salary (${share(o.share)}) for an electric car or cycle to work.`,
    outcome: [...base(o), ...childcareChip(o)],
  }),
  giftAid: o => ({
    option: "Charitable donations",
    needed: `Give ${fmt(o.given)} with Gift Aid: the charity gets ${fmt(o.charity)}.`,
    outcome: [...base(o, "Cost to you", "Tax back"), { label: "Charity gets", value: o.charity }, ...childcareChip(o)],
  }),
  fourDay: o => ({
    option: "Reduced hours",
    needed: `Work a 4-day week: ${fmt(o.gross)} less salary${o.under ? "" : `, still over ${K}`}.`,
    outcome: [...base(o), { label: "Days off", value: o.daysOff, text: `+${o.daysOff}` }, ...childcareChip(o)],
  }),
};

// The marginal tax rate at every income from £0 to £130,000, the trap in
// red, where they are dashed, and where they've touched or pointed solid.
function RateChart({ points, you, at, onAt, width }) {
  if (!points.length || !width) return null;
  const VW = width, VH = 180, PL = 34, PR = 8, PT = 16, PB = 22;
  const from = points[0].income, to = points[points.length - 1].income;
  const maxRate = Math.max(0.85, ...points.map(p => p.rate));
  const sx = x => PL + (x - from) / (to - from) * (VW - PL - PR);
  const sy = r => PT + (1 - r / maxRate) * (VH - PT - PB);
  const line = pts => pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.income).toFixed(1)},${sy(p.rate).toFixed(1)}`).join(" ");
  const trap = points.filter(p => p.income >= TRAP_START && p.income <= TRAP_END);
  const label = { fontSize:"10px", fill:MUT, fontFamily:"inherit" };
  // The point under the pointer or finger.
  const pick = e => {
    const box = e.currentTarget.getBoundingClientRect();
    const income = from + (e.clientX - box.left - PL) / (VW - PL - PR) * (to - from);
    const p = points.reduce((best, q) => Math.abs(q.income - income) < Math.abs(best.income - income) ? q : best, points[0]);
    onAt(p);
  };
  const youX = sx(you.income);
  return (
    <svg width={VW} height={VH} role="img" aria-label="Marginal tax rate at each income, from £0 to £130,000, with the £100k trap in red"
      onPointerDown={pick} onPointerMove={e => (e.buttons || e.pointerType === "mouse") && pick(e)} style={{touchAction:"pan-y",cursor:"crosshair",flexShrink:0}}>
      <rect x={sx(TRAP_START)} y={PT} width={sx(TRAP_END) - sx(TRAP_START)} height={VH - PT - PB} fill={CRITICAL} opacity="0.1"/>
      {[0.2, 0.4, 0.6, 0.8].map(r => (
        <g key={r}>
          <line x1={PL} x2={VW - PR} y1={sy(r)} y2={sy(r)} stroke="rgba(22,47,36,0.08)"/>
          <text x={PL - 6} y={sy(r) + 3} textAnchor="end" style={label}>{Math.round(r * 100)}%</text>
        </g>
      ))}
      <path d={line(points)} fill="none" stroke={G} strokeWidth="2.2" strokeLinejoin="round"/>
      {trap.length > 1 && <path d={line(trap)} fill="none" stroke={CRITICAL} strokeWidth="2.6" strokeLinejoin="round"/>}
      <line x1={youX} x2={youX} y1={PT} y2={VH - PB} stroke={G} strokeDasharray="3 3"/>
      <text x={youX} y={PT - 4} textAnchor={youX > VW - 40 ? "end" : "middle"} style={{...label,fill:G,fontWeight:700}}>You</text>
      {at && (
        <g>
          <line x1={sx(at.income)} x2={sx(at.income)} y1={PT} y2={VH - PB} stroke={TEXT} strokeWidth="1"/>
          <circle cx={sx(at.income)} cy={sy(at.rate)} r="4" fill={WHITE} stroke={TEXT} strokeWidth="1.5"/>
        </g>
      )}
      {[0, 50000, TRAP_START, TRAP_END].map(x => (
        <text key={x} x={sx(x)} y={VH - 6} textAnchor={x === 0 ? "start" : "middle"} style={label}>£{Math.round(x / 1000)}k{x === TRAP_END ? "+" : ""}</text>
      ))}
    </svg>
  );
}
