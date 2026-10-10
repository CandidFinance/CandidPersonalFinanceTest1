import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, User } from "lucide-react";
import { G, WHITE, MUT, TEXT, SERIF, MODULE_META } from "../../CandidApp.jsx";
import MobileOnboardingStep from "../onboarding/MobileOnboardingStep.jsx";
import ModuleInputsForm from "./ModuleInputsForm.jsx";
import { SCORED_MODULES } from "../../lib/appEntry.js";

// Edit inputs (/app/inputs): every answer on one page, so changing one
// figure is one tap away rather than a walk back through onboarding. About
// you and each answered module are tiles; a module's tile holds all of its
// questions as one form (ModuleInputsForm), so nothing needs the walk-through
// again. `open` opens that module's tile and scrolls to it (from a module
// page's Edit inputs); otherwise About you starts open. A module not
// answered yet starts its questions instead (`onStartModule`).
// `onOpenModule(key)` goes back to a module's page.
export default function MobileInputsScreen({ d, m, set, open, onStartModule, onOpenModule }) {
  const answered = SCORED_MODULES.filter(k => (d.selectedModules || []).includes(k));
  const notYet = SCORED_MODULES.filter(k => !answered.includes(k));
  const [openKey, setOpenKey] = useState(answered.includes(open) ? open : "about");
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
        {["about", ...answered].map(key => {
          const isOpen = openKey === key;
          const isModule = key !== "about";
          return (
            <div key={key} ref={el => { refs.current[key] = el; }} style={{...tile,scrollMarginTop:"80px"}}>
              <button type="button" onClick={() => setOpenKey(k => k === key ? null : key)} aria-expanded={isOpen}
                style={{width:"100%",display:"flex",alignItems:"center",gap:"12px",background:"none",border:"none",padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                {iconBox(key)}
                <span style={{flex:1,fontSize:"16px",fontWeight:700,color:TEXT}}>{title(key)}</span>
                <ChevronDown size={18} color={MUT} style={{transform:isOpen ? "rotate(180deg)" : "none",transition:"transform 0.2s"}}/>
              </button>
              {isOpen && (
                <div style={{padding:"4px 18px 18px",borderTop:"1px solid rgba(22,47,36,0.08)"}}>
                  <div style={{paddingTop:"14px"}}>
                    {isModule
                      ? <ModuleInputsForm moduleKey={key} d={d} m={m} set={set}/>
                      : <MobileOnboardingStep stepId="about" d={d} set={set} bare/>}
                  </div>
                  {isModule && (
                    <>
                      {/* The way back to the module's page, with the new figures. */}
                      <button type="button" onClick={() => onOpenModule(key)}
                        style={{marginTop:"22px",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"13px",fontSize:"14.5px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
                        Back to {title(key)}<ChevronRight size={16}/>
                      </button>
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
    </div>
  );
}
