// Property's answer in three steps, one set per step (Readiness, Mortgage,
// Rent vs buy), shown after that step's first finished walk-through and on
// "Explain this". Same shape and wording rules as src/lib/moduleReveal.js,
// and worked out from the same calculations as each step's result card, so
// the two always agree. Each takes (d, m, ctx), ctx being { regionalRows,
// marketRates }, and returns three steps or null when the step has no result
// yet. Pure, unit tested in propertyReveal.test.js.

import { fmt, fmtCompact } from "./format.js";
import { borrowingInputs, calcBorrowingCheck, LENDER_INCOME_MULTIPLE, HIGH_EARNER_MULTIPLE } from "./borrowing.js";
import { mortgageInputs, mortgageSummary, STRESS_REMORTGAGE_UPLIFT } from "./mortgage.js";
import { rentVsBuyInputs, calcRentVsBuy, SELLING_COSTS_PCT, MAX_HORIZON_YEARS } from "./rentVsBuy.js";
import { runWaterfall, waterfallInputs, VISIBLE_CHECKS } from "./waterfall.js";

const ANSWER = "Your answer", WHY = "Why", ACTION = "What you could do";
const pct = n => `${Math.round(n * 100) / 100}%`;
const times = x => `${x.toFixed(1)}x`;

export function readinessReveal(d, m) {
  const input = borrowingInputs(d, m);
  if (!(input.price > 0)) return null;
  const r = calcBorrowingCheck(input);
  const checks = runWaterfall(waterfallInputs(d, m)).filter(c => VISIBLE_CHECKS.includes(c.key) && c.state === "attention").length;
  const checksLine = checks > 0 ? `${checks} ${checks === 1 ? "check" : "checks"} on this screen ${checks === 1 ? "is" : "are"} worth a look before a deposit.` : undefined;

  const why = r.upfrontShortfall > 0
    ? { label: WHY, title: `Your ${fmt(input.cashAvailable)} doesn't cover the ${fmt(r.upfrontCosts)} of stamp duty and fees, so none of it is left for a deposit.` }
    : { label: WHY, title: `Your ${fmt(input.cashAvailable)} pays ${fmt(r.upfrontCosts)} of stamp duty and fees, leaving a ${fmt(r.usableDeposit)} deposit on a ${fmt(input.price)} home.` };

  if (r.loanNeeded === 0) {
    return [
      { label: ANSWER, title: "No mortgage needed." },
      { label: WHY, title: `Your ${fmt(input.cashAvailable)} covers the ${fmt(input.price)} price, stamp duty and fees.` },
      { label: ACTION, title: checksLine || "Nothing to change before you buy.", body: checksLine ? undefined : "The checks on this screen are all clear." },
    ];
  }
  const answer = { label: ANSWER, figure: fmt(r.loanNeeded), title: r.multiple != null ? `to borrow, ${times(r.multiple)} your income.` : "to borrow." };
  const action = r.multiple == null
    ? { label: ACTION, title: "Lenders base what they'll lend on income, so it's worth adding yours to see how this compares." }
    : r.band === "within"
      ? { label: ACTION, title: `That's within the ${LENDER_INCOME_MULTIPLE}x of income most lenders work to.`, body: checksLine }
      : r.band === "stretch"
        ? { label: ACTION, title: `That's ${fmt(r.gapAboveMultiple)} more than ${LENDER_INCOME_MULTIPLE}x your income. Some lenders go to ${HIGH_EARNER_MULTIPLE}x for higher earners.`,
            body: "A bigger deposit or a lower price would close the gap." }
        : { label: ACTION, title: `That's ${fmt(r.gapAboveMultiple)} more than ${LENDER_INCOME_MULTIPLE}x your income, beyond the ${HIGH_EARNER_MULTIPLE}x some lenders offer higher earners.`,
            body: "A bigger deposit, a lower price or buying with someone would bring it closer." };
  return [answer, why, action];
}

export function mortgageReveal(d, m) {
  const loan = calcBorrowingCheck(borrowingInputs(d, m)).loanNeeded;
  if (!(loan > 0)) return null;
  const input = mortgageInputs(d, loan);
  const s = mortgageSummary(input);
  const answer = { label: ANSWER, figure: `${fmt(s.monthlyPayment)} a month`,
    title: s.remortgageOutcomes ? `for the first ${input.fixedYears} years, at ${pct(input.ratePct)}.` : `at ${pct(input.ratePct)}, fixed for the whole term.` };
  const why = { label: WHY, title: `A ${fmt(loan)} loan, repaid in full over ${input.termYears} years.` };
  if (!s.remortgageOutcomes) {
    return [answer, why, { label: ACTION, title: "Nothing to plan for: the payment stays the same until it's paid off." }];
  }
  const payments = s.remortgageOutcomes.map(o => o.monthlyPayment);
  return [answer, why, {
    label: ACTION,
    title: `Plan for ${fmt(Math.min(...payments))} to ${fmt(Math.max(...payments))} a month from year ${s.firstRemortgageYear}, if rates move ${STRESS_REMORTGAGE_UPLIFT} points either way.`,
    body: "A longer fix keeps the payment the same for longer.",
  }];
}

export function rentVsBuyReveal(d, m, { regionalRows = null, marketRates = null } = {}) {
  const rent = d.propertyMonthlyRent;
  if (rent === "" || rent == null || isNaN(+rent)) return null;
  const input = rentVsBuyInputs(d, m, regionalRows, "moderate", marketRates);
  const result = calcRentVsBuy(input);
  const last = result.years.at(-1);
  const buyingAhead = result.gapAtHorizon > 0;
  const years = n => `${n} ${n === 1 ? "year" : "years"}`;
  const answer = { label: ANSWER, figure: buyingAhead ? "Buying" : "Renting",
    title: `leaves you about ${fmtCompact(Math.abs(result.gapAtHorizon))} better off after ${years(result.horizonYears)}.` };

  const oneOffs = last.buying.stampDutyAndFees + last.buying.sellingCosts;
  const why = buyingAhead
    ? { label: WHY, title: "The home's rise in value, and the loan you've paid off, outweigh the costs of buying, owning and selling." }
    : last.buying.netCost - oneOffs < last.renting.netCost
      ? { label: WHY, title: `Buying's one-off costs (${fmt(oneOffs)} in stamp duty, fees and ${SELLING_COSTS_PCT}% selling costs) haven't been made back after ${years(result.horizonYears)}.` }
      : { label: WHY, title: "Renting, and putting aside what buying would have cost, grows your money faster here." };

  // When buying would first come out ahead, over the longest stay the model
  // allows: the same comparison, just run for longer.
  const longRun = calcRentVsBuy({ ...input, horizonYears: MAX_HORIZON_YEARS });
  const assumptions = `Assumes house prices rise ${pct(input.housePriceGrowthPct)} and rents ${pct(input.rentGrowthPct)} a year. You can change these below.`;
  const action = buyingAhead
    ? { label: ACTION, title: result.breakevenYear && result.breakevenYear > 1
          ? `Buying pulls ahead from year ${result.breakevenYear}, so moving before then would favour renting.`
          : "Buying stays ahead from the first year.", body: assumptions }
    : { label: ACTION, title: longRun.breakevenYear
          ? `Buying would come out ahead if you stayed ${years(longRun.breakevenYear)} or more.`
          : `On these assumptions, buying doesn't come out ahead even over ${MAX_HORIZON_YEARS} years.`, body: assumptions };
  return [answer, why, action];
}

export const PROPERTY_REVEALS = { readiness: readinessReveal, mortgage: mortgageReveal, rentVsBuy: rentVsBuyReveal };
