import { useState } from "react";
import { G, SANS } from "../design-tokens.js";

// A provider's own icon beside its name in a rate list, served from
// public/logos (no request leaves Candid). Matched on the domain of the
// product's link; a provider with no file yet, or one that fails to load,
// shows its first letter instead. To add one: save its icon as a 96px PNG
// named after its domain in public/logos, and add the domain here.
const LOGO_DOMAINS = [
  "bankofirelanduk.com", "cahoot.com", "chartersavingsbank.co.uk", "chase.co.uk", "closesavings.co.uk",
  "cynergybank.co.uk", "getchip.uk", "habibbank.com", "hl.co.uk", "investec.com", "leekbs.co.uk",
  "nsandi.com", "oxbury.com", "postoffice.co.uk", "saga.co.uk", "sidekickmoney.com", "tandem.co.uk",
  "trading212.com", "withplum.com",
];

function logoFor(url) {
  try {
    const host = new URL(url).hostname;
    return LOGO_DOMAINS.find(d => host === d || host.endsWith(`.${d}`)) || null;
  } catch { return null; }
}

const box = { width:"32px", height:"32px", borderRadius:"8px", flexShrink:0, border:"1px solid rgba(22,47,36,0.08)", boxSizing:"border-box" };

export default function ProviderLogo({ url, name }) {
  const [failed, setFailed] = useState(false);
  const domain = logoFor(url);
  if (domain && !failed) {
    return <img src={`/logos/${domain}.png`} alt="" width="32" height="32" loading="lazy" onError={() => setFailed(true)} style={{...box,objectFit:"contain",background:"#fff"}}/>;
  }
  return (
    <span aria-hidden="true" style={{...box,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(22,47,36,0.06)",color:G,fontFamily:SANS,fontSize:"14px",fontWeight:700}}>
      {(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}
