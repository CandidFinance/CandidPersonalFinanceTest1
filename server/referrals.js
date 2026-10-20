// Referrals: a friend who arrives on someone's link (?ref=<code>), gives
// their email for their first answer and confirms it earns that person a
// free month, up to REFERRAL_CAP. The friend's own reward, a second answer
// free, is in the app (src/lib/referral.js, unlock.js).
//
//  - referralLink: a confirmed email's code (made the first time), and how
//    many free months it has earned. api/billing.js ?action=referral-link.
//  - codeIsValid: whether a ?ref= code is real. ?action=referral-check.
//  - recordReferral: a friend's email, given on the unlock form with the
//    code they arrived on. A friend counts once, ever, and not if they were
//    on Candid already (their email confirmed before) or are the referrer.
//    api/email.js, with the confirmation link.
//  - rewardReferral: their email confirmed, the referrer's month: £2.99 off
//    a paying subscriber's next bill (a Stripe customer balance credit), or
//    otherwise 30 days' access (a `referral` row in `subscriptions`, ended
//    by server/access.js), then an email saying so. api/email.js, when the
//    link is used.
//
// Tables: referral_codes and referrals, service-role only
// (supabase/hand-run/supabase_referrals_migration.sql). Kept outside api/
// so it's bundled into each function, not deployed alone.
import crypto from "crypto";
import { ACTIVE, PAID_PLANS } from "./access.js";
import { cleanEmail, makeToken } from "./tokens.js";

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.BILLING_MAIL_FROM || "Candid <admin@candid-finance.co.uk>";
const MAIL_REPLY_TO = "admin@candid-finance.co.uk";
const SITE = "https://www.candid-finance.co.uk";

export const REFERRAL_CAP = 12;
export const FREE_MONTH_DAYS = 30;
// A month of the monthly plan, as a credit: the same for an annual subscriber.
export const MONTH_CREDIT_PENCE = 299;
// The emailed link that starts a free month signs them in: good for a week,
// since it may not be opened the day it's sent.
const SIGN_IN_LINK_MS = 7 * 24 * 3600 * 1000;

