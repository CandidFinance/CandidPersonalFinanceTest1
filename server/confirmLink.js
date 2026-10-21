import crypto from "crypto";
import { safeEqual } from "./http.js";
import { checkEmail } from "../src/lib/emailCheck.js";

// The link that confirms an email address is someone's: signed, and good
// for LINK_DAYS. Made by api/email.js (the confirmation email) and
// api/alerts.js (the reminder for one not yet confirmed); opened on
// api/email.js ?action=confirm.

const TOKEN_SECRET = process.env.ALERTS_TOKEN_SECRET || process.env.STRIPE_BILLING_TOKEN_SECRET;
const SITE = "https://www.candid-finance.co.uk";
export const LINK_DAYS = 14;

const key = email => email.toLowerCase();
const sign = payload => crypto.createHmac("sha256", TOKEN_SECRET).update(`email-confirm:${payload}`).digest("base64url");

export function confirmUrl(email) {
  const payload = `${Buffer.from(key(email)).toString("base64url")}.${Date.now().toString(36)}`;
  return `${SITE}/api/email?action=confirm&t=${payload}.${sign(payload)}`;
}

export function emailFromConfirmToken(t) {
  if (!TOKEN_SECRET || typeof t !== "string") return null;
  const [e, issued, sig] = t.split(".");
  if (!e || !issued || !safeEqual(sig, sign(`${e}.${issued}`))) return null;
  if (Date.now() - parseInt(issued, 36) > LINK_DAYS * 86400000) return null;
  const { email } = checkEmail(Buffer.from(e, "base64url").toString());
  return email ? key(email) : null;
}
