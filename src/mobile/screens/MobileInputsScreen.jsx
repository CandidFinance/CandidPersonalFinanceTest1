import posthog from "posthog-js";
import InviteFriends from "../InviteFriends.jsx";
import { TAB_BAR_TOP } from "../MobileTabBar.jsx";
import { referralCode } from "../../lib/referral.js";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Mail, User } from "lucide-react";
import { G, WHITE, MUT, TEXT, ERROR_TEXT, CTA_BLUE, SANS, BAND_STOPS, TILE_KICKER } from "../../design-tokens.js";
import { MODULE_META } from "../../lib/moduleStatus.js";
import AboutYouFields from "../onboarding/AboutYouFields.jsx";
import ModuleInputsForm from "./ModuleInputsForm.jsx";
import { useEmailCheck, DidYouMean, EMAIL_WHY } from "../emailCheckForm.jsx";
import { requestEmailStatus, validEmailShape } from "../../lib/emailCheck.js";
import { SCORED_MODULES, scoredInView, loanSavingsIn, loanPensionChecked } from "../../lib/appEntry.js";
import { briefQuestions } from "../../lib/moduleGuide.js";
import { ABOUT_FIELDS, tileCounts, firstGap, usedFrom } from "../../lib/inputState.js";
import { QUESTION_HEADING, QUESTION_HINT, HAIRLINE, FILLED, EMPTY_FILL, EMPTY_CLASS } from "../fieldState.js";

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
// thing, so a slider let go of over empty space stays open; nor one while a
// pop-out is open (TilePopover), which that tap closes instead.
// Each tile's header counts its estimates and gaps (inputState.js), each
// shown on its answer (fieldState.js). Arriving with `field` (?field=), or
// from a module (`open`) without one, brings that answer, or the tile's
// first estimate or gap, to the middle of the screen with a brief ring.
const INTERACTIVE = "button,input,select,textarea,a,label,[role],[contenteditable],svg";
function onSomething(target, container) {
  for (let el = target; el && el !== container; el = el.parentElement) {
    if (el.matches?.(INTERACTIVE)) return true;
    const cursor = getComputedStyle(el).cursor;
    if (cursor === "pointer" || cursor === "grab" || cursor === "text") return true;
  }
  return false;
}

