import { motion } from "framer-motion";
import { ChevronRight, CornerDownRight, Sparkles } from "lucide-react";
import { G, GOLD, WHITE, MUT, TEXT, SANS, CDARK, GOLD_TEXT } from "../../design-tokens.js";

// The pieces of Candid's conversations (the Chat tab's Q&A and windfall
// check): message bubbles, the typing dots, reply buttons, and the Q&A's
// module hand-off and Ask next follow-ups. Messages arrive as in WhatsApp or iMessage.

// The user's messages are white tiles that grow from their tail corner
// (bottom right). Candid's sit on the page as plain text, no box, and fade
// up. Corners are set one by one so framer-motion keeps them round while the
// bubble changes size; the content is a layout child too, so the text isn't
// stretched as the bubble grows around it.
const SPRING = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 };
export function Bubble({ from, typing, children }) {
  const mine = from === "user";
  const r = "18px", tail = "4px";
  return (
    <motion.div layout data-bubble
      initial={mine ? { opacity: 0, scale: 0.8, y: 14 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ ...SPRING, opacity: { duration: 0.25 } }}
      style={mine ? {
        alignSelf:"flex-end", maxWidth:"82%", transformOrigin:"100% 100%",
        background:WHITE, color:TEXT, boxShadow:"0 1px 3px rgba(22,47,36,0.08)",
        borderTopLeftRadius:r, borderTopRightRadius:r, borderBottomLeftRadius:r, borderBottomRightRadius:tail,
        padding:"11px 15px", fontSize:"14.5px", lineHeight:1.5,
      } : {
        alignSelf:"flex-start", maxWidth:"92%", color:TEXT,
        padding:"4px 2px", fontSize:"15px", lineHeight:1.55,
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

// Before an answer: the Candid Assist sparkle and a sheen across
// "Thinking". SheenKeyframes also holds the build-in animations for answers
// (words, rows, bars); render it once wherever they're used.
export function Thinking() {
  return (
    <span role="status" aria-label="Candid is thinking" style={{display:"inline-flex",alignItems:"center",gap:"8px",padding:"1px 0"}}>
      <Sparkles size={16} color={GOLD} className="chat-sheen-icon" aria-hidden="true"/>
      <span className="chat-sheen" style={{fontSize:"14px",fontWeight:600,fontFamily:SANS}}>Thinking</span>
    </span>
  );
}
export const SheenKeyframes = () => <style>{`
.chat-sheen{background:linear-gradient(90deg,${MUT} 0%,${MUT} 35%,${GOLD} 50%,${MUT} 65%,${MUT} 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:chatSheen 1.5s linear infinite;}
.chat-sheen-icon{animation:chatGlint 1.5s ease-in-out infinite;}
@keyframes chatSheen{from{background-position:100% 0;}to{background-position:-50% 0;}}
@keyframes chatGlint{0%,100%{opacity:0.55;transform:scale(0.9) rotate(0deg);}50%{opacity:1;transform:scale(1.05) rotate(12deg);}}
.chat-word{display:inline;animation:chatWord 0.4s ease-out both;}
.chat-in{animation:chatIn 0.45s cubic-bezier(0.2,0.8,0.2,1) both;animation-delay:calc(var(--i, 0) * 120ms + 250ms);}
.chat-grow{transform-origin:0 50%;animation:chatGrow 0.7s cubic-bezier(0.2,0.8,0.2,1) both;animation-delay:calc(var(--i, 0) * 140ms + 300ms);}
@keyframes chatWord{from{opacity:0;filter:blur(4px);}to{opacity:1;filter:blur(0);}}
@keyframes chatIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
@keyframes chatGrow{from{transform:scaleX(0);}to{transform:scaleX(1);}}
@media (prefers-reduced-motion: reduce){.chat-sheen,.chat-sheen-icon,.chat-word,.chat-in,.chat-grow{animation:none;}.chat-sheen{background:none;color:${MUT};}}
`}</style>;

// The Q&A chat's hand-off: a dark card into the module with the user's own
// figures. Full width, outside a Bubble.
export function ModuleButton({ title, sub, onClick }) {
  return (
    <button type="button" onClick={onClick} data-chat-module
      style={{alignSelf:"flex-start",width:"92%",display:"flex",alignItems:"center",gap:"12px",padding:"12px 14px",borderRadius:"16px",border:"none",background:G,color:WHITE,textAlign:"left",fontFamily:SANS,cursor:"pointer"}}>
      <span style={{flex:1,minWidth:0}}>
        <span style={{display:"block",fontSize:"14.5px",fontWeight:700}}>Open {title}</span>
        {sub && <span style={{display:"block",fontSize:"12px",opacity:0.75}}>{sub}</span>}
      </span>
      <ChevronRight size={18} aria-hidden="true"/>
    </button>
  );
}

// Suggested follow-ups: options for the user, set apart from the answer by
// a rule, a label and tinted pills with no border, in rows that wrap.
export function AskNext({ items, onAsk, label = "Ask next" }) {
  return (
    <div role="group" aria-label={label} style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"8px",marginTop:"14px",paddingTop:"12px",borderTop:"1px dashed rgba(22,47,36,0.18)"}}>
      <span aria-hidden="true" style={{fontSize:"11px",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:MUT}}>{label}</span>
      <div style={{display:"flex",flexWrap:"wrap",justifyContent:"flex-end",gap:"6px"}}>
      {items.map(([text, id]) => (
        <button key={text} type="button" onClick={() => onAsk(text, id)}
          style={{display:"inline-flex",alignItems:"center",gap:"7px",background:CDARK,color:G,border:"none",borderRadius:"100px",padding:"8px 14px 8px 11px",fontSize:"13.5px",fontWeight:500,fontFamily:SANS,cursor:"pointer"}}>
          <CornerDownRight size={15} color={GOLD_TEXT} aria-hidden="true"/>{text}
        </button>
      ))}
      </div>
    </div>
  );
}

export const Replies =({ children }) => <div style={{display:"flex",flexWrap:"wrap",justifyContent:"flex-end",gap:"8px"}}>{children}</div>;
export const ReplyButton = ({ onClick, disabled, children }) => (
  <button type="button" onClick={onClick} disabled={disabled} style={{background:WHITE,color:G,border:`1.5px solid ${G}`,borderRadius:"100px",padding:"10px 16px",fontSize:"14px",fontWeight:700,fontFamily:SANS,cursor:disabled ? "default" : "pointer",opacity:disabled ? 0.5 : 1}}>{children}</button>
);
