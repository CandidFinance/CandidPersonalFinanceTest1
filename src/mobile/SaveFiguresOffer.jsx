import { useState } from "react";
import { MUT, TEXT, WHITE, ERROR_TEXT, CTA_BLUE, SERIF, CRITICAL } from "../design-tokens.js";
import { validEmailShape } from "../lib/emailCheck.js";
import { referralCode } from "../lib/referral.js";
import { useEmailCheck, DidYouMean } from "./emailCheckForm.jsx";

// The email, asked for after the first answer rather than before it
// (unlock.js FIRST_ANSWER_FREE), for hearing when something changes that
// answer. Under the reveal's last step, beside inviting friends; nothing
// once Candid has their email. Their invite code goes with it, as from the
// old unlock form, so whoever invited them is rewarded once it's confirmed.
// Their first name is asked here too, not at the entry; it's optional.
// `onEmail(email, name)` records both on their row.
// `rateCost`: Cash's rate loss ("£598 a year"), named in red as the cost it
// is ("Your rate is costing you £X."), with the ask framed around it getting
// worse; otherwise a plain ask.
export default function SaveFiguresOffer({ d, moduleKey, onEmail, rateCost = null }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState(d.name || "");
  const check = useEmailCheck("after_answer");
  if (validEmailShape(d.email)) return null;

  const submit = async e => {
    e.preventDefault();
    if (check.busy) return;
    const first = name.trim();
    const ok = await check.run(email, { module: moduleKey, name: first || null, ...(referralCode() ? { ref: referralCode() } : {}) });
    if (ok) onEmail(ok.email, first);
  };
  const field = {width:"100%",boxSizing:"border-box",border:"1.5px solid rgba(22,47,36,0.15)",borderRadius:"100px",padding:"12px 16px",fontSize:"15px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE};
  return (
    <form onSubmit={submit} style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginTop:"16px"}}>
      {rateCost && <div style={{fontFamily:SERIF,fontSize:"19px",fontWeight:700,color:TEXT,lineHeight:1.3}}>Your rate is costing you <span style={{color:CRITICAL}}>{rateCost}</span>.</div>}
      <div style={{fontSize:rateCost ? "15px" : "16px",fontWeight:700,color:TEXT,lineHeight:1.4,margin:rateCost ? "2px 0 12px" : "0 0 12px"}}>
        {rateCost ? "Get an email if that gets worse." : "Get an email if your answer changes."}
      </div>
      <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" aria-label="Email"
        style={field}/>
      <input type="text" autoComplete="given-name" maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder="First name (optional)" aria-label="First name"
        style={{...field,marginTop:"8px"}}/>
      <button type="submit" disabled={check.busy} style={{width:"100%",marginTop:"10px",background:CTA_BLUE,opacity:check.busy ? 0.5 : 1,color:WHITE,border:"none",borderRadius:"100px",padding:"12px",fontSize:"14px",fontWeight:700,fontFamily:"inherit",cursor:check.busy ? "not-allowed" : "pointer"}}>
        {check.busy ? "Checking…" : "Email me"}
      </button>
      {check.error && <div role="alert" style={{fontSize:"12.5px",color:ERROR_TEXT,marginTop:"8px",textAlign:"center"}}>{check.error}</div>}
      <DidYouMean suggestion={check.suggestion} onUse={to => check.use(to, setEmail)}/>
      <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"10px 0 0",textAlign:"center"}}>We'll send a link to confirm. No spam, never shared. <a href="/privacy.html" target="_blank" rel="noreferrer" style={{color:MUT}}>Privacy policy</a></p>
    </form>
  );
}
