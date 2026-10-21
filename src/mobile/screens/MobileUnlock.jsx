import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import posthog from "posthog-js";
import { Check, ChevronDown, Lock, X } from "lucide-react";
import { G, GOLD, MUT, TEXT, SERIF, WHITE, CREAM, ERROR_TEXT, CTA_BLUE } from "../../design-tokens.js";
import { MODULE_META, getModuleBreakdown } from "../../lib/moduleStatus.js";
import { fmt } from "../../lib/format.js";
import { unlockAsk, validEmail } from "../../lib/unlock.js";
import { useEmailCheck, DidYouMean } from "../emailCheckForm.jsx";
import { PLANS, ANNUAL_SAVING_PCT, startCheckout, requestRestore } from "../../lib/entitlement.js";
import { referralCode, invitedHere } from "../../lib/referral.js";
import InviteFriends from "../InviteFriends.jsx";

// A locked module (src/lib/unlock.js): what it's worth, in £, with the answer
// itself frosted until it's unlocked. The first module is free; after that,
// a subscription unlocks them all (Stripe's checkout, then back here). The
// frosted lines are stand-ins, not the real answer blurred, so nothing can
// be read from the page. `onUnlock(ask, answer)` unlocks a free one and goes
// on to the answer; `onLeaveEmail(email)` records an email for rate alerts
// from someone not subscribing yet. It shows once the module's questions
// are answered, so the figure is always their own.
// `returnTo`: opened from that module's "add this to see the full answer":
// a way back to it, where the answer now uses these figures, and closing
// goes there too.
export default function MobileUnlock({ moduleKey, d, m, statuses, onUnlock, onLeaveEmail, returnTo = null }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);
  const meta = MODULE_META.find(mm => mm.key === moduleKey);
  const mod = getModuleBreakdown(d, m, statuses, null, "amount").moduleList.find(mm => mm.key === moduleKey);
  const ask = unlockAsk(d);
  const amount = mod?.amount > 0 ? mod.amount : 0;

  // What's behind the frost, named, so it's clear what unlocking gets them.
  const hidden = amount > 0 ? ["Why it's happening", "Your options, and what each is worth"] : PREVIEW_LINES[moduleKey] || ["Where you stand", "What to keep an eye on"];
  const cta = amount > 0 ? "Show me my options" : "Show me";

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
          <div style={{fontSize:"16px",color:TEXT,fontWeight:600,marginTop:"10px"}}>{mod.amountIsLumpSum ? "by the time they're 18, our estimate" : "a year, our estimate on your figures"}</div>
        </div>
      ) : (
        <div style={{fontFamily:SERIF,fontSize:"30px",fontWeight:700,color:G,lineHeight:1.2,margin:"22px 0 4px"}}>Your position is ready</div>
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
        <PaywallSheet returnTo={returnTo}>
          <Subscribe moduleKey={moduleKey} returnTo={returnTo} title={meta?.title || moduleKey} d={d} amount={amount} lumpSum={!!mod?.amountIsLumpSum} onLeaveEmail={onLeaveEmail}/>
        </PaywallSheet>
      )}

      {ask.kind === "free" && (
        <>
          {ask.invite && <div style={{fontSize:"14px",color:TEXT,fontWeight:600,marginBottom:"10px"}}>Unlocked for free with your friend's invite.</div>}
          <button type="button" style={primary(false)} onClick={() => onUnlock(ask, null)}>{cta}</button>
        </>
      )}

      {ask.kind === "email" && <EmailUnlock d={d} cta={cta} primary={primary} onUnlock={answer => onUnlock(ask, answer)}
        confirm={{ module: moduleKey, amount: amount > 0 && !mod?.amountIsLumpSum ? amount : null, name: d.name || null, ...(referralCode() ? { ref: referralCode() } : {}) }}/>}
    </div>
  );
}

// What a module's answer tells them, named under the frost when there's no
// £ figure to lead with.
const PREVIEW_LINES = {
  studentLoan: ["When your balance starts falling", "What you'll repay in all, and whether any is written off"],
  kids: ["The childcare help you could get", "What crossing £100,000 would cost"],
  taxTrap: ["What the £100k trap costs you", "How to get back to £100k"],
};

