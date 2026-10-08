import { isEasyAccess, premiumBondsRow } from "./savingsRates.js";
import { PSA_BY_BAND, cashIsaLimit } from "./tax.js";
import { taxYearFor } from "./taxYear.js";
import { PB_RATE } from "./cash.js";

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
// The most anyone can hold in Premium Bonds.
export const PB_MAX = 50000;
// Premium Bonds the user already holds only move into an account when that
// adds at least this a year: cashing in bonds for a few pounds isn't worth it.
export const MIN_PB_MOVE_GAIN = 25;

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

// Takes up to `limit` from the accounts that `beats` (by default, those
// paying less than `ratePct`), lowest rate first: the money that gains most
// from moving. `gain` is before tax; cashPlan works out the after-tax figure.
function draw(sources, ratePct, limit, beats = s => s.ratePct < ratePct) {
  let left = limit;
  const from = [];
  for (const s of [...sources].sort((a, b) => a.ratePct - b.ratePct)) {
    if (left <= 0 || !beats(s) || s.amount <= 0) continue;
    const amount = Math.min(s.amount, left);
    from.push({ index: s.index, name: s.name, ratePct: s.ratePct, amount, ...(s.taxFree ? { taxFree: true } : {}) });
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

// Interest a year on accounts outside an ISA (before tax).
const taxableInterest = sources => sources.reduce((t, s) => t + s.amount * s.ratePct / 100, 0);
const interestOn = from => from.reduce((t, f) => t + f.amount * f.ratePct / 100, 0);
// What a move takes, split by tax: interest that was taxable, and prizes
// that were tax-free (Premium Bonds the user already holds).
const taxableOn = from => interestOn(from.filter(f => !f.taxFree));
const taxFreeOn = from => interestOn(from.filter(f => f.taxFree));
const heldTaken = from => from.filter(f => f.taxFree).reduce((t, f) => t + f.amount, 0);

// Tax on savings interest: nothing up to the Personal Savings Allowance,
// the savings rate for the user's band above it (2 points over income tax
// from April 2027). ISA interest and Premium Bonds prizes are tax-free and
// never count towards it.
export function savingsTax(m) {
  const rate = +(m.savingsTr ?? m.tr) || 0;
  const allowance = PSA_BY_BAND[m.taxBandLabel] ?? 0;
  return { rate, allowance, kept: interest => interest - rate * Math.max(0, interest - allowance) };
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
    // The provider's app (confirmed links only), and whether the account
    // can only be opened in it.
    appOnly: r.app_only === true, iosAppUrl: r.ios_app_url || null, androidAppUrl: r.android_app_url || null,
    bonusMonths: months,
    rateAfterBonus: months ? after : null,
  };
}

// The providers for one section, highest rate first, each with what moving
// to it would take (from which accounts) and earn. `exclude` leaves out one
// account (the one already picked, or the one the money is moving from).
// `value` turns a move into what it earns a year (after tax, in cashPlan);
// `limitFor` can hold an account to less than everything available.
// `extend` can add to a move after the cash is drawn (Premium Bonds held).
function optionsFor(rows, isIsa, sources, limit, exclude = null, { value = null, limitFor = null, extend = null } = {}) {
  const seen = new Set();
  return (rows || [])
    .filter(r => r.is_isa === isIsa && isEasyAccess(r))
    .map(r => asOption(r, isIsa))
    .sort((a, b) => b.ratePct - a.ratePct)
    .filter(o => { const k = `${o.provider}|${o.product}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .filter(o => !exclude || o.provider !== exclude.provider || o.product !== exclude.product)
    .map(o => {
      const cash = draw(sources, o.ratePct, Math.min(limit, o.cap ?? Infinity, limitFor ? limitFor(o) : Infinity));
      const moved = extend ? extend(o, cash) : cash;
      return { ...o, id: `${isIsa ? "isa" : "savings"}:${o.provider}:${o.product || ""}:${o.ratePct}`, ...moved, ...(value ? { gain: value(o, moved.from) } : {}) };
    })
    .filter(o => o.amount > 0 && o.gain > 0)
    .slice(0, OPTIONS_PER_SECTION);
}

const EMPTY_SECTION = { options: [], pick: null, second: null, secondOptions: [], leftover: 0, split: null, bestSingle: null, from: [], gain: 0, picks: [] };

// One section (Cash ISA or savings account). When the pick is capped and
// money is left over, a second choice of providers for the rest, and how the
// two together compare with putting everything in the best single account.
function section(options, choice, choice2, secondFor) {
  const pick = options.find(o => o.id === choice) || null;
  const bestSingle = options.reduce((b, o) => (!b || o.gain > b.gain ? o : b), null);
  let second = null, secondOptions = [], leftover = 0, split = null;
  if (pick && pick.cap != null) {
    leftover = Math.max(0, Math.max(...options.map(o => o.amount)) - pick.amount);
    if (leftover > 0) {
      secondOptions = secondFor(pick);
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
    options, pick, second, secondOptions, leftover, split, bestSingle, picks,
    from: picks.flatMap(p => p.from),
    gain: picks.reduce((t, p) => t + p.gain, 0),
  };
}

// The most a savings account at `ratePct` can take before its interest, with
// what's left where it is, goes over the Personal Savings Allowance. Beyond
// that, Premium Bonds' tax-free prizes can pay more than it keeps after tax.
// `extra`: taxable interest already coming from elsewhere (an account just
// picked), which uses up the allowance too.
function withinAllowance(sources, ratePct, allowance, extra = 0) {
  const total = sources.filter(s => s.ratePct < ratePct).reduce((t, s) => t + s.amount, 0);
  const interestAfter = x => { const mv = draw(sources, ratePct, x); return extra + taxableInterest(sources) - interestOn(mv.from) + mv.amount * ratePct / 100; };
  if (interestAfter(0) >= allowance) return 0;
  if (interestAfter(total) <= allowance) return total;
  let lo = 0, hi = total;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (interestAfter(mid) <= allowance) lo = mid; else hi = mid; }
  return Math.floor(lo);
}

// Everything the cash walkthrough shows, with every figure after tax. Three
// sections, the user picking in any or none:
//  - Cash ISA: tax-free, up to this year's allowance. `skipIsa`: the user is
//    keeping the allowance for investing.
//  - Savings account: interest taxed above the Personal Savings Allowance.
//    Where Premium Bonds would pay more than an account keeps after tax,
//    the account's amount stops at the allowance and the rest is Premium
//    Bonds' to offer.
//  - Premium Bonds: tax-free prizes at NS&I's prize fund rate (an average,
//    not a guaranteed return), up to £50,000 in all. `skipPb`: not for them.
// Each section works on what the one before it has taken (before a pick,
// the option that earns most), so no money is counted twice.
export function cashPlan(d, m, rows, { skipIsa = false, skipPb = false, isaChoice = null, isaChoice2 = null, savingsChoice = null, savingsChoice2 = null, pbChoice = null } = {}) {
  const sources = cashSources(d, m);
  if (!sources.length || !Array.isArray(rows) || !rows.length) return null;
  const tax = savingsTax(m);
  const base = taxableInterest(sources);
  // What a move earns a year after tax, on top of `before` taxable interest.
  const kept = (before, from, ratePct, taxFree) => {
    const added = from.reduce((t, f) => t + f.amount, 0) * ratePct / 100;
    const change = taxFree
      ? tax.kept(before - taxableOn(from)) - tax.kept(before) + added
      : tax.kept(before - taxableOn(from) + added) - tax.kept(before);
    return change - taxFreeOn(from);
  };

  // Premium Bonds: the live prize fund rate, if the feed has it.
  const pbRow = premiumBondsRow(rows);
  const pbRate = pbRow ? +pbRow.rate_aer : null;

  // Premium Bonds the user already holds can move too, as the last money
  // into a Cash ISA or savings account paying more than the prize fund rate:
  // into a savings account only while its interest stays within the
  // allowance (beyond it, the bonds' tax-free prizes pay more). They're kept
  // in the move only if they add MIN_PB_MOVE_GAIN a year or more.
  const held = +m.bonds || 0;
  const heldRate = pbRate ?? PB_RATE * 100;
  const withHeld = ({ before, taxFree, available, room }) => (o, moved) => {
    if (!held || available <= 0 || o.ratePct <= heldRate) return moved;
    let amount = Math.min(available, room(o, moved));
    if (!taxFree && o.ratePct * (1 - tax.rate) < heldRate) {
      const interestAfter = before - taxableOn(moved.from) + moved.amount * o.ratePct / 100;
      amount = Math.min(amount, Math.max(0, tax.allowance - interestAfter) / (o.ratePct / 100));
    }
    amount = Math.floor(amount);
    if (amount <= 0) return moved;
    const from = [...moved.from, { index: "pb", name: "Premium Bonds", ratePct: heldRate, amount, taxFree: true }];
    if (kept(before, from, o.ratePct, taxFree) - kept(before, moved.from, o.ratePct, taxFree) < MIN_PB_MOVE_GAIN) return moved;
    return { ...moved, from, amount: moved.amount + amount, gain: moved.gain + amount * (o.ratePct - heldRate) / 100 };
  };

  // Cash ISA
  // Room for cash in a Cash ISA: from April 2027, £12,000 for under-65s.
  const isaLeft = Math.max(0, +(m.cashIsaHeadroom ?? m.isaHeadroom) || 0);
  const isaLimit = cashIsaLimit(taxYearFor(d), d.age);
  const isaValue = before => (o, from) => kept(before, from, o.ratePct, true);
  const isaRoom = left => (o, moved) => Math.min(left, o.cap ?? Infinity) - moved.amount;
  const isaOptions = !skipIsa && isaLeft > 0 ? optionsFor(rows, true, sources, isaLeft, null, {
    value: isaValue(base), extend: withHeld({ before: base, taxFree: true, available: held, room: isaRoom(isaLeft) }),
  }) : [];
  const isa = isaOptions.length ? section(isaOptions, isaChoice, isaChoice2, pick => {
    const after = minus(sources, pick.from);
    const before = taxableInterest(after);
    return optionsFor(rows, true, after, isaLeft - pick.amount, pick, {
      value: isaValue(before), extend: withHeld({ before, taxFree: true, available: held - heldTaken(pick.from), room: isaRoom(isaLeft - pick.amount) }),
    });
  }) : EMPTY_SECTION;
  const isaTaken = isa.pick ? isa.from : isa.bestSingle?.from || [];
  const afterIsa = minus(sources, isaTaken);

  // Buying Premium Bonds: if the feed has the rate and the user wants them.
  const pbRoom = Math.max(0, PB_MAX - held);
  const pbInPlay = pbRate != null && !skipPb && pbRoom > 0;

  // Savings account
  const savingsValue = before => (o, from) => kept(before, from, o.ratePct, false);
  const savingsLimit = srcs => o => (pbInPlay && o.ratePct * (1 - tax.rate) < pbRate ? withinAllowance(srcs, o.ratePct, tax.allowance) : Infinity);
  const heldAfterIsa = held - heldTaken(isaTaken);
  const savingsRoom = (o, moved) => (o.cap ?? Infinity) - moved.amount;
  const savingsOptions = optionsFor(rows, false, afterIsa, Infinity, null, {
    value: savingsValue(taxableInterest(afterIsa)), limitFor: savingsLimit(afterIsa),
    extend: withHeld({ before: taxableInterest(afterIsa), taxFree: false, available: heldAfterIsa, room: savingsRoom }),
  });
  const savings = section(savingsOptions, savingsChoice, savingsChoice2, pick => {
    const after = minus(afterIsa, pick.from);
    const before = taxableInterest(after) + pick.amount * pick.ratePct / 100;
    return optionsFor(rows, false, after, Infinity, pick, {
      value: (o, from) => kept(before, from, o.ratePct, false),
      limitFor: o => (pbInPlay && o.ratePct * (1 - tax.rate) < pbRate ? withinAllowance(after, o.ratePct, tax.allowance, pick.amount * pick.ratePct / 100) : Infinity),
      extend: withHeld({ before, taxFree: false, available: heldAfterIsa - heldTaken(pick.from), room: savingsRoom }),
    });
  });
  const savingsTaken = savings.pick ? savings.picks : savings.bestSingle ? [savings.bestSingle] : [];
  const afterSavings = minus(afterIsa, savingsTaken.flatMap(p => p.from));
  const pbBefore = taxableInterest(afterSavings) + savingsTaken.reduce((t, p) => t + p.amount * p.ratePct / 100, 0);
  // Bonds being cashed in for an ISA or savings account aren't bought back.
  const heldMovingOut = heldTaken([...isaTaken, ...savingsTaken.flatMap(p => p.from)]);

  // Premium Bonds: the money whose interest, after tax, pays less than the
  // prize fund rate.
  let pbOptions = [];
  if (pbInPlay && heldMovingOut === 0) {
    const overAllowance = pbBefore > tax.allowance;
    const moved = draw(afterSavings, pbRate, pbRoom, s => s.ratePct * (1 - (overAllowance ? tax.rate : 0)) < pbRate);
    const gain = kept(pbBefore, moved.from, pbRate, true);
    if (moved.amount > 0 && gain > 0) {
      pbOptions = [{
        ...asOption(pbRow, false), id: `pb:${pbRate}`, pb: true, provider: "NS&I", product: "Premium Bonds",
        cap: pbRoom, ...moved, gain,
      }];
    }
  }
  const pb = { options: pbOptions, pick: pbOptions.find(o => o.id === pbChoice) || null, room: pbRoom, rate: pbRate, inPlay: pbInPlay };

  // Totals, all moves taken together, after tax.
  const together = moves => {
    const from = moves.flatMap(p => p.from);
    const taxFree = moves.filter(p => p.isa || p.pb).reduce((t, p) => t + p.amount * p.ratePct / 100, 0);
    const taxable = moves.filter(p => !p.isa && !p.pb).reduce((t, p) => t + p.amount * p.ratePct / 100, 0);
    return tax.kept(base - taxableOn(from) + taxable) - tax.kept(base) + taxFree - taxFreeOn(from);
  };
  const picks = [...isa.picks, ...savings.picks, pb.pick].filter(Boolean);
  const best = [...(isa.pick ? isa.picks : isa.bestSingle ? [isa.bestSingle] : []), ...savingsTaken, ...(pb.pick ? [pb.pick] : pb.options.slice(0, 1))];
  return {
    sources,
    cash: sources.reduce((t, s) => t + s.amount, 0),
    currentInterest: base,
    currentKept: tax.kept(base),
    bonds: held, bondsRate: heldRate,
    tax, isaLeft, isaLimit, skipIsa, skipPb, isa, savings, pb,
    picks,
    upTo: together(best),
    chosenGain: together(picks),
    // What the figures rest on: when it changes (a rate moves, a provider
    // appears), there's something new to show.
    signature: [...isa.options, ...savings.options, ...pb.options].map(o => o.id).join("|"),
  };
}

// The Cash opportunity, the one figure for "more your savings could earn"
// everywhere it appears (Home, the Cash screen, Explain this, Assist): the
// best choice in each section, together, after tax, respecting what the
// user has told Assist (keeping their ISA allowance, no Premium Bonds).
// `lines` are those choices, for showing where the figure comes from.
// Null until the rates have loaded.
export function cashOpportunity(d, m, rows) {
  const plan = cashPlan(d, m, rows, { skipIsa: d?.assistSkipIsa === true, skipPb: d?.assistSkipPb === true });
  if (!plan) return null;
  const lines = [
    plan.isa.bestSingle && { section: "Cash ISA", option: plan.isa.bestSingle },
    plan.savings.bestSingle && { section: "Savings account", option: plan.savings.bestSingle },
    plan.pb.options[0] && { section: "Premium Bonds", option: plan.pb.options[0] },
  ].filter(Boolean);
  return { gain: Math.max(0, plan.upTo), lines, currentKept: plan.currentKept, cash: plan.cash };
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
      id: `account:${a.id}`, module: "cash", kind, account: a, fromRate: a.ratePct, toRate, date,
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
  const plan = cashPlan(d, m, rows, { skipIsa: d?.assistSkipIsa === true, skipPb: d?.assistSkipPb === true });
  if (plan && plan.upTo >= MIN_ASSIST_GAIN && d?.assistSnoozed?.cash !== plan.signature) {
    const daysToReset = Math.ceil((nextIsaReset(today) - today) / DAY);
    const isaNote = plan.isa.options.length && daysToReset <= ISA_DEADLINE_DAYS
      ? `Your ISA allowance resets on 5 April, in ${daysToReset} day${daysToReset === 1 ? "" : "s"}.`
      : null;
    items.push({ id: "cash", module: "cash", gain: plan.upTo, signature: plan.signature, isaNote });
  }
  return items;
}

// Assist on a page: a module page sees only that module's items, with the
// rest listed as elsewhere; an overview page (no module) sees everything.
export function itemsForPage(items, page) {
  if (!page) return { here: items, elsewhere: [] };
  return { here: items.filter(i => i.module === page), elsewhere: items.filter(i => i.module !== page) };
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
  let isaMoved = 0, pbMoved = 0, pbCashedIn = 0;
  for (const move of doneMoves) {
    for (const f of move.from) {
      if (f.taxFree) { pbCashedIn += f.amount; continue; }
      const t = byIndex(f.index); if (t) t.amount -= f.amount;
    }
    if (move.isa) isaMoved += move.amount;
    else if (move.pb) pbMoved += move.amount;
    else tiers.push({ name: accountName(move), amount: move.amount, rate: move.ratePct });
  }
  const cashTiers = tiers
    .filter(t => t.amount >= 1)
    .map(t => ({ ...(t.name ? { name: t.name } : {}), amount: String(Math.round(t.amount)), rate: String(t.rate) }));
  return {
    cashTiers: cashTiers.length ? cashTiers : [{ amount: "", rate: "" }],
    ...(isaMoved > 0 ? { isaThisYearCash: String(Math.min(cashIsaLimit(taxYearFor(d), d.age), (+d.isaThisYearCash || 0) + Math.round(isaMoved))) } : {}),
    // Premium Bonds bought: added to the user's holding, not a cash account.
    ...(pbMoved > 0 || pbCashedIn > 0 ? { premiumBonds: String(Math.max(0, Math.min(PB_MAX, (+d.premiumBonds || plan.bonds || 0) + Math.round(pbMoved) - Math.round(pbCashedIn)))) } : {}),
    ...(pbMoved > 0 ? { hasPremiumBonds: "yes" } : {}),
    // Premium Bonds have no account rate or bonus to watch, so aren't tracked.
    assistAccounts: [...(d.assistAccounts || []), ...doneMoves.filter(mv => !mv.pb).map(mv => trackAccount(mv, today))],
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
