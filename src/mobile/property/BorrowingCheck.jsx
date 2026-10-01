import { useState } from "react";
import { MUT, TEXT, SERIF, SC, WARNING, WHITE } from "../../CandidApp.jsx";
import { borrowingInputs, calcBorrowingCheck, suggestedCashAvailable, LENDER_INCOME_MULTIPLE, HIGH_EARNER_MULTIPLE, EMERGENCY_KEEP_BACK_MONTHS } from "../../lib/borrowing.js";
import { fmt } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import InfoButton from "../InfoButton.jsx";
import PillCell from "./PillCell.jsx";

// Borrowing check: the loan a purchase needs against the 4.5x income most
// lenders work to. A warning only, never a block. Logic in
// src/lib/borrowing.js.

const caption = { fontSize:"11.5px", color:MUT, lineHeight:1.5, margin:0 };
const explainer = { fontSize:"11.5px", color:MUT, lineHeight:1.5, background:"#ede7db", borderRadius:"8px", padding:"8px 10px", margin:0 };
const row = { display:"flex", justifyContent:"space-between", alignItems:"center", gap:"12px", fontSize:"13.5px", color:TEXT, padding:"6px 0" };
const figureLabel = { fontSize:"10px", fontWeight:600, color:MUT, letterSpacing:"0.06em", textTransform:"uppercase" };
const figure = { fontFamily:SERIF, fontSize:"26px", fontWeight:700, color:TEXT, lineHeight:1.2 };

// Colour and caption for calcBorrowingCheck's band: green up to 4.5x,
// orange to 5.5x, red above. Drives the times-income figure, the bar and
// the result tile's border.
const BAND = {
  within:  { color: SC.ok,       caption: `Within the ${LENDER_INCOME_MULTIPLE}x most lenders use` },
  stretch: { color: WARNING,     caption: `Above ${LENDER_INCOME_MULTIPLE}x, within the ${HIGH_EARNER_MULTIPLE}x some lenders offer higher earners` },
  beyond:  { color: SC.critical, caption: `Above ${HIGH_EARNER_MULTIPLE}x, beyond what most lenders offer` },
};

