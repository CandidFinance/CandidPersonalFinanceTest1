// Drawing a pension down: "if you drew it over X years", what it would pay
// each year, the income tax on it, and what's left as it goes. Framed by the
// years chosen, never by how long anyone will live. Pure, unit tested in
// drawdown.test.js.
//
// In today's money: the pot grows at the real rate (growth.js) and pays the
// same amount every year, so it's empty at the end of the years chosen. Tax
// is at today's rates and bands. The bands are frozen until April 2031, so
// in today's money they shrink a little until then; we don't model that.

import { calcIncomeTax, PERSONAL_ALLOWANCE, PA_TAPER_START, HIGHER_RATE_THRESHOLD, ADDITIONAL_RATE_THRESHOLD, STATE_PENSION_FULL, STATE_PENSION_AGE } from "./tax.js";
import { GROWTH_REAL_PCT } from "./growth.js";
import { calcTaxFreeCash } from "./pension.js";
import { statePensionIncome, pastStatePensionAge, retirementAgeFor } from "./metrics.js";
import { taxYearFor } from "./taxYear.js";

export const DRAWDOWN_YEAR_OPTIONS = [10, 15, 20, 25, 30];
export const DEFAULT_DRAWDOWN_YEARS = 20;
// The years Candid starts from: drawing until 87, and never fewer than 5.
export const DRAWDOWN_TO_AGE = 87;
export const MIN_DRAWDOWN_YEARS = 5;
export function defaultDrawdownYears(d) {
  const age = +d.age || 0;
  return age > 0 ? Math.max(MIN_DRAWDOWN_YEARS, DRAWDOWN_TO_AGE - age) : DEFAULT_DRAWDOWN_YEARS;
}
// The usual choices, with the years to 87 among them.
export function drawdownYearOptions(d) {
  return [...new Set([...DRAWDOWN_YEAR_OPTIONS, defaultDrawdownYears(d)])].sort((a, b) => a - b);
}
// From 6 April 2027, unused pension funds count towards the estate for
// inheritance tax (announced at the October 2024 Budget).
export const PENSION_IHT_FROM_TAX_YEAR = 2027;

// The State Pension: what they get now if they're past State Pension age
// (what they told us, else the full rate), otherwise from 67 at the rate
// their National Insurance years point to (the full rate if we don't know
// them).
export function statePensionPlan(d, m) {
  const age = +d.age || 0;
  if (pastStatePensionAge(d)) return { fromAge: age, amount: statePensionIncome(d), started: true };
  const amount = +d.niYears > 0 ? Math.round(m.statePensionAnnual) : STATE_PENSION_FULL;
  return { fromAge: STATE_PENSION_AGE, amount, started: false };
}

// The rate on the top slice of an income, the £100k taper's 60% included.
export function topRate(income) {
  if (income <= PERSONAL_ALLOWANCE) return 0;
  if (income <= HIGHER_RATE_THRESHOLD) return 20;
  if (income <= PA_TAPER_START) return 40;
  if (income <= ADDITIONAL_RATE_THRESHOLD) return 60;
  return 45;
}

