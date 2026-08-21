import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom"
import posthog from "posthog-js"
import { motion, MotionConfig, useReducedMotion, useInView, animate } from "framer-motion"
import CandidApp, { PageWrap, NavBar, ContentWrap } from "./CandidApp.jsx"
import { ClipboardList, Target, Search, GraduationCap, PoundSterling, Home as HomeIcon } from "lucide-react"

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

const G    = "#162f24"
const GOLD = "#c4963a"
const CREAM= "#f6f0e6"
const WHITE= "#ffffff"
const MUT  = "#6b6b6b"
const SERIF= "'Playfair Display', serif"
const SANS = "'DM Sans', sans-serif"

// ── Landing page motion primitives ─────────────────────────────────────────────
// A steep-deceleration curve (fast start, long soft settle) reads as more
// considered than the default ease-in-out — used for every entrance/hover
// animation on the landing page. prefers-reduced-motion is handled globally
// via <MotionConfig reducedMotion="user"> in Root(), which auto-disables all
// variant/whileHover/whileInView animation; the one exception is the imperative
// count-up in CountUpStat, which checks useReducedMotion() itself below.
const EASE = [0.16, 1, 0.3, 1];

const heroStagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const heroItem = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};

// Entrance for a tile at position `i` in a staggered row/grid. MotionConfig's
// reducedMotion="user" (set on <Root>) only strips transform-based motion
// (x/y/scale/rotate) — it leaves opacity fades running — so an explicit
// reduceMotion flag is threaded through here to skip the fade too and render
// the tile straight into its final state, per "instant states, no animation".
function tileEntrance(i, reduceMotion, delayStep = 0.07) {
  if (reduceMotion) return { initial: false };
  return {
    initial: { opacity: 0, y: 14 },
    whileInView: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE, delay: i * delayStep } },
    viewport: { once: true, margin: "-60px" },
  };
}

// Subtle lift + soft shadow on hover, for interactive cards/tiles.
const tileHover = {
  whileHover: { y: -4, boxShadow: "0 16px 36px rgba(22,47,36,0.14)", transition: { duration: 0.2, ease: EASE } },
};

// Parses a display string like "£4,200" or "6.5m" into its numeric target
// plus the surrounding prefix/suffix, so CountUpStat can animate the number
// while preserving currency symbols, unit suffixes, decimals and thousands commas.
function parseStatValue(str) {
  const match = String(str).match(/^([^\d]*)([\d,.]+)([^\d]*)$/);
  if (!match) return { prefix: "", target: 0, suffix: String(str), decimals: 0, hasComma: false };
  const [, prefix, numStr, suffix] = match;
  const hasComma = numStr.includes(",");
  const cleanNum = numStr.replace(/,/g, "");
  const decimals = cleanNum.includes(".") ? cleanNum.split(".")[1].length : 0;
  return { prefix, target: parseFloat(cleanNum), suffix, decimals, hasComma };
}

function formatStatNumber(value, { decimals, hasComma }) {
  const fixed = value.toFixed(decimals);
  if (!hasComma) return fixed;
  const [intPart, decPart] = fixed.split(".");
  const withCommas = Number(intPart).toLocaleString("en-GB");
  return decPart ? `${withCommas}.${decPart}` : withCommas;
}

// Counts up from 0 to the target value once the stat scrolls into view.
// Instant (no animation) when the user has prefers-reduced-motion enabled.
function CountUpStat({ value }) {
  const parsed = useMemo(() => parseStatValue(value), [value]);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? parsed.target : 0);

  useEffect(() => {
    if (!isInView) return;
    if (reduceMotion) { setDisplay(parsed.target); return; }
    const controls = animate(0, parsed.target, {
      duration: 0.9,
      ease: EASE,
      onUpdate: setDisplay,
    });
    return () => controls.stop();
  }, [isInView, parsed.target, reduceMotion]);

  return <span ref={ref}>{parsed.prefix}{formatStatNumber(display, parsed)}{parsed.suffix}</span>;
}

