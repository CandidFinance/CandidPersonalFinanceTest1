// Editing an account from Progress's net worth (MobileWorthDetail.jsx): the
// answers each account is made from, as fields to change, and what saving,
// removing or hiding it writes back. Every account on Progress is read from
// the answers (netWorthView.js), so an edit here is the same as one in Edit
// inputs: the modules work it out again. Pure, unit tested in
// worthEdit.test.js.
//
// Hidden accounts (`worthHidden`, their ids) leave their rows for a Hidden
// row at the foot of their tile, still counted (Harvey, 11 Nov 2026).

const num = v => +v || 0;
const str = v => (v === "" || v == null ? "" : String(v));
const ISA = { "isa-cash": "Cash", "isa-ss": "SS", "isa-lisa": "LISA", "isa-other": "Other" };
const ISA_PREV = ["isaPrevCash", "isaPrevSS", "isaPrevLISA", "isaPrevOther"];

const tiersOf = d => (Array.isArray(d.cashTiers) ? d.cashTiers : []);
// Cash is listed by its accounts once any has a balance; before that, as
// one figure (cashSavings), shown as cash-0.
const hasTiers = d => tiersOf(d).some(t => num(t.amount) > 0);
const tierIndex = (d, id) => (hasTiers(d) && /^cash-\d+$/.test(id) ? +id.slice(5) : null);
// The ISAs given as one earlier total (isaPreviousBalance), not one by one:
// an ISA's value then is only what's been paid in this year, so only that
// is offered, or the total would be lost.
const isaAsOneTotal = d => ISA_PREV.every(f => !num(d[f])) && num(d.isaPreviousBalance) > 0;
const homeValue = d => (d.hasMortgage === "yes" ? num(d.propertyEquity) + num(d.mortgageBalance) : num(d.outrightPropertyValue));

const money = (key, label, value, hint) => ({ key, label, unit: "£", value: str(value), ...(hint && { hint }) });
const pct = (key, label, value) => ({ key, label, unit: "%", value: str(value) });

// The fields for an account (worthAccounts' `a`), each { key, label, unit
// ("£", "%" or "text"), value, hint }, and whether it can be removed.
// null: nothing here to edit.
export function editFieldsOf(d, a) {
  if (!a) return null;
  const id = a.id;
  const i = tierIndex(d, id);
  if (i != null) {
    const t = tiersOf(d)[i] || {};
    return { fields: [{ key: "name", label: "Name", unit: "text", value: str(t.name) }, money("amount", "Balance", t.amount), pct("rate", "Interest rate", t.rate)], removable: true };
  }
  if (id === "cash-0") return { fields: [money("amount", "Balance", d.cashSavings), pct("rate", "Interest rate", d.savingsRate)], removable: true };
  if (id === "premiumBonds") return { fields: [money("amount", "Held", d.premiumBonds)], removable: true };
  if (ISA[id]) {
    const f = ISA[id];
    const paid = money("paid", "Paid in this tax year", d[`isaThisYear${f}`]);
    if (isaAsOneTotal(d)) return { fields: [paid], removable: true };
    return { fields: [money("value", "Value", a.value, "Including what's been paid in this tax year"), paid], removable: true };
  }
  if (id === "isa-earlier") return { fields: [money("amount", "Value", d.isaPreviousBalance)], removable: true };
  if (id === "unwrapped") return { fields: [money("amount", "Value", d.unwrappedValue), money("gains", "Unrealised gains", d.unrealisedGains, "What it's worth now, less what it cost")], removable: true };
  if (id === "pension-current") return { fields: [money("amount", "Value", d.potValue)], removable: true };
  if (id === "pension-other") return { fields: [money("amount", "Value", d.potValue2)], removable: true };
  // The home and mortgage stay while their module is still to come; an
  // outright owner's home can go.
  if (id === "home") return { fields: [money("amount", "Value", homeValue(d))], removable: d.hasMortgage !== "yes" };
  if (id === "mortgage") return { fields: [money("amount", "Balance", d.mortgageBalance), pct("rate", "Interest rate", d.mortgageRate)], removable: false };
  if (id === "studentLoan") return { fields: [money("amount", "Balance", a.value), pct("rate", "Interest rate", d.studentLoanRate || (a.note ? parseFloat(a.note) : ""))], removable: true };
  if (id === "personalLoan") return { fields: [money("amount", "Balance", d.personalLoanBalance), pct("rate", "Interest rate", d.personalLoanRate)], removable: true };
  return null;
}

// What's wrong with the values typed (by field key), or null.
export function editProblem(d, a, v) {
  if (ISA[a.id] && v.value != null && !isaAsOneTotal(d) && num(v.value) < num(v.paid)) return "The value can't be less than what's been paid in this tax year.";
  if (a.id === "unwrapped" && num(v.gains) > num(v.amount)) return "Gains can't be more than the value.";
  if (a.id === "home" && d.hasMortgage === "yes" && num(v.amount) < num(d.mortgageBalance)) return "The home's value can't be less than the mortgage on it.";
  if (a.id === "mortgage" && num(v.amount) > homeValue(d)) return "The mortgage can't be more than the home's value.";
  return null;
}

