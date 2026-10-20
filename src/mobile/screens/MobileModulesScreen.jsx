import { useState } from "react";
import { childcareSupport } from "../../lib/childcare.js";
import { Check, Users, Coins, ChevronRight, Home } from "lucide-react";
import { SUCCESS, G, GOLD, WHITE, MUT, TEXT, SERIF, SC, CDARK } from "../../design-tokens.js";
import { getModuleBreakdown, MODULE_META } from "../../lib/moduleStatus.js";
import { calcStudentLoanScenario } from "../../lib/studentLoan.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import { statusLabel } from "../statusLabel.js";
import { notStarted, dormantModules, MODULE_PITCH } from "../../lib/appEntry.js";
import { taxTrap } from "../../lib/taxTrap.js";
import ModuleStartRow from "../ModuleStartRow.jsx";
import BankConfirm from "../BankConfirm.jsx";
import { moduleEstimate } from "../../lib/crossModule.js";
import { isLocked } from "../../lib/unlock.js";

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
        { label: "Paying off now", value: sl.overpayAnnualBenefit > 0 ? `${fmtCompact(sl.overpayAnnualBenefit)}/yr` : "Not worth it" },
        { label: "Projected clear year", value: sl.willClear ? String(new Date().getFullYear() + sl.clearYr) : "Written off" },
      ];
    }
    case "kids": {
      const cc = childcareSupport(d, m);
      if (!cc) return [];
      return [
        { label: "Childcare support", value: `${fmtCompact(cc.atStake)}/yr` },
        { label: "£100,000 limit", value: cc.state === "near" || cc.state === "fine" ? `${fmtCompact(cc.headroom)} under` : cc.state === "lost" ? "Over" : cc.state === "partner" ? "Partner over" : "Not working" },
      ];
    }
    case "taxTrap": {
      const t = taxTrap(d, m);
      if (!t) return [];
      return [
        { label: t.over ? "Your rate on the next £1,000" : "Your rate past £100,000", value: `${Math.round((t.over ? t.rate.rate : t.trapRate) * 1000) / 10}%` },
        { label: "£100,000 limit", value: t.over ? `${fmtCompact(t.needed)} over` : `${fmtCompact(t.headroom)} under` },
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
// unlocked module elsewhere). An entry with no MODULE_META counterpart
// (e.g. household) supplies its own `icon`.
// The old "Mortgages" teaser is now the open Property entry above these
// (Property absorbs mortgages).
const LOCKED_MODULES = [
  { key:"household", title:"Household finances", icon:Users, description:"Two people, one plan. Marriage or a civil partnership changes the picture, from shared allowances to how you hold savings and investments." },
];

export default function MobileModulesScreen({ d, m, set, statuses, insights, completedModules, onMarkReviewed, onOpenModule, onOpenProperty }) {
  const [sortMode, setSortMode] = useState("amount");
  const [expandedKey, setExpandedKey] = useState(null);
  // Same celebration as the module deep dive (MobileModuleDeepDive) — coins
  // only, no "+N pts" — shown here too now, since this list is the other
  // place "Mark as reviewed" can be tapped from. Tracks which single tile is
  // celebrating, not a per-tile state array, since only one can be reviewed
  // at a time from a tap.
  const [celebratingKey, setCelebratingKey] = useState(null);
  const { moduleList, modulesWithRec, needActionCount, totalOpp, totalBanked } = getModuleBreakdown(d, m, statuses, insights, sortMode);
  const waiting = notStarted(d).filter(k => k !== "property");
  // Not open to them yet (the £100k tax trap under £90,000): greyed, after
  // the rest, so they know it's there.
  const dormant = dormantModules(d);
  const notApplicable = MODULE_META.filter(mm => statuses[mm.key]?.notApplicable);

  return (
    <div>
      <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>
        {moduleList.length} modules · {needActionCount} need action
      </div>

      {(modulesWithRec.length > 1 || totalOpp > 0 || totalBanked > 0) && (
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",marginTop:"12px",marginBottom:"18px"}}>
          <div style={{display:"flex",gap:"6px"}}>
            {modulesWithRec.length > 1 && [{ key:"category", label:"By category" }, { key:"amount", label:"By £ impact" }].map(opt => (
              <button key={opt.key} onClick={() => setSortMode(opt.key)} style={{
                border:"none",borderRadius:"100px",padding:"7px 14px",fontSize:"12.5px",fontWeight:600,cursor:"pointer",
                background:sortMode===opt.key?G:CDARK,color:sortMode===opt.key?WHITE:MUT,
              }}>{opt.label}</button>
            ))}
          </div>
          {/* Banked: what's come off the £ at stake since each module was
              first answered (moduleStatus.js bankedFor). At stake: what's
              still available, the sum of the tiles below. */}
          <div style={{display:"flex",gap:"18px",flexShrink:0}}>
            {totalBanked > 0 && (
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:"9.5px",fontWeight:700,color:MUT,letterSpacing:"0.07em",textTransform:"uppercase"}}>Banked</div>
                <div style={{fontFamily:SERIF,fontSize:"19px",fontWeight:700,color:SUCCESS,lineHeight:1.15}}>{fmtCompact(totalBanked)}/yr</div>
              </div>
            )}
            {totalOpp > 0 && (
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:"9.5px",fontWeight:700,color:MUT,letterSpacing:"0.07em",textTransform:"uppercase"}}>At stake</div>
                <div style={{fontFamily:SERIF,fontSize:"19px",fontWeight:700,color:GOLD,lineHeight:1.15}}>{fmtCompact(totalOpp)}/yr</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:"12px",marginTop:(modulesWithRec.length > 1 || totalOpp > 0 || totalBanked > 0) ? 0 : "16px"}}>
        {moduleList.map(mm => {
          const reviewed = completedModules.includes(mm.key);
          const hasRec = mm.amount > 0;
          // Priority reads through the headline figure and status dot, both
          // coloured by statusColor. The module icon stays neutral (module
          // identity, not urgency), and the tile itself stays flat white.
          const statusColor = reviewed ? MUT : (SC[mm.status] || MUT);
          const isOpen = expandedKey === mm.key;
          const insights = isOpen ? moduleInsights(mm, d, m) : [];
          return (
            <div key={mm.key} style={{background:WHITE,borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",overflow:"hidden"}}>
              <div onClick={() => setExpandedKey(k => k===mm.key ? null : mm.key)} style={{display:"flex",alignItems:"flex-start",gap:"14px",padding:"18px 18px 13px",cursor:"pointer"}}>
                <div style={{width:"42px",height:"42px",borderRadius:"11px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"2px"}}>
                  {mm.icon && <mm.icon size={18} color={G}/>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}}>
                    <div style={{fontSize:"16px",fontWeight:600,color:TEXT}}>{mm.title}</div>
                    <div style={{fontFamily:SERIF,fontWeight:700,fontSize:"16px",color:statusColor,flexShrink:0}}>
                      {hasRec ? `${fmtCompact(mm.amount)}${mm.amountIsLumpSum ? " by 18" : "/yr"}` : "On track"}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"5px",marginTop:"4px"}}>
                    <span style={{width:"6px",height:"6px",borderRadius:"50%",background:statusColor,display:"inline-block"}}/>
                    <span style={{fontSize:"12.5px",color:MUT}}>{statusLabel(mm, reviewed)}</span>
                    {mm.banked > 0 && <span style={{fontSize:"12.5px",color:SUCCESS,fontWeight:700}}>· {fmtCompact(mm.banked)}/yr banked</span>}
                  </div>
                </div>
                <ChevronRight size={14} color={MUT} style={{flexShrink:0,marginTop:"6px",transform:isOpen?"rotate(90deg)":"none",transition:"transform 0.15s"}}/>
              </div>
              {set && <BankConfirm compact d={d} set={set} moduleKey={mm.key} title={mm.title} amount={mm.amount}/>}
              {isOpen && (
                <div style={{background:"rgba(22,47,36,0.03)",padding:"14px 18px 18px",display:"flex",flexDirection:"column",gap:"10px"}}>
                  {/* A locked answer (src/lib/unlock.js) stays hidden here too. */}
                  <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,margin:0}}>{isLocked(d, mm.key) ? "Your position is ready. Open it to unlock it." : mm.summary}</p>
                  {!isLocked(d, mm.key) && insights.length > 0 && (
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
                    <div style={{position:"relative"}}>
                      {celebratingKey === mm.key && (
                        <div style={{position:"relative",pointerEvents:"none",height:0}}>
                          <span style={{position:"absolute",top:"-8px",left:"calc(50% - 16px)",animation:"coinFloat 0.9s ease-out forwards"}}><Coins size={18} color={GOLD}/></span>
                          <span style={{position:"absolute",top:"-8px",left:"calc(50% + 4px)",animation:"coinFloat 0.9s ease-out 0.15s forwards"}}><Coins size={18} color={GOLD}/></span>
                        </div>
                      )}
                      <button onClick={() => {
                        if (!reviewed) {
                          setCelebratingKey(mm.key);
                          setTimeout(() => setCelebratingKey(k => k === mm.key ? null : k), 900);
                        }
                        onMarkReviewed(mm.key);
                      }} style={{
                        width:"100%",background:"transparent",border:`1.3px solid ${reviewed?"rgba(45,107,74,0.35)":"rgba(22,47,36,0.25)"}`,
                        color:reviewed?SUCCESS:G,borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,cursor:"pointer",
                        display:"flex",alignItems:"center",justifyContent:"center",gap:"5px",
                      }}>
                        {reviewed ? <><Check size={13}/> Reviewed</> : "Mark as reviewed"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modules with no answers yet: not in the ranking above (they read as
          not applicable until answered), so listed here, picks first, each
          opening its walk-through. Property has its own entry below. */}
      {/* Answered, but nothing in it applies (Kids & family with no
          children and none planned): greyed, and still there to change. */}
      {notApplicable.length > 0 && (<>
        <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:moduleList.length ? "22px" : "16px",marginBottom:"10px"}}>Not applicable</div>
        <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          {notApplicable.map(mm => (
            <button key={mm.key} type="button" onClick={() => onOpenModule(mm.key)} style={{display:"flex",alignItems:"center",gap:"12px",width:"100%",textAlign:"left",background:"rgba(22,47,36,0.03)",border:"1px solid rgba(22,47,36,0.08)",borderRadius:"14px",padding:"14px 16px",cursor:"pointer",fontFamily:"inherit",opacity:0.6}}>
              <div style={{width:"30px",height:"30px",borderRadius:"9px",background:"rgba(22,47,36,0.06)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <mm.icon size={14} color={MUT}/>
              </div>
              <span style={{flex:1,fontSize:"14.5px",fontWeight:600,color:MUT}}>{mm.title}</span>
              <span style={{fontSize:"12px",color:MUT}}>Not applicable</span>
            </button>
          ))}
        </div>
      </>)}

      {(waiting.length > 0 || dormant.length > 0) && (<>
        <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:moduleList.length ? "22px" : "16px",marginBottom:"10px"}}>Not started</div>
        <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          {waiting.map(key => <ModuleStartRow key={key} moduleKey={key} d={d} estimate={moduleEstimate(key, d, m)} onOpen={onOpenModule}/>)}
          {dormant.map(key => <ModuleStartRow key={key} moduleKey={key} d={d} dormant onOpen={onOpenModule}/>)}
        </div>
      </>)}

      {/* Property sits outside the ranked list above: it has no £ figure
          until the rent vs buy engine exists, so it can't be sorted by impact
          yet. See MobilePropertyScreen. */}
      <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:"22px",marginBottom:"10px"}}>New</div>
      <button type="button" onClick={onOpenProperty} style={{width:"100%",textAlign:"left",fontFamily:"inherit",background:WHITE,border:"none",borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",padding:"18px",display:"flex",alignItems:"flex-start",gap:"14px",cursor:"pointer"}}>
        <div style={{width:"42px",height:"42px",borderRadius:"11px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"2px"}}>
          <Home size={18} color={G}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}}>
            <div style={{fontSize:"16px",fontWeight:600,color:TEXT}}>Property</div>
            <ChevronRight size={18} color={MUT} style={{flexShrink:0}}/>
          </div>
          <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,marginTop:"6px",marginBottom:0}}>{MODULE_PITCH.property}</p>
        </div>
      </button>

      <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:"22px",marginBottom:"10px"}}>Coming soon</div>
      <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
        {LOCKED_MODULES.map(lm => {
          const LockedIcon = lm.icon || MODULE_META.find(mm => mm.key === lm.key)?.icon;
          return (
            <div key={lm.key} style={{background:"rgba(255,255,255,0.55)",borderRadius:"16px",border:"1.5px dashed rgba(22,47,36,0.15)",padding:"18px",display:"flex",alignItems:"flex-start",gap:"14px"}}>
              <div style={{width:"42px",height:"42px",borderRadius:"11px",background:"rgba(22,47,36,0.05)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"2px"}}>
                {LockedIcon && <LockedIcon size={18} color={MUT}/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}}>
                  <div style={{fontSize:"16px",fontWeight:600,color:MUT}}>{lm.title}</div>
                  <div style={{fontSize:"12px",fontWeight:700,color:MUT,flexShrink:0}}>Locked</div>
                </div>
                <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,marginTop:"6px",marginBottom:0}}>{lm.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
