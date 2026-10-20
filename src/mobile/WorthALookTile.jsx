import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { WHITE, MUT, TEXT, RADIUS_CARD } from "../design-tokens.js";
import ModuleStartRow from "./ModuleStartRow.jsx";

// Home's "Worth a look": the modules they haven't started, each a tile of
// its own inside this one, largest rough £ first. Dismissed with the X or a
// swipe either way; `onDismiss` keeps it away until a module it didn't hold
// appears (appEntry.js worthALookShown). The modules stay on the Modules tab.
const SWIPE = 90;

export default function WorthALookTile({ items, d, onOpen, onDismiss }) {
  const [leaving, setLeaving] = useState(0);
  // A drag that ends on a row mustn't open it.
  const dragged = useRef(false);
  return (
    <motion.section drag="x" dragSnapToOrigin dragElastic={0.5}
      onDragStart={() => { dragged.current = true; }}
      onDragEnd={(e, info) => {
        setTimeout(() => { dragged.current = false; }, 0);
        if (Math.abs(info.offset.x) > SWIPE || Math.abs(info.velocity.x) > 600) setLeaving(info.offset.x < 0 ? -1 : 1);
      }}
      onClickCapture={e => { if (dragged.current) { e.preventDefault(); e.stopPropagation(); } }}
      animate={leaving ? { x: leaving * 480, opacity: 0 } : { x: 0, opacity: 1 }}
      transition={{ duration: 0.25 }}
      onAnimationComplete={() => { if (leaving) onDismiss(); }}
      style={{marginTop:"16px",background:WHITE,borderRadius:RADIUS_CARD,boxShadow:"0 2px 10px rgba(22,47,36,0.06)",padding:"16px 14px",touchAction:"pan-y"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"10px",padding:"0 0 0 4px"}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:"15px",fontWeight:700,color:TEXT}}>Worth a look</div>
          <div style={{fontSize:"12.5px",color:MUT,marginTop:"2px"}}>Modules you haven't started yet</div>
        </div>
        <button type="button" aria-label="Dismiss" onClick={() => setLeaving(1)} style={{background:"none",border:"none",padding:"2px",margin:"-2px -2px 0 0",cursor:"pointer",color:MUT,display:"flex",flexShrink:0}}>
          <X size={18}/>
        </button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"8px",marginTop:"14px"}}>
        {items.map(({ key, estimate }) => <ModuleStartRow key={key} moduleKey={key} d={d} estimate={estimate} onOpen={onOpen}/>)}
      </div>
    </motion.section>
  );
}
