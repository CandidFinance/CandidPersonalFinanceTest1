import { useEffect } from "react";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, NavBar } from "../../CandidApp.jsx";
import MobileOnboardingStep from "../onboarding/MobileOnboardingStep.jsx";

// Mobile-native rebuild of desktop's OnboardingScreen (CandidApp.jsx) — same
// `d`/`set` data flow and step-progression rules (Continue disabled only on
// an empty module pick or empty name), but full-screen wizard chrome instead
// of the tab-bar MobileLayout: a wizard is a distinct flow, and the tab bar's
// destinations don't make sense before a report exists yet.
export default function MobileOnboardingScreen({ step, steps, d, set, insights, onBack, onBackToDashboard, onContinue }) {
  const stepId = steps[step].id;
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [step]);

  const noModulesSelected = stepId === "modules" && !(d.selectedModules||[]).length;
  const noName = stepId === "name" && !d.name.trim();
  const continueDisabled = noModulesSelected || noName;
  const progressPct = ((step + 1) / steps.length) * 100;
  const isLastStep = step === steps.length - 1;

  return (
    <div style={{minHeight:"100vh",background:"#f6f0e6",display:"flex",flexDirection:"column"}}>
      <NavBar light center={`Step ${step+1} of ${steps.length}`}/>
      <div style={{padding:"16px 20px 0"}}>
        {insights ? (
          <button type="button" onClick={onBackToDashboard} style={{fontFamily:SERIF,color:G,fontSize:"20px",fontWeight:700,background:"none",border:"none",padding:0,marginBottom:"14px",cursor:"pointer",display:"block"}}>Candid.</button>
        ) : (
          <div style={{fontFamily:SERIF,color:G,fontSize:"20px",fontWeight:700,marginBottom:"14px"}}>Candid.</div>
        )}
        <div style={{height:"4px",borderRadius:"2px",background:"rgba(22,47,36,0.1)",overflow:"hidden"}}>
          <div style={{height:"100%",width:`${progressPct}%`,background:GOLD,borderRadius:"2px",transition:"width 0.2s"}}/>
        </div>
      </div>
      <div style={{flex:1,maxWidth:"580px",margin:"0 auto",padding:"24px 20px",width:"100%",boxSizing:"border-box"}}>
        <MobileOnboardingStep stepId={stepId} d={d} set={set}/>
      </div>
      <div style={{position:"sticky",bottom:0,background:"#f6f0e6",padding:"14px 20px",paddingBottom:"calc(14px + env(safe-area-inset-bottom, 0px))",display:"flex",flexDirection:"column",gap:"8px"}}>
        <div style={{display:"flex",gap:"10px"}}>
          <button onClick={onBack} style={{flex:1,padding:"13px",background:"transparent",border:"1.5px solid rgba(22,47,36,0.22)",borderRadius:"100px",fontSize:"14px",color:TEXT,fontWeight:600,cursor:"pointer"}}>← Back</button>
          <button onClick={onContinue} disabled={continueDisabled} style={{
            flex:2,padding:"13px",background:G,border:"none",borderRadius:"100px",fontSize:"14px",fontWeight:700,color:WHITE,
            opacity:continueDisabled ? 0.45 : 1,cursor:continueDisabled ? "not-allowed" : "pointer",
          }}>
            {isLastStep ? (insights ? "Regenerate my report" : "Generate my Candid report") : "Continue"}
          </button>
        </div>
        {stepId === "email" && (
          <button type="button" onClick={onContinue} style={{background:"none",border:"none",fontSize:"12px",color:MUT,cursor:"pointer",textDecoration:"underline",padding:0,alignSelf:"center"}}>
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
