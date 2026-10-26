// "Continue with Google": the ID token Google's button hands the browser
// (src/lib/google.js), checked here against Google's published keys, for
// the address it names. Google says whether it has verified that address
// (email_verified), and only a verified one is taken, so it counts as
// confirmed without our emailed link (api/email.js confirm).
// Kept outside api/ so it's bundled into each function, not deployed alone.
import { createRemoteJWKSet, jwtVerify } from "jose";
import { cleanEmail } from "./tokens.js";
import { recordReferral } from "./referrals.js";
import { recordConfirmed } from "./confirmLink.js";

// The OAuth client's id (Google Cloud console), the same one the browser
// uses; with it unset, nobody signs in with Google.
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;

// Fetched once per function instance and cached by jose, refetched when
// Google rotates its keys.
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

// { email, name, sub } from a good token, or null (`sub`: Google's id for
// the account, which stays when its address changes): signed by Google, for our
// client, not expired, and the address verified.
export async function googleIdentity(credential) {
  if (!GOOGLE_CLIENT_ID || typeof credential !== "string" || credential.length > 4096) return null;
  try {
    const { payload } = await jwtVerify(credential, googleKeys, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: GOOGLE_CLIENT_ID,
    });
    const email = payload.email_verified === true ? cleanEmail(payload.email) : null;
    if (!email) return null;
    const name = typeof payload.given_name === "string" ? payload.given_name.trim().slice(0, 40) : "";
    return { email, name, sub: String(payload.sub) };
  } catch {
    return null;
  }
}

// Records the address as confirmed, as opening our link would
// (server/confirmLink.js recordConfirmed), after `ref`, the code of the
// friend's link they arrived on, as api/email.js check does. A failure is
// logged; the sign-in stands.
export async function markConfirmed(email, ref = null) {
  try {
    if (typeof ref === "string") await recordReferral(email, ref).catch(e => console.error("[google] referral not recorded:", e.message));
    await recordConfirmed(email);
  } catch (e) {
    console.error("[google] not recorded as confirmed:", e.message);
  }
}
