import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { ERROR_TEXT } from "../design-tokens.js";
import { googleSignInAvailable, renderGoogleButton, forgetGoogleButton } from "../lib/google.js";
import OrRule from "./OrRule.jsx";

// "Continue with Google", beside the email ask (SaveFiguresOffer) and on the
// sign-in screens (SignInPage, SignInSetup, MobileUnlock). Google draws the
// button; `onCredential(credential)` does the signing in and throws with a
// message to show when it doesn't work. Nothing at all without a client id
// (src/lib/google.js), or when Google's script can't load.
// `source`: where it is, for the events. `divider`: an "or" rule under it.
// `onUnavailable`: told when the script doesn't load and the button goes,
// for the screen to space what's left without it (useGoogleButtonShown).
export default function GoogleButton({ onCredential, source, divider = false, style = null, onUnavailable = null }) {
  const box = useRef(null);
  const [shown, setShown] = useState(googleSignInAvailable());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // The latest props, for Google's callbacks, which are set up once.
  const where = useRef(source);
  where.current = source;
  const gone = useRef(onUnavailable);
  gone.current = onUnavailable;
  const handle = useRef(null);
  handle.current = async credential => {
    setBusy(true); setError(null);
    try { await onCredential(credential); }
    catch (e) { setError(e.message); posthog.capture("oauth_failed", { provider: "google", source: where.current }); }
    setBusy(false);
  };

  useEffect(() => {
    if (!shown || !box.current) return;
    let live = true;
    const onToken = c => {
      if (!live) return;
      posthog.capture("oauth_completed", { provider: "google", source: where.current });
      handle.current(c);
    };
    renderGoogleButton(box.current, box.current.offsetWidth || 320, onToken,
      () => posthog.capture("oauth_started", { provider: "google", source: where.current })).catch(() => { if (live) { setShown(false); gone.current?.(); } });
    return () => { live = false; forgetGoogleButton(onToken); };
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

// Whether the Google button is on screen, for spacing the controls under
// it: pass `hide` as its onUnavailable.
export function useGoogleButtonShown() {
  const [shown, setShown] = useState(googleSignInAvailable);
  return [shown, () => setShown(false)];
}
