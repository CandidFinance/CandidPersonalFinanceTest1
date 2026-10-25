import posthog from "posthog-js";
import { hasAccess, accessInfo, openBillingPortal, PLANS } from "../../lib/entitlement.js";
import SignInSetup, { switchAccount } from "../SignInSetup.jsx";
import InviteFriends from "../InviteFriends.jsx";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Mail, User } from "lucide-react";
import { G, WHITE, MUT, TEXT, SERIF, ERROR_TEXT, CTA_BLUE } from "../../design-tokens.js";
import { MODULE_META } from "../../lib/moduleStatus.js";
import AboutYouFields from "../onboarding/AboutYouFields.jsx";
import ModuleInputsForm from "./ModuleInputsForm.jsx";
import { useEmailCheck, DidYouMean, EMAIL_WHY } from "../emailCheckForm.jsx";
import { requestEmailStatus, validEmailShape } from "../../lib/emailCheck.js";
import { SCORED_MODULES, scoredInView, loanSavingsIn, loanPensionChecked } from "../../lib/appEntry.js";

// Edit inputs (/app/inputs): every answer on one page, so changing one
// figure is one tap away rather than a walk back through onboarding. About
// you and each answered module are tiles; a module's tile holds all of its
// questions as one form (ModuleInputsForm), so nothing needs the walk-through
// again. `open` opens that module's tile and scrolls to it (from a module
// page's Edit inputs); otherwise About you starts open. A module not
// answered yet starts its questions instead (`onStartModule`).
// `onOpenModule(key)` goes back to a module's page. `onEmailChange(email)`
// saves a new email, once it's passed its checks (EmailField); `alerts`
// true from the "Email alerts" panel, which turns them on.
// Tapping empty space in an open tile closes it, as on a phone, so its
// header doesn't need scrolling back to. Not a tap on anything that responds
// to one (a field, a pill, a slider, a link), nor one that started on such a
// thing, so a slider let go of over empty space stays open.
const INTERACTIVE = "button,input,select,textarea,a,label,[role],[contenteditable],svg";
function onSomething(target, container) {
  for (let el = target; el && el !== container; el = el.parentElement) {
    if (el.matches?.(INTERACTIVE)) return true;
    const cursor = getComputedStyle(el).cursor;
    if (cursor === "pointer" || cursor === "grab" || cursor === "text") return true;
  }
  return false;
}

