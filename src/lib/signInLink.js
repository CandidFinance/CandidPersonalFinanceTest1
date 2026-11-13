// The token of a sign-in link (?restore=), taken out of the address as the
// page loads and held here instead. src/main.jsx calls holdSignInToken
// before analytics starts, so the token is never in a page address PostHog
// records; the sign-in page and the app then take it from here.
let held = null;

export function holdSignInToken() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const token = url.searchParams.get("restore");
  if (!token) return;
  // Held only where a sign-in link has always worked: the sign-in pages and
  // the app. Anywhere else it's dropped, as it was before.
  if (/^\/(signin|app)(\/|$)/.test(url.pathname)) held = token;
  url.searchParams.delete("restore");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

export const signInToken = () => held;
// The token, once: whoever takes it signs in with it.
export function takeSignInToken() {
  const token = held;
  held = null;
  return token;
}
