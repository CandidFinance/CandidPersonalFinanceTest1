import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import posthog from "posthog-js";
import { Bell, BookOpen, ChevronLeft, ChevronRight, CircleUser, Lock, SlidersHorizontal, X } from "lucide-react";
import { G, MUT, TEXT, WHITE, CREAM, ERROR_TEXT, FIELD_BORDER, LABEL_CAPS, PROGRESS_GREEN } from "../design-tokens.js";
import { accessInfo, accountSignIns, deleteAccount, hasAccess, openBillingPortal, setEmailAlerts, signedIn, PLANS } from "../lib/entitlement.js";
import { getConsent, setConsent } from "../lib/consent.js";
import { PAID_PLANS } from "../lib/weekly.js";
import { SignInMethods, switchAccount } from "./SignInSetup.jsx";
import { primaryButtonStyle } from "./onboarding/OnboardingShell.jsx";
import useDialogFocus, { useHidesAssist } from "./useDialogFocus.js";

// The Account button, top left on every app screen (Harvey, 30 Oct 2026),
// and the sheet it opens: a settings list, each row opening its own page
// in the sheet with a back arrow (Harvey, 30 Oct 2026, after Monzo's).
// Signed in, free or paid: the account card (Account settings: email, plan,
// Manage subscription, and the ways to sign in on another device), Privacy
// (analytics cookies), Notifications (Candid's emails on or off, through
// api/billing.js alerts-set), Legal documents, Edit your answers, Delete my
// data and account (api/billing.js delete-account, which waits for a paid
// subscription to be cancelled first), and Sign out. Signed out: sign in or
// create an account (src/site/SignInPage.jsx), Privacy and Legal documents.
export default function AccountButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label="Account" onClick={() => { setOpen(true); posthog.capture("account_opened", { signedIn: signedIn() }); }}
        style={{width:"30px",height:"30px",borderRadius:"50%",border:"none",background:"none",color:G,display:"flex",alignItems:"center",justifyContent:"center",padding:0,cursor:"pointer",flexShrink:0}}>
        <CircleUser size={24} strokeWidth={1.8} aria-hidden="true"/>
      </button>
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>{open && <AccountSheet key="account" onClose={() => setOpen(false)}/>}</AnimatePresence>, document.body)}
    </>
  );
}

const dateLong = iso => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// One line for the plan: free, a subscription and when it renews or ends,
// or a paid one that has ended (free months from invites that have run out
// leave a free account).
function planLine(a, subscribed) {
  if (subscribed) {
    const referral = a.plan === "referral";
    const label = referral ? "Free months from invites" : a.plan === "comp" ? "Complimentary subscription" : `${PLANS[a.plan]?.label || "Candid"} subscription`;
    return a.periodEnd ? `${label}, ${a.cancelling || referral ? "ends" : "renews"} ${dateLong(a.periodEnd)}` : label;
  }
  return PAID_PLANS.includes(a.plan) ? "Subscription ended" : "Free account";
}

const PAGE_TITLES = { account: "Account settings", privacy: "Privacy", notifications: "Notifications", legal: "Legal documents", delete: "Delete my data and account" };

// The list's look: white groups on the cream sheet, a hairline between rows.
const group = { background:WHITE, borderRadius:"16px", overflow:"hidden", marginTop:"14px" };
const rowStyle = { display:"flex", alignItems:"center", gap:"14px", width:"100%", minHeight:"56px", padding:"10px 16px", background:"none", border:"none", fontFamily:"inherit", fontSize:"15.5px", fontWeight:600, color:TEXT, textAlign:"left", cursor:"pointer", boxSizing:"border-box", textDecoration:"none" };
const hairline = { height:"1px", background:"rgba(22,47,36,0.08)", marginLeft:"16px" };
const iconTile = { width:"32px", height:"32px", borderRadius:"9px", background:"rgba(22,47,36,0.07)", color:G, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 };

// A row that opens a page, a link or an action. `Icon` in a tile at the
// left; `sub` a muted second line; a chevron at the right unless `bare`.
function Row({ Icon, label, sub, onClick, href, bare, color }) {
  const inner = (
    <>
      {Icon && <span style={iconTile}><Icon size={17} strokeWidth={2} aria-hidden="true"/></span>}
      <span style={{flex:1,minWidth:0}}>
        <span style={{display:"block",color:color || TEXT,overflowWrap:"anywhere"}}>{label}</span>
        {sub && <span style={{display:"block",fontSize:"13px",fontWeight:400,color:MUT,marginTop:"2px"}}>{sub}</span>}
      </span>
      {!bare && <ChevronRight size={18} color={MUT} aria-hidden="true" style={{flexShrink:0}}/>}
    </>
  );
  if (href) return <a href={href} target="_blank" rel="noreferrer" style={rowStyle}>{inner}</a>;
  return <button type="button" onClick={onClick} style={rowStyle}>{inner}</button>;
}

