import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import posthog from "posthog-js";
import { G, WHITE, MUT, SERIF, SANS } from "./CandidApp.jsx";

const BETA_UNLOCK_KEY = "candid_beta_unlocked";

export function isBetaUnlocked() {
  try { return localStorage.getItem(BETA_UNLOCK_KEY) === "true"; }
  catch (e) { return false; }
}

function unlockBeta() {
  try { localStorage.setItem(BETA_UNLOCK_KEY, "true"); } catch (e) {}
}

// Decides where an unlocked tester lands: a returning tester with a saved
// report goes straight back into it (mirrors the old root route's
// "welcome back" behaviour); everyone else starts the pre-assessment
// confidence check. Always the mobile-native app (/app/...), regardless of
// viewport — the product being tested is the mobile-native app, there is no
// separate desktop destination to branch to any more.
export function destinationAfterUnlock() {
  try {
    const hasSavedInputs = !!localStorage.getItem('candid_inputs');
    const hasSavedInsights = !!localStorage.getItem('candid_insights');
    if (hasSavedInputs && hasSavedInsights) return "/app/home";
  } catch (e) {}
  return "/welcome";
}

// Wraps every product route (assessment/dashboard/modules/forecast/chat, both
// desktop and mobile) — a direct or bookmarked URL without a stored unlock is
// bounced to the password gate instead of reaching the app, closing off the
// obvious "just type the URL" bypass of the nav button.
export function RequireBeta({ children }) {
  const location = useLocation();
  if (!isBetaUnlocked()) {
    return <Navigate to="/beta" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

export default function BetaGate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already unlocked (bookmarked /beta, or bounced back here mid-session by
  // RequireBeta before this component re-checks) — skip straight through
  // rather than asking again.
  if (isBetaUnlocked()) {
    return <Navigate to={location.state?.from || destinationAfterUnlock()} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/beta", { headers: { "x-beta-password": password } });
      if (res.status === 401) { setError("Wrong password"); setLoading(false); return; }
      if (res.status === 429) { setError("Too many attempts — try again shortly"); setLoading(false); return; }
      if (!res.ok) { setError("Something went wrong — try again"); setLoading(false); return; }
      unlockBeta();
      posthog.capture("beta_unlocked");
      navigate(location.state?.from || destinationAfterUnlock(), { replace: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (e) {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6f0e6", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: SANS }}>
      <form onSubmit={handleSubmit} style={{ background: WHITE, borderRadius: "14px", padding: "36px 32px", width: "100%", maxWidth: "360px", boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
        <div style={{ fontFamily: SERIF, fontSize: "22px", fontWeight: 700, color: G, marginBottom: "8px" }}>Candid.</div>
        <div style={{ fontSize: "14px", color: MUT, marginBottom: "22px", lineHeight: 1.6 }}>
          The app is currently in private beta. Enter your tester password to continue.
        </div>
        <input
          type="password" autoFocus value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Beta password"
          style={{ width: "100%", padding: "12px 14px", border: "1.5px solid rgba(22,47,36,0.18)", borderRadius: "8px", fontSize: "14px", fontFamily: SANS, marginBottom: "14px", boxSizing: "border-box" }}
        />
        <button type="submit" disabled={loading || !password} style={{
          width: "100%", padding: "13px", background: (loading || !password) ? "rgba(22,47,36,0.25)" : G,
          border: "none", borderRadius: "8px", color: WHITE, fontSize: "14px", fontWeight: 700,
          cursor: (loading || !password) ? "not-allowed" : "pointer", fontFamily: SANS,
        }}>
          {loading ? "Checking…" : "Continue"}
        </button>
        {error && <div style={{ color: "#b3261e", fontSize: "13px", marginTop: "12px" }}>{error}</div>}
        <button type="button" onClick={() => navigate("/")} style={{
          display: "block", width: "100%", background: "transparent", border: "none",
          color: MUT, fontSize: "12px", marginTop: "16px", cursor: "pointer", fontFamily: SANS,
        }}>← Back to candid-finance.co.uk</button>
      </form>
    </div>
  );
}
