import { calcCashOptimisation } from "./cash.js";
import { topRate } from "./savingsRates.js";
import { ISA_ALLOWANCE } from "./tax.js";

// Candid Assist: what it has to show, worked out from the user's figures and
// the live rates. The panel (src/mobile/assist/) only displays this.
//
// Assist never decides for anyone. It lays out the figures, the user picks
// what (if anything) to do, and Assist covers the how: the amount, the
// account, the link, and updating Candid afterwards.

// Below this a year, a change isn't worth raising.
export const MIN_ASSIST_GAIN = 50;
// The ISA allowance reset is mentioned within this many days of 5 April.
export const ISA_DEADLINE_DAYS = 56;

// The next 5 April (the day the ISA allowance resets).
export function nextIsaReset(today = new Date()) {
  const y = today.getFullYear();
  const thisYear = new Date(y, 3, 5);
  return today < thisYear ? thisYear : new Date(y + 1, 3, 5);
}

// The cash walkthrough's figures: the user's cash outside an ISA, spread
// across the live easy-access accounts that beat what it earns now (ISA
// allowance first, then the tax-free savings allowance), as the Cash screen
// does. Premium Bonds aren't part of it: this is cash only. Null without
// cash or rates.
export function cashMove(m, rows) {
  if (!(m?.cash > 0) || !Array.isArray(rows) || !rows.length) return null;
  const opt = calcCashOptimisation({ ...m, bonds: 0 }, topRate(rows, true)?.rate_aer ?? null, topRate(rows, false)?.rate_aer ?? null, rows);
  const current = +m.savingsRate || 0;
  const lines = [
    ...opt.isaLines.map(l => ({ ...l, isa: true })),
    ...opt.savingsLines.map(l => ({ ...l, isa: false })),
  ]
    .filter(l => l.ratePct > current)
    .map(l => ({ ...l, id: `${l.isa ? "isa" : "taxable"}:${l.provider}:${l.product || ""}:${l.ratePct}`, gain: l.amount * (l.ratePct - current) / 100 }));
  return {
    cash: m.cash,
    currentRatePct: current,
    currentInterest: m.cash * current / 100,
    lines,
    gain: lines.reduce((s, l) => s + l.gain, 0),
    // What the figures rest on: when they change (a rate moves, an account
    // appears), it's something new to show.
    signature: lines.map(l => l.id).join("|"),
  };
}

// The things Assist has to raise right now. One kind in v1: cash that could
// earn meaningfully more. Not raised while the user has said "not now" to
// these exact figures; raised again once the rates behind them change.
export function assistItems(d, m, rows, today = new Date()) {
  const move = cashMove(m, rows);
  if (!move || move.gain < MIN_ASSIST_GAIN) return [];
  if (d?.assistSnoozed?.cash === move.signature) return [];
  const reset = nextIsaReset(today);
  const daysToReset = Math.ceil((reset - today) / 864e5);
  const isaNote = m.isaHeadroom > 0 && daysToReset <= ISA_DEADLINE_DAYS && move.lines.some(l => l.isa)
    ? `Your ISA allowance resets on 5 April, in ${daysToReset} day${daysToReset === 1 ? "" : "s"}.`
    : null;
  return [{ id: "cash", gain: move.gain, signature: move.signature, isaNote, move }];
}

// The dot on the Assist button: something to show that the user hasn't
// opened Assist to see yet.
export function assistHasNews(items, seenSignatures = []) {
  return items.some(i => !seenSignatures.includes(i.signature));
}

// "Update Candid to match": the user's figures once they've moved money into
// the accounts they've marked done. ISA moves leave their cash and count
// towards this year's ISA allowance; savings moves become cash accounts at
// their new rates; what wasn't moved stays at the old rate.
export function applyCashMove(d, m, movedLines) {
  const isaMoved = movedLines.filter(l => l.isa).reduce((s, l) => s + l.amount, 0);
  const savingsMoved = movedLines.filter(l => !l.isa);
  const leftover = Math.max(0, m.cash - isaMoved - savingsMoved.reduce((s, l) => s + l.amount, 0));
  const tiers = [
    ...savingsMoved.map(l => ({ amount: String(Math.round(l.amount)), rate: String(l.ratePct) })),
    ...(leftover >= 1 ? [{ amount: String(Math.round(leftover)), rate: String(+m.savingsRate || 0) }] : []),
  ];
  const isaThisYearCash = Math.min(ISA_ALLOWANCE, (+d.isaThisYearCash || 0) + Math.round(isaMoved));
  return {
    cashTiers: tiers.length ? tiers : [{ amount: "", rate: "" }],
    ...(isaMoved > 0 ? { isaThisYearCash: String(isaThisYearCash) } : {}),
  };
}
