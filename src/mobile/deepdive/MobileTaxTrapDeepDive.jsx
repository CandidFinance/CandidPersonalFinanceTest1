import { useElementWidth } from "../useElementWidth.js";
import { fmt } from "../../lib/format.js";
import { taxTrap, trapInView, rateCurve, lostTo, TRAP_START, TRAP_END } from "../../lib/taxTrap.js";
import { PERSONAL_ALLOWANCE } from "../../lib/tax.js";
import { G, GOLD, MUT, TEXT, SERIF, WHITE, OPPORTUNITY_TILE_BG, OPPORTUNITY_TILE_BORDER, OPPORTUNITY_TILE_SHADOW, OPPORTUNITY_TILE_LABEL, OPPORTUNITY_TILE_FIGURE, OPPORTUNITY_TILE_BODY } from "../../design-tokens.js";

// £100k tax trap (taxTrap.js): their marginal tax rate (of every extra £1
// they earn, what's lost to tax, NI and student loan), on a chart of the
// rate at every income from £0, so the jump at £100,000 shows against the
// bands below it; what being over £100,000 costs them (the allowance lost,
// and childcare support); and the ways back to £100,000, a tile each: its
// kind, what it is, and what it costs them, with the childcare it brings
// back, listed by what each leaves them with (not a recommendation). Under
// £100,000: how far, and what crossing would cost.
const pct = r => `${Math.round(r * 1000) / 10}%`;
const pence = r => `${Math.round(r * 1000) / 10}p`;
const tile = { background:WHITE, borderRadius:"16px", boxShadow:"0 2px 10px rgba(22,47,36,0.06)", padding:"16px 18px" };
const signed = n => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`;

export default function MobileTaxTrapDeepDive({ d, m }) {
  const [chartRef, chartWidth] = useElementWidth(300);
  const t = taxTrap(d, m);
  if (!t || !trapInView(d, m.adjustedNetIncome)) {
    return (
      <p style={{fontSize:"13.5px",color:TEXT,lineHeight:1.6}}>
        {t ? `Your income is ${fmt(t.ani)}, not near ${fmt(TRAP_START)}, so nothing here applies yet.` : "This works from your salary, which isn't in yet."} Within {fmt(10000)} of it, or heading over it in the next few years, this module works out what it would cost you.
      </p>
    );
  }
  const support = t.nation === "england" ? "Tax-Free Childcare and the 30 funded hours" : "Tax-Free Childcare";
  const kicker = { fontSize:"10.5px", fontWeight:700, color:MUT, letterSpacing:"0.09em", textTransform:"uppercase" };
  const row = { display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:"12px", padding:"12px 0", borderBottom:"1px solid rgba(22,47,36,0.08)" };
  const rowLabel = { fontSize:"13.5px", color:TEXT, fontWeight:600 };
  const rowNote = { fontSize:"12px", color:MUT, marginTop:"2px", lineHeight:1.45 };
  const rowFigure = { fontFamily:SERIF, fontSize:"17px", color:G, fontWeight:700, whiteSpace:"nowrap" };
  const parts = [`${pct(t.rate.tax)} tax`, t.rate.ni > 0 ? `${pct(t.rate.ni)} National Insurance` : null, t.rate.sl > 0 ? `${pct(t.rate.sl)} student loan` : null].filter(Boolean).join(", ");
  const shown = t.over ? t.rate.rate : t.trapRate;

  // Each way back: what it does to take-home a year, with the childcare it
  // brings back counted in. Listed by that £, most first.
  const ways = t.options.map(o => ({ ...o, net: o.childcare - o.takeHome, ...WAY[o.key](o, t, d) })).sort((a, b) => b.net - a.net);

  return (
    <div>
      {t.amount > 0 && (
        <div style={{background:OPPORTUNITY_TILE_BG,border:OPPORTUNITY_TILE_BORDER,boxShadow:OPPORTUNITY_TILE_SHADOW,borderRadius:"14px",padding:"16px 18px",marginBottom:"18px"}}>
          <div style={{fontSize:"10px",fontWeight:800,color:OPPORTUNITY_TILE_LABEL,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Opportunity</div>
          <div style={{fontFamily:SERIF,fontSize:"32px",color:OPPORTUNITY_TILE_FIGURE,fontWeight:700,lineHeight:1.1}}>{fmt(t.amount)}</div>
          <div style={{fontSize:"12px",color:OPPORTUNITY_TILE_LABEL,marginTop:"4px",fontWeight:600}}>{t.childcareLost > 0 && t.fits ? "Tax and childcare support you could keep" : "Tax you could save"} a year, back at {fmt(TRAP_START)}</div>
          <div style={{fontSize:"12px",color:OPPORTUNITY_TILE_BODY,lineHeight:1.5,marginTop:"10px"}}>
            {fmt(t.taxSaving)} less tax and National Insurance{t.childcareLost > 0 && t.fits ? `, and ${fmt(t.childcareLost)} of ${support}` : ""}. It's worth the same as about {fmt(t.payValue)} of pay before tax.
          </div>
        </div>
      )}

      <section style={{marginBottom:"20px"}}>
        <div style={kicker}>{t.over ? "Your marginal tax rate" : `Your marginal tax rate past ${fmt(TRAP_START)}`}</div>
        <div style={{fontFamily:SERIF,fontSize:"40px",color:G,fontWeight:700,lineHeight:1.1,marginTop:"4px"}}>{pct(shown)}</div>
        <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"4px 0 0"}}>
          For every extra £1 you earn{t.over ? "" : ` past ${fmt(TRAP_START)}`}, {pence(shown)} {t.over ? "is" : "would be"} lost to {lostTo(t.rate)}.
        </p>
        <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"4px 0 0"}}>
          {t.over ? `${parts}. ${t.aboveTaper ? `Over ${fmt(TRAP_END)} your tax-free allowance has gone completely.` : `Over ${fmt(TRAP_START)}, £1 of tax-free allowance goes for every £2 earned, until it's gone at ${fmt(TRAP_END)}.`}`
            : `You're ${fmt(t.headroom)} under ${fmt(TRAP_START)}, at ${pct(t.rate.rate)} now. Past it, £1 of tax-free allowance goes for every £2 earned.`}
        </p>
      </section>

      <section style={{...tile,marginBottom:"20px"}}>
        <div style={{fontSize:"13px",fontWeight:600,color:G}}>Marginal tax rate by income</div>
        <p style={{fontSize:"12px",color:MUT,lineHeight:1.45,margin:"2px 0 0"}}>What's lost from each extra £1 at every income, on your setup. The shaded band is the trap, {fmt(TRAP_START)} to {fmt(TRAP_END)}.</p>
        <div ref={chartRef} style={{width:"100%",marginTop:"12px"}}>
          <RateChart points={rateCurve(d, m)} you={t.ani} width={chartWidth}/>
        </div>
      </section>

      <section style={{marginBottom:"20px"}}>
        <div style={kicker}>{t.over ? `What being over ${fmt(TRAP_START)} costs you` : `If your pay passes ${fmt(TRAP_START)}`}</div>
        {t.over && (
          <div style={row}>
            <div>
              <div style={rowLabel}>Tax-free allowance lost</div>
              <div style={rowNote}>{fmt(t.allowance.lost)} of your {fmt(PERSONAL_ALLOWANCE)}, now taxed at {m.scottish ? "45%" : "40%"}.</div>
            </div>
            <div style={rowFigure}>{fmt(t.allowance.tax)}</div>
          </div>
        )}
        {(t.childcareLost > 0 || t.childcareAtRisk > 0) && (
          <div style={row}>
            <div>
              <div style={rowLabel}>Childcare support</div>
              <div style={rowNote}>{support} {t.over ? "stop for the whole year" : "stop as soon as you're over"}, for either parent's income over {fmt(TRAP_START)}.</div>
            </div>
            <div style={rowFigure}>{fmt(t.over ? t.childcareLost : t.childcareAtRisk)}</div>
          </div>
        )}
        {!t.over && (
          <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.55,margin:"12px 0 0"}}>
            A pay rise or bonus that takes you over can go into your pension instead, through salary sacrifice, to keep you under.
          </p>
        )}
      </section>

      {ways.length > 0 && (
        <section style={{marginBottom:"8px"}}>
          <div style={kicker}>Ways back to {fmt(TRAP_START)}</div>
          <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"4px 0 12px"}}>What each costs you{t.childcareLost > 0 ? ", and the childcare support it brings back" : ""}. Listed by what each leaves you with, not a recommendation.</p>
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            {ways.map(w => (
              <div key={w.key} style={tile}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"14px"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{...kicker,color:G}}>{w.bucket}</div>
                    <div style={{fontSize:"14.5px",fontWeight:700,color:TEXT,marginTop:"4px"}}>{w.title}</div>
                    <div style={{fontSize:"12.5px",color:MUT,lineHeight:1.45,marginTop:"4px"}}>{w.note}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,maxWidth:"112px"}}>
                    <div style={{fontSize:"10.5px",color:MUT,lineHeight:1.3}}>{w.costLabel}</div>
                    <div style={{fontFamily:SERIF,fontSize:"20px",color:TEXT,fontWeight:700,marginTop:"2px"}}>{fmt(w.takeHome)}</div>
                  </div>
                </div>
                {w.childcare > 0 && (
                  <div style={{display:"flex",justifyContent:"space-between",gap:"12px",borderTop:"1px solid rgba(22,47,36,0.08)",marginTop:"12px",paddingTop:"10px",fontSize:"12.5px",color:TEXT}}>
                    <span>{fmt(w.childcare)} of childcare support back</span>
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

// Each way's bucket, what it is, what happens, and the label for its cost,
// from its figures (taxTrap.js options). The childcare it brings back is on
// a line of its own under it.
const WAY = {
  pension: (o, t) => ({
    bucket: "Pension", costLabel: "Reduction in take-home",
    title: `${fmt(o.amount)} into your pension`,
    note: `${o.route === "sacrifice" ? "By salary sacrifice" : "From your take-home, with relief at source; the higher-rate relief is claimed through Self Assessment"}. Your pension gets ${fmt(o.pension)}.${o.bonus > 0 ? " Paying in some of your bonus works the same way." : ""}${o.fits ? "" : ` It's more than the ${fmt(t.aaRoom)} of this year's pension allowance left.`}`,
  }),
  sacrifice: o => ({
    bucket: "Other salary sacrifice", costLabel: "Reduction in take-home",
    title: `${fmt(o.amount)} for an electric car or cycle to work`,
    note: `Through your employer, out of your pay before tax: each £1 costs you about ${o.perPound}p. A car adds a small benefit-in-kind tax.`,
  }),
  giftAid: o => ({
    bucket: "Charitable donations", costLabel: "Cost after tax relief",
    title: `${fmt(o.amount)} to charity with Gift Aid`,
    note: `The charity gets ${fmt(o.charity)}. You give ${fmt(Math.round(o.amount * 0.8))} and claim ${fmt(Math.round(o.amount * 0.8) - o.takeHome)} back through Self Assessment.`,
  }),
  fourDay: o => ({
    bucket: "Reduced hours", costLabel: "Reduction in take-home",
    title: "A 4-day week",
    note: `${fmt(o.gross)} less pay before tax, for about ${o.daysOff} more days off a year.${o.under ? "" : " It doesn't bring you under on its own."}`,
  }),
};

// The marginal tax rate at every income from £0 to £130,000, with the
// £100,000 to £125,140 trap shaded and where they are marked.
function RateChart({ points, you, width }) {
  if (!points.length || !width) return null;
  const VW = width, VH = 170, PL = 34, PR = 8, PT = 16, PB = 22;
  const from = points[0].income, to = points[points.length - 1].income;
  const maxRate = Math.max(0.8, ...points.map(p => p.rate));
  const sx = x => PL + (x - from) / (to - from) * (VW - PL - PR);
  const sy = r => PT + (1 - r / maxRate) * (VH - PT - PB);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.income).toFixed(1)},${sy(p.rate).toFixed(1)}`).join(" ");
  const youX = sx(Math.min(to, Math.max(from, you)));
  const label = { fontSize:"10px", fill:MUT, fontFamily:"inherit" };
  return (
    <svg width={VW} height={VH} role="img" aria-label="Marginal tax rate at each income, from £0 to £130,000">
      <rect x={sx(TRAP_START)} y={PT} width={sx(TRAP_END) - sx(TRAP_START)} height={VH - PT - PB} fill={GOLD} opacity="0.12"/>
      {[0.2, 0.4, 0.6].map(r => (
        <g key={r}>
          <line x1={PL} x2={VW - PR} y1={sy(r)} y2={sy(r)} stroke="rgba(22,47,36,0.08)"/>
          <text x={PL - 6} y={sy(r) + 3} textAnchor="end" style={label}>{r * 100}%</text>
        </g>
      ))}
      <path d={path} fill="none" stroke={G} strokeWidth="2.2" strokeLinejoin="round"/>
      <line x1={youX} x2={youX} y1={PT} y2={VH - PB} stroke={G} strokeDasharray="3 3"/>
      <text x={youX} y={PT - 3} textAnchor={youX > VW - 40 ? "end" : "middle"} style={{...label,fill:G,fontWeight:700}}>You</text>
      {[0, 50000, TRAP_START, TRAP_END].map(x => (
        <text key={x} x={sx(x)} y={VH - 6} textAnchor={x === 0 ? "start" : "middle"} style={label}>£{Math.round(x / 1000)}k{x === TRAP_END ? "+" : ""}</text>
      ))}
    </svg>
  );
}
