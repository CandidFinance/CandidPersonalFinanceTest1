import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import posthog from "posthog-js";
import { ChevronDown, Lock, X } from "lucide-react";
import { G, MUT, TEXT, SERIF, WHITE, ERROR_TEXT, CTA_BLUE, FIELD_BORDER, LABEL_CAPS } from "../../design-tokens.js";
import { MODULE_META, getModuleBreakdown } from "../../lib/moduleStatus.js";
import { fmt } from "../../lib/format.js";
import { unlockAsk, validEmail } from "../../lib/unlock.js";
import { useEmailCheck, DidYouMean, EMAIL_WHY } from "../emailCheckForm.jsx";
import { PLANS, requestRestore, signInWithGoogle } from "../../lib/entitlement.js";
import { PlanPicker, CTA_WASH } from "../deepdive/SubscribeButtons.jsx";
import GoogleButton from "../GoogleButton.jsx";
import { referralCode, invitedHere } from "../../lib/referral.js";
import InviteFriends from "../InviteFriends.jsx";
import useDialogFocus from "../useDialogFocus.js";
import { primaryButtonStyle } from "../onboarding/OnboardingShell.jsx";

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
  const hidden = amount > 0 ? ["What's left on the table", "Your options, and what each one gets back"] : PREVIEW_LINES[moduleKey] || ["Where you stand", "What each option is worth"];
  const cta = amount > 0 ? "Show me where it's going" : "Show me";

  const label = LABEL_CAPS;
  const primary = disabled => primaryButtonStyle({ size: "regular", disabled });

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
          <div style={{fontSize:"16px",color:TEXT,fontWeight:600,marginTop:"10px"}}>{mod.amountIsLumpSum ? "by the time they're 18, our estimate" : "a year at stake, our estimate on your figures"}</div>
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
          <Subscribe moduleKey={moduleKey} returnTo={returnTo} title={meta?.title || moduleKey} icon={meta?.icon} d={d} amount={amount} lumpSum={!!mod?.amountIsLumpSum} onLeaveEmail={onLeaveEmail}/>
        </PaywallSheet>
      )}

      {ask.kind === "free" && (
        <>
          {ask.invite && <div style={{fontSize:"14px",color:TEXT,fontWeight:600,marginBottom:"10px"}}>Unlocked for free with your friend's invite.</div>}
          {ask.bonus && <div style={{fontSize:"14px",color:TEXT,fontWeight:600,marginBottom:"10px"}}>Free: nothing needed changing in {MODULE_META.find(mm => mm.key === ask.bonus)?.title || "your last module"}.</div>}
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
  taxTrap: ["What the £100k trap costs you", "What getting back under £100k is worth"],
};

// The first answer, for their email: one field, and whether they'd like to
// hear from Candid. The email also goes on their row (unlockPatch).
function EmailUnlock({ d, cta, primary, confirm, onUnlock }) {
  const [email, setEmail] = useState(d.email || "");
  const [alerts, setAlerts] = useState(false);
  const check = useEmailCheck("unlock");
  const errorId = useId();
  const submit = async e => {
    e.preventDefault();
    if (check.busy) return;
    const ok = await check.run(email, confirm);
    if (ok) onUnlock({ email: ok.email, callOk: alerts });
  };
  return (
    <form onSubmit={submit}>
      <div style={{fontSize:"15px",color:TEXT,fontWeight:600,lineHeight:1.4}}>Add your email to see your answer.</div>
      <div style={{fontSize:"13px",color:MUT,lineHeight:1.45,margin:"4px 0 10px"}}>{EMAIL_WHY}</div>
      {invitedHere() && <div style={{fontSize:"13px",color:MUT,lineHeight:1.45,margin:"-4px 0 10px"}}>Invited by a friend: your second module is unlocked for free.</div>}
      <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" aria-label="Email"
        aria-invalid={!!check.error} aria-describedby={check.error ? errorId : undefined}
        style={{width:"100%",boxSizing:"border-box",border:`1.5px solid ${FIELD_BORDER}`,borderRadius:"100px",padding:"14px 18px",fontSize:"16px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE}}/>
      <label style={{display:"flex",alignItems:"flex-start",gap:"10px",margin:"12px 2px 16px",fontSize:"13px",color:TEXT,lineHeight:1.45,cursor:"pointer"}}>
        <input type="checkbox" checked={alerts} onChange={e => setAlerts(e.target.checked)} style={{marginTop:"2px",accentColor:G}}/>
        Yes, email me when something changes: a better rate, a Budget change, or an allowance about to go unused.
      </label>
      <button type="submit" disabled={check.busy} style={primary(check.busy)}>{check.busy ? "Checking…" : cta}</button>
      {check.error && <div id={errorId} role="alert" style={{fontSize:"12.5px",color:ERROR_TEXT,marginTop:"8px",textAlign:"center"}}>{check.error}</div>}
      <DidYouMean suggestion={check.suggestion} onUse={to => check.use(to, setEmail)}/>
      <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"10px 0 0",textAlign:"center"}}>We'll email a link to confirm it's yours. No spam, and never shared. <a href="/privacy.html" target="_blank" rel="noreferrer" style={{color:MUT}}>Privacy policy</a></p>
    </form>
  );
}

// The paywall as a card floating in the middle of the screen, over the
// locked page, which stays in view behind it, dimmed. Laid out like the £100k
// trap's Plan ahead card: a pale blue half repeating the module's £ figure
// (it covers the one on the page), then a white half. Over the tab bar
// and the Assist button (4500), under Assist's own panel. Closing goes back
// to the modules.
function PaywallSheet({ children, returnTo = null }) {
  const navigate = useNavigate();
  const close = () => navigate(returnTo ? `/app/module/${returnTo}` : "/app/modules");
  // Focus moves into the card, stays there, and Escape closes it.
  const boxRef = useRef(null);
  useDialogFocus(boxRef, { onEscape: close });
  return (
    <div style={{position:"fixed",inset:0,zIndex:4600,display:"flex",flexDirection:"column",justifyContent:"center",padding:"16px",boxSizing:"border-box"}}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
        style={{position:"absolute",inset:0,background:"rgba(22,47,36,0.28)",backdropFilter:"blur(2px)",WebkitBackdropFilter:"blur(2px)"}}/>
      <motion.div ref={boxRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Subscribe to Candid"
        initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 340, damping: 30 }}
        style={{position:"relative",background:WHITE,border:`2px solid ${CTA_BLUE}`,borderRadius:"20px",boxShadow:"0 18px 50px rgba(22,47,36,0.28)",maxHeight:"calc(100dvh - 32px)",overflowY:"auto",
          maxWidth:"440px",width:"100%",margin:"0 auto",boxSizing:"border-box"}}>
        <button type="button" onClick={close} aria-label="Close"
          style={{position:"absolute",top:"12px",right:"12px",display:"flex",alignItems:"center",justifyContent:"center",width:"30px",height:"30px",borderRadius:"50%",border:"none",background:"rgba(0,113,227,0.1)",color:CTA_BLUE,cursor:"pointer",padding:0}}>
          <X size={16} aria-hidden="true"/>
        </button>
        {children}
      </motion.div>
    </div>
  );
}

// Subscribing: what a subscription includes, then the two plans (PlanPicker,
// as on the crown's sheet and the £100k card) and Stripe's own checkout
// page. Below, a way back in for someone already subscribed (Google or an
// emailed link), and a way to hear about rate changes without subscribing
// (Google or an email).
function Subscribe({ moduleKey, title, icon, d, amount, lumpSum, onLeaveEmail, returnTo = null }) {
  const navigate = useNavigate();
  const backTitle = returnTo ? MODULE_META.find(mm => mm.key === returnTo)?.title : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [panel, setPanel] = useState(null); // "restore" | "alerts"
  const [email, setEmail] = useState(d.email || "");
  const [done, setDone] = useState(null);
  const [soonOpen, setSoonOpen] = useState(false);
  const check = useEmailCheck("paywall");
  const errorId = useId();
  useEffect(() => { posthog.capture("paywall_shown", { module: moduleKey }); }, [moduleKey]);

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

  // Google: signs in here (making an account from the sign-in panel),
  // reloading so the app opens with their saved answers; or, for alerts,
  // gives the email, already confirmed. Signed in without a subscription,
  // the paywall stays.
  const withGoogle = async credential => {
    const g = await signInWithGoogle(credential, panel === "alerts" ? referralCode() : null, { open: panel === "restore" });
    // Signed in, from either panel: reopened with their saved answers,
    // before what's in memory can be saved over them.
    if (g.outcome === "signed-in") { posthog.capture("signed_in", { how: "google", outcome: g.outcome, from: "paywall" }); window.location.reload(); return; }
    onLeaveEmail?.(g.email); setDone("alerts-google");
  };

  const link = { background:"none", border:"none", padding:0, minHeight:"44px", color:G, fontSize:"12.5px", fontWeight:700, fontFamily:"inherit", cursor:"pointer" };
  const fine = { color:MUT, textDecoration:"underline", whiteSpace:"nowrap" };
  return (
    <div>
      <div style={{background:CTA_WASH,padding:"20px 20px 18px"}}>
        <Worth title={title} icon={icon} amount={amount} lumpSum={lumpSum}/>
        {returnTo && (
          <button type="button" onClick={() => navigate(`/app/module/${returnTo}`)} style={{width:"100%",marginTop:"12px",background:WHITE,color:G,border:"1.5px solid rgba(0,113,227,0.35)",borderRadius:"14px",padding:"11px 14px",fontFamily:"inherit",cursor:"pointer",textAlign:"left"}}>
            <span style={{display:"block",fontSize:"14px",fontWeight:700}}>Back to {backTitle}</span>
            <span style={{display:"block",fontSize:"12px",color:MUT,marginTop:"2px"}}>Your {backTitle?.toLowerCase()} answer now uses these figures. This {title.toLowerCase()} answer is part of a subscription.</span>
          </button>
        )}
      </div>
      <div style={{padding:"18px 20px 20px"}}>
      {/* What's included today, as the £100k card's moments: a blue dot on
          a line for each. */}
      <div style={listHead}>What you get from Candid</div>
      <ul style={{listStyle:"none",margin:"12px 0 0",padding:0}}>
        {INCLUDED.map(([name, line], i) => {
          const last = i === INCLUDED.length - 1;
          return (
            <li key={name} style={{display:"flex",gap:"14px"}}>
              <span aria-hidden="true" style={{display:"flex",flexDirection:"column",alignItems:"center",width:"14px",flexShrink:0}}>
                <span style={{width:"14px",height:"14px",borderRadius:"50%",background:CTA_BLUE,flexShrink:0,marginTop:"2px"}}/>
                {!last && <span style={{flex:1,width:"2px",background:"rgba(0,113,227,0.3)"}}/>}
              </span>
              <span style={{paddingBottom: last ? 0 : "14px"}}>
                <span style={{display:"block",fontSize:"14px",fontWeight:700,color:TEXT}}>{name}</span>
                <span style={{display:"block",fontSize:"12.5px",color:MUT,lineHeight:1.45,marginTop:"2px"}}>{line}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div style={{marginTop:"18px"}}>
        <PlanPicker d={d} module={moduleKey} from="paywall"/>
      </div>
      {/* The other way in: a free month for inviting a friend
          (InviteFriends.jsx), opened here. Outlined, so Subscribe is the one
          filled button. */}
      {validEmail(d.email) && (
        <button type="button" aria-expanded={panel === "invite"} onClick={() => { setPanel(p => p === "invite" ? null : "invite"); setDone(null); setError(null); check.clear(); }}
          style={{...primaryButtonStyle({ size: "regular", outline: true }),marginTop:"10px"}}>
          Invite a friend, get a free month
        </button>
      )}
      {panel === "invite" && <div style={{marginTop:"14px"}}><InviteFriends d={d} source="paywall" bare/></div>}
      {/* The terms and the guidance-not-advice line in one, each linked to
          the full page. */}
      <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"10px 0 0",textAlign:"center"}}>
        Cancel anytime · 14-day refund · <a href="/terms.html" target="_blank" rel="noreferrer" style={fine}>Terms</a> · <a href="/what-candid-is" target="_blank" rel="noreferrer" style={fine}>Guidance, not advice</a>
      </p>

      <div style={{display:"flex",justifyContent:"center",flexWrap:"wrap",columnGap:"18px",rowGap:"0",marginTop:"4px"}}>
        <button type="button" style={link} onClick={() => { setPanel(p => p === "restore" ? null : "restore"); setDone(null); setError(null); check.clear(); }}>Already have an account? Sign in</button>
        <button type="button" style={link} onClick={() => { setPanel(p => p === "alerts" ? null : "alerts"); setDone(null); setError(null); check.clear(); }}>Get rate alerts</button>
      </div>
      {panel && panel !== "invite" && (
        done ? (
          <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"14px 0 0",textAlign:"center"}}>
            {done === "restore" ? "A sign-in link is on its way. Open it on this device." : done === "alerts-google" ? "Thanks. We'll email you when you could be keeping more." : "Thanks. Use the link we've just emailed to confirm it's you, and we'll email you when you could be keeping more."}
          </p>
        ) : (
          <form onSubmit={submitEmail} style={{marginTop:"14px"}}>
            <GoogleButton source={panel === "restore" ? "paywall_restore" : "paywall_alerts"} onCredential={withGoogle} divider/>
            <div style={{fontSize:"13px",color:TEXT,marginBottom:"8px"}}>
              {panel === "restore" ? "Enter your account's email, and we'll send you a sign-in link." : "We'll email you when you could be keeping more: a better rate, or an allowance going unused."}
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" aria-label="Email"
                aria-invalid={!!(error || check.error)} aria-describedby={error || check.error ? errorId : undefined}
                style={{flex:1,minWidth:0,boxSizing:"border-box",border:`1.5px solid ${FIELD_BORDER}`,borderRadius:"100px",padding:"12px 16px",fontSize:"16px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE}}/>
              <button type="submit" disabled={busy || check.busy} style={{background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"0 16px",fontSize:"14px",fontWeight:700,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap"}}>
                {panel === "restore" ? "Send link" : "Sign up"}
              </button>
            </div>
            {(error || check.error) && <div id={errorId} role="alert" style={{fontSize:"12px",color:ERROR_TEXT,margin:"6px 0 0 6px"}}>{error || check.error}</div>}
            {panel === "alerts" && <DidYouMean suggestion={check.suggestion} onUse={to => check.use(to, setEmail)}/>}
            {panel === "alerts" && <p style={{fontSize:"11.5px",color:MUT,margin:"8px 0 0"}}>Unsubscribe any time. <a href="/privacy.html" target="_blank" rel="noreferrer" style={{color:MUT}}>Privacy policy</a></p>}
          </form>
        )
      )}

      {/* What's being built, folded away at the foot and kept apart from
          what's included, so nothing not yet built reads as part of what's
          paid for. */}
      <div style={{borderTop:"1px solid rgba(22,47,36,0.1)",marginTop:"12px",paddingTop:"4px"}}>
        <button type="button" onClick={() => setSoonOpen(o => !o)} aria-expanded={soonOpen}
          style={{...listHead,background:"none",border:"none",padding:0,minHeight:"44px",margin:"0",display:"inline-flex",alignItems:"center",gap:"4px",cursor:"pointer",fontFamily:"inherit"}}>
          Coming soon<ChevronDown size={13} style={{transform:soonOpen ? "rotate(180deg)" : "none",transition:"transform 0.2s"}}/>
        </button>
        {soonOpen && (
          <ul style={listStyle}>
            {COMING_SOON.map(([name, line]) => (
              <li key={name} style={itemStyle}>
                <span><span style={{fontWeight:700,color:MUT}}>{name}</span><span style={{display:"block",fontSize:"12.5px",color:MUT,marginTop:"1px"}}>{line}</span></span>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}

// What a subscription includes, beyond the free figures: only what's there
// today, led by what keeps going after the first look (a subscription is
// for staying current, not for more answers). The options in each gated
// module (unlock.js SCORED_MODULES) and Assist on them; the figures worked
// out again on each day's rates (api/rates.js); the emails (api/alerts.js),
// once they're being sent, the same setting that turns sending on. Signing
// in on other devices isn't here: accounts are free (Account.jsx).
const ALERTS_LIVE = import.meta.env.VITE_ALERTS_LIVE === "1";
// The alerts are what api/alerts.js sends (rates, tax-year end, bonus, new
// tax year) and the Sunday email's policy changes (weekly.js); student loan
// and mortgage changes stay in COMING_SOON until they're sent.
const INCLUDED = [
  ALERTS_LIVE ? ["Live updates when things change", "An email when something changes that's worth another look: a better savings rate, Budget changes that affect you, allowances about to go unused as the tax year ends, and what a bonus could mean before it lands."] : null,
  ["Kept up to date", "Your savings checked against each day's best rates, and every figure worked out again whenever you update your pay or savings."],
  ["Your options in every module", "Why each figure is what it is, and what each option is worth, across Pension, Cash, Investments, Student Loan and Kids & family."],
  ["Candid Assist", "Questions about your own numbers, answered inside every module."],
].filter(Boolean);
// Being built, with no dates promised. Something moves up to INCLUDED only
// once it's live for subscribers.
const COMING_SOON = [
  ["Automated account switching", "Hands-free admin for opening and moving ISAs and savings accounts."],
  ["Open Banking integration", "Connect your accounts for a live, unified view of your net worth."],
  ["More live updates", "Student loan repayment terms and mortgage deals, when they change."],
  ["Savings and goal planner", "Dynamic reviews of how much you could save and invest."],
  ["Tax trap and low-rate alerts", "Warnings for stealth tax bands, policy shifts and missed yield."],
  ["New expansion modules", "Household finances, children's accounts, property and mortgages, and inheritance."],
];
// The £100k card's heading: a touch bolder and wider than LABEL_CAPS.
const listHead = { ...LABEL_CAPS, fontWeight:700, letterSpacing:"0.1em" };
const listStyle = { listStyle:"none", padding:0, margin:"0 0 6px", display:"flex", flexDirection:"column", gap:"8px" };
const itemStyle = { display:"flex", gap:"8px", alignItems:"flex-start", fontSize:"13.5px", lineHeight:1.35 };

// What this module is worth against what Candid costs a year: "3x" rounded
// down, so it never overstates; "more than" under 2x. Lump sums (by 18) and
// small amounts just show the figure; nothing found, just the module. The
// figure sits in a white box under the module's name, as the £100k card's
// stake does.
function Worth({ title, icon: Icon, amount, lumpSum }) {
  const heading = <h2 style={{margin:"0 32px 0 0",fontSize:"20px",lineHeight:1.25,fontWeight:700,color:G}}>{title}</h2>;
  if (!(amount > 0)) return (
    <div>
      {heading}
      <p style={{margin:"4px 0 0",fontSize:"13.5px",lineHeight:1.5,color:TEXT}}>Candid keeps working between visits, on your own figures.</p>
    </div>
  );
  const cost = PLANS.yearly.amount;
  const times = Math.floor(amount / cost);
  const compare = lumpSum || amount <= cost ? null
    : times >= 2 ? `${times}x what Candid costs` : "more than Candid costs";
  return (
    <div>
      {heading}
      <div style={{marginTop:"14px",display:"flex",gap:"12px",alignItems:"flex-start",background:WHITE,border:"1.5px solid rgba(0,113,227,0.25)",borderRadius:"14px",padding:"14px"}}>
        {Icon && <Icon size={22} color={CTA_BLUE} aria-hidden="true" style={{flexShrink:0,marginTop:"2px"}}/>}
        <div>
          <div style={{fontFamily:SERIF,fontWeight:700,fontSize:"24px",lineHeight:1.1,color:G}}>{fmt(amount)}</div>
          <div style={{fontSize:"13px",lineHeight:1.45,marginTop:"4px",color:TEXT}}>
            {lumpSum ? "by the time they're 18, our estimate" : "a year, our estimate"}{compare && <b> · {compare}</b>}
          </div>
        </div>
      </div>
    </div>
  );
}
