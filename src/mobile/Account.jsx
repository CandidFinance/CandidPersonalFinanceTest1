import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import posthog from "posthog-js";
import { CircleUser, X } from "lucide-react";
import { G, MUT, TEXT, WHITE, CREAM, ERROR_TEXT, FIELD_BORDER, LABEL_CAPS } from "../design-tokens.js";
import { accessInfo, accountSignIns, deleteAccount, hasAccess, openBillingPortal, signedIn, PLANS } from "../lib/entitlement.js";
import { PAID_PLANS } from "../lib/weekly.js";
import { SignInMethods, switchAccount } from "./SignInSetup.jsx";
import { primaryButtonStyle } from "./onboarding/OnboardingShell.jsx";
import useDialogFocus from "./useDialogFocus.js";

// The Account button, top left on every app screen (Harvey, 30 Oct 2026),
// and the sheet it opens. Signed out: sign in or create an account
// (src/site/SignInPage.jsx). Signed in, free or paid: the account and its
// plan, the ways to sign in on another device, Manage subscription,
// editing answers, the terms, signing out, and deleting the account and
// everything held for it (api/billing.js delete-account), which waits for
// a paid subscription to be cancelled first.
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

function AccountSheet({ onClose }) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  useDialogFocus(ref, { onEscape: onClose });
  const held = accessInfo();
  const isSignedIn = signedIn();
  // The account as the server has it, with what's set up for signing in.
  const [account, setAccount] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const reload = () => accountSignIns().then(a => { setAccount(a); setLoadFailed(false); }).catch(() => setLoadFailed(true));
  useEffect(() => { if (isSignedIn) reload(); }, []);
  const [error, setError] = useState(null);

  const textLink = { color:G, fontWeight:700, fontSize:"13.5px", textDecoration:"underline", textUnderlineOffset:"3px" };
  const action = { background:"none", border:"none", padding:0, minHeight:"44px", color:G, fontSize:"14px", fontWeight:700, fontFamily:"inherit", cursor:"pointer", textAlign:"left" };
  const rule = { border:"none", borderTop:"1px solid rgba(22,47,36,0.1)", margin:"14px 0" };
  const terms = (
    <p style={{margin:"16px 0 0",fontSize:"13.5px",color:MUT}}>
      <a href="/terms.html" target="_blank" rel="noreferrer" style={textLink}>Terms</a>
      <span aria-hidden="true"> · </span>
      <a href="/privacy.html" target="_blank" rel="noreferrer" style={textLink}>Privacy</a>
    </p>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{position:"fixed",inset:0,zIndex:4600,background:"rgba(10,20,15,0.45)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <motion.div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={e => e.stopPropagation()}
        initial={reduceMotion ? { opacity: 0 } : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduceMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        style={{position:"relative",width:"100%",maxWidth:"480px",maxHeight:"92vh",overflowY:"auto",background:WHITE,borderRadius:"22px 22px 0 0",outline:"none",fontFamily:"'DM Sans',sans-serif",padding:"22px 20px calc(22px + env(safe-area-inset-bottom, 0px))",boxSizing:"border-box"}}>
        <button type="button" onClick={onClose} aria-label="Close"
          style={{position:"absolute",top:"12px",right:"12px",display:"flex",alignItems:"center",justifyContent:"center",width:"30px",height:"30px",borderRadius:"50%",border:"none",background:CREAM,color:G,cursor:"pointer",padding:0}}>
          <X size={16} aria-hidden="true"/>
        </button>
        <h2 id="account-title" style={{margin:"0 40px 0 0",fontSize:"22px",lineHeight:1.2,fontWeight:700,color:G}}>Account</h2>

        {!isSignedIn ? (
          <>
            <p style={{margin:"8px 0 0",fontSize:"14px",lineHeight:1.55,color:TEXT}}>With an account, your answers are saved, so they come back on any device.</p>
            <button type="button" onClick={() => { posthog.capture("account_sign_in_clicked"); onClose(); navigate("/app/signin"); }}
              style={{...primaryButtonStyle({ size: "regular" }),marginTop:"18px"}}>
              Sign in or create an account
            </button>
            {terms}
          </>
        ) : (
          <>
            <div style={{marginTop:"10px",fontSize:"15px",fontWeight:700,color:TEXT,overflowWrap:"anywhere"}}>{held.email}</div>
            <div style={{fontSize:"13px",color:MUT,marginTop:"2px"}}>{planLine(held, hasAccess())}</div>
            {account?.hasStripe && (
              <button type="button" onClick={() => openBillingPortal().catch(e => setError(e.message))} style={action}>Manage subscription</button>
            )}
            {error && <div role="alert" style={{fontSize:"12px",color:ERROR_TEXT}}>{error}</div>}
            {loadFailed && !account && (
              <p role="alert" style={{margin:"8px 0 0",fontSize:"13px",color:ERROR_TEXT}}>
                Your account couldn't load.{" "}
                <button type="button" onClick={reload} style={{...action,minHeight:0,fontSize:"13px",textDecoration:"underline"}}>Try again</button>
              </p>
            )}

            {account && (
              <>
                <hr style={rule}/>
                <div style={LABEL_CAPS}>Signing in on another device</div>
                <SignInMethods signIns={account} reload={reload}/>
              </>
            )}

            <hr style={rule}/>
            <div style={{display:"flex",flexDirection:"column"}}>
              <button type="button" onClick={() => { onClose(); navigate("/app/inputs"); }} style={action}>Edit your answers</button>
              <button type="button" onClick={() => switchAccount("account")} style={action}>Sign out</button>
            </div>
            {terms}

            <hr style={rule}/>
            <DeleteAccount paidLive={!!account?.paidLive} ready={!!account}/>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// Deleting, behind a typed DELETE. While a paid subscription is still
// running it waits: the subscription is cancelled first, in Manage
// subscription (Harvey, 30 Oct 2026).
function DeleteAccount({ paidLive, ready }) {
  const [open, setOpen] = useState(false);
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
  const danger = { background:"none", border:"none", padding:0, minHeight:"44px", color:ERROR_TEXT, fontSize:"14px", fontWeight:700, fontFamily:"inherit", cursor:"pointer", textAlign:"left" };
  if (!open) return <button type="button" disabled={!ready} onClick={() => setOpen(true)} style={danger}>Delete my data and account</button>;
  if (paidLive) return (
    <p style={{margin:"4px 0 0",fontSize:"13.5px",lineHeight:1.55,color:TEXT}}>
      Your subscription is still running. Cancel it in Manage subscription first, then you can delete your account here.
    </p>
  );
  return (
    <form onSubmit={remove}>
      <div style={{fontSize:"14px",fontWeight:700,color:TEXT}}>Delete my data and account</div>
      <p style={{margin:"4px 0 0",fontSize:"13.5px",lineHeight:1.55,color:TEXT}}>
        This deletes your account, your saved answers, your sign-ins and any emails Candid holds for you. It can't be undone.
      </p>
      <label htmlFor={inputId} style={{display:"block",margin:"12px 0 6px",fontSize:"13px",color:MUT}}>Type DELETE to confirm</label>
      <input id={inputId} value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false}
        aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
        style={{boxSizing:"border-box",width:"100%",border:`1.5px solid ${FIELD_BORDER}`,borderRadius:"100px",padding:"11px 16px",fontSize:"16px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE}}/>
      <div style={{display:"flex",gap:"8px",marginTop:"10px"}}>
        <button type="button" onClick={() => { setOpen(false); setTyped(""); setError(null); }} style={{...primaryButtonStyle({ size: "regular", outline: true }),flex:1}}>Cancel</button>
        <button type="submit" disabled={!confirmed || busy}
          style={{...primaryButtonStyle({ size: "regular", disabled: !confirmed || busy }),flex:1,background:ERROR_TEXT}}>
          {busy ? "Deleting…" : "Delete everything"}
        </button>
      </div>
      {error && <div id={errorId} role="alert" style={{fontSize:"12px",color:ERROR_TEXT,marginTop:"6px"}}>{error}</div>}
    </form>
  );
}
