import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { ScanFace } from "lucide-react";
import { WHITE, ERROR_TEXT, SITE_INK, SITE_MUTED, SITE_RULE, SITE_EDGE } from "../design-tokens.js";
import { requestRestore, signInWithLink, signInWithPasskey, signInWithPassword, signInWithGoogle, passkeysSupported, passkeyAutofillSupported, stopPasskeyRequest, passkeyHere, passkeyName } from "../lib/entitlement.js";
import { reportStorageFailure } from "../lib/storage.js";
import { validEmail } from "../lib/unlock.js";
import SiteLayout from "./SiteLayout.jsx";
import { CTA_RADIUS } from "./StartCheckButton.jsx";
import GoogleButton, { useGoogleButtonShown } from "../mobile/GoogleButton.jsx";
import OrRule from "../mobile/OrRule.jsx";

// Signing in, or creating an account. Accounts are for anyone, free or
// paid (Harvey, 30 Oct 2026); a passkey (Face ID, a fingerprint, the screen
// lock) or password is added once signed in (the Account sheet; SignInGate
// asks subscribers for one). A device that has used a Candid passkey
// gets a button for it; any other is offered one on the email field, in the
// keyboard's suggestions, only if it holds one (synced from the user's other
// devices), so nobody is sent to a QR code by surprise. The emailed
// link (api/billing.js restore, back here as /signin?restore=) creates an
// account for a new email, and is for a forgotten password or a device
// without a passkey. "Continue with Google" signs in, or creates an account
// for that Google address (src/lib/google.js). Each way holds the account
// in this browser and brings back their saved answers, then opens the app
// where they left it.
export default function SignInPage() {
  const params = new URLSearchParams(window.location.search);
  const restore = params.get("restore");
  // Back from paying with the email of an account already there (CandidApp,
  // checkAccessOnLoad "check-email"): its sign-in link is on its way.
  const paidSent = params.get("sent") === "1";
  const [stage, setStage] = useState(restore ? "checking" : paidSent ? "sent" : "form"); // form | link | sent | checking | invalid
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(null); // which button is working: "passkey" | "password" | "link"
  const [error, setError] = useState(null);
  const ran = useRef(false);
  const [google, googleGone] = useGoogleButtonShown();
  const canPasskey = passkeysSupported();
  const passkeyButton = canPasskey && passkeyHere();
  const unlock = passkeyName() === "passkey" ? "a passkey" : passkeyName();

  // Signed in, by any route: into the app, or the reason it didn't work.
  const finish = (outcome, how) => {
    posthog.capture("signed_in", { how, outcome });
    if (how === "link") posthog.capture("sign_in_link_opened", { outcome });
    if (outcome !== "signed-in") { setStage(outcome); setBusy(null); return; }
    // The app reads what's now in this browser when it opens. With no
    // answers saved yet, they start the questions, already signed in.
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
  const autofillOn = stage === "form" || stage === "invalid";
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
    finish((await signInWithGoogle(credential, null, { open: true })).outcome, "google");
  };
  const sendLink = async e => {
    e.preventDefault();
    if (!validEmail(email)) { setError("Enter a valid email address"); return; }
    setBusy("link"); setError(null);
    try { await requestRestore(email.trim()); posthog.capture("sign_in_requested"); setStage("sent"); }
    catch (err) { setError(err.message); }
    setBusy(null);
  };

  const p = { fontSize:"15px", color:SITE_MUTED, lineHeight:1.6, margin:"12px 0 0" };
  const link = { color:SITE_INK, fontWeight:700, textDecoration:"underline", textDecorationColor:SITE_RULE, textUnderlineOffset:"3px", textDecorationThickness:"2px" };
  const input = { boxSizing:"border-box", width:"100%", border:`1px solid ${SITE_EDGE}`, borderRadius:CTA_RADIUS, padding:"14px 16px", fontSize:"15px", fontFamily:"inherit", color:SITE_INK, background:WHITE };
  // Visible field names, so they stay on screen once the field is filled.
  const fieldLabel = { display:"flex", flexDirection:"column", gap:"6px", fontSize:"13.5px", fontWeight:600, color:SITE_INK };
  const button = (primary, working) => ({
    width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
    background: primary ? (working ? SITE_MUTED : SITE_INK) : WHITE, color: primary ? WHITE : SITE_INK,
    border: primary ? "none" : `1px solid ${SITE_INK}`, borderRadius:CTA_RADIUS, padding:"15px",
    fontSize:"15.5px", fontWeight:700, fontFamily:"inherit", cursor: busy ? "default" : "pointer",
  });
  const textButton = { background:"none", border:"none", padding:0, fontFamily:"inherit", fontSize:"13.5px", cursor:"pointer", ...link };
  const errorLine = error && <div role="alert" style={{fontSize:"13px",color:ERROR_TEXT}}>{error}</div>;

  return (
    <SiteLayout title="Sign in or create an account | Candid">
      {/* The fields' focus ring: inline styles can't reach :focus. */}
      <style>{`.si-field:focus { outline: 2px solid ${SITE_INK}; outline-offset: 2px; }`}</style>
      <section style={{maxWidth:"440px",margin:"0 auto",padding:"72px 16px 104px",boxSizing:"border-box"}}>
        <div className="st-label">Your account</div>
        <h1 className="st-h2">Sign in or create an account</h1>

        {stage === "checking" && <p style={p}>Signing you in…</p>}

        {stage === "sent" && (
          <p style={p}>{paidSent && !email ? "Thanks for subscribing. That email already has a Candid account, so a sign-in link is on its way to it." : `A sign-in link is on its way to ${email.trim()}.`} Open it on this device; it works for 20 minutes.</p>
        )}

        {(stage === "form" || stage === "invalid") && (
          <>
            {stage === "invalid" && <p style={{...p,color:SITE_INK}}>That link has expired or has already been used. Sign in below, or email yourself a new one.</p>}
            {stage === "form" && <p style={p}>Your answers are saved to your account, so they come back on any device.</p>}

            <GoogleButton source="signin" onCredential={withGoogle} divider style={{marginTop:"24px"}} onUnavailable={googleGone}/>

            {passkeyButton && (
              <>
                <button type="button" onClick={withPasskey} disabled={!!busy} style={{...button(true, busy === "passkey"),marginTop:google ? 0 : "24px"}}>
                  <ScanFace size={19}/>{busy === "passkey" ? "Waiting for your device…" : `Sign in with ${unlock}`}
                </button>
                <OrRule margin="22px 0 4px"/>
              </>
            )}

            <form onSubmit={withPassword} style={{marginTop:passkeyButton || google ? "14px" : "24px",display:"flex",flexDirection:"column",gap:"10px"}}>
              <label style={fieldLabel}>Email
                <input type="email" name="username" autoComplete="username webauthn" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="si-field" style={input}/>
              </label>
              <label style={fieldLabel}>Password
                <input type="password" name="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="si-field" style={input}/>
              </label>
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
            <p style={{...p,fontSize:"13.5px",marginTop:"10px"}}>
              New to Candid?{" "}
              <button type="button" onClick={() => { setStage("link"); setError(null); }} style={textButton}>Create an account with your email</button>
            </p>
          </>
        )}

        {stage === "link" && (
          <>
            <p style={p}>Enter your email and we'll send a link that signs you in on this device, or creates your account. Once you're in, you can add Face ID or a password from Account.</p>
            <form onSubmit={sendLink} style={{marginTop:"24px",display:"flex",flexDirection:"column",gap:"10px"}}>
              <label style={fieldLabel}>Email
                <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="si-field" style={input}/>
              </label>
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
