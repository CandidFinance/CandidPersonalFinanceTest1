import { Check } from "lucide-react";
import { G, WHITE, MUT, TEXT, RADIUS_CARD } from "../../CandidApp.jsx";
import { GOAL_CHOICES, goalsWith } from "../../lib/appEntry.js";

// The goals the entry doesn't ask, asked once on home after the score
// appears. A card, never a step: "Not now" dismisses it for good. Answers go
// to financialGoals (with the entry's own) and the user's row. `onDone(how,
// goals)`: how is "answered" or "dismissed".
export default function GoalsCard({ d, set, onDone }) {
  const picked = Array.isArray(d.goalPicks) ? d.goalPicks : [];
  const toggle = choice => {
    const on = picked.includes(choice.value);
    const exclusive = GOAL_CHOICES.filter(c => c.exclusive).map(c => c.value);
    set("goalPicks", on ? picked.filter(v => v !== choice.value)
      : choice.exclusive ? [choice.value]
      : [...picked.filter(v => !exclusive.includes(v)), choice.value]);
  };
  const save = () => {
    const goals = goalsWith(d.interests, picked);
    set("financialGoals", goals);
    onDone("answered", goals);
  };
  const button = selected => ({
    display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px", textAlign:"left", width:"100%",
    background:selected ? "rgba(22,47,36,0.06)" : WHITE, border:`1.5px solid ${selected ? G : "rgba(22,47,36,0.15)"}`,
    borderRadius:"12px", padding:"11px 14px", fontSize:"14px", fontWeight:600, color:TEXT, fontFamily:"inherit", cursor:"pointer",
  });

  return (
    <div style={{marginTop:"22px",background:WHITE,border:"1px solid rgba(22,47,36,0.08)",borderRadius:RADIUS_CARD,boxShadow:"0 2px 10px rgba(22,47,36,0.05)",padding:"18px"}}>
      <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>One quick question</div>
      <div style={{fontSize:"16px",fontWeight:700,color:TEXT,marginTop:"8px",lineHeight:1.35}}>Are you working towards any of these?</div>
      <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"4px 0 12px"}}>It helps us decide what Candid covers next.</p>
      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
        {GOAL_CHOICES.map(c => {
          const selected = picked.includes(c.value);
          return (
            <button key={c.value} type="button" aria-pressed={selected} onClick={() => toggle(c)} style={button(selected)}>
              {c.label}
              {selected && <Check size={15} color={G}/>}
            </button>
          );
        })}
      </div>
      <div style={{display:"flex",gap:"10px",marginTop:"14px"}}>
        <button type="button" onClick={() => onDone("dismissed")} style={{flex:1,background:"none",border:"1.5px solid rgba(22,47,36,0.2)",borderRadius:"100px",padding:"11px",fontSize:"13.5px",fontWeight:600,color:TEXT,fontFamily:"inherit",cursor:"pointer"}}>
          Not now
        </button>
        <button type="button" onClick={save} disabled={!picked.length} style={{flex:2,background:picked.length ? G : "rgba(22,47,36,0.2)",border:"none",borderRadius:"100px",padding:"11px",fontSize:"13.5px",fontWeight:700,color:WHITE,fontFamily:"inherit",cursor:picked.length ? "pointer" : "not-allowed"}}>
          Save
        </button>
      </div>
    </div>
  );
}
