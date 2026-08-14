import { useState, useEffect, lazy, Suspense } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom"
import posthog from "posthog-js"
import CandidApp from "./CandidApp.jsx"

console.log("SUPABASE URL:", import.meta.env.VITE_SUPABASE_URL)

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
    if (existing) return JSON.parse(existing)
  } catch (e) {}
  const p = new URLSearchParams(window.location.search)
  const record = {
    source: p.get('utm_source') || 'direct',
    medium: p.get('utm_medium') || null,
    campaign: p.get('utm_campaign') || null,
    first_visit_at: new Date().toISOString(),
  }
  try { localStorage.setItem('candid_acquisition', JSON.stringify(record)) } catch (e) {}
  return record
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
  })
}
posthog.register({
  acquisition_source: acquisition.source,
  acquisition_medium: acquisition.medium,
  acquisition_campaign: acquisition.campaign,
})

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

const G    = "#162f24"
const GOLD = "#c4963a"
const CREAM= "#f6f0e6"
const WHITE= "#ffffff"
const MUT  = "#6b6b6b"
const SERIF= "'Playfair Display', serif"
const SANS = "'DM Sans', sans-serif"

// ── Shared CTA button ─────────────────────────────────────────────────────────
function CtaButton({ onClick, dark }) {
  return (
    <button onClick={onClick} style={{
      background: GOLD, border: "none", borderRadius: "10px",
      padding: "18px 44px", fontSize: "17px", fontWeight: 700,
      color: G, cursor: "pointer", fontFamily: SANS,
      display: "inline-block",
    }}>Get my free Candid report →</button>
  )
}

function TrustLine({ light }) {
  return (
    <div style={{
      fontSize: "12px", marginTop: "12px",
      color: light ? "rgba(255,255,255,0.35)" : MUT,
      letterSpacing: "0.03em",
    }}>
      Free · No account needed · Takes 5 minutes
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: "10px", fontWeight: 700, color: GOLD,
      letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "20px",
    }}>{children}</div>
  )
}

