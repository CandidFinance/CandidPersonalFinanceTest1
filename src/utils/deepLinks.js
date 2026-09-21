// Deep-link map for "go straight to my ISA" actions — lets someone who
// already holds an account with one of these providers jump into that
// provider's app (or its web login if the app isn't installed) in one tap,
// instead of hunting down the right URL themselves.
//
// Important caveat: unlike UK banking apps (which support standardised
// Open Banking deep links), none of these investment/ISA platforms publish
// an official custom URL scheme. The `scheme` values below are best-effort
// guesses based on common naming conventions, NOT confirmed by any
// provider's own documentation. This is safe to ship regardless, because
// the failure mode is harmless: if a scheme is wrong (or the app isn't
// installed), the OS silently ignores it and openIsaProvider's fallback
// timer below sends the user to the web login instead — functionally
// identical to having no scheme at all. Swap a `scheme` here for a
// confirmed value if a provider ever documents one.
export const ISA_PROVIDERS = [
  { key: "vanguard",   name: "Vanguard",            scheme: "vanguard://",    webUrl: "https://secure.vanguardinvestor.co.uk/" },
  { key: "hl",         name: "Hargreaves Lansdown", scheme: "hl://",          webUrl: "https://www.hl.co.uk/my-accounts/login-step-one" },
  { key: "trading212", name: "Trading 212",         scheme: "trading212://", webUrl: "https://www.trading212.com/login" },
  { key: "monzo",      name: "Monzo",               scheme: "monzo://",       webUrl: "https://app.monzo.com/" },
  { key: "ajbell",     name: "AJ Bell",             scheme: "ajbell://",      webUrl: "https://www.ajbell.co.uk/login" },
  { key: "fidelity",   name: "Fidelity",            scheme: "fidelityuk://", webUrl: "https://www.fidelity.co.uk/login" },
  { key: "nutmeg",     name: "Nutmeg",              scheme: "nutmeg://",      webUrl: "https://client.nutmeg.com/login" },
];

const STORAGE_KEY = "candid_isa_provider_pref";

// This app has no Open Banking / connected-account data anywhere (it's a
// self-reported-inputs assessment, not a linked-accounts product), so there's
// no real signal for "this user's actual ISA provider". The closest honest
// substitute: remember whichever provider they pick themselves, so the next
// visit can skip straight to "Go to {Provider}" instead of asking again.
export function getSavedIsaProvider() {
  try {
    const key = localStorage.getItem(STORAGE_KEY);
    return ISA_PROVIDERS.find(p => p.key === key) || null;
  } catch {
    return null; // storage blocked (private mode, etc.) — just ask again
  }
}

export function saveIsaProvider(providerKey) {
  try {
    localStorage.setItem(STORAGE_KEY, providerKey);
  } catch {
    // best-effort only — a failed save just means we ask again next time
  }
}

// Attempts the provider's app via its URL scheme; if the page hasn't lost
// visibility (i.e. nothing took over) within `timeout`ms, assumes the app
// isn't installed and falls back to the web login. Works the same whether
// or not `scheme` turns out to be correct, since an unrecognised scheme is
// a silent no-op.
export function openIsaProvider(provider, { timeout = 1500 } = {}) {
  if (!provider) return;
  const goToWeb = () => { window.location.href = provider.webUrl; };
  if (!provider.scheme) { goToWeb(); return; }

  const timer = setTimeout(goToWeb, timeout);
  const onVisibilityChange = () => {
    if (document.hidden) {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.location.href = provider.scheme;
}
