import { useState } from "react";
import { Check } from "lucide-react";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, SC, MODULE_META } from "../../CandidApp.jsx";
import { getModuleBreakdown } from "../../lib/moduleStatus.js";
import { calcStudentLoanScenario } from "../../lib/studentLoan.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import { statusLabel } from "../statusLabel.js";

// Mobile Modules screen — matches the "Claude Design" mockup's Modules tab
// (count header, category/impact sort toggle, expandable module cards with a
// "Deep dive" + "Mark as reviewed" pair, plus two insight tiles) against real
// module data.

// Two label/value insight tiles per module, reusing figures already computed
// elsewhere (mm.amount, m.isaHeadroom, m.missedMatch, m.projectedPot) rather
// than re-deriving anything — calcStudentLoanScenario is the one exception,
// needed for its clear-year projection and already the single source of
// truth for that (shared with computeModuleStatuses).
function moduleInsights(mm, d, m) {
  switch (mm.key) {
    case "cash":
      return [
        { label: "Cash ISA gap", value: mm.amount > 0 ? `${fmtCompact(mm.amount)}/yr more` : "Optimised" },
        { label: "ISA allowance left", value: fmt(m.isaHeadroom) },
      ];
    case "investments":
      return [
        { label: "ISA headroom", value: fmt(m.isaHeadroom) },
        { label: "Unwrapped investments", value: fmt(+d.unwrappedValue||0) },
      ];
    case "pension":
      return [
        { label: "Employer match gap", value: m.missedMatch > 0 ? `${fmtCompact(m.missedMatch)}/yr` : "None" },
        { label: "Projected pot at retirement", value: fmt(m.projectedPot) },
      ];
    case "studentLoan": {
      if (d.studentLoan === "none") return [];
      const sl = calcStudentLoanScenario(d, m);
      return [
        { label: "Overpay benefit", value: sl.overpayAnnualBenefit > 0 ? `${fmtCompact(sl.overpayAnnualBenefit)}/yr` : "Not worth it" },
        { label: "Projected clear year", value: sl.willClear ? String(new Date().getFullYear() + sl.clearYr) : "Written off" },
      ];
    }
    default:
      return [];
  }
}

// Modules not yet built for anyone (hidden app-wide behind HIDE_MVP_MODULES,
// not just on mobile) — shown here as locked teasers so the roadmap is
// visible, rather than looking like the app only ever covers 4 areas.
// Icons/keys come from the shared MODULE_META; title/description here are
// this teaser's own copy, not MODULE_META's (which is written for the real,
// unlocked module elsewhere).
const LOCKED_MODULES = [
  { key:"mortgage", title:"Mortgages", description:"Overpay-vs-invest analysis, remortgage timing, and rate-change impact." },
  { key:"kids", title:"Family tax planning", description:"Junior ISAs, Child Benefit tapering, and tax-efficient gifting for your children." },
];

