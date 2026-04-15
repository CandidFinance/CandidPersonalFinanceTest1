import { useState, useEffect } from "react"
import ReactDOM from "react-dom/client"
import { createPortal } from "react-dom"
import CandidApp from "./CandidApp.jsx"

const G    = "#162f24"
const GOLD = "#c4963a"
const CREAM= "#f6f0e6"
const WHITE= "#ffffff"
const MUT  = "#6b6b6b"
const SERIF= "'Playfair Display', serif"
const SANS = "'DM Sans', sans-serif"

// ── Stat chip ─────────────────────────────────────────────────────────────────
function Stat({ n, label }) {
  return (
    <div style={{
      border: `1px solid rgba(196,150,58,0.35)`,
      borderRadius: "12px", padding: "20px 28px", textAlign: "center", minWidth: "160px"
    }}>
      <div style={{ fontFamily: SERIF, fontSize: "36px", fontWeight: 700, color: GOLD, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "6px", lineHeight: 1.45 }}>{label}</div>
    </div>
  )
}

// ── Module pill ───────────────────────────────────────────────────────────────
function ModulePill({ icon, label }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "7px",
      background: "rgba(22,47,36,0.06)", border: "1px solid rgba(22,47,36,0.12)",
      borderRadius: "100px", padding: "7px 14px", fontSize: "13px", color: G, fontWeight: 500
    }}>
      <span>{icon}</span><span>{label}</span>
    </div>
  )
}

// ── Landing page (kept intact) ────────────────────────────────────────────────
function LandingPage({ onStart }) {
  return (
    <div style={{ fontFamily: SANS }}>
      <nav style={{
        background: G, padding: "0 32px", height: "58px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100
      }}>
        <div style={{ fontFamily: SERIF, fontSize: "22px", fontWeight: 700, color: GOLD }}>Candid.</div>
        <button onClick={onStart} style={{
          background: GOLD, border: "none", borderRadius: "7px",
          padding: "9px 20px", fontSize: "13px", fontWeight: 600,
          color: G, cursor: "pointer", fontFamily: SANS
        }}>Get my report →</button>
      </nav>

      <div style={{
        background: G, padding: "80px 24px 96px",
        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center"
      }}>
        <div style={{ maxWidth: "720px" }}>
          <h1 style={{
            fontFamily: SERIF, fontSize: "clamp(38px, 7vw, 68px)",
            color: WHITE, fontWeight: 700, lineHeight: 1.08, marginBottom: "24px"
          }}>
            The financial friend everyone deserves.
          </h1>

          <button onClick={onStart} style={{
            background: GOLD, border: "none", borderRadius: "10px",
            padding: "18px 40px", fontSize: "17px", fontWeight: 600,
            color: G, cursor: "pointer", fontFamily: SANS
          }}>Get my free Candid report →</button>
        </div>
      </div>
    </div>
  )
}

// ── Feedback modal (styled + tracked) ─────────────────────────────────────────
function FeedbackModal({ onDismiss }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    window.analytics?.track?.("Feedback Modal Shown")
    console.log("Feedback Modal Shown")
  }, [])

  if (!mounted) return null

  function handleClick() {
    window.analytics?.track?.("Feedback Clicked")
    console.log("Feedback Clicked")
  }

  return createPortal(
    <div onClick={onDismiss} style={{
      position: "fixed", inset: 0,
      zIndex: 9999, background: "rgba(22,47,36,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: WHITE, borderRadius: "18px",
        maxWidth: "460px", width: "100%",
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        overflow: "hidden"
      }}>
        <div style={{ background: GOLD, padding: "16px 24px" }}>
          <div style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 700, color: G }}>
            How was your Candid report?
          </div>
          <div style={{ fontSize: "12px", color: "rgba(22,47,36,0.7)", marginTop: "4px" }}>
            60 seconds — helps us build this right
          </div>
        </div>

        <div style={{ padding: "24px" }}>
          <p style={{ fontSize: "14px", color: MUT, lineHeight: 1.6, marginBottom: "20px" }}>
            Five quick questions — completely anonymous unless you choose to leave your email.
          </p>

          <a
            href="https://tally.so/r/aQrNKE"
            target="_blank"
            rel="noreferrer"
            onClick={handleClick}
            style={{
              display: "block",
              width: "100%",
              background: G,
              borderRadius: "10px",
              padding: "14px",
              textAlign: "center",
              fontSize: "15px",
              fontWeight: 600,
              color: WHITE,
              textDecoration: "none",
              fontFamily: SANS,
              marginBottom: "12px"
            }}
          >
            Help us improve (1 min) →
          </a>

          <button
            onClick={onDismiss}
            style={{
              width: "100%",
              background: "transparent",
              border: `1.5px solid rgba(22,47,36,0.15)`,
              borderRadius: "10px",
              padding: "12px",
              fontSize: "13px",
              color: MUT,
              fontFamily: SANS,
              cursor: "pointer"
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Feedback button (client-safe) ─────────────────────────────────────────────
function FeedbackButton({ onClick }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <button onClick={onClick} style={{
      position: "fixed", bottom: "100px", right: "0",
      background: G, border: "2px solid " + GOLD,
      borderRadius: "10px 0 0 10px", borderRight: "none",
      padding: "14px 12px",
      cursor: "pointer", zIndex: 5000,
      color: GOLD, fontFamily: SANS
    }}>
      Feedback
    </button>,
    document.body
  )
}

function Root() {
  const [launched, setLaunched] = useState(false)
  const [showModal, setShowModal] = useState(false)

  function handleStart() {
    setLaunched(true)
    setTimeout(() => {
      document.getElementById("candid-app")?.scrollIntoView({ behavior: "smooth" })
    }, 100)
  }

  function openModal() {
    // Only show once per user
    if (localStorage.getItem("candid_feedback_shown")) return
    localStorage.setItem("candid_feedback_shown", "true")
    setShowModal(true)
  }

  function handleCompletion() {
    // Delay 3s after completion
    setTimeout(() => {
      openModal()
    }, 3000)
  }

  // Timer fallback
  useEffect(() => {
    if (!launched) return

    const timer = setTimeout(() => {
      openModal()
    }, 90000)

    return () => clearTimeout(timer)
  }, [launched])

  return (
    <div>
      <LandingPage onStart={handleStart} />
      {launched && (
        <div id="candid-app" style={{ minHeight: "100vh" }}>
          <CandidApp onComplete={handleCompletion} />
        </div>
      )}
      {launched && <FeedbackButton onClick={openModal} />}
      {showModal && <FeedbackModal onDismiss={() => setShowModal(false)} />}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />)
