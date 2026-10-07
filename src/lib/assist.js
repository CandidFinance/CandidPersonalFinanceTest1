import { isEasyAccess } from "./savingsRates.js";
import { ISA_ALLOWANCE } from "./tax.js";

// Candid Assist: what it has to show, worked out from the user's figures and
// the live rates. The panel (src/mobile/assist/) only displays this.
//
// Assist never decides for anyone. Cash ISAs and savings accounts are shown
// separately (some people keep their ISA allowance for investing), each as
// a choice of several providers sorted by rate, none picked in advance. The
// user picks; Assist covers the how: the amount, exactly which of their
// accounts it comes from, the link, and updating Candid afterwards.

// Below this a year, a change isn't worth raising.
export const MIN_ASSIST_GAIN = 50;
// The ISA allowance reset is mentioned within this many days of 5 April.
export const ISA_DEADLINE_DAYS = 56;
// Providers shown per section, so it's always a choice, never one account.
export const OPTIONS_PER_SECTION = 4;

// The next 5 April (the day the ISA allowance resets).
export function nextIsaReset(today = new Date()) {
  const y = today.getFullYear();
  const thisYear = new Date(y, 3, 5);
  return today < thisYear ? thisYear : new Date(y + 1, 3, 5);
}

// A provider's account as one name, without repeating the provider when the
// product name already includes it.
export function accountName(o) {
  const provider = o.provider, product = o.product;
  if (!product) return provider;
  if (provider.toLowerCase().includes(product.toLowerCase())) return provider;
  if (product.toLowerCase().includes(provider.toLowerCase())) return product;
  return `${provider} ${product}`;
}

// Where the user's cash is now: each account they've entered (with its name,
// if they gave one), or their whole balance at their average rate if they
// haven't listed accounts. Premium Bonds aren't included.
export function cashSources(d, m) {
  const tiers = (d.cashTiers || []).map((t, index) => ({ index, name: (t.name || "").trim() || null, amount: +t.amount || 0, ratePct: +t.rate || 0 }))
    .filter(t => t.amount > 0);
  if (tiers.length) return tiers;
  return m.cash > 0 ? [{ index: null, name: null, amount: m.cash, ratePct: +m.savingsRate || 0 }] : [];
}

// Takes up to `limit` from the accounts paying less than `ratePct`, lowest
// rate first: the money that gains most from moving.
function draw(sources, ratePct, limit) {
  let left = limit;
  const from = [];
  for (const s of [...sources].sort((a, b) => a.ratePct - b.ratePct)) {
    if (left <= 0 || s.ratePct >= ratePct || s.amount <= 0) continue;
    const amount = Math.min(s.amount, left);
    from.push({ index: s.index, name: s.name, ratePct: s.ratePct, amount });
    left -= amount;
  }
  const amount = from.reduce((t, f) => t + f.amount, 0);
  return { amount, from, gain: from.reduce((t, f) => t + f.amount * (ratePct - f.ratePct) / 100, 0) };
}

function minus(sources, from) {
  return sources.map(s => {
    const taken = from.filter(f => f.index === s.index).reduce((t, f) => t + f.amount, 0);
    return { ...s, amount: s.amount - taken };
  });
}

