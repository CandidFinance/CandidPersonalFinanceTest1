import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FAST_GROWTH_YEARS } from "../../lib/crossModule.js";
import { SALARY_GROWTH_RATES } from "../../lib/metrics.js";
import { AlertTriangle, PiggyBank, Users, CalendarClock, ChevronRight, ChevronDown } from "lucide-react";
import { LUMP_SUM_ALLOWANCE, LSA_INFLECTION_POT } from "../../lib/pension.js";
import { fmt, fmtBig } from "../../lib/format.js";
import { G, MUT, TEXT, SERIF, SUCCESS } from "../../design-tokens.js";
import MobileWinTile from "../MobileWinTile.jsx";
import { ADVISER_LINK } from "../GuidanceNote.jsx";

// Parts of the Pension screen (MobilePensionDeepDive): the pay-in-more
// figures, the cliff-edge row under the growth chart, and the Looking ahead
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
        <span style={{fontFamily:SERIF,fontSize:`${size}px`,fontWeight:700,color,whiteSpace:"nowrap"}}>{pounds(value)}</span>
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
const AMBER = "#b7791f";
export function CliffEdge({ cliff, onSeeMore }) {
  const [open, setOpen] = useState(false);
  const bars = [
    { label: "In your pension, before the limit", value: cliff.before, color: SUCCESS },
    { label: "In your pension, after the limit", value: cliff.after, color: AMBER },
    { label: "In an ISA", value: cliff.isa, color: G },
  ];
  const scale = Math.max(...bars.map(b => b.value));
  return (
    <div style={{background:"#fdf6ea",border:"1.5px solid rgba(183,121,31,0.35)",borderRadius:"12px",padding:"12px 14px",marginTop:"16px"}}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{width:"100%",display:"flex",alignItems:"center",gap:"10px",background:"none",border:"none",padding:0,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
        <AlertTriangle size={18} color={AMBER} style={{flexShrink:0}}/>
        <span style={{flex:1,fontSize:"14px",fontWeight:700,color:TEXT,lineHeight:1.35}}>
          {cliff.already ? "Your pot is past the tax-free cash limit" : `Your pot could reach the tax-free cash limit around age ${cliff.age}`}
        </span>
        <ChevronDown size={16} color={MUT} style={{flexShrink:0,transform:open ? "rotate(180deg)" : "none",transition:"transform 0.2s"}}/>
      </button>
      {open && <div>
      <p style={{fontSize:"13px",color:TEXT,lineHeight:1.55,margin:"8px 0 0"}}>
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
      <button type="button" onClick={onSeeMore} style={{background:"none",border:"none",padding:"10px 0 0",color:G,fontSize:"13.5px",fontWeight:700,fontFamily:"inherit",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"2px"}}>
        See what it means, and the alternatives<ChevronRight size={15}/>
      </button>
      </div>}
    </div>
  );
}

// The "Looking ahead" tile: each way the pension's path could cost tax
// later, in plain English with its £, then the alternatives, side by side
// and not ranked (no directive advice), each with what it involves.
const pct = r => `${Math.round(r * 100)}%`;
export function LookingAhead({ d, outlook, cliff, number, open, onOpenChange }) {
  const navigate = useNavigate();
  const by = key => outlook.flags.find(f => f.key === key);
  const trap = by("taxTrap"), lumpSum = by("lumpSum"), later = by("retirementRate");
  const headline = lumpSum ? `Your pot could pass the tax-free cash limit around age ${lumpSum.age}`
    : later ? `Your retirement income could be taxed at ${pct(later.laterRate)}`
    : `Your pay could pass £100,000 around age ${trap.age}`;
  const growth = Math.round((SALARY_GROWTH_RATES[d.salaryTrajectory] ?? 0.02) * 100);
  const payGrowth = growth === 2 ? "your pay rising 2% a year" : `your pay rising ${growth}% a year for ${FAST_GROWTH_YEARS} years, then 2%`;
  const section = { fontSize:"10px", fontWeight:800, color:MUT, letterSpacing:"0.08em", textTransform:"uppercase", margin:"0 0 8px" };
  const item = { padding:"12px 0", borderTop:"1px solid rgba(22,47,36,0.08)" };
  const first = { ...item, borderTop:"none", paddingTop:0 };
  const title = { fontSize:"14px", fontWeight:700, color:TEXT, lineHeight:1.35 };
  const body = { fontSize:"13px", color:MUT, lineHeight:1.55, margin:"4px 0 0" };
  const figure = (value, label) => (
    <div style={{display:"flex",alignItems:"baseline",gap:"6px",marginTop:"6px"}}>
      <span style={{fontFamily:SERIF,fontSize:"20px",fontWeight:700,color:AMBER}}>{fmtBig(value)}</span>
      <span style={{fontSize:"12.5px",color:MUT}}>{label}</span>
    </div>
  );
  const link = { background:"none", border:"none", padding:"8px 0 0", color:G, fontSize:"13px", fontWeight:700, fontFamily:"inherit", cursor:"pointer" };

  // What it means: one entry per flag.
  const means = [];
  if (lumpSum) means.push(
    <div key="lsa">
      <div style={title}>Less of your pension comes out tax-free</div>
      <p style={body}>From around age {lumpSum.age}, your pot could be large enough that anything added after that gets no tax-free cash. The most anyone can take tax-free is {fmtBig(LUMP_SUM_ALLOWANCE)}, a quarter of a {fmtBig(LSA_INFLECTION_POT)} pot. Any of your pot above {fmtBig(LSA_INFLECTION_POT)} is taxed in full as income when you take it out, at your rate then, so your pension does less for you as a way to save tax. That leaves about {fmtBig(lumpSum.overPot)} of your pot, in today's money, with no tax-free part.</p>
      {figure(lumpSum.extraTax, "more tax, roughly")}
    </div>);
  if (later) means.push(
    <div key="rate">
      <div style={title}>Taxed at {pct(later.laterRate)} on the way out, relief at {pct(later.nowRate)} on the way in</div>
      <p style={body}>Your pension and State Pension could pay you around {fmt(later.income)} a year in today's money. The part above {fmt(later.laterRate === 0.45 ? 125140 : 50270)} would be taxed at {pct(later.laterRate)}, though it only got {pct(later.nowRate)} relief going in.</p>
      {figure(later.extraTax, "a year more tax")}
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
    <MobileWinTile number={number} title="Looking ahead" tagLabel="Tax later" headline={headline} open={open} onOpenChange={onOpenChange}>
      <div style={section}>What it means</div>
      {means.map((el, i) => <div key={i} style={i ? item : first}>{el}</div>)}
      {alternatives.length > 0 && (<>
        <div style={{...section,marginTop:"16px"}}>Alternatives</div>
        <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          {alternatives.map(a => (
            <div key={a.title} style={{display:"flex",gap:"12px",background:"rgba(22,47,36,0.04)",borderRadius:"12px",padding:"12px 14px"}}>
              <div style={{width:"32px",height:"32px",borderRadius:"9px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <a.icon size={16} color={G}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={title}>{a.title}</div>
                <p style={body}>{a.body}</p>
                {a.action && <button type="button" onClick={() => navigate(a.action.to)} style={link}>{a.action.label} ›</button>}
              </div>
            </div>
          ))}
        </div>
      </>)}
      <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"12px 0 0"}}>
        An estimate, not a forecast: {payGrowth}, paying in at today's rates, investments growing 6% a year, and today's tax rules.
      </p>
    </MobileWinTile>
  );
}