// The answers to save for the values typed (by field key).
export function editPatch(d, a, v) {
  const id = a.id;
  const i = tierIndex(d, id);
  if (i != null) {
    const tiers = tiersOf(d).map((t, j) => (j === i ? { ...t, name: v.name ?? t.name, amount: str(v.amount), rate: str(v.rate) } : t));
    return { cashTiers: tiers };
  }
  if (id === "cash-0") return { cashSavings: str(v.amount), savingsRate: str(v.rate) };
  if (id === "premiumBonds") return { premiumBonds: str(v.amount) };
  if (ISA[id]) {
    const f = ISA[id];
    const out = { [`isaThisYear${f}`]: str(v.paid) };
    if (v.value != null && !isaAsOneTotal(d)) {
      // The value is last year's and earlier (isaPrev) plus this year's; for
      // Other ISAs, plus any total declared in Cash beyond those itemised
      // (isa.js), worked out with the new paid in.
      const declaredTotal = d.hasOtherIsaThisYear === "yes" ? num(d.isaThisYearOtherTypes) : 0;
      const declared = f === "Other" ? Math.max(0, declaredTotal - (num(d.isaThisYearSS) + num(d.isaThisYearLISA) + num(v.paid))) : 0;
      out[`isaPrev${f}`] = String(Math.max(0, Math.round(num(v.value) - num(v.paid) - declared)));
    }
    return out;
  }
  if (id === "isa-earlier") return { isaPreviousBalance: str(v.amount) };
  if (id === "unwrapped") return { unwrappedValue: str(v.amount), unrealisedGains: str(v.gains) };
  if (id === "pension-current") return { potValue: str(v.amount) };
  if (id === "pension-other") return { potValue2: str(v.amount) };
  // The home's value with a mortgage is its equity plus the mortgage; a new
  // balance keeps the home's value as it was.
  if (id === "home") return d.hasMortgage === "yes" ? { propertyEquity: String(Math.max(0, num(v.amount) - num(d.mortgageBalance))) } : { outrightPropertyValue: str(v.amount) };
  if (id === "mortgage") return { mortgageBalance: str(v.amount), mortgageRate: str(v.rate), propertyEquity: String(Math.max(0, homeValue(d) - num(v.amount))) };
  // Left as shown, Candid's estimate of the balance and the plan's own rate
  // stay as they are, not saved as answers: the rate then follows the plan.
  if (id === "studentLoan") {
    const out = {};
    if (str(d.loanBalance) !== "" || str(v.amount) !== String(a.value)) out.loanBalance = str(v.amount);
    if (str(d.studentLoanRate) !== "" || str(v.rate) !== str(a.note ? parseFloat(a.note) : "")) out.studentLoanRate = str(v.rate);
    return out;
  }
  if (id === "personalLoan") return { personalLoanBalance: str(v.amount), personalLoanRate: str(v.rate) };
  return {};
}

// The answers to save to take an account out, and out of the hidden list.
export function removePatch(d, a) {
  const id = a.id;
  const hidden = (Array.isArray(d.worthHidden) ? d.worthHidden : []).filter(h => h !== id);
  const i = tierIndex(d, id);
  if (i != null) {
    // The accounts after it move up one, and their ids with them: in the
    // hidden list and in each saved month (netWorthHistory.js), so their
    // lines keep their own past.
    const shift = id => (/^cash-\d+$/.test(id) && +id.slice(5) > i ? `cash-${+id.slice(5) - 1}` : id);
    const out = { cashTiers: tiersOf(d).filter((_, j) => j !== i), worthHidden: hidden.map(shift) };
    if (d.netWorthHistory && typeof d.netWorthHistory === "object") {
      out.netWorthHistory = Object.fromEntries(Object.entries(d.netWorthHistory).map(([k, snap]) => {
        if (!snap || typeof snap !== "object" || !snap.accts) return [k, snap];
        const accts = Object.fromEntries(Object.entries(snap.accts).filter(([id]) => id !== `cash-${i}`).map(([id, v]) => [shift(id), v]));
        return [k, { ...snap, accts }];
      }));
    }
    return out;
  }
  const out = { worthHidden: hidden };
  if (id === "cash-0") out.cashSavings = "0";
  else if (id === "premiumBonds") out.premiumBonds = "0";
  else if (ISA[id]) {
    out[`isaPrev${ISA[id]}`] = "0";
    out[`isaThisYear${ISA[id]}`] = "0";
    // A total declared in Cash shows under Other ISAs: it goes too.
    if (id === "isa-other") out.hasOtherIsaThisYear = "no";
  } else if (id === "isa-earlier") out.isaPreviousBalance = "0";
  else if (id === "unwrapped") Object.assign(out, { unwrappedValue: "0", unrealisedGains: "0" });
  else if (id === "pension-current") out.potValue = "0";
  else if (id === "pension-other") out.potValue2 = "0";
  else if (id === "home" && d.hasMortgage !== "yes") Object.assign(out, { ownsOutright: false, outrightPropertyValue: "0" });
  else if (id === "studentLoan") Object.assign(out, { studentLoan: "none", loanBalance: "0" });
  else if (id === "personalLoan") out.hasPersonalLoan = "no";
  else return null;
  return out;
}

export const hiddenIds = d => (Array.isArray(d.worthHidden) ? d.worthHidden : []);
export const isHidden = (d, id) => hiddenIds(d).includes(id);
export const hidePatch = (d, id, hide) => ({ worthHidden: hide ? [...new Set([...hiddenIds(d), id])] : hiddenIds(d).filter(h => h !== id) });