// The first answer, for their email: one field, and whether they'd like to
// hear from Candid. The email also goes on their row (unlockPatch).
function EmailUnlock({ d, cta, primary, confirm, onUnlock }) {
  const [email, setEmail] = useState(d.email || "");
  const [alerts, setAlerts] = useState(false);
  const check = useEmailCheck("unlock");
  const submit = async e => {
    e.preventDefault();
    if (check.busy) return;
    const ok = await check.run(email, confirm);
    if (ok) onUnlock({ email: ok.email, callOk: alerts });
  };
  return (
    <form onSubmit={submit}>
      <div style={{fontSize:"15px",color:TEXT,fontWeight:600,lineHeight:1.4,marginBottom:"10px"}}>Add your email to see your answer.</div>
      {invitedHere() && <div style={{fontSize:"13px",color:MUT,lineHeight:1.45,margin:"-4px 0 10px"}}>Invited by a friend: your second module is unlocked for free.</div>}
      <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" aria-label="Email"
        style={{width:"100%",boxSizing:"border-box",border:"1.5px solid rgba(22,47,36,0.15)",borderRadius:"100px",padding:"14px 18px",fontSize:"15px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE}}/>
      <label style={{display:"flex",alignItems:"flex-start",gap:"10px",margin:"12px 2px 16px",fontSize:"13px",color:TEXT,lineHeight:1.45,cursor:"pointer"}}>
        <input type="checkbox" checked={alerts} onChange={e => setAlerts(e.target.checked)} style={{marginTop:"2px",accentColor:G}}/>
        Email me when I could be keeping more: a better rate, or an allowance about to go unused.
      </label>
      <button type="submit" disabled={check.busy} style={primary(check.busy)}>{check.busy ? "Checking…" : cta}</button>
      {check.error && <div role="alert" style={{fontSize:"12.5px",color:ERROR_TEXT,marginTop:"8px",textAlign:"center"}}>{check.error}</div>}
      <DidYouMean suggestion={check.suggestion} onUse={to => check.use(to, setEmail)}/>
      <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"10px 0 0",textAlign:"center"}}>We'll email a link to confirm it's yours. No spam, and never shared. <a href="/privacy.html" target="_blank" rel="noreferrer" style={{color:MUT}}>Privacy policy</a></p>
    </form>
  );
}

// The paywall as a card floating in the middle of the screen, over the
// locked page, which stays in view behind it, dimmed. The card repeats the
// module's £ figure, since it covers the one on the page. Over the tab bar
// and the Assist button (4500), under Assist's own panel. Closing goes back
// to the modules.
function PaywallSheet({ children, returnTo = null }) {
  const navigate = useNavigate();
  return (
    <div style={{position:"fixed",inset:0,zIndex:4600,display:"flex",flexDirection:"column",justifyContent:"center",padding:"16px",boxSizing:"border-box"}}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
        style={{position:"absolute",inset:0,background:"rgba(22,47,36,0.28)",backdropFilter:"blur(2px)",WebkitBackdropFilter:"blur(2px)"}}/>
      <motion.div role="dialog" aria-modal="true" aria-label="Subscribe to Candid"
        initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 340, damping: 30 }}
        style={{position:"relative",background:CREAM,borderRadius:"22px",boxShadow:"0 18px 50px rgba(22,47,36,0.28)",maxHeight:"calc(100dvh - 32px)",overflowY:"auto",
          padding:"20px",maxWidth:"440px",width:"100%",margin:"0 auto",boxSizing:"border-box"}}>
        <button type="button" onClick={() => navigate(returnTo ? `/app/module/${returnTo}` : "/app/modules")} aria-label="Close"
          style={{position:"absolute",top:"12px",right:"14px",width:"32px",height:"32px",borderRadius:"50%",border:"none",background:"rgba(22,47,36,0.07)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <X size={16} color={TEXT}/>
        </button>
        {children}
      </motion.div>
    </div>
  );
}

