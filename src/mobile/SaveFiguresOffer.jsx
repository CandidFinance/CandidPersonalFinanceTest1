import { useState } from "react";
import { X } from "lucide-react";
import { MUT, TEXT, WHITE, ERROR_TEXT, CTA_BLUE, SERIF, CRITICAL } from "../design-tokens.js";
import { validEmailShape } from "../lib/emailCheck.js";
import { referralCode } from "../lib/referral.js";
import { useEmailCheck, DidYouMean } from "./emailCheckForm.jsx";
import { signInWithGoogle } from "../lib/entitlement.js";
import GoogleButton from "./GoogleButton.jsx";

// The email, asked for after the first answer rather than before it
// (unlock.js FIRST_ANSWER_FREE), for hearing when something changes that
// answer. Under the reveal's last step, beside inviting friends; nothing
// once Candid has their email. Their invite code goes with it, as from the
// old unlock form, so whoever invited them is rewarded once it's confirmed.
// Their first name is asked here too, not at the entry; it's optional.
// `onEmail(email, name, how)` records both on their row; `how` is "google"
// for that button, for the event.
// `rateCost`: Cash's rate loss ("£598 a year"), named in red as the cost it
// is ("Your rate is costing you £X."), with the ask framed around it getting
// worse; otherwise a plain ask.
// `onDismiss` adds an X (the tile at the top of the Cash page), and the
// fields wait behind an "Add email" button there. `style`: for the Cash
// tour's card and that tile. `children`: under the form (the tour's "Not now").
// `source`: where it's asked, for the email check's events.
// "Continue with Google" gives the email too, already confirmed by Google
// (server/google.js), with their first name from it if none is typed.
export default function SaveFiguresOffer({ d, moduleKey, onEmail, rateCost = null, onDismiss = null, style = null, children = null, source = "after_answer" }) {
  const [open, setOpen] = useState(!onDismiss);
  const [email, setEmail] = useState("");
  const [name, setName] = useState(d.name || "");
  const check = useEmailCheck(source);
  if (validEmailShape(d.email)) return null;

  const submit = async e => {
    e.preventDefault();
    if (check.busy) return;
    const first = name.trim();
    const ok = await check.run(email, { module: moduleKey, name: first || null, ...(referralCode() ? { ref: referralCode() } : {}) });
    if (ok) onEmail(ok.email, first);
  };
  const withGoogle = async credential => {
    const g = await signInWithGoogle(credential, referralCode());
    // A subscriber already: their saved answers are now in this browser
    // (holdSignIn), so the app reopens with them, before what's in memory
    // can be saved over them.
    if (g.outcome === "signed-in") { window.location.reload(); return; }
    onEmail(g.email, name.trim() || g.name, "google");
  };
  const field = {width:"100%",boxSizing:"border-box",border:"1.5px solid rgba(22,47,36,0.15)",borderRadius:"100px",padding:"12px 16px",fontSize:"15px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE};
  return (
    <form onSubmit={submit} style={{position:"relative",background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginTop:"16px",...style}}>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" style={{position:"absolute",top:"8px",right:"8px",background:"none",border:"none",padding:"6px",color:MUT,cursor:"pointer",display:"flex"}}><X size={18}/></button>
      )}
      {rateCost && <div style={{fontFamily:SERIF,fontSize:"19px",fontWeight:700,color:TEXT,lineHeight:1.3,paddingRight:onDismiss ? "24px" : 0}}>Your rate is costing you <span style={{color:CRITICAL}}>{rateCost}</span>.</div>}
      <div style={{fontSize:rateCost ? "15px" : "16px",fontWeight:700,color:TEXT,lineHeight:1.4,margin:rateCost ? "2px 0 12px" : "0 0 12px",paddingRight:onDismiss && !rateCost ? "24px" : 0}}>
        {rateCost ? "Get an email if that gets worse." : "Get an email if your answer changes."}
      </div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} style={{background:CTA_BLUE,color:WHITE,border:"none",borderRadius:"100px",padding:"10px 18px",fontSize:"14px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>Add email</button>
      ) : <>
      <GoogleButton source={source} onCredential={withGoogle} divider/>
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
      </>}
      {children}
    </form>
  );
}
