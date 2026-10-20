import { useElementWidth } from "../useElementWidth.js";
import { fmt } from "../../lib/format.js";
import { taxTrap, trapInView, rateCurve, lostTo, TRAP_START, TRAP_END } from "../../lib/taxTrap.js";
import { PERSONAL_ALLOWANCE } from "../../lib/tax.js";
import { kidsSituation, TFC_CAP_PER_CHILD, FUNDED_HOURS_VALUE } from "../../lib/childcare.js";
import { G, MUT, TEXT, SERIF, WHITE, CRITICAL, OPPORTUNITY_TILE_BG, OPPORTUNITY_TILE_BORDER, OPPORTUNITY_TILE_SHADOW, OPPORTUNITY_TILE_LABEL, OPPORTUNITY_TILE_FIGURE, OPPORTUNITY_TILE_BODY } from "../../design-tokens.js";

// £100k tax trap (taxTrap.js), top to bottom:
//  - What getting back to £100k is worth, in its parts (tax and NI saved,
//    childcare support back), each traceable to the rows further down.
//  - Their marginal tax rate: of every extra £1 they earn, what's lost to
//    tax, NI and student loan; on a chart of the rate at every income from
//    £0, the trap in red, so the jump shows against the bands below it.
//  - What being over £100k costs: the rate against just under it, the
//    allowance lost, and childcare (either parent £1 over, on their own
//    income, loses it). Without children it's still shown, greyed.
//  - Why get back to £100k, then the ways back, a tile each: the option, the
//    amount it takes, what happens, and its cost to them; the childcare it
//    brings back under it. Listed by what each leaves them with overall,
//    not a recommendation.
// Under £100k: how far, the rate past it, and what crossing would cost.
const K = "£100k";
const pct = r => `${Math.round(r * 1000) / 10}%`;
const pence = r => `${Math.round(r * 1000) / 10}p`;
const signed = n => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`;
const tile = { background:WHITE, borderRadius:"16px", boxShadow:"0 2px 10px rgba(22,47,36,0.06)", padding:"16px 18px" };
const kicker = { fontSize:"10.5px", fontWeight:700, color:MUT, letterSpacing:"0.09em", textTransform:"uppercase" };
const row = { display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:"12px", padding:"12px 0", borderBottom:"1px solid rgba(22,47,36,0.08)" };
const rowLabel = { fontSize:"13.5px", color:TEXT, fontWeight:600 };
const rowNote = { fontSize:"12px", color:MUT, marginTop:"2px", lineHeight:1.45 };
const rowFigure = { fontFamily:SERIF, fontSize:"17px", color:G, fontWeight:700, whiteSpace:"nowrap" };

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
  const parts = [`${pct(t.rate.tax)} tax`, t.rate.ni > 0 ? `${pct(t.rate.ni)} National Insurance` : null, t.rate.sl > 0 ? `${pct(t.rate.sl)} student loan` : null].filter(Boolean).join(", ");
  const shown = t.over ? t.rate.rate : t.trapRate;
  const childcareBack = t.childcareLost > 0 && t.fits ? t.childcareLost : 0;
  const pension = t.options.find(o => o.key === "pension");
  // Each way back, listed by what it leaves them with once the childcare it
  // brings back is counted, most first.
  const ways = t.options.map(o => ({ ...o, net: o.childcare - o.takeHome, ...WAY[o.key](o, t) })).sort((a, b) => b.net - a.net);

  return (
    <div>
      {t.amount > 0 && (
        <div style={{background:OPPORTUNITY_TILE_BG,border:OPPORTUNITY_TILE_BORDER,boxShadow:OPPORTUNITY_TILE_SHADOW,borderRadius:"14px",padding:"16px 18px",marginBottom:"18px"}}>
          <div style={{fontSize:"10px",fontWeight:800,color:OPPORTUNITY_TILE_LABEL,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Opportunity</div>
          <div style={{fontFamily:SERIF,fontSize:"32px",color:OPPORTUNITY_TILE_FIGURE,fontWeight:700,lineHeight:1.1}}>{fmt(t.amount)}</div>
          <div style={{fontSize:"12px",color:OPPORTUNITY_TILE_LABEL,marginTop:"4px",fontWeight:600}}>A year, by getting your income back to {K}</div>
          {/* Its parts, adding up to it: each is a row further down. */}
          <div style={{marginTop:"10px",borderTop:"1px solid rgba(22,47,36,0.1)"}}>
            <OppPart label="Tax and National Insurance saved" note={`${pct(t.taxSaving / t.needed)} of the ${fmt(t.needed)} you're over ${K}`} value={t.taxSaving}/>
            {childcareBack > 0 && <OppPart label="Childcare support back" note="Tax-Free Childcare and the funded hours (below)" value={childcareBack}/>}
          </div>
          <div style={{fontSize:"12px",color:OPPORTUNITY_TILE_BODY,lineHeight:1.5,marginTop:"8px"}}>Any of the ways back to {K} below gets you there.</div>
        </div>
      )}

      <section style={{marginBottom:"20px"}}>
        <div style={kicker}>{t.over ? "Your marginal tax rate" : `Your marginal tax rate past ${K}`}</div>
        <div style={{fontFamily:SERIF,fontSize:"40px",color:G,fontWeight:700,lineHeight:1.1,marginTop:"4px"}}>{pct(shown)}</div>
        <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"4px 0 0"}}>
          For every extra £1 you earn{t.over ? "" : ` past ${K}`}, {pence(shown)} {t.over ? "is" : "would be"} lost to {lostTo(t.rate)}.
        </p>
        <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"4px 0 0"}}>
          {t.over ? `${parts}. ${t.aboveTaper ? `Over ${fmt(TRAP_END)} your tax-free allowance has gone completely.` : `Over ${K}, £1 of tax-free allowance goes for every £2 earned, until it's gone at ${fmt(TRAP_END)}.`}`
            : `You're ${fmt(t.headroom)} under ${K}, at ${pct(t.rate.rate)} now. Past it, £1 of tax-free allowance goes for every £2 earned.`}
        </p>
      </section>

      <section style={{...tile,marginBottom:"20px"}}>
        <div style={{fontSize:"13px",fontWeight:600,color:G}}>Marginal tax rate by income</div>
        <p style={{fontSize:"12px",color:MUT,lineHeight:1.45,margin:"2px 0 0"}}>What's lost from each extra £1 at every income, on your setup. The trap, {K} to {fmt(TRAP_END)}, is in red.</p>
        <div ref={chartRef} style={{width:"100%",marginTop:"12px"}}>
          <RateChart points={rateCurve(d, m)} you={t.ani} width={chartWidth}/>
        </div>
      </section>

      <TrapCosts d={d} t={t}/>

      {t.options.length > 0 && (
        <section style={{marginBottom:"8px"}}>
          <div style={kicker}>Ways back to {K}</div>
          {/* Why it's worth a look, on their figures. */}
          <div style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"6px 0 4px",fontWeight:600}}>Why get back to {K}</div>
          <ul style={{margin:"0 0 10px",paddingLeft:"18px",fontSize:"12.5px",color:TEXT,lineHeight:1.55}}>
            <li>It's tax efficient: each £1 brought back under {K} saves {pence(t.rate.rate)} of {lostTo(t.rate)}, against {pence(t.belowRate)} below it.</li>
            {childcareBack > 0 && <li>It restores {fmt(childcareBack)} a year of childcare support.</li>}
            {pension && <li>It can build your pension at little cost to you: {fmt(pension.amount)} goes in for {fmt(pension.takeHome)} off your take-home.</li>}
          </ul>
          <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"0 0 12px"}}>Listed by what each leaves you with overall, not a recommendation.</p>
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            {ways.map(w => (
              <div key={w.key} style={tile}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"14px"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"15.5px",fontWeight:700,color:TEXT}}>{w.option}</div>
                    <div style={{display:"flex",alignItems:"baseline",gap:"6px",flexWrap:"wrap",marginTop:"4px"}}>
                      <span style={{fontFamily:SERIF,fontSize:"18px",fontWeight:700,color:G}}>{fmt(w.needed)}</span>
                      <span style={{fontSize:"12px",color:MUT}}>{w.neededLabel}</span>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:"10.5px",fontWeight:700,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase"}}>Cost to you</div>
                    <div style={{fontFamily:SERIF,fontSize:"20px",color:TEXT,fontWeight:700,marginTop:"2px"}}>{fmt(w.takeHome)}</div>
                    <div style={{fontSize:"10.5px",color:MUT}}>a year</div>
                  </div>
                </div>
                <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"10px 0 0"}}>{w.explain}</p>
                {w.childcare > 0 && (
                  <div style={{display:"flex",justifyContent:"space-between",gap:"12px",borderTop:"1px solid rgba(22,47,36,0.08)",marginTop:"12px",paddingTop:"10px",fontSize:"12.5px",color:TEXT}}>
                    <span>Plus {fmt(w.childcare)} of childcare support back</span>
                    <span style={{fontWeight:700,color:w.net >= 0 ? G : TEXT,whiteSpace:"nowrap"}}>{signed(w.net)} a year overall</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OppPart({ label, note, value }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:"12px",padding:"8px 0",borderBottom:"1px solid rgba(22,47,36,0.1)"}}>
      <div>
        <div style={{fontSize:"12.5px",color:OPPORTUNITY_TILE_LABEL,fontWeight:600}}>{label}</div>
        <div style={{fontSize:"11.5px",color:OPPORTUNITY_TILE_BODY,marginTop:"1px"}}>{note}</div>
      </div>
      <div style={{fontFamily:SERIF,fontSize:"16px",color:OPPORTUNITY_TILE_FIGURE,fontWeight:700,whiteSpace:"nowrap"}}>{fmt(value)}</div>
    </div>
  );
}

