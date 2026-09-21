// Deep-link map for "go straight to my platform" actions — lets someone who
// already holds an account with one of these providers jump into that
// provider's app (or its web login if the app isn't installed) in one tap,
// instead of hunting down the right URL themselves. Used for both "go add to
// my ISA" and "go crystallise gains in my general account" CTAs — the same
// providers host both account types, they just remember separate choices
// (different `storageKey`s) since a user's ISA and general investment
// account aren't necessarily with the same platform.
//
// Important caveat: unlike UK banking apps (which support standardised
// Open Banking deep links), none of these investment platforms publish an
// official custom URL scheme. The `scheme` values below are best-effort
// guesses based on common naming conventions, NOT confirmed by any
// provider's own documentation. This is safe to ship regardless, because
// the failure mode is harmless: if a scheme is wrong (or the app isn't
// installed), the OS silently ignores it and openInvestmentProvider's
// fallback timer below sends the user to the web login instead —
// functionally identical to having no scheme at all. Swap a `scheme` here
// for a confirmed value if a provider ever documents one.
export const INVESTMENT_PROVIDERS = [
  { key: "vanguard",   name: "Vanguard",            scheme: "vanguard://",    webUrl: "https://secure.vanguardinvestor.co.uk/" },
  { key: "hl",         name: "Hargreaves Lansdown", scheme: "hl://",          webUrl: "https://www.hl.co.uk/my-accounts/login-step-one" },
  { key: "trading212", name: "Trading 212",         scheme: "trading212://", webUrl: "https://www.trading212.com/login" },
  { key: "monzo",      name: "Monzo",               scheme: "monzo://",       webUrl: "https://app.monzo.com/" },
  { key: "ajbell",     name: "AJ Bell",             scheme: "ajbell://",      webUrl: "https://www.ajbell.co.uk/login" },
  { key: "fidelity",   name: "Fidelity",            scheme: "fidelityuk://", webUrl: "https://www.fidelity.co.uk/login" },
  { key: "nutmeg",     name: "Nutmeg",              scheme: "nutmeg://",      webUrl: "https://client.nutmeg.com/login" },
];

// This app has no Open Banking / connected-account data anywhere (it's a
// self-reported-inputs assessment, not a linked-accounts product), so
// there's no real signal for "this user's actual platform". The closest
// honest substitute: remember whichever provider they pick themselves, so
// the next visit can skip straight to "Go to {Provider}" instead of asking
// again. `storageKey` lets different CTAs (ISA vs general account) keep
// independent choices.
export function getSavedProvider(storageKey) {
  try {
    const key = localStorage.getItem(storageKey);
    return INVESTMENT_PROVIDERS.find(p => p.key === key) || null;
  } catch {
    return null; // storage blocked (private mode, etc.) — just ask again
  }
}

export function saveProvider(storageKey, providerKey) {
  try {
    localStorage.setItem(storageKey, providerKey);
  } catch {
    // best-effort only — a failed save just means we ask again next time
  }
}

// Attempts the provider's app via its URL scheme; if the page hasn't lost
// visibility (i.e. nothing took over) within `timeout`ms, assumes the app
// isn't installed and falls back to the web login. Works the same whether
// or not `scheme` turns out to be correct, since an unrecognised scheme is
// a silent no-op.
export function openInvestmentProvider(provider, { timeout = 1500 } = {}) {
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