// `taxFree`: "phased" takes 25% of each withdrawal tax-free, growth
// included, until the Lump Sum Allowance left is used (so on a pot under
// about £1.07m it comes to more than 25% of today's pot); with some already
// taken, only up to the tax-free cash left on the part not yet touched.
// "upfront" takes 25% of today's pot (to the limit) now, before the years
// start.
export function calcDrawdown(d, m, { years = DEFAULT_DRAWDOWN_YEARS, taxFree = "phased" } = {}) {
  const cash = calcTaxFreeCash(d);
  if (!(cash.pot > 0) || !(years > 0)) return null;
  const r = GROWTH_REAL_PCT / 100;
  const age = +d.age || 0;
  const upfront = taxFree === "upfront" ? cash.taxFree : 0;
  const start = cash.pot - upfront;
  const yearly = Math.round(start * r / (1 - Math.pow(1 + r, -years)));
  const state = statePensionPlan(d, m);
  // Other taxable income alongside: pay and a bonus until they stop working
  // (retirementAgeFor), and rent or a final salary pension throughout.
  // Dividends are taxed on their own rates, so they're left out.
  const pay = Math.round((m.salary || 0) + (+d.bonusAmount || 0));
  const stopAge = retirementAgeFor(d);
  const otherAt = atAge => (atAge < stopAge ? pay : 0) + Math.round(+d.otherIncome || 0);
  const other = otherAt(age);

  let taxFreeLeft = taxFree === "phased" ? (cash.taken > 0 ? cash.taxFree : cash.left) : 0, pot = start;
  const rows = [];
  for (let t = 0; t < years; t++) {
    const atAge = age + t;
    const statePension = atAge >= state.fromAge ? state.amount : 0;
    const taxFreePart = Math.round(Math.min(yearly * 0.25, taxFreeLeft));
    taxFreeLeft -= taxFreePart;
    const base = otherAt(atAge) + statePension;
    const taxable = base + yearly - taxFreePart;
    const tax = calcIncomeTax(taxable);
    pot = Math.max(0, pot * (1 + r) - yearly);
    rows.push({
      age: atAge, pension: yearly, taxFree: taxFreePart, statePension, other: otherAt(atAge),
      income: base + yearly, tax, taxOnPension: tax - calcIncomeTax(base),
      afterTax: base + yearly - tax, topRate: topRate(taxable), potAfter: Math.round(pot),
    });
  }

  // Runs of years that look the same: they change when the tax-free cash
  // runs out or the State Pension starts.
  const phases = [];
  for (const row of rows) {
    const last = phases[phases.length - 1];
    if (last && last.income === row.income && last.tax === row.tax) last.toAge = row.age;
    else phases.push({ fromAge: row.age, toAge: row.age, income: row.income, tax: row.tax, afterTax: row.afterTax, pension: row.pension, taxFree: row.taxFree, statePension: row.statePension, other: row.other, topRate: row.topRate });
  }

  const drawn = yearly * years;
  const halfway = Math.floor(years / 2);
  // The headline figures are all about what comes out of the pension: the
  // tax it adds on top of the tax on other income and the State Pension.
  const totalTax = rows.reduce((s, x) => s + x.taxOnPension, 0);
  const taxShare = drawn > 0 ? totalTax / drawn : 0;
  // Kept after tax over the years, on the same footing either way: the lump
  // taken at the start counted as if it stayed invested at the same growth
  // and was spent evenly over the years, so the difference is the tax.
  const upfrontYearly = upfront > 0 ? upfront * r / (1 - Math.pow(1 + r, -years)) : 0;
  const totalKept = Math.round(rows.reduce((s, x) => s + x.pension - x.taxOnPension, 0) + upfrontYearly * years);
  return {
    years, toAge: age + years, taxFree, upfront, start, yearly, other, state, rows, phases,
    // Still working: when the pay stops (within the years or not).
    stillWorking: pay > 0 && age < stopAge, stopAge,
    taxFreeCash: cash,
    // The pot divided by the years: less than `yearly`, since what's left
    // keeps growing while it's drawn.
    simpleYearly: Math.round(start / years),
    firstYear: { tax: rows[0].taxOnPension, afterTax: yearly - rows[0].taxOnPension },
    totalTax, totalKept,
    // The share of what comes out of the pension that goes in income tax.
    effectiveRate: taxShare, taxShare,
    // Halfway through, what's still in the pension (it counts for
    // inheritance tax from April 2027).
    halfway: { age: age + halfway, pot: halfway > 0 ? rows[halfway - 1].potAfter : start },
  };
}

// The inheritance tax change, by the tax year the figures are for.
export function pensionIhtLine(d) {
  const lead = taxYearFor(d) >= PENSION_IHT_FROM_TAX_YEAR
    ? "What's left in a pension counts towards the estate for inheritance tax."
    : "From 6 April 2027, what's left in a pension counts towards the estate for inheritance tax.";
  return `${lead} Inherited after 75, it's also taxed as income for whoever inherits it.`;
}

// The strategy for a number of years: whichever way of taking the tax-free
// cash leaves more after tax (totalKept, on the same footing, so the
// difference is tax), and by how much. Not simply the lower tax bill:
// taking it all at the start shrinks the pot, so less is drawn and taxed,
// but less is kept too.
export function bestDrawdown(d, m, years) {
  const phased = calcDrawdown(d, m, { years, taxFree: "phased" });
  const upfront = calcDrawdown(d, m, { years, taxFree: "upfront" });
  if (!phased || !upfront) return null;
  const [plan, other] = upfront.totalKept > phased.totalKept ? [upfront, phased] : [phased, upfront];
  return { plan, other, saving: plan.totalKept - other.totalKept };
}

// Each number of years on offer, on the same four figures.
export function drawdownComparison(d, m, taxFree) {
  return drawdownYearOptions(d).map(years => {
    const p = calcDrawdown(d, m, { years, taxFree });
    return p && { years, toAge: p.toAge, afterTax: p.firstYear.afterTax, firstYearTax: p.firstYear.tax, totalTax: p.totalTax, effectiveRate: p.effectiveRate };
  }).filter(Boolean);
}

// Why a run of years looks different from the one before it.
export function phaseReason(p, prev) {
  if (!prev) {
    return p.taxFree > 0
      ? `A quarter of each withdrawal is tax-free, so ${fmtGbp(p.pension - p.taxFree)} of the ${fmtGbp(p.pension)} is taxed.`
      : "All of each withdrawal is taxed, on top of any other income.";
  }
  if (p.other < prev.other) {
    return "Your pay stops, so less of each withdrawal falls in the higher tax bands.";
  }
  if (p.statePension !== prev.statePension) {
    return "The State Pension starts. It's taxed as income and uses up your tax-free allowance, so more of each withdrawal is taxed, and at a higher rate.";
  }
  if (p.taxFree > 0) return `Only ${fmtGbp(p.taxFree)} of tax-free cash is left, so more of this year's withdrawal is taxed.`;
  return "The tax-free cash has run out, so all of each withdrawal is taxed.";
}
const fmtGbp = n => `£${Math.round(n).toLocaleString("en-GB")}`;

// The same change in a few words, for a column heading.
export function phaseChange(p, prev) {
  if (!prev) return p.taxFree > 0 ? "25% tax-free" : "Each year";
  if (p.other < prev.other) return "Pay stops";
  if (p.statePension !== prev.statePension) return "State Pension starts";
  if (p.taxFree > 0) return "Last tax-free";
  return "No tax-free cash";
}