// ── Shared CTA button ─────────────────────────────────────────────────────────
function CtaButton({ onClick, dark }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03, boxShadow: "0 10px 24px rgba(196,150,58,0.35)", transition: { duration: 0.2, ease: EASE } }}
      style={{
        background: GOLD, border: "none", borderRadius: "10px",
        padding: "18px 44px", fontSize: "17px", fontWeight: 700,
        color: G, cursor: "pointer", fontFamily: SANS,
        display: "inline-block", boxShadow: "0 0px 0px rgba(196,150,58,0)",
      }}>Get my free Candid report →</motion.button>
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
  const reduceMotion = useReducedMotion();
  return (
    <div style={{ fontFamily: SANS }}>
      <NavBar center="Home"/>

      {/* ── SECTION 1: HERO ── */}
      <div style={{
        background: G,
        minHeight: "calc(100vh - 76px)",
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

        <motion.div
          variants={heroStagger} initial={reduceMotion ? "visible" : "hidden"} animate="visible"
          style={{ position: "relative", zIndex: 1, maxWidth: "640px" }}
        >
          {/* Wordmark */}
          <motion.div variants={heroItem} style={{
            fontFamily: SERIF, fontSize: "clamp(52px,8vw,72px)", fontWeight: 700,
            color: GOLD, lineHeight: 1, marginBottom: "18px", letterSpacing: "-0.01em",
          }}>
            Candid.
          </motion.div>

          {/* Tagline */}
          <motion.div variants={heroItem} style={{
            fontSize: "18px", color: `${CREAM}99`, fontStyle: "italic",
            marginBottom: "52px", letterSpacing: "0.01em",
          }}>
            Personal finance, honestly.
          </motion.div>

          <motion.div variants={heroItem}>
            <CtaButton onClick={onStart}/>
            <TrustLine light/>
          </motion.div>
        </motion.div>
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
            ].map((chip, i) => (
              <motion.div key={chip.n} {...tileEntrance(i, reduceMotion)} style={{
                background: G, borderRadius: "12px", padding: "20px 24px",
                textAlign: "center", minWidth: "160px", flex: "1 1 160px", maxWidth: "220px",
              }}>
                <div style={{
                  fontFamily: SERIF, fontSize: "28px", fontWeight: 700,
                  color: GOLD, lineHeight: 1, marginBottom: "8px",
                }}><CountUpStat value={chip.n}/></div>
                <div style={{
                  fontSize: "13px", color: `${CREAM}99`, lineHeight: 1.4,
                }}>{chip.label}</div>
              </motion.div>
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
                icon: ClipboardList, title: "Tell us about your finances",
                body: "Salary, savings, pension, debts. Takes about 5 minutes. Approximate figures are fine — you can refine later.",
              },
              {
                icon: Target, title: "Get your Candid score",
                body: "A personalised 0–100 financial health score showing where you stand and what matters most.",
              },
              {
                icon: Search, title: "Explore your modules",
                body: "Deep-dive into each area of your finances with specific actions and their £ impact, calculated from your actual inputs.",
              },
            ].map((step, i) => (
              <motion.div key={step.title} {...tileEntrance(i, reduceMotion)} {...tileHover} style={{
                background: CREAM, borderRadius: "14px", padding: "32px 28px",
                borderTop: `4px solid ${GOLD}`, boxShadow: "0 0px 0px rgba(22,47,36,0)",
              }}>
                <div style={{ marginBottom: "16px" }}><step.icon size={28} color={G}/></div>
                <div style={{
                  fontFamily: SERIF, fontSize: "18px", color: G,
                  fontWeight: 600, marginBottom: "10px",
                }}>{step.title}</div>
                <div style={{ fontSize: "14px", color: MUT, lineHeight: 1.7 }}>{step.body}</div>
              </motion.div>
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
            ].map((area, i) => (
              <motion.div key={area} {...tileEntrance(i, reduceMotion, 0.06)} style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "100px", padding: "10px 20px",
                fontSize: "14px", color: WHITE, fontWeight: 500,
              }}>{area}</motion.div>
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

      {/* ── SECTION 4.5: FREE CALCULATORS ── standalone tools that don't need
          the full assessment, each also a dedicated landing page in its own
          right (student-loan-calculator.html etc.) — linked here so both
          users and search crawlers have a path in from the homepage. */}
      <div style={{ background: WHITE, padding: "88px 24px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <SectionLabel>Free calculators</SectionLabel>
            <h2 style={{
              fontFamily: SERIF, fontSize: "clamp(26px,4vw,34px)",
              color: G, fontWeight: 700, lineHeight: 1.2,
            }}>
              Answer one question in 30 seconds.
            </h2>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "28px",
          }}>
            {[
              {
                href: "/student-loan-calculator.html", icon: GraduationCap,
                title: "Student loan overpayment calculator",
                body: "Plan 1, 2, 4, 5 & Postgraduate — find out if overpaying saves you money or just hands cash to the government that would've been written off.",
              },
              {
                href: "/100k-tax-trap-calculator.html", icon: PoundSterling,
                title: "£100,000 tax trap & childcare cliff calculator",
                body: "Check the 60% marginal-rate zone and the childcare cliff, and see the exact pension sacrifice that fixes both at once.",
              },
              {
                href: "/mortgage-vs-savings-calculator.html", icon: HomeIcon,
                title: "Mortgage overpayment vs high-yield savings",
                body: "When your fix ends, compare paying down the mortgage against a savings account or Cash ISA — tax accounted for.",
              },
            ].map((tool, i) => (
              <motion.a key={tool.href} href={tool.href} {...tileEntrance(i, reduceMotion)} {...tileHover} style={{
                background: CREAM, borderRadius: "14px", padding: "32px 28px",
                borderTop: `4px solid ${GOLD}`, textDecoration: "none", display: "block",
                boxShadow: "0 0px 0px rgba(22,47,36,0)",
              }}>
                <div style={{ marginBottom: "16px" }}><tool.icon size={28} color={G}/></div>
                <div style={{
                  fontFamily: SERIF, fontSize: "18px", color: G,
                  fontWeight: 600, marginBottom: "10px",
                }}>{tool.title}</div>
                <div style={{ fontSize: "14px", color: MUT, lineHeight: 1.7 }}>{tool.body}</div>
              </motion.a>
            ))}
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
          <a href="/student-loan-calculator.html" style={{ color:"rgba(255,255,255,0.35)", textDecoration:"none" }}>Student Loan Calculator</a>
          <a href="/100k-tax-trap-calculator.html" style={{ color:"rgba(255,255,255,0.35)", textDecoration:"none" }}>£100k Tax Trap Calculator</a>
          <a href="/mortgage-vs-savings-calculator.html" style={{ color:"rgba(255,255,255,0.35)", textDecoration:"none" }}>Mortgage vs Savings Calculator</a>
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
    navigate("/assessment/1");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <PageWrap>
      <NavBar center="Before you start" right={<button type="button" onClick={() => navigate("/")} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",borderRadius:"6px",padding:"6px 14px",color:"rgba(255,255,255,0.6)",fontSize:"12px",cursor:"pointer"}}>← Back</button>}/>
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

// ── Home route (landing page, or "welcome back" for a returning user) ─────────
function Home() {
  const navigate = useNavigate();

  // A TrueLayer bank-connect redirect always lands here with ?truelayer=... (the
  // API callback redirects to the site root, not into the app), and a TrueLayer
  // payment-staging redirect lands here with ?truelayer_payment=... (TrueLayer's
  // hosted payment page redirects straight to return_uri, no server hop). Both
  // forward into the assessment's Cash & savings step (route 5) with the query
  // string intact, so CandidApp's own mount effects can read and process them
  // there instead of being stranded on a route that never mounts them.
  const search = new URLSearchParams(window.location.search);
  const trueLayerParam = search.get('truelayer');
  const trueLayerPaymentParam = search.get('truelayer_payment');
  const isTrueLayerBounce = trueLayerParam || trueLayerPaymentParam;

  const [view, setView] = useState(() => {
    try {
      const hasSavedInputs = !!localStorage.getItem('candid_inputs');
      const hasSavedInsights = !!localStorage.getItem('candid_insights');
      if (hasSavedInputs && hasSavedInsights) return 'welcome_back';
    } catch(e) { reportStorageFailure("home_initial_view", e); }
    return 'landing';
  });

  // Fires once per mount, only if this mount landed straight into welcome_back
  // (i.e. this is a later visit, not a fresh one) — flips the `returned` flag
  // on the report row this browser generated last, via the same row id
  // CandidApp mirrors to localStorage alongside candid_insights.
  useEffect(() => {
    if (isTrueLayerBounce || view !== "welcome_back") return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately mount-once, not re-fired on later `view` changes within this mount
  }, []);

  // Fires once per mount, only for a genuine fresh landing (not welcome-back,
  // not a TrueLayer bounce-through).
  useEffect(() => {
    if (isTrueLayerBounce || view !== "landing") return;
    posthog.capture("landing_page_viewed");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately mount-once
  }, []);

  function handleStart() {
    posthog.capture("assessment_started")
    try {
      if (!localStorage.getItem('candid_assessment_started_at')) {
        localStorage.setItem('candid_assessment_started_at', new Date().toISOString());
      }
    } catch (e) { reportStorageFailure("assessment_started_at", e); }
    navigate("/welcome")
    window.scrollTo({ top: 0, behavior: "instant" })
  }

  if (isTrueLayerBounce) {
    return <Navigate to={`/assessment/5${window.location.search}`} replace />;
  }

  if (view === "welcome_back") {
    return (
      <WelcomeBack
        name={(() => { try { const s = localStorage.getItem('candid_inputs'); return s ? JSON.parse(s).name || "" : ""; } catch(e) { reportStorageFailure("welcome_back_name", e); return ""; } })()}
        insightsDate={(() => { try { return localStorage.getItem('candid_insights_date'); } catch(e) { reportStorageFailure("welcome_back_insights_date", e); return null; } })()}
        onViewReport={() => { navigate("/dashboard"); window.scrollTo({ top:0, behavior:"instant" }); }}
        onUpdateInputs={() => {
          try { localStorage.removeItem('candid_insights'); localStorage.removeItem('candid_insights_date'); } catch(e) { reportStorageFailure("update_inputs_clear", e); }
          navigate("/assessment/1");
          window.scrollTo({ top:0, behavior:"instant" });
        }}
        onStartFresh={() => {
          try {
            localStorage.removeItem('candid_inputs');
            localStorage.removeItem('candid_insights');
            localStorage.removeItem('candid_insights_date');
          } catch(e) { reportStorageFailure("start_fresh_clear", e); }
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
        <Route path="/welcome" element={<ConfidenceCheck />} />
        <Route path="/admin/feedback" element={<FeedbackAdmin />} />
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
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </MotionConfig>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />)
