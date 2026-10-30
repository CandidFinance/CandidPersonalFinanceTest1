import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import posthog from "posthog-js";
import { Crown, X, LayoutGrid, CalendarCheck, BellRing, Percent } from "lucide-react";
import { G, MUT, TEXT, WHITE, CTA_BLUE } from "../design-tokens.js";
import { hasAccess } from "../lib/entitlement.js";
import { PlanPicker, CTA_WASH } from "./deepdive/SubscribeButtons.jsx";
import useDialogFocus, { useHidesAssist } from "./useDialogFocus.js";

// Candid Premium, beside the wordmark on every app screen for anyone not
// subscribed: a small CTA blue crown that opens what a subscription
// includes and the two plans. Subscribers don't see it.
const INCLUDES = [
  { Icon: LayoutGrid, title: "Every module unlocked", line: "Your first one is free; Premium opens the rest." },
  { Icon: Percent, title: "The £100k trap, tracked", line: "A check-in each payday, and alerts before your bonus and 5 April." },
  { Icon: BellRing, title: "Better-rate alerts", line: "When your savings could earn £100 or more a year elsewhere." },
  { Icon: CalendarCheck, title: "A fresh start each April", line: "Your figures rolled into the new tax year, with a check your pay's the same." },
];

export default function PremiumButton({ d }) {
  const [open, setOpen] = useState(false);
  if (hasAccess()) return null;
  return (
    <>
      <button type="button" aria-label="Candid Premium" onClick={() => { setOpen(true); posthog.capture("premium_opened"); }}
        style={{width:"28px",height:"28px",borderRadius:"50%",border:"none",background:CTA_BLUE,color:WHITE,display:"flex",alignItems:"center",justifyContent:"center",padding:0,cursor:"pointer",flexShrink:0}}>
        <Crown size={15} strokeWidth={2.2} aria-hidden="true"/>
      </button>
      <PremiumSheetPortal open={open} d={d} onClose={() => setOpen(false)}/>
    </>
  );
}

// The crown, small, on a subscriber feature a subscriber has used
// (entitlement.js featureUsed), in place of its "Subscribers" pill.
export function SubscriberCrown() {
  return (
    <span role="img" aria-label="Subscriber feature" title="Subscriber feature"
      style={{width:"18px",height:"18px",borderRadius:"50%",background:CTA_BLUE,color:WHITE,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      <Crown size={10} strokeWidth={2.4} aria-hidden="true"/>
    </span>
  );
}

// The same sheet, for a subscriber feature elsewhere to open when a
// non-subscriber taps it (Forecast's monthly surplus). `from` names it in
// analytics.
export function PremiumSheetPortal({ open, d, onClose, from = "header" }) {
  if (typeof document === "undefined") return null;
  return createPortal(<AnimatePresence>{open && <PremiumSheet key="premium" d={d} from={from} onClose={onClose}/>}</AnimatePresence>, document.body);
}

function PremiumSheet({ d, from, onClose }) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  useDialogFocus(ref, { onEscape: onClose });
  useHidesAssist();
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{position:"fixed",inset:0,zIndex:4600,background:"rgba(10,20,15,0.45)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <motion.div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="premium-title" onClick={e => e.stopPropagation()}
        initial={reduceMotion ? { opacity: 0 } : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduceMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        style={{width:"100%",maxWidth:"480px",maxHeight:"92vh",overflowY:"auto",background:WHITE,borderRadius:"22px 22px 0 0",outline:"none",fontFamily:"'DM Sans',sans-serif",paddingBottom:"env(safe-area-inset-bottom, 0px)"}}>
        <div style={{position:"relative",background:CTA_WASH,padding:"22px 20px 18px"}}>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{position:"absolute",top:"12px",right:"12px",display:"flex",alignItems:"center",justifyContent:"center",width:"30px",height:"30px",borderRadius:"50%",border:"none",background:"rgba(0,113,227,0.1)",color:CTA_BLUE,cursor:"pointer",padding:0}}>
            <X size={16} aria-hidden="true"/>
          </button>
          <span style={{width:"40px",height:"40px",borderRadius:"50%",background:CTA_BLUE,color:WHITE,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Crown size={20} strokeWidth={2.2} aria-hidden="true"/>
          </span>
          <h2 id="premium-title" style={{margin:"12px 32px 0 0",fontSize:"22px",lineHeight:1.2,fontWeight:700,color:G}}>Candid Premium</h2>
          <p style={{margin:"4px 0 0",fontSize:"13.5px",lineHeight:1.5,color:TEXT}}>Candid keeps working between visits, on your own figures.</p>
        </div>
        <div style={{padding:"18px 20px 22px"}}>
          <div style={{fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:MUT}}>What you get from Candid</div>
          <ul style={{listStyle:"none",margin:"12px 0 0",padding:0,display:"flex",flexDirection:"column",gap:"12px"}}>
            {INCLUDES.map(({ Icon, title, line }) => (
              <li key={title} style={{display:"flex",gap:"12px",alignItems:"flex-start"}}>
                <span style={{width:"32px",height:"32px",borderRadius:"10px",background:CTA_WASH,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <Icon size={17} color={CTA_BLUE} aria-hidden="true"/>
                </span>
                <span>
                  <span style={{display:"block",fontSize:"14px",fontWeight:700,color:TEXT}}>{title}</span>
                  <span style={{display:"block",fontSize:"12.5px",color:MUT,lineHeight:1.45,marginTop:"1px"}}>{line}</span>
                </span>
              </li>
            ))}
          </ul>
          <div style={{marginTop:"18px"}}>
            <PlanPicker d={d} module={null} from={from}/>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