export default function MobileInputsScreen({ d, m, set, open, field = null, onStartModule, onOpenModule, onEmailChange }) {
  const pressedOn = useRef(false);
  const answered = SCORED_MODULES.filter(k => (d.selectedModules || []).includes(k));
  // Cash and Pension answered only as far as Student loan needs
  // (its short route): those answers, and only those, to change here.
  const partly = SCORED_MODULES.filter(k => !answered.includes(k) && ((k === "cash" && loanSavingsIn(d)) || (k === "pension" && loanPensionChecked(d))));
  const notYet = scoredInView(d).filter(k => !answered.includes(k) && !partly.includes(k));
  const shown = [...answered, ...partly];
  // From Home's checklist (`open` "email"): the email on its own at the top,
  // picked out in blue, every tile closed under it.
  const emailFirst = open === "email";
  // An About-you figure opens About you, whichever module the link came from.
  const [openKey, setOpenKey] = useState(ABOUT_FIELDS.includes(field) ? "about"
    : [...answered, "cash", "pension", "about"].includes(open) ? open : emailFirst ? null : "about");
  const refs = useRef({});
  const ctx = { d, m, regionalRows: null };
  const questionsFor = key => partly.includes(key) ? briefQuestions(key, "studentLoan") || [] : undefined;

  // An answer in an open tile: to the middle of the screen, with a ring
  // that fades; or with `keep` (from another module's link), to the top of
  // the first of the rings the tile draws round the answers that module
  // works from (ModuleInputsForm `linked`).
  const bringIn = (el, want, behavior, keep = false) => {
    if (keep) {
      const ring = el.querySelector("[data-ring]");
      if (!ring) return null;
      ring.scrollIntoView({ behavior, block: "start" });
      return () => {};
    }
    const target = want && el.querySelector(`[data-q~="${CSS.escape(want)}"]`);
    if (!target) return null;
    target.scrollIntoView({ behavior, block: "center" });
    target.classList.add("q-flash");
    const done = setTimeout(() => target.classList.remove("q-flash"), 1400);
    return () => clearTimeout(done);
  };
  useEffect(() => {
    const el = openKey && refs.current[openKey];
    const want = el && (field || (open === openKey ? firstGap(openKey, ctx, questionsFor(openKey), answered) : null));
    const brought = el && bringIn(el, want, "instant");
    if (brought) return brought;
    if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  // From a link in one tile to the answer in another (ModuleInputsForm
  // `onJump`): that tile opened, the answer brought in with the ring kept
  // on it, and a way back (`back`) to the link they came from.
  const [jump, setJump] = useState(null);
  const [back, setBack] = useState(null);
  useEffect(() => {
    const el = jump && refs.current[jump.key];
    if (!el) return;
    const brought = bringIn(el, jump.field, "smooth", jump.keep);
    if (brought) return brought;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [jump]);
  const onJump = (key, to, from) => { setOpenKey(key); setJump({ key, field: to, keep: true, from }); setBack({ key: from, link: `link-${key}` }); };
  // While there: the answers the module they came from works from, in green.
  const linkedIn = key => jump?.keep && jump.key === key ? new Set(usedFrom(jump.from, key)) : null;
  const goBack = () => { setOpenKey(back.key); setJump({ key: back.key, field: back.link }); setBack(null); };
  // Opening or closing a tile themselves: the jump is over.
  const toggle = key => { setOpenKey(k => k === key ? null : key); setJump(null); setBack(null); };

  // "2 estimated · 1 to add": nothing once every answer is their own.
  const countsLine = key => {
    const { estimate, empty } = tileCounts(key, ctx, questionsFor(key), answered);
    return [estimate && `${estimate} estimated`, empty && `${empty} to add`].filter(Boolean).join(" · ");
  };

  const title = key => key === "about" ? "About you" : MODULE_META.find(mm => mm.key === key)?.title || key;
  const icon = key => key === "about" ? User : MODULE_META.find(mm => mm.key === key)?.icon;
  const tile = { background:WHITE, border:"1px solid rgba(22,47,36,0.1)", borderRadius:"16px" };
  const label = { fontSize:"11px", fontWeight:600, color:MUT, letterSpacing:"0.09em", textTransform:"uppercase" };
  const iconBox = key => {
    const Icon = icon(key);
    return (
      <div style={{width:"34px",height:"34px",borderRadius:"9px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        {Icon && <Icon size={16} color={G}/>}
      </div>
    );
  };

  return (
    <div className="inputs-slick" style={{"--pill-height":"37px"}}>
      <style>{SLICK_CSS}</style>
      <h1 style={{...TILE_KICKER,fontFamily:SANS,margin:"0 0 6px"}}>Your finances</h1>
      <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"0 0 20px"}}>Change anything here and your figures update straight away.</p>
      {emailFirst && <EmailField d={d} onEmailChange={onEmailChange} spotlight/>}

      <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
        {["about", ...shown].map(key => {
          const isOpen = openKey === key;
          const isModule = key !== "about";
          const isPartly = partly.includes(key);
          const sub = [isPartly && "What your student loan answer uses", countsLine(key)].filter(Boolean).join(" · ");
          return (
            <div key={key} ref={el => { refs.current[key] = el; }} style={{...tile,scrollMarginTop:"80px"}}>
              <button type="button" onClick={() => toggle(key)} aria-expanded={isOpen}
                style={{width:"100%",display:"flex",alignItems:"center",gap:"12px",background:"none",border:"none",padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                {iconBox(key)}
                <span style={{flex:1,minWidth:0}}>
                  <span style={{...TILE_KICKER,display:"block"}}>{title(key)}</span>
                  {sub && <span style={{display:"block",fontSize:"12px",color:MUT,marginTop:"2px"}}>{sub}</span>}
                </span>
                <ChevronDown size={18} color={MUT} style={{transform:isOpen ? "rotate(180deg)" : "none",transition:"transform 0.2s"}}/>
              </button>
              {isOpen && (
                <div style={{padding:"4px 18px 18px",borderTop:"1px solid rgba(22,47,36,0.08)"}}
                  onPointerDown={e => { pressedOn.current = onSomething(e.target, e.currentTarget) || !!e.currentTarget.querySelector("[role=dialog]"); }}
                  onClick={e => {
                    if (pressedOn.current || onSomething(e.target, e.currentTarget)) return;
                    setOpenKey(null);
                    const top = refs.current[key]?.getBoundingClientRect().top;
                    if (top < 70) refs.current[key].scrollIntoView({ behavior: "smooth", block: "start" });
                  }}>
                  <div style={{paddingTop:"14px"}}>
                    {isModule
                      ? <ModuleInputsForm moduleKey={key} d={d} m={m} set={set} brief={isPartly} owners={answered} order={shown} onJump={onJump} linked={linkedIn(key)}/>
                      : <AboutYouFields d={d} set={set} shown={shown} email={!emailFirst && <EmailField d={d} onEmailChange={onEmailChange}/>}/>}
                  </div>
                  {isModule && (
                    <>
                      {/* The way back to the module's page, with the new figures:
                          for one answered only as far as Student loan needs, to
                          Student loan, and the rest of its questions after. */}
                      <button type="button" onClick={() => onOpenModule(isPartly ? "studentLoan" : key)}
                        style={{marginTop:"22px",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
                        Back to {title(isPartly ? "studentLoan" : key)}<ChevronRight size={16}/>
                      </button>
                      {isPartly && (
                        <button type="button" onClick={() => onStartModule(key)}
                          style={{marginTop:"10px",width:"100%",background:"none",border:"none",padding:"10px",fontSize:"13px",fontWeight:700,color:G,fontFamily:"inherit",cursor:"pointer"}}>
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

      {back && (() => {
        const Arrow = shown.indexOf(back.key) < shown.indexOf(jump?.key) ? ArrowUp : ArrowDown;
        return (
          <button type="button" onClick={goBack}
            style={{position:"fixed",left:"50%",transform:"translateX(-50%)",bottom:`calc(34px + ${TAB_BAR_TOP})`,zIndex:30,display:"flex",alignItems:"center",gap:"8px",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"10px 18px",fontSize:"13px",fontWeight:700,fontFamily:"inherit",cursor:"pointer",boxShadow:"0 6px 20px rgba(22,47,36,0.25)",whiteSpace:"nowrap"}}>
            <Arrow size={15} aria-hidden="true"/>Return to {title(back.key)}
          </button>
        );
      })()}

      {notYet.length > 0 && (
        <>
          <div style={{...label,margin:"24px 0 10px"}}>Not started</div>
          <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
            {notYet.map(key => (
              <button key={key} type="button" onClick={() => onStartModule(key)}
                style={{...tile,display:"flex",alignItems:"center",gap:"12px",padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",width:"100%"}}>
                {iconBox(key)}
                <span style={{...TILE_KICKER,flex:1}}>{title(key)}</span>
                <span style={{fontSize:"12px",fontWeight:700,color:G}}>Start</span>
                <ChevronRight size={16} color={MUT}/>
              </button>
            ))}
          </div>
        </>
      )}

      <InviteFriends d={d} source="edit_inputs"/>
      <ContactSupport/>
    </div>
  );
}

// The page on the light band's pale slick (ScreenBand), edge to edge on a
// phone, up under the top inset and down past the tab bar; a rounded panel
// where the column is narrower than the screen. The margins undo
// MobileLayout's column padding.
const [SA, SB, SC] = BAND_STOPS.light;
const SLICK_CSS = `
.inputs-slick { margin: calc(-16px - env(safe-area-inset-top, 0px)) -20px -120px; padding: calc(16px + env(safe-area-inset-top, 0px)) 20px 120px; min-height: 100vh; min-height: 100dvh; box-sizing: border-box; background: linear-gradient(160deg, ${SA} 0%, ${SB} 50%, ${SC} 100%); }
@media (min-width: 581px) { .inputs-slick { margin: 0; padding: 22px 20px; min-height: 0; border-radius: 28px; } }
`;

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
      <div style={TILE_KICKER}>Something not working?</div>
      <div style={{fontSize:"12px",color:MUT,marginTop:"3px"}}>Email {SUPPORT_EMAIL} and we'll reply.</div>
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
    const ok = await check.run(draft, { name: d.name || null, ...(referralCode() ? { ref: referralCode() } : {}) });
    if (!ok) return;
    if (!same(ok.email, d.email) || (spotlight && !d.alertsOptIn)) onEmailChange?.(ok.email, spotlight);
    setDraft(ok.email);
    setLink(ok);
  };
  const fieldLabel = { fontSize:"11px", fontWeight:600, color:MUT, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:"8px", display:"block" };
  const accent = spotlight ? CTA_BLUE : G;
  return (
    <div style={spotlight ? {background:"#EAF3FE",border:`1.5px solid ${CTA_BLUE}`,borderRadius:"16px",padding:"18px",marginBottom:"20px"} : {}}>
      {spotlight && <h2 style={{...TILE_KICKER,fontFamily:SANS,margin:"0 0 6px",lineHeight:1.25}}>Email alerts</h2>}
      {/* In About you, laid out as its other answers (fieldState.js): the
          question, the field, the note under it. */}
      <label htmlFor="inputs-email" style={spotlight ? fieldLabel : {...QUESTION_HEADING,display:"block"}}>Email</label>
      {spotlight && <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"-2px 0 8px"}}>{EMAIL_WHY}</p>}
      <input ref={inputRef} id="inputs-email" type="email" className={!spotlight && !draft ? EMPTY_CLASS : undefined} autoComplete="email" value={draft} placeholder="your@email.com"
        onChange={e => { setDraft(e.target.value); setLink(null); check.clear(); }}
        style={{width:"100%",boxSizing:"border-box",border:spotlight ? `1.5px solid ${CTA_BLUE}` : draft ? HAIRLINE : "1px solid transparent",borderRadius:"100px",padding:"7.5px 18px",fontSize:"15px",fontFamily:"inherit",color:TEXT,outline:"none",background:spotlight ? WHITE : draft ? FILLED : EMPTY_FILL}}/>
      {!spotlight && <p style={QUESTION_HINT}>{EMAIL_WHY}</p>}
      {link && !changed && <p role="status" style={{fontSize:"12px",color:TEXT,lineHeight:1.5,margin:"8px 0 0"}}>{outcome}</p>}
      {unconfirmed && <p role="status" style={{fontSize:"12px",color:TEXT,lineHeight:1.5,margin:"8px 0 0"}}>This email isn't confirmed yet.</p>}
      {(changed || unsent || unconfirmed) && (
        <>
          <button type="button" onClick={confirm} disabled={check.busy}
            style={{marginTop:"10px",width:"100%",background:accent,opacity:check.busy ? 0.5 : 1,color:WHITE,border:"none",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:700,fontFamily:"inherit",cursor:check.busy ? "default" : "pointer"}}>
            {check.busy ? "Checking…" : changed ? "Confirm this email" : unsent ? "Send the link again" : "Send a confirmation link"}
          </button>
          {changed && !check.error && !check.suggestion && <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"6px 0 0",textAlign:"center"}}>We'll send a link to confirm it's yours.</p>}
        </>
      )}
      {check.error && <div role="alert" style={{fontSize:"12px",color:ERROR_TEXT,marginTop:"8px",textAlign:"center"}}>{check.error}</div>}
      <DidYouMean suggestion={check.suggestion} onUse={to => check.use(to, setDraft)}/>
    </div>
  );
}
