import posthog from "posthog-js";
import { G, WHITE, TEXT, MUT } from "../design-tokens.js";
import { pendingBank, bankPatch } from "../lib/moduleStatus.js";
import { fmt } from "../lib/format.js";

// Asked when a module's own answers have changed and its £ at stake has
// fallen: did the user make the change (banked), or correct a figure (not
// banked)? Nothing counts as banked until they say (moduleStatus.js).
// `compact` for the Modules tab's tiles.
export default function BankConfirm({ d, set, moduleKey, title, amount, compact = false }) {
  const pending = pendingBank(d, moduleKey, amount);
  if (!pending) return null;
  const answer = made => {
    set("moduleBaselines", bankPatch(d, moduleKey, amount, made));
    posthog.capture(made ? "bank_confirmed" : "bank_correction", { module: moduleKey, amount: pending });
  };
  const button = primary => ({
    background: primary ? G : WHITE, color: primary ? WHITE : G, border: `1.5px solid ${G}`, borderRadius: "100px",
    padding: compact ? "7px 12px" : "9px 14px", fontSize: compact ? "12.5px" : "13px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
  });
  return (
    <div onClick={e => e.stopPropagation()} style={{background:"rgba(45,107,74,0.07)",border:"1px solid rgba(45,107,74,0.2)",borderRadius:"12px",padding:compact ? "10px 12px" : "14px 16px",margin:compact ? "0 18px 14px" : "0 0 16px"}}>
      <div style={{fontSize:compact ? "13px" : "14px",fontWeight:700,color:TEXT,lineHeight:1.4}}>{title} is down {fmt(pending)} a year</div>
      <p style={{fontSize:compact ? "12px" : "13px",color:MUT,lineHeight:1.5,margin:"3px 0 10px"}}>Did you make a change, or correct a figure? Only changes you've made count as saved.</p>
      <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
        <button type="button" onClick={() => answer(true)} style={button(true)}>I made the change</button>
        <button type="button" onClick={() => answer(false)} style={button(false)}>Just correcting</button>
      </div>
    </div>
  );
}
