import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import posthog from "posthog-js";
import { G, MUT, TEXT, SERIF, WHITE, ERROR_TEXT } from "../design-tokens.js";
import { requestRestore, signInWithLink } from "../lib/entitlement.js";
import { reportStorageFailure } from "../lib/storage.js";
import { validEmail } from "../lib/unlock.js";
import SiteLayout from "./SiteLayout.jsx";

// Signing in on a new device. An account comes with a subscription: they
// enter the email they subscribed with, and get a link (api/billing.js
// restore) back to this page as /signin?restore=. Opening it holds the
// subscription in this browser and brings back their saved answers, then
// opens the app where they left it.
export default function SignInPage() {
  const restore = new URLSearchParams(window.location.search).get("restore");
  const [stage, setStage] = useState(restore ? "checking" : "form"); // form | sent | checking | ended | invalid
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!restore || ran.current) return;
    ran.current = true;
    window.history.replaceState(null, "", "/signin");
    signInWithLink(restore).then(outcome => {
      posthog.capture("sign_in_link_opened", { outcome });
      if (outcome !== "signed-in") { setStage(outcome); return; }
      // The app reads what's now in this browser when it opens. With no
      // answers saved yet, they start the questions, already subscribed.
      let hasAnswers = false;
      try { hasAnswers = !!JSON.parse(localStorage.getItem("candid_inputs") || "null")?.appEntered; } catch (e) { reportStorageFailure("read_inputs_after_sign_in", e); }
      window.location.replace(hasAnswers ? "/app/home" : "/app/start");
    }).catch(() => setStage("invalid"));
  }, [restore]);

  const submit = async e => {
    e.preventDefault();
    if (!validEmail(email)) { setError("Enter a valid email address"); return; }
    setBusy(true); setError(null);
    try { await requestRestore(email.trim()); posthog.capture("sign_in_requested"); setStage("sent"); }
    catch (err) { setError(err.message); }
    setBusy(false);
  };

  const p = { fontSize:"15px", color:MUT, lineHeight:1.6, margin:"12px 0 0" };
  const link = { color:G, fontWeight:700 };
  return (
    <SiteLayout>
      <section style={{maxWidth:"440px",margin:"0 auto",padding:"56px 16px 96px",boxSizing:"border-box"}}>
        <h1 style={{fontFamily:SERIF,fontSize:"36px",fontWeight:700,color:G,margin:0,lineHeight:1.15}}>Sign in</h1>

        {stage === "checking" && <p style={p}>Signing you in…</p>}

        {stage === "sent" && (
          <p style={p}>If {email.trim()} has a Candid subscription, a sign-in link is on its way. Open it on this device; it works for 20 minutes.</p>
        )}

        {(stage === "form" || stage === "ended" || stage === "invalid") && (
          <>
            {stage === "invalid" && <p style={{...p,color:TEXT}}>That link has expired or has already been used. Enter your email for a new one.</p>}
            {stage === "ended" && <p style={{...p,color:TEXT}}>That subscription has ended. <Link to="/app/start" style={link}>Start a new check</Link>, or enter a different email.</p>}
            {stage === "form" && <p style={p}>Enter the email you subscribed with and we'll send you a link. Your answers and subscription come with you to this device.</p>}
            <form onSubmit={submit} style={{marginTop:"24px",display:"flex",flexDirection:"column",gap:"10px"}}>
              <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" aria-label="Email"
                style={{boxSizing:"border-box",width:"100%",border:"1.5px solid rgba(22,47,36,0.15)",borderRadius:"100px",padding:"14px 18px",fontSize:"15px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE}}/>
              <button type="submit" disabled={busy}
                style={{width:"100%",background:busy ? "rgba(22,47,36,0.4)" : G,color:WHITE,border:"none",borderRadius:"100px",padding:"15px",fontSize:"15.5px",fontWeight:700,fontFamily:"inherit",cursor:busy ? "default" : "pointer"}}>
                {busy ? "Sending…" : "Email me a sign-in link"}
              </button>
              {error && <div style={{fontSize:"13px",color:ERROR_TEXT}}>{error}</div>}
            </form>
            <p style={{...p,fontSize:"13.5px",marginTop:"20px"}}>Not subscribed? Your answers stay on the device you used. <Link to="/app/start" style={link}>Start a check</Link></p>
          </>
        )}
      </section>
    </SiteLayout>
  );
}
