import { Lock } from "lucide-react";
import { G, MUT } from "../../CandidApp.jsx";

const STEPS = [
  { key:"readiness", label:"1. Readiness" },
  { key:"mortgage", label:"2. Mortgage" },
  { key:"rentVsBuy", label:"3. Rent vs buy" },
];

// The Property module's steps as tabs. Steps 2 and 3 stay locked (the lock
// is their one state indicator) until readinessMissing is empty.
export default function PropertySteps({ step, unlocked, onSelect }) {
  return (
    <div role="tablist" style={{display:"flex",borderBottom:"1px solid rgba(22,47,36,0.12)"}}>
      {STEPS.map(s => {
        const active = s.key === step;
        const locked = s.key !== "readiness" && !unlocked;
        return (
          <button key={s.key} type="button" role="tab" aria-selected={active} disabled={locked} onClick={() => { if (!active) onSelect(s.key); }} style={{
            flex:1, background:"none", border:"none", borderBottom:`2px solid ${active ? G : "transparent"}`, marginBottom:"-1px",
            padding:"10px 0", fontSize:"13px", whiteSpace:"nowrap", fontWeight:active ? 700 : 600, color:active ? G : MUT, fontFamily:"inherit",
            cursor:locked ? "not-allowed" : active ? "default" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px",
          }}>
            {locked && <Lock size={13}/>}{s.label}
          </button>
        );
      })}
    </div>
  );
}
