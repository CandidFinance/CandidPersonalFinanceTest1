import { isEasyAccess, isNsandi } from "./savingsRates.js";

// FSCS protects up to £120,000 per person with each bank or building society
// (from 1 December 2025), so no more than that goes to one provider. NS&I is
// Treasury-backed and has no limit. Banks sharing one licence, and money the
// user already holds with a bank, aren't known: the limit is per provider
// as the rate feed names it.
export const FSCS_DEPOSIT_LIMIT = 120000;
export const fscsLimitFor = r => isNsandi(r) ? Infinity : FSCS_DEPOSIT_LIMIT;

// Spreads an amount of cash across the easy-access accounts in savings_rates,
// highest rate first, each up to its balance cap (max_balance, filled in by
// the rate feed; no cap recorded counts as none). So £20,000 against a 5%
// account capped at £3,000 and an uncapped 4.72% one comes out as £3,000 at
// 5% and £17,000 at 4.72%, rather than £20,000 at a rate only £3,000 can get.
//
// A capped account is only included when it's worth having: at least
// MIN_EXTRA a year more than leaving that money in the best uncapped account.
// And never more than MAX_ACCOUNTS in all. A fourth account for £3 a year is
// noise, not an opportunity.
//
// Options:
//  - minRatePct: ignore accounts at or below this rate (the Premium Bonds
//    comparison, for the tax-free savings step)
//  - maxInterest: stop once the interest reaches this (the Personal Savings
//    Allowance, for the tax-free savings step)
export const MIN_EXTRA = 25;
export const MAX_ACCOUNTS = 3;

export function allocateCash(amount, rows, { minRatePct = 0, maxInterest = Infinity, minExtra = MIN_EXTRA, maxAccounts = MAX_ACCOUNTS } = {}) {
  const candidates = (rows || [])
    .filter(r => isEasyAccess(r) && +r.rate_aer > minRatePct)
    .map(r => ({ row: r, ratePct: +r.rate_aer, cap: +r.max_balance > 0 ? +r.max_balance : Infinity, fscs: fscsLimitFor(r) }))
    .sort((a, b) => b.ratePct - a.ratePct || b.cap - a.cap);
  const anchor = candidates.find(c => c.cap === Infinity) || null;

  let remaining = Math.max(0, +amount || 0), interestLeft = maxInterest;
  const lines = [];
  let anchorFilled = false;
  for (const c of candidates) {
    if (remaining <= 0 || interestLeft <= 0 || lines.length >= maxAccounts) break;
    const isAnchor = c === anchor;
    // Once the best uncapped account is full to the FSCS limit, the rest
    // goes to the next uncapped accounts, with another provider.
    if (anchorFilled && c.cap !== Infinity) continue;
    const overflow = anchorFilled;
    // With an uncapped account to fall back on, capped ones above it each
    // need a slot left over for it, and have to earn their place.
    if (anchor && !isAnchor && !overflow && lines.length >= maxAccounts - 1) continue;
    const byInterest = interestLeft / (c.ratePct / 100);
    const take = Math.min(remaining, c.cap, c.fscs, byInterest);
    if (take <= 0) continue;
    const extra = anchor && !isAnchor && !overflow ? take * (c.ratePct - anchor.ratePct) / 100 : null;
    if (extra != null && extra < minExtra) continue;
    const interest = take * c.ratePct / 100;
    lines.push({
      provider: c.row.provider_name, product: c.row.product_name || null, accountType: c.row.account_type,
      url: c.row.product_url || null, ratePct: c.ratePct, cap: c.cap === Infinity ? null : c.cap,
      updatedAt: c.row.updated_at || null,
      amount: take, interest, extra,
      // Held to the FSCS limit rather than the account's own cap.
      fscsLimited: take === c.fscs && take < c.cap,
    });
    remaining -= take;
    interestLeft -= interest;
    // Everything left that fits has gone into it, unless the FSCS limit
    // stopped it short.
    if (isAnchor) { if (take < c.fscs) break; anchorFilled = true; }
  }

  const allocated = lines.reduce((s, l) => s + l.amount, 0);
  const interest = lines.reduce((s, l) => s + l.interest, 0);
  return {
    lines, allocated, interest,
    unallocated: Math.max(0, (+amount || 0) - allocated),
    blendedRatePct: allocated > 0 ? (interest / allocated) * 100 : null,
    // The rate a single uncapped account gets, for "or all of it at X%".
    anchorRatePct: anchor ? anchor.ratePct : null,
  };
}
