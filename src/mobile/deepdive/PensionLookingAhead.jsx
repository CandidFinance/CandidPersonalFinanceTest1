import { useState } from "react";
import { GROWTH_NOMINAL_PCT } from "../../lib/growth.js";
import { useNavigate } from "react-router-dom";
import { FAST_GROWTH_YEARS } from "../../lib/crossModule.js";
import { salaryGrowthOf, payPathOf } from "../../lib/metrics.js";
import { taxYearFor } from "../../lib/taxYear.js";
import { AlertTriangle, PiggyBank, Users, CalendarClock } from "lucide-react";
import { LUMP_SUM_ALLOWANCE, LSA_INFLECTION_POT } from "../../lib/pension.js";
import { fmt, fmtBig } from "../../lib/format.js";
import { G, MUT, TEXT, SERIF, SUCCESS, ERROR_TEXT, SANS } from "../../design-tokens.js";
import MobileTile, { TileRow } from "../MobileTile.jsx";
import { ADVISER_LINK } from "../GuidanceNote.jsx";

// Parts of the Pension screen (MobilePensionDeepDive): the pay-in-more
// figures, the cliff-edge rows in the growth tile, and the Looking ahead
// tile.

// Paying in more, to retirement: the take-home pay it costs (the salary
// paid in, less the tax relief that tops it up) against what it adds to the
// pot. In today's money at today's salary (calcPensionGrowthTrajectory
// extraSalaryCost, extraGain); on top of what's paid in already.
export const EXTRA_COLOR = "#8a4fae";
export function PayInMore({ traj, tr }) {
  if (!(traj.extraSalaryCost > 0)) return (
    <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"10px 0 0"}}>Pick an amount to see it added to the bars above, and what it would cost you.</p>
  );
  const foregone = Math.round(traj.extraSalaryCost * (1 - tr));
  const figure = (label, value, color) => (
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontFamily:SERIF,fontSize:"24px",fontWeight:700,color,lineHeight:1.1}}>{fmtBig(value)}</div>
      <div style={{fontSize:"12px",color:MUT,marginTop:"4px",lineHeight:1.35}}>{label}</div>
    </div>
  );
  return (
    <div style={{marginTop:"12px"}}>
      <div style={{fontSize:"11px",fontWeight:700,color:TEXT,marginBottom:"8px"}}>To retirement, on top of what you pay in now</div>
      <div style={{display:"flex",gap:"16px"}}>
        {figure("Post-tax salary foregone", foregone, TEXT)}
        {figure("Additional pension value", traj.extraGain, EXTRA_COLOR)}
      </div>
    </div>
  );
}