export default function MobileInputsScreen({ d, m, set, open, onStartModule, onOpenModule, onEmailChange }) {
  const pressedOn = useRef(false);
  const answered = SCORED_MODULES.filter(k => (d.selectedModules || []).includes(k));
  // Cash & savings and Pension answered only as far as Student loan needs
  // (its short route): those answers, and only those, to change here.
  const partly = SCORED_MODULES.filter(k => !answered.includes(k) && ((k === "cash" && loanSavingsIn(d)) || (k === "pension" && loanPensionChecked(d))));
  const notYet = scoredInView(d).filter(k => !answered.includes(k) && !partly.includes(k));
  const shown = [...answered, ...partly];
  // From Home's checklist (`open` "email"): the email on its own at the top,
  // picked out in blue, every tile closed under it.
  const emailFirst = open === "email";
  const [openKey, setOpenKey] = useState([...answered, "cash", "pension"].includes(open) ? open : emailFirst ? null : "about");
  const refs = useRef({});

  useEffect(() => {
    const el = openKey && refs.current[openKey];
    if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const title = key => key === "about" ? "About you" : MODULE_META.find(mm => mm.key === key)?.title || key;
  const icon = key => key === "about" ? User : MODULE_META.find(mm => mm.key === key)?.icon;
  const tile = { background:WHITE, border:"1px solid rgba(22,47,36,0.1)", borderRadius:"16px" };
  const label = { fontSize:"10.5px", fontWeight:600, color:MUT, letterSpacing:"0.09em", textTransform:"uppercase" };
  const iconBox = key => {
    const Icon = icon(key);
    return (
      <div style={{width:"34px",height:"34px",borderRadius:"9px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        {Icon && <Icon size={16} color={G}/>}
      </div>
    );
  };

  return (
    <div>
      <h1 style={{fontFamily:SERIF,fontSize:"24px",color:G,fontWeight:700,margin:"0 0 6px"}}>Your inputs</h1>
      <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.5,margin:"0 0 20px"}}>Change anything here and your figures update straight away.</p>
      {emailFirst && <EmailField d={d} onEmailChange={onEmailChange} spotlight/>}

      <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
        {["about", ...shown].map(key => {
          const isOpen = openKey === key;
          const isModule = key !== "about";
          const isPartly = partly.includes(key);
          return (
            <div key={key} ref={el => { refs.current[key] = el; }} style={{...tile,scrollMarginTop:"80px"}}>
              <button type="button" onClick={() => setOpenKey(k => k === key ? null : key)} aria-expanded={isOpen}
                style={{width:"100%",display:"flex",alignItems:"center",gap:"12px",background:"none",border:"none",padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                {iconBox(key)}
                <span style={{flex:1,minWidth:0}}>
                  <span style={{display:"block",fontSize:"16px",fontWeight:700,color:TEXT}}>{title(key)}</span>
                  {isPartly && <span style={{display:"block",fontSize:"12px",color:MUT,marginTop:"2px"}}>What your student loan answer uses</span>}
                </span>
                <ChevronDown size={18} color={MUT} style={{transform:isOpen ? "rotate(180deg)" : "none",transition:"transform 0.2s"}}/>
              </button>
              {isOpen && (
                <div style={{padding:"4px 18px 18px",borderTop:"1px solid rgba(22,47,36,0.08)"}}
                  onPointerDown={e => { pressedOn.current = onSomething(e.target, e.currentTarget); }}
                  onClick={e => {
                    if (pressedOn.current || onSomething(e.target, e.currentTarget)) return;
                    setOpenKey(null);
                    const top = refs.current[key]?.getBoundingClientRect().top;
                    if (top < 70) refs.current[key].scrollIntoView({ behavior: "smooth", block: "start" });
                  }}>
                  <div style={{paddingTop:"14px"}}>
                    {isModule
                      ? <ModuleInputsForm moduleKey={key} d={d} m={m} set={set} brief={isPartly}/>
                      : <><AboutYouFields d={d} set={set}/>{!emailFirst && <EmailField d={d} onEmailChange={onEmailChange}/>}</>}
                  </div>
                  {isModule && (
                    <>
                      {/* The way back to the module's page, with the new figures:
                          for one answered only as far as Student loan needs, to
                          Student loan, and the rest of its questions after. */}
                      <button type="button" onClick={() => onOpenModule(isPartly ? "studentLoan" : key)}
                        style={{marginTop:"22px",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"13px",fontSize:"14.5px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
                        Back to {title(isPartly ? "studentLoan" : key)}<ChevronRight size={16}/>
                      </button>
                      {isPartly && (
                        <button type="button" onClick={() => onStartModule(key)}
                          style={{marginTop:"10px",width:"100%",background:"none",border:"none",padding:"8px",fontSize:"13.5px",fontWeight:700,color:G,fontFamily:"inherit",cursor:"pointer"}}>
                          Answer the rest of {title(key)}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {notYet.length > 0 && (
        <>
          <div style={{...label,margin:"24px 0 10px"}}>Not started</div>
          <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
            {notYet.map(key => (
              <button key={key} type="button" onClick={() => onStartModule(key)}
                style={{...tile,display:"flex",alignItems:"center",gap:"12px",padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",width:"100%"}}>
                {iconBox(key)}
                <span style={{flex:1,fontSize:"16px",fontWeight:700,color:TEXT}}>{title(key)}</span>
                <span style={{fontSize:"13px",fontWeight:700,color:G}}>Start</span>
                <ChevronRight size={16} color={MUT}/>
              </button>
            ))}
          </div>
        </>
      )}

      <Subscription/>
      <InviteFriends d={d} source="edit_inputs"/>
      <ContactSupport/>
    </div>
  );
}

// An email to the address in the terms and privacy policy (api/billing.js
// MAIL_REPLY_TO), started with the browser and the time it's tapped so a
// fault can be traced.
const SUPPORT_EMAIL = "admin@candid-finance.co.uk";
function supportHref() {
  const body = `What happened:


---
Sent from the Candid app, ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC
${navigator.userAgent}`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Candid support")}&body=${encodeURIComponent(body)}`;
}
function ContactSupport() {
  return (
    <div style={{marginTop:"28px",paddingTop:"16px",borderTop:"1px solid rgba(22,47,36,0.1)"}}>
      <div style={{fontSize:"14px",fontWeight:700,color:TEXT}}>Something not working?</div>
      <div style={{fontSize:"12.5px",color:MUT,marginTop:"3px"}}>Email {SUPPORT_EMAIL} and we'll reply.</div>
      <a href={`mailto:${SUPPORT_EMAIL}`} onClick={e => { e.currentTarget.href = supportHref(); posthog.capture("support_contact_clicked", { from: "edit_inputs" }); }}
        style={{display:"inline-flex",alignItems:"center",gap:"6px",padding:"8px 0 0",color:G,fontSize:"13px",fontWeight:700,textDecoration:"none"}}>
        <Mail size={15} color={G} aria-hidden="true"/>Contact support
      </a>
    </div>
  );
}

// Their email, in About you. A new one is only saved once it passes the
// same checks as the unlock form (emailCheckForm.jsx), from the button that
// also emails the link confirming it's theirs (api/email.js). One line
// says what happened to the link, in place of the button. The email they
// have already, if it isn't confirmed, gets a button to send its link;
// that's looked up again on coming back to the page, so a link used in
// another tab shows here. `spotlight`: on its own at the top of the page,
// filled light blue with a heading, the field ready to type in.
function EmailField({ d, onEmailChange, spotlight = false }) {
  const inputRef = useRef(null);
  useEffect(() => { if (spotlight) inputRef.current?.focus({ preventScroll: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, setDraft] = useState(d.email || "");
  const [link, setLink] = useState(null); // { email, sent }
  const [confirmed, setConfirmed] = useState(null); // d.email's: true, false, or null (not known)
  const check = useEmailCheck("inputs");
  useEffect(() => {
    setConfirmed(null);
    if (!validEmailShape(d.email)) return;
    let live = true;
    const look = () => requestEmailStatus(d.email.trim()).then(c => { if (live) setConfirmed(c); });
    const onShow = () => { if (document.visibilityState === "visible") look(); };
    look();
    document.addEventListener("visibilitychange", onShow);
    return () => { live = false; document.removeEventListener("visibilitychange", onShow); };
  }, [d.email]);
  const same = (a, b) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
  const changed = draft.trim() !== "" && !same(draft, d.email);
  // The link didn't go (a send that failed, or the server out of reach):
  // the email is saved, and the button stays, to try again.
  const unsent = link && !["sent", "sent recently", "confirmed already", "sent enough"].includes(link.sent);
  const unconfirmed = !changed && !link && confirmed === false;
  const outcome = !link ? null
    : confirmed === true || link.sent === "confirmed already" ? `${link.email} is confirmed.`
    : link.sent === "sent enough" ? `We've sent several links to ${link.email} already. Check your inbox and spam folder.`
    : unsent ? `${link.email} is saved, but the link didn't send. Try again shortly.`
    : `Link sent to ${link.email}. Open it to confirm it's yours. If it isn't there in a few minutes, check your spam folder.`;
  const confirm = async () => {
    if (check.busy) return;
    const ok = await check.run(draft, { name: d.name || null });
    if (!ok) return;
    if (!same(ok.email, d.email) || (spotlight && !d.alertsOptIn)) onEmailChange?.(ok.email, spotlight);
    setDraft(ok.email);
    setLink(ok);
  };
  const fieldLabel = { fontSize:"11px", fontWeight:600, color:MUT, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:"8px", display:"block" };
  const accent = spotlight ? CTA_BLUE : G;
  return (
    <div style={spotlight ? {background:"#EAF3FE",border:`1.5px solid ${CTA_BLUE}`,borderRadius:"16px",padding:"18px",marginBottom:"20px"} : {marginTop:"18px"}}>
      {spotlight && <h2 style={{fontFamily:SERIF,fontSize:"21px",color:G,fontWeight:700,margin:"0 0 6px",lineHeight:1.25}}>Email alerts</h2>}
      <label htmlFor="inputs-email" style={fieldLabel}>Email</label>
      <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"-2px 0 8px"}}>{EMAIL_WHY}</p>
      <input ref={inputRef} id="inputs-email" type="email" autoComplete="email" value={draft} placeholder="your@email.com"
        onChange={e => { setDraft(e.target.value); setLink(null); check.clear(); }}
        style={{width:"100%",boxSizing:"border-box",border:spotlight ? `1.5px solid ${CTA_BLUE}` : "1.5px solid rgba(22,47,36,0.18)",borderRadius:"100px",padding:"13px 18px",fontSize:"15px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE}}/>
      {link && !changed && <p role="status" style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,margin:"8px 0 0"}}>{outcome}</p>}
      {unconfirmed && <p role="status" style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,margin:"8px 0 0"}}>This email isn't confirmed yet.</p>}
      {(changed || unsent || unconfirmed) && (
        <>
          <button type="button" onClick={confirm} disabled={check.busy}
            style={{marginTop:"10px",width:"100%",background:accent,opacity:check.busy ? 0.5 : 1,color:WHITE,border:"none",borderRadius:"100px",padding:"12px",fontSize:"14px",fontWeight:700,fontFamily:"inherit",cursor:check.busy ? "default" : "pointer"}}>
            {check.busy ? "Checking…" : changed ? "Confirm this email" : unsent ? "Send the link again" : "Send a confirmation link"}
          </button>
          {changed && !check.error && !check.suggestion && <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"6px 0 0",textAlign:"center"}}>We'll send a link to confirm it's yours.</p>}
        </>
      )}
      {check.error && <div role="alert" style={{fontSize:"12.5px",color:ERROR_TEXT,marginTop:"8px",textAlign:"center"}}>{check.error}</div>}
      <DidYouMean suggestion={check.suggestion} onUse={to => check.use(to, setDraft)}/>
    </div>
  );
}

// For a subscriber: their plan, Stripe's page to change or cancel it, and
// their ways to sign in on another device (SignInSetup).
// A "comp" plan (a free row added by hand in `subscriptions`, for testing)
// and a "referral" one (free months from inviting friends, server/
// referrals.js) have no Stripe customer, so no portal; free months end,
// never renew.
function Subscription() {
  const [error, setError] = useState(null);
  if (!hasAccess()) return null;
  const a = accessInfo();
  const referral = a.plan === "referral";
  const comp = a.plan === "comp" || referral;
  const planLabel = referral ? "free months from invites" : a.plan === "comp" ? "complimentary" : PLANS[a.plan]?.label.toLowerCase();
  const until = a.periodEnd ? new Date(a.periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  return (
    <div style={{marginTop:"28px",paddingTop:"16px",borderTop:"1px solid rgba(22,47,36,0.1)"}}>
      <div style={{fontSize:"14px",fontWeight:700,color:TEXT}}>Candid subscription{planLabel ? `, ${planLabel}` : ""}</div>
      <div style={{fontSize:"12.5px",color:MUT,marginTop:"3px"}}>{a.email}{until ? ` · ${a.cancelling || referral ? "ends" : "renews"} ${until}` : ""}</div>
      <div style={{display:"flex",gap:"20px"}}>
        {!comp && <button type="button" onClick={() => openBillingPortal().catch(e => setError(e.message))}
          style={{background:"none",border:"none",padding:"8px 0 0",color:G,fontSize:"13px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
          Manage subscription
        </button>}
        <button type="button" onClick={() => switchAccount("edit_inputs")}
          style={{background:"none",border:"none",padding:"8px 0 0",color:G,fontSize:"13px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
          Sign out
        </button>
      </div>
      {error && <div style={{fontSize:"12px",color:ERROR_TEXT}}>{error}</div>}
      <SignInSetup/>
    </div>
  );
}