// ── Landing page ──────────────────────────────────────────────────────────────
function LandingPage({ onStart }) {
  return (
    <div style={{ fontFamily: SANS }}>

      {/* ── SECTION 1: HERO ── */}
      <div style={{
        background: G,
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "60px 24px",
        position: "relative", overflow: "hidden",
      }}>
        {/* subtle grid texture */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.35, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)",
          backgroundSize: "64px 64px",
        }}/>

        <div style={{ position: "relative", zIndex: 1, maxWidth: "640px" }}>
          {/* Wordmark */}
          <div style={{
            fontFamily: SERIF, fontSize: "clamp(52px,8vw,72px)", fontWeight: 700,
            color: GOLD, lineHeight: 1, marginBottom: "18px", letterSpacing: "-0.01em",
          }}>
            Candid.
          </div>

          {/* Tagline */}
          <div style={{
            fontSize: "18px", color: `${CREAM}99`, fontStyle: "italic",
            marginBottom: "52px", letterSpacing: "0.01em",
          }}>
            Personal finance, honestly.
          </div>

          <CtaButton onClick={onStart}/>
          <TrustLine light/>
        </div>
      </div>

      {/* ── SECTION 2: PROBLEM STATEMENT ── */}
      <div style={{ background: CREAM, padding: "88px 24px" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{
            fontFamily: SERIF, fontSize: "clamp(26px,4vw,32px)",
            color: G, fontWeight: 700, lineHeight: 1.2, marginBottom: "22px",
          }}>
            Good income. Good career.<br />Still losing thousands.
          </h2>
          <p style={{
            fontSize: "clamp(15px,2vw,18px)", color: MUT,
            lineHeight: 1.75, marginBottom: "52px", maxWidth: "600px", margin: "0 auto 52px",
          }}>
            Most professionals on £50k–£150k are unknowingly leaving significant money behind every year — through pension underoptimisation, yield gaps, tax inefficiencies, and missed allowances. Candid finds exactly what it's costing you and tells you what to do about it.
          </p>

          {/* Stat chips */}
          <div style={{
            display: "flex", gap: "16px", justifyContent: "center",
            flexWrap: "wrap",
          }}>
            {[
              { n: "£4,200", label: "avg annual pension tax relief unclaimed" },
              { n: "£680",   label: "left on the table in savings yield gaps" },
              { n: "6.5m",   label: "higher-rate taxpayers in the UK" },
            ].map(chip => (
              <div key={chip.n} style={{
                background: G, borderRadius: "12px", padding: "20px 24px",
                textAlign: "center", minWidth: "160px", flex: "1 1 160px", maxWidth: "220px",
              }}>
                <div style={{
                  fontFamily: SERIF, fontSize: "28px", fontWeight: 700,
                  color: GOLD, lineHeight: 1, marginBottom: "8px",
                }}>{chip.n}</div>
                <div style={{
                  fontSize: "13px", color: `${CREAM}99`, lineHeight: 1.4,
                }}>{chip.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 3: HOW IT WORKS ── */}
      <div style={{ background: WHITE, padding: "88px 24px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <SectionLabel>How it works</SectionLabel>
            <h2 style={{
              fontFamily: SERIF, fontSize: "clamp(26px,4vw,34px)",
              color: G, fontWeight: 700, lineHeight: 1.2,
            }}>
              Your complete financial picture,<br />in 5 minutes.
            </h2>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "28px",
          }}>
            {[
              {
                icon: "📋", title: "Tell us about your finances",
                body: "Salary, savings, pension, debts. Takes about 5 minutes. Approximate figures are fine — you can refine later.",
              },
              {
                icon: "🎯", title: "Get your Candid score",
                body: "A personalised 0–100 financial health score showing where you stand and what matters most.",
              },
              {
                icon: "🔍", title: "Explore your modules",
                body: "Deep-dive into each area of your finances with specific actions and their £ impact, calculated from your actual inputs.",
              },
            ].map(step => (
              <div key={step.title} style={{
                background: CREAM, borderRadius: "14px", padding: "32px 28px",
                borderTop: `4px solid ${GOLD}`,
              }}>
                <div style={{ fontSize: "28px", marginBottom: "16px" }}>{step.icon}</div>
                <div style={{
                  fontFamily: SERIF, fontSize: "18px", color: G,
                  fontWeight: 600, marginBottom: "10px",
                }}>{step.title}</div>
                <div style={{ fontSize: "14px", color: MUT, lineHeight: 1.7 }}>{step.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 4: AREAS COVERED ── */}
      <div style={{ background: G, padding: "88px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <SectionLabel>What Candid covers</SectionLabel>
          <h2 style={{
            fontFamily: SERIF, fontSize: "clamp(24px,3.5vw,32px)",
            color: WHITE, fontWeight: 700, marginBottom: "36px", lineHeight: 1.25,
          }}>
            Every area of your finances, connected.
          </h2>

          {/* Area chips */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: "12px",
            justifyContent: "center", marginBottom: "16px",
          }}>
            {[
              "Pension & salary sacrifice",
              "ISA & investments",
              "Student loan strategy",
              "Mortgage & debt",
            ].map(area => (
              <div key={area} style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "100px", padding: "10px 20px",
                fontSize: "14px", color: WHITE, fontWeight: 500,
              }}>{area}</div>
            ))}
          </div>

          <div style={{
            fontSize: "13px", color: "rgba(255,255,255,0.4)",
            marginBottom: "44px", letterSpacing: "0.01em",
          }}>
            + more areas depending on your situation
          </div>

          {/* Guidance disclaimer — visually distinct */}
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: "32px",
            fontSize: "16px", color: `${CREAM}cc`,
            fontStyle: "italic", lineHeight: 1.7, maxWidth: "540px", margin: "0 auto",
          }}>
            Guidance, not advice. Candid helps you understand your options — the decisions are always yours.
          </div>
        </div>
      </div>

      {/* ── SECTION 5: FINAL CTA ── */}
      <div style={{
        background: CREAM, padding: "96px 24px",
        display: "flex", flexDirection: "column",
        alignItems: "center", textAlign: "center",
      }}>
        <h2 style={{
          fontFamily: SERIF, fontSize: "clamp(22px,3.5vw,28px)",
          color: G, fontWeight: 700, marginBottom: "32px", lineHeight: 1.3,
        }}>
          Ready to see what Candid finds?
        </h2>
        <CtaButton onClick={onStart}/>
        <TrustLine/>
      </div>

      {/* ── FOOTER ── */}
      <div style={{
        background: G, padding: "28px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "12px",
      }}>
        <div style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 700, color: GOLD }}>Candid.</div>
        <div style={{
          fontSize: "11px", color: "rgba(255,255,255,0.3)",
          lineHeight: 1.6, maxWidth: "560px",
        }}>
          Candid provides financial guidance and education only — not regulated financial advice. Always consider your personal circumstances and consult a qualified adviser for complex situations. Candid may earn referral fees when you click through to product providers.
        </div>
        <div style={{
          fontSize: "11px", color: "rgba(255,255,255,0.25)",
          display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap",
        }}>
          <span>© 2026 Candid Finance</span>
          <a href="/privacy.html" target="_blank" rel="noreferrer" style={{ color:"rgba(255,255,255,0.35)", textDecoration:"none" }}>Privacy Policy</a>
          <a href="/terms.html"   target="_blank" rel="noreferrer" style={{ color:"rgba(255,255,255,0.35)", textDecoration:"none" }}>Terms of Service</a>
        </div>
      </div>

    </div>
  )
}

