import { useState, useEffect, lazy, Suspense } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom"
import posthog from "posthog-js"
import { MotionConfig } from "framer-motion"
import CandidApp, { PageWrap, NavBar, ContentWrap } from "./CandidApp.jsx"
import ErrorBoundary from "./ErrorBoundary.jsx"
import BetaGate, { RequireBeta } from "./BetaGate.jsx"

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── Acquisition attribution — captured once per browser, ever ─────────────────
// PostHog's own native first-touch mechanism ($initial_utm_source etc.) never
// actually activates in this app: it's gated behind person profile creation,
// which requires either person_profiles:"always" or an identify()/
// createPersonProfile() call, and neither happens here. Rather than take on
// that (it would turn every anonymous visitor into a billed PostHog "person"),
// this rolls a small first-party equivalent — same read-once/write-once
// localStorage pattern as candid_inputs/candid_insights below — and pins it
// as a super property so it rides every event without touching PostHog's
// own per-event (session-scoped) utm_source, which keeps reporting each
// visit's current touch untouched alongside it.
function getAcquisition() {
  try {
    const existing = localStorage.getItem('candid_acquisition')
    if (existing) return { ...JSON.parse(existing), fresh: false }
  } catch (e) {}
  const p = new URLSearchParams(window.location.search)
  // A ?ref=<id> referral link is treated as equivalent to a
  // utm_source=referral&utm_medium=referral link, with the referring user's
  // own id (their posthog distinct_id, reused rather than minting a new one —
  // see ReferralCTA in CandidApp.jsx) carried alongside as referred_by.
  const ref = p.get('ref')
  const record = {
    source: ref ? 'referral' : (p.get('utm_source') || 'direct'),
    medium: ref ? 'referral' : (p.get('utm_medium') || null),
    campaign: p.get('utm_campaign') || null,
    referred_by: ref || null,
    first_visit_at: new Date().toISOString(),
  }
  try { localStorage.setItem('candid_acquisition', JSON.stringify(record)) } catch (e) {}
  return { ...record, fresh: true }
}
const acquisition = getAcquisition()

// ── localStorage failure visibility ────────────────────────────────────────
// These catches only ever fire on a genuine thrown error (storage blocked/
// disabled, quota exceeded, corrupted JSON) — every call site already guards
// the merely-missing-key case with a ternary/if before touching the catch.
// Unconditional console.error (not DEV-gated, unlike reportSupabaseFailure in
// CandidApp.jsx) since these were previously silent in every environment.
function reportStorageFailure(context, e) {
  console.error(`[Candid] localStorage failed — ${context}:`, e?.message || e);
  posthog.capture("local_storage_failed", { context, error_message: e?.message || String(e) });
}

// ── Analytics — runs once at module load, production only ─────────────────────
if (import.meta.env.PROD && import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: "https://eu.i.posthog.com",
    person_profiles: "identified_only",
    // "history_change" (rather than the default one-shot `true`) tracks each
    // client-side route change as its own pageview now that Homepage/Assessment/
    // Dashboard/Modules are real routes instead of one static page.
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: false,
  })
}
posthog.register({
  acquisition_source: acquisition.source,
  acquisition_medium: acquisition.medium,
  acquisition_campaign: acquisition.campaign,
  referred_by: acquisition.referred_by,
})
// Fires once ever per browser — the same read-once/write-once guarantee
// getAcquisition() already gives acquisition.fresh — so this can't double-fire
// on a later visit even if the ?ref= param is still sitting in the URL/history.
if (acquisition.fresh && acquisition.source === 'referral') {
  posthog.capture('referral_started', { referred_by: acquisition.referred_by })
}

// ── Dev tools (test profile loader) — genuinely excluded from prod builds ──────
// Vite statically replaces import.meta.env.VITE_* at build time. Set
// VITE_SHOW_DEV_TOOLS=true in .env.local for local dev, and in Vercel's
// Development/Preview env vars (never Production). When the flag is unset,
// SHOW_DEV_TOOLS folds to a literal `false`, so the `if` block below —
// including the dynamic import() — is dead code that esbuild's minifier
// strips from the production bundle; DevTools.jsx's chunk is never emitted.
const SHOW_DEV_TOOLS = import.meta.env.VITE_SHOW_DEV_TOOLS === "true"
let DevToolsPanel = null
if (SHOW_DEV_TOOLS) {
  DevToolsPanel = lazy(() => import("./DevTools.jsx"))
}

