import { useState } from "react";
import { MUT, TEXT, SERIF, SC, WHITE } from "../../CandidApp.jsx";
import { borrowingInputs, calcBorrowingCheck, suggestedCashAvailable, LENDER_INCOME_MULTIPLE, EMERGENCY_KEEP_BACK_MONTHS } from "../../lib/borrowing.js";
import { fmt } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import InfoButton from "../InfoButton.jsx";

// Borrowing check: the loan a purchase needs against the 4.5x income most
// lenders work to. A warning only, never a block. Logic in
// src/lib/borrowing.js.

const caption = { fontSize:"11.5px", color:MUT, lineHeight:1.5, margin:0 };
const explainer = { fontSize:"11.5px", color:MUT, lineHeight:1.5, background:"#ede7db", borderRadius:"8px", padding:"8px 10px", margin:0 };
const row = { display:"flex", justifyContent:"space-between", alignItems:"center", gap:"12px", fontSize:"13.5px", color:TEXT, padding:"6px 0" };
const figureLabel = { fontSize:"10px", fontWeight:600, color:MUT, letterSpacing:"0.06em", textTransform:"uppercase" };
const figure = { fontFamily:SERIF, fontSize:"26px", fontWeight:700, color:TEXT, lineHeight:1.2 };

// The loan's income multiple on a bar with the 4.5x line marked: green fill
// when within it, red when above. The bar and its caption are this
// section's one state indicator.
function MultipleBar({ multiple }) {
  const above = multiple > LENDER_INCOME_MULTIPLE;
  const color = above ? SC.critical : SC.ok;
  const scaleMax = Math.max(6, multiple * 1.1);
  const fillPct = Math.min(100, (multiple / scaleMax) * 100);
  const markerPct = (LENDER_INCOME_MULTIPLE / scaleMax) * 100;
  return (
    <div style={{marginTop:"14px"}}>
      <div style={{position:"relative",height:"10px",borderRadius:"5px",background:"rgba(22,47,36,0.08)"}}>
        <div style={{position:"absolute",left:0,top:0,bottom:0,width:`${fillPct}%`,borderRadius:"5px",background:color}}/>
        <div style={{position:"absolute",left:`${markerPct}%`,top:"-4px",bottom:"-4px",width:"2px",marginLeft:"-1px",background:TEXT}}/>
      </div>
      <div style={{position:"relative",height:"16px",marginTop:"4px"}}>
        <span style={{position:"absolute",left:`${markerPct}%`,transform:"translateX(-50%)",fontSize:"10.5px",fontWeight:600,color:MUT,whiteSpace:"nowrap"}}>{LENDER_INCOME_MULTIPLE}x</span>
      </div>
      <div style={{fontSize:"13px",fontWeight:700,color,marginTop:"4px"}}>
        {above ? `Above the ${LENDER_INCOME_MULTIPLE}x most lenders use` : `Within the ${LENDER_INCOME_MULTIPLE}x most lenders use`}
      </div>
    </div>
  );
}