// Subscribing: the two plans, then Stripe's own checkout page. Below, a way
// back in for someone already subscribed (an emailed link), and a way to
// hear about rate changes without subscribing.
function Subscribe({ moduleKey, title, d, amount, lumpSum, onLeaveEmail, returnTo = null }) {
  const navigate = useNavigate();
  const backTitle = returnTo ? MODULE_META.find(mm => mm.key === returnTo)?.title : null;
  const [plan, setPlan] = useState("yearly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [panel, setPanel] = useState(null); // "restore" | "alerts"
  const [email, setEmail] = useState(d.email || "");
  const [done, setDone] = useState(null);
  const [soonOpen, setSoonOpen] = useState(false);
  const check = useEmailCheck("paywall");
  useEffect(() => { posthog.capture("paywall_shown", { module: moduleKey }); }, [moduleKey]);

  const go = async () => {
    setBusy(true); setError(null);
    posthog.capture("checkout_started", { module: moduleKey, plan });
    try { await startCheckout(plan, moduleKey, d.email); }
    catch (e) { setError(e.message); setBusy(false); }
  };
  const submitEmail = async e => {
    e.preventDefault();
    if (panel === "alerts") {
      if (check.busy) return;
      const ok = await check.run(email, { module: moduleKey, name: d.name || null });
      if (ok) { onLeaveEmail?.(ok.email); setDone("alerts"); }
      return;
    }
    if (!validEmail(email)) { setError("Enter a valid email address"); return; }
    setError(null);
    setBusy(true);
    try { await requestRestore(email.trim()); posthog.capture("restore_requested"); setDone("restore"); }
    catch (err) { setError(err.message); }
    setBusy(false);
  };

  const card = on => ({ flex:1, textAlign:"left", background:WHITE, border:`2px solid ${on ? G : "rgba(22,47,36,0.12)"}`, borderRadius:"14px", padding:"12px 14px", cursor:"pointer", fontFamily:"inherit" });
  const link = { background:"none", border:"none", padding:0, color:G, fontSize:"12.5px", fontWeight:700, fontFamily:"inherit", cursor:"pointer" };
  const fine = { color:MUT, textDecoration:"underline", whiteSpace:"nowrap" };
  return (
    <div>
      <Worth title={title} amount={amount} lumpSum={lumpSum}/>
      {returnTo && (
        <button type="button" onClick={() => navigate(`/app/module/${returnTo}`)} style={{width:"100%",marginTop:"14px",background:WHITE,color:G,border:`1.5px solid ${G}`,borderRadius:"14px",padding:"11px 14px",fontFamily:"inherit",cursor:"pointer",textAlign:"left"}}>
          <span style={{display:"block",fontSize:"14px",fontWeight:700}}>Back to {backTitle}</span>
          <span style={{display:"block",fontSize:"12px",color:MUT,marginTop:"2px"}}>Your {backTitle?.toLowerCase()} answer now uses these figures. This {title.toLowerCase()} answer is part of a subscription.</span>
        </button>
      )}
      <div style={{display:"flex",gap:"10px",margin:"18px 0 12px"}}>
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
            {key === "yearly" && <div style={{fontSize:"11.5px",color:MUT,marginTop:"2px"}}>{p.note}</div>}
          </button>
        ))}
      </div>
      <button type="button" disabled={busy} onClick={go} style={{width:"100%",background:CTA_BLUE,opacity:busy ? 0.5 : 1,color:WHITE,border:"none",borderRadius:"100px",padding:"15px",fontSize:"15.5px",fontWeight:700,fontFamily:"inherit",cursor:busy ? "default" : "pointer"}}>
        {busy && !panel ? "Opening checkout…" : "Subscribe and see your options"}
      </button>
      {error && !panel && <div style={{fontSize:"12.5px",color:ERROR_TEXT,margin:"8px 0 0",textAlign:"center"}}>{error}</div>}
      {/* The other way in: a free month for inviting a friend
          (InviteFriends.jsx), opened here. */}
      {validEmail(d.email) && (
        <button type="button" aria-expanded={panel === "invite"} onClick={() => { setPanel(p => p === "invite" ? null : "invite"); setDone(null); setError(null); check.clear(); }}
          style={{width:"100%",marginTop:"10px",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"15px",fontSize:"15.5px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
          Invite a friend, get a free month
        </button>
      )}
      {panel === "invite" && <div style={{marginTop:"14px"}}><InviteFriends d={d} source="paywall" bare/></div>}
      {/* The terms and the guidance-not-advice line in one, each linked to
          the full page. */}
      <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"10px 0 0",textAlign:"center"}}>
        Cancel anytime · 14-day refund · <a href="/terms.html" target="_blank" rel="noreferrer" style={fine}>Terms</a> · <a href="/what-candid-is" target="_blank" rel="noreferrer" style={fine}>Guidance, not advice</a>
      </p>

      {/* What's included today; what's being built folded away below it, and
          kept apart, so nothing not yet built reads as part of what's paid
          for. */}
      <div style={{borderTop:"1px solid rgba(22,47,36,0.1)",marginTop:"16px",paddingTop:"14px"}}>
        <div style={listHead}>What's included</div>
        <ul style={listStyle}>
          {INCLUDED.map(([name, line]) => (
            <li key={name} style={itemStyle}>
              <Check size={15} color={GOLD} strokeWidth={3} style={{flexShrink:0,marginTop:"2px"}}/>
              <span><span style={{fontWeight:700,color:TEXT}}>{name}</span><span style={{display:"block",fontSize:"12.5px",color:MUT,marginTop:"1px"}}>{line}</span></span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setSoonOpen(o => !o)} aria-expanded={soonOpen}
          style={{...listHead,background:"none",border:"none",padding:0,margin:"14px 0 0",display:"inline-flex",alignItems:"center",gap:"4px",cursor:"pointer",fontFamily:"inherit"}}>
          Coming soon<ChevronDown size={13} style={{transform:soonOpen ? "rotate(180deg)" : "none",transition:"transform 0.2s"}}/>
        </button>
        {soonOpen && (
          <ul style={listStyle}>
            {COMING_SOON.map(([name, line]) => (
              <li key={name} style={{...itemStyle,paddingLeft:"23px"}}>
                <span><span style={{fontWeight:700,color:MUT}}>{name}</span><span style={{display:"block",fontSize:"12.5px",color:MUT,marginTop:"1px"}}>{line}</span></span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{display:"flex",justifyContent:"center",flexWrap:"wrap",columnGap:"18px",rowGap:"6px",marginTop:"16px"}}>
        <button type="button" style={link} onClick={() => { setPanel(p => p === "restore" ? null : "restore"); setDone(null); setError(null); check.clear(); }}>Already subscribed?</button>
        <button type="button" style={link} onClick={() => { setPanel(p => p === "alerts" ? null : "alerts"); setDone(null); setError(null); check.clear(); }}>Get rate alerts</button>
      </div>
      {panel && panel !== "invite" && (
        done ? (
          <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"14px 0 0",textAlign:"center"}}>
            {done === "restore" ? "If that email has a subscription, a sign-in link is on its way. Open it on this device." : "Thanks. Use the link we've just emailed to confirm it's you, and we'll email you when you could be keeping more."}
          </p>
        ) : (
          <form onSubmit={submitEmail} style={{marginTop:"14px"}}>
            <div style={{fontSize:"13px",color:TEXT,marginBottom:"8px"}}>
              {panel === "restore" ? "Enter the email you subscribed with, and we'll send you a sign-in link." : "We'll email you when you could be keeping more: a better rate, or an allowance going unused."}
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
                style={{flex:1,minWidth:0,boxSizing:"border-box",border:"1.5px solid rgba(22,47,36,0.15)",borderRadius:"100px",padding:"12px 16px",fontSize:"14px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE}}/>
              <button type="submit" disabled={busy || check.busy} style={{background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"0 16px",fontSize:"14px",fontWeight:700,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap"}}>
                {panel === "restore" ? "Send link" : "Sign up"}
              </button>
            </div>
            {(error || check.error) && <div role="alert" style={{fontSize:"12px",color:ERROR_TEXT,margin:"6px 0 0 6px"}}>{error || check.error}</div>}
            {panel === "alerts" && <DidYouMean suggestion={check.suggestion} onUse={to => check.use(to, setEmail)}/>}
            {panel === "alerts" && <p style={{fontSize:"11.5px",color:MUT,margin:"8px 0 0"}}>Unsubscribe any time. <a href="/privacy.html" target="_blank" rel="noreferrer" style={{color:MUT}}>Privacy policy</a></p>}
          </form>
        )
      )}
    </div>
  );
}

// What a subscription includes, beyond the free figures: only what's there
// today, led by what keeps going after the first look (a subscription is
// for staying current, not for more answers). The options in each gated
// module (unlock.js SCORED_MODULES) and Assist on them; the figures worked
// out again on each day's rates (api/rates.js); the emails (api/alerts.js),
// once they're being sent, the same setting that turns sending on; and
// sign-in on other devices (SignInSetup.jsx), which is for subscribers.
const ALERTS_LIVE = import.meta.env.VITE_ALERTS_LIVE === "1";
const INCLUDED = [
  ["Kept up to date", "Your savings checked against each day's best rates, and every figure worked out again whenever you update your pay or savings."],
  ALERTS_LIVE ? ["Alerts when something changes", "An email when a better savings rate appears, before your bonus lands, or as tax-year deadlines approach."] : null,
  ["Your options in every module", "Why each figure is what it is, and what each option is worth, across Pension, Cash, Investments, Student Loan and Kids & family."],
  ["Candid Assist", "Questions about your own numbers, answered inside every module."],
  ["On all your devices", "Sign in with Face ID, a fingerprint or a password."],
].filter(Boolean);
// Being built, with no dates promised. Something moves up to INCLUDED only
// once it's live for subscribers.
const COMING_SOON = [
  ["Automated account switching", "Hands-free admin for opening and moving ISAs and savings accounts."],
  ["Open Banking integration", "Connect your accounts for a live, unified view of your net worth."],
  ["Savings and goal planner", "Dynamic reviews of how much you could save and invest."],
  ["Tax trap and leakage alerts", "Warnings for stealth tax bands, policy shifts and missed yield."],
  ["New expansion modules", "Household finances, children's accounts, property and mortgages, and inheritance."],
];
const listHead = { fontSize:"10.5px", fontWeight:700, color:MUT, letterSpacing:"0.09em", textTransform:"uppercase" };
const listStyle = { listStyle:"none", padding:0, margin:"10px 0 0", display:"flex", flexDirection:"column", gap:"8px" };
const itemStyle = { display:"flex", gap:"8px", alignItems:"flex-start", fontSize:"13.5px", lineHeight:1.35 };

// What this module is worth against what Candid costs a year: "3x" rounded
// down, so it never overstates; "more than" under 2x. Lump sums (by 18) and
// small amounts just show the figure; nothing found, just the module.
function Worth({ title, amount, lumpSum }) {
  const kicker = { fontSize:"10.5px", fontWeight:600, color:MUT, letterSpacing:"0.09em", textTransform:"uppercase", paddingRight:"40px" };
  if (!(amount > 0)) return <div style={{...kicker,marginTop:"6px"}}>{title}</div>;
  const cost = PLANS.yearly.amount;
  const times = Math.floor(amount / cost);
  const compare = lumpSum || amount <= cost ? null
    : times >= 2 ? `${times}x what Candid costs` : "more than Candid costs";
  return (
    <div>
      <div style={{...kicker,marginTop:"6px"}}>{title}</div>
      <div style={{fontFamily:SERIF,fontSize:"40px",fontWeight:700,color:G,lineHeight:1,letterSpacing:"-0.02em",marginTop:"8px"}}>{fmt(amount)}</div>
      <div style={{fontSize:"13.5px",color:TEXT,fontWeight:600,marginTop:"6px",lineHeight:1.4}}>
        {lumpSum ? "by the time they're 18, our estimate" : "a year, our estimate"}{compare && <span style={{color:G}}> · {compare}</span>}
      </div>
    </div>
  );
}
