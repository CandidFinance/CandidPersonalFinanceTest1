import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import posthog from "posthog-js";
import { ChevronDown, ChevronRight } from "lucide-react";
import { fmt } from "../lib/format.js";
import { SERIF, SANS, TILE_KICKER } from "../design-tokens.js";
import { BandTrack, TRAP_T, WARN_ZONE, shieldFigure } from "../components/dashboard/TaxShield.jsx";

// Home's £100k tax trap tile, for someone in the trap or within taxTrap.js's
// TRAP_NEAR of it (`income`: progressTracker.js incomePosition). The tile
// itself carries where they are, in Progress's Tax shield colours: pale red
// in the trap, amber within £5,000, light nearer than £10,000. A half-width
// square beside Areas to explore, or the full width when alone (`full`;
// HomeTilePair.jsx). It leads with the answer: the extra tax a year, or the
// room left before the trap. Opened, in place and full width: the answer in
// words, how the trap works, and in it the ways back to £100,000 with what
// each costs in take-home (taxTrap.js options), as figures, not advice.
export const TRAP_ZONES = ["in", "edge", "near"];

// Each way back as what it is, then how (MobileTaxTrapDeepDive.jsx WAY
// names them in full).
const OPTION = {
  pension: o => ["Pension", o.route === "sacrifice" ? "Salary sacrifice" : "Contributions"],
  sacrifice: () => ["Salary sacrifice", "A car or bike scheme"],
  giftAid: () => ["Charitable giving", "Donations with Gift Aid"],
  fourDay: () => ["Reduced hours", "A 4-day week"],
};

// Lucide's shield outline, filled.
const SHIELD = "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z";