export default function BorrowingCheck({ d, m, set }) {
  const [cashInfoOpen, setCashInfoOpen] = useState(false);
  const [incomeInfoOpen, setIncomeInfoOpen] = useState(false);
  const input = borrowingInputs(d, m);
  const r = calcBorrowingCheck(input);
  const together = input.incomes.length > 1;
  const suggested = suggestedCashAvailable(m.totalLiquid, m.expenses);
  // One decimal normally, but a loan only just over 4.5x would round to
  // "4.5" and read as within the limit, so show two there.
  const multipleText = r.multiple == null ? null
    : (r.warn && r.multiple.toFixed(1) === LENDER_INCOME_MULTIPLE.toFixed(1)) ? r.multiple.toFixed(2) : r.multiple.toFixed(1);

  return (
    <div>
      <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"6px"}}>How much you'd need to borrow</div>
      <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,margin:"0 0 14px"}}>Cash left after stamp duty and fees is the deposit. The rest is the mortgage.</p>

      <div style={{display:"flex",gap:"10px"}}>
        <PillMoneyInput label="Property price" value={+d.propertyPrice || null} onChange={v => set("propertyPrice", v ?? "")}/>
        <PillMoneyInput label="Cash available" value={input.cashAvailable || null} onChange={v => set("propertyCashAvailable", v ?? "")}/>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:"6px",margin:"8px 0"}}>
        <span style={caption}>How cash available is worked out</span>
        <InfoButton open={cashInfoOpen} onClick={() => setCashInfoOpen(o => !o)}/>
      </div>
      {cashInfoOpen && (
        <p style={{...explainer,marginBottom:"10px"}}>
          Your cash savings and Premium Bonds ({fmt(m.totalLiquid)}) less {EMERGENCY_KEEP_BACK_MONTHS} months of expenses ({fmt(EMERGENCY_KEEP_BACK_MONTHS * m.expenses)}) kept back as an emergency fund: {fmt(suggested)}. Change it if some of that cash is set aside{together ? ", or to add your partner's savings" : ""}.
        </p>
      )}
      <div style={{display:"flex",gap:"10px"}}>
        <PillMoneyInput label="Stamp duty" value={+d.propertyStampDuty || null} onChange={v => set("propertyStampDuty", v ?? "")}/>
        <PillMoneyInput label="Legal & survey fees" value={input.fees || null} onChange={v => set("propertyFees", v ?? "")}/>
      </div>
      <p style={{...caption,marginTop:"8px"}}>Candid doesn't work out stamp duty yet. Enter it if you know it; until then it counts as £0.</p>

      {input.price > 0 && (
        <div style={{marginTop:"18px",background:WHITE,borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",padding:"18px"}}>
          <div style={{display:"flex",gap:"24px"}}>
            <div>
              <div style={figureLabel}>Loan needed</div>
              <div style={figure}>{fmt(r.loanNeeded)}</div>
            </div>
            {multipleText && r.loanNeeded > 0 && (
              <div>
                <div style={figureLabel}>Times income</div>
                <div style={figure}>{multipleText}x</div>
              </div>
            )}
          </div>

          {r.loanNeeded === 0 ? (
            <p style={{fontSize:"13px",fontWeight:700,color:SC.ok,margin:"10px 0 0"}}>No mortgage needed: cash covers the price, stamp duty and fees.</p>
          ) : r.multiple == null ? (
            <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"10px 0 0"}}>Candid doesn't have an income figure to compare this against, and lenders base how much they'll lend on income.</p>
          ) : (
            <>
              <MultipleBar multiple={r.multiple}/>
              {r.warn && (
                <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,margin:"6px 0 0"}}>
                  That's {fmt(r.gapAboveMultiple)} more than {LENDER_INCOME_MULTIPLE}x {together ? "your combined income" : "your income"}. Some lenders go to 5 to 5.5x for higher earners.
                </p>
              )}
            </>
          )}

          <hr style={{border:"none",borderTop:"1px solid rgba(22,47,36,0.1)",margin:"16px 0 8px"}}/>
          <div style={row}><span>Cash available</span><span>{fmt(input.cashAvailable)}</span></div>
          <div style={row}><span>Stamp duty and fees</span><span style={r.upfrontCosts > 0 ? {color:SC.critical} : undefined}>{r.upfrontCosts > 0 ? "−" : ""}{fmt(r.upfrontCosts)}</span></div>
          <div style={{...row,fontWeight:700}}><span>Deposit</span><span>{fmt(r.usableDeposit)}</span></div>
          <div style={row}>
            <span style={{display:"flex",alignItems:"center",gap:"6px"}}>
              {together ? "Combined income" : "Income"}
              <InfoButton open={incomeInfoOpen} onClick={() => setIncomeInfoOpen(o => !o)}/>
            </span>
            <span>{fmt(r.income)}</span>
          </div>
          {incomeInfoOpen && (
            <p style={{...explainer,marginTop:"4px"}}>
              Salary plus other income{together ? ", for both of you" : ""}. Bonuses and dividends aren't included, as lenders treat them case by case. This is a guide, not a lending decision.
            </p>
          )}
          {r.upfrontShortfall > 0 && (
            <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,margin:"8px 0 0"}}>
              Cash available is {fmt(r.upfrontShortfall)} short of covering stamp duty and fees, so none of it is left for a deposit.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