// The providers for one section, highest rate first, each with what moving
// to it would take (from which accounts) and earn.
function optionsFor(rows, isIsa, sources, limit) {
  const seen = new Set();
  return (rows || [])
    .filter(r => r.is_isa === isIsa && isEasyAccess(r))
    .map(r => ({ provider: r.provider_name, product: r.product_name || null, accountType: r.account_type, url: r.product_url || null,
      ratePct: +r.rate_aer, cap: +r.max_balance > 0 ? +r.max_balance : null, updatedAt: r.updated_at || null, isa: isIsa }))
    .sort((a, b) => b.ratePct - a.ratePct)
    .filter(o => { const k = `${o.provider}|${o.product}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .map(o => ({ ...o, id: `${isIsa ? "isa" : "savings"}:${o.provider}:${o.product || ""}:${o.ratePct}`, ...draw(sources, o.ratePct, Math.min(limit, o.cap ?? Infinity)) }))
    .filter(o => o.amount > 0 && o.gain > 0)
    .slice(0, OPTIONS_PER_SECTION);
}

// Everything the cash walkthrough shows. `skipIsa`: the user is keeping their
// ISA allowance for investing. `isaChoice`/`savingsChoice`: the option ids
// they've picked, if any. Savings options are worked out on what's left once
// the ISA choice (or, before one's made, the top ISA option) has taken its
// share (before one's picked, the ISA option that earns most), so the two
// never count the same money.
export function cashPlan(d, m, rows, { skipIsa = false, isaChoice = null, savingsChoice = null } = {}) {
  const sources = cashSources(d, m);
  if (!sources.length || !Array.isArray(rows) || !rows.length) return null;
  const isaLeft = Math.max(0, +m.isaHeadroom || 0);
  const isaOptions = !skipIsa && isaLeft > 0 ? optionsFor(rows, true, sources, isaLeft) : [];
  const isaPick = isaOptions.find(o => o.id === isaChoice) || null;
  const isaAssumed = isaPick || isaOptions.reduce((b, o) => (!b || o.gain > b.gain ? o : b), null);
  const savingsOptions = optionsFor(rows, false, isaAssumed ? minus(sources, isaAssumed.from) : sources, Infinity);
  const savingsPick = savingsOptions.find(o => o.id === savingsChoice) || null;
  const best = list => list.reduce((b, o) => Math.max(b, o.gain), 0);
  return {
    sources,
    cash: sources.reduce((t, s) => t + s.amount, 0),
    currentInterest: sources.reduce((t, s) => t + s.amount * s.ratePct / 100, 0),
    bonds: +m.bonds || 0,
    isaLeft, skipIsa,
    isa: { options: isaOptions, pick: isaPick },
    savings: { options: savingsOptions, pick: savingsPick },
    upTo: (isaPick ? isaPick.gain : best(isaOptions)) + (savingsPick ? savingsPick.gain : best(savingsOptions)),
    chosenGain: (isaPick?.gain || 0) + (savingsPick?.gain || 0),
    // What the figures rest on: when it changes (a rate moves, a provider
    // appears), there's something new to show.
    signature: [...isaOptions, ...savingsOptions].map(o => o.id).join("|"),
  };
}

// The things Assist has to raise right now. One kind in v1: cash that could
// earn meaningfully more. Not raised while the user has said "not now" to
// these exact figures; raised again once the rates behind them change.
export function assistItems(d, m, rows, today = new Date()) {
  const plan = cashPlan(d, m, rows, { skipIsa: d?.assistSkipIsa === true });
  if (!plan || plan.upTo < MIN_ASSIST_GAIN) return [];
  if (d?.assistSnoozed?.cash === plan.signature) return [];
  const daysToReset = Math.ceil((nextIsaReset(today) - today) / 864e5);
  const isaNote = plan.isa.options.length && daysToReset <= ISA_DEADLINE_DAYS
    ? `Your ISA allowance resets on 5 April, in ${daysToReset} day${daysToReset === 1 ? "" : "s"}.`
    : null;
  return [{ id: "cash", gain: plan.upTo, signature: plan.signature, isaNote }];
}

// The dot on the Assist button: something to show that the user hasn't
// opened Assist to see yet.
export function assistHasNews(items, seenSignatures = []) {
  return items.some(i => !seenSignatures.includes(i.signature));
}

// "Update Candid to match": the user's figures once they've made the moves
// they've marked done. Each move comes out of the accounts it was drawn
// from; an ISA move counts towards this year's ISA allowance; a savings move
// becomes an account of its own, named after the provider.
export function applyCashMove(d, m, plan, doneMoves) {
  const tiers = plan.sources.map(s => ({ ...(s.index != null ? d.cashTiers[s.index] : {}), name: s.name || undefined, amount: s.amount, rate: s.ratePct }));
  const byIndex = idx => tiers[plan.sources.findIndex(s => s.index === idx)];
  let isaMoved = 0;
  for (const move of doneMoves) {
    for (const f of move.from) { const t = byIndex(f.index); if (t) t.amount -= f.amount; }
    if (move.isa) isaMoved += move.amount;
    else tiers.push({ name: accountName(move), amount: move.amount, rate: move.ratePct });
  }
  const cashTiers = tiers
    .filter(t => t.amount >= 1)
    .map(t => ({ ...(t.name ? { name: t.name } : {}), amount: String(Math.round(t.amount)), rate: String(t.rate) }));
  return {
    cashTiers: cashTiers.length ? cashTiers : [{ amount: "", rate: "" }],
    ...(isaMoved > 0 ? { isaThisYearCash: String(Math.min(ISA_ALLOWANCE, (+d.isaThisYearCash || 0) + Math.round(isaMoved))) } : {}),
  };
}
