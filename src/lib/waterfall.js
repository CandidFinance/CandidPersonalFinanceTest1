// Decision waterfall: the checks Candid runs, in order, before money goes
// towards a property deposit. Pure functions with no React, so any screen can
// run them (see src/mobile/property/DecisionWaterfall.jsx) and they're unit
// tested on their own (waterfall.test.js).
//
//   1. Unclaimed employer pension match (each buyer)
//   2. Non-mortgage debt above 6% APR
//   3. Emergency fund below 3 months of expenses
//   4. Unused ISA allowance this tax year (each buyer)
//
// Every check has a state: "attention" (worth a look), "ok", or "missing"
// (Candid doesn't have the figures to run it yet).

export const ISA_ALLOWANCE = 20000;
export const HIGH_INTEREST_APR = 6;
export const EMERGENCY_FLOOR_MONTHS = 3;
// The usual target range, quoted in copy. Only the floor is flagged.
export const EMERGENCY_RANGE_MONTHS = [3, 6];

// Assumes the employer matches the buyer's own contribution 1:1 up to their
// cap, the same model as calcMetrics' missedMatch (src/lib/metrics.js), so
// this and the Pension module always show the same unclaimed figure.
export function checkEmployerMatch(person) {
  if (!person.pension?.known) return { who: person.who, state: "missing" };
  const { myPct = 0, employerPct = 0, noPension = false } = person.pension;
  const unclaimedPct = Math.max(0, employerPct - myPct);
  const unclaimedAnnual = Math.round(unclaimedPct * (person.salary || 0) / 100);
  return {
    who: person.who, state: unclaimedPct > 0 ? "attention" : "ok",
    myPct, employerPct, noPension, unclaimedPct, unclaimedAnnual,
  };
}

// `debts` is undefined when Candid has no debts input for this user, which
// is different from an empty list (no debts at all).
export function checkHighInterestDebt(debts) {
  if (!Array.isArray(debts)) return { state: "missing" };
  const highInterest = debts.filter(x => (+x.balance || 0) > 0 && (+x.apr || 0) > HIGH_INTEREST_APR);
  const highInterestBalance = highInterest.reduce((s, x) => s + (+x.balance || 0), 0);
  return { state: highInterest.length > 0 ? "attention" : "ok", highInterest, highInterestBalance };
}

// `cash` is cash savings plus Premium Bonds (calcMetrics' totalLiquid, the
// same figure as the Cash & savings module's emergency fund). `targetMonths`
// is the user's own 3/6/9-month choice from Cash & savings: holding more than
// the 3-month floor but less than that target isn't flagged here, but the
// copy says so, so the two screens never contradict each other.
export function checkEmergencyFund({ known, cash = 0, monthlyExpenses = 0, targetMonths = EMERGENCY_FLOOR_MONTHS }) {
  if (!known) return { state: "missing", missing: "cash" };
  if (!(monthlyExpenses > 0)) return { state: "missing", missing: "expenses" };
  const months = cash / monthlyExpenses;
  const shortfall = Math.max(0, Math.round(EMERGENCY_FLOOR_MONTHS * monthlyExpenses - cash));
  return {
    state: months < EMERGENCY_FLOOR_MONTHS ? "attention" : "ok",
    months, cash, monthlyExpenses, shortfall, targetMonths,
    belowOwnTarget: months >= EMERGENCY_FLOOR_MONTHS && targetMonths > EMERGENCY_FLOOR_MONTHS && months < targetMonths,
  };
}

export function checkIsaAllowance(person) {
  if (!person.isa?.known) return { who: person.who, state: "missing" };
  const used = Math.min(ISA_ALLOWANCE, Math.max(0, person.isa.usedThisYear || 0));
  const headroom = ISA_ALLOWANCE - used;
  return { who: person.who, state: headroom > 0 ? "attention" : "ok", used, headroom };
}

// A per-buyer check reads as "attention" if either buyer needs a look, then
// "missing" if either is still missing figures, else "ok".
export function combineStates(states) {
  if (states.includes("attention")) return "attention";
  if (states.includes("missing")) return "missing";
  return "ok";
}

export function runWaterfall({ buyers, debts, emergency }) {
  const match = buyers.map(checkEmployerMatch);
  const isa = buyers.map(checkIsaAllowance);
  return [
    { key: "match", state: combineStates(match.map(p => p.state)), people: match },
    { key: "debt", ...checkHighInterestDebt(debts) },
    { key: "emergency", ...checkEmergencyFund(emergency) },
    { key: "isa", state: combineStates(isa.map(p => p.state)), people: isa },
  ];
}

const filled = v => v !== "" && v !== null && v !== undefined && !isNaN(+v);

// The user's own pension figures. A user who chose Pension and said they
// have no pension has no match to claim. Otherwise the match is known once
// the employer match field holds a value, whether it came from the Pension
// step or from the Property screen's own prompt (which writes to the same
// myContribution/employerMatch fields, so it's never asked twice).
function yourPension(d, selected) {
  if (selected.has("pension") && !d.pensionUnknown && d.hasPension === "no") {
    return { known: true, myPct: 0, employerPct: 0, noPension: true };
  }
  if (filled(d.employerMatch)) {
    return { known: true, myPct: +d.myContribution || 0, employerPct: +d.employerMatch };
  }
  return { known: false };
}

// Builds runWaterfall's input from Candid's saved inputs (`d`) and
// calcMetrics' output (`m`). Nothing here asks for a figure Candid already
// has: ISA and emergency-fund figures only count as known when the user chose
// the module that asks for them.
export function waterfallInputs(d, m) {
  const selected = new Set(d.selectedModules || []);
  const buyers = [{
    who: "you",
    salary: m.salary,
    pension: yourPension(d, selected),
    // isaUsedThisYear covers Cash ISA payments (asked in Cash & savings) and
    // S&S/LISA/Other (asked in Investments); m.isaHeadroom is derived from it.
    isa: (selected.has("cash") || selected.has("investments"))
      ? { known: true, usedThisYear: m.isaUsedThisYear }
      : { known: false },
  }];
  if (d.propertyBuyingMode === "together") {
    buyers.push({
      who: "partner",
      salary: +d.partnerSalary || 0,
      pension: filled(d.partnerEmployerMatch)
        ? { known: true, myPct: +d.partnerMyContribution || 0, employerPct: +d.partnerEmployerMatch }
        : { known: false },
      isa: filled(d.partnerIsaThisYear)
        ? { known: true, usedThisYear: +d.partnerIsaThisYear }
        : { known: false },
    });
  }
  return {
    buyers,
    debts: Array.isArray(d.debts) ? d.debts : undefined,
    emergency: {
      known: selected.has("cash"),
      cash: m.totalLiquid,
      monthlyExpenses: m.expenses,
      targetMonths: m.bufferMonths,
    },
  };
}
