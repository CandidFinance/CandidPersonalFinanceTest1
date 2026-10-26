import { Component } from "react";
import posthog from "posthog-js";

// Top-level crash guard — without this, an uncaught error anywhere in the
// render tree unmounts the whole app silently: a blank white screen with
// nothing for the user to act on and nothing but a browser-console stack
// trace to go on. Deliberately has zero dependency on CandidApp.jsx or any
// other app module (styles are inlined, not imported design tokens), so a
// bug in the app itself can never also take down the boundary meant to
// catch it. Note: this only catches errors during React's render/lifecycle
// phase — a bug that throws while a module is first being imported (e.g. a
// circular-import ordering issue) happens before React ever mounts, and no
// error boundary can intercept that class of failure.
//
// The hex values below are intentionally re-typed rather than imported from
// design-tokens.js (see above) — they should still match CREAM/G/MUT exactly
// if those ever change, so update both places together.
// A tab left open across a deploy still runs the old build, which asks for
// code files the new deploy has replaced; the browser's error for that
// (wording differs by browser) is matched here. Reloading picks up the new
// build. At most once a minute, so a real outage can't loop the page.
const STALE_BUILD = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to load module script/i;
const RELOADED_AT = "candid_stale_reload_at";
export function isStaleBuildError(error) {
  return STALE_BUILD.test(String(error?.message || error || ""));
}
export function reloadForNewBuild(error) {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) || 0);
    if (Date.now() - last < 60000) return false;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch { return false; }
  try { posthog.capture("stale_build_reload", { error_message: String(error?.message || error || "").slice(0, 200) }); } catch {}
  window.location.reload();
  return true;
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    if (import.meta.env.DEV) console.error("[Candid] Uncaught render error:", error, info);
    // An old build's missing file: reload into the new one, not a crash.
    if (isStaleBuildError(error) && reloadForNewBuild(error)) return;
    try {
      posthog.capture("app_crashed", {
        error_message: error?.message || "unknown",
        error_stack: error?.stack ? String(error.stack).slice(0, 500) : null,
      });
    } catch {}
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 24px",textAlign:"center",background:"#faf7f0",fontFamily:"'DM Sans', sans-serif"}}>
        <div style={{fontFamily:"'Playfair Display', Georgia, serif",fontSize:"22px",color:"#162f24",fontWeight:700,marginBottom:"10px"}}>
          Something went wrong
        </div>
        <p style={{fontSize:"14px",color:"#6b6b6b",lineHeight:1.6,maxWidth:"320px",marginBottom:"24px"}}>
          Candid hit an unexpected error. Your saved data is safe — reloading usually fixes this.
        </p>
        <button onClick={() => window.location.reload()} style={{background:"#162f24",color:"#ffffff",border:"none",borderRadius:"100px",padding:"12px 28px",fontSize:"14px",fontWeight:600,cursor:"pointer"}}>
          Reload Candid
        </button>
      </div>
    );
  }
}
