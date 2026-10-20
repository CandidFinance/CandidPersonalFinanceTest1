import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { Share2, Copy, Check, Mail, MessageCircle } from "lucide-react";
import { G, MUT, TEXT, WHITE, ERROR_TEXT } from "../design-tokens.js";
import { validEmailShape, requestEmailCheck } from "../lib/emailCheck.js";
import { fetchReferralLink, inviteMessage, nativeShare, shareInvite, copyInvite, inviteMailto, inviteWhatsApp, REFERRAL_CAP } from "../lib/referral.js";

// Inviting friends (src/lib/referral.js, server/referrals.js): a free month
// for each friend who joins on their link and completes their first module,
// up to REFERRAL_CAP; the friend's second module is unlocked for free. The
// link is for a confirmed email only, so until theirs is, this offers its
// confirmation link instead. Nothing without an email.
// Sharing, on a phone: Share (its own share sheet), Email (subject filled
// in) and a copy icon. On a computer: "Share your link", which shows Email
// and WhatsApp under it, and a copy button beside it. Copying takes the
// message with its link, to paste anywhere. The message says what they've used Candid for
// (`moduleKey`, the answer just seen, else their last one unlocked).
// `source` is where it's shown, for PostHog. `bare`: no card of its own,
// inside one already (the paywall).
export default function InviteFriends({ d, source, moduleKey = null, bare = false }) {
  const email = validEmailShape(d.email) ? d.email.trim() : null;
  const [link, setLink] = useState(null); // { confirmed, code, earned, cap }
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(null); // true, or "failed"
  const [choices, setChoices] = useState(false);
  const [resent, setResent] = useState(null);

  useEffect(() => {
    if (!email) return;
    let live = true;
    const load = () => fetchReferralLink(email).then(r => { if (live) { setLink(r); setFailed(false); } }).catch(() => { if (live) setFailed(true); });
    load();
    // Confirmed in another tab: picked up on coming back.
    const onShow = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { live = false; document.removeEventListener("visibilitychange", onShow); };
  }, [email]);
  useEffect(() => { if (link?.confirmed) posthog.capture("referral_link_shown", { source }); }, [link?.confirmed, source]);

  if (!email || failed || !link) return null;

  const text = link.confirmed ? inviteMessage(link.code, d, moduleKey) : "";
  const phone = nativeShare();
  const shared = how => posthog.capture("referral_shared", { source, how });
  const share = async () => {
    if (!nativeShare()) { setChoices(c => !c); return; }
    const result = await shareInvite(text);
    if (result === "failed") setChoices(true);
    shared(result === "shared" ? "sheet" : result);
  };
  const copy = async () => {
    const result = await copyInvite(text);
    shared(result === "copied" ? "copy" : "copy_failed");
    setCopied(result === "copied" ? true : "failed");
    if (result === "copied") setTimeout(() => setCopied(null), 2500);
  };
  const resend = async () => {
    setResent("sending");
    const { sent } = await requestEmailCheck(email, { confirm: { name: d.name || null } });
    setResent(sent === "sent" || sent === "sent recently" ? "sent" : "failed");
  };

  const wrap = bare ? {} : { background:WHITE, border:"1.5px solid rgba(22,47,36,0.12)", borderRadius:"14px", padding:"16px 18px", marginTop:"16px" };
  const textLink = { background:"none", border:"none", padding:0, color:G, fontSize:"13px", fontWeight:700, fontFamily:"inherit", cursor:"pointer" };
  const pill = { border:"none", borderRadius:"100px", padding:"12px", fontSize:"14px", fontWeight:700, fontFamily:"inherit", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"7px", boxSizing:"border-box" };
  const choice = { ...pill, flex:1, background:WHITE, color:G, border:`1.5px solid ${G}`, padding:"10px", textDecoration:"none" };
  return (
    <div style={wrap}>
      <div style={{fontSize:"14px",fontWeight:700,color:TEXT}}>Give a friend a free module, get a free month</div>
      <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"4px 0 0"}}>
        When a friend joins on your link and completes their first module, you get a month of Candid free, up to {REFERRAL_CAP}. Their second module is unlocked for free. <a href="/terms.html#referrals" target="_blank" rel="noreferrer" style={{color:MUT}}>Terms</a>
      </p>
      {link.confirmed && phone ? (
        <>
          {/* A phone: its share sheet, an email with the subject filled in
              (a share sheet's mail app may drop it), and a plain copy icon. */}
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"12px"}}>
            <button type="button" onClick={share} style={{...pill,flex:1,background:G,color:WHITE}}>
              <Share2 size={16}/>Share
            </button>
            <a href={inviteMailto(text)} onClick={() => shared("email")} style={{...choice,padding:"12px"}}>
              <Mail size={16}/>Email
            </a>
            <button type="button" onClick={copy} aria-label="Copy your invite" title="Copy your invite"
              style={{background:"none",border:"none",padding:"10px",color:G,cursor:"pointer",display:"flex",alignItems:"center",flexShrink:0}}>
              {copied === true ? <Check size={20}/> : <Copy size={20}/>}
            </button>
          </div>
          {copied && (
            <div role="status" style={{fontSize:"12.5px",color:copied === true ? TEXT : ERROR_TEXT,marginTop:"8px",textAlign:"center"}}>
              {copied === true ? "Copied. Paste it into a message to a friend." : "Couldn't copy it. Use Share instead."}
            </div>
          )}
        </>
      ) : link.confirmed ? (
        <>
          <div style={{display:"flex",gap:"8px",marginTop:"12px"}}>
            <button type="button" onClick={share} aria-expanded={nativeShare() ? undefined : choices} style={{...pill,flex:4,background:G,color:WHITE}}>
              <Share2 size={15}/>Share your link
            </button>
            <button type="button" onClick={copy} aria-label="Copy your invite" title="Copy your invite"
              style={{...pill,flex:1,background:WHITE,color:G,border:`1.5px solid ${G}`}}>
              {copied === true ? <Check size={17}/> : <Copy size={17}/>}
            </button>
          </div>
          {choices && (
            <div style={{display:"flex",gap:"8px",marginTop:"8px"}}>
              <a href={inviteMailto(text)} onClick={() => shared("email")} style={choice}><Mail size={15}/>Email</a>
              <a href={inviteWhatsApp(text)} target="_blank" rel="noopener noreferrer" onClick={() => shared("whatsapp")} style={choice}><MessageCircle size={15}/>WhatsApp</a>
            </div>
          )}
          {copied && (
            <div role="status" style={{fontSize:"12.5px",color:copied === true ? TEXT : ERROR_TEXT,marginTop:"8px",textAlign:"center"}}>
              {copied === true ? "Copied. Paste it into a message to a friend." : "Couldn't copy it. Use Share your link instead."}
            </div>
          )}
        </>
      ) : (
        <div style={{marginTop:"10px",fontSize:"12.5px",color:TEXT,lineHeight:1.5}}>
          Confirm your email to get your link: use the one we emailed to {email}.{" "}
          {resent === "sent" ? <span style={{color:MUT}}>Sent again.</span>
            : resent === "failed" ? <span style={{color:ERROR_TEXT}}>Couldn't send it. Try again shortly.</span>
            : <button type="button" onClick={resend} disabled={resent === "sending"} style={textLink}>{resent === "sending" ? "Sending…" : "Send it again"}</button>}
        </div>
      )}
    </div>
  );
}
