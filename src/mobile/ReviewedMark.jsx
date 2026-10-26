import { Check } from "lucide-react";
import { G, WHITE } from "../design-tokens.js";

// A module marked as reviewed: a small dark tick by its name, the one mark
// for that state (the status label beside it says where the module stands).
// Dark green, not the on-track green, so the two never read as the same thing.
export default function ReviewedMark({ size = 16 }) {
  return (
    <span role="img" aria-label="Reviewed" title="Reviewed" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:`${size}px`,height:`${size}px`,borderRadius:"50%",background:G,flexShrink:0}}>
      <Check size={size - 6} color={WHITE} strokeWidth={3}/>
    </span>
  );
}