// The live marketing site — rebuilt at /new during review, now promoted to
// "/" itself (see RootRoute below). Kept lazy so the desktop app bundle
// (CandidApp.jsx) doesn't pull this in and vice versa.
const NewLandingPage = lazy(() => import("./mockups/NewLandingPage.jsx"))
const TheProblemPage = lazy(() => import("./mockups/TheProblemPage.jsx"))
const HowItWorksPage = lazy(() => import("./mockups/HowItWorksPage.jsx"))

const G    = "#162f24"
const GOLD = "#c4963a"
const CREAM= "#f6f0e6"
const WHITE= "#ffffff"
const MUT  = "#6b6b6b"
const SERIF= "'Playfair Display', serif"
const SANS = "'DM Sans', sans-serif"

// ── Welcome back screen ───────────────────────────────────────────────────────
function WelcomeBack({ name, insightsDate, onViewReport, onUpdateInputs, onStartFresh }) {
  const date = insightsDate
    ? new Date(insightsDate).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
    : null;
  return (
    <div style={{ minHeight:"100vh", background:G, display:"flex", flexDirection:"column" }}>
      <NavBar center="Welcome back"/>
      <div style={{
        flex:1,
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        padding:"40px 24px", textAlign:"center", fontFamily:SANS,
      }}>
        <div style={{
          fontFamily:SERIF, fontSize:"clamp(52px,10vw,72px)", fontWeight:700,
          color:GOLD, lineHeight:1, marginBottom:"12px", letterSpacing:"-1px",
        }}>
          {name || "Welcome"}
        </div>
        <div style={{
          fontSize:"20px", color:"rgba(246,240,230,0.7)",
          marginBottom:"48px", fontFamily:SERIF, fontStyle:"italic",
        }}>
          Welcome back.
        </div>
        <div style={{display:"flex", flexDirection:"column", gap:"14px", width:"100%", maxWidth:"320px"}}>
          <button onClick={onViewReport} style={{
            background:GOLD, color:G, border:"none",
            borderRadius:"10px", padding:"18px 32px",
            fontSize:"17px", fontWeight:700, cursor:"pointer", fontFamily:SANS,
          }}>
            My Candid report →
          </button>
          {date && (
            <div style={{fontSize:"11px", color:"rgba(246,240,230,0.35)", marginTop:"-8px"}}>
              Last generated {date}
            </div>
          )}
          <button onClick={onUpdateInputs} style={{
            background:"transparent", color:GOLD,
            border:"1.5px solid rgba(196,150,58,0.4)",
            borderRadius:"10px", padding:"16px 32px",
            fontSize:"17px", fontWeight:600, cursor:"pointer", fontFamily:SANS,
          }}>
            Something's changed
          </button>
          <button onClick={onStartFresh} style={{
            background:"none", border:"none",
            color:"rgba(246,240,230,0.3)", fontSize:"13px",
            cursor:"pointer", marginTop:"8px", fontFamily:SANS,
          }}>
            Start fresh
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pre-assessment confidence check ────────────────────────────────────────────
// Deliberately not one of CandidApp's 8 onboarding STEPS — this is a single,
// separate, low-stakes question shown once before the real assessment begins,
// so it doesn't read as part of "the test" and doesn't shift the step numbers
// the assessment_question_* analytics events already reference.
const CONFIDENCE_LABELS = { 1: "Not confident", 5: "Very confident" };

function ConfidenceCheck() {
  const navigate = useNavigate();
  const [score, setScore] = useState(() => {
    try {
      const saved = localStorage.getItem('candid_confidence_score');
      return saved ? parseInt(saved, 10) : null;
    } catch (e) { reportStorageFailure("confidence_check_load", e); return null; }
  });

  function handleContinue() {
    try { localStorage.setItem('candid_confidence_score', String(score)); } catch (e) { reportStorageFailure("confidence_check_save", e); }
    // Always the mobile-native wizard, regardless of viewport — the product
    // is the mobile-native app; there's no separate desktop destination to
    // branch to any more.
    navigate("/app/assessment/1");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <PageWrap>
      <NavBar light center="Before you start" right={<button type="button" onClick={() => navigate("/")} style={{background:"transparent",border:`1px solid rgba(22,47,36,0.2)`,borderRadius:"6px",padding:"6px 14px",color:"rgba(22,47,36,0.6)",fontSize:"12px",cursor:"pointer"}}>← Back</button>}/>
      <ContentWrap maxWidth="480px">
        <div style={{textAlign:"center", marginTop:"32px"}}>
          <div style={{fontFamily:SERIF, fontSize:"clamp(22px,4vw,26px)", fontWeight:700, color:G, marginBottom:"12px"}}>
            Quick one before we start
          </div>
          <p style={{fontSize:"14px", color:MUT, lineHeight:1.65, marginBottom:"36px", maxWidth:"380px", margin:"0 auto 36px"}}>
            How confident are you managing your finances? There's no wrong answer here — it just helps us tailor what we show you.
          </p>
          <div style={{display:"flex", justifyContent:"center", gap:"10px", marginBottom:"10px", flexWrap:"wrap"}}>
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button" onClick={() => setScore(n)} style={{
                width:"52px", height:"52px", borderRadius:"50%",
                border:`1.5px solid ${score===n ? G : "rgba(22,47,36,0.18)"}`,
                background: score===n ? G : WHITE,
                color: score===n ? WHITE : "#1a1a1a",
                fontSize:"18px", fontWeight:700, cursor:"pointer",
                fontFamily:SANS, transition:"all 0.15s",
              }}>{n}</button>
            ))}
          </div>
          <div style={{display:"flex", justifyContent:"space-between", fontSize:"11px", color:MUT, marginBottom:"40px"}}>
            <span>{CONFIDENCE_LABELS[1]}</span><span>{CONFIDENCE_LABELS[5]}</span>
          </div>
          <button type="button" onClick={handleContinue} disabled={!score} style={{
            width:"100%", padding:"14px", background:score?G:"rgba(22,47,36,0.25)", border:"none",
            borderRadius:"8px", fontSize:"15px", fontWeight:600, color:WHITE,
            cursor:score?"pointer":"not-allowed", fontFamily:SANS,
          }}>Continue →</button>
        </div>
      </ContentWrap>
    </PageWrap>
  );
}

