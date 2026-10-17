import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { ScanFace } from "lucide-react";
import { NavBar } from "../NavBar.jsx";
import { G, WHITE, MUT, TEXT, ERROR_TEXT, SERIF, CREAM } from "../design-tokens.js";
import { accessInfo, accountSignIns, addPasskey, setPassword, passkeysSupported, hasAccess, passkeyName, passkeyNotSavedHelp } from "../lib/entitlement.js";

// A subscriber's ways to sign in on another device (src/site/SignInPage.jsx):
// a passkey on this device (Face ID, Touch ID, a phone's screen lock) and a
// password. Set up on a required screen once subscribed (SignInGate), and
// added to or changed in Edit inputs' subscription section.

// What's set up ({ passkeys, password }), from the server; null until known
// or without a subscription.
function useSignIns() {
  const [signIns, setSignIns] = useState(null);
  const reload = () => accountSignIns().then(setSignIns).catch(() => setSignIns(null));
  useEffect(() => { if (hasAccess()) reload(); }, []);
  return [signIns, reload];
}

export function SignInMethods({ signIns, reload }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [editing, setEditing] = useState(false);
  const [pw, setPw] = useState("");
  const email = accessInfo()?.email || "";
  if (!signIns) return null;

  const run = async (what, fn, message) => {
    setBusy(what); setError(null); setDone(null);
    try { await fn(); setDone(message); await reload(); return true; }
    catch (e) { if (e.message !== "cancelled") setError(e.message === "not-saved" ? passkeyNotSavedHelp() : e.message); return false; }
    finally { setBusy(null); }
  };
  const savePassword = async e => {
    e.preventDefault();
    if (await run("password", () => setPassword(pw), "Password saved.")) { setEditing(false); setPw(""); }
  };

  const row = { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", padding:"10px 0" };
  const name = { fontSize:"13.5px", fontWeight:700, color:TEXT };
  const note = { fontSize:"12px", color:MUT, marginTop:"2px" };
  const action = { background:"none", border:"none", padding:0, color:G, fontSize:"13px", fontWeight:700, fontFamily:"inherit", cursor:"pointer", whiteSpace:"nowrap" };

  return (
    <div>
      {passkeysSupported() && (
        <div style={row}>
          <div>
            <div style={name}>{passkeyName() === "passkey" ? "Passkey" : passkeyName()[0].toUpperCase() + passkeyName().slice(1)}</div>
            <div style={note}>{signIns.passkeys ? `Set up on ${signIns.passkeys === 1 ? "1 device" : `${signIns.passkeys} devices`}` : "Not set up"}</div>
          </div>
          <button type="button" disabled={!!busy} onClick={() => run("passkey", addPasskey, "Passkey added. Use it on the sign-in page.")}
            style={{...action,display:"inline-flex",alignItems:"center",gap:"5px"}}>
            <ScanFace size={15}/>{busy === "passkey" ? "Waiting…" : signIns.passkeys ? "Add this device" : "Set up"}
          </button>
        </div>
      )}
      <div style={{...row,borderTop:passkeysSupported() ? "1px solid rgba(22,47,36,0.08)" : "none"}}>
        <div>
          <div style={name}>Password</div>
          <div style={note}>{signIns.password ? "Set" : "Not set up"}</div>
        </div>
        {!editing && <button type="button" disabled={!!busy} onClick={() => { setEditing(true); setDone(null); setError(null); }} style={action}>{signIns.password ? "Change" : "Set a password"}</button>}
      </div>
      {editing && (
        <form onSubmit={savePassword} style={{display:"flex",flexDirection:"column",gap:"8px",paddingBottom:"6px"}}>
          {/* Lets a password manager (iCloud Keychain) save it against the right email. */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly style={{display:"none"}}/>
          <input type="password" name="new-password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 10 characters" aria-label="New password" autoFocus
            style={{boxSizing:"border-box",width:"100%",border:"1.5px solid rgba(22,47,36,0.15)",borderRadius:"100px",padding:"11px 16px",fontSize:"14px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE}}/>
          <div style={{display:"flex",gap:"8px"}}>
            <button type="button" onClick={() => { setEditing(false); setPw(""); setError(null); }} style={{flex:1,background:"transparent",border:"1.3px solid rgba(22,47,36,0.2)",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,color:G,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
            <button type="submit" disabled={!!busy} style={{flex:1,background:G,border:"none",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,color:WHITE,cursor:"pointer",fontFamily:"inherit"}}>{busy === "password" ? "Saving…" : "Save password"}</button>
          </div>
        </form>
      )}
      {done && <div style={{fontSize:"12px",color:G,fontWeight:600}}>{done}</div>}
      {error && <div role="alert" style={{fontSize:"12px",color:ERROR_TEXT}}>{error}</div>}
    </div>
  );
}

// In Edit inputs' subscription section.
export default function SignInSetup() {
  const [signIns, reload] = useSignIns();
  if (!signIns) return null;
  return (
    <div style={{marginTop:"14px"}}>
      <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Signing in on another device</div>
      <SignInMethods signIns={signIns} reload={reload}/>
    </div>
  );
}

// Required of every subscriber with neither a passkey nor a password: a
// screen over the app, straight after paying (before the module's answer)
// and, for anyone who subscribed before this, on their next visit. No way
// past it but setting one up, so every subscriber can sign in elsewhere
// without an email link. What's set up is remembered for the visit, so
// moving between screens doesn't ask the server again.
let known = null; // { email, signIns }
export function SignInGate() {
  const email = hasAccess() ? accessInfo()?.email : null;
  const [signIns, setSignIns] = useState(() => (known && known.email === email ? known.signIns : null));
  useEffect(() => {
    const load = () => {
      const who = hasAccess() ? accessInfo()?.email : null;
      if (!who) { setSignIns(null); return; }
      if (known?.email === who) { setSignIns(known.signIns); return; }
      accountSignIns().then(s => { known = { email: who, signIns: s }; setSignIns(s); }).catch(() => {});
    };
    load();
    window.addEventListener("candid-access", load);
    return () => window.removeEventListener("candid-access", load);
  }, []);
  if (!email || !signIns || signIns.passkeys || signIns.password) return null;
  const done = (how, s) => {
    posthog.capture("sign_in_created", { how });
    known = { email, signIns: s };
    setSignIns(s);
  };
  return <CreateSignIn email={email} onDone={done}/>;
}

function CreateSignIn({ email, onDone }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [pw, setPw] = useState("");
  const canPasskey = passkeysSupported();
  const run = async (how, fn) => {
    setBusy(how); setError(null);
    try { await fn(); onDone(how, await accountSignIns()); }
    catch (e) { if (e.message !== "cancelled") setError(e.message === "not-saved" ? passkeyNotSavedHelp() : e.message); setBusy(null); }
  };
  const withPassword = e => {
    e.preventDefault();
    if (pw.length < 10) { setError("Use at least 10 characters."); return; }
    run("password", () => setPassword(pw));
  };
  const button = primary => ({
    width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
    background: primary ? G : WHITE, color: primary ? WHITE : G, border: primary ? "none" : `1.5px solid ${G}`,
    borderRadius:"100px", padding:"15px", fontSize:"15.5px", fontWeight:700, fontFamily:"inherit", cursor: busy ? "default" : "pointer",
  });
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="create-sign-in-title"
      style={{position:"fixed",inset:0,zIndex:6000,background:CREAM,overflowY:"auto"}}>
      <NavBar light/>
      <div style={{maxWidth:"420px",margin:"0 auto",padding:"32px 20px 40px"}}>
        <h1 id="create-sign-in-title" style={{fontFamily:SERIF,fontSize:"30px",fontWeight:700,color:G,margin:0,lineHeight:1.2}}>Create your sign-in</h1>
        <p style={{fontSize:"15px",color:MUT,lineHeight:1.6,margin:"12px 0 0"}}>So you can open Candid on another device and pick up where you left off. Your account is {email}.</p>

        {canPasskey && (
          <>
            <button type="button" disabled={!!busy} onClick={() => run("passkey", addPasskey)} style={{...button(true),marginTop:"28px"}}>
              <ScanFace size={19}/>{busy === "passkey" ? "Waiting for your device…" : `Use ${passkeyName() === "passkey" ? "a passkey" : passkeyName()}`}
            </button>
            <div style={{display:"flex",alignItems:"center",gap:"12px",margin:"22px 0 14px"}}>
              <hr style={{flex:1,border:"none",borderTop:"1px solid rgba(22,47,36,0.12)",margin:0}}/>
              <span style={{fontSize:"12.5px",color:MUT}}>or create a password</span>
              <hr style={{flex:1,border:"none",borderTop:"1px solid rgba(22,47,36,0.12)",margin:0}}/>
            </div>
          </>
        )}

        <form onSubmit={withPassword} style={{display:"flex",flexDirection:"column",gap:"10px",marginTop:canPasskey ? 0 : "28px"}}>
          {/* Lets a password manager (iCloud Keychain) save it against the right email. */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly style={{display:"none"}}/>
          <input type="password" name="new-password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Password, at least 10 characters" aria-label="New password"
            style={{boxSizing:"border-box",width:"100%",border:"1.5px solid rgba(22,47,36,0.15)",borderRadius:"100px",padding:"14px 18px",fontSize:"15px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE}}/>
          <button type="submit" disabled={!!busy} style={button(!canPasskey)}>{busy === "password" ? "Saving…" : "Create password"}</button>
          {error && <div role="alert" style={{fontSize:"13px",color:ERROR_TEXT}}>{error}</div>}
        </form>
      </div>
    </div>
  );
}
