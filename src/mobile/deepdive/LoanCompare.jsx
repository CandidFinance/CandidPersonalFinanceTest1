import { useState } from "react";
import posthog from "posthog-js";
import { Lock } from "lucide-react";
import { loanComparison } from "../../lib/loanCompare.js";
import { pensionAccessAge } from "../../lib/pension.js";
import { PLANS, startCheckout } from "../../lib/entitlement.js";
import { capField } from "../../lib/onboarding.js";
import { fmt } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import { G, WHITE, MUT, TEXT, SERIF, CDARK, CRITICAL } from "../../design-tokens.js";

// The student loan page's "Where £X does most" (lib/loanCompare.js): the
// lump sum being tried above (`amount`; a stand-in until one's picked),
// valued in each place it could go by the date the loan would end, largest
// first, each on a tile of its own. For subscribers; anyone else sees the
// top tile and the rest blurred, with the way to subscribe. A mortgage not
// yet known is a tile to tap, which asks for it here (its rate and what's
// owed).

const ROWS = {
  loan:         { title: "Paying it into the loan", note: (r, c) => c.cleared ? "Repayments you no longer make, kept in savings." : "Repayments you no longer make, kept in savings. Most of it would otherwise have been written off." },
  savings:      { title: "Savings", note: r => `At ${r.ratePct}%, there whenever you need it.` },
  isa:          { title: "Stocks and Shares ISA", note: r => `Growing ${r.ratePct}% a year, tax-free. Can fall as well as rise.` },
  pension:      { title: "Pension", note: (r, c, d) => `With ${r.reliefPct}% tax relief, growing ${r.ratePct}% a year. A quarter tax-free when drawn, the rest taxed at ${r.laterPct}%. Locked until ${pensionAccessAge(d)}.` },
  mortgage:     { title: "Paying off your mortgage", note: r => `Saves its ${r.ratePct}%. Most lenders allow 10% of the balance a year without a fee.` },
  personalLoan: { title: "Paying off your personal loan", note: r => `Saves its ${r.ratePct}%, while it has left to run.` },
};
// Until a lump sum is picked above: £5,000, or the balance if it's less.
const STAND_IN = 5000;

export default function LoanCompare({ d, m, sl, set, open, picked }) {
  const amount = picked > 0 ? picked : Math.min(STAND_IN, Math.round(m.loanBal));
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const c = loanComparison(d, m, sl, amount);
  if (!c) return null;

  const subscribe = async plan => {
    setBusy(plan); setError(null);
    posthog.capture("checkout_started", { module: "studentLoan", plan, from: "loan_compare" });
    try { await startCheckout(plan, "studentLoan", d.email); }
    catch (e) { setError(e.message); setBusy(null); }
  };
  const tile = { background:WHITE, borderRadius:"12px", padding:"12px 14px", marginTop:"8px", boxShadow:"0 1px 4px rgba(22,47,36,0.12), 0 0 0 1px rgba(22,47,36,0.04)" };
  const valued = c.rows.filter(r => !r.ask);
  const ask = c.rows.find(r => r.ask);

  const row = r => (
    <div key={r.key} style={tile}>
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:"10px"}}>
        <span style={{fontSize:"14px",fontWeight:700,color:TEXT}}>{ROWS[r.key].title}</span>
        <span style={{fontFamily:SERIF,fontSize:"19px",fontWeight:700,color:G,whiteSpace:"nowrap"}}>{fmt(r.value)}</span>
      </div>
      <div style={{fontSize:"12.5px",color:MUT,lineHeight:1.45,marginTop:"2px"}}>
        <span style={{fontWeight:700,color:TEXT}}>{r.certain ? "Certain" : "If growth holds"}.</span> {ROWS[r.key].note(r, c, d)}
      </div>
    </div>
  );

  return (
    <div style={{background:CDARK,borderRadius:"14px",padding:"16px 14px",margin:"0 0 16px"}}>
      <div style={{fontSize:"10px",fontWeight:800,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase"}}>Where {fmt(amount)} does most</div>
      <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"6px 0 4px"}}>
        What {picked > 0 ? "the lump sum above" : "it"} comes to by April {c.byTaxYear}, when your loan would {c.cleared ? "be cleared" : "be written off"}, largest first.
        {!(picked > 0) && " Pick a lump sum above to try another amount."}
      </p>

      {valued.slice(0, open ? valued.length : 1).map(row)}
      {!open && (
        <div style={{position:"relative"}}>
          <div aria-hidden="true" inert="" style={{filter:"blur(6px)",userSelect:"none",pointerEvents:"none"}}>
            {valued.slice(1).map(row)}
          </div>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"10px",textAlign:"center",padding:"0 12px"}}>
            <span style={{width:"40px",height:"40px",borderRadius:"50%",background:WHITE,border:"1.5px solid rgba(22,47,36,0.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><Lock size={18} color={G}/></span>
            <span style={{fontSize:"12.5px",fontWeight:600,color:G,lineHeight:1.45,maxWidth:"250px"}}>Every option side by side, your mortgage included, comes with a subscription</span>
            <div style={{display:"flex",gap:"8px"}}>
              {["monthly", "yearly"].map(p => (
                <button key={p} type="button" disabled={!!busy} onClick={() => subscribe(p)} style={{background:p === "yearly" ? G : WHITE,color:p === "yearly" ? WHITE : G,border:`1.5px solid ${G}`,borderRadius:"100px",padding:"8px 14px",fontSize:"12.5px",fontWeight:700,fontFamily:"inherit",cursor:busy ? "default" : "pointer",opacity:busy && busy !== p ? 0.5 : 1}}>
                  {PLANS[p].price} {PLANS[p].per}
                </button>
              ))}
            </div>
            {error && <span style={{fontSize:"12px",color:CRITICAL}}>{error}</span>}
          </div>
        </div>
      )}

      {/* Open until Done: once a rate's in, the mortgage gets its own row
          above and the ask goes, but the balance may still be to come. */}
      {open && (ask || asking) && set && (
        <div style={tile}>
          {!asking ? (
            <button type="button" onClick={() => setAsking(true)} style={{background:"none",border:"none",padding:0,width:"100%",textAlign:"left",fontFamily:"inherit",cursor:"pointer"}}>
              <span style={{display:"block",fontSize:"14px",fontWeight:700,color:TEXT}}>Paying off a mortgage</span>
              <span style={{display:"block",fontSize:"12.5px",color:G,fontWeight:600,textDecoration:"underline",marginTop:"2px"}}>Add your mortgage to compare it</span>
            </button>
          ) : (
            <div>
              <div style={{fontSize:"13.5px",fontWeight:700,color:TEXT,marginBottom:"8px"}}>Do you have a mortgage?</div>
              <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
                {[["yes", "Yes"], ["no", "No"]].map(([v, label]) => (
                  <button key={v} type="button" aria-pressed={d.slCompareMortgage === v} onClick={() => { set("slCompareMortgage", v); if (v === "no") setAsking(false); }} style={{flex:1,background:d.slCompareMortgage === v ? G : WHITE,color:d.slCompareMortgage === v ? WHITE : TEXT,border:`1.5px solid ${d.slCompareMortgage === v ? G : "rgba(22,47,36,0.15)"}`,borderRadius:"100px",padding:"9px",fontSize:"13.5px",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>{label}</button>
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
          )}
        </div>
      )}

      <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"6px 0 0"}}>
        Before inflation. Not including anything an employer adds to a pension. Guidance, not advice.
      </p>
    </div>
  );
}
