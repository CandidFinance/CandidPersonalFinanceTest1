import { useRef } from "react";
import { Home, ChevronRight } from "lucide-react";
import { G, MUT, TEXT, SERIF, WHITE } from "../../CandidApp.jsx";
import { readinessMissing } from "../../lib/propertyReadiness.js";
import { runWaterfall, waterfallInputs, VISIBLE_CHECKS } from "../../lib/waterfall.js";
import DecisionWaterfall from "../property/DecisionWaterfall.jsx";
import { PurchaseInputs, LoanTile, LoanSummaryBar } from "../property/BorrowingCheck.jsx";
import MortgageStep from "../property/MortgageStep.jsx";
import RentVsBuyStep from "../property/RentVsBuyStep.jsx";
import PropertySteps from "../property/PropertySteps.jsx";

// Property module, split into two steps so neither is one long page:
//   1. Readiness (/app/property): the loan the purchase needs first (the
//      answer people come back for), then the purchase inputs that drive it,
//      then the decision waterfall, passed on the way to Continue.
//   2. Mortgage (/app/property/mortgage): repayments and remortgaging.
//   3. Rent vs buy (/app/property/rent-vs-buy): net wealth either way over
//      the years the buyer expects to stay.
// Steps 2 and 3 are locked until step 1 is complete (readinessMissing is
// empty). Not in MODULE_META yet: that list drives scoring, the £-impact
// sort, the AI prompt and the PDF, and Property's £ figure is still to be
// defined.

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

export default function MobilePropertyScreen({ step, d, m, set, regionalRows, marketRates, onAddInputs, onOpenModule, onSelectStep }) {
  const missing = readinessMissing(d, m);
  const unlocked = missing.length === 0;
  const loanRef = useRef(null);
  const checksToReview = runWaterfall(waterfallInputs(d, m))
    .filter(c => VISIBLE_CHECKS.includes(c.key) && c.state === "attention").length;

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

      <PropertySteps step={step} unlocked={unlocked} onSelect={onSelectStep}/>

      {step === "mortgage" ? (
        <div style={{marginTop:"20px"}}>
          <MortgageStep d={d} m={m} set={set} onContinue={() => onSelectStep("rentVsBuy")}/>
        </div>
      ) : step === "rentVsBuy" ? (
        <div style={{marginTop:"20px"}}>
          <RentVsBuyStep d={d} m={m} set={set} regionalRows={regionalRows} marketRates={marketRates}/>
        </div>
      ) : (
        <>
          <div ref={loanRef} style={{marginTop:"20px",scrollMarginTop:"16px"}}>
            <LoanTile d={d} m={m}/>
          </div>
          <LoanSummaryBar d={d} m={m} watchRef={loanRef}/>

          <hr style={divider}/>
          <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.55,margin:"0 0 16px"}}>Set your baseline home purchase assumptions.</p>
          <PurchaseInputs d={d} m={m} set={set}/>

          <hr style={divider}/>
          <DecisionWaterfall d={d} m={m} set={set} onAddInputs={onAddInputs} onOpenModule={onOpenModule}/>

          <div style={{marginTop:"24px"}}>
            {!unlocked && (
              <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"0 0 10px"}}>
                To unlock steps 2 and 3, add {listText(missing.map(k => MISSING_TEXT[k]))}.
              </p>
            )}
            <button type="button" disabled={!unlocked} onClick={() => onSelectStep("mortgage")} style={{
              width:"100%", background:unlocked ? G : "rgba(22,47,36,0.2)", color:WHITE, border:"none", borderRadius:"100px",
              padding:"13px", fontSize:"14px", fontWeight:700, fontFamily:"inherit", cursor:unlocked ? "pointer" : "not-allowed",
              display:"flex", flexDirection:"column", alignItems:"center", gap:"2px",
            }}>
              <span style={{display:"flex",alignItems:"center",gap:"4px"}}>Continue to your mortgage{unlocked && <ChevronRight size={16}/>}</span>
              {/* Not a block: the checks are worth settling before a deposit,
                  but moving on to the mortgage is still the user's call. */}
              {unlocked && checksToReview > 0 && (
                <span style={{fontSize:"11.5px",fontWeight:600,opacity:0.8}}>
                  {checksToReview} {checksToReview === 1 ? "check" : "checks"} above to review first
                </span>
              )}
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
