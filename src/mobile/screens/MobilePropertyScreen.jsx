import { Home, ChevronRight } from "lucide-react";
import { G, MUT, TEXT, SERIF, WHITE, PillSlider } from "../../CandidApp.jsx";
import { capField } from "../../lib/onboarding.js";
import { readinessMissing } from "../../lib/propertyReadiness.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import DecisionWaterfall from "../property/DecisionWaterfall.jsx";
import { PurchaseInputs, LoanTile } from "../property/BorrowingCheck.jsx";
import MortgageStep from "../property/MortgageStep.jsx";
import PropertySteps from "../property/PropertySteps.jsx";
import PillCell from "../property/PillCell.jsx";

// Property module, split into two steps so neither is one long page:
//   1. Readiness (/app/property): the purchase inputs first, then the
//      decision waterfall, then the loan the purchase needs.
//   2. Mortgage (/app/property/mortgage): repayments and remortgaging,
//      locked until step 1 is complete (readinessMissing is empty).
// The year-by-year rent vs buy engine comes later. Not in MODULE_META yet:
// that list drives scoring, the £-impact sort, the AI prompt and the PDF,
// and Property has no £ figure until the engine exists.

const BUYING_MODE_OPTIONS = [{ value:"alone", label:"Buying alone" }, { value:"together", label:"Buying together" }];
const divider = { border:"none", borderTop:"1px solid rgba(22,47,36,0.1)", margin:"26px 0 22px" };

const MISSING_TEXT = {
  checks: "the figures for each check",
  price: "a property price",
  region: "where you're buying",
  firstTimeBuyer: "whether you're a first-time buyer",
  partnerFirstTimeBuyer: "whether your partner is a first-time buyer",
};
function listText(items) {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export default function MobilePropertyScreen({ step, d, m, set, onAddInputs, onOpenModule, onSelectStep }) {
  const together = d.propertyBuyingMode === "together";
  const missing = readinessMissing(d, m);
  const unlocked = missing.length === 0;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"14px"}}>
        <div style={{width:"42px",height:"42px",borderRadius:"11px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Home size={18} color={G}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <h1 style={{fontFamily:SERIF,fontSize:"20px",color:TEXT,fontWeight:700,margin:0,lineHeight:1.2}}>Property</h1>
          <div style={{fontSize:"12.5px",color:MUT,marginTop:"3px"}}>Buying a home</div>
        </div>
      </div>

      <PropertySteps step={step} mortgageUnlocked={unlocked} onSelect={onSelectStep}/>

      {step === "mortgage" ? (
        <div style={{marginTop:"20px"}}>
          <MortgageStep d={d} m={m} set={set}/>
        </div>
      ) : (
        <>
          <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.55,margin:"16px 0"}}>
            Start with the purchase, then see what comes before a deposit and how much you'd need to borrow. Complete this step to unlock your mortgage.
          </p>

          <PillSlider value={together ? "together" : "alone"} onChange={v => set("propertyBuyingMode", v)} options={BUYING_MODE_OPTIONS}/>

          {together && (
            <div style={{marginTop:"20px"}}>
              <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"3px"}}>Your partner</div>
              <p style={{fontSize:"11px",color:MUT,lineHeight:1.5,margin:"0 0 10px"}}>
                Used to check their employer match and ISA allowance, and added to your income for the borrowing check.
              </p>
              <div style={{display:"flex",gap:"10px",marginBottom:"10px"}}>
                <PillCell><PillMoneyInput label="Salary" value={+d.partnerSalary || null} onChange={v => set("partnerSalary", capField("salary", v ?? ""))}/></PillCell>
                <PillCell><PillMoneyInput label="Other income" value={+d.partnerOtherIncome || null} onChange={v => set("partnerOtherIncome", capField("otherIncome", v ?? ""))}/></PillCell>
              </div>
              <div style={{display:"flex",gap:"10px",marginBottom:"10px"}}>
                <PillCell><PillMoneyInput label="Pension contribution" unit="%" value={d.partnerMyContribution || null} onChange={v => set("partnerMyContribution", capField("myContribution", v ?? ""))}/></PillCell>
                <PillCell><PillMoneyInput label="Employer match cap" unit="%" value={d.partnerEmployerMatch || null} onChange={v => set("partnerEmployerMatch", capField("employerMatch", v ?? ""))}/></PillCell>
              </div>
              <div style={{display:"flex",gap:"10px"}}>
                <PillCell><PillMoneyInput label="ISA paid in this tax year" value={+d.partnerIsaThisYear || null} onChange={v => set("partnerIsaThisYear", capField("isaThisYearOther", v ?? ""))}/></PillCell>
              </div>
            </div>
          )}

          <div style={{marginTop:"20px"}}>
            <PurchaseInputs d={d} m={m} set={set}/>
          </div>

          <hr style={divider}/>
          <DecisionWaterfall d={d} m={m} set={set} onAddInputs={onAddInputs} onOpenModule={onOpenModule}/>

          <hr style={divider}/>
          <LoanTile d={d} m={m}/>

          <div style={{marginTop:"24px"}}>
            {!unlocked && (
              <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"0 0 10px"}}>
                To unlock step 2, add {listText(missing.map(k => MISSING_TEXT[k]))}.
              </p>
            )}
            <button type="button" disabled={!unlocked} onClick={() => onSelectStep("mortgage")} style={{
              width:"100%", background:unlocked ? G : "rgba(22,47,36,0.2)", color:WHITE, border:"none", borderRadius:"100px",
              padding:"13px", fontSize:"14px", fontWeight:700, fontFamily:"inherit", cursor:unlocked ? "pointer" : "not-allowed",
              display:"flex", alignItems:"center", justifyContent:"center", gap:"4px",
            }}>
              Continue to your mortgage{unlocked && <ChevronRight size={16}/>}
            </button>
          </div>
        </>
      )}

      <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,marginTop:"26px"}}>
        Candid is guidance, not regulated financial advice. These figures show where things stand; the right decision depends on your full circumstances.
      </p>
    </div>
  );
}
