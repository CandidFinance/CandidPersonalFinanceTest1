import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { MUT, ERROR_TEXT } from "../design-tokens.js";
import { googleSignInAvailable, renderGoogleButton } from "../lib/google.js";

// "Continue with Google", beside the email ask (SaveFiguresOffer) and on the
// sign-in screens (SignInPage, SignInSetup, MobileUnlock). Google draws the
// button; `onCredential(credential)` does the signing in and throws with a
// message to show when it doesn't work. Nothing at all without a client id
// (src/lib/google.js), or when Google's script can't load.
// `source`: where it is, for the events. `divider`: an "or" rule under it.
export default function GoogleButton({ onCredential, source, divider = false, style = null }) {
  const box = useRef(null);
  const [shown, setShown] = useState(googleSignInAvailable());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const handle = useRef(null);
  handle.current = async credential => {
    setBusy(true); setError(null);
    try { await onCredential(credential); }
    catch (e) { setError(e.message); posthog.capture("oauth_failed", { provider: "google", source }); }
    setBusy(false);
  };

  useEffect(() => {
    if (!shown || !box.current) return;
    let live = true;
    renderGoogleButton(box.current, box.current.offsetWidth || 320, c => {
      posthog.capture("oauth_completed", { provider: "google", source });
      handle.current(c);
    }, () => posthog.capture("oauth_started", { provider: "google", source })).catch(() => { if (live) setShown(false); });
    return () => { live = false; };
  }, [shown]);

  if (!shown) return null;
  return (
    <div style={style}>
      <div ref={box} style={{display:"flex",justifyContent:"center",minHeight:"44px",opacity:busy ? 0.5 : 1,pointerEvents:busy ? "none" : "auto"}}/>
      {error && <div role="alert" style={{fontSize:"12.5px",color:ERROR_TEXT,marginTop:"8px",textAlign:"center"}}>{error}</div>}
      {divider && <OrRule/>}
    </div>
  );
}

export function OrRule({ margin = "14px 0 12px" }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:"12px",margin}}>
      <hr style={{flex:1,border:"none",borderTop:"1px solid rgba(22,47,36,0.12)",margin:0}}/>
      <span style={{fontSize:"12.5px",color:MUT}}>or</span>
      <hr style={{flex:1,border:"none",borderTop:"1px solid rgba(22,47,36,0.12)",margin:0}}/>
    </div>
  );
}
