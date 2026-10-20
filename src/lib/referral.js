// Invites (server/referrals.js). Someone's link is the site with ?ref=<code>.
//  - The friend: the code is kept in this browser when they arrive, if
//    they're new here (nothing unlocked yet), and checked with the server.
//    A real one gives them a second answer free (unlock.js unlockAsk), and
//    goes with their email when they give it (MobileUnlock.jsx), so the
//    person who invited them can be rewarded once it's confirmed.
//  - The person inviting: their link, for a confirmed email, and how many
//    free months it has earned (InviteFriends.jsx).
import { reportStorageFailure } from "./storage.js";

const KEY = "candid_referral";
export const REFERRAL_CAP = 12;
const CODE_RE = /^[a-hjkmnp-z2-9]{8}$/;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
function write(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { reportStorageFailure("save_referral", e); }
}

async function call(action, body) {
  const res = await fetch(`/api/billing?action=${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
  return json;
}

// On arriving: a code in the address kept, unless they've one already or
// have unlocked an answer here before (they're not new). Then checked with
// the server, once, until it says.
export function captureReferral(search = typeof window !== "undefined" ? window.location.search : "") {
  const code = new URLSearchParams(search).get("ref");
  if (code && CODE_RE.test(code) && !read()) {
    let unlocked = 0;
    try { unlocked = (JSON.parse(localStorage.getItem("candid_inputs") || "{}").unlockedModules || []).length; } catch { /* treated as new */ }
    if (!unlocked) write({ code, valid: null, at: new Date().toISOString() });
  }
  const held = read();
  if (held && held.valid === null) {
    call("referral-check", { code: held.code })
      .then(({ valid }) => { if (typeof valid === "boolean") write({ ...held, valid }); })
      .catch(() => { /* checked again next time */ });
  }
}

// The code they arrived on, for the server to check itself; and whether it's
// been found real, which is what gives the second answer free.
export const referralCode = () => read()?.code || null;
export const hasReferralBonus = () => read()?.valid === true;

// Their own link: { confirmed: false } until their email is confirmed,
// then { confirmed: true, code, earned, cap }.
export const fetchReferralLink = email => call("referral-link", { email });

export const inviteUrl = code => `${typeof window !== "undefined" ? window.location.origin : "https://www.candid-finance.co.uk"}/?ref=${code}`;
export const INVITE_TEXT = "I've been using Candid to see what my money could be doing. Your first two answers are free with my link:";

// The phone's share sheet where there is one, else the link copied.
// Resolves to "shared", "copied", "cancelled" or "failed".
export async function shareInvite(code) {
  const url = inviteUrl(code);
  if (typeof navigator !== "undefined" && navigator.share) {
    try { await navigator.share({ title: "Candid", text: INVITE_TEXT, url }); return "shared"; }
    catch (e) { if (e?.name === "AbortError") return "cancelled"; }
  }
  try { await navigator.clipboard.writeText(`${INVITE_TEXT} ${url}`); return "copied"; }
  catch { return "failed"; }
}