export default function MobileModulesScreen({ d, m, statuses, insights, completedModules, onMarkReviewed, onOpenModule }) {
  const [sortMode, setSortMode] = useState("amount");
  const [expandedKey, setExpandedKey] = useState(null);
  const { moduleList, modulesWithRec, needActionCount, totalOpp } = getModuleBreakdown(d, m, statuses, insights, sortMode);

  return (
    <div>
      <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>
        {moduleList.length} modules · {needActionCount} need action
      </div>

      {(modulesWithRec.length > 1 || totalOpp > 0) && (
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",marginTop:"12px",marginBottom:"18px"}}>
          <div style={{display:"flex",gap:"6px"}}>
            {modulesWithRec.length > 1 && [{ key:"category", label:"By category" }, { key:"amount", label:"By £ impact" }].map(opt => (
              <button key={opt.key} onClick={() => setSortMode(opt.key)} style={{
                border:"none",borderRadius:"100px",padding:"7px 14px",fontSize:"12.5px",fontWeight:600,cursor:"pointer",
                background:sortMode===opt.key?G:"#ede7db",color:sortMode===opt.key?WHITE:MUT,
              }}>{opt.label}</button>
            ))}
          </div>
          {totalOpp > 0 && (
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:"9.5px",fontWeight:700,color:MUT,letterSpacing:"0.07em",textTransform:"uppercase"}}>At stake</div>
              <div style={{fontFamily:SERIF,fontSize:"19px",fontWeight:700,color:GOLD,lineHeight:1.15}}>{fmtCompact(totalOpp)}/yr</div>
            </div>
          )}
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:"12px",marginTop:(modulesWithRec.length > 1 || totalOpp > 0) ? 0 : "16px"}}>
        {moduleList.map(mm => {
          const reviewed = completedModules.includes(mm.key);
          const hasRec = mm.amount > 0;
          const statusColor = reviewed ? "#a8a89c" : (SC[mm.status] || MUT);
          const isOpen = expandedKey === mm.key;
          const insights = isOpen ? moduleInsights(mm, d, m) : [];
          return (
            <div key={mm.key} style={{background:WHITE,borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",opacity:reviewed?0.6:1,overflow:"hidden"}}>
              <div onClick={() => setExpandedKey(k => k===mm.key ? null : mm.key)} style={{display:"flex",alignItems:"flex-start",gap:"14px",padding:"18px 18px 13px",cursor:"pointer"}}>
                <div style={{width:"42px",height:"42px",borderRadius:"11px",background:`${statusColor}1f`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"2px"}}>
                  {mm.icon && <mm.icon size={18} color={statusColor}/>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}}>
                    <div style={{fontSize:"16px",fontWeight:600,color:TEXT}}>{mm.title}</div>
                    <div style={{fontFamily:SERIF,fontWeight:700,fontSize:"16px",color:statusColor,flexShrink:0}}>
                      {reviewed ? "Completed" : hasRec ? `${fmtCompact(mm.amount)}${mm.amountIsLumpSum ? " by 18" : "/yr"}` : "On track"}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"5px",marginTop:"4px"}}>
                    <span style={{width:"6px",height:"6px",borderRadius:"50%",background:statusColor,display:"inline-block"}}/>
                    <span style={{fontSize:"12.5px",color:MUT}}>{statusLabel(mm, reviewed)}</span>
                  </div>
                </div>
                <span style={{fontSize:"14px",color:MUT,flexShrink:0,marginTop:"6px",display:"inline-block",transform:isOpen?"rotate(90deg)":"none",transition:"transform 0.15s"}}>›</span>
              </div>
              {isOpen && (
                <div style={{background:"rgba(22,47,36,0.03)",padding:"14px 18px 18px",display:"flex",flexDirection:"column",gap:"10px"}}>
                  <p style={{fontSize:"13px",color:"#4a4a4a",lineHeight:1.5,margin:0}}>{mm.summary}</p>
                  {insights.length > 0 && (
                    <div style={{display:"flex",gap:"10px"}}>
                      {insights.map((ins,i) => (
                        <div key={i} style={{flex:1,background:WHITE,borderRadius:"10px",padding:"10px 12px"}}>
                          <div style={{fontSize:"10px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase"}}>{ins.label}</div>
                          <div style={{fontSize:"14px",fontWeight:700,color:TEXT,marginTop:"4px"}}>{ins.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => onOpenModule(mm.key)} style={{width:"100%",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"12px",fontSize:"13.5px",fontWeight:700,cursor:"pointer"}}>
                    Deep dive · {mm.title}
                  </button>
                  {hasRec && (
                    <button onClick={() => onMarkReviewed(mm.key)} style={{
                      width:"100%",background:"transparent",border:`1.3px solid ${reviewed?"rgba(45,107,74,0.35)":"rgba(22,47,36,0.25)"}`,
                      color:reviewed?"#2d6b4a":G,borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,cursor:"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:"5px",
                    }}>
                      {reviewed ? <><Check size={13}/> Reviewed</> : "Mark as reviewed"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:"22px",marginBottom:"10px"}}>Coming soon</div>
      <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
        {LOCKED_MODULES.map(lm => {
          const meta = MODULE_META.find(mm => mm.key === lm.key);
          return (
            <div key={lm.key} style={{background:"rgba(255,255,255,0.55)",borderRadius:"16px",border:"1.5px dashed rgba(22,47,36,0.15)",padding:"18px",display:"flex",alignItems:"flex-start",gap:"14px"}}>
              <div style={{width:"42px",height:"42px",borderRadius:"11px",background:"rgba(22,47,36,0.05)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"2px"}}>
                {meta?.icon && <meta.icon size={18} color={MUT}/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}}>
                  <div style={{fontSize:"16px",fontWeight:600,color:MUT}}>{lm.title}</div>
                  <div style={{fontSize:"12px",fontWeight:700,color:MUT,flexShrink:0}}>Locked</div>
                </div>
                <p style={{fontSize:"13px",color:"#9a9a8e",lineHeight:1.5,marginTop:"6px",marginBottom:0}}>{lm.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
