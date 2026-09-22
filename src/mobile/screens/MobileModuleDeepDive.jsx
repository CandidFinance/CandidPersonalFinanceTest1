import { useState } from "react";
import { Check, Coins } from "lucide-react";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, SC, MODULE_META } from "../../CandidApp.jsx";
import { statusLabel } from "../statusLabel.js";
import MobileCashDeepDive from "../deepdive/MobileCashDeepDive.jsx";
import MobileStudentLoanDeepDive from "../deepdive/MobileStudentLoanDeepDive.jsx";
import MobileInvestmentsDeepDive from "../deepdive/MobileInvestmentsDeepDive.jsx";
import MobilePensionDeepDive from "../deepdive/MobilePensionDeepDive.jsx";

// Shell for every mobile module deep-dive page: shared header (icon/title/
// status), the module-specific content in the middle, and a shared footer
// (Mark as reviewed + back to Modules). All 4 active modules now have a
// mobile deep dive — Pension is a trimmed v1 (see that file for what's
// deferred to a later, full-parity pass).
const CONTENT_BY_KEY = {
  cash: MobileCashDeepDive,
  studentLoan: MobileStudentLoanDeepDive,
  investments: MobileInvestmentsDeepDive,
  pension: MobilePensionDeepDive,
};

export default function MobileModuleDeepDive({ moduleKey, d, m, statuses, insights, savingsRates, set, isComplete, onMarkReviewed, onBack, onRecordLoanOverpayment, onRecordCrystallisedGain }) {
  const meta = MODULE_META.find(mm => mm.key === moduleKey);
  const status = statuses[moduleKey]?.status || "na";
  const statusColor = isComplete ? "#a8a89c" : (SC[status] || MUT);
  const Content = CONTENT_BY_KEY[moduleKey];
  // Same celebration as desktop's "Mark as reviewed": two floating coins and
  // a brief gold flash on the button — only when marking complete (not when
  // un-marking). No "+N pts" any more: reviewing a module doesn't move your
  // actual Candid score, so nothing here should imply it does.
  const [showCoins, setShowCoins] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const handleReviewed = () => {
    if (!isComplete) {
      setShowCoins(true); setFlashing(true);
      setTimeout(() => setShowCoins(false), 900);
      setTimeout(() => setFlashing(false), 400);
    }
    onMarkReviewed();
  };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"20px"}}>
        <div style={{width:"42px",height:"42px",borderRadius:"11px",background:`${statusColor}1f`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {meta?.icon && <meta.icon size={18} color={statusColor}/>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <h1 style={{fontFamily:SERIF,fontSize:"20px",color:TEXT,fontWeight:700,margin:0,lineHeight:1.2}}>{meta?.title || moduleKey}</h1>
          <div style={{display:"flex",alignItems:"center",gap:"5px",marginTop:"3px"}}>
            <span style={{width:"6px",height:"6px",borderRadius:"50%",background:statusColor,display:"inline-block"}}/>
            <span style={{fontSize:"12.5px",color:MUT}}>{statusLabel({status}, isComplete)}</span>
          </div>
        </div>
      </div>

      {Content ? (
        <Content d={d} m={m} statuses={statuses} insights={insights} savingsRates={savingsRates} set={set} onRecordLoanOverpayment={onRecordLoanOverpayment} onRecordCrystallisedGain={onRecordCrystallisedGain}/>
      ) : (
        <p style={{fontSize:"14px",color:MUT,lineHeight:1.6}}>This deep dive isn't built for mobile yet — check back soon, or view it on desktop.</p>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:"10px",marginTop:"20px"}}>
        <div style={{position:"relative"}}>
          {showCoins && (
            <div style={{position:"relative",pointerEvents:"none",height:0}}>
              <span style={{position:"absolute",top:"-8px",left:"calc(50% - 16px)",animation:"coinFloat 0.9s ease-out forwards"}}><Coins size={20} color={GOLD}/></span>
              <span style={{position:"absolute",top:"-8px",left:"calc(50% + 4px)",animation:"coinFloat 0.9s ease-out 0.15s forwards"}}><Coins size={20} color={GOLD}/></span>
            </div>
          )}
          <button onClick={handleReviewed} style={{
            width:"100%",background:"transparent",border:`1.3px solid ${isComplete?"rgba(45,107,74,0.35)":"rgba(22,47,36,0.25)"}`,
            color:isComplete?"#2d6b4a":G,borderRadius:"100px",padding:"12px",fontSize:"13.5px",fontWeight:600,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",
            animation: flashing ? "btnGoldTint 0.4s ease-out" : "none",
          }}>
            {isComplete ? <><Check size={14}/> Reviewed</> : "Mark as reviewed"}
          </button>
        </div>
        <button onClick={onBack} style={{width:"100%",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"12px",fontSize:"14px",fontWeight:600,cursor:"pointer"}}>
          Back to Modules
        </button>
      </div>
    </div>
  );
}
