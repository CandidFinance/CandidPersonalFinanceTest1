import { Check, ChevronRight, Home } from "lucide-react";
import { G, WHITE, MUT, TEXT, SERIF, RADIUS_CARD } from "../CandidApp.jsx";
import { fmt } from "../lib/format.js";
import { MODULE_META } from "../lib/moduleStatus.js";
import { MODULE_PITCH } from "../lib/appEntry.js";

// One module to start (or done): icon, title, what it gives you, then a
// chevron, or "Done" once answered. Shared by home with and without a
// report and the Modules tab, so a module waiting for answers looks the same
// everywhere. Tapping opens it, which starts its walk-through if needed.
// `estimate` (src/lib/crossModule.js moduleEstimate): a rough £ range from
// what's already known, shown in place of the pitch until it's answered.
export const estimateText = e => e.low === e.high ? `About ${fmt(e.high)} a year` : `${fmt(e.low)} to ${fmt(e.high)} a year`;

const PROPERTY_META = { key:"property", icon:Home, title:"Property" };
export const moduleMeta = key => key === "property" ? PROPERTY_META : MODULE_META.find(mm => mm.key === key);

export default function ModuleStartRow({ moduleKey, done = false, estimate = null, onOpen }) {
  const mm = moduleMeta(moduleKey);
  return (
    <button type="button" onClick={() => onOpen(moduleKey)} style={{
      background:WHITE, border:"1px solid rgba(22,47,36,0.08)", borderRadius:RADIUS_CARD, boxShadow:"0 2px 10px rgba(22,47,36,0.05)",
      padding:"14px 16px", display:"flex", alignItems:"center", gap:"12px", textAlign:"left", fontFamily:"inherit", cursor:"pointer", width:"100%",
    }}>
      <div style={{width:"30px",height:"30px",borderRadius:"9px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <mm.icon size={14} color={G}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:"14.5px",fontWeight:600,color:TEXT}}>{mm.title}</div>
        {estimate && !done ? (<>
          <div style={{fontFamily:SERIF,fontSize:"15px",fontWeight:700,color:G,marginTop:"3px"}}>{estimateText(estimate)}</div>
          <div style={{fontSize:"12px",color:MUT,lineHeight:1.4,marginTop:"1px"}}>Estimate: {estimate.line.charAt(0).toLowerCase() + estimate.line.slice(1)}</div>
        </>) : (
          <div style={{fontSize:"12px",color:MUT,lineHeight:1.4,marginTop:"2px"}}>{MODULE_PITCH[moduleKey]}</div>
        )}
      </div>
      {done
        ? <span style={{display:"flex",alignItems:"center",gap:"4px",fontSize:"12px",fontWeight:700,color:G}}><Check size={14}/>Done</span>
        : <ChevronRight size={16} color={MUT}/>}
    </button>
  );
}
