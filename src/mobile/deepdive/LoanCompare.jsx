import { useState, Fragment } from "react";
import { Lock, ShieldCheck, TrendingUp } from "lucide-react";
import { loanComparison } from "../../lib/loanCompare.js";
import { pensionAccessAge } from "../../lib/pension.js";
import { planEvents } from "../../lib/loanPlan.js";
import SubscribeButtons from "./SubscribeButtons.jsx";
import { PillSlider } from "../PillSlider.jsx";
import { capField } from "../../lib/onboarding.js";
import { fmt } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import MobileTile, { TileRow, ROW, RowText } from "../MobileTile.jsx";
import { G, WHITE, TEXT, SUCCESS, GOLD_TEXT } from "../../design-tokens.js";

// The student loan page's "Where £X does most" (lib/loanCompare.js): the
// lump sum being tried above (`amount`; a stand-in until one's picked),
// valued in each place it could go by the date the loan would end, largest
// first, a row each on the tile (MobileTile.jsx): its name and £, with an icon for how
// sure the figure is (certain, or resting on assumed growth), opening to
// say how it's worked out. For subscribers; anyone else sees the
// top row and the rest blurred, with the way to subscribe. A mortgage not
// yet known is a row to tap, which asks for it here (its rate and what's
// owed). With a repayment plan on the chart (`plan`, its run from
// loanPlan.js runPlan), subscribers switch between it and the lump sum: the
// plan's payments, each valued from the year it's paid.

const ROWS = {
  loan:         { title: "Paying it into the loan", note: (r, c) => c.cleared ? "Repayments you no longer make, kept in savings." : "Repayments you no longer make, kept in savings. Most of it would otherwise have been written off." },
  savings:      { title: "Savings", note: r => `At ${r.ratePct}%, there whenever you need it.` },
  isa:          { title: "Stocks and Shares ISA", note: r => `Growing ${r.ratePct}% a year, tax-free. Can fall as well as rise.` },
  pension:      { title: "Pension", note: (r, c, d) => `With ${r.reliefPct}% tax relief, growing ${r.ratePct}% a year. A quarter tax-free when drawn, the rest taxed at ${r.laterPct}%. Locked until ${pensionAccessAge(d)}.` },
  mortgage:     { title: "Paying off your mortgage", note: r => `Saves its ${r.ratePct}%. Most lenders allow 10% of the balance a year without a fee.` },
  personalLoan: { title: "Paying off your personal loan", note: r => `Saves its ${r.ratePct}%, while it has left to run.` },
};
// How sure each figure is: one icon each, with a key above the tiles.
const SURE = {
  true:  { Icon: ShieldCheck, color: SUCCESS, label: "Certain" },
  false: { Icon: TrendingUp, color: GOLD_TEXT, label: "If growth holds" },
};

// Until a lump sum is picked above: £5,000, or the balance if it's less.
const STAND_IN = 5000;

