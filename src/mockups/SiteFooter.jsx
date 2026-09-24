import { G, GOLD, SERIF } from "../CandidApp.jsx";

// Shared across every marketing-site page — extracted so Home, The Problem
// and How it works don't each carry their own copy of the legal/company
// details.
export default function SiteFooter() {
  return (
    <div style={{
      background: G, padding: "28px 32px", display: "flex", alignItems: "center",
      justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
    }}>
      <div>
        <div style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 700, color: GOLD }}>Candid.</div>
        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "2px", lineHeight: 1.5 }}>
          Candid Personal Finance Ltd · Company no. 17383565<br />
          66 Paul Street, London, England, EC2A 4NA
        </div>
      </div>
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", lineHeight: 1.6, maxWidth: "560px" }}>
        Candid provides financial guidance and education only – not regulated financial advice. Always consider your personal circumstances and consult a qualified adviser for complex situations.
      </div>
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <span>© 2026 Candid Finance</span>
        <a href="/privacy.html" target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Privacy Policy</a>
        <a href="/terms.html" target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Terms of Service</a>
      </div>
    </div>
  );
}
