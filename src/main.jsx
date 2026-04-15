import { useState } from "react"
import ReactDOM, { createPortal } from "react-dom/client"
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

// ── How it works step ─────────────────────────────────────────────────────────
function Step({ num, title, body }) {
  return (
    <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
      <div style={{
        width: "32px", height: "32px", borderRadius: "50%",
        background: "rgba(196,150,58,0.15)", border: "1px solid rgba(196,150,58,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: SERIF, fontSize: "15px", fontWeight: 700, color: GOLD, flexShrink: 0
      }}>{num}</div>
      <div>
        <div style={{ fontSize: "15px", fontWeight: 600, color: WHITE, marginBottom: "4px" }}>{title}</div>
        <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{body}</div>
      </div>
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

// ── Landing page ──────────────────────────────────────────────────────────────
function LandingPage({ onStart }) {
  return (
    <div style={{ fontFamily: SANS }}>

      {/* NAV */}
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

      {/* HERO */}
      <div style={{
        background: G, padding: "80px 24px 96px",
        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
        position: "relative", overflow: "hidden"
      }}>
        {/* Subtle grid bg */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.4,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)",
          backgroundSize: "60px 60px", pointerEvents: "none"
        }}/>

        <div style={{ position: "relative", zIndex: 1, maxWidth: "720px" }}>
          <div style={{
            display: "inline-block", fontSize: "11px", fontWeight: 600, color: GOLD,
            letterSpacing: "0.14em", textTransform: "uppercase",
            background: "rgba(196,150,58,0.1)", border: "1px solid rgba(196,150,58,0.25)",
            borderRadius: "100px", padding: "5px 16px", marginBottom: "28px"
          }}>Personal finance, honestly.</div>

          <h1 style={{
            fontFamily: SERIF, fontSize: "clamp(38px, 7vw, 68px)",
            color: WHITE, fontWeight: 700, lineHeight: 1.08, marginBottom: "24px"
          }}>
            The financial friend<br />everyone deserves.
          </h1>

          <p style={{
            fontSize: "clamp(15px, 2vw, 18px)", color: "rgba(255,255,255,0.6)",
            lineHeight: 1.75, maxWidth: "560px", margin: "0 auto 44px"
          }}>
            Most people with good incomes are quietly losing thousands every year — through missed tax relief, unused allowances, and wrong savings rates. Candid finds exactly what's costing you and tells you what to do about it.
          </p>

          <button onClick={onStart} style={{
            background: GOLD, border: "none", borderRadius: "10px",
            padding: "18px 40px", fontSize: "17px", fontWeight: 600,
            color: G, cursor: "pointer", fontFamily: SANS,
            marginBottom: "14px", display: "block", margin: "0 auto 14px"
          }}>Get my free Candid report →</button>

          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginBottom: "64px" }}>
            Free · Takes 5 minutes · No account required
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            <Stat n="£1.46bn" label={"in pension tax relief\nunclaimed annually"} />
            <Stat n="8.6%"    label={"of UK adults received\nfinancial advice last year"} />
            <Stat n="11.9M"   label={"adults projected to earn\n£30k+ in 2025/26"} />
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div style={{ background: CREAM, padding: "80px 24px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <div style={{
              fontSize: "10px", fontWeight: 700, color: GOLD, letterSpacing: "0.14em",
              textTransform: "uppercase", marginBottom: "14px"
            }}>How it works</div>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(28px,4vw,40px)", color: G, fontWeight: 700 }}>
              Your complete financial picture,<br />in 5 minutes.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "32px" }}>
            {[
              { num:"1", title:"Tell us about your finances", body:"Salary, savings, pension, ISA, investments, debt. Takes 3 minutes. Approximate figures are fine — you can refine later." },
              { num:"2", title:"Get your Candid score", body:"A 0–100 financial health score with a personalised narrative — and a prioritised list of exactly what's costing you, with specific £ figures attached." },
              { num:"3", title:"Explore your deep-dives", body:"Eight modules covering every area of your finances. Each one calculates your exact gap and shows you the products that fix it." },
            ].map(s => (
              <div key={s.num} style={{
                background: WHITE, borderRadius: "14px", padding: "28px 28px",
                border: "1px solid rgba(22,47,36,0.08)", borderTop: `3px solid ${GOLD}`
              }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "50%",
                  background: "rgba(196,150,58,0.12)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontFamily: SERIF, fontSize: "17px", fontWeight: 700,
                  color: GOLD, marginBottom: "16px"
                }}>{s.num}</div>
                <div style={{ fontFamily: SERIF, fontSize: "18px", color: G, fontWeight: 600, marginBottom: "8px" }}>{s.title}</div>
                <div style={{ fontSize: "13.5px", color: MUT, lineHeight: 1.7 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODULES */}
      <div style={{ background: WHITE, padding: "80px 24px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{
            fontSize: "10px", fontWeight: 700, color: GOLD, letterSpacing: "0.14em",
            textTransform: "uppercase", marginBottom: "14px"
          }}>Eight modules</div>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(26px,3.5vw,36px)", color: G, fontWeight: 700, marginBottom: "12px" }}>
            Every area of your finances, covered.
          </h2>
          <p style={{ fontSize: "15px", color: MUT, lineHeight: 1.7, marginBottom: "36px" }}>
            Most financial tools cover one thing. Candid calculates your complete picture — including the interactions between modules that most people miss.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", marginBottom: "44px" }}>
            {[
              ["💷","Cash & savings"],["📈","Investments & CGT"],["🏦","Pension"],
              ["🎓","Student loan"],["🏠","Mortgage"],["🛡️","Insurance"],
              ["👶","Kids & family"],["📜","Inheritance"],
            ].map(([icon, label]) => <ModulePill key={label} icon={icon} label={label} />)}
          </div>
          <div style={{
            background: CREAM, borderRadius: "12px", padding: "20px 24px",
            fontSize: "13px", color: MUT, lineHeight: 1.7,
            borderLeft: `4px solid ${GOLD}`
          }}>
            Candid provides financial <strong style={{color:G}}>guidance</strong>, not regulated advice. All calculations use your specific inputs — no estimates, no averages. We operate outside the FCA's regulated advice perimeter.
          </div>
        </div>
      </div>

      {/* SOCIAL PROOF / WHAT YOU GET */}
      <div style={{ background: G, padding: "80px 24px" }}>
        <div style={{ maxWidth: "840px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "52px" }}>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(26px,3.5vw,38px)", color: WHITE, fontWeight: 700 }}>
              What you'll find out.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: "16px" }}>
            {[
              { icon:"🎯", title:"Your exact tax position", body:"Whether you're approaching the £100k taper zone, how much bonus sacrifice would save, what rate of pension relief you're getting." },
              { icon:"📅", title:"ISA deadline countdown", body:"How much of your £20,000 annual allowance is still available, and exactly how many days before it expires permanently." },
              { icon:"🎓", title:"Student loan strategy", body:"Whether you'll repay before write-off, the 9% effective income surcharge, and whether overpaying makes mathematical sense for you." },
              { icon:"💰", title:"The yield gap", body:"How much interest you're losing by keeping cash in the wrong account — calculated against the best available rate today." },
              { icon:"📈", title:"CGT crystallisation window", body:"Whether you have gains you could realise tax-free this year, and how Bed & ISA works to move them into a protected wrapper." },
              { icon:"🏠", title:"Mortgage overpayment ROI", body:"The guaranteed after-tax return of overpaying vs. the ISA return — calculated at your actual rate and remaining balance." },
            ].map(item => (
              <div key={item.title} style={{
                background: "rgba(255,255,255,0.04)", borderRadius: "12px",
                padding: "20px 22px", border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", gap: "14px"
              }}>
                <span style={{ fontSize: "22px", flexShrink: 0, marginTop: "2px" }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: WHITE, marginBottom: "5px" }}>{item.title}</div>
                  <div style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{item.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FINAL CTA */}
      <div style={{
        background: CREAM, padding: "88px 24px",
        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center"
      }}>
        <div style={{
          fontSize: "10px", fontWeight: 700, color: GOLD, letterSpacing: "0.14em",
          textTransform: "uppercase", marginBottom: "16px"
        }}>Free — no account needed</div>
        <h2 style={{
          fontFamily: SERIF, fontSize: "clamp(30px,5vw,52px)",
          color: G, fontWeight: 700, lineHeight: 1.1, marginBottom: "20px"
        }}>Find your financial gaps.<br />Fix them today.</h2>
        <p style={{ fontSize: "15px", color: MUT, maxWidth: "440px", lineHeight: 1.7, marginBottom: "36px" }}>
          Takes under 5 minutes. No account, no email, no commitment. Just honest numbers about your money.
        </p>
        <button onClick={onStart} style={{
          background: G, border: "none", borderRadius: "10px",
          padding: "18px 44px", fontSize: "17px", fontWeight: 600,
          color: WHITE, cursor: "pointer", fontFamily: SANS, marginBottom: "10px"
        }}>Get my free Candid report →</button>
        <div style={{ fontSize: "12px", color: MUT }}>Your data stays on your device. We never sell or share it.</div>
      </div>

      {/* FOOTER */}
      <div style={{
        background: G, padding: "28px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "12px"
      }}>
        <div style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 700, color: GOLD }}>Candid.</div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", lineHeight: 1.6, maxWidth: "560px" }}>
          Candid provides financial guidance and education only — not regulated financial advice. Always consider your personal circumstances and consult a qualified adviser for complex situations. Candid may earn referral fees when you click through to product providers.
        </div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>© 2025 Candid Finance</div>
      </div>

    </div>
  )
}

// ── Feedback banner (shown after completing the app) ──────────────────────────
function FeedbackModal({ onDismiss }) {
  return createPortal(
    <div onClick={onDismiss} style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 9999, background: "rgba(22,47,36,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: WHITE, borderRadius: "18px",
        maxWidth: "460px", width: "100%", overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
      }}>
        <div style={{ background: GOLD, padding: "14px 24px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}>💬</span>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: "16px", fontWeight: 700, color: G }}>How was your Candid report?</div>
            <div style={{ fontSize: "11px", color: "rgba(22,47,36,0.65)", marginTop: "1px" }}>60 seconds — helps us build this right</div>
          </div>
          <button onClick={onDismiss} style={{
            marginLeft: "auto", background: "transparent", border: "none",
            fontSize: "20px", color: "rgba(22,47,36,0.4)", cursor: "pointer", lineHeight: 1,
          }}>×</button>
        </div>
        <div style={{ padding: "24px" }}>
          <p style={{ fontSize: "14px", color: MUT, lineHeight: 1.65, marginBottom: "20px" }}>
            Five quick questions — completely anonymous unless you choose to leave your email.
          </p>
          <a href="https://tally.so/r/aQrNKE" target="_blank" rel="noreferrer" style={{
            display: "block", width: "100%", background: G,
            borderRadius: "10px", padding: "15px", textAlign: "center",
            fontSize: "15px", fontWeight: 600, color: WHITE,
            cursor: "pointer", fontFamily: SANS, textDecoration: "none",
            marginBottom: "10px",
          }}>Share my feedback →</a>
          <button onClick={onDismiss} style={{
            display: "block", width: "100%", background: "transparent",
            border: "1.5px solid rgba(22,47,36,0.12)", borderRadius: "10px",
            padding: "12px", fontSize: "13px", color: MUT,
            cursor: "pointer", fontFamily: SANS,
          }}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function FeedbackButton({ onClick }) {
  return createPortal(
    <button onClick={onClick} style={{
      position: "fixed", bottom: "100px", right: "0",
      background: G, border: "2px solid " + GOLD,
      borderRadius: "10px 0 0 10px", borderRight: "none",
      padding: "14px 12px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
      cursor: "pointer", zIndex: 5000,
      boxShadow: "-3px 3px 12px rgba(0,0,0,0.18)",
    }}>
      <span style={{ fontSize: "16px" }}>💬</span>
      <span style={{
        fontSize: "9px", fontWeight: 700, color: GOLD,
        letterSpacing: "0.1em", textTransform: "uppercase",
        writingMode: "vertical-rl", transform: "rotate(180deg)",
      }}>Feedback</span>
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
