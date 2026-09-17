import { calcStudentLoanScenario } from "../../lib/studentLoan.js";
import { fmt } from "../../lib/format.js";
import { G, GOLD, WHITE, MUT, TEXT, SERIF } from "../../CandidApp.jsx";
import MobileWinTile from "../MobileWinTile.jsx";

// Trimmed mobile version of desktop's Student Loan deep dive (ModuleDeepDive,
// moduleKey==="studentLoan" — CandidApp.jsx). Keeps the opportunity strip,
// the loan-trajectory summary, and a condensed 3-step "does overpaying beat
// cash" walkthrough. Deliberately drops desktop's Step 4 overpayment-amount
// scenario cards and the "marginal return per £1 overpaid" chart (the latter
// runs ~38 loan simulations purely for a chart not yet designed for mobile)
// — v1 scope per the mobile deep-dive plan. calcStudentLoanScenario is the
// same single source of truth desktop and computeModuleStatuses both use.
export default function MobileStudentLoanDeepDive({ d, m }) {
  const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT, padding:"5px 0" };

  if (d.studentLoan === "none" || m.loanBal <= 0) {
    return <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.6}}>No student loan on record.</p>;
  }

  const sl = calcStudentLoanScenario(d, m);
  const worthOverpaying = sl.willClear && sl.effectiveBenefit > 0;
  const surplusCash = m.surplusCash || 0;

  const stats = [
    { label:"Current balance", value:fmt(m.loanBal) },
    { label:"Interest rate", value:`${sl.slRatePct}%` },
    { label:"Annual interest", value:`${fmt(sl.annualInterest)}/yr` },
    { label:"Annual repayments", value:`${fmt(sl.annualRep)}/yr` },
    { label: sl.clearYr ? "Clears in" : "Written off after", value: sl.clearYr ? `${sl.clearYr} yrs` : `${sl.writeOffYr} yrs` },
  ];

  return (
    <div>
      {worthOverpaying && (
        <div style={{background:"rgba(196,150,58,0.12)",borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
          <div style={{fontSize:"10px",fontWeight:800,color:"#8a6a24",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Opportunity</div>
          <div style={{fontFamily:SERIF,fontSize:"32px",color:TEXT,fontWeight:700,lineHeight:1.1}}>{fmt(sl.overpayAnnualBenefit)}/yr</div>
          <div style={{fontSize:"12px",color:"#8a6a24",marginTop:"4px",fontWeight:600}}>Effective benefit from overpaying vs cash</div>
        </div>
      )}

      <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
        <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"12px"}}>Your loan trajectory</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
          {stats.map((s,i) => (
            <div key={i}>
              <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{s.label}</div>
              <div style={{fontFamily:SERIF,fontSize:"17px",color:G,fontWeight:700,marginTop:"2px"}}>{s.value}</div>
            </div>
          ))}
        </div>
        <p style={{fontSize:"13px",color:MUT,lineHeight:1.6,margin:0}}>
          {sl.belowThreshold
            ? `Your salary is below the repayment threshold, so no deductions yet. Interest still accrues at ${sl.slRatePct}% (~${fmt(sl.annualInterest)}/yr).`
            : !sl.willClear
              ? "Projected to be written off before you'd clear it — overpaying mostly reduces the write-off, not your repayments."
              : sl.effectiveBenefit <= 0
                ? `On track to clear in ~${sl.clearYr} years. Your savings rate (${sl.cashRate}%) beats your loan rate (${sl.slRatePct}%) — saving beats overpaying here.`
                : "See the win below for what overpaying could save you."}
        </p>
      </div>

      {sl.willClear && (
        <MobileWinTile number={1}
          title={sl.balanceGrowing ? "Your loan balance is growing" : worthOverpaying ? "Overpay your student loan" : "What overpaying would do"}
          headline={sl.balanceGrowing
            ? `Growing by ${fmt(sl.netAnnualChange)}/yr — overpaying could still save ${fmt(sl.overpayAnnualBenefit)}/yr`
            : worthOverpaying
              ? `${fmt(sl.overpayAnnualBenefit)}/yr effective benefit vs cash`
              : `Your ${sl.cashRate}% savings rate beats your ${sl.slRatePct}% loan rate`}
          tagLabel={worthOverpaying ? "Today" : "Not optimal"} tagColor={worthOverpaying ? GOLD : "#c0392b"}>
          {sl.balanceGrowing && (
            <div style={{background:"rgba(192,57,43,0.05)",border:"1.5px solid rgba(192,57,43,0.22)",borderRadius:"10px",padding:"12px 14px",marginBottom:"10px"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:"#c0392b",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"6px"}}>Effective 9% income surcharge</div>
              <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.6,margin:0}}>
                Your balance grows because repayments haven't caught up with interest yet. At {fmt(sl.inflectionSalary)} salary, repayments would exactly match interest — above that, your balance starts shrinking.
              </p>
            </div>
          )}
          <div style={rowStyle}><span>Step 1 — Outstanding balance at {sl.slRatePct}%</span><span style={{fontWeight:700,color:G}}>{fmt(m.loanBal)}</span></div>
          {surplusCash > 0 ? (
            <div style={rowStyle}><span>Step 2 — Spare cash above your buffer</span><span style={{fontWeight:700,color:G}}>{fmt(surplusCash)}</span></div>
          ) : (
            <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"6px 0"}}>Step 2 — You don't currently hold cash above your emergency buffer; the comparison still applies to any spare cash you build up.</p>
          )}
          <div style={{...rowStyle,fontWeight:700,color:worthOverpaying?"#2d6b4a":"#c0392b"}}>
            <span>Step 3 — {sl.slRatePct}% loan vs {sl.cashRate}% cash</span>
            <span>{worthOverpaying ? `Repay wins by ${sl.effectiveBenefit}%` : `Cash wins by ${Math.abs(sl.effectiveBenefit)}%`}</span>
          </div>
        </MobileWinTile>
      )}
    </div>
  );
}
