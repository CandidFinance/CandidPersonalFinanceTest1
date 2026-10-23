import { motion } from "framer-motion";
import { G, WHITE, MUT, TEXT, SANS } from "../../design-tokens.js";

// The pieces of Candid's conversations (the Chat tab's windfall check):
// message bubbles, the typing dots, and reply buttons. Messages arrive as in WhatsApp or iMessage.

// Grows from its tail corner (bottom left for Candid, bottom right for the
// user). Its corners are set one by one so framer-motion keeps them round
// while the bubble changes size; the content is a layout child too, so the
// text isn't stretched as the bubble grows around it.
const SPRING = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 };
export function Bubble({ from, typing, children }) {
  const mine = from === "user";
  const r = "18px", tail = "4px";
  return (
    <motion.div layout data-bubble
      initial={{ opacity: 0, scale: 0.8, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ ...SPRING, opacity: { duration: 0.2 } }}
      style={{
        alignSelf:mine ? "flex-end" : "flex-start", maxWidth:"82%",
        transformOrigin:mine ? "100% 100%" : "0% 100%",
        background:mine ? G : WHITE, color:mine ? WHITE : TEXT,
        border:mine ? "none" : "1px solid rgba(22,47,36,0.1)",
        borderTopLeftRadius:r, borderTopRightRadius:r,
        borderBottomLeftRadius:mine ? r : tail, borderBottomRightRadius:mine ? tail : r,
        padding:"11px 15px", fontSize:"14.5px", lineHeight:1.5,
      }}>
      <motion.div layout="position" key={typing ? "dots" : "text"}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, delay: typing ? 0 : 0.08 }}>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function Dots() {
  return (
    <span aria-label="Candid is typing" style={{display:"inline-flex",gap:"4px",padding:"4px 2px"}}>
      {[0, 1, 2].map(i => <span key={i} style={{width:"7px",height:"7px",borderRadius:"50%",background:MUT,animation:`entryDot 1.2s ${i * 0.15}s infinite ease-in-out`}}/>)}
    </span>
  );
}
// The dots' bounce; render once wherever Dots are used.
export const DotsKeyframes = () => <style>{`@keyframes entryDot{0%,80%,100%{opacity:0.25;transform:translateY(0);}40%{opacity:1;transform:translateY(-3px);}}`}</style>;

export const Replies = ({ children }) => <div style={{display:"flex",flexWrap:"wrap",justifyContent:"flex-end",gap:"8px"}}>{children}</div>;
export const ReplyButton = ({ onClick, disabled, children }) => (
  <button type="button" onClick={onClick} disabled={disabled} style={{background:WHITE,color:G,border:`1.5px solid ${G}`,borderRadius:"100px",padding:"10px 16px",fontSize:"14px",fontWeight:700,fontFamily:SANS,cursor:disabled ? "default" : "pointer",opacity:disabled ? 0.5 : 1}}>{children}</button>
);