export default function LoanCompare({ d, m, sl, set, open, picked, plan = null, menu = [] }) {
  const lump = picked > 0 ? picked : Math.min(STAND_IN, Math.round(m.loanBal));
  const [asking, setAsking] = useState(false);
  const [opened, setOpened] = useState(() => new Set());
  const [mode, setMode] = useState("plan");
  const usePlan = open && plan && planEvents(plan.run).length > 0 && mode === "plan";
  const c = loanComparison(d, m, sl, usePlan ? planEvents(plan.run) : lump);
  if (!c) return null;

  const valued = c.rows.filter(r => !r.ask);
  const ask = c.rows.find(r => r.ask);

  // A row per place, its icon (how sure the figure is) in line with its
  // name, opening in place to say how it's worked out.
  const toggle = key => setOpened(o => { const n = new Set(o); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const row = r => {
    const { Icon, color, label } = SURE[r.certain];
    const isOpen = opened.has(r.key);
    return (
      <Fragment key={r.key}>
      <TileRow onClick={() => toggle(r.key)} expanded={isOpen}>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <Icon size={18} color={color} aria-label={label} style={{flexShrink:0}}><title>{label}</title></Icon>
          <div style={{flex:1,minWidth:0}}><RowText label={ROWS[r.key].title} figure={fmt(r.value)}/></div>
        </div>
      </TileRow>
      {/* Outside the row's button, so it isn't read as part of its name. */}
      {isOpen && <div style={{...ROW.note,margin:"-6px 16px 0 26px",paddingBottom:"9px"}}>{ROWS[r.key].note(r, c, d)}</div>}
      </Fragment>
    );
  };
  const key = (
    <div style={{display:"flex",flexWrap:"wrap",gap:"4px 14px",fontSize:"12px",fontWeight:600,marginTop:"6px"}}>
      {[true, false].map(sure => { const { Icon, color, label } = SURE[sure]; return <span key={label} style={{display:"inline-flex",alignItems:"center",gap:"5px"}}><Icon size={13} color={color} aria-hidden="true"/>{label}</span>; })}
    </div>
  );
  const subtitle = (
    <>
      {usePlan
        ? `${plan.name}'s payments, each from the year it's paid, and what they come to by April ${c.byTaxYear}, when your loan would ${c.cleared ? "be cleared" : "be written off"}, largest first.`
        : `What ${picked > 0 ? "the lump sum above" : "it"} comes to by April ${c.byTaxYear}, when your loan would ${c.cleared ? "be cleared" : "be written off"}, largest first.`}
      {!usePlan && !(picked > 0) && " Pick a lump sum above to try another amount."}
      {key}
    </>
  );

  return (
    <MobileTile id="sl-compare" title={`Where ${usePlan ? `${plan.name}'s ${fmt(c.amount)}` : fmt(c.amount)} does most`} subtitle={subtitle} menu={menu}>
      {open && plan && planEvents(plan.run).length > 0 && (
        <TileRow>
          <PillSlider compact label="Compare a lump sum or a plan" value={usePlan ? "plan" : "lump"} onChange={setMode} options={[{ value:"lump", label:"Lump sum" }, { value:"plan", label:plan.name }]}/>
        </TileRow>
      )}

      {valued.slice(0, open ? valued.length : 1).map(row)}
      {!open && (
        // The way to subscribe over the blurred rows, from their top, so it
        // stays clear of the row under them.
        <div style={{position:"relative",minHeight:"124px"}}>
          <div aria-hidden="true" inert="" style={{filter:"blur(6px)",userSelect:"none",pointerEvents:"none"}}>
            {valued.slice(1).map(row)}
          </div>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",gap:"6px",textAlign:"center",padding:"4px 28px 0 12px"}}>
            <span style={{width:"32px",height:"32px",borderRadius:"50%",background:WHITE,border:"1.5px solid rgba(22,47,36,0.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><Lock size={16} color={G}/></span>
            <span style={{fontSize:"12px",fontWeight:600,color:G,lineHeight:1.4,maxWidth:"250px"}}>Every option side by side, your mortgage included, comes with a subscription</span>
            <SubscribeButtons d={d} module="studentLoan" from="loan_compare"/>
          </div>
        </div>
      )}

      {/* Open until Done: once a rate's in, the mortgage gets its own row
          above and the ask goes, but the balance may still be to come. */}
      {open && (ask || asking) && set && (
        !asking ? (
          <TileRow onClick={() => setAsking(true)}>
            <div style={{...ROW.label,fontWeight:600}}>Paying off a mortgage</div>
            <div style={{...ROW.note,color:G,fontWeight:600}}>Add your mortgage to compare it</div>
          </TileRow>
        ) : (
          <TileRow>
            <div>
              <div style={{fontSize:"12px",fontWeight:700,color:TEXT,marginBottom:"8px"}}>Do you have a mortgage?</div>
              <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
                {[["yes", "Yes"], ["no", "No"]].map(([v, label]) => (
                  <button key={v} type="button" aria-pressed={d.slCompareMortgage === v} onClick={() => { set("slCompareMortgage", v); if (v === "no") setAsking(false); }} style={{flex:1,background:d.slCompareMortgage === v ? G : WHITE,color:d.slCompareMortgage === v ? WHITE : TEXT,border:`1.5px solid ${d.slCompareMortgage === v ? G : "rgba(22,47,36,0.15)"}`,borderRadius:"100px",padding:"9px",fontSize:"13px",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>{label}</button>
                ))}
              </div>
              {d.slCompareMortgage === "yes" && (
                <div style={{display:"flex",gap:"8px"}}>
                  <PillMoneyInput label="Its rate" unit="%" value={+d.mortgageRate > 0 ? +d.mortgageRate : null} onChange={v => set("mortgageRate", capField("mortgageRate", v ?? ""))}/>
                  <PillMoneyInput label="Still owed" value={+d.mortgageBalance > 0 ? +d.mortgageBalance : null} onChange={v => set("mortgageBalance", capField("mortgageBalance", v ?? ""))}/>
                </div>
              )}
              {d.slCompareMortgage === "yes" && +d.mortgageRate > 0 && (
                <button type="button" onClick={() => setAsking(false)} style={{background:"none",border:"none",padding:"10px 0 0",color:G,fontSize:"12.5px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>Done</button>
              )}
            </div>
          </TileRow>
        )
      )}

      <TileRow>
        <div style={{...ROW.note,marginTop:0}}>Before inflation. Not including anything an employer adds to a pension. Guidance, not advice.</div>
      </TileRow>
    </MobileTile>
  );
}
