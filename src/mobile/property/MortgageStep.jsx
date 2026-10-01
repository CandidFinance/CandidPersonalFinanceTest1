import { useState } from "react";
import { MUT, TEXT, SERIF, SC, WHITE } from "../../CandidApp.jsx";
import { borrowingInputs, calcBorrowingCheck } from "../../lib/borrowing.js";
import { mortgageInputs, mortgageSummary, FIXED_PERIOD_OPTIONS, STRESS_REMORTGAGE_UPLIFT } from "../../lib/mortgage.js";
import { fmt } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import InfoButton from "../InfoButton.jsx";
import PillCell from "./PillCell.jsx";
import PillSelect from "./PillSelect.jsx";

// Property step 2: the repayment mortgage on the loan from step 1 (logic in
// src/lib/mortgage.js). Only reachable once step 1 is complete.

const FIXED_OPTIONS = FIXED_PERIOD_OPTIONS.map(y => ({ value:String(y), label:`${y} years` }));
const pctText = n => `${Math.round(n * 100) / 100}%`;

export default function MortgageStep({ d, m, set }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const row = { display:"flex", justifyContent:"space-between", alignItems:"center", gap:"12px", fontSize:"13.5px", color:TEXT, padding:"6px 0" };
  const explainer = { fontSize:"11.5px", color:MUT, lineHeight:1.5, background:"#ede7db", borderRadius:"8px", padding:"8px 10px", margin:0 };

  const loan = calcBorrowingCheck(borrowingInputs(d, m)).loanNeeded;
  const input = mortgageInputs(d, loan);
  const s = mortgageSummary(input);

  return (
    <div>
      <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"6px"}}>Your mortgage</div>
      <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,margin:"0 0 14px"}}>A repayment mortgage on the {fmt(loan)} loan from step 1.</p>

      <div style={{display:"flex",gap:"10px"}}>
        <PillCell><PillMoneyInput label="Term (years)" unit="" value={input.termYears} onChange={v => set("propertyMortgageTerm", v ?? "")}/></PillCell>
        <PillCell><PillMoneyInput label="Mortgage rate" unit="%" value={input.ratePct || null} onChange={v => set("propertyMortgageRate", v ?? "")}/></PillCell>
      </div>
      <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
        <PillCell><PillSelect label="Fixed for" value={String(input.fixedYears)} onChange={v => set("propertyFixedYears", v)} options={FIXED_OPTIONS}/></PillCell>
        <PillCell><PillMoneyInput label="Remortgage fee" value={input.remortgageFee || null} onChange={v => set("propertyRemortgageFee", v ?? "")}/></PillCell>
      </div>

      <div style={{marginTop:"16px",background:WHITE,borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",padding:"18px"}}>
        {loan === 0 ? (
          <p style={{fontSize:"13px",fontWeight:700,color:SC.ok,margin:0}}>No mortgage needed: cash covers the price, stamp duty and fees.</p>
        ) : (
          <>
            <div style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"10px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase"}}>
              Monthly repayment
              <InfoButton open={infoOpen} onClick={() => setInfoOpen(o => !o)}/>
            </div>
            <div style={{fontFamily:SERIF,fontSize:"30px",fontWeight:700,color:TEXT,lineHeight:1.2}}>{fmt(s.monthlyPayment)}</div>
            <div style={{fontSize:"12.5px",color:MUT,marginTop:"2px"}}>For the first {input.fixedYears} years at {pctText(input.ratePct)}</div>
            {infoOpen && (
              <p style={{...explainer,marginTop:"10px"}}>
                Capital and interest, so the loan is paid off over {input.termYears} years. At the end of each fixed period Candid assumes you remortgage at today's rate and pay the fee from cash.
              </p>
            )}
            {s.stressPayment != null && (
              <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"12px 0 0"}}>
                If rates are {STRESS_REMORTGAGE_UPLIFT} points higher when you remortgage ({pctText(s.stressRatePct)}), it would be {fmt(s.stressPayment)} a month from year {s.firstRemortgageYear}.
              </p>
            )}

            <hr style={{border:"none",borderTop:"1px solid rgba(22,47,36,0.1)",margin:"16px 0 8px"}}/>
            <div style={row}><span>Loan</span><span>{fmt(loan)}</span></div>
            <div style={row}><span>Term</span><span>{input.termYears} years</span></div>
            <div style={row}><span>Remortgages</span><span>{s.remortgages > 0 ? `${s.remortgages}, ${fmt(s.totalFees)} in fees` : "None"}</span></div>
            <div style={row}><span>Interest over the term</span><span>{fmt(s.totalInterest)}</span></div>
          </>
        )}
      </div>
    </div>
  );
}
