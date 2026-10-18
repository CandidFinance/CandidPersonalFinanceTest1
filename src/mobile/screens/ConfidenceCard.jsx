import { G, WHITE, MUT, TEXT, RADIUS_CARD } from "../../design-tokens.js";
import { CONFIDENCE_QUESTION } from "../../lib/appEntry.js";
import { reportStorageFailure } from "../../lib/storage.js";

// How confident they feel about their finances: asked once on Home after
// their first answer, rather than at the entry before anything's been
// shown. One tap answers; "Not now" puts it away for good. Kept in
// localStorage too, where the user's row reads it (confidence_score).
export default function ConfidenceCard({ d, set, onDone }) {
  const answer = value => {
    set("confidence", value);
    set("confidenceAsked", true);
    try { localStorage.setItem("candid_confidence_score", String(value)); } catch (e) { reportStorageFailure("save_confidence", e); }
    onDone?.(value);
  };
  const button = { textAlign:"left", width:"100%", background:WHITE, border:"1.5px solid rgba(22,47,36,0.15)", borderRadius:"12px", padding:"11px 14px", fontSize:"14px", fontWeight:600, color:TEXT, fontFamily:"inherit", cursor:"pointer" };
  return (
    <div style={{marginTop:"22px",background:WHITE,border:"1px solid rgba(22,47,36,0.08)",borderRadius:RADIUS_CARD,boxShadow:"0 2px 10px rgba(22,47,36,0.05)",padding:"18px"}}>
      <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>One quick question</div>
      <div style={{fontSize:"16px",fontWeight:700,color:TEXT,marginTop:"8px",lineHeight:1.35}}>{CONFIDENCE_QUESTION.ask({ d })}</div>
      <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"4px 0 12px"}}>{CONFIDENCE_QUESTION.why({ d })}</p>
      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
        {CONFIDENCE_QUESTION.options({ d }).map(o => <button key={o.value} type="button" onClick={() => answer(o.value)} style={button}>{o.label}</button>)}
      </div>
      <button type="button" onClick={() => set("confidenceAsked", true)} style={{marginTop:"10px",background:"none",border:"none",padding:0,color:MUT,fontSize:"13px",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Not now</button>
    </div>
  );
}
