import { useState } from "react";
import { G, WHITE, MUT, TEXT, FIELD_BORDER, PILL_HEIGHT, CARD, NOTICE_LABEL, SECTION_TITLE } from "../../design-tokens.js";
import { fmt } from "../../lib/format.js";

// A new tax year: is their pay still what Candid has? Shown on Home once
// figures from an earlier tax year roll over (rollTaxYear sets payCheckDue),
// until they confirm it or put in the new figure, which every module's
// answer then moves with. The new-tax-year email links here.
export default function PayCheckCard({ d, set }) {
  const [editing, setEditing] = useState(false);
  const [pay, setPay] = useState(d.salary || "");
  const done = () => set("payCheckDue", false);
  const save = e => {
    e.preventDefault();
    const value = String(pay).replace(/[^\d.]/g, "");
    if (!(+value > 0)) return;
    set("salary", value);
    done();
  };
  const button = primary => ({ flex:1, background:primary ? G : WHITE, color:primary ? WHITE : TEXT, border:primary ? "none" : "1.5px solid rgba(22,47,36,0.15)", borderRadius:"100px", padding:"11px 14px", minHeight:PILL_HEIGHT, fontSize:"14px", fontWeight:700, fontFamily:"inherit", cursor:"pointer" });
  return (
    <div style={{...CARD,marginTop:"22px",padding:"16px 18px 18px"}}>
      <div style={NOTICE_LABEL}>A new tax year</div>
      <h2 style={{...SECTION_TITLE,marginTop:"6px"}}>Is your pay still {fmt(+d.salary)} a year?</h2>
      <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"4px 0 12px"}}>Every module's figures are worked out from it.</p>
      {editing ? (
        <form onSubmit={save} style={{display:"flex",gap:"8px"}}>
          <input inputMode="numeric" autoFocus value={pay} onChange={e => setPay(e.target.value)} aria-label="Pay a year, before tax"
            style={{flex:1,minWidth:0,boxSizing:"border-box",border:`1.5px solid ${FIELD_BORDER}`,borderRadius:"100px",padding:"11px 16px",fontSize:"15px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE}}/>
          <button type="submit" style={{...button(true),flex:"0 0 auto"}}>Update</button>
        </form>
      ) : (
        <div style={{display:"flex",gap:"8px"}}>
          <button type="button" onClick={done} style={button(true)}>Yes, still the same</button>
          <button type="button" onClick={() => setEditing(true)} style={button(false)}>It's changed</button>
        </div>
      )}
    </div>
  );
}