// Rows in one white group, a hairline between each.
function Group({ children, style }) {
  const rows = [children].flat().filter(Boolean);
  return (
    <div style={{...group,...style}}>
      {rows.map((r, i) => <div key={i}>{i > 0 && <div style={hairline}/>}{r}</div>)}
    </div>
  );
}

// An on/off row: the label (and a muted line under it) at the left, the
// switch at the right.
function SwitchRow({ label, sub, on, busy, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={busy} onClick={onChange} style={{...rowStyle,cursor:busy ? "default" : "pointer"}}>
      <span style={{flex:1,minWidth:0}}>
        <span style={{display:"block"}}>{label}</span>
        {sub && <span style={{display:"block",fontSize:"13px",fontWeight:400,color:MUT,marginTop:"2px",lineHeight:1.45}}>{sub}</span>}
      </span>
      <span aria-hidden="true" style={{position:"relative",width:"44px",height:"26px",borderRadius:"13px",background:on ? PROGRESS_GREEN : "rgba(22,47,36,0.2)",transition:"background 0.25s",flexShrink:0,opacity:busy ? 0.6 : 1}}>
        <span style={{position:"absolute",top:"3px",left:on ? "21px" : "3px",width:"20px",height:"20px",borderRadius:"50%",background:WHITE,boxShadow:"0 1px 3px rgba(0,0,0,0.25)",transition:"left 0.25s cubic-bezier(0.4,0,0.2,1)"}}/>
      </span>
    </button>
  );
}