// ── Welcome back screen ───────────────────────────────────────────────────────
function WelcomeBack({ name, insightsDate, onViewReport, onUpdateInputs, onStartFresh }) {
  const date = insightsDate
    ? new Date(insightsDate).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
    : null;
  return (
    <div style={{
      minHeight:"100vh", background:G,
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
  );
}

// ── Home route (landing page, or "welcome back" for a returning user) ─────────
function Home() {
  const navigate = useNavigate();

  // A TrueLayer bank-connect redirect always lands here with ?truelayer=... (the
  // API callback redirects to the site root, not into the app). Forward straight
  // into the assessment's Cash & savings step (route 5) with the query string
  // intact, so CandidApp's own mount effect — unchanged — can still read and
  // process it there instead of it being stranded on a route that never mounts it.
  const trueLayerParam = new URLSearchParams(window.location.search).get('truelayer');

  const [view, setView] = useState(() => {
    try {
      const hasSavedInputs = !!localStorage.getItem('candid_inputs');
      const hasSavedInsights = !!localStorage.getItem('candid_insights');
      if (hasSavedInputs && hasSavedInsights) return 'welcome_back';
    } catch(e) {}
    return 'landing';
  });

  // Fires once per mount, only if this mount landed straight into welcome_back
  // (i.e. this is a later visit, not a fresh one) — flips the `returned` flag
  // on the report row this browser generated last, via the same row id
  // CandidApp mirrors to localStorage alongside candid_insights.
  useEffect(() => {
    if (trueLayerParam || view !== "welcome_back") return;
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
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately mount-once, not re-fired on later `view` changes within this mount
  }, []);

  // Fires once per mount, only for a genuine fresh landing (not welcome-back,
  // not a TrueLayer bounce-through).
  useEffect(() => {
    if (trueLayerParam || view !== "landing") return;
    posthog.capture("landing_page_viewed");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately mount-once
  }, []);

  function handleStart() {
    posthog.capture("assessment_started")
    try {
      if (!localStorage.getItem('candid_assessment_started_at')) {
        localStorage.setItem('candid_assessment_started_at', new Date().toISOString());
      }
    } catch (e) {}
    navigate("/assessment/1")
    window.scrollTo({ top: 0, behavior: "instant" })
  }

  if (trueLayerParam) {
    return <Navigate to={`/assessment/5${window.location.search}`} replace />;
  }

  if (view === "welcome_back") {
    return (
      <WelcomeBack
        name={(() => { try { const s = localStorage.getItem('candid_inputs'); return s ? JSON.parse(s).name || "" : ""; } catch(e) { return ""; } })()}
        insightsDate={(() => { try { return localStorage.getItem('candid_insights_date'); } catch(e) { return null; } })()}
        onViewReport={() => { navigate("/dashboard"); window.scrollTo({ top:0, behavior:"instant" }); }}
        onUpdateInputs={() => {
          try { localStorage.removeItem('candid_insights'); localStorage.removeItem('candid_insights_date'); } catch(e) {}
          navigate("/assessment/1");
          window.scrollTo({ top:0, behavior:"instant" });
        }}
        onStartFresh={() => {
          try {
            localStorage.removeItem('candid_inputs');
            localStorage.removeItem('candid_insights');
            localStorage.removeItem('candid_insights_date');
          } catch(e) {}
          setView("landing");
          posthog.capture("landing_page_viewed");
          window.scrollTo({ top:0, behavior:"instant" });
        }}
      />
    );
  }

  return <LandingPage onStart={handleStart} />;
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
        <Route path="/" element={<Home />} />
        {/* Pathless layout route: CandidAppLayout (and the CandidApp state it
            holds — d, insights, completedModules, one-shot modal refs, etc.)
            stays mounted across navigation between all three of these paths,
            branching on the URL internally the same way it used to branch on
            local `screen` state. */}
        <Route element={<CandidAppLayout key={devReloadKey} />}>
          <Route path="/assessment/:step" />
          <Route path="/dashboard" />
          <Route path="/module/:moduleKey" />
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
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />)