// What being over £100k costs, or would: the rate against just under it,
// the allowance, and childcare. Childcare goes if either parent's income is
// £1 over, each on their own (not added together). With children 11 or
// under, their own figures; without (none, none said, or one on the way),
// the same rows greyed, with what they'd be.
function TrapCosts({ d, t }) {
  const over = t.over;
  const cc = t.childcare;
  const parent = cc && !cc.planning;
  const england = !t.nation || t.nation === "england";
  const hours = parent ? cc.hours : FUNDED_HOURS_VALUE;
  const tfc = parent ? cc.tfc : TFC_CAP_PER_CHILD;
  const greyed = { opacity: parent ? 1 : 0.5 };
  const stop = over ? "stop" : "would stop";
  return (
    <section style={{marginBottom:"20px"}}>
      <div style={kicker}>{over ? `What being over ${K} costs you` : `What passing ${K} would cost you`}</div>
      <div style={row}>
        <div>
          <div style={rowLabel}>A higher marginal tax rate</div>
          <div style={rowNote}>Against {pct(t.belowRate)} just under {K}: {pence(over ? t.rate.rate : t.trapRate)} of every extra £1 lost, instead of {pence(t.belowRate)}.</div>
        </div>
        <div style={rowFigure}>{pct(over ? t.rate.rate : t.trapRate)}</div>
      </div>
      <div style={row}>
        <div>
          <div style={rowLabel}>Tax-free allowance lost</div>
          <div style={rowNote}>{over
            ? `£1 goes for every £2 over ${K}: ${fmt(t.allowance.lost)} of your ${fmt(PERSONAL_ALLOWANCE)} so far, costing ${fmt(t.allowance.tax)} in tax.`
            : `£1 of your ${fmt(PERSONAL_ALLOWANCE)} would go for every £2 over ${K}, until it's gone at ${fmt(TRAP_END)}.`}</div>
        </div>
        <div style={rowFigure}>{over ? fmt(t.allowance.tax) : fmt(PERSONAL_ALLOWANCE)}</div>
      </div>

      <div style={{...greyed,marginTop:"14px"}}>
        <div style={{fontSize:"13px",color:TEXT,fontWeight:600}}>Childcare support</div>
        <div style={rowNote}>
          {parent
            ? `If either parent's income goes £1 over ${K} (each on their own, not added together), these ${stop} for the whole year:`
            : `${cc?.planning ? "Once your child arrives" : kidsSituation(d) === "no" ? "If you have children" : "For parents"}: if either parent's income goes £1 over ${K} (each on their own, not added together), these stop for the whole year.`}
        </div>
        {england && (parent ? cc.preschool > 0 : true) && (
          <div style={row}>
            <div>
              <div style={rowLabel}>30 funded hours</div>
              <div style={rowNote}>30 hours a week for 38 weeks, in England, from 9 months until school{parent ? `, for ${cc.preschool === 1 ? "your child" : `your ${cc.preschool} children`} not yet at school` : ", for each child"}.</div>
            </div>
            <div style={rowFigure}>{fmt(hours)}</div>
          </div>
        )}
        <div style={row}>
          <div>
            <div style={rowLabel}>Tax-Free Childcare</div>
            <div style={rowNote}>The government adds £2 for every £8 you pay for childcare, up to {fmt(TFC_CAP_PER_CHILD)} a child a year, to age 11.</div>
          </div>
          <div style={rowFigure}>{fmt(tfc)}</div>
        </div>
        {t.nation === "scotland" && <p style={{...rowNote,marginTop:"8px"}}>Scotland's funded hours have no income limit, so they aren't affected.</p>}
        {t.nation === "wales" && <p style={{...rowNote,marginTop:"8px"}}>Wales's Childcare Offer is tested on gross income, which a pension payment doesn't change, so it isn't counted here.</p>}
      </div>

      {!over && (
        <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.55,margin:"12px 0 0"}}>
          A pay rise or bonus that takes you over can go into your pension instead, through salary sacrifice, to keep you under.
        </p>
      )}
    </section>
  );
}

