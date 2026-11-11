import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { G, MUT } from "../design-tokens.js";

// "Worked out on your own figures." at the top of a quick-started module,
// once its last estimate is replaced: shown once, for a few seconds, then it
// folds away and the page moves up. `seen` (d.ownFiguresSeen[module]) is set
// as it folds, so it doesn't come back on a later visit (leaving sooner, it
// shows again next time).
// Mounted once per module page (the page is keyed by module), so the timer
// runs from the first render only.
const SHOW_MS = 4000;
export default function OwnFiguresNote({ seen, onSeen, onEdit }) {
  const reduceMotion = useReducedMotion();
  const [show, setShow] = useState(!seen);
  useEffect(() => {
    if (seen) return;
    const t = setTimeout(() => { setShow(false); onSeen(); }, SHOW_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.p exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.2, 0, 0, 1] }}
          style={{fontSize:"13px",color:MUT,lineHeight:1.5,margin:"0 0 14px",display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap",overflow:"hidden"}}>
          <Check size={14} strokeWidth={2.5} color={G} aria-hidden="true"/>
          <span>Worked out on your own figures.</span>
          <button type="button" onClick={onEdit} style={{background:"none",border:"none",padding:0,color:G,fontSize:"13px",fontWeight:700,fontFamily:"inherit",cursor:"pointer",textDecoration:"underline"}}>Edit</button>
        </motion.p>
      )}
    </AnimatePresence>
  );
}
