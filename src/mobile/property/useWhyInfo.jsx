import { useState } from "react";
import { MUT } from "../../CandidApp.jsx";
import { whyLine } from "../../lib/propertyGuide.js";
import InfoButton from "../InfoButton.jsx";

// The "?" beside a field in a Property step's full view, opening the same
// "why it matters" line its guided walk-through question shows (whyLine,
// src/lib/propertyGuide.js). One open at a time per step. `button(id)` goes
// in the field's PillCell info slot; `panel(...ids)` goes under the row
// holding those fields and shows whichever of them is open.
export default function useWhyInfo(ctx) {
  const [openId, setOpenId] = useState(null);
  const button = id => <InfoButton open={openId === id} onClick={() => setOpenId(o => o === id ? null : id)}/>;
  const panel = (...ids) => ids.includes(openId) ? (
    <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,background:"#ede7db",borderRadius:"8px",padding:"8px 10px",margin:"8px 0 0"}}>
      {whyLine(openId, ctx)}
    </p>
  ) : null;
  return { button, panel };
}
