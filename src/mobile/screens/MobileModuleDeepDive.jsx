import { Check } from "lucide-react";
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

export default function MobileModuleDeepDive({ moduleKey, d, m, statuses, insights, isComplete, onMarkReviewed, onBack }) {
  const meta = MODULE_META.find(mm => mm.key === moduleKey);
  const status = statuses[moduleKey]?.status || "na";
  const statusColor = isComplete ? "#a8a89c" : (SC[status] || MUT);
  const Content = CONTENT_BY_KEY[moduleKey];

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
        <Content d={d} m={m} statuses={statuses} insights={insights}/>
      ) : (
        <p style={{fontSize:"14px",color:MUT,lineHeight:1.6}}>This deep dive isn't built for mobile yet — check back soon, or view it on desktop.</p>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:"10px",marginTop:"20px"}}>
        <button onClick={onMarkReviewed} style={{
          width:"100%",background:"transparent",border:`1.3px solid ${isComplete?"rgba(45,107,74,0.35)":"rgba(22,47,36,0.25)"}`,
          color:isComplete?"#2d6b4a":G,borderRadius:"100px",padding:"12px",fontSize:"13.5px",fontWeight:600,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",
        }}>
          {isComplete ? <><Check size={14}/> Reviewed</> : "Mark as reviewed"}
        </button>
        <button onClick={onBack} style={{width:"100%",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"12px",fontSize:"14px",fontWeight:600,cursor:"pointer"}}>
          Back to Modules
        </button>
      </div>
    </div>
  );
}