function AccountSheet({ onClose }) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const [page, setPage] = useState(null); // null (the list) | account | privacy | notifications | legal | delete
  // Escape goes back from a page, and closes the list.
  useDialogFocus(ref, { onEscape: () => (page ? setPage(null) : onClose()) });
  useHidesAssist();
  // The row or Back that was pressed goes with the page, so focus moves to
  // the sheet (announced by its title) rather than falling out of it.
  useEffect(() => { ref.current?.scrollTo?.({ top: 0 }); ref.current?.focus({ preventScroll: true }); }, [page]);
  const held = accessInfo();
  const isSignedIn = signedIn();
  // The account as the server has it, with what's set up for signing in
  // and whether Candid's emails are on.
  const [account, setAccount] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const reload = () => accountSignIns().then(a => { setAccount(a); setLoadFailed(false); }).catch(() => setLoadFailed(true));
  useEffect(() => { if (isSignedIn) reload(); }, []);
  const open = p => { setPage(p); posthog.capture("account_page_opened", { page: p }); };

  const loadError = loadFailed && !account && (
    <p role="alert" style={{margin:"14px 0 0",fontSize:"13px",color:ERROR_TEXT}}>
      Your account couldn't load.{" "}
      <button type="button" onClick={reload} style={{background:"none",border:"none",padding:0,color:G,fontWeight:700,fontSize:"13px",fontFamily:"inherit",textDecoration:"underline",cursor:"pointer"}}>Try again</button>
    </p>
  );

  const list = !isSignedIn ? (
    <>
      <p style={{margin:"8px 0 0",fontSize:"14px",lineHeight:1.55,color:TEXT}}>With an account, your answers are saved, so they come back on any device.</p>
      <button type="button" onClick={() => { posthog.capture("account_sign_in_clicked"); onClose(); navigate("/app/signin"); }}
        style={{...primaryButtonStyle({ size: "regular" }),marginTop:"18px"}}>
        Sign in or create an account
      </button>
      <Group style={{marginTop:"22px"}}>
        <Row Icon={Lock} label="Privacy" onClick={() => open("privacy")}/>
        <Row Icon={BookOpen} label="Legal documents" onClick={() => open("legal")}/>
      </Group>
    </>
  ) : (
    <>
      <Group style={{marginTop:"18px"}}>
        <button type="button" onClick={() => open("account")} style={{...rowStyle,minHeight:"72px"}}>
          <span style={{...iconTile,width:"44px",height:"44px",borderRadius:"50%",background:CREAM}}><CircleUser size={26} strokeWidth={1.6} aria-hidden="true"/></span>
          <span style={{flex:1,minWidth:0}}>
            <span style={{display:"block",overflowWrap:"anywhere"}}>{held.email}</span>
            <span style={{display:"block",fontSize:"13px",fontWeight:400,color:MUT,marginTop:"2px"}}>Account settings · {planLine(held, hasAccess())}</span>
          </span>
          <ChevronRight size={18} color={MUT} aria-hidden="true" style={{flexShrink:0}}/>
        </button>
      </Group>
      <Group>
        <Row Icon={Lock} label="Privacy" onClick={() => open("privacy")}/>
        <Row Icon={Bell} label="Notifications" onClick={() => open("notifications")}/>
        <Row Icon={BookOpen} label="Legal documents" onClick={() => open("legal")}/>
      </Group>
      <Group>
        <Row Icon={SlidersHorizontal} label="Edit your answers" onClick={() => { onClose(); navigate("/app/inputs"); }}/>
      </Group>
      <Group>
        <Row label="Delete my data and account" onClick={() => open("delete")}/>
      </Group>
      <Group>
        <Row label="Sign out" color={G} bare onClick={() => switchAccount("account")}/>
      </Group>
      {loadError}
    </>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{position:"fixed",inset:0,zIndex:4600,background:"rgba(10,20,15,0.45)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <motion.div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={e => e.stopPropagation()}
        initial={reduceMotion ? { opacity: 0 } : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduceMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        style={{position:"relative",width:"100%",maxWidth:"480px",maxHeight:"92vh",overflowY:"auto",background:CREAM,borderRadius:"22px 22px 0 0",outline:"none",fontFamily:"'DM Sans',sans-serif",padding:"18px 16px calc(24px + env(safe-area-inset-bottom, 0px))",boxSizing:"border-box"}}>
        {/* The title in the middle; back (on a page) at the left, close at the right. */}
        <div style={{display:"grid",gridTemplateColumns:"36px 1fr 36px",alignItems:"center",gap:"8px"}}>
          {page ? (
            <button type="button" onClick={() => setPage(null)} aria-label="Back"
              style={{width:"34px",height:"34px",borderRadius:"50%",border:"none",background:WHITE,color:G,display:"flex",alignItems:"center",justifyContent:"center",padding:0,cursor:"pointer"}}>
              <ChevronLeft size={19} aria-hidden="true"/>
            </button>
          ) : <span/>}
          <h2 id="account-title" style={{margin:0,fontSize:"18px",lineHeight:1.25,fontWeight:700,color:G,textAlign:"center"}}>{page ? PAGE_TITLES[page] : "Account"}</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{width:"34px",height:"34px",borderRadius:"50%",border:"none",background:WHITE,color:G,display:"flex",alignItems:"center",justifyContent:"center",padding:0,cursor:"pointer"}}>
            <X size={16} aria-hidden="true"/>
          </button>
        </div>

        {!page && list}
        {page === "account" && <AccountSettings held={held} account={account} reload={reload} loadError={loadError}/>}
        {page === "privacy" && <Privacy/>}
        {page === "notifications" && <Notifications account={account} setAccount={setAccount} loadError={loadError}/>}
        {page === "legal" && (
          <Group style={{marginTop:"18px"}}>
            <Row label="Terms of use" href="/terms.html"/>
            <Row label="Privacy policy" href="/privacy.html"/>
          </Group>
        )}
        {page === "delete" && (account
          ? <DeleteAccount paidLive={!!account.paidLive} onCancel={() => setPage(null)}/>
          : loadError || <p style={{margin:"18px 4px 0",fontSize:"14px",color:MUT}}>Loading…</p>)}
      </motion.div>
    </motion.div>
  );
}

// The account: its email and plan, Manage subscription (paid through
// Stripe), and the ways to sign in on another device.
function AccountSettings({ held, account, reload, loadError }) {
  const [error, setError] = useState(null);
  const line = (label, value) => (
    <div style={{padding:"12px 16px"}}>
      <div style={{fontSize:"13px",color:MUT}}>{label}</div>
      <div style={{fontSize:"15.5px",fontWeight:600,color:TEXT,marginTop:"2px",overflowWrap:"anywhere"}}>{value}</div>
    </div>
  );
  return (
    <>
      <Group style={{marginTop:"18px"}}>
        {line("Email", held.email)}
        {line("Plan", planLine(held, hasAccess()))}
        {account?.hasStripe && <Row label="Manage subscription" onClick={() => openBillingPortal().catch(e => setError(e.message))}/>}
      </Group>
      {error && <div role="alert" style={{fontSize:"12px",color:ERROR_TEXT,marginTop:"6px"}}>{error}</div>}
      {account && (
        <>
          <div style={{...LABEL_CAPS,margin:"22px 4px 0"}}>Signing in on another device</div>
          <div style={{...group,padding:"4px 16px 12px"}}>
            <SignInMethods signIns={account} reload={reload}/>
          </div>
        </>
      )}
      {loadError}
    </>
  );
}

