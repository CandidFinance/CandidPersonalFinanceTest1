import { useState, Fragment } from "react";
import { Lock, TrendingUp } from "lucide-react";
import { loanComparison } from "../../lib/loanCompare.js";
import { pensionAccessAge } from "../../lib/pension.js";
import { planEvents } from "../../lib/loanPlan.js";
import SubscribeButtons from "./SubscribeButtons.jsx";
import { PillSlider } from "../PillSlider.jsx";
import { capField } from "../../lib/onboarding.js";
import { fmt } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import MobileTile, { TileRow, ROW, RowText } from "../MobileTile.jsx";
import { G, WHITE, TEXT, GOLD_TEXT } from "../../design-tokens.js";

// The student loan page's "Where £X does most" (lib/loanCompare.js): the
// lump sum picked in Model your loan (`amount`; the whole balance until
// one's picked), valued in each place it could go by the date the loan
// would end, largest first, a row each on the tile (MobileTile.jsx): its
// name and £, an icon after the name when it rests on assumed growth,
// opening to say how it's worked out. For subscribers; anyone else sees the
// top row and the rest blurred, with the way to subscribe. A mortgage not
// yet known is a row to tap, which asks for it here (its rate and what's
// owed). With a repayment plan on the chart (`plan`, its run from
// loanPlan.js runPlan), subscribers switch between it and the lump sum: the
// plan's payments, each valued from the year it's paid. `how`: the page's
// [menu item, pop-out] for its explanation (useHow).

const ROWS = {
  loan:         { title: "Paying it into the loan", note: (r, c) => c.cleared ? "Repayments you no longer make, kept in savings." : "Repayments you no longer make, kept in savings. Most of it would otherwise have been written off." },
  savings:      { title: "Savings", note: r => `At ${r.ratePct}%, there whenever you need it.` },
  isa:          { title: "Stocks and Shares ISA", note: r => `Growing ${r.ratePct}% a year, tax-free. Can fall as well as rise.${r.over > 0 ? ` Up to £20,000 a tax year fits, so the other ${fmt(r.over)} stays in savings at ${r.cashPct}%.` : ""}` },
  pension:      { title: "Pension", note: (r, c, d) => `${r.over > 0 && r.over >= c.amount ? "" : `With ${r.reliefPct}% tax relief, growing ${r.ratePct}% a year. A quarter tax-free when drawn, the rest taxed at ${r.laterPct}%. Locked until ${pensionAccessAge(d)}. Not counting anything an employer adds.`}${r.over > 0 ? ` ${fmt(r.over)} is over the most that gets tax relief (your annual allowance left, and no more than your earnings), so it stays in savings at ${r.cashPct}%.` : ""}`.trim() },
  mortgage:     { title: "Paying off your mortgage", note: r => `Saves its ${r.ratePct}%. Most lenders allow 10% of the balance a year without a fee.` },
  personalLoan: { title: "Paying off your personal loan", note: r => `Saves its ${r.ratePct}%, while it has left to run.` },
};
// A figure resting on assumed growth: an icon after its name, explained
// in the line under the rows. Certain figures carry none.
const GROWTH = "If growth holds";

// What the loan row's £ is made of, under its name, so £18,500 coming to
// £24,461 reads: the balance and the interest on it you'd no longer repay,
// kept in savings to the end date. Heading for write-off, the repayments
// freed come to less than what's paid in, so just those.
// Paid over what's owed, that part stays in savings too, and is said.
function loanMadeOf(r, c) {
  const over = r.over > 0 ? ` + ${fmt(r.over)} paid over what's owed` : "";
  return r.interest > 0
    ? `${fmt(r.principal)} owed + ${fmt(r.interest)} interest you'd no longer repay${over}, kept in savings to April ${c.byTaxYear}`
    : `${fmt(r.freedPaid)} of repayments you'd no longer make${over}, kept in savings to April ${c.byTaxYear}`;
}

