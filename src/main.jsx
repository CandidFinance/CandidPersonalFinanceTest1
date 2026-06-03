import { useState } from "react"
import ReactDOM from "react-dom/client"
import posthog from "posthog-js"
import CandidApp from "./CandidApp.jsx"

console.log("SUPABASE URL:", import.meta.env.VITE_SUPABASE_URL)
console.log("SUPABASE KEY:", import.meta.env.VITE_SUPABASE_ANON_KEY)

// ── Analytics — runs once at module load, production only ─────────────────────
if (import.meta.env.PROD && import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: "https://eu.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
  })
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

// ── Root ──────────────────────────────────────────────────────────────────────
function Root() {
  const [launched, setLaunched] = useState(false)

  function handleStart() {
    setLaunched(true)
    posthog.capture("app_started")
    setTimeout(() => {
      document.getElementById("candid-app")?.scrollIntoView({ behavior: "smooth" })
    }, 100)
  }

  return (
    <div>
      {!launched && <LandingPage onStart={handleStart} />}
      {launched && (
        <div id="candid-app" style={{ minHeight: "100vh" }}>
          <CandidApp />
        </div>
      )}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />)
