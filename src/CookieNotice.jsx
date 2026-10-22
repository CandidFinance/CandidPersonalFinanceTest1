import { useEffect, useState } from "react";
import { G, WHITE, MUT, TEXT } from "./design-tokens.js";
import { getConsent, setConsent, CONSENT_RESET_EVENT } from "./lib/consent.js";

// The cookie notice (src/lib/consent.js), across the site and the app until
// someone chooses. Saying no is one tap, the same as saying yes.
export default function CookieNotice() {
  const [open, setOpen] = useState(() => getConsent() === null);
  useEffect(() => {
    const ask = () => setOpen(true);
    window.addEventListener(CONSENT_RESET_EVENT, ask);
    return () => window.removeEventListener(CONSENT_RESET_EVENT, ask);
  }, []);
  if (!open) return null;
  // Accepting links a signed-in subscriber up in PostHog (entitlement.js
  // identifySubscriber), loaded only then to keep it off every page.
  const choose = choice => {
    setConsent(choice);
    setOpen(false);
    if (choice === "granted") import("./lib/entitlement.js").then(m => m.identifySubscriber()).catch(() => {});
  };
  // Both buttons look the same, so neither answer is nudged.
  const button = {
    flex: 1, minWidth: "120px", padding: "10px 14px", borderRadius: "100px", fontSize: "13.5px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
    background: WHITE, color: G, border: `1.5px solid ${G}`,
  };
  return (
    <div role="region" aria-label="Cookies" style={{
      position: "fixed", left: "12px", right: "12px", bottom: "calc(12px + env(safe-area-inset-bottom))", zIndex: 5100,
      maxWidth: "520px", margin: "0 auto", background: WHITE, borderRadius: "14px", padding: "14px 16px",
      boxShadow: "0 8px 28px rgba(22,47,36,0.18)", border: "1px solid rgba(22,47,36,0.1)",
    }}>
      <p style={{ fontSize: "13px", color: TEXT, lineHeight: 1.5, margin: 0 }}>
        Can Candid use analytics cookies? They show us which pages people use, so we can improve them. No advertising cookies, ever. <a href="/privacy.html#cookies" target="_blank" rel="noreferrer" style={{ color: MUT, fontWeight: 600 }}>Privacy policy</a>
      </p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
        <button type="button" onClick={() => choose("denied")} style={button}>No thanks</button>
        <button type="button" onClick={() => choose("granted")} style={button}>Accept</button>
      </div>
    </div>
  );
}
