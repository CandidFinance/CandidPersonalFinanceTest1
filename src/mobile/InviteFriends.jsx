import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { Share2 } from "lucide-react";
import { G, MUT, TEXT, WHITE, ERROR_TEXT } from "../design-tokens.js";
import { validEmailShape, requestEmailCheck } from "../lib/emailCheck.js";
import { fetchReferralLink, shareInvite, copyInvite, inviteMailto, inviteUrl, REFERRAL_CAP } from "../lib/referral.js";

// Inviting friends (src/lib/referral.js, server/referrals.js): a free month
// for each friend who joins on their link and completes their first module,
// up to REFERRAL_CAP; the friend's second module is unlocked for free. The link is for a
// confirmed email only, so until theirs is, this offers its confirmation
// link instead. Nothing without an email. `source` is where it's shown, for
// PostHog. `bare`: no card of its own, inside one already (the paywall).
export default function InviteFriends({ d, source, bare = false }) {
  const email = validEmailShape(d.email) ? d.email.trim() : null;
  const [link, setLink] = useState(null); // { confirmed, code, earned, cap }
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState(null);
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

  const share = async (how = "sheet") => {
    const result = how === "copy" ? await copyInvite(link.code) : await shareInvite(link.code);
    posthog.capture("referral_shared", { source, how: result });
    setNote(result === "copied" ? "Link copied. Paste it into a message to a friend." : result === "failed" ? "Couldn't copy it. Select the link below and copy it instead." : null);
  };
  const resend = async () => {
    setResent("sending");
    const { sent } = await requestEmailCheck(email, { confirm: { name: d.name || null } });
    setResent(sent === "sent" || sent === "sent recently" ? "sent" : "failed");
  };

  const wrap = bare ? {} : { background:WHITE, border:"1.5px solid rgba(22,47,36,0.12)", borderRadius:"14px", padding:"16px 18px", marginTop:"16px" };
  const textLink = { background:"none", border:"none", padding:0, color:G, fontSize:"13px", fontWeight:700, fontFamily:"inherit", cursor:"pointer" };
  return (
    <div style={wrap}>
      <div style={{fontSize:"14px",fontWeight:700,color:TEXT}}>Give a friend a free module, get a free month</div>
      <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"4px 0 0"}}>
        When a friend joins on your link and completes their first module, you get a month of Candid free, up to {REFERRAL_CAP}. Their second module is unlocked for free. <a href="/terms.html#referrals" target="_blank" rel="noreferrer" style={{color:MUT}}>Terms</a>
      </p>
      {link.confirmed ? (
        <>
          <button type="button" onClick={() => share()} style={{marginTop:"12px",width:"100%",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"12px",fontSize:"14px",fontWeight:700,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"7px"}}>
            <Share2 size={15}/>Share your link
          </button>
          {/* Email: its subject and the link filled in, in their mail app. */}
          <div style={{display:"flex",justifyContent:"center",gap:"20px",marginTop:"10px"}}>
            <a href={inviteMailto(link.code)} onClick={() => posthog.capture("referral_shared", { source, how: "email" })} style={{...textLink,textDecoration:"none"}}>Email it</a>
            <button type="button" onClick={() => share("copy")} style={textLink}>Copy link</button>
          </div>
          {note && <div role="status" style={{fontSize:"12.5px",color:TEXT,marginTop:"8px",textAlign:"center"}}>{note}</div>}
          <div style={{display:"flex",justifyContent:"space-between",gap:"10px",marginTop:"10px",fontSize:"12px",color:MUT}}>
            <span style={{userSelect:"all",overflowWrap:"anywhere"}}>{inviteUrl(link.code).replace(/^https?:\/\//, "")}</span>
            <span style={{whiteSpace:"nowrap"}}>{link.earned} of {link.cap} months earned</span>
          </div>
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
