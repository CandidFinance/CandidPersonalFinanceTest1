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

      <div style={{ background: G, padding: "80px 24px 96px", textAlign: "center" }}>
        <h1 style={{ fontFamily: SERIF, fontSize: "48px", color: WHITE }}>
          The financial friend everyone deserves.
        </h1>
        <button onClick={onStart} style={{
          background: GOLD, border: "none", borderRadius: "10px",
          padding: "18px 40px", fontSize: "17px", fontWeight: 600,
          color: G, cursor: "pointer", marginTop: "24px"
        }}>Get my free Candid report →</button>
      </div>
    </div>
  )
}

function FeedbackModal({ onDismiss }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

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
      }}>
        <div style={{ background: GOLD, padding: "14px 24px" }}>
          <div style={{ fontFamily: SERIF, fontSize: "16px", fontWeight: 700, color: G }}>
            How was your Candid report?
          </div>
        </div>
        <div style={{ padding: "24px" }}>
          <a href="https://tally.so/r/aQrNKE" target="_blank" rel="noreferrer">
            Share feedback →
          </a>
          <button onClick={onDismiss}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function FeedbackButton({ onClick }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <button onClick={onClick} style={{
      position: "fixed", bottom: "100px", right: "0",
      background: G, color: GOLD, padding: "10px",
      zIndex: 5000
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

  useEffect(() => {
    if (!launched) return

    const timer = setTimeout(() => {
      setShowModal(true)
    }, 90000)

    return () => clearTimeout(timer)
  }, [launched])

  return (
    <div>
      <LandingPage onStart={handleStart} />
      {launched && (
        <div id="candid-app" style={{ minHeight: "100vh" }}>
          <CandidApp />
        </div>
      )}
      {launched && <FeedbackButton onClick={() => setShowModal(true)} />}
      {showModal && <FeedbackModal onDismiss={() => setShowModal(false)} />}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />)