// Each way back: the option, the amount it takes to get back to £100k, what
// happens, from its figures (taxTrap.js options). Its cost to them is the
// fall in take-home pay; the childcare it brings back is on a line under it.
const WAY = {
  pension: (o, t) => ({
    option: "Pension contributions", needed: o.amount, neededLabel: `into your pension to get back to ${K}`,
    explain: (o.route === "sacrifice"
      ? `Contribute ${fmt(o.amount)} by salary sacrifice: your pension gains ${fmt(o.amount)}, and your take-home falls by ${fmt(o.takeHome)}.`
      : `Pay ${fmt(Math.round(o.amount * 0.8))} into your pension and ${fmt(Math.round(o.amount * 0.2))} of basic-rate relief is added, so it gains ${fmt(o.amount)}. You claim ${fmt(Math.round(o.amount * 0.8) - o.takeHome)} more back through Self Assessment, so your take-home falls by ${fmt(o.takeHome)}.`)
      + (o.bonus > 0 ? " Paying in some of your bonus works the same way." : "")
      + (o.fits ? "" : ` It's more than the ${fmt(t.aaRoom)} of this year's pension allowance left.`),
  }),
  sacrifice: o => ({
    option: "Other salary sacrifice", needed: o.amount, neededLabel: `of salary swapped to get back to ${K}`,
    explain: `Swap ${fmt(o.amount)} of salary for an electric car or cycle-to-work scheme through your employer: your take-home falls by ${fmt(o.takeHome)}, about ${o.perPound}p for each £1. A car adds a small benefit-in-kind tax.`,
  }),
  giftAid: o => ({
    option: "Charitable donations", needed: o.amount, neededLabel: `to charity, with Gift Aid, to get back to ${K}`,
    explain: `Give ${fmt(Math.round(o.amount * 0.8))} and the charity claims ${fmt(Math.round(o.amount * 0.2))} of Gift Aid, so it gets ${fmt(o.amount)}. You claim ${fmt(Math.round(o.amount * 0.8) - o.takeHome)} back through Self Assessment, so it costs you ${fmt(o.takeHome)}.`,
  }),
  fourDay: o => ({
    option: "Reduced hours", needed: o.gross, neededLabel: "less salary, working a 4-day week",
    explain: `Work 4 days a week for 80% of your salary: ${fmt(o.gross)} less before tax, but your take-home falls by ${fmt(o.takeHome)}, and you get about ${o.daysOff} more days off a year.${o.under ? "" : ` It doesn't bring you under ${K} on its own.`}`,
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
