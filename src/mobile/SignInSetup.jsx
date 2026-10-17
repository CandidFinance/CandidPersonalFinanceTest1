import { useEffect, useState } from "react";
import { ScanFace } from "lucide-react";
import { G, WHITE, MUT, TEXT, ERROR_TEXT, RADIUS_CARD } from "../design-tokens.js";
import { accessInfo, accountSignIns, addPasskey, setPassword, passkeysSupported, hasAccess } from "../lib/entitlement.js";
import { reportStorageFailure } from "../lib/storage.js";

// A subscriber's ways to sign in on another device (src/site/SignInPage.jsx):
// a passkey on this device (Face ID, Touch ID, a phone's screen lock) and a
// password. Shown in Edit inputs' subscription section, and once on Home
// (SignInSetupCard) until one is set up or it's dismissed.

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
    catch (e) { if (e.message !== "cancelled") setError(e.message); return false; }
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
            <div style={name}>Face ID or passkey</div>
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

// Once on Home, for a subscriber with neither set up: "Not now" hides it
// for good on this device; setting either up hides it too.
const DISMISSED_KEY = "candid_sign_in_setup_dismissed";
export function SignInSetupCard() {
  const [signIns, reload] = useSignIns();
  const [dismissed, setDismissed] = useState(() => {
    try { return !!localStorage.getItem(DISMISSED_KEY); } catch (e) { reportStorageFailure("read_sign_in_setup_dismissed", e); return false; }
  });
  // Shown until the first one is set up, then kept for this visit so the
  // "added" message is seen.
  const [shown, setShown] = useState(false);
  const none = signIns && !signIns.passkeys && !signIns.password;
  useEffect(() => { if (none) setShown(true); }, [none]);
  if (dismissed || !signIns || !shown) return null;
  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch (e) { reportStorageFailure("save_sign_in_setup_dismissed", e); }
    setDismissed(true);
  };
  return (
    <div style={{marginTop:"22px",background:WHITE,border:"1px solid rgba(22,47,36,0.08)",borderRadius:RADIUS_CARD,boxShadow:"0 2px 10px rgba(22,47,36,0.05)",padding:"18px"}}>
      <div style={{fontSize:"16px",fontWeight:700,color:TEXT,lineHeight:1.35}}>Sign in faster on your other devices</div>
      <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"4px 0 6px"}}>Add Face ID or a password, so signing in elsewhere doesn't need an email link.</p>
      <SignInMethods signIns={signIns} reload={reload}/>
      {none && <button type="button" onClick={dismiss} style={{marginTop:"6px",background:"none",border:"none",padding:0,color:MUT,fontSize:"13px",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Not now</button>}
    </div>
  );
}
