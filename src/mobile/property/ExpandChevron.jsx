import { ChevronDown } from "lucide-react";
import { MUT } from "../../CandidApp.jsx";

// The down arrow at the foot of a Property result card that opens its
// details. The card it sits in uses CARD_PADDING_WITH_CHEVRON, so the arrow,
// not the card's usual 18px padding, sets the space at the bottom: 10px
// above it and 6px below, with the full card width tappable.
export const CARD_PADDING_WITH_CHEVRON = "18px 18px 4px";

export default function ExpandChevron({ open, onToggle, label }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? `Hide ${label}` : `Show ${label}`}
      style={{display:"flex",justifyContent:"center",width:"100%",background:"none",border:"none",padding:"6px 0 2px",marginTop:"4px",cursor:"pointer"}}>
      <ChevronDown size={18} color={MUT} style={{transform:open ? "rotate(180deg)" : "none",transition:"transform 0.15s"}}/>
    </button>
  );
}
