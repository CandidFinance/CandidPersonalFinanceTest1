import { Check, ChevronRight, Home, Lock, Star } from "lucide-react";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, RADIUS_CARD } from "../design-tokens.js";
import { fmt } from "../lib/format.js";
import { MODULE_META } from "../lib/moduleStatus.js";
import { pitchFor, MODULE_DORMANT_LINE, isNewModule } from "../lib/appEntry.js";

// One module to start (or done): icon, title, what it gives you, then a
// chevron, or "Done" once answered. Shared by home with and without a
// report and the Modules tab, so a module waiting for answers looks the same
// everywhere. Tapping opens it, which starts its walk-through if needed.
// `estimate` (src/lib/crossModule.js moduleEstimate): a rough £ range from
// what's already known, shown in place of the pitch until it's answered.
// Where a module's actual figure sits (right of the title), as a range.
// `dormant`: not open to them yet (appEntry.js dormantModules): the same
// tile, not tappable, faded, with a lock for the chevron and what it's for
// and when it opens in place of the pitch.
// A module launched recently (appEntry.js isNewModule) has a gold star on
// its icon's corner.
export const estimateText = e => e.low === e.high ? `~${fmt(e.high)}/yr` : `${fmt(e.low)}–${fmt(e.high)}/yr`;

const PROPERTY_META = { key:"property", icon:Home, title:"Property" };
export const moduleMeta = key => key === "property" ? PROPERTY_META : MODULE_META.find(mm => mm.key === key);

const tileStyle = {
  background:WHITE, border:"1px solid rgba(22,47,36,0.08)", borderRadius:RADIUS_CARD, boxShadow:"0 2px 10px rgba(22,47,36,0.05)",
  padding:"14px 16px", display:"flex", alignItems:"center", gap:"12px", textAlign:"left", fontFamily:"inherit", width:"100%", boxSizing:"border-box",
};

function ModuleIcon({ mm }) {
  return (
    <div style={{position:"relative",width:"30px",height:"30px",borderRadius:"9px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      <mm.icon size={14} color={G}/>
      {isNewModule(mm.key) && (
        <span role="img" aria-label="New" style={{position:"absolute",top:"-5px",right:"-5px",width:"15px",height:"15px",borderRadius:"50%",background:WHITE,boxShadow:"0 1px 3px rgba(22,47,36,0.2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Star size={9} color={GOLD} fill={GOLD} strokeWidth={2}/>
        </span>
      )}
    </div>
  );
}

export default function ModuleStartRow({ moduleKey, d = null, done = false, estimate = null, onOpen, dormant = false }) {
  const mm = moduleMeta(moduleKey);
  if (dormant) return (
    <div aria-disabled="true" style={tileStyle}>
      <div style={{display:"flex",alignItems:"center",gap:"12px",flex:1,minWidth:0,opacity:0.55}}>
        <ModuleIcon mm={mm}/>
        <div style={{flex:1,minWidth:0}}>
          <span style={{fontSize:"14.5px",fontWeight:600,color:TEXT}}>{mm.title}</span>
          <div style={{fontSize:"12px",color:MUT,lineHeight:1.4,marginTop:"2px"}}>{MODULE_DORMANT_LINE[moduleKey]}</div>
        </div>
      </div>
      <Lock size={15} color={MUT} aria-label="Not open yet"/>
    </div>
  );
  return (
    <button type="button" onClick={() => onOpen(moduleKey)} style={{...tileStyle,cursor:"pointer"}}>
      <ModuleIcon mm={mm}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:"10px"}}>
          <span style={{fontSize:"14.5px",fontWeight:600,color:TEXT}}>{mm.title}</span>
          {estimate && !done && <span style={{fontFamily:SERIF,fontSize:"15px",fontWeight:700,color:G,whiteSpace:"nowrap"}}>{estimateText(estimate)}</span>}
        </div>
        {estimate && !done ? (
          <div style={{fontSize:"12px",color:MUT,lineHeight:1.4,marginTop:"2px"}}>Estimate: {estimate.line.charAt(0).toLowerCase() + estimate.line.slice(1)}</div>
        ) : (
          <div style={{fontSize:"12px",color:MUT,lineHeight:1.4,marginTop:"2px"}}>{pitchFor(moduleKey, d)}</div>
        )}
      </div>
      {done
        ? <span style={{display:"flex",alignItems:"center",gap:"4px",fontSize:"12px",fontWeight:700,color:G}}><Check size={14}/>Done</span>
        : <ChevronRight size={16} color={MUT}/>}
    </button>
  );
}
