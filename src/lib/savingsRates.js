// Best savings rates Candid tracks — the hand-maintained `savings_rates` table
// in Supabase (public read). The app fetches the rows itself (CandidApp.jsx,
// via supaSelect); the public calculator pages use fetchSavingsRates below.

// Easy-access accounts only: the comparisons and lists are about money the
// user can get at, so fixed-term bonds, notice accounts and regular savers
// (also in the table) don't count, however high their rate.
// NS&I is backed by HM Treasury in full, so the FSCS limit doesn't apply.
export function isNsandi(r) {
  return /NS&I|National Savings/i.test(r?.provider_name || r?.provider || "");
}

export function isEasyAccess(r) {
  return /^easy access/i.test(r?.account_type || "");
}

// NS&I Premium Bonds, which the rate feed reads off NS&I's page (the annual
// prize fund rate, in rate_aer). Null until the feed has it.
export function premiumBondsRow(rows) {
  return (rows || []).find(r => /^premium bonds$/i.test(r?.account_type || "")) || null;
}

// Highest-rate easy-access row for a given ISA/non-ISA category — returns the
// whole row (not just the number) so display keeps the DB's own "X.XX" string
// formatting rather than reformatting a coerced float. Null if none.
export function topRate(rows, isIsa) {
  const filtered = (rows || []).filter(r => r.is_isa === isIsa && isEasyAccess(r));
  if (!filtered.length) return null;
  return filtered.reduce((best, r) => (!best || +r.rate_aer > +best.rate_aer) ? r : best, null);
}

// All rows, or null if Supabase isn't configured or the request fails — the
// caller keeps its own fallback figure in that case.
export async function fetchSavingsRates() {
  const url = import.meta.env?.VITE_SUPABASE_URL;
  const key = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/savings_rates?select=provider_name,product_name,account_type,rate_aer,max_balance,updated_at,is_isa`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    return res.ok ? await res.json() : null;
  } catch (e) {
    return null;
  }
}
