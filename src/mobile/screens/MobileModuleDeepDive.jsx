import { ExplainLink } from "../ModuleScreenParts.jsx";
import BankConfirm from "../BankConfirm.jsx";
import { GuidanceIntro, GuidanceFooter } from "../GuidanceNote.jsx";
import { useState } from "react";
import { Check, Coins } from "lucide-react";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, SC, SUCCESS, PROGRESS_GREEN } from "../../design-tokens.js";
import { REVIEW_COIN_S, REVIEW_COIN_STAGGER_S, REVIEW_TINT_S, REVIEW_SWAP_MS, REVIEW_CELEBRATE_MS } from "../reviewCelebration.js";
import { MODULE_META, isOnTrack, bankedFor } from "../../lib/moduleStatus.js";
import ReviewedMark from "../ReviewedMark.jsx";
import { moduleLimits } from "../../lib/moduleLimits.js";
import { statusLabel } from "../statusLabel.js";
import MobileCashDeepDive from "../deepdive/MobileCashDeepDive.jsx";
import MobileStudentLoanDeepDive from "../deepdive/MobileStudentLoanDeepDive.jsx";
import MobileInvestmentsDeepDive from "../deepdive/MobileInvestmentsDeepDive.jsx";
import MobilePensionDeepDive from "../deepdive/MobilePensionDeepDive.jsx";
import MobileKidsDeepDive from "../deepdive/MobileKidsDeepDive.jsx";
import MobileTaxTrapDeepDive from "../deepdive/MobileTaxTrapDeepDive.jsx";

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
  kids: MobileKidsDeepDive,
  taxTrap: MobileTaxTrapDeepDive,
};

// `onShowReveal` replays its answer step by step (MobileModuleReveal), where
// the module has one; its "Explain this" link sits beside the module's name.
export default function MobileModuleDeepDive({ moduleKey, d, m, statuses, savingsRates, set, isComplete, onMarkReviewed, onBack, backLabel = null, onRecordLoanOverpayment, onRecordCrystallisedGain, onShowReveal }) {
  const meta = MODULE_META.find(mm => mm.key === moduleKey);
  const status = statuses[moduleKey]?.status || "na";
  // Status has exactly one visual indicator here — the dot below. The
  // header icon (module identity, not module status) stays neutral.
  const elsewhere = statuses[moduleKey]?.elsewhere || null;
  const onTrack = isOnTrack({ status, elsewhere }, bankedFor(d, moduleKey));
  const statusColor = onTrack ? PROGRESS_GREEN : isComplete || elsewhere ? MUT : (SC[status] || MUT);
  const Content = CONTENT_BY_KEY[moduleKey];
  // Same celebration as the Modules list (reviewCelebration.js): coins and a
  // gold warmth on the button, then "Reviewed" — only when marking complete
  // (not when un-marking). No "+N pts": reviewing a module doesn't move your
  // actual Candid score, so nothing here should imply it does.
  const [celebrating, setCelebrating] = useState(false);
  const handleReviewed = () => {
    if (celebrating) return;
    if (!isComplete) {
      setCelebrating(true);
      setTimeout(() => onMarkReviewed(), REVIEW_SWAP_MS);
      setTimeout(() => setCelebrating(false), REVIEW_CELEBRATE_MS);
    } else onMarkReviewed();
  };
  // Cash's first open is its tour (CashTour.jsx) instead; every open after
  // that starts on the intro like the other modules. Read as the page opens
  // (it's keyed by module), since the tour sets cashTourDone as it starts.
  const [introShown] = useState(() => moduleKey !== "cash" || !!d.cashTourDone);

  return (
    <div>
      {introShown && <GuidanceIntro key={moduleKey}/>}
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"20px"}}>
        <div style={{width:"42px",height:"42px",borderRadius:"11px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {meta?.icon && <meta.icon size={18} color={G}/>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            <h1 style={{fontFamily:SERIF,fontSize:"20px",color:TEXT,fontWeight:700,margin:0,lineHeight:1.2}}>{meta?.title || moduleKey}</h1>
            {isComplete && <span style={{display:"inline-flex",animation:celebrating ? "reviewedIn 0.6s ease-out" : "none"}}><ReviewedMark/></span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"5px",marginTop:"3px"}}>
            <span style={{width:"6px",height:"6px",borderRadius:"50%",background:statusColor,display:"inline-block"}}/>
            <span style={{fontSize:"12.5px",color:MUT}}>{statusLabel({status, elsewhere, onTrack})}</span>
          </div>
        </div>
        {/* The answer step by step, beside the module's name on every
            module, rather than inside the page. */}
        {onShowReveal && <div style={{alignSelf:"flex-start",marginTop:"6px"}}><ExplainLink onClick={onShowReveal}/></div>}
      </div>
      {set && <BankConfirm d={d} set={set} moduleKey={moduleKey} title={meta?.title || moduleKey} amount={statuses[moduleKey]?.amount || 0}/>}

      {Content ? (
        <Content d={d} m={m} statuses={statuses} savingsRates={savingsRates} set={set} onRecordLoanOverpayment={onRecordLoanOverpayment} onRecordCrystallisedGain={onRecordCrystallisedGain}/>
      ) : (
        <p style={{fontSize:"14px",color:MUT,lineHeight:1.6}}>This deep dive isn't built for mobile yet — check back soon, or view it on desktop.</p>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:"10px",marginTop:"20px"}}>
        <div style={{position:"relative"}}>
          {celebrating && (
            <div style={{position:"relative",pointerEvents:"none",height:0}}>
              <span style={{position:"absolute",top:"-8px",left:"calc(50% - 16px)",animation:`coinFloat ${REVIEW_COIN_S}s ease-in-out forwards`}}><Coins size={20} color={GOLD}/></span>
              <span style={{position:"absolute",top:"-8px",left:"calc(50% + 4px)",animation:`coinFloat ${REVIEW_COIN_S}s ease-in-out ${REVIEW_COIN_STAGGER_S}s forwards`}}><Coins size={20} color={GOLD}/></span>
            </div>
          )}
          <button onClick={handleReviewed} style={{
            width:"100%",background:"transparent",border:`1.3px solid ${isComplete?"rgba(45,107,74,0.35)":"rgba(22,47,36,0.25)"}`,
            color:isComplete?SUCCESS:G,borderRadius:"100px",padding:"12px",fontSize:"13.5px",fontWeight:600,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",
            transition:"border-color 0.6s ease, color 0.6s ease",
            animation: celebrating ? `btnGoldTint ${REVIEW_TINT_S}s ease-in-out` : "none",
          }}>
            {isComplete ? <span style={{display:"inline-flex",alignItems:"center",gap:"6px",animation:celebrating ? "reviewedIn 0.6s ease-out" : "none"}}><Check size={14}/> Reviewed</span> : "Mark as reviewed"}
          </button>
        </div>
        <button onClick={onBack} style={{width:"100%",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"12px",fontSize:"14px",fontWeight:600,cursor:"pointer"}}>
          {backLabel || "Back to Modules"}
        </button>
      </div>
      <GuidanceFooter moduleKey={moduleKey} limits={moduleLimits(moduleKey, d, m)}/>
    </div>
  );
}
