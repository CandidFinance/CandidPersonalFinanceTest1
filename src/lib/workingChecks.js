// The "working" screen shown between a finished walk-through and the answer
// (MobileModuleReveal's `checks`): the UK rules and data each module's sums
// actually run, each named against the user's own figure, ticked off one by
// one, each as "Checking X against Y". A line only appears when its rule runs for this user and the figure
// is there. Names rules and figures, never what to do: Candid is a
// calculator, not an adviser. Pure, unit tested in workingChecks.test.js.
//
// Each function takes (d, m, ctx), ctx being { marketRates, regionalRows },
// and returns up to four lines, or null when none apply.

import { fmt } from "./format.js";
import { PSA_BY_BAND, ISA_ALLOWANCE, CGT_ANNUAL_ALLOWANCE } from "./tax.js";
import { FSCS_LIMIT } from "./moduleReveal.js";
import { calcAnnualAllowanceRoom, isPensionContributing } from "./pension.js";
import { employerFixed } from "./employer.js";
import { retirementAdequacy } from "./crossModule.js";
import { slThresholdIn, SL_REPAYMENT_RATES, SL_WRITE_OFF_YEARS, resolveSlRate, slEarnings, slFirstDueYear } from "./studentLoan.js";
import { borrowingInputs } from "./borrowing.js";
import { rentVsBuyInputs } from "./rentVsBuy.js";
import { regionalRates } from "./regionalRates.js";
import { PROPERTY_REGIONS } from "./regions.js";

const pct = n => `${Math.round(n * 100) / 100}%`;
const some = lines => { const kept = lines.filter(Boolean); return kept.length ? kept : null; };

function cashChecks(d, m, { marketRates = {} } = {}) {
  if (!(m.cash > 0)) return null;
  const psa = PSA_BY_BAND[m.taxBandLabel];
  return some([
    (marketRates.rows?.length || marketRates.isaRate != null) && `Checking your ${fmt(m.cash)} against today's top savings and Cash ISA rates`,
    psa > 0 ? `Checking your interest against your ${fmt(psa)} Personal Savings Allowance` : `Working out tax on your interest at ${pct(m.savingsTr * 100)}`,
    `Checking each bank's balance against the ${fmt(FSCS_LIMIT)} FSCS limit`,
    !m.expensesUnknown && `Checking your savings against ${m.bufferMonths} months of essential spending`,
  ]);
}

function pensionChecks(d, m) {
  if (!(m.salary > 0)) return null;
  const myPct = isPensionContributing(d) ? (+d.myContribution || 0) : 0;
  const match = +d.employerMatch || 0;
  const { approxAA } = calcAnnualAllowanceRoom(d, m);
  const adequacy = retirementAdequacy(d, m);
  return some([
    `Working out tax relief at your ${pct(m.tr * 100)} rate`,
    match > 0 && !employerFixed(d) && `Checking your ${pct(myPct)} against your employer's ${pct(match)} match`,
    `Checking your payments against the ${fmt(approxAA)} annual allowance`,
    adequacy && `Checking your projected income against your ${fmt(+d.retirementTarget)} a year target`,
  ]);
}

const PLAN_NAMES = { plan1: "Plan 1", plan2: "Plan 2", plan4: "Plan 4", plan5: "Plan 5", postgrad: "Postgraduate loan" };
function studentLoanChecks(d, m) {
  const plan = d.studentLoan;
  if (!PLAN_NAMES[plan] || !(m.loanBal > 0)) return null;
  const threshold = slThresholdIn(plan, m.taxYear);
  return some([
    `Checking your ${fmt(slEarnings(d, m.salary))} pay against the ${PLAN_NAMES[plan]} threshold of ${fmt(threshold)}`,
    `Working out ${pct(SL_REPAYMENT_RATES[plan] * 100)} of what you earn above it`,
    `Adding interest at ${pct(resolveSlRate(d, m.salary) * 100)} to your ${fmt(m.loanBal)}`,
    `Checking the write-off after ${SL_WRITE_OFF_YEARS[plan]} years, in April ${slFirstDueYear(d, m.taxYear) + SL_WRITE_OFF_YEARS[plan]}`,
  ]);
}

function investmentsChecks(d, m) {
  const gains = +d.unrealisedGains || 0;
  return some([
    gains > 0 && `Checking your ${fmt(gains)} of gains against the ${fmt(CGT_ANNUAL_ALLOWANCE)} capital gains allowance`,
    gains > 0 && `Working out tax on gains above it at ${m.taxBandLabel === "basic" ? "18%" : "24%"}`,
    `Checking this year's ISA payments against the ${fmt(ISA_ALLOWANCE)} ISA allowance`,
  ]);
}

function rentVsBuyChecks(d, m, { marketRates = null, regionalRows = null } = {}) {
  const rent = d.propertyMonthlyRent;
  if (rent === "" || rent == null || isNaN(+rent)) return null;
  const input = rentVsBuyInputs(d, m, regionalRows, "moderate", marketRates);
  const duty = borrowingInputs(d, m).stampDutyDetail;
  const region = PROPERTY_REGIONS.find(r => r.value === d.propertyRegion);
  const ownRentGrowth = d.propertyRentGrowth !== "" && d.propertyRentGrowth != null;
  const rentSource = ownRentGrowth ? "your figure" : region && regionalRates(d.propertyRegion, regionalRows) ? `ONS, ${region.label}` : "ONS, UK";
  const { loan, ratePct, termYears } = input.mortgage;
  return some([
    input.price > 0 && duty?.supported && `Working out stamp duty on ${fmt(input.price)}, ${duty.reliefApplies ? "with first-time buyer relief" : "at the standard rates"}`,
    `Growing your ${fmt(+rent)} rent by ${pct(input.rentGrowthPct)} a year (${rentSource})`,
    loan > 0 && `Costing a ${fmt(loan)} mortgage at ${pct(ratePct)} over ${termYears} years, and ${pct(input.sellingCostsPct)} selling costs`,
    input.returnType === "cash"
      ? `Growing your deposit in cash at ${pct(input.investmentReturnPct)} if you rent, after the ISA and Personal Savings Allowance`
      : `Growing your deposit invested at ${pct(input.investmentReturnPct)} a year if you rent, after the ISA and tax allowances`,
  ]);
}

// Kids & family and the £100k tax trap have none (Harvey, 23 Oct 2026).
export const WORKING_CHECKS = { cash: cashChecks, pension: pensionChecks, studentLoan: studentLoanChecks, investments: investmentsChecks, rentVsBuy: rentVsBuyChecks };
export const workingChecks = (key, d, m, ctx) => WORKING_CHECKS[key]?.(d, m, ctx) ?? null;
