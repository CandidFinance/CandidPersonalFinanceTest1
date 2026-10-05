import { Plus, Minus } from "lucide-react";
import { G, MUT } from "../CandidApp.jsx";

// Shared by the module screens (src/mobile/deepdive), so they lead with the
// answer the same way: "Explain this" beside the figure, replaying the answer
// step by step (MobileModuleReveal), and the what-if tools gathered under
// "Explore what-ifs", closed at first.

export function ExplainLink({ onClick, color = G }) {
  if (!onClick) return null;
  return (
    <button type="button" onClick={onClick} style={{background:"none",border:"none",padding:0,color,fontSize:"12.5px",fontWeight:700,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap"}}>
      Explain this
    </button>
  );
}

// `hint` names what's inside while it's closed.
export function ExploreToggle({ open, onToggle, hint }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} style={{
      display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", padding:"4px 0", margin:"4px 0 14px",
      color:G, fontSize:"13.5px", fontWeight:700, fontFamily:"inherit", cursor:"pointer",
    }}>
      {open ? <Minus size={15}/> : <Plus size={15}/>}Explore what-ifs
      {!open && hint && <span style={{fontWeight:500,color:MUT,fontSize:"12.5px"}}>{hint}</span>}
    </button>
  );
}
