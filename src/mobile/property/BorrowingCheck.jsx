import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { MUT, TEXT, SERIF, SC, WHITE } from "../../CandidApp.jsx";
import { borrowingInputs, calcBorrowingCheck, suggestedCashAvailable, LENDER_INCOME_MULTIPLE, EMERGENCY_KEEP_BACK_MONTHS } from "../../lib/borrowing.js";
import { fmt } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import InfoButton from "../InfoButton.jsx";

// Borrowing check: the loan a purchase needs against the 4.5x income most
// lenders work to. A warning only, never a block. Logic in
// src/lib/borrowing.js.
export default function BorrowingCheck({ d, m, set }) {
  const [cashInfoOpen, setCashInfoOpen] = useState(false);
  const input = borrowingInputs(d, m);
  const r = calcBorrowingCheck(input);
  const together = input.incomes.length > 1;
  const suggested = suggestedCashAvailable(m.totalLiquid, m.expenses);
  const incomePhrase = together ? "your combined income" : "your income";
  // One decimal normally, but a loan only just over 4.5x would round to
  // "4.5" and read as within the limit, so show two there.
  const multipleText = r.multiple == null ? null
    : (r.warn && r.multiple.toFixed(1) === LENDER_INCOME_MULTIPLE.toFixed(1)) ? r.multiple.toFixed(2) : r.multiple.toFixed(1);
  const row = { display:"flex", justifyContent:"space-between", gap:"12px", fontSize:"13px", color:TEXT, padding:"5px 0" };

  return (
    <div>
      <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"6px"}}>How much you'd need to borrow</div>
      <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.55,margin:"0 0 14px"}}>
        What's left of your cash after stamp duty and fees becomes the deposit. The rest is the mortgage.
      </p>

      <div style={{background:WHITE,borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",padding:"16px"}}>
        <div style={{display:"flex",gap:"10px",marginBottom:"10px"}}>
          <PillMoneyInput label="Property price" value={+d.propertyPrice || null} onChange={v => set("propertyPrice", v ?? "")}/>
          <PillMoneyInput label="Cash available" value={input.cashAvailable || null} onChange={v => set("propertyCashAvailable", v ?? "")}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:cashInfoOpen ? "4px" : "12px"}}>
          <span style={{fontSize:"11.5px",color:MUT}}>How cash available is worked out</span>
          <InfoButton open={cashInfoOpen} onClick={() => setCashInfoOpen(o => !o)}/>
        </div>
        {cashInfoOpen && (
          <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,background:"#ede7db",borderRadius:"8px",padding:"8px 10px",margin:"0 0 12px"}}>
            It starts as your cash savings and Premium Bonds ({fmt(m.totalLiquid)}) less {EMERGENCY_KEEP_BACK_MONTHS} months of expenses ({fmt(EMERGENCY_KEEP_BACK_MONTHS * m.expenses)}) kept back as an emergency fund: {fmt(suggested)}. You can change it, for example if some of that cash is set aside for something else{together ? ", or to add your partner's savings" : ""}.
          </p>
        )}
        <div style={{display:"flex",gap:"10px"}}>
          <PillMoneyInput label="Stamp duty" value={+d.propertyStampDuty || null} onChange={v => set("propertyStampDuty", v ?? "")}/>
          <PillMoneyInput label="Legal & survey fees" value={input.fees || null} onChange={v => set("propertyFees", v ?? "")}/>
        </div>
        <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>
          Candid doesn't work out stamp duty yet. Enter it if you know it; until then it counts as £0.
        </p>
      </div>

      {input.price > 0 && (
        <div style={{marginTop:"18px"}}>
          <div style={{display:"flex",gap:"24px",marginBottom:"10px"}}>
            <div>
              <div style={{fontSize:"10px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase"}}>Loan needed</div>
              <div style={{fontFamily:SERIF,fontSize:"26px",fontWeight:700,color:TEXT,lineHeight:1.2}}>{fmt(r.loanNeeded)}</div>
            </div>
            {multipleText && r.loanNeeded > 0 && (
              <div>
                <div style={{fontSize:"10px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase"}}>Times income</div>
                <div style={{fontFamily:SERIF,fontSize:"26px",fontWeight:700,color:TEXT,lineHeight:1.2}}>{multipleText}x</div>
              </div>
            )}
          </div>

          <div style={row}><span>Cash available</span><span>{fmt(input.cashAvailable)}</span></div>
          <div style={row}><span>Less stamp duty and fees</span><span>{fmt(r.upfrontCosts)}</span></div>
          <div style={{...row,fontWeight:600}}><span>Deposit</span><span>{fmt(r.usableDeposit)}</span></div>
          <div style={row}><span>{together ? "Combined income" : "Income"}</span><span>{fmt(r.income)}</span></div>

          {r.upfrontShortfall > 0 && (
            <p style={{fontSize:"13px",color:TEXT,lineHeight:1.55,margin:"10px 0 0"}}>
              Cash available is {fmt(r.upfrontShortfall)} short of covering stamp duty and fees, so none of it is left for a deposit.
            </p>
          )}

          {r.loanNeeded === 0 ? (
            <p style={{fontSize:"13px",color:TEXT,lineHeight:1.55,margin:"10px 0 0"}}>Cash available covers the price, stamp duty and fees, so no mortgage is needed.</p>
          ) : r.warn ? (
            <div style={{display:"flex",gap:"10px",alignItems:"flex-start",marginTop:"12px",padding:"12px 14px",borderRadius:"12px",background:"rgba(196,150,58,0.1)"}}>
              <AlertTriangle size={16} color={SC.attention} style={{flexShrink:0,marginTop:"2px"}}/>
              <p style={{fontSize:"13px",color:TEXT,lineHeight:1.55,margin:0}}>
                {r.income > 0
                  ? <>The loan needed is {multipleText} times {incomePhrase}. Most lenders cap lending at around {LENDER_INCOME_MULTIPLE} times income, which here is {fmt(r.loanAtMultiple)}, {fmt(r.gapAboveMultiple)} less than the loan needed. Some lenders go to 5 to 5.5 times for higher earners.</>
                  : <>Candid doesn't have an income figure for this purchase, and lenders base how much they'll lend on income.</>}
              </p>
            </div>
          ) : (
            <p style={{fontSize:"13px",color:TEXT,lineHeight:1.55,margin:"10px 0 0"}}>
              That's {multipleText} times {incomePhrase}, within the {LENDER_INCOME_MULTIPLE} times most lenders use as a guide.
            </p>
          )}

          <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"12px 0 0"}}>
            Income here is salary plus other income{together ? ", for both of you" : ""}. Bonuses and dividends aren't included, as lenders treat them case by case. This is a guide, not a lending decision.
          </p>
        </div>
      )}
    </div>
  );
}
