// Google's sign-in button (Google Identity Services), loaded only where it's
// shown. Google draws the button itself, in its own frame, and hands back an
// ID token on a successful sign-in, which the server checks (server/google.js,
// api/billing.js google). With VITE_GOOGLE_CLIENT_ID unset, no button.

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
export const googleSignInAvailable = () => !!GOOGLE_CLIENT_ID;

let loading = null;
// Google's script, once; rejects when it can't load (offline, blocked).
function loadScript() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  loading ||= new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => window.google?.accounts?.id ? ok(window.google.accounts.id) : fail(new Error("no google"));
    s.onerror = () => { loading = null; fail(new Error("no google")); };
    document.head.appendChild(s);
  });
  return loading;
}

// Set up once, for every button: a token goes to whichever button was
// clicked last (renderButton's click_listener).
let ready = null, onToken = null;
function setUp() {
  ready ||= loadScript().then(id => {
    id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: r => { if (r?.credential) onToken?.(r.credential); },
      ux_mode: "popup", auto_select: false, cancel_on_tap_outside: true,
      use_fedcm_for_button: true, itp_support: true,
    });
    return id;
  }).catch(e => { ready = null; throw e; });
  return ready;
}

// Draws Google's "Continue with Google" button into `el`, `width` px wide
// (Google allows 200 to 400). `handle(credential)` gets the ID token;
// `onClick` hears the click itself, which happens inside Google's frame.
export async function renderGoogleButton(el, width, handle, onClick = null) {
  const id = await setUp();
  el.replaceChildren();
  id.renderButton(el, {
    type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "pill",
    logo_alignment: "center", width: Math.max(200, Math.min(400, Math.round(width))),
    click_listener: () => { onToken = handle; onClick?.(); },
  });
  // The first click can come before click_listener's set, on a button drawn
  // alone; this one is the most recent, so it's the one meant.
  onToken = handle;
}
