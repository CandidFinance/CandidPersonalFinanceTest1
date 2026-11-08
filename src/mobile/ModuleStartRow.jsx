import { Check, ChevronRight, Home, Lock, Star } from "lucide-react";
import { G, GOLD, MUT, TEXT, HAIRLINE, SANS } from "../design-tokens.js";
import { fmt } from "../lib/format.js";
import { MODULE_META } from "../lib/moduleStatus.js";
import { pitchFor, MODULE_DORMANT_LINE, isNewModule } from "../lib/appEntry.js";

// One module to start (or done), as a row in a list: icon, title, what it
// gives you, then a chevron, or "Done" once answered. Rows, not cards: a
// hairline above each, and the list closes with one below (HAIRLINE). Shared by home with and without a
// report and the Modules tab, so a module waiting for answers looks the same
// everywhere. Tapping opens it, which starts its walk-through if needed.
// `estimate` (src/lib/crossModule.js moduleEstimate): a rough £ range from
// what's already known, shown in place of the pitch until it's answered.
// Where a module's actual figure sits (right of the title), as a range.
// `dormant`: not open to them yet (appEntry.js dormantModules): the same
// row, not tappable, its icon faded, with a lock for the chevron and what it's for
// and when it opens in place of the pitch.
// A module launched recently (appEntry.js isNewModule) has a gold star on
// its icon's corner.
export const estimateText = e => e.low === e.high ? `~${fmt(e.high)}/yr` : `${fmt(e.low)}–${fmt(e.high)}/yr`;

const PROPERTY_META = { key:"property", icon:Home, title:"Property" };
export const moduleMeta = key => key === "property" ? PROPERTY_META : MODULE_META.find(mm => mm.key === key);

const tileStyle = {
  background:"none", border:"none", borderTop:HAIRLINE, borderRadius:0,
  padding:"14px 0", display:"flex", alignItems:"flex-start", gap:"14px", textAlign:"left", fontFamily:"inherit", width:"100%", boxSizing:"border-box",
};
// Every module row's icon sits on its title's line, however many lines the
// text under it runs to (Modules' own rows use these too); the chevron or
// lock at the end is centred on the row.
export const ROW_TITLE = { fontSize:"14.5px", fontWeight:600, color:TEXT, lineHeight:"20px" };
export const ROW_ICON = { size:18, strokeWidth:1.8, style:{ flexShrink:0, marginTop:"1px" } };
const END = { flexShrink:0, alignSelf:"center" };

function ModuleIcon({ mm }) {
  return (
    <div style={{position:"relative",display:"flex",flexShrink:0,marginTop:"1px"}}>
      <mm.icon size={18} color={G} strokeWidth={1.8}/>
      {isNewModule(mm.key) && (
        <span role="img" aria-label="New" style={{position:"absolute",top:"-6px",right:"-7px",display:"flex"}}>
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
      <span style={{opacity:0.55,display:"flex",flexShrink:0}}><ModuleIcon mm={mm}/></span>
      <div style={{flex:1,minWidth:0}}>
        <div style={ROW_TITLE}>{mm.title}</div>
        <div style={{fontSize:"12px",color:MUT,lineHeight:1.4,marginTop:"2px"}}>{MODULE_DORMANT_LINE[moduleKey]}</div>
      </div>
      <Lock size={15} color={MUT} role="img" aria-label="Not open yet" style={END}/>
    </div>
  );
  return (
    <button type="button" onClick={() => onOpen(moduleKey)} style={{...tileStyle,cursor:"pointer"}}>
      <ModuleIcon mm={mm}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:"10px"}}>
          <span style={ROW_TITLE}>{mm.title}</span>
          {estimate && !done && <span style={{fontFamily:SANS,fontSize:"15px",fontWeight:700,color:G,whiteSpace:"nowrap"}}>{estimateText(estimate)}</span>}
        </div>
        {estimate && !done ? (
          <div style={{fontSize:"12px",color:MUT,lineHeight:1.4,marginTop:"2px"}}>Estimate: {estimate.line.charAt(0).toLowerCase() + estimate.line.slice(1)}</div>
        ) : (
          <div style={{fontSize:"12px",color:MUT,lineHeight:1.4,marginTop:"2px"}}>{pitchFor(moduleKey, d)}</div>
        )}
      </div>
      {done
        ? <span style={{...END,display:"flex",alignItems:"center",gap:"4px",fontSize:"12px",fontWeight:700,color:G}}><Check size={14}/>Done</span>
        : <ChevronRight size={16} color={MUT} style={END}/>}
    </button>
  );
}
