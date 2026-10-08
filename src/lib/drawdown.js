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
import { statePensionIncome } from "./metrics.js";
import { taxYearFor } from "./taxYear.js";

export const DRAWDOWN_YEAR_OPTIONS = [10, 15, 20, 25, 30];
export const DEFAULT_DRAWDOWN_YEARS = 20;
// From 6 April 2027, unused pension funds count towards the estate for
// inheritance tax (announced at the October 2024 Budget).
export const PENSION_IHT_FROM_TAX_YEAR = 2027;

// The State Pension: what they get now if they're 66 or over (what they told
// us, else the full rate), otherwise from 67 at the rate their National
// Insurance years point to (the full rate if we don't know them).
export function statePensionPlan(d, m) {
  const age = +d.age || 0;
  if (age >= 66) return { fromAge: age, amount: statePensionIncome(d), started: true };
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

// `taxFree`: "phased" takes 25% of each withdrawal tax-free until the
// tax-free cash is used; "upfront" takes it all now, before the years start.
export function calcDrawdown(d, m, { years = DEFAULT_DRAWDOWN_YEARS, taxFree = "phased" } = {}) {
  const cash = calcTaxFreeCash(d);
  if (!(cash.pot > 0) || !(years > 0)) return null;
  const r = GROWTH_REAL_PCT / 100;
  const age = +d.age || 0;
  const upfront = taxFree === "upfront" ? cash.taxFree : 0;
  const start = cash.pot - upfront;
  const yearly = Math.round(start * r / (1 - Math.pow(1 + r, -years)));
  const state = statePensionPlan(d, m);
  // Other taxable income alongside: pay, a bonus, rent or a final salary
  // pension. Dividends are taxed on their own rates, so they're left out.
  const other = Math.round((m.salary || 0) + (+d.bonusAmount || 0) + (+d.otherIncome || 0));

  let taxFreeLeft = taxFree === "phased" ? cash.taxFree : 0, pot = start;
  const rows = [];
  for (let t = 0; t < years; t++) {
    const atAge = age + t;
    const statePension = atAge >= state.fromAge ? state.amount : 0;
    const taxFreePart = Math.round(Math.min(yearly * 0.25, taxFreeLeft));
    taxFreeLeft -= taxFreePart;
    const base = other + statePension;
    const taxable = base + yearly - taxFreePart;
    const tax = calcIncomeTax(taxable);
    pot = Math.max(0, pot * (1 + r) - yearly);
    rows.push({
      age: atAge, pension: yearly, taxFree: taxFreePart, statePension, other,
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
  return {
    years, taxFree, upfront, yearly, other, state, rows, phases,
    taxFreeCash: cash,
    // The share of what comes out of the pension that goes in income tax.
    taxShare: drawn > 0 ? rows.reduce((s, x) => s + x.taxOnPension, 0) / drawn : 0,
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
