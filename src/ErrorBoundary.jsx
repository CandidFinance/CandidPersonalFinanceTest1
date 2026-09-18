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
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 24px",textAlign:"center",background:"#F6F0E6",fontFamily:"'DM Sans', sans-serif"}}>
        <div style={{fontFamily:"'Playfair Display', Georgia, serif",fontSize:"22px",color:"#162F24",fontWeight:700,marginBottom:"10px"}}>
          Something went wrong
        </div>
        <p style={{fontSize:"14px",color:"#6b6b6b",lineHeight:1.6,maxWidth:"320px",marginBottom:"24px"}}>
          Candid hit an unexpected error. Your saved data is safe — reloading usually fixes this.
        </p>
        <button onClick={() => window.location.reload()} style={{background:"#162F24",color:"#fff",border:"none",borderRadius:"100px",padding:"12px 28px",fontSize:"14px",fontWeight:600,cursor:"pointer"}}>
          Reload Candid
        </button>
      </div>
    );
  }
}
