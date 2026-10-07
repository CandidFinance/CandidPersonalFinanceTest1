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
//
// Accounts opened through Assist are remembered (d.assistAccounts), so it can
// come back of its own accord: when a bonus rate is about to end, or when the
// provider cuts the rate.

// Below this a year, a change isn't worth raising.
export const MIN_ASSIST_GAIN = 50;
// Splitting across two accounts adds less than this a year: worth saying so.
export const MIN_SPLIT_GAIN = 25;
// The ISA allowance reset is mentioned within this many days of 5 April.
export const ISA_DEADLINE_DAYS = 56;
// A bonus rate ending is raised this many days before it ends.
export const BONUS_WARNING_DAYS = 28;
// Providers shown per section, so it's always a choice, never one account.
export const OPTIONS_PER_SECTION = 4;

const DAY = 864e5;
const isoDay = date => date.toISOString().slice(0, 10);
const daysUntil = (iso, today) => Math.ceil((new Date(`${iso}T00:00:00Z`) - new Date(`${isoDay(today)}T00:00:00Z`)) / DAY);

// The next 5 April (the day the ISA allowance resets).
export function nextIsaReset(today = new Date()) {
  const y = today.getFullYear();
  const thisYear = new Date(y, 3, 5);
  return today < thisYear ? thisYear : new Date(y + 1, 3, 5);
}

// The date `months` after an ISO date, as an ISO date.
export function addMonths(iso, months) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
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

// A savings_rates row as an option, with its rate period when the feed has
// it: how many months the headline rate lasts (a bonus, an introductory
// rate, or a rate "for 12 months"), and what it drops to after, if known.
function asOption(r, isIsa) {
  const months = +r.bonus_months > 0 ? +r.bonus_months : null;
  const after = r.rate_after != null ? +r.rate_after : +r.bonus_rate > 0 ? Math.round((+r.rate_aer - +r.bonus_rate) * 100) / 100 : null;
  return {
    rateId: r.id || null, provider: r.provider_name, product: r.product_name || null, accountType: r.account_type, url: r.product_url || null,
    ratePct: +r.rate_aer, cap: +r.max_balance > 0 ? +r.max_balance : null, updatedAt: r.updated_at || null, isa: isIsa,
    bonusMonths: months,
    rateAfterBonus: months ? after : null,
  };
}