// A labelled £ figure over a bar, the bars in a group sharing one scale.
function AmountBar({ label, value, color, scale, size = 17, pounds = fmt }) {
  return (
    <div style={{marginTop:"10px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:"10px"}}>
        <span style={{fontSize:"12.5px",color:TEXT}}>{label}</span>
        <span style={{fontFamily:SANS,fontSize:`${size}px`,fontWeight:700,color,whiteSpace:"nowrap"}}>{pounds(value)}</span>
      </div>
      <div style={{height:"8px",borderRadius:"100px",background:"rgba(22,47,36,0.07)",marginTop:"4px",overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(value / scale) * 100}%`,background:color,borderRadius:"100px",transition:"width 0.3s ease"}}/>
      </div>
    </div>
  );
}

// The cliff edge: the pot passing the tax-free cash limit, with what £100
// paid in becomes before and after it, against an ISA (crossModule.js
// cliffEdge). Leads on to Looking ahead for what it means and the options.
// In red, not amber: it's the most serious flag on the screen, and amber
// was lost against the cream. Amber stays for Looking ahead's figures.
const AMBER = "#b7791f";
export function CliffEdge({ cliff, onSeeMore }) {
  const [open, setOpen] = useState(false);
  const bars = [
    { label: "In your pension, before the limit", value: cliff.before, color: SUCCESS },
    { label: "In your pension, after the limit", value: cliff.after, color: ERROR_TEXT },
    { label: "In an ISA", value: cliff.isa, color: G },
  ];
  const scale = Math.max(...bars.map(b => b.value));
  return (
    <>
      <TileRow onClick={() => setOpen(o => !o)} expanded={open}>
        <span style={{display:"flex",alignItems:"flex-start",gap:"8px"}}>
          <AlertTriangle size={18} color={ERROR_TEXT} aria-hidden="true" style={{flexShrink:0,marginTop:"1px"}}/>
          <span style={{fontSize:"14px",fontWeight:600,color:TEXT,lineHeight:1.4}}>
            {cliff.already ? "Your pot is past the tax-free cash limit" : `Your pot could reach the tax-free cash limit around age ${cliff.age}`}
          </span>
        </span>
      </TileRow>
      {open && (
        <TileRow>
          <p style={{fontSize:"13px",color:TEXT,lineHeight:1.55,margin:0}}>
            25% of a pension can be taken tax-free, but only up to {fmtBig(LUMP_SUM_ALLOWANCE)}, and that limit doesn't rise. Once your pot passes {fmtBig(LSA_INFLECTION_POT)}, everything added after that is taxed when you take it out.
          </p>
          <div style={{fontSize:"12.5px",fontWeight:700,color:TEXT,margin:"14px 0 0"}}>£100 of take-home pay, by the time you spend it</div>
          {bars.map(b => <AmountBar key={b.label} label={b.label} value={b.value} color={b.color} scale={scale} size={16} pounds={v => `£${v}`}/>)}
          <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>
            £100 paid in becomes £{cliff.paidIn} with tax relief at {pct(cliff.nowRate)}, then taxed at {pct(cliff.laterRate)} in retirement. Growth is the same in each, so it's left out.
          </p>
          <p style={{fontSize:"13px",color:TEXT,lineHeight:1.55,margin:"12px 0 0"}}>
            This is a complex position, and people in it often get help from a regulated adviser. <a href={ADVISER_LINK.href} target="_blank" rel="noopener noreferrer" style={{color:G,fontWeight:700}}>{ADVISER_LINK.label}</a>
          </p>
        </TileRow>
      )}
      {open && (
        <TileRow onClick={onSeeMore}>
          <span style={{fontSize:"14px",fontWeight:600,color:G}}>What it means, and the alternatives</span>
        </TileRow>
      )}
    </>
  );
}

// The "Looking ahead" tile: each way the pension's path could cost tax
// later, in plain English with its £, then the alternatives, side by side
// and not ranked (no directive advice), each with what it involves.
const pct = r => `${Math.round(r * 100)}%`;
export function LookingAhead({ d, outlook, cliff, menu }) {
  const navigate = useNavigate();
  const by = key => outlook.flags.find(f => f.key === key);
  const trap = by("taxTrap"), lumpSum = by("lumpSum"), later = by("retirementRate");
  const headline = lumpSum ? `Your pot could pass the tax-free cash limit around age ${lumpSum.age}`
    : later ? `Your retirement income could be taxed at ${pct(later.laterRate)}`
    : `Your pay could pass £100,000 around age ${trap.age}`;
  const growth = Math.round(salaryGrowthOf(d) * 1000) / 10;
  const payGrowth = payPathOf(d, +d.salary || 0, taxYearFor(d)) ? "your pay as you've set it year by year, then rising 2% a year"
    : growth === 2 ? "your pay rising 2% a year" : `your pay rising ${growth}% a year for ${FAST_GROWTH_YEARS} years, then 2%`;
  const section = { fontSize:"12.5px", fontWeight:600, color:MUT, lineHeight:1.4, margin:"0 0 6px" };
  const title = { fontSize:"14px", fontWeight:700, color:TEXT, lineHeight:1.35 };
  const body = { fontSize:"13px", color:MUT, lineHeight:1.55, margin:"4px 0 0" };
  const figure = (value, label) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:"12px",marginTop:"8px"}}>
      <span style={{fontSize:"13px",color:TEXT}}>{label}</span>
      <span style={{fontFamily:SANS,fontSize:"20px",fontWeight:700,color:AMBER,whiteSpace:"nowrap"}}>{fmtBig(value)}</span>
    </div>
  );

  // What it means: one entry per flag.
  const means = [];
  if (lumpSum) means.push(
    <div key="lsa">
      <div style={title}>Less of your pension comes out tax-free</div>
      <p style={body}>From around age {lumpSum.age}, your pot could be large enough that anything added after that gets no tax-free cash. The most anyone can take tax-free is {fmtBig(LUMP_SUM_ALLOWANCE)}, a quarter of a {fmtBig(LSA_INFLECTION_POT)} pot. Any of your pot above {fmtBig(LSA_INFLECTION_POT)} is taxed in full as income when you take it out, at your rate then, so your pension does less for you as a way to save tax. That leaves about {fmtBig(lumpSum.overPot)} of your pot, in today's money, with no tax-free part.</p>
      {figure(lumpSum.extraTax, "More tax, roughly")}
    </div>);
  if (later) means.push(
    <div key="rate">
      <div style={title}>Taxed at {pct(later.laterRate)} on the way out, relief at {pct(later.nowRate)} on the way in</div>
      <p style={body}>Your pension and State Pension could pay you around {fmt(later.income)} a year in today's money. The part above {fmt(later.laterRate === 0.45 ? 125140 : 50270)} would be taxed at {pct(later.laterRate)}, though it only got {pct(later.nowRate)} relief going in.</p>
      {figure(later.extraTax, "More tax a year")}
    </div>);
  if (trap) means.push(
    <div key="trap">
      <div style={title}>Your pay could pass £100,000 around age {trap.age}</div>
      <p style={body}>Above £100,000 your tax-free Personal Allowance is taken away, £1 for every £2 you earn, so the next £25,140 is taxed at 60%. That limit doesn't rise either. Paying more into your pension lowers the income it's measured on.</p>
    </div>);

  // The alternatives, for the pot or the income being taxed later.
  const alternatives = (lumpSum || later) ? [
    { icon: PiggyBank, title: "An ISA instead", body: cliff
        ? `No tax going in or coming out, and no limit on what you take out tax-free. £100 stays £100, ${cliff.after < 100 ? `against £${cliff.after} paid into the pension past the limit` : "the same as the pension past the limit, but you can take it out at any time"}.`
        : "No tax relief going in, but no tax coming out, and no limit on what you take out tax-free.",
      action: { label: "See Investments", to: "/app/module/investments" } },
    { icon: Users, title: "A partner's pension", body: "If you have a husband, wife or civil partner with a smaller pension, money in theirs uses their own tax-free cash and their own tax bands, so less of it may be taxed, or taxed at a lower rate." },
    { icon: CalendarClock, title: "When you draw it", body: "The tax-free limit is the same however you take it. What can be planned is the rest: drawing more in years when your other income is low, such as before your State Pension starts, keeps more of it in the 20% band." },
  ] : [];

  return (
    <MobileTile id="looking-ahead" title="Looking ahead" menu={menu}>
      <TileRow first style={{paddingTop:0}}><div style={{fontSize:"14px",color:TEXT,lineHeight:1.4}}>{headline}</div></TileRow>
      {means.map((el, i) => (
        <TileRow key={i}>{i === 0 && <div style={section}>What it means</div>}{el}</TileRow>
      ))}
      {alternatives.map((a, i) => {
        const content = (
          <span style={{display:"flex",gap:"12px"}}>
            <a.icon size={18} color={G} aria-hidden="true" style={{flexShrink:0,marginTop:"1px"}}/>
            <span style={{display:"block",flex:1,minWidth:0}}>
              <span style={{...title,display:"block"}}>{a.title}</span>
              <span style={{...body,display:"block"}}>{a.body}</span>
              {a.action && <span style={{display:"block",fontSize:"13px",fontWeight:700,color:G,marginTop:"6px"}}>{a.action.label}</span>}
            </span>
          </span>
        );
        return (
          <div key={a.title}>
            {i === 0 && <TileRow><div style={{...section,margin:0}}>Alternatives</div></TileRow>}
            {a.action ? <TileRow onClick={() => navigate(a.action.to)}>{content}</TileRow> : <TileRow align>{content}</TileRow>}
          </div>
        );
      })}
      <TileRow>
        <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:0}}>
          An estimate, not a forecast: {payGrowth}, paying in at today's rates, investments growing {GROWTH_NOMINAL_PCT}% a year, and today's tax rules.
        </p>
      </TileRow>
    </MobileTile>
  );
}
