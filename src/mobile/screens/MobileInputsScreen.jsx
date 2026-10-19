import { hasAccess, accessInfo, openBillingPortal, PLANS } from "../../lib/entitlement.js";
import SignInSetup, { switchAccount } from "../SignInSetup.jsx";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, User } from "lucide-react";
import { G, WHITE, MUT, TEXT, SERIF, ERROR_TEXT } from "../../design-tokens.js";
import { MODULE_META } from "../../lib/moduleStatus.js";
import MobileOnboardingStep from "../onboarding/MobileOnboardingStep.jsx";
import ModuleInputsForm from "./ModuleInputsForm.jsx";
import { SCORED_MODULES, loanSavingsIn, loanPensionChecked } from "../../lib/appEntry.js";

// Edit inputs (/app/inputs): every answer on one page, so changing one
// figure is one tap away rather than a walk back through onboarding. About
// you and each answered module are tiles; a module's tile holds all of its
// questions as one form (ModuleInputsForm), so nothing needs the walk-through
// again. `open` opens that module's tile and scrolls to it (from a module
// page's Edit inputs); otherwise About you starts open. A module not
// answered yet starts its questions instead (`onStartModule`).
// `onOpenModule(key)` goes back to a module's page.
// Tapping empty space in an open tile closes it, as on a phone, so its
// header doesn't need scrolling back to. Not a tap on anything that responds
// to one (a field, a pill, a slider, a link), nor one that started on such a
// thing, so a slider let go of over empty space stays open.
const INTERACTIVE = "button,input,select,textarea,a,label,[role],[contenteditable],svg";
function onSomething(target, container) {
  for (let el = target; el && el !== container; el = el.parentElement) {
    if (el.matches?.(INTERACTIVE)) return true;
    const cursor = getComputedStyle(el).cursor;
    if (cursor === "pointer" || cursor === "grab" || cursor === "text") return true;
  }
  return false;
}

