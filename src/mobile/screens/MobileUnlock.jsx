import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import posthog from "posthog-js";
import { Lock, X } from "lucide-react";
import { G, GOLD, MUT, TEXT, SERIF, WHITE } from "../../CandidApp.jsx";
import { MODULE_META, getModuleBreakdown } from "../../lib/moduleStatus.js";
import { fmt } from "../../lib/format.js";
import { unlockAsk, validEmail } from "../../lib/unlock.js";
import { PLANS, ANNUAL_SAVING_PCT, startCheckout, requestRestore } from "../../lib/entitlement.js";

// A locked module (src/lib/unlock.js): what it's worth, in £, with the answer
// itself frosted until it's unlocked. The first module is free; after that,
// a subscription unlocks them all (Stripe's checkout, then back here). The
// frosted lines are stand-ins, not the real answer blurred, so nothing can
// be read from the page. `onUnlock(ask, answer)` unlocks a free one and goes
// on to the answer; `onLeaveEmail(email)` records an email for rate alerts
// from someone not subscribing yet.
export default function MobileUnlock({ moduleKey, d, m, statuses, onUnlock, onLeaveEmail }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);
  const meta = MODULE_META.find(mm => mm.key === moduleKey);
  const mod = getModuleBreakdown(d, m, statuses, null, "amount").moduleList.find(mm => mm.key === moduleKey);
  const ask = unlockAsk(d);
  const amount = mod?.amount > 0 ? mod.amount : 0;

  // What's behind the frost, named, so it's clear what unlocking gets them.
  const hidden = amount > 0 ? ["Why you're missing it", "How to fix it"] : ["Where you stand", "What to keep an eye on"];
  const cta = amount > 0 ? "Show me how to fix it" : "Show me";

  const label = { fontSize:"10.5px", fontWeight:600, color:MUT, letterSpacing:"0.09em", textTransform:"uppercase" };
  const primary = disabled => ({ width:"100%", background:disabled ? "rgba(22,47,36,0.2)" : G, color:WHITE, border:"none", borderRadius:"100px", padding:"15px", fontSize:"15.5px", fontWeight:700, fontFamily:"inherit", cursor:disabled ? "not-allowed" : "pointer" });

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
        <div style={{width:"34px",height:"34px",borderRadius:"9px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {meta?.icon && <meta.icon size={16} color={G}/>}
        </div>
        <h1 style={{fontSize:"15px",color:TEXT,fontWeight:700,margin:0}}>{meta?.title || moduleKey}</h1>
      </div>

      {/* The figure is the first thing they see. */}
      {amount > 0 ? (
        <div style={{margin:"22px 0 4px"}}>
          <div style={{fontFamily:SERIF,fontSize:"64px",fontWeight:700,color:G,lineHeight:1,letterSpacing:"-0.02em"}}>{fmt(amount)}</div>
          <div style={{fontSize:"16px",color:TEXT,fontWeight:600,marginTop:"10px"}}>{mod.amountIsLumpSum ? "by the time they're 18" : "a year you're missing out on"}</div>
        </div>
      ) : (
        <div style={{fontFamily:SERIF,fontSize:"30px",fontWeight:700,color:G,lineHeight:1.2,margin:"22px 0 4px"}}>Your answer is ready</div>
      )}

      {/* What unlocking shows, each under a frost of stand-in lines (not the
          real answer blurred, so nothing can be read from the page). */}
      <div aria-hidden="true" style={{margin:"22px 0 24px",display:"flex",flexDirection:"column",gap:"16px"}}>
        {hidden.map(h => (
          <div key={h}>
            <div style={{display:"flex",alignItems:"center",gap:"6px",...label,color:TEXT}}><Lock size={12} color={G}/>{h}</div>
            <div style={{filter:"blur(5px)",userSelect:"none",marginTop:"8px"}}>
              {[90, 70].map((w, i) => <div key={i} style={{height:"11px",width:`${w}%`,borderRadius:"6px",background:"rgba(22,47,36,0.16)",marginBottom:"8px"}}/>)}
            </div>
          </div>
        ))}
      </div>

      {ask.kind === "pay" && (
        <PaywallSheet>
          <Subscribe moduleKey={moduleKey} d={d} amount={amount} onLeaveEmail={onLeaveEmail}/>
        </PaywallSheet>
      )}

      {ask.kind === "free" && (
        <button type="button" style={primary(false)} onClick={() => onUnlock(ask, null)}>{cta}</button>
      )}
    </div>
  );
}

