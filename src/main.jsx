import { useState, useEffect, lazy, Suspense } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from "react-router-dom"
import posthog from "posthog-js"
import { MotionConfig } from "framer-motion"
import { NavBar } from "./NavBar.jsx"
import { G, GOLD, CREAM, MUT, SERIF, SANS } from "./design-tokens.js"
import ErrorBoundary from "./ErrorBoundary.jsx"
import FeedbackAdmin from "./admin/FeedbackAdmin.jsx"
import CookieNotice from "./CookieNotice.jsx"
import { getConsent, analyticsPersistence } from "./lib/consent.js"
import { setSupabaseFailureReporter, updateRow } from "./lib/supabase.js"
import { setStorageFailureReporter, reportStorageFailure } from "./lib/storage.js"
import { appEntryPath } from "./site/StartCheckButton.jsx"
const RatesAdmin = lazy(() => import("./admin/RatesAdmin.jsx"))
// The app (/app/*) is its own chunk, so the marketing site doesn't download
// it; it loads the first time an /app page opens.
const CandidApp = lazy(() => import("./CandidApp.jsx"))

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
  } catch (e) { reportStorageFailure("read_acquisition", e) }
  const p = new URLSearchParams(window.location.search)
  // A ?ref=<id> referral link is treated as equivalent to a
  // utm_source=referral&utm_medium=referral link, with the referring user's
  // own id (their posthog distinct_id, reused rather than minting a new one)
  // carried alongside as referred_by.
  const ref = p.get('ref')
  const record = {
    source: ref ? 'referral' : (p.get('utm_source') || 'direct'),
    medium: ref ? 'referral' : (p.get('utm_medium') || null),
    campaign: p.get('utm_campaign') || null,
    referred_by: ref || null,
    first_visit_at: new Date().toISOString(),
  }
  try { localStorage.setItem('candid_acquisition', JSON.stringify(record)) } catch (e) { reportStorageFailure("save_acquisition", e) }
  return { ...record, fresh: true }
}
const acquisition = getAcquisition()

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
    // No cookies or storage without consent (src/lib/consent.js).
    persistence: analyticsPersistence(getConsent()),
    opt_out_capturing_by_default: getConsent() === "denied",
  })
}
// Every failed Supabase read or write in the browser (src/lib/supabase.js).
setSupabaseFailureReporter(failure => posthog.capture("supabase_operation_failed", failure))
// Every failed localStorage read or write (src/lib/storage.js). These only
// fire on a genuine error (storage blocked or full, corrupt JSON), never on a
// key that just isn't there, so the console error isn't limited to dev.
setStorageFailureReporter((context, e) => {
  console.error(`[Candid] localStorage failed — ${context}:`, e?.message || e)
  posthog.capture("local_storage_failed", { context, error_message: e?.message || String(e) })
})
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
// "/" itself (see RootRoute below). Lazy, like the app itself, so each
// page downloads only its own code.
const LandingPage = lazy(() => import("./site/LandingPage.jsx"))
const TheProblemPage = lazy(() => import("./site/TheProblemPage.jsx"))
const HowItWorksPage = lazy(() => import("./site/HowItWorksPage.jsx"))
const SignInPage = lazy(() => import("./site/SignInPage.jsx"))
const WhatCandidIsPage = lazy(() => import("./site/WhatCandidIsPage.jsx"))
const NotFoundPage = lazy(() => import("./site/NotFoundPage.jsx"))
const AboutPage = lazy(() => import("./site/AboutPage.jsx"))

// The page's own HTML, for the routes rendered at build time so crawlers can
// read them (the homepage and /about, scripts/prerender.js). Read before
// React takes over the root, and shown until that page's code has loaded,
// so it doesn't blank out in between. Empty on every other route
// (app-shell.html), and only shown on the path it was rendered for.
const prerendered = { path: window.location.pathname, html: document.getElementById("root").innerHTML }
function Prerendered() {
  const { pathname } = useLocation()
  return prerendered.html && pathname === prerendered.path
    ? <div dangerouslySetInnerHTML={{ __html: prerendered.html }} />
    : null
}

// ── Welcome back screen ───────────────────────────────────────────────────────
function WelcomeBack({ name, insightsDate, onViewReport, onUpdateInputs, onStartFresh }) {
  const date = insightsDate
    ? new Date(insightsDate).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
    : null;
  return (
    <div style={{ minHeight:"100vh", background:CREAM, display:"flex", flexDirection:"column" }}>
      <NavBar light center="Welcome back"/>
      <div style={{
        flex:1,
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        padding:"40px 24px", textAlign:"center", fontFamily:SANS,
      }}>
        <div style={{
          fontFamily:SERIF, fontSize:"clamp(52px,10vw,72px)", fontWeight:700,
          color:G, lineHeight:1, marginBottom:"12px", letterSpacing:"-1px",
        }}>
          {name || "Welcome"}
        </div>
        <div style={{
          fontSize:"20px", color:MUT,
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
            <div style={{fontSize:"11px", color:MUT, marginTop:"-8px"}}>
              Last generated {date}
            </div>
          )}
          <button onClick={onUpdateInputs} style={{
            background:"transparent", color:G,
            border:"1.5px solid rgba(22,47,36,0.25)",
            borderRadius:"10px", padding:"16px 32px",
            fontSize:"17px", fontWeight:600, cursor:"pointer", fontFamily:SANS,
          }}>
            Something's changed
          </button>
          <button onClick={onStartFresh} style={{
            background:"none", border:"none",
            color:MUT, fontSize:"13px",
            cursor:"pointer", marginTop:"8px", fontFamily:SANS,
          }}>
            Start fresh
          </button>
        </div>
      </div>
    </div>
  );
}

