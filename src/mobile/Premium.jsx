import { useState } from "react";
import posthog from "posthog-js";
import { Crown, X, Sparkles, TrendingUp, Target, CalendarCheck, Percent } from "lucide-react";
import { G, MUT, TEXT, WHITE, CTA_BLUE } from "../design-tokens.js";
import { hasAccess } from "../lib/entitlement.js";
import { PlanPicker, CTA_WASH } from "./deepdive/SubscribeButtons.jsx";
import { IconButton, Sheet } from "./ui/index.js";

// Candid Premium, beside the wordmark on every app screen for anyone not
// subscribed: a small CTA blue crown that opens what a subscription
// includes and the two plans. Subscribers don't see it.
const INCLUDES = [
  { Icon: Sparkles, title: "Candid Assist", line: "Your savings options and how moving works, step by step." },
  { Icon: TrendingUp, title: "What-ifs", line: "Scenario modelling, student loan options side by side, and lump sums in your forecast." },
  { Icon: Target, title: "Your own goals", line: "Add goals of your own and track them." },
  { Icon: Percent, title: "The £100k trap, tracked", line: "A check-in each payday, and an alert before your bonus." },
  { Icon: CalendarCheck, title: "A fresh start each April", line: "An email when the new tax year starts, with a check your pay's the same." },
];

export default function PremiumButton({ d }) {
  const [open, setOpen] = useState(false);
  if (hasAccess()) return null;
  return (
    <>
      <button type="button" className="tap44" aria-label="Candid Premium" onClick={() => { setOpen(true); posthog.capture("premium_opened"); }}
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
  return (
    <Sheet open={open} onClose={onClose} labelledBy="premium-title" background={WHITE} padding="0">
      <PremiumSheet d={d} from={from} onClose={onClose}/>
    </Sheet>
  );
}

// The sheet's content (src/mobile/ui/Sheet.jsx draws the sheet itself).
function PremiumSheet({ d, from, onClose }) {
  return (
    <>
        <div style={{position:"relative",background:CTA_WASH,padding:"22px 20px 18px"}}>
          <IconButton icon={X} label="Close" onClick={onClose} size={28} variant="tint" color={CTA_BLUE}
            style={{position:"absolute",top:"14px",right:"14px"}}/>
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
          <p style={{margin:"12px 0 0",fontSize:"12.5px",color:MUT,textAlign:"center"}}>Already subscribed? <a href="/app/signin" style={{color:G,fontWeight:700}}>Sign in</a></p>
        </div>
    </>
  );
}
