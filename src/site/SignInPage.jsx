import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import posthog from "posthog-js";
import { ScanFace } from "lucide-react";
import { G, MUT, TEXT, SERIF, WHITE, ERROR_TEXT } from "../design-tokens.js";
import { requestRestore, signInWithLink, signInWithPasskey, signInWithPassword, signInWithGoogle, passkeysSupported, passkeyAutofillSupported, stopPasskeyRequest, passkeyHere, passkeyName } from "../lib/entitlement.js";
import { reportStorageFailure } from "../lib/storage.js";
import { validEmail } from "../lib/unlock.js";
import SiteLayout from "./SiteLayout.jsx";
import GoogleButton from "../mobile/GoogleButton.jsx";
import { googleSignInAvailable } from "../lib/google.js";

// Signing in on a new device. An account comes with a subscription, and a
// passkey (Face ID, a fingerprint, the screen lock) or password is set up
// once subscribed (SignInGate). A device that has used a Candid passkey
// gets a button for it; any other is offered one on the email field, in the
// keyboard's suggestions, only if it holds one (synced from the user's other
// devices), so nobody is sent to a QR code by surprise. The emailed
// link (api/billing.js restore, back here as /signin?restore=) is for a
// forgotten password or a device without a passkey. "Continue with Google"
// signs in a subscriber whose Google address is the one they subscribed
// with (src/lib/google.js). Each way holds the
// subscription in this browser and brings back their saved answers, then
// opens the app where they left it.
export default function SignInPage() {
  const restore = new URLSearchParams(window.location.search).get("restore");
  const [stage, setStage] = useState(restore ? "checking" : "form"); // form | link | sent | checking | ended | invalid
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(null); // which button is working: "passkey" | "password" | "link"
  const [error, setError] = useState(null);
  const ran = useRef(false);
  const canPasskey = passkeysSupported();
  const passkeyButton = canPasskey && passkeyHere();
  const unlock = passkeyName() === "passkey" ? "a passkey" : passkeyName();

  // Signed in, by any route: into the app, or the reason it didn't work.
  const finish = (outcome, how) => {
    posthog.capture("signed_in", { how, outcome });
    if (how === "link") posthog.capture("sign_in_link_opened", { outcome });
    if (outcome !== "signed-in") { setStage(outcome); setBusy(null); return; }
    // The app reads what's now in this browser when it opens. With no
    // answers saved yet, they start the questions, already subscribed.
    let hasAnswers = false;
    try { hasAnswers = !!JSON.parse(localStorage.getItem("candid_inputs") || "null")?.appEntered; } catch (e) { reportStorageFailure("read_inputs_after_sign_in", e); }
    window.location.replace(hasAnswers ? "/app/home" : "/app/start");
  };

  useEffect(() => {
    if (!restore || ran.current) return;
    ran.current = true;
    window.history.replaceState(null, "", "/signin");
    signInWithLink(restore).then(outcome => finish(outcome, "link")).catch(() => setStage("invalid"));
  }, [restore]);

  // The keyboard's passkey suggestion on the email field, waiting until
  // it's picked; asked for again after a passkey button is used and closed.
  const autofillOn = stage === "form" || stage === "ended" || stage === "invalid";
  const armAutofill = () => passkeyAutofillSupported().then(ok => {
    if (!ok) return;
    signInWithPasskey({ autofill: true })
      .then(outcome => finish(outcome, "passkey"))
      .catch(err => { if (err.message !== "cancelled") setError(err.message); });
  });
  useEffect(() => {
    if (!autofillOn || restore) return;
    armAutofill();
    return () => stopPasskeyRequest();
  }, [autofillOn]);

  const withPasskey = async () => {
    setBusy("passkey"); setError(null);
    try { finish(await signInWithPasskey(), "passkey"); }
    catch (err) { if (err.message !== "cancelled") setError(err.message); setBusy(null); armAutofill(); }
  };
  const withPassword = async e => {
    e.preventDefault();
    if (!validEmail(email)) { setError("Enter a valid email address"); return; }
    if (!password) { setError("Enter your password"); return; }
    setBusy("password"); setError(null);
    try { finish(await signInWithPassword(email.trim(), password), "password"); }
    catch (err) { setError(err.message); setBusy(null); }
  };
  const withGoogle = async credential => {
    const g = await signInWithGoogle(credential);
    if (g.outcome === "none") throw new Error(`${g.email} doesn't have a Candid subscription. Sign in with the email you subscribed with.`);
    finish(g.outcome, "google");
  };
  const sendLink = async e => {
    e.preventDefault();
    if (!validEmail(email)) { setError("Enter a valid email address"); return; }
    setBusy("link"); setError(null);
    try { await requestRestore(email.trim()); posthog.capture("sign_in_requested"); setStage("sent"); }
    catch (err) { setError(err.message); }
    setBusy(null);
  };

  const p = { fontSize:"15px", color:MUT, lineHeight:1.6, margin:"12px 0 0" };
  const link = { color:G, fontWeight:700 };
  const input = { boxSizing:"border-box", width:"100%", border:"1.5px solid rgba(22,47,36,0.15)", borderRadius:"100px", padding:"14px 18px", fontSize:"15px", fontFamily:"inherit", color:TEXT, outline:"none", background:WHITE };
  const button = (primary, working) => ({
    width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
    background: primary ? (working ? "rgba(22,47,36,0.4)" : G) : WHITE, color: primary ? WHITE : G,
    border: primary ? "none" : `1.5px solid ${G}`, borderRadius:"100px", padding:"15px",
    fontSize:"15.5px", fontWeight:700, fontFamily:"inherit", cursor: busy ? "default" : "pointer",
  });
  const textButton = { background:"none", border:"none", padding:0, fontFamily:"inherit", fontSize:"13.5px", cursor:"pointer", ...link };
  const errorLine = error && <div role="alert" style={{fontSize:"13px",color:ERROR_TEXT}}>{error}</div>;

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
            {stage === "invalid" && <p style={{...p,color:TEXT}}>That link has expired or has already been used. Sign in below, or email yourself a new one.</p>}
            {stage === "ended" && <p style={{...p,color:TEXT}}>That subscription has ended. <Link to="/app/start" style={link}>Start a new check</Link>, or sign in with a different account.</p>}
            {stage === "form" && <p style={p}>For Candid subscribers. Your answers and subscription come with you to this device.</p>}

            <GoogleButton source="signin" onCredential={withGoogle} divider style={{marginTop:"24px"}}/>

            {passkeyButton && (
              <>
                <button type="button" onClick={withPasskey} disabled={!!busy} style={{...button(true, busy === "passkey"),marginTop:googleSignInAvailable() ? 0 : "24px"}}>
                  <ScanFace size={19}/>{busy === "passkey" ? "Waiting for your device…" : `Sign in with ${unlock}`}
                </button>
                <div style={{display:"flex",alignItems:"center",gap:"12px",margin:"22px 0 4px"}}>
                  <hr style={{flex:1,border:"none",borderTop:"1px solid rgba(22,47,36,0.12)",margin:0}}/>
                  <span style={{fontSize:"12.5px",color:MUT}}>or</span>
                  <hr style={{flex:1,border:"none",borderTop:"1px solid rgba(22,47,36,0.12)",margin:0}}/>
                </div>
              </>
            )}

            <form onSubmit={withPassword} style={{marginTop:passkeyButton || googleSignInAvailable() ? "14px" : "24px",display:"flex",flexDirection:"column",gap:"10px"}}>
              <input type="email" name="username" autoComplete="username webauthn" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" aria-label="Email" style={input}/>
              <input type="password" name="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" aria-label="Password" style={input}/>
              <button type="submit" disabled={!!busy} style={button(!passkeyButton, busy === "password")}>
                {busy === "password" ? "Signing in…" : "Sign in"}
              </button>
              {errorLine}
            </form>

            {canPasskey && !passkeyButton && (
              <p style={{...p,fontSize:"13.5px",marginTop:"18px"}}>
                <button type="button" onClick={withPasskey} disabled={!!busy} style={textButton}>{busy === "passkey" ? "Waiting for your device…" : "Use a passkey from another device"}</button>
              </p>
            )}
            <p style={{...p,fontSize:"13.5px",marginTop:"18px"}}>
              Forgot your password, or haven't set one up?{" "}
              <button type="button" onClick={() => { setStage("link"); setError(null); }} style={textButton}>Email me a sign-in link</button>
            </p>
            <p style={{...p,fontSize:"13.5px",marginTop:"10px"}}>Not subscribed? Your answers stay on the device you used. <Link to="/app/start" style={link}>Start a check</Link></p>
          </>
        )}

        {stage === "link" && (
          <>
            <p style={p}>Enter the email you subscribed with and we'll send you a link that signs you in on this device. Once you're in, you can add Face ID or a password from Edit inputs.</p>
            <form onSubmit={sendLink} style={{marginTop:"24px",display:"flex",flexDirection:"column",gap:"10px"}}>
              <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" aria-label="Email" style={input}/>
              <button type="submit" disabled={!!busy} style={button(true, busy === "link")}>
                {busy === "link" ? "Sending…" : "Email me a sign-in link"}
              </button>
              {errorLine}
            </form>
            <p style={{...p,fontSize:"13.5px",marginTop:"18px"}}>
              <button type="button" onClick={() => { setStage("form"); setError(null); }} style={textButton}>Back to sign in</button>
            </p>
          </>
        )}
      </section>
    </SiteLayout>
  );
}