// Codes: 8 characters, no 0/o/1/l/i, so one read aloud or retyped survives.
const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
export const CODE_RE = /^[a-hjkmnp-z2-9]{8}$/;
const newCode = () => Array.from({ length: 8 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join("");

async function db(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = new Error(`Supabase ${method} ${path.split("?")[0]} failed: ${res.status} ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}
const q = encodeURIComponent;

async function stripe(path, params) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path}: ${json?.error?.message || res.status}`);
  return json;
}

async function confirmed(email) {
  const [row] = await db(`email_verifications?select=verified_at&email=eq.${q(email)}`) || [];
  return !!row?.verified_at;
}
async function earned(email) {
  const rows = await db(`referrals?select=id&referrer_email=eq.${q(email)}&status=eq.rewarded`) || [];
  return rows.length;
}

export async function referralLink(rawEmail) {
  const email = cleanEmail(rawEmail);
  if (!email || !await confirmed(email)) return { confirmed: false };
  let [row] = await db(`referral_codes?select=code&email=eq.${q(email)}`) || [];
  // A new code, retried on the rare clash with another's; a second request
  // racing this one makes the same email's row first, so that's read back.
  for (let i = 0; !row && i < 3; i++) {
    try {
      [row] = await db("referral_codes", { method: "POST", prefer: "return=representation", body: { email, code: newCode() } });
    } catch (e) {
      if (e.status !== 409) throw e;
      [row] = await db(`referral_codes?select=code&email=eq.${q(email)}`) || [];
    }
  }
  if (!row) throw new Error("No referral code made");
  return { confirmed: true, code: row.code, earned: await earned(email), cap: REFERRAL_CAP };
}

async function referrerOf(code) {
  if (typeof code !== "string" || !CODE_RE.test(code)) return null;
  const [row] = await db(`referral_codes?select=email&code=eq.${q(code)}`) || [];
  return row?.email || null;
}
export const codeIsValid = async code => !!await referrerOf(code);

// Returns what happened, for the logs: "recorded", or why not.
export async function recordReferral(friendEmail, code) {
  const friend = cleanEmail(friendEmail);
  const referrer = friend && await referrerOf(code);
  if (!referrer) return "no code";
  if (referrer === friend) return "self";
  if (await confirmed(friend)) return "existing";
  const [sub] = await db(`subscriptions?select=email&email=eq.${q(friend)}`) || [];
  if (sub) return "existing";
  await db("referrals?on_conflict=friend_email", {
    method: "POST", prefer: "resolution=ignore-duplicates,return=minimal",
    body: { code, referrer_email: referrer, friend_email: friend },
  });
  return "recorded";
}

function rewardEmail(kind, until) {
  const date = until && new Date(until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
  if (kind === "stripe_credit") {
    return {
      subject: "A friend joined Candid: a month off your bill",
      text: `Hi,\n\nA friend you invited has joined Candid and completed their first module, so £2.99, a month of Candid, comes off your next bill.\n\nYou can earn up to ${REFERRAL_CAP} months this way. Your link is in Candid, under Edit inputs.\n\nCandid\n${SITE}`,
    };
  }
  return {
    subject: "A friend joined Candid: you've got a free month",
    text: `Hi,\n\nA friend you invited has joined Candid and completed their first module, so you've got a free month: every module's answer, Candid Assist, and Candid on your other devices, until ${date}.\n\nOpen this link on the phone or computer you use Candid on, and it's on. The link works for 7 days.\n\n{link}\n\nThe month ends by itself, and nothing is charged. You can earn up to ${REFERRAL_CAP} months this way. Your link is in Candid, under Edit inputs.\n\nCandid\n${SITE}`,
  };
}
async function sendRewardEmail(to, kind, until) {
  if (!RESEND_KEY) return;
  const { subject, text } = rewardEmail(kind, until);
  const link = `${SITE}/signin?restore=${q(makeToken(to, "restore", SIGN_IN_LINK_MS))}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, reply_to: MAIL_REPLY_TO, to: [to], subject, text: text.replace("{link}", link) }),
  });
  if (!res.ok) console.error("[referrals] reward email not sent:", res.status, await res.text());
}

// The referrer's month. Returns { reward, until?, txn?, note? }.
async function grantMonth(referrer, referralId, now = Date.now()) {
  const [row] = await db(`subscriptions?select=*&email=eq.${q(referrer)}`) || [];
  const live = row && ACTIVE.includes(row.status);
  // Any live Stripe subscription gets the credit, whatever its plan reads:
  // its row is Stripe's to keep (api/billing.js saveSubscription), so it's
  // never turned into a free month here. One set to end gets it too (it
  // stays on their Stripe balance for if they resubscribe), noted so it can
  // be looked at.
  if (live && row.stripe_customer_id && (row.stripe_subscription_id || PAID_PLANS.includes(row.plan))) {
    const txn = await stripe(`/customers/${row.stripe_customer_id}/balance_transactions`, {
      amount: String(-MONTH_CREDIT_PENCE), currency: "gbp",
      description: "Candid referral: a free month", "metadata[referral_id]": String(referralId),
    });
    return { reward: "stripe_credit", txn: txn.id, note: row.cancel_at_period_end ? "subscription set to end: credit is on their Stripe balance" : null };
  }
  // Free access with no end (given by hand): nothing to add.
  if (live && row.plan === "comp" && !row.current_period_end) return { reward: "free_month", until: null };
  // Added to a referral month still running, or from today.
  const running = row?.plan === "referral" && live && row.current_period_end && new Date(row.current_period_end).getTime() > now;
  const until = new Date((running ? new Date(row.current_period_end).getTime() : now) + FREE_MONTH_DAYS * 86400000).toISOString();
  await db("subscriptions?on_conflict=email", {
    method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
    body: { email: referrer, status: "active", plan: "referral", current_period_end: until, cancel_at_period_end: false, updated_at: new Date(now).toISOString() },
  });
  return { reward: "free_month", until };
}

// Returns what happened, for the logs.
export async function rewardReferral(friendEmail) {
  const friend = cleanEmail(friendEmail);
  if (!friend) return "no email";
  const now = new Date().toISOString();
  // Claimed by marking it confirmed: of two requests at once, only one gets
  // the row back, so a month is never given twice.
  const [ref] = await db(`referrals?friend_email=eq.${q(friend)}&status=eq.pending&confirmed_at=is.null`, {
    method: "PATCH", prefer: "return=representation", body: { confirmed_at: now },
  }) || [];
  if (!ref) return "none pending";
  const done = patch => db(`referrals?id=eq.${ref.id}`, { method: "PATCH", prefer: "return=minimal", body: patch });
  if (await earned(ref.referrer_email) >= REFERRAL_CAP) { await done({ status: "capped" }); return "capped"; }
  try {
    const { reward, until, txn, note } = await grantMonth(ref.referrer_email, ref.id);
    await done({ status: "rewarded", reward, stripe_balance_txn: txn || null, note: note || null, rewarded_at: new Date().toISOString() });
    if (!(reward === "free_month" && !until)) await sendRewardEmail(ref.referrer_email, reward, until);
    return "rewarded";
  } catch (e) {
    await done({ status: "failed", note: String(e.message).slice(0, 500) }).catch(() => {});
    throw e;
  }
}
