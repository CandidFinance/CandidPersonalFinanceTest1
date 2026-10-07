// Providers' apps: checking the store links entered on /admin/rates, and
// picking the right one for the user's phone.
//
// Only real store addresses are accepted, cleaned of tracking or referral
// parameters, and nothing reaches the app until a person has confirmed the
// links (api/rates.js): a wrong link could send someone to a copycat
// banking app.

const APP_STORE = /^https:\/\/apps\.apple\.com\/(?:[a-z]{2}\/)?app\/(?:[^/?#]+\/)?id(\d+)/i;
const PLAY_ID = /^[a-zA-Z][\w]*(\.[a-zA-Z_][\w]*)+$/;

// A clean App Store link, or null for a blank one. Throws for anything else.
export function cleanIosAppUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m = s.match(APP_STORE);
  if (!m) throw new Error("The App Store link should look like https://apps.apple.com/gb/app/name/id123456789");
  return `https://apps.apple.com/gb/app/id${m[1]}`;
}

// A clean Google Play link, or null for a blank one. Throws for anything else.
export function cleanAndroidAppUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  let url;
  try { url = new URL(s); } catch { url = null; }
  const id = url?.searchParams.get("id");
  if (!url || url.protocol !== "https:" || url.hostname !== "play.google.com" || url.pathname !== "/store/apps/details" || !id || !PLAY_ID.test(id)) {
    throw new Error("The Google Play link should look like https://play.google.com/store/apps/details?id=com.example.app");
  }
  return `https://play.google.com/store/apps/details?id=${id}`;
}

// "ios", "android" or "desktop", from the browser's user agent.
export function devicePlatform(userAgent = "") {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

// The store link for this device, or null if there isn't one for it.
export function appLinkFor(platform, { iosAppUrl, androidAppUrl }) {
  if (platform === "ios") return iosAppUrl || null;
  if (platform === "android") return androidAppUrl || null;
  return null;
}