// The old report flow (questions at /assessment, an AI-written report at
// /dashboard, the desktop modules) is switched off: each old address goes
// to the app's own page for it (advice-vs-guidance review, fix 5).
function LegacyRedirect({ to }) {
  const params = useParams();
  const { search } = useLocation();
  return <Navigate to={to(params) + search} replace />;
}

// ── Root route ("/") ── the live marketing site, for everyone, except a
// TrueLayer bounce. TrueLayer's bank-connect callback and hosted-payment-page
// redirect always land here (never inside the app — the API callback
// redirects to the site root, and the hosted payment page redirects straight
// to return_uri with no server hop), so this checks for those params first
// and forwards into the wizard's Cash & savings step (route 5 — it shares
// ALL_STEP_DEFS' step numbering, and already has its own TrueLayer connect
// UI) with the query string intact, instead of ever rendering the marketing
// page.
function RootRoute() {
  const search = new URLSearchParams(window.location.search);
  const isTrueLayerBounce = search.get('truelayer') || search.get('truelayer_payment');
  if (isTrueLayerBounce) {
    return <Navigate to={`/app/assessment/5${window.location.search}`} replace />;
  }
  return <Suspense fallback={<Prerendered />}><LandingPage /></Suspense>;
}

// ── Returning-visitor screen ── same content/behaviour as the old root
// route's "welcome back" branch.
function WelcomeBackRoute() {
  const navigate = useNavigate();

  // Fires once per mount — flips the `returned` flag on the report row this
  // browser generated last, via the same row id CandidApp mirrors to
  // localStorage alongside candid_insights.
  useEffect(() => {
    posthog.capture("user_returned");
    try {
      const rowId = localStorage.getItem('candid_report_row_id');
      if (rowId) updateRow("test", rowId, { returned: true });
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

function BetaRedirect() {
  return <Navigate to={appEntryPath()} replace />;
}

// Wraps CandidApp with the scroll-target id its own "jump to top on module
// open" logic looks for (document.getElementById("candid-app")).
function CandidAppLayout() {
  return (
    <div id="candid-app" style={{ minHeight: "100vh" }}>
      <Suspense fallback={null}><CandidApp /></Suspense>
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
    navigate("/app/home");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/the-problem" element={<Suspense fallback={null}><TheProblemPage /></Suspense>} />
        <Route path="/how-it-works" element={<Suspense fallback={null}><HowItWorksPage /></Suspense>} />
        <Route path="/signin" element={<Suspense fallback={null}><SignInPage /></Suspense>} />
        <Route path="/what-candid-is" element={<Suspense fallback={null}><WhatCandidIsPage /></Suspense>} />
        <Route path="/about" element={<Suspense fallback={<Prerendered />}><AboutPage /></Suspense>} />
        {/* The app used to sit behind a beta password here; old links now go
            straight in. */}
        <Route path="/beta" element={<BetaRedirect />} />
        {/* The confidence question is now part of the entry. */}
        <Route path="/welcome" element={<Navigate to="/app/start" replace />} />
        <Route path="/welcome-back" element={<WelcomeBackRoute />} />
        <Route path="/admin/feedback" element={<FeedbackAdmin />} />
        <Route path="/admin/rates" element={<Suspense fallback={null}><RatesAdmin /></Suspense>} />
        <Route path="/assessment/:step" element={<LegacyRedirect to={p => `/app/assessment/${p.step}`} />} />
        <Route path="/dashboard" element={<LegacyRedirect to={() => "/app/home"} />} />
        <Route path="/modules" element={<LegacyRedirect to={() => "/app/modules"} />} />
        <Route path="/forecast" element={<LegacyRedirect to={() => "/app/forecast"} />} />
        <Route path="/chat" element={<LegacyRedirect to={() => "/app/chat"} />} />
        <Route path="/module/:moduleKey" element={<LegacyRedirect to={p => `/app/module/${p.moduleKey}`} />} />
        {/* Pathless layout route: CandidAppLayout (and the CandidApp state it
            holds — d, insights, completedModules, refs, etc.) stays mounted
            across navigation between all of these paths, branching on the
            URL internally. */}
        <Route element={<CandidAppLayout key={devReloadKey} />}>
          <Route path="/app/home" />
          <Route path="/app/modules" />
          <Route path="/app/forecast" />
          <Route path="/app/inputs" />
          <Route path="/app/chat" />
          <Route path="/app/module/:moduleKey" />
          <Route path="/app/property" />
          <Route path="/app/property/mortgage" />
          <Route path="/app/property/rent-vs-buy" />
          <Route path="/app/assessment/:step" />
          <Route path="/app/start" />
        </Route>
        {/* The server answers unknown addresses with 404.html (vercel.json);
            this covers links followed inside the site. */}
        <Route path="*" element={<Suspense fallback={null}><NotFoundPage /></Suspense>} />
      </Routes>

      <CookieNotice />

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
