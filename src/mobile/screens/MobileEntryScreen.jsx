import { useEffect } from "react";
import { NavBar } from "../../CandidApp.jsx";
import { ENTRY_QUESTIONS } from "../../lib/appEntry.js";
import GuidedFlow from "../property/GuidedFlow.jsx";

// The app's entry (/app/start): two questions, what they'd like help with
// and their name, then the app opens. Each module asks its own questions
// when it's opened. Same walk-through as the modules (GuidedFlow), with no
// skip: both answers are needed. Spec: onboarding-guided-questions.md.
export default function MobileEntryScreen({ d, m, set, onDone }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);
  return (
    <div style={{minHeight:"100vh",background:"#f6f0e6",display:"flex",flexDirection:"column"}}>
      <NavBar light center="Getting started"/>
      <div style={{flex:1,maxWidth:"580px",margin:"0 auto",padding:"24px 20px",width:"100%",boxSizing:"border-box"}}>
        <GuidedFlow questions={ENTRY_QUESTIONS} d={d} m={m} set={set} skipLabel={null} onDone={onDone}/>
      </div>
    </div>
  );
}
