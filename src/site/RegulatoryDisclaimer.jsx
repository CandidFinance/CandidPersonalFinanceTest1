import { DISCLAIMER, DISCLAIMER_DETAIL } from "../lib/disclaimer.js";

// The regulatory line in the site footer. The standalone .html pages show
// the same wording through <candid-footer> (src/lib/sitePartials.js).
export default function RegulatoryDisclaimer() {
  return (
    <div style={{ maxWidth: "560px", lineHeight: 1.6 }}>
      <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{DISCLAIMER}</div>
      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", marginTop: "4px" }}>{DISCLAIMER_DETAIL}</div>
    </div>
  );
}
