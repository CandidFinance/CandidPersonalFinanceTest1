import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Home } from "lucide-react";
import { reportStorageFailure } from "../../lib/storage.js";
import { invitedHere } from "../../lib/referral.js";
import { signedIn } from "../../lib/entitlement.js";
import posthog from "posthog-js";
import { NavBar } from "../../NavBar.jsx";
import { G, CREAM, MUT, SERIF } from "../../design-tokens.js";
import { ENTRY_QUESTIONS, firstPick } from "../../lib/appEntry.js";
import { MODULE_META } from "../../lib/moduleStatus.js";
import GuidedFlow from "../property/GuidedFlow.jsx";

// The app's entry (/app/start): one question, what they'd like help with,
// then on to their first module (onDone), after a moment naming the module
// being opened, so the switch isn't abrupt. Spec:
// docs/onboarding-guided-questions.md.

// How long the hand-off shows before the module opens.
const HANDOFF_MS = 1400, HANDOFF_STILL_MS = 900;
const PROPERTY_META = { icon: Home, title: "Buying a home" };

// `onEntered` records the entry as soon as it's answered, so leaving during
// the hand-off doesn't lose it; `onDone` then opens the module.
export default function MobileEntryScreen({ d, m, set, onEntered, onDone }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);
  const reduceMotion = useReducedMotion();
  // The hand-off reads the answer from `d`, so it waits a render for it to
  // land: "Just exploring" moves on in the same tap that saves it.
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    onEntered();
    const t = setTimeout(onDone, reduceMotion ? HANDOFF_STILL_MS : HANDOFF_MS);
    return () => clearTimeout(t);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  const first = firstPick(d);
  const meta = first === "property" ? PROPERTY_META : MODULE_META.find(mm => mm.key === first);

  // The confidence answer also goes to localStorage, where the user's row
  // reads it from (confidence_score).
  const save = (field, value) => {
    set(field, value);
    if (field === "confidence") { try { localStorage.setItem("candid_confidence_score", String(value)); } catch (e) { reportStorageFailure("save_confidence", e); } }
  };

  return (
    <div style={{minHeight:"100vh",background:CREAM,display:"flex",flexDirection:"column"}}>
      <NavBar light center="Getting started"/>
      <div style={{flex:1,maxWidth:"580px",margin:"0 auto",padding:"24px 20px",width:"100%",boxSizing:"border-box"}}>
        {/* Arrived on a friend's invite link (src/lib/referral.js). */}
        {invitedHere() && (
          <div style={{fontSize:"13px",fontWeight:600,color:G,lineHeight:1.45,marginBottom:"14px"}}>A friend invited you: your second module is unlocked for free.</div>
        )}
        {/* Says which module is opening, for a screen reader: there from the
            start, so the change is announced when the hand-off shows. */}
        <div role="status" style={{position:"absolute",width:"1px",height:"1px",overflow:"hidden",clip:"rect(0 0 0 0)"}}>{done && meta?.title ? `Opening ${meta.title}` : ""}</div>
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.div key="handoff" initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }}
              style={{minHeight:"55vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",gap:"14px"}}>
              <div style={{width:"56px",height:"56px",borderRadius:"15px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {meta?.icon && <meta.icon size={24} color={G}/>}
              </div>
              <div style={{fontSize:"13px",color:MUT,fontWeight:600}}>Opening</div>
              <div style={{fontFamily:SERIF,fontSize:"26px",fontWeight:700,color:G,lineHeight:1.2,marginTop:"-8px"}}>{meta?.title}</div>
            </motion.div>
          ) : (
            <motion.div key="question" exit={{ opacity: 0, y: reduceMotion ? 0 : -12, transition: { duration: 0.2, ease: "easeIn" } }}>
              <GuidedFlow questions={ENTRY_QUESTIONS} d={d} m={m} set={save} skipLabel={null} showProgress={false} animateFirst track={{ flow: "entry" }} onDone={() => setDone(true)}/>
              {/* Back on a new device: their account brings their answers. */}
              {!signedIn() && (
                <p style={{margin:"28px 0 0",fontSize:"13.5px",color:MUT,textAlign:"center"}}>
                  Already have an account? <a href="/app/signin" onClick={() => posthog.capture("entry_sign_in_clicked")} style={{color:G,fontWeight:700,textDecoration:"underline",textUnderlineOffset:"3px"}}>Sign in</a>
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
