import { useState } from "react";
import posthog from "posthog-js";
import { PLANS, startCheckout } from "../../lib/entitlement.js";
import { G, WHITE, CRITICAL } from "../../design-tokens.js";

// The two plans as buttons, straight to Stripe's checkout, for a feature
// shown locked on a module's page. `from` names the feature in analytics.
export default function SubscribeButtons({ d, module, from }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const subscribe = async plan => {
    setBusy(plan); setError(null);
    posthog.capture("checkout_started", { module, plan, from });
    try { await startCheckout(plan, module, d.email); }
    catch (e) { setError(e.message); setBusy(null); }
  };
  return (
    <>
      <div style={{display:"flex",gap:"8px"}}>
        {["monthly", "yearly"].map(p => (
          <button key={p} type="button" disabled={!!busy} onClick={() => subscribe(p)} style={{background:p === "yearly" ? G : WHITE,color:p === "yearly" ? WHITE : G,border:`1.5px solid ${G}`,borderRadius:"100px",padding:"8px 14px",fontSize:"12.5px",fontWeight:700,fontFamily:"inherit",cursor:busy ? "default" : "pointer",opacity:busy && busy !== p ? 0.5 : 1}}>
            {PLANS[p].price} {PLANS[p].per}
          </button>
        ))}
      </div>
      {error && <span style={{fontSize:"12px",color:CRITICAL}}>{error}</span>}
    </>
  );
}