// The paywall as a card risen over the locked page, which stays in view
// behind it, dimmed: the £ figure above the card, the frosted lines under
// it. Over the tab bar and the Assist button (4500), under Assist's own
// panel. Closing goes back to the modules.
function PaywallSheet({ children }) {
  const navigate = useNavigate();
  return (
    <div style={{position:"fixed",inset:0,zIndex:4600,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
        style={{position:"absolute",inset:0,background:"rgba(22,47,36,0.28)",backdropFilter:"blur(2px)",WebkitBackdropFilter:"blur(2px)"}}/>
      <motion.div role="dialog" aria-modal="true" aria-label="Subscribe to Candid"
        initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 34 }}
        style={{position:"relative",background:"#faf7f0",borderRadius:"22px 22px 0 0",boxShadow:"0 -10px 40px rgba(22,47,36,0.22)",maxHeight:"72dvh",overflowY:"auto",
          padding:"10px 20px",paddingBottom:"calc(22px + env(safe-area-inset-bottom, 0px))",maxWidth:"580px",width:"100%",margin:"0 auto",boxSizing:"border-box"}}>
        <div style={{width:"38px",height:"4px",borderRadius:"100px",background:"rgba(22,47,36,0.18)",margin:"0 auto 8px"}}/>
        <button type="button" onClick={() => navigate("/app/modules")} aria-label="Close"
          style={{position:"absolute",top:"12px",right:"14px",width:"32px",height:"32px",borderRadius:"50%",border:"none",background:"rgba(22,47,36,0.07)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <X size={16} color={TEXT}/>
        </button>
        <div style={{paddingTop:"14px"}}>{children}</div>
      </motion.div>
    </div>
  );
}

// Subscribing: the two plans, then Stripe's own checkout page. Below, a way
// back in for someone already subscribed (an emailed link), and a way to
// hear about rate changes without subscribing.
function Subscribe({ moduleKey, d, amount, onLeaveEmail }) {
  const [plan, setPlan] = useState("yearly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [panel, setPanel] = useState(null); // "restore" | "alerts"
  const [email, setEmail] = useState(d.email || "");
  const [done, setDone] = useState(null);
  useEffect(() => { posthog.capture("paywall_shown", { module: moduleKey }); }, [moduleKey]);

  const go = async () => {
    setBusy(true); setError(null);
    posthog.capture("checkout_started", { module: moduleKey, plan });
    try { await startCheckout(plan, moduleKey, d.email); }
    catch (e) { setError(e.message); setBusy(false); }
  };
  const submitEmail = async e => {
    e.preventDefault();
    if (!validEmail(email)) { setError("Enter a valid email address"); return; }
    setError(null);
    if (panel === "alerts") { onLeaveEmail?.(email.trim()); setDone("alerts"); return; }
    setBusy(true);
    try { await requestRestore(email.trim()); posthog.capture("restore_requested"); setDone("restore"); }
    catch (err) { setError(err.message); }
    setBusy(false);
  };

  const card = on => ({ flex:1, textAlign:"left", background:WHITE, border:`2px solid ${on ? G : "rgba(22,47,36,0.12)"}`, borderRadius:"14px", padding:"12px 14px", cursor:"pointer", fontFamily:"inherit" });
  const link = { background:"none", border:"none", padding:0, color:G, fontSize:"13px", fontWeight:700, fontFamily:"inherit", cursor:"pointer" };
  return (
    <div>
      <div style={{fontSize:"16px",fontWeight:700,color:TEXT,lineHeight:1.35,paddingRight:"36px"}}>Your first answer was free. Subscribe to see {amount > 0 ? "how to fix this" : "this answer"}, and every other module.</div>
      <div style={{display:"flex",gap:"10px",margin:"14px 0 12px"}}>
        {Object.entries(PLANS).map(([key, p]) => (
          <button key={key} type="button" onClick={() => setPlan(key)} aria-pressed={plan === key} style={{...card(plan === key),position:"relative"}}>
            {key === "yearly" && ANNUAL_SAVING_PCT > 0 && (
              <span style={{position:"absolute",top:"-9px",right:"10px",background:GOLD,color:WHITE,fontSize:"10.5px",fontWeight:800,letterSpacing:"0.03em",borderRadius:"100px",padding:"2px 8px"}}>Save {ANNUAL_SAVING_PCT}%</span>
            )}
            <div style={{fontSize:"12px",fontWeight:700,color:MUT}}>{p.label}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:"4px",marginTop:"2px"}}>
              <span style={{fontFamily:SERIF,fontSize:"24px",fontWeight:700,color:G}}>{p.price}</span>
              <span style={{fontSize:"12px",color:MUT}}>{p.per}</span>
            </div>
            <div style={{fontSize:"11.5px",color:MUT,marginTop:"2px"}}>{p.note}</div>
          </button>
        ))}
      </div>
      <button type="button" disabled={busy} onClick={go} style={{width:"100%",background:busy ? "rgba(22,47,36,0.4)" : G,color:WHITE,border:"none",borderRadius:"100px",padding:"15px",fontSize:"15.5px",fontWeight:700,fontFamily:"inherit",cursor:busy ? "default" : "pointer"}}>
        {busy && !panel ? "Opening checkout…" : "Subscribe and unlock everything"}
      </button>
      {error && !panel && <div style={{fontSize:"12.5px",color:"#b3261e",margin:"8px 0 0",textAlign:"center"}}>{error}</div>}
      <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"10px 0 0",textAlign:"center"}}>
        Every module's answer, kept up to date as rates change. Cancel any time. Payments by Stripe.
      </p>

      <div style={{display:"flex",justifyContent:"center",gap:"18px",marginTop:"16px"}}>
        <button type="button" style={link} onClick={() => { setPanel(p => p === "restore" ? null : "restore"); setDone(null); setError(null); }}>Already subscribed?</button>
        <button type="button" style={link} onClick={() => { setPanel(p => p === "alerts" ? null : "alerts"); setDone(null); setError(null); }}>Not yet? Get rate alerts</button>
      </div>
      {panel && (
        done ? (
          <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"14px 0 0",textAlign:"center"}}>
            {done === "restore" ? "If that email has a subscription, a sign-in link is on its way. Open it on this device." : "Thanks. We'll email you when you could be keeping more."}
          </p>
        ) : (
          <form onSubmit={submitEmail} style={{marginTop:"14px"}}>
            <div style={{fontSize:"13px",color:TEXT,marginBottom:"8px"}}>
              {panel === "restore" ? "Enter the email you subscribed with, and we'll send you a sign-in link." : "We'll email you when you could be keeping more: a better rate, or an allowance going unused."}
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
                style={{flex:1,minWidth:0,boxSizing:"border-box",border:"1.5px solid rgba(22,47,36,0.15)",borderRadius:"100px",padding:"12px 16px",fontSize:"14px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE}}/>
              <button type="submit" disabled={busy} style={{background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"0 16px",fontSize:"14px",fontWeight:700,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap"}}>
                {panel === "restore" ? "Send link" : "Sign up"}
              </button>
            </div>
            {error && <div style={{fontSize:"12px",color:"#b3261e",margin:"6px 0 0 6px"}}>{error}</div>}
            {panel === "alerts" && <p style={{fontSize:"11.5px",color:MUT,margin:"8px 0 0"}}>Unsubscribe any time. <a href="/privacy.html" target="_blank" rel="noreferrer" style={{color:MUT}}>Privacy policy</a></p>}
          </form>
        )
      )}
    </div>
  );
}
