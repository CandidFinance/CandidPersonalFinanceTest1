import { useRef, useState } from "react";
import posthog from "posthog-js";
import { Home, ChevronRight } from "lucide-react";
import { G, MUT, TEXT, SERIF, WHITE } from "../../CandidApp.jsx";
import { readinessMissing } from "../../lib/propertyReadiness.js";
import { runWaterfall, waterfallInputs, VISIBLE_CHECKS } from "../../lib/waterfall.js";
import DecisionWaterfall from "../property/DecisionWaterfall.jsx";
import { PurchaseInputs, LoanTile, LoanSummaryBar } from "../property/BorrowingCheck.jsx";
import MortgageStep from "../property/MortgageStep.jsx";
import RentVsBuyStep from "../property/RentVsBuyStep.jsx";
import PropertySteps from "../property/PropertySteps.jsx";
import GuidedFlow from "../property/GuidedFlow.jsx";
import AssumptionsHeading from "../property/AssumptionsHeading.jsx";
import { STEP_GUIDES, guideStarts } from "../../lib/propertyGuide.js";

// Property module, split into two steps so neither is one long page:
//   1. Readiness (/app/property): the loan the purchase needs first (the
//      answer people come back for), then the purchase inputs that drive it,
//      then the decision waterfall, passed on the way to Continue.
//   2. Mortgage (/app/property/mortgage): repayments and remortgaging.
//   3. Rent vs buy (/app/property/rent-vs-buy): net wealth either way over
//      the years the buyer expects to stay.
// Steps 2 and 3 are locked until step 1 is complete (readinessMissing is
// empty).
// The first visit to each step, while it's still blank, is a guided
// walk-through (GuidedFlow, questions and start rules in
// src/lib/propertyGuide.js); once finished or skipped it isn't shown again
// unless asked for ("Walk me through it"). Not in MODULE_META yet: that list drives scoring, the £-impact
// sort, the AI prompt and the PDF, and Property's £ figure is still to be
// defined.

const divider = { border:"none", borderTop:"1px solid rgba(22,47,36,0.1)", margin:"18px 0 14px" };

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
  // Whether this step's walk-through runs is decided on arriving at the step
  // and then held: answering the last few questions can complete a step,
  // which mustn't end its walk-through early. Reset during render (not in an
  // effect) when the step changes, so the inputs never flash up first.
  const [guide, setGuide] = useState(() => ({ step, on: guideStarts(step, d, m) }));
  if (guide.step !== step) setGuide({ step, on: guideStarts(step, d, m) });
  const guiding = guide.step === step && guide.on;
  const endGuide = (how, at) => {
    set(STEP_GUIDES[step].doneField, true);
    setGuide({ step, on: false });
    posthog.capture(how === "finished" ? "property_guide_finished" : "property_guide_skipped", { step, at });
    window.scrollTo({ top: 0 });
  };
  const startGuide = () => {
    setGuide({ step, on: true });
    posthog.capture("property_guide_restarted", { step });
    window.scrollTo({ top: 0 });
  };
  const guideFlow = guiding && (
    <GuidedFlow key={step} questions={STEP_GUIDES[step].questions} d={d} m={m} set={set} regionalRows={regionalRows} onDone={endGuide}
      result={step === "readiness" ? <LoanTile d={d} m={m} emptyText="Answer a few questions below to see what you could borrow."/> : null}/>
  );

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
          <MortgageStep d={d} m={m} set={set} onContinue={() => onSelectStep("rentVsBuy")} guide={guideFlow} onWalkThrough={startGuide}/>
        </div>
      ) : step === "rentVsBuy" ? (
        <div style={{marginTop:"20px"}}>
          <RentVsBuyStep d={d} m={m} set={set} regionalRows={regionalRows} marketRates={marketRates} guide={guideFlow} onWalkThrough={startGuide}/>
        </div>
      ) : guiding ? (
        <div style={{marginTop:"20px"}}>{guideFlow}</div>
      ) : (
        <>
          <div ref={loanRef} style={{marginTop:"20px",scrollMarginTop:"16px"}}>
            <LoanTile d={d} m={m}/>
          </div>
          <LoanSummaryBar d={d} m={m} watchRef={loanRef}/>

          <hr style={divider}/>
          <AssumptionsHeading text="Set your baseline home purchase assumptions." onWalkThrough={startGuide}/>
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