// The loan's income multiple on a bar with the 4.5x and 5.5x lines marked.
function MultipleBar({ multiple, band }) {
  const { color, caption: text } = BAND[band];
  const scaleMax = Math.max(7, multiple * 1.1);
  const fillPct = Math.min(100, (multiple / scaleMax) * 100);
  const markers = [LENDER_INCOME_MULTIPLE, HIGH_EARNER_MULTIPLE].map(x => ({ x, pct: (x / scaleMax) * 100 }));
  return (
    <div style={{marginTop:"14px"}}>
      <div style={{position:"relative",height:"10px",borderRadius:"5px",background:"rgba(22,47,36,0.08)"}}>
        <div style={{position:"absolute",left:0,top:0,bottom:0,width:`${fillPct}%`,borderRadius:"5px",background:color}}/>
        {markers.map(mk => (
          <div key={mk.x} style={{position:"absolute",left:`${mk.pct}%`,top:"-4px",bottom:"-4px",width:"2px",marginLeft:"-1px",background:TEXT}}/>
        ))}
      </div>
      <div style={{position:"relative",height:"16px",marginTop:"4px"}}>
        {markers.map(mk => (
          <span key={mk.x} style={{position:"absolute",left:`${mk.pct}%`,transform:"translateX(-50%)",fontSize:"10.5px",fontWeight:600,color:MUT,whiteSpace:"nowrap"}}>{mk.x}x</span>
        ))}
      </div>
      <div style={{fontSize:"13px",fontWeight:700,color,marginTop:"4px"}}>{text}</div>
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
  const bandColor = r.band ? BAND[r.band].color : null;
  const incomePhrase = together ? "your combined income" : "your income";
  // One decimal normally, but a multiple just over a band edge would round
  // down onto it ("4.5", "5.5") and read as the band below, so show two there.
  const multipleText = r.multiple == null ? null
    : [LENDER_INCOME_MULTIPLE, HIGH_EARNER_MULTIPLE].some(x => r.multiple > x && r.multiple.toFixed(1) === x.toFixed(1)) ? r.multiple.toFixed(2) : r.multiple.toFixed(1);

  return (
    <div>
      <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"6px"}}>How much you'd need to borrow</div>
      <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,margin:"0 0 14px"}}>Cash left after stamp duty and fees is the deposit. The rest is the mortgage.</p>

      <div style={{display:"flex",gap:"10px"}}>
        <PillCell><PillMoneyInput label="Property price" value={+d.propertyPrice || null} onChange={v => set("propertyPrice", v ?? "")}/></PillCell>
        <PillCell info={<InfoButton open={cashInfoOpen} onClick={() => setCashInfoOpen(o => !o)}/>}>
          <PillMoneyInput label="Cash available" value={input.cashAvailable || null} onChange={v => set("propertyCashAvailable", v ?? "")}/>
        </PillCell>
      </div>
      {cashInfoOpen && (
        <p style={{...explainer,marginTop:"8px"}}>
          Your cash savings and Premium Bonds ({fmt(m.totalLiquid)}) less {EMERGENCY_KEEP_BACK_MONTHS} months of expenses ({fmt(EMERGENCY_KEEP_BACK_MONTHS * m.expenses)}) kept back as an emergency fund: {fmt(suggested)}. Change it if some of that cash is set aside{together ? ", or to add your partner's savings" : ""}.
        </p>
      )}
      <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
        <PillCell><PillMoneyInput label="Stamp duty" value={+d.propertyStampDuty || null} onChange={v => set("propertyStampDuty", v ?? "")}/></PillCell>
        <PillCell><PillMoneyInput label="Legal & survey fees" value={input.fees || null} onChange={v => set("propertyFees", v ?? "")}/></PillCell>
      </div>
      <p style={{...caption,marginTop:"8px"}}>Candid doesn't work out stamp duty yet. Enter it if you know it; until then it counts as £0.</p>

      {input.price > 0 && (
        <div style={{marginTop:"18px",background:WHITE,borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",padding:"18px",border:bandColor ? `2px solid ${bandColor}` : "none"}}>
          <div style={{display:"flex",gap:"24px"}}>
            <div>
              <div style={figureLabel}>Loan needed</div>
              <div style={figure}>{fmt(r.loanNeeded)}</div>
            </div>
            {multipleText && r.loanNeeded > 0 && (
              <div>
                <div style={figureLabel}>Times income</div>
                <div style={{...figure,color:bandColor || TEXT}}>{multipleText}x</div>
              </div>
            )}
          </div>

          {r.loanNeeded === 0 ? (
            <p style={{fontSize:"13px",fontWeight:700,color:SC.ok,margin:"10px 0 0"}}>No mortgage needed: cash covers the price, stamp duty and fees.</p>
          ) : r.multiple == null ? (
            <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"10px 0 0"}}>Candid doesn't have an income figure to compare this against, and lenders base how much they'll lend on income.</p>
          ) : (
            <>
              <MultipleBar multiple={r.multiple} band={r.band}/>
              {r.band === "stretch" && (
                <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,margin:"6px 0 0"}}>
                  That's {fmt(r.gapAboveMultiple)} more than {LENDER_INCOME_MULTIPLE}x {incomePhrase}. Some lenders go to 5 to {HIGH_EARNER_MULTIPLE}x for higher earners.
                </p>
              )}
              {r.band === "beyond" && (
                <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,margin:"6px 0 0"}}>
                  That's {fmt(r.gapAboveMultiple)} more than {LENDER_INCOME_MULTIPLE}x {incomePhrase}, and above the {HIGH_EARNER_MULTIPLE}x some lenders go to for higher earners.
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
