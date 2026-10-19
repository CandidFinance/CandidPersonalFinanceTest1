import { useState } from "react";
import { fmt } from "../lib/format.js";
import { calcStudentLoanScenario } from "../lib/studentLoan.js";
import { overpaymentSources, takeFromSources, todayIso } from "../lib/loanBalance.js";
import { premiumBondsRow } from "../lib/savingsRates.js";
import { bankChange } from "../lib/moduleStatus.js";
import PillMoneyInput from "./PillMoneyInput.jsx";
import { G, WHITE, MUT, TEXT, CDARK } from "../design-tokens.js";

// Updating the student loan balance, the same on the module's page and in
// Edit inputs: the new figure, then, if it's lower, where the difference
// came from (their savings accounts, Premium Bonds or Other; no ISAs),
// taken from the lowest rate first (loanBalance.js takeFromSources). The new
// figure is the starting point the monthly updates run from, and the
// overpayment's yearly interest saving, at the loan's rate, counts towards
// "Gained from your changes" on Home (moduleStatus.js bankChange).
// `initial`: the figure to start from (the page suggests today's balance
// less any lump sum being modelled).
export default function LoanBalanceEditor({ d, m, set, savingsRates, initial = null, onClose }) {
  const [input, setInput] = useState(initial ?? Math.round(m.loanBal));
  const [step, setStep] = useState(1);
  const [picks, setPicks] = useState([]);
  const pbRow = premiumBondsRow(savingsRates);
  const pbRate = pbRow?.rate_aer != null ? +pbRow.rate_aer : null;
  const sources = overpaymentSources(d, pbRate);
  const balance = Math.max(0, Math.round(+input || 0));
  const delta = Math.max(0, Math.round(m.loanBal) - balance);
  const toggle = key => setPicks(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);
  const save = () => {
    const value = String(balance);
    if (delta > 0) {
      Object.entries(takeFromSources(d, delta, picks, pbRate)).forEach(([k, v]) => set(k, v));
      const perYear = delta * calcStudentLoanScenario(d, m).lifeRatePct / 100;
      if (perYear > 0) set("moduleBaselines", bankChange(d, "studentLoan", perYear));
    }
    set("loanBalance", value);
    set("loanBalanceSet", value);
    set("loanBalanceAsOf", todayIso());
    onClose();
  };
  const ghost = { flex:1, background:"transparent", border:"1.3px solid rgba(22,47,36,0.2)", borderRadius:"100px", padding:"10px", fontSize:"13px", fontWeight:600, color:G, cursor:"pointer", fontFamily:"inherit" };
  const solid = off => ({ flex:1, background:off ? "rgba(22,47,36,0.25)" : G, border:"none", borderRadius:"100px", padding:"10px", fontSize:"13px", fontWeight:600, color:WHITE, cursor:off ? "not-allowed" : "pointer", fontFamily:"inherit" });
  return (
    <div style={{background:CDARK,borderRadius:"10px",padding:"12px 14px",marginBottom:"12px"}}>
      <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"8px"}}>Update your balance</div>
      {step === 1 ? (
        <>
          <PillMoneyInput label="New balance" value={input} onChange={v => setInput(v ?? 0)}/>
          <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginTop:"10px",marginBottom:0}}>
            Your online student loan account shows it. From here, Candid adds the interest and takes off your repayment each payday.
          </p>
        </>
      ) : (
        <>
          <div style={{fontSize:"13.5px",fontWeight:700,color:TEXT,lineHeight:1.4}}>Where did the {fmt(delta)} come from?</div>
          <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"4px 0 10px"}}>Pick any. It comes off the lowest-rate one first, so it isn't counted twice.</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
            {sources.map(s => {
              const on = picks.includes(s.key);
              return (
                <button key={s.key} type="button" onClick={() => toggle(s.key)} aria-pressed={on} style={{
                  background:on ? G : WHITE, color:on ? WHITE : TEXT, border:`1.5px solid ${on ? G : "rgba(22,47,36,0.18)"}`, borderRadius:"100px",
                  padding:"8px 14px", fontSize:"13px", fontWeight:600, fontFamily:"inherit", cursor:"pointer",
                }}>
                  {s.label}{s.key !== "other" ? ` · ${fmt(s.amount)}` : ""}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div style={{display:"flex",gap:"8px",marginTop:"12px"}}>
        <button type="button" onClick={step === 2 ? () => setStep(1) : onClose} style={ghost}>{step === 2 ? "Back" : "Cancel"}</button>
        {step === 1 && delta > 0
          ? <button type="button" onClick={() => setStep(2)} style={solid(false)}>Next</button>
          : <button type="button" onClick={save} disabled={step === 2 && !picks.length} style={solid(step === 2 && !picks.length)}>Save</button>}
      </div>
    </div>
  );
}
