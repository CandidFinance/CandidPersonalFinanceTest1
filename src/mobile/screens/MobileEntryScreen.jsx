import { useEffect, useState } from "react";
import { reportStorageFailure } from "../../lib/storage.js";
import { invitedHere } from "../../lib/referral.js";
import { NavBar } from "../../NavBar.jsx";
import { G, CREAM } from "../../design-tokens.js";
import { ENTRY_QUESTIONS } from "../../lib/appEntry.js";
import GuidedFlow from "../property/GuidedFlow.jsx";

// The app's entry (/app/start): one question, what they'd like help with,
// then straight on to their first module (onDone). Spec:
// docs/onboarding-guided-questions.md.
export default function MobileEntryScreen({ d, m, set, onDone }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);
  // onDone reads the answer from `d`, so it waits a render for it to land:
  // "Just exploring" moves on in the same tap that saves it.
  const [done, setDone] = useState(false);
  useEffect(() => { if (done) onDone(); }, [done]);

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
        <GuidedFlow questions={ENTRY_QUESTIONS} d={d} m={m} set={save} skipLabel={null} showProgress={false} animateFirst track={{ flow: "entry" }} onDone={() => setDone(true)}/>
      </div>
    </div>
  );
}