// Analytics cookies (src/lib/consent.js), the same choice as the cookie
// notice, and the privacy policy.
function Privacy() {
  const [choice, setChoice] = useState(getConsent);
  const flip = () => { const next = choice === "granted" ? "denied" : "granted"; setConsent(next); setChoice(next); };
  return (
    <>
      <Group style={{marginTop:"18px"}}>
        <SwitchRow label="Analytics cookies" sub="Lets Candid count visits and see which screens are used." on={choice === "granted"} onChange={flip}/>
      </Group>
      <Group>
        <Row label="Privacy policy" href="/privacy.html"/>
      </Group>
    </>
  );
}

// Candid's emails: the Sunday email, reminders and rate alerts, all on or
// off together, as the emails' own unsubscribe link stops them all.
function Notifications({ account, setAccount, loadError }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (!account) return loadError || <p style={{margin:"18px 4px 0",fontSize:"14px",color:MUT}}>Loading…</p>;
  if (account.alerts === null) return <p role="alert" style={{margin:"18px 4px 0",fontSize:"13px",color:ERROR_TEXT}}>Your email settings couldn't load. Close this and try again.</p>;
  const flip = async () => {
    setBusy(true); setError(null);
    try {
      const alerts = await setEmailAlerts(!account.alerts);
      setAccount({ ...account, alerts });
      posthog.capture("email_alerts_switched", { on: alerts });
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  return (
    <>
      <Group style={{marginTop:"18px"}}>
        <SwitchRow label="Emails from Candid" sub={`The Sunday email, reminders and rate alerts, to ${account.email}.`}
          on={!!account.alerts} busy={busy} onChange={flip}/>
      </Group>
      {error && <div role="alert" style={{fontSize:"12px",color:ERROR_TEXT,margin:"6px 4px 0"}}>{error}</div>}
    </>
  );
}

// Deleting, behind a typed DELETE. While a paid subscription is still
// running it waits: the subscription is cancelled first, in Manage
// subscription (Harvey, 30 Oct 2026).
function DeleteAccount({ paidLive, onCancel }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputId = useId(), errorId = useId();
  const confirmed = typed.trim().toUpperCase() === "DELETE";
  const remove = async e => {
    e.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true); setError(null);
    try {
      await deleteAccount();
      posthog.capture("account_deleted");
      posthog.reset();
      window.location.replace("/");
    } catch (err) { setError(err.message); setBusy(false); }
  };
  const text = { margin:0, fontSize:"14px", lineHeight:1.55, color:TEXT };
  if (paidLive) return (
    <p style={{...text,margin:"18px 4px 0"}}>Your subscription is still running. Cancel it in Manage subscription (Account settings) first, then you can delete your account here.</p>
  );
  return (
    <form onSubmit={remove} style={{...group,marginTop:"18px",padding:"16px"}}>
      <p style={text}>This deletes your account, your saved answers, your sign-ins and any emails Candid holds for you. It can't be undone.</p>
      <label htmlFor={inputId} style={{display:"block",margin:"14px 0 6px",fontSize:"13px",color:MUT}}>Type DELETE to confirm</label>
      <input id={inputId} value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false}
        aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
        style={{boxSizing:"border-box",width:"100%",border:`1.5px solid ${FIELD_BORDER}`,borderRadius:"100px",padding:"11px 16px",fontSize:"16px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE}}/>
      <div style={{display:"flex",gap:"8px",marginTop:"12px"}}>
        <button type="button" onClick={onCancel} style={{...primaryButtonStyle({ size: "regular", outline: true }),flex:1}}>Cancel</button>
        <button type="submit" disabled={!confirmed || busy}
          style={{...primaryButtonStyle({ size: "regular", disabled: !confirmed || busy }),flex:1,background:ERROR_TEXT}}>
          {busy ? "Deleting…" : "Delete everything"}
        </button>
      </div>
      {error && <div id={errorId} role="alert" style={{fontSize:"12px",color:ERROR_TEXT,marginTop:"6px"}}>{error}</div>}
    </form>
  );
}