export default function MobileInputsScreen({ d, m, set, open, onStartModule, onOpenModule }) {
  const pressedOn = useRef(false);
  const answered = SCORED_MODULES.filter(k => (d.selectedModules || []).includes(k));
  // Cash & savings and Pension answered only as far as Student loan needs
  // (its short route): those answers, and only those, to change here.
  const partly = SCORED_MODULES.filter(k => !answered.includes(k) && ((k === "cash" && loanSavingsIn(d)) || (k === "pension" && loanPensionChecked(d))));
  const notYet = SCORED_MODULES.filter(k => !answered.includes(k) && !partly.includes(k));
  const shown = [...answered, ...partly];
  const [openKey, setOpenKey] = useState([...answered, "cash", "pension"].includes(open) ? open : "about");
  const refs = useRef({});

  useEffect(() => {
    const el = openKey && refs.current[openKey];
    if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const title = key => key === "about" ? "About you" : MODULE_META.find(mm => mm.key === key)?.title || key;
  const icon = key => key === "about" ? User : MODULE_META.find(mm => mm.key === key)?.icon;
  const tile = { background:WHITE, border:"1px solid rgba(22,47,36,0.1)", borderRadius:"16px" };
  const label = { fontSize:"10.5px", fontWeight:600, color:MUT, letterSpacing:"0.09em", textTransform:"uppercase" };
  const iconBox = key => {
    const Icon = icon(key);
    return (
      <div style={{width:"34px",height:"34px",borderRadius:"9px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        {Icon && <Icon size={16} color={G}/>}
      </div>
    );
  };

  return (
    <div>
      <h1 style={{fontFamily:SERIF,fontSize:"24px",color:G,fontWeight:700,margin:"0 0 6px"}}>Your inputs</h1>
      <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.5,margin:"0 0 20px"}}>Change anything here and your figures update straight away.</p>

      <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
        {["about", ...shown].map(key => {
          const isOpen = openKey === key;
          const isModule = key !== "about";
          const isPartly = partly.includes(key);
          return (
            <div key={key} ref={el => { refs.current[key] = el; }} style={{...tile,scrollMarginTop:"80px"}}>
              <button type="button" onClick={() => setOpenKey(k => k === key ? null : key)} aria-expanded={isOpen}
                style={{width:"100%",display:"flex",alignItems:"center",gap:"12px",background:"none",border:"none",padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                {iconBox(key)}
                <span style={{flex:1,minWidth:0}}>
                  <span style={{display:"block",fontSize:"16px",fontWeight:700,color:TEXT}}>{title(key)}</span>
                  {isPartly && <span style={{display:"block",fontSize:"12px",color:MUT,marginTop:"2px"}}>What your student loan answer uses</span>}
                </span>
                <ChevronDown size={18} color={MUT} style={{transform:isOpen ? "rotate(180deg)" : "none",transition:"transform 0.2s"}}/>
              </button>
              {isOpen && (
                <div style={{padding:"4px 18px 18px",borderTop:"1px solid rgba(22,47,36,0.08)"}}
                  onPointerDown={e => { pressedOn.current = onSomething(e.target, e.currentTarget); }}
                  onClick={e => {
                    if (pressedOn.current || onSomething(e.target, e.currentTarget)) return;
                    setOpenKey(null);
                    const top = refs.current[key]?.getBoundingClientRect().top;
                    if (top < 70) refs.current[key].scrollIntoView({ behavior: "smooth", block: "start" });
                  }}>
                  <div style={{paddingTop:"14px"}}>
                    {isModule
                      ? <ModuleInputsForm moduleKey={key} d={d} m={m} set={set} brief={isPartly}/>
                      : <MobileOnboardingStep stepId="about" d={d} set={set} bare/>}
                  </div>
                  {isModule && (
                    <>
                      {/* The way back to the module's page, with the new figures:
                          for one answered only as far as Student loan needs, to
                          Student loan, and the rest of its questions after. */}
                      <button type="button" onClick={() => onOpenModule(isPartly ? "studentLoan" : key)}
                        style={{marginTop:"22px",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"13px",fontSize:"14.5px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
                        Back to {title(isPartly ? "studentLoan" : key)}<ChevronRight size={16}/>
                      </button>
                      {isPartly && (
                        <button type="button" onClick={() => onStartModule(key)}
                          style={{marginTop:"10px",width:"100%",background:"none",border:"none",padding:"8px",fontSize:"13.5px",fontWeight:700,color:G,fontFamily:"inherit",cursor:"pointer"}}>
                          Answer the rest of {title(key)}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {notYet.length > 0 && (
        <>
          <div style={{...label,margin:"24px 0 10px"}}>Not started</div>
          <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
            {notYet.map(key => (
              <button key={key} type="button" onClick={() => onStartModule(key)}
                style={{...tile,display:"flex",alignItems:"center",gap:"12px",padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",width:"100%"}}>
                {iconBox(key)}
                <span style={{flex:1,fontSize:"16px",fontWeight:700,color:TEXT}}>{title(key)}</span>
                <span style={{fontSize:"13px",fontWeight:700,color:G}}>Start</span>
                <ChevronRight size={16} color={MUT}/>
              </button>
            ))}
          </div>
        </>
      )}

      <Subscription/>
    </div>
  );
}

// For a subscriber: their plan, Stripe's page to change or cancel it, and
// their ways to sign in on another device (SignInSetup).
// A "comp" plan (a free row added by hand in `subscriptions`, for testing)
// has no Stripe customer, so no portal.
function Subscription() {
  const [error, setError] = useState(null);
  if (!hasAccess()) return null;
  const a = accessInfo();
  const comp = a.plan === "comp";
  const planLabel = comp ? "complimentary" : PLANS[a.plan]?.label.toLowerCase();
  const until = a.periodEnd ? new Date(a.periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  return (
    <div style={{marginTop:"28px",paddingTop:"16px",borderTop:"1px solid rgba(22,47,36,0.1)"}}>
      <div style={{fontSize:"14px",fontWeight:700,color:TEXT}}>Candid subscription{planLabel ? `, ${planLabel}` : ""}</div>
      <div style={{fontSize:"12.5px",color:MUT,marginTop:"3px"}}>{a.email}{until ? ` · ${a.cancelling ? "ends" : "renews"} ${until}` : ""}</div>
      <div style={{display:"flex",gap:"20px"}}>
        {!comp && <button type="button" onClick={() => openBillingPortal().catch(e => setError(e.message))}
          style={{background:"none",border:"none",padding:"8px 0 0",color:G,fontSize:"13px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
          Manage subscription
        </button>}
        <button type="button" onClick={() => switchAccount("edit_inputs")}
          style={{background:"none",border:"none",padding:"8px 0 0",color:G,fontSize:"13px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
          Sign out
        </button>
      </div>
      {error && <div style={{fontSize:"12px",color:ERROR_TEXT}}>{error}</div>}
      <SignInSetup/>
    </div>
  );
}