// ── Internal feedback admin (password-gated server-side, see api/feedback.js) ─
// No persistence of the password across reloads by design — this shows real
// users' free-text opinions, so the convenience of "stay logged in" isn't
// worth it for a page opened rarely by one person.
function FeedbackAdmin() {
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", { headers: { "x-admin-password": password } });
      if (res.status === 401) { setError("Wrong password"); setLoading(false); return; }
      if (res.status === 429) { setError("Too many attempts — try again shortly"); setLoading(false); return; }
      if (!res.ok) { setError("Something went wrong fetching feedback"); setLoading(false); return; }
      const data = await res.json();
      setRows(data.rows);
    } catch (e) {
      setError("Network error");
    }
    setLoading(false);
  }

  const cellStyle = { padding: "10px 14px", borderBottom: "1px solid rgba(22,47,36,0.1)", fontSize: "13px", color: "#1a1a1a", verticalAlign: "top", textAlign: "left" };
  const headStyle = { ...cellStyle, fontWeight: 700, color: G, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `2px solid ${G}`, whiteSpace: "nowrap" };

  if (!rows) {
    return (
      <div style={{ minHeight: "100vh", background: CREAM, display: "flex", flexDirection: "column" }}>
        <NavBar center="Feedback admin"/>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, padding: "24px" }}>
          <form onSubmit={handleSubmit} style={{ background: WHITE, borderRadius: "12px", padding: "32px", width: "100%", maxWidth: "340px", boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
            <div style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 700, color: G, marginBottom: "18px" }}>Feedback admin</div>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(22,47,36,0.18)", borderRadius: "8px", fontSize: "14px", fontFamily: SANS, marginBottom: "12px" }}
            />
            <button type="submit" disabled={loading || !password} style={{ width: "100%", padding: "11px", background: (loading || !password) ? "rgba(22,47,36,0.25)" : G, border: "none", borderRadius: "8px", color: WHITE, fontSize: "14px", fontWeight: 600, cursor: (loading || !password) ? "not-allowed" : "pointer", fontFamily: SANS }}>
              {loading ? "Checking…" : "View feedback"}
            </button>
            {error && <div style={{ color: "#b3261e", fontSize: "13px", marginTop: "10px" }}>{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", flexDirection: "column" }}>
      <NavBar center="Feedback admin"/>
      <div style={{ fontFamily: SANS, padding: "32px 24px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ fontFamily: SERIF, fontSize: "22px", fontWeight: 700, color: G, marginBottom: "4px" }}>Feedback ({rows.length})</div>
          <div style={{ fontSize: "12px", color: MUT, marginBottom: "20px" }}>Most recent first</div>
          {rows.length === 0 ? (
            <div style={{ color: MUT, fontSize: "14px" }}>No feedback submitted yet.</div>
          ) : (
            <div style={{ overflowX: "auto", background: WHITE, borderRadius: "10px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={headStyle}>When</th>
                    <th style={headStyle}>Session</th>
                    <th style={headStyle}>Confidence</th>
                    <th style={headStyle}>Q1: Knew something new?</th>
                    <th style={{ ...headStyle, minWidth: "220px" }}>Q2: Most useful thing</th>
                    <th style={{ ...headStyle, minWidth: "220px" }}>Q3: Would change anything?</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td style={cellStyle}>{new Date(r.created_at).toLocaleString("en-GB")}</td>
                      <td style={{ ...cellStyle, fontFamily: "monospace", fontSize: "11px", color: MUT }}>{r.session_id || "—"}</td>
                      <td style={cellStyle}>{r.confidence_score ?? "—"}</td>
                      <td style={cellStyle}>{r.post_feedback_knew_something || "—"}</td>
                      <td style={{ ...cellStyle, whiteSpace: "pre-wrap" }}>{r.post_feedback_useful_text || "—"}</td>
                      <td style={{ ...cellStyle, whiteSpace: "pre-wrap" }}>
                        {r.post_feedback_would_change || "—"}
                        {r.post_feedback_change_details ? ` — ${r.post_feedback_change_details}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Root route ("/") ── the live marketing site, for everyone, except a
// TrueLayer bounce. TrueLayer's bank-connect callback and hosted-payment-page
// redirect always land here (never inside the app — the API callback
// redirects to the site root, and the hosted payment page redirects straight
// to return_uri with no server hop), so this checks for those params first
// and forwards into the mobile-native wizard's Cash & savings step (route 5
// — MobileOnboardingStep shares the same ALL_STEP_DEFS/step numbering as the
// desktop wizard, and already has its own TrueLayer connect UI) with the
// query string intact, instead of ever rendering the marketing page. Whoever
// started that TrueLayer flow already unlocked the beta gate to get into the
// assessment in the first place, so RequireBeta on /app/assessment/:step
// passes straight through.
function RootRoute() {
  const search = new URLSearchParams(window.location.search);
  const isTrueLayerBounce = search.get('truelayer') || search.get('truelayer_payment');
  if (isTrueLayerBounce) {
    return <Navigate to={`/app/assessment/5${window.location.search}`} replace />;
  }
  return <Suspense fallback={null}><NewLandingPage /></Suspense>;
}

// ── Returning-tester screen ── reached only once beta-unlocked, via
// BetaGate's destinationAfterUnlock: a tester who already has a saved report
// lands here instead of the confidence check. Same content/behaviour as the
// old root route's "welcome back" branch, just relocated behind the gate.
function WelcomeBackRoute() {
  const navigate = useNavigate();

  // Fires once per mount — flips the `returned` flag on the report row this
  // browser generated last, via the same row id CandidApp mirrors to
  // localStorage alongside candid_insights.
  useEffect(() => {
    posthog.capture("user_returned");
    try {
      const rowId = localStorage.getItem('candid_report_row_id');
      if (rowId && SUPA_URL && SUPA_KEY) {
        fetch(`${SUPA_URL}/rest/v1/test?id=eq.${rowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Prefer: "return=minimal" },
          body: JSON.stringify({ returned: true }),
        }).catch(() => {});
      }
    } catch (e) { reportStorageFailure("welcome_back_mark_returned", e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately mount-once
  }, []);

  return (
    <WelcomeBack
      name={(() => { try { const s = localStorage.getItem('candid_inputs'); return s ? JSON.parse(s).name || "" : ""; } catch(e) { reportStorageFailure("welcome_back_name", e); return ""; } })()}
      insightsDate={(() => { try { return localStorage.getItem('candid_insights_date'); } catch(e) { reportStorageFailure("welcome_back_insights_date", e); return null; } })()}
      onViewReport={() => { navigate("/app/home"); window.scrollTo({ top:0, behavior:"instant" }); }}
      onUpdateInputs={() => {
        try { localStorage.removeItem('candid_insights'); localStorage.removeItem('candid_insights_date'); } catch(e) { reportStorageFailure("update_inputs_clear", e); }
        navigate("/app/assessment/1");
        window.scrollTo({ top:0, behavior:"instant" });
      }}
      onStartFresh={() => {
        try {
          localStorage.removeItem('candid_inputs');
          localStorage.removeItem('candid_insights');
          localStorage.removeItem('candid_insights_date');
        } catch(e) { reportStorageFailure("start_fresh_clear", e); }
        navigate("/welcome");
        window.scrollTo({ top:0, behavior:"instant" });
      }}
    />
  );
}

// Wraps CandidApp with the scroll-target id its own "jump to top on module
// open" logic looks for (document.getElementById("candid-app")).
function CandidAppLayout() {
  return (
    <div id="candid-app" style={{ minHeight: "100vh" }}>
      <CandidApp />
    </div>
  );
}

// ── Routes ────────────────────────────────────────────────────────────────────
function AppRoutes() {
  const navigate = useNavigate();

  // Bumped whenever the dev panel loads a preset, forcing CandidAppLayout (and
  // the CandidApp instance inside it) to remount via its `key` so it re-reads
  // the freshly-written localStorage instead of keeping its already-initialized
  // `d`/`insights` state.
  const [devReloadKey, setDevReloadKey] = useState(0);
  function handleDevPresetLoaded() {
    setDevReloadKey(k => k + 1);
    navigate("/dashboard");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/the-problem" element={<Suspense fallback={null}><TheProblemPage /></Suspense>} />
        <Route path="/how-it-works" element={<Suspense fallback={null}><HowItWorksPage /></Suspense>} />
        <Route path="/beta" element={<BetaGate />} />
        <Route path="/welcome" element={<RequireBeta><ConfidenceCheck /></RequireBeta>} />
        <Route path="/welcome-back" element={<RequireBeta><WelcomeBackRoute /></RequireBeta>} />
        <Route path="/admin/feedback" element={<FeedbackAdmin />} />
        {/* Pathless layout route: CandidAppLayout (and the CandidApp state it
            holds — d, insights, completedModules, one-shot modal refs, etc.)
            stays mounted across navigation between all three of these paths,
            branching on the URL internally the same way it used to branch on
            local `screen` state. RequireBeta wraps the whole layout so a
            direct/bookmarked URL into any of these — not just the nav
            button — is bounced to the password gate. */}
        <Route element={<RequireBeta><CandidAppLayout key={devReloadKey} /></RequireBeta>}>
          <Route path="/assessment/:step" />
          <Route path="/dashboard" />
          <Route path="/modules" />
          <Route path="/forecast" />
          <Route path="/chat" />
          <Route path="/module/:moduleKey" />
          <Route path="/app/home" />
          <Route path="/app/modules" />
          <Route path="/app/forecast" />
          <Route path="/app/chat" />
          <Route path="/app/module/:moduleKey" />
          <Route path="/app/assessment/:step" />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {SHOW_DEV_TOOLS && DevToolsPanel && (
        <Suspense fallback={null}>
          <DevToolsPanel onPresetLoaded={handleDevPresetLoaded} />
        </Suspense>
      )}
    </>
  );
}

function Root() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </MotionConfig>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />)
