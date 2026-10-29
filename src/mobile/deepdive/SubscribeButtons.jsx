import { useState } from "react";
import posthog from "posthog-js";
import { PLANS, ANNUAL_SAVING_PCT, startCheckout } from "../../lib/entitlement.js";
import { G, WHITE, MUT, SERIF, CRITICAL, CTA_BLUE } from "../../design-tokens.js";

// CTA blue's pale wash, for what's picked.
export const CTA_WASH = "#EAF3FE";

function useCheckout(d, module, from) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const subscribe = async plan => {
    setBusy(plan); setError(null);
    posthog.capture("checkout_started", { module, plan, from });
    try { await startCheckout(plan, module, d.email); }
    catch (e) { setError(e.message); setBusy(null); }
  };
  return { busy, error, subscribe };
}

// The two plans as cards to pick from, monthly then yearly, yearly picked
// to start with, and one button to Stripe's checkout for the one picked.
export function PlanPicker({ d, module, from }) {
  const { busy, error, subscribe } = useCheckout(d, module, from);
  const [plan, setPlan] = useState("yearly");
  const card = p => {
    const on = plan === p;
    return (
      <button key={p} type="button" onClick={() => setPlan(p)} aria-pressed={on} style={{
        position:"relative", textAlign:"left", border: on ? `2px solid ${CTA_BLUE}` : "1.5px solid rgba(22,47,36,0.18)", background: on ? CTA_WASH : WHITE,
        borderRadius:"14px", padding:"14px 12px 12px", fontFamily:"inherit", cursor:"pointer",
      }}>
        {p === "yearly" && <span style={{position:"absolute",top:"-10px",left:"12px",background:CTA_BLUE,color:WHITE,fontSize:"10.5px",fontWeight:700,letterSpacing:"0.04em",borderRadius:"100px",padding:"3px 8px"}}>SAVE {ANNUAL_SAVING_PCT}%</span>}
        <span style={{display:"block",fontSize:"12px",fontWeight:700,color: on ? "#0058b0" : MUT}}>{p === "yearly" ? "Yearly" : "Monthly"}</span>
        <span style={{display:"block",fontFamily:SERIF,fontSize:"24px",fontWeight:700,color:G,marginTop:"2px"}}>{PLANS[p].price}</span>
        <span style={{display:"block",fontSize:"11.5px",color:MUT,marginTop:"2px"}}>{PLANS[p].note}</span>
      </button>
    );
  };
  return (
    <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2, minmax(0, 1fr))",gap:"10px",paddingTop:"10px"}}>
        {card("monthly")}{card("yearly")}
      </div>
      <button type="button" disabled={!!busy} onClick={() => subscribe(plan)} style={{
        marginTop:"14px", width:"100%", height:"54px", border:"none", borderRadius:"100px", background:CTA_BLUE, color:WHITE,
        fontFamily:"inherit", fontSize:"16px", fontWeight:700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1,
      }}>{busy ? "Opening checkout…" : `Subscribe ${plan}`}</button>
      {error && <div style={{fontSize:"12px",color:CRITICAL,marginTop:"8px",textAlign:"center"}}>{error}</div>}
    </>
  );
}

// The two plans as buttons, straight to Stripe's checkout, for a feature
// shown locked on a module's page, in CTA blue as PlanPicker's. `from` names
// the feature in analytics.
export default function SubscribeButtons({ d, module, from }) {
  const { busy, error, subscribe } = useCheckout(d, module, from);
  return (
    <>
      <div style={{display:"flex",gap:"8px"}}>
        {["monthly", "yearly"].map(p => (
          <button key={p} type="button" disabled={!!busy} onClick={() => subscribe(p)} style={{background:p === "yearly" ? CTA_BLUE : WHITE,color:p === "yearly" ? WHITE : CTA_BLUE,border:`1.5px solid ${CTA_BLUE}`,borderRadius:"100px",padding:"8px 14px",fontSize:"12.5px",fontWeight:700,fontFamily:"inherit",cursor:busy ? "default" : "pointer",opacity:busy && busy !== p ? 0.5 : 1}}>
            {PLANS[p].price} {PLANS[p].per}
          </button>
        ))}
      </div>
      {error && <span style={{fontSize:"12px",color:CRITICAL}}>{error}</span>}
    </>
  );
}
