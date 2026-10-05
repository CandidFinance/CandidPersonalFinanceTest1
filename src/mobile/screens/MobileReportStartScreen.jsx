import { useEffect } from "react";
import { NavBar, MUT } from "../../CandidApp.jsx";
import { REPORT_GOAL_QUESTION } from "../../lib/appEntry.js";
import GuidedFlow from "../property/GuidedFlow.jsx";

// Before the first overall report (/app/report-start): the one question it
// still needs, the goals that only shape the report, in the same
// walk-through format, then the report is made. Spec:
// onboarding-guided-questions.md.
export default function MobileReportStartScreen({ d, m, set, onDone }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);
  return (
    <div style={{minHeight:"100vh",background:"#f6f0e6",display:"flex",flexDirection:"column"}}>
      <NavBar light center="Your report"/>
      <div style={{flex:1,maxWidth:"580px",margin:"0 auto",padding:"24px 20px",width:"100%",boxSizing:"border-box"}}>
        <div style={{fontSize:"10.5px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase"}}>One last thing</div>
        <GuidedFlow questions={[REPORT_GOAL_QUESTION]} d={d} m={m} set={set} skipLabel={null} showProgress={false} animateFirst onDone={onDone}/>
      </div>
    </div>
  );
}
