import { motion, useReducedMotion } from "framer-motion";
import { NOTIFY_RED, WHITE } from "../design-tokens.js";

// The red count bubble for something new, like a phone's unread badge
// (visitNews.js): pinned to the top right corner of whatever it sits in
// (which needs position:relative and no overflow:hidden), or `inline`
// beside a title. Pops in; nothing when `count` is 0.
export const rateUpdatesLabel = n => `${n} best-rate ${n === 1 ? "update" : "updates"}`;

export default function NewBadge({ count, label, inline = false, style }) {
  const reduceMotion = useReducedMotion();
  if (!count) return null;
  return (
    <motion.span role="img" aria-label={label}
      initial={reduceMotion ? false : { scale: 0 }} animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 20, delay: 0.15 }}
      style={{
        ...(inline ? { position:"relative", display:"inline-block", verticalAlign:"middle" } : { position:"absolute", top:"-7px", right:"-7px", zIndex:2 }),
        minWidth:"20px", height:"20px", padding:"0 6px", boxSizing:"border-box", borderRadius:"10px",
        background:NOTIFY_RED, color:WHITE, fontSize:"11.5px", fontWeight:700, lineHeight:"20px", textAlign:"center",
        boxShadow:`0 0 0 2px ${WHITE}, 0 2px 6px rgba(255,59,48,0.35)`, pointerEvents:"none", ...style,
      }}>
      {count > 9 ? "9+" : count}
    </motion.span>
  );
}
