import { Link } from "react-router-dom";
import { G, WHITE, GEORGIA } from "../design-tokens.js";
import { askConsentAgain } from "../lib/consent.js";
import RegulatoryDisclaimer from "./RegulatoryDisclaimer.jsx";

// Shared across every marketing-site page — extracted so Home, The Problem
// and How it works don't each carry their own copy of the legal/company
// details.
// White at these strengths on the green: 6.1:1 for the quiet lines, 7.8:1
// for the links (WCAG AA needs 4.5:1). The links' vertical padding makes
// each one a taller tap target without spreading the row.
const QUIET = "rgba(255,255,255,0.6)";
const LINK = { color: "rgba(255,255,255,0.7)", textDecoration: "none", padding: "6px 0" };

export default function SiteFooter() {
  return (
    <footer style={{
      background: G, padding: "28px 32px", display: "flex", alignItems: "center",
      justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
    }}>
      <div>
        <div style={{ fontFamily: GEORGIA, fontSize: "19px", fontWeight: 700, color: WHITE, letterSpacing: "-0.01em" }}>Candid.</div>
        <div style={{ fontSize: "12px", color: QUIET, marginTop: "2px", lineHeight: 1.5 }}>
          Candid Personal Finance Ltd · Company no. 17383565<br />
          66 Paul Street, London, England, EC2A 4NA
        </div>
      </div>
      <RegulatoryDisclaimer />
      <div style={{ fontSize: "12.5px", color: QUIET, display: "flex", columnGap: "16px", alignItems: "center", flexWrap: "wrap" }}>
        <span>© 2026 Candid Finance</span>
        <Link to="/what-candid-is" style={LINK}>What Candid is and isn't</Link>
        <Link to="/about" style={LINK}>About</Link>
        <a href="/privacy.html" target="_blank" rel="noreferrer" style={LINK}>Privacy Policy</a>
        <a href="/terms.html" target="_blank" rel="noreferrer" style={LINK}>Terms of Service</a>
        <button type="button" onClick={askConsentAgain} style={{ ...LINK, background: "none", border: "none", font: "inherit", cursor: "pointer" }}>Cookie settings</button>
      </div>
    </footer>
  );
}