// The providers for one section, highest rate first, each with what moving
// to it would take (from which accounts) and earn. `exclude` leaves out one
// account (the one already picked, or the one the money is moving from).
function optionsFor(rows, isIsa, sources, limit, exclude = null) {
  const seen = new Set();
  return (rows || [])
    .filter(r => r.is_isa === isIsa && isEasyAccess(r))
    .map(r => asOption(r, isIsa))
    .sort((a, b) => b.ratePct - a.ratePct)
    .filter(o => { const k = `${o.provider}|${o.product}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .filter(o => !exclude || o.provider !== exclude.provider || o.product !== exclude.product)
    .map(o => ({ ...o, id: `${isIsa ? "isa" : "savings"}:${o.provider}:${o.product || ""}:${o.ratePct}`, ...draw(sources, o.ratePct, Math.min(limit, o.cap ?? Infinity)) }))
    .filter(o => o.amount > 0 && o.gain > 0)
    .slice(0, OPTIONS_PER_SECTION);
}

const EMPTY_SECTION = { options: [], pick: null, second: null, secondOptions: [], leftover: 0, split: null, bestSingle: null, from: [], gain: 0 };

// One section (Cash ISA or savings account). When the pick is capped and
// money is left over, a second choice of providers for the rest, and how the
// two together compare with putting everything in the best single account.
function section(rows, isIsa, sources, limit, choice, choice2) {
  const options = optionsFor(rows, isIsa, sources, limit);
  const pick = options.find(o => o.id === choice) || null;
  const bestSingle = options.reduce((b, o) => (!b || o.gain > b.gain ? o : b), null);
  let second = null, secondOptions = [], leftover = 0, split = null;
  if (pick && pick.cap != null) {
    leftover = Math.max(0, Math.max(...options.map(o => o.amount)) - pick.amount);
    if (leftover > 0) {
      secondOptions = optionsFor(rows, isIsa, minus(sources, pick.from), limit - pick.amount, pick);
      second = secondOptions.find(o => o.id === choice2) || null;
    }
  }
  // Compared with the best account that could take all of it (no cap).
  const bestWhole = options.filter(o => o.cap == null).reduce((b, o) => (!b || o.gain > b.gain ? o : b), null);
  if (pick && second && bestWhole) {
    const together = pick.gain + second.gain;
    split = { together, single: bestWhole, extra: together - bestWhole.gain };
  }
  const picks = [pick, second].filter(Boolean);
  return {
    options, pick, second, secondOptions, leftover, split, bestSingle,
    from: picks.flatMap(p => p.from),
    gain: picks.reduce((t, p) => t + p.gain, 0),
  };
}

// Everything the cash walkthrough shows. `skipIsa`: the user is keeping their
// ISA allowance for investing. The choices are the option ids they've picked
// (a second in a section only after a capped first). Savings options are
// worked out on what's left once the ISA choice (before one's picked, the
// ISA option that earns most) has taken its share, so the two never count
// the same money.
export function cashPlan(d, m, rows, { skipIsa = false, isaChoice = null, isaChoice2 = null, savingsChoice = null, savingsChoice2 = null } = {}) {
  const sources = cashSources(d, m);
  if (!sources.length || !Array.isArray(rows) || !rows.length) return null;
  const isaLeft = Math.max(0, +m.isaHeadroom || 0);
  const isa = !skipIsa && isaLeft > 0 ? section(rows, true, sources, isaLeft, isaChoice, isaChoice2) : EMPTY_SECTION;
  const isaTaken = isa.pick ? isa.from : isa.bestSingle?.from || [];
  const savings = section(rows, false, minus(sources, isaTaken), Infinity, savingsChoice, savingsChoice2);
  const best = s => s.pick ? s.gain : s.bestSingle?.gain || 0;
  return {
    sources,
    cash: sources.reduce((t, s) => t + s.amount, 0),
    currentInterest: sources.reduce((t, s) => t + s.amount * s.ratePct / 100, 0),
    bonds: +m.bonds || 0,
    isaLeft, skipIsa, isa, savings,
    picks: [isa.pick, isa.second, savings.pick, savings.second].filter(Boolean),
    upTo: best(isa) + best(savings),
    chosenGain: isa.gain + savings.gain,
    // What the figures rest on: when it changes (a rate moves, a provider
    // appears), there's something new to show.
    signature: [...isa.options, ...savings.options].map(o => o.id).join("|"),
  };
}

// Accounts opened through Assist that need a look: a rate period ending
// within BONUS_WARNING_DAYS (or already ended), or the provider having cut
// the rate since. Each comes with the alternatives. When the rate it drops
// to is known, they're worked out against it; when it isn't (toRate null),
// each shows what it would earn in a year instead.
export function accountItems(d, rows, today = new Date()) {
  const items = [];
  for (const a of d?.assistAccounts || []) {
    let kind = null, toRate = null, date = null;
    if (a.bonusEndsAt && daysUntil(a.bonusEndsAt, today) <= BONUS_WARNING_DAYS) {
      kind = "bonus"; toRate = a.rateAfterBonus ?? null; date = a.bonusEndsAt;
    } else {
      const live = (rows || []).find(r => r.id && r.id === a.rateId);
      if (live && +live.rate_aer < a.ratePct - 0.005) { kind = "cut"; toRate = +live.rate_aer; }
    }
    if (!kind) continue;
    const source = [{ index: null, name: a.name, amount: a.amount, ratePct: toRate ?? 0 }];
    items.push({
      id: `account:${a.id}`, kind, account: a, fromRate: a.ratePct, toRate, date,
      daysLeft: date ? daysUntil(date, today) : null,
      loss: toRate != null ? a.amount * (a.ratePct - toRate) / 100 : null,
      options: optionsFor(rows, a.isa, source, Infinity, a),
      signature: `account:${a.id}:${kind}:${kind === "bonus" ? date : toRate}`,
    });
  }
  return items;
}

// The things Assist has to raise right now: accounts that need a look first,
// then cash that could earn meaningfully more. The cash item isn't raised
// while the user has said "not now" to these exact figures; it's raised
// again once the rates behind them change.
export function assistItems(d, m, rows, today = new Date()) {
  const items = accountItems(d, rows, today);
  const plan = cashPlan(d, m, rows, { skipIsa: d?.assistSkipIsa === true });
  if (plan && plan.upTo >= MIN_ASSIST_GAIN && d?.assistSnoozed?.cash !== plan.signature) {
    const daysToReset = Math.ceil((nextIsaReset(today) - today) / DAY);
    const isaNote = plan.isa.options.length && daysToReset <= ISA_DEADLINE_DAYS
      ? `Your ISA allowance resets on 5 April, in ${daysToReset} day${daysToReset === 1 ? "" : "s"}.`
      : null;
    items.push({ id: "cash", gain: plan.upTo, signature: plan.signature, isaNote });
  }
  return items;
}

// The dot on the Assist button: something to show that the user hasn't
// opened Assist to see yet.
export function assistHasNews(items, seenSignatures = []) {
  return items.some(i => !seenSignatures.includes(i.signature));
}

// An account Assist will keep an eye on, from a move the user has made.
export function trackAccount(move, today = new Date()) {
  const openedAt = isoDay(today);
  return {
    id: `${move.rateId || accountName(move)}:${openedAt}`,
    rateId: move.rateId || null, provider: move.provider, product: move.product, name: accountName(move), url: move.url || null,
    isa: !!move.isa, amount: Math.round(move.amount), ratePct: move.ratePct, openedAt,
    bonusEndsAt: move.bonusMonths ? addMonths(openedAt, move.bonusMonths) : null,
    rateAfterBonus: move.bonusMonths ? move.rateAfterBonus : null,
  };
}

// "Update Candid to match": the user's figures once they've made the moves
// they've marked done. Each move comes out of the accounts it was drawn
// from; an ISA move counts towards this year's ISA allowance; a savings move
// becomes an account of its own, named after the provider. Every move is
// remembered so Assist can raise it again when its rate changes.
export function applyCashMove(d, m, plan, doneMoves, today = new Date()) {
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
    assistAccounts: [...(d.assistAccounts || []), ...doneMoves.map(mv => trackAccount(mv, today))],
  };
}

// Settling an account item. With `movedTo` (an option the money has moved
// to), the account is replaced by the new one; otherwise the user is keeping
// it, now at the lower rate. A savings account's entry in the user's cash
// follows: renamed and re-rated, or just re-rated. (An ISA transfer doesn't
// touch their cash or use this year's allowance.)
export function resolveAccount(d, item, movedTo = null, today = new Date()) {
  const a = item.account;
  const accounts = (d.assistAccounts || []).filter(x => x.id !== a.id);
  // Kept with the new rate unknown: the rate stays as it was until the user
  // updates it, and the ended period is no longer raised.
  const keptRate = item.toRate ?? a.ratePct;
  if (movedTo) accounts.push(trackAccount({ ...movedTo, amount: a.amount }, today));
  else accounts.push({ ...a, ratePct: keptRate, bonusEndsAt: null, rateAfterBonus: null });
  const patch = { assistAccounts: accounts };
  if (!a.isa) {
    patch.cashTiers = (d.cashTiers || []).map(t => (t.name || "").trim() === a.name
      ? { ...t, rate: String(movedTo ? movedTo.ratePct : keptRate), ...(movedTo ? { name: accountName(movedTo) } : {}) }
      : t);
  }
  return patch;
}
