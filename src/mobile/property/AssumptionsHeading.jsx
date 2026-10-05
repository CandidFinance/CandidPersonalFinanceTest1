import { G, MUT } from "../../CandidApp.jsx";

// The line above a Property step's inputs, with "Walk me through it" on the
// right to rerun the step's guided walk-through (GuidedFlow). Shared so
// every step's reads the same.
export default function AssumptionsHeading({ text, onWalkThrough }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:"12px",margin:"0 0 6px"}}>
      <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.55,margin:0}}>{text}</p>
      {onWalkThrough && (
        <button type="button" onClick={onWalkThrough} style={{background:"none",border:"none",padding:0,color:G,fontSize:"12.5px",fontWeight:700,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap"}}>
          Walk me through it
        </button>
      )}
    </div>
  );
}