export default function TrapTile({ income, full = false, onOpenTrap }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const t = TRAP_T[WARN_ZONE[income.zone] || "light"];
  const { trap, gap, perThousand } = income;
  const inTrap = income.zone === "in";
  const trapBand = income.bands.find(b => b.name === "£100k tax trap");
  // With children, or planning them, the childcare support that stops
  // (taxTrap.js, childcare.js: 0 without either) counts in the headline too,
  // as the £100k tax trap module's £ does (Harvey, 18 Nov 2026). Progress's
  // Tax shield keeps the tax alone, labelled "more tax a year".
  const withChildcare = inTrap && trap?.childcareLost > 0;
  const figure = withChildcare ? fmt(trap.tax + trap.childcareLost) : shieldFigure(income).figure;
  const lines = inTrap
    ? trap ? [withChildcare ? "tax and childcare a year" : "extra tax a year", `${fmt(trap.over)} over £100k`] : [shieldFigure(income).label]
    : gap === 0 ? ["at the trap's edge", `Then ${trapBand.rateLabel} on each £1`] : ["before the trap", `Then ${trapBand.rateLabel} on each £1`];

  const toggle = () => {
    if (!open) posthog.capture("home_trap_tile_opened", { zone: income.zone });
    setOpen(o => !o);
  };
  // Opened, a tap anywhere but the module link closes it again.
  const onTap = e => { if (!e.target.closest("button:not([data-trap-toggle])")) toggle(); };
  const openTrap = () => {
    posthog.capture("home_trap_tile_module_opened", { above_taper: !!trap?.aboveTaper });
    onOpenTrap();
  };
  const text = { fontSize:"13px", color:t.body, lineHeight:1.5, margin:0 };
  const b = { fontWeight:700, color:t.figure };
  const sub = { ...TILE_KICKER, color:t.label, margin:"16px 0 6px" };

  return (
    <motion.section layout={!reduce} transition={{ duration: 0.25 }} aria-label="£100k tax trap" onClick={open ? onTap : undefined}
      style={{position:"relative",overflow:"hidden",background:t.bg,border:t.border,boxShadow:t.shadow,borderRadius:"14px",boxSizing:"border-box",padding:"14px 16px 16px",
        width:open || full ? "100%" : "calc(50% - 6px)",...(!open && !full && { aspectRatio:"1" }),display:"flex",flexDirection:"column",cursor:"pointer"}}>
      {/* The Tax shield's shield, large and faint behind the text: filling
          the square, or at the top right when wide. */}
      <svg aria-hidden="true" viewBox="3.5 1.5 17 21" preserveAspectRatio="xMaxYMin meet"
        style={{position:"absolute",pointerEvents:"none",...(open || full
          ? { top:"10px", right:"14px", height:"128px", width:"auto" }
          : { top:"12%", right:"-4%", width:"72%", height:"auto" })}}>
        <path d={SHIELD} fill={t.figure} opacity="0.08"/>
      </svg>
      <button type="button" data-trap-toggle onClick={open ? undefined : toggle} aria-expanded={open}
        style={{position:"relative",display:"flex",flexDirection:"column",justifyContent:"space-between",gap:"10px",flex:open ? "none" : 1,width:"100%",background:"none",border:"none",padding:0,cursor:"pointer",fontFamily:"inherit",textAlign:"left",color:"inherit"}}>
        <span style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",width:"100%"}}>
          <span style={{...TILE_KICKER,color:t.label}}>£100k tax trap</span>
          <ChevronDown size={16} color={t.label} aria-hidden="true" style={{transform:open ? "rotate(180deg)" : "none",transition:"transform 0.2s",flexShrink:0}}/>
        </span>
        <span style={{display:"flex",flexDirection:full || open ? "row" : "column",alignItems:full || open ? "baseline" : "flex-start",flexWrap:"wrap",gap:full || open ? "4px 10px" : "4px"}}>
          <span style={{fontFamily:SERIF,fontSize:"30px",fontWeight:700,color:t.figure,lineHeight:1,letterSpacing:"-0.01em"}}>{figure}</span>
          <span style={{display:"flex",flexDirection:"column",fontFamily:SANS}}>
            <span style={{fontSize:"12px",fontWeight:700,color:t.figure}}>{lines[0]}</span>
            {lines[1] && <span style={{fontSize:"12px",color:t.body}}>{lines[1]}</span>}
          </span>
        </span>
      </button>

      {open && (
        <div style={{position:"relative",marginTop:"12px",cursor:"auto"}}>
          {/* The answer. */}
          <p style={text}>
            {inTrap && trap ? <>
              Your adjusted net income is <span style={b}>{fmt(income.income)}</span>. Nothing in your figures brings it back under £100,000, so {trap.aboveTaper
                ? <>all <span style={b}>{fmt(trap.allowanceLost)}</span> of your Personal Allowance is withdrawn</>
                : <><span style={b}>{fmt(trap.over)}</span> of it withdraws <span style={b}>{fmt(trap.allowanceLost)}</span> of your Personal Allowance</>}: <span style={b}>{fmt(trap.tax)}</span> more tax a year.
              {trap.childcareLost > 0 && <> <span style={b}>{fmt(trap.childcareLost)}</span> a year of childcare support stops too.</>}
            </> : inTrap ? <>
              Your adjusted net income is <span style={b}>{fmt(income.income)}</span>, {fmt(income.income - 100000)} over £100,000, where the Personal Allowance is withdrawn.
            </> : <>
              Your adjusted net income is <span style={b}>{fmt(income.income)}</span>{gap > 0 ? <>, <span style={b}>{fmt(gap)}</span> under £100,000</> : ", right at £100,000"}. Pay past that is taxed at {trapBand.rateLabel} until {fmt(trapBand.to)}.
            </>}
          </p>

          {/* How it works. */}
          <h3 style={sub}>How the trap works</h3>
          <p style={text}>
            Over £100,000, £1 of Personal Allowance goes for every £2 more, so each £1,000 more costs {fmt(perThousand.trap)} in income tax rather than {fmt(perThousand.now)}.
          </p>
          <BandTrack income={income} t={t}/>
          <p style={{...text,fontSize:"12px",marginTop:"10px"}}>
            Adjusted net income, the gold marker, is taxable income less pension contributions and Gift Aid.{income.scottish ? " Scottish rates on pay." : ""}
          </p>

          {/* The ways back, with what each costs. */}
          {inTrap && trap?.options?.length > 0 ? <>
            <h3 style={sub}>What brings it back to £100,000</h3>
            <div style={{display:"flex",flexDirection:"column"}}>
              {trap.options.map((o, i) => (
                <div key={o.key} style={{display:"flex",flexDirection:"column",padding:"10px 0",borderTop:i ? `1px solid ${t.rule}` : "none"}}>
                  {/* Two lines, each matched across: what and the £ in bold,
                      then how and what the £ is. */}
                  <span style={{display:"flex",justifyContent:"space-between",gap:"12px",fontSize:"13px",fontWeight:700,color:t.figure,lineHeight:1.35}}>
                    <span>{(OPTION[o.key]?.(o) || [o.key])[0]}</span><span>{fmt(o.takeHome)}</span>
                  </span>
                  <span style={{display:"flex",justifyContent:"space-between",gap:"12px",fontSize:"11px",color:t.body,lineHeight:1.35}}>
                    <span>{(OPTION[o.key]?.(o) || [])[1]}</span><span style={{whiteSpace:"nowrap"}}>{o.key === "giftAid" ? "cost to you" : "less take-home"}</span>
                  </span>
                </div>
              ))}
            </div>
          </> : !inTrap && (
            <p style={{...text,marginTop:"12px"}}>Pension contributions and Gift Aid lower adjusted net income.</p>
          )}

          <button type="button" onClick={openTrap}
            style={{marginTop:"12px",background:"none",border:"none",padding:0,fontSize:"13px",fontWeight:700,color:t.figure,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:"2px"}}>
            Open £100k tax trap<ChevronRight size={14} aria-hidden="true"/>
          </button>
        </div>
      )}
    </motion.section>
  );
}