// Where each place's figure would be, said after its £ on the chain's closed
// square (LoanChain): "£35,072 in your pension by April 2031".
// Each says what the £ is, not what's paid: the loan's is the repayments no
// longer made, kept (ROWS.loan).
const WHERE = {
  loan: "from repayments you no longer make", savings: "in savings", isa: "in a Stocks and Shares ISA",
  pension: "in your pension", mortgage: "from paying off your mortgage", personalLoan: "from paying off your personal loan",
};
// The closed square's figures: the amount, and the place it does most, as the
// tile's first row gives them, on the basis it opens on: a subscriber's plan
// when one's shown (`plan`, as the tile's), otherwise the lump sum.
export function loanCompareSummary(d, m, sl, picked, plan = null) {
  const events = plan ? planEvents(plan.run) : [];
  const c = loanComparison(d, m, sl, events.length > 0 ? events : picked > 0 ? picked : Math.round(m.loanBal));
  const top = c?.rows.find(r => !r.ask);
  if (!top) return null;
  // A pension's figure is after the tax on drawing it, and can't be reached
  // until the access age: said on the square, not only in the row's note.
  const line = top.key === "pension"
    ? `in your pension by April ${c.byTaxYear}, after tax, locked until ${pensionAccessAge(d)}`
    : `${WHERE[top.key] ?? ROWS[top.key]?.title} by April ${c.byTaxYear}`;
  const title = events.length > 0 ? `Where ${plan.name}'s ${fmt(c.amount)} does most` : `Where ${fmt(c.amount)} does most`;
  return { title, headline: fmt(top.value), line };
}

// `onToggle`, `style`: opened in the chain (LoanChain), its title row closes it.
export default function LoanCompare({ d, m, sl, set, open, picked, plan = null, menu = [], how = null, onToggle = null, style }) {
  // Until a lump sum is picked above: the whole balance.
  const lump = picked > 0 ? picked : Math.round(m.loanBal);
  const [asking, setAsking] = useState(false);
  const [opened, setOpened] = useState(() => new Set());
  const [mode, setMode] = useState("plan");
  // Minimised from its title row, as the tiles above it; open to start.
  const [shownHere, setShown] = useState(true);
  const shown = onToggle ? true : shownHere;
  const usePlan = open && plan && planEvents(plan.run).length > 0 && mode === "plan";
  const c = loanComparison(d, m, sl, usePlan ? planEvents(plan.run) : lump);
  if (!c) return null;

  const valued = c.rows.filter(r => !r.ask);
  const ask = c.rows.find(r => r.ask);

  // A row per place, a growth icon after the name when the figure rests on
  // assumed growth (none when it's certain), opening in place to say how
  // it's worked out.
  const toggle = key => setOpened(o => { const n = new Set(o); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const row = r => {
    const isOpen = opened.has(r.key);
    const growth = !r.certain && <TrendingUp size={15} color={GOLD_TEXT} aria-label={GROWTH} style={{flexShrink:0}}><title>{GROWTH}</title></TrendingUp>;
    return (
      <Fragment key={r.key}>
      <TileRow onClick={() => toggle(r.key)} expanded={isOpen}>
        <RowText label={ROWS[r.key].title} tool={growth} figure={fmt(r.value)} note={r.key === "loan" && !usePlan ? loanMadeOf(r, c) : null}/>
      </TileRow>
      {/* Outside the row's button, so it isn't read as part of its name. */}
      {isOpen && <div style={{...ROW.note,margin:"-6px 16px 0 0",paddingBottom:"9px"}}>{ROWS[r.key].note(r, c, d)}</div>}
      </Fragment>
    );
  };
  const subtitle = usePlan
    ? `${plan.name}'s payments, each valued from the year it's paid, in April ${c.byTaxYear}, when your loan would ${c.cleared ? "be cleared" : "be written off"}.`
    : `Valued in April ${c.byTaxYear}, when your loan would ${c.cleared ? "be cleared" : "be written off"}.`;

  return (
    <MobileTile id="sl-compare" title={`Where ${usePlan ? `${plan.name}'s ${fmt(c.amount)}` : fmt(c.amount)} does most`} subtitle={shown ? subtitle : null} menu={[how?.[0], ...menu]}
      open={shown} onToggle={onToggle ?? (() => setShown(s => !s))} style={style}>
      {how?.[1]}
      {shown && <>
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
            <div style={{...ROW.label,fontWeight:600,color:G}}>Add your mortgage to compare it</div>
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
        <div style={{...ROW.note,marginTop:0}}>
          {/* Explains the icon only where a row that can be read carries it. */}
          {valued.slice(0, open ? valued.length : 1).some(r => !r.certain) && <>
            <TrendingUp size={13} color={GOLD_TEXT} aria-hidden="true" style={{verticalAlign:"-2px",marginRight:"5px"}}/>
            Rests on growth, so it could come out higher or lower.{" "}
          </>}
          All figures before inflation.
        </div>
      </TileRow>
      </>}
    </MobileTile>
  );
}
