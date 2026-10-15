// Characterisation test: locks in what the finance engine works out today,
// so a refactor can be checked to change nothing. Each profile below is run
// through every engine function the app shows figures from, and the results
// are compared, value for value, with characterisation.snapshot.json.
//
// This says nothing about whether the figures are right (the other tests do
// that), only that they haven't moved. After a deliberate change to the
// engine, rebuild the snapshot and review its diff:
//   CHARACTERISATION_UPDATE=1 npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { calcMetrics } from "./metrics.js";
import { sanitizeForMvp, computeModuleStatuses, calcCandidScore, getModuleSummary, getModuleBreakdown, baselinePatch, gainedSoFar, MODULE_META } from "./moduleStatus.js";
import { MODULE_REVEALS } from "./moduleReveal.js";
import { PROPERTY_REVEALS } from "./propertyReveal.js";
import { calcForecast, calcForecastSeries, buildForecastAssumptions, calcNetWorthTrajectory } from "./forecast.js";
import { borrowingInputs, calcBorrowingCheck, maxPriceFor } from "./borrowing.js";
import { mortgageInputs, mortgageSummary } from "./mortgage.js";
import { rentVsBuyInputs, calcRentVsBuy } from "./rentVsBuy.js";
import { monthlyBudget, affordableMaxPrice } from "./monthlyBudget.js";
import { readinessMissing } from "./propertyReadiness.js";
import { assistItems, cashPlan } from "./assist.js";
import { moduleEstimate, pensionOutlook, loanAlternatives } from "./crossModule.js";
import { runWaterfall, waterfallInputs } from "./waterfall.js";
import { whatToDoFirst, onTrackModules } from "./priorities.js";
import { calcDrawdown, bestDrawdown } from "./drawdown.js";
import { calcStudentLoanScenario, calcOverpaymentScenarios } from "./studentLoan.js";
import { calcCashOptimisation } from "./cash.js";
import { calcAnnualAllowanceRoom, calcBonusSacrificePotential, calcPensionGrowthTrajectory } from "./pension.js";
import { getActiveSteps } from "./onboarding.js";
import { rollTaxYear } from "./taxYear.js";
import { getModuleProducts } from "../mobile/moduleProducts.js";
import { rowInputFields, rowReportFields, propertyRowFields } from "./reportRow.js";

const SNAPSHOT = new URL("./characterisation.snapshot.json", import.meta.url);

// Every input the app keeps, with concrete values (DevTools.jsx's baseProfile).
const base = {
  name: "", email: "", interests: [], selectedModules: [],
  financialGoals: [], houseTargetAmount: "", houseTimeframe: "", bigPurchaseTargetAmount: "", bigPurchaseTimeframe: "",
  age: "32", salary: "55000", otherIncome: "0", dividendIncome: "0", bonusAmount: "0", salaryTrajectory: "stable",
  employmentStatus: "employed",
  monthlyExpenses: "1800", higherBuffer: "no",
  cashSavings: "10000", savingsRate: "2.5", premiumBonds: "0", cashAccessType: "yes",
  cashTiers: [{ amount: "10000", rate: "2.5" }],
  hasInvestments: "yes", isaUsedThisYear: "", isaPreviousBalance: "", isaType: "stocks", unwrappedValue: "0", unrealisedGains: "0",
  hasSoldAssetsOutsideWrapper: "no", realisedCgtGains: "",
  isaThisYearCash: "0", isaThisYearSS: "5000", isaThisYearLISA: "0", isaThisYearOther: "0",
  isaPrevCash: "0", isaPrevSS: "8000", isaPrevLISA: "0", isaPrevOther: "0",
  hasPension: "yes", myContribution: "5", employerMatch: "5", potValue: "30000", potValue2: "0", retirementAge: "65", pensionType: "sacrifice",
  pensionUnknown: false, niYears: "8",
  studentLoan: "none", loanBalance: "0", studentLoanRate: "",
  hasMortgage: "no", mortgageType: "fixed", mortgageBalance: "", mortgageRate: "", monthlyMortgage: "",
  fixExpiryMonth: "", fixExpiryYear: "", mortgageProvider: "", propertyEquity: "",
  ownsOutright: false, outrightPropertyValue: "",
  savingsGoal: "goals", investHorizon: "5to10",
  inheritDirection: "", estateValue: "", hasWill: "no",
  hasPersonalLoan: "no", personalLoanBalance: "", personalLoanRate: "", personalLoanMonthly: "", personalLoanTermRemaining: "", personalLoanAnnualExtra: "", personalLoanProvider: "",
  hasKids: "no", numKids: "", kidsAges: "", hasJISA: "no", juniorISAValue: "",
  propertyBuyingMode: "alone", propertyPrice: "", propertyCashAvailable: "", propertyStampDuty: "", propertyFees: "",
  partnerSalary: "", partnerOtherIncome: "", partnerMyContribution: "", partnerEmployerMatch: "", partnerIsaThisYear: "",
  propertyRegion: "", propertyFirstTimeBuyer: "", partnerFirstTimeBuyer: "", propertySoleProperty: "yes",
  propertyMortgageTerm: "", propertyFixedYears: "", propertyMortgageRate: "", propertyRemortgageFee: "",
  propertyMonthlyRent: "", propertyHorizonYears: "", propertyTenure: "freehold",
  propertyGroundRent: "", propertyGroundRentGrowth: "", propertyServiceCharge: "",
  propertyHousePriceGrowth: "", propertyRentGrowth: "", propertyInvestmentReturn: "", propertyDividendYield: "",
  propertyRenterMoney: "cash", propertyCashReturn: "",
  propertyMaintenancePct: "", propertyLeaseholdMaintenance: "", propertySellingCosts: "",
  propertySpendingScope: "", assistSnoozed: null, assistSkipIsa: false, assistSkipPb: false, assistAccounts: [],
};
const all4 = ["cash", "investments", "pension", "studentLoan"];

const PROFILES = {
  full: { ...base, selectedModules: all4, financialGoals: ["buy_house", "consolidate"], houseTargetAmount: "40000", houseTimeframe: "1to3",
    age: "34", salary: "72000", otherIncome: "2000", dividendIncome: "500", bonusAmount: "5000", salaryTrajectory: "moderate",
    monthlyExpenses: "2200", cashSavings: "18000", savingsRate: "1.5", premiumBonds: "5000", cashTiers: [{ amount: "18000", rate: "1.5" }],
    unwrappedValue: "6000", unrealisedGains: "3500", hasSoldAssetsOutsideWrapper: "yes", realisedCgtGains: "1200",
    isaThisYearSS: "5000", isaPrevSS: "15000", myContribution: "3", employerMatch: "5", potValue: "55000", potValue2: "8000", niYears: "12",
    studentLoan: "plan2", loanBalance: "22000" },
  maxedIsa: { ...base, selectedModules: ["cash", "investments", "pension"], age: "29", salary: "48000",
    cashSavings: "12000", savingsRate: "2.8", cashTiers: [{ amount: "12000", rate: "2.8" }], unwrappedValue: "2000", unrealisedGains: "800",
    isaThisYearCash: "5000", isaThisYearSS: "15000", isaPrevSS: "10000", potValue: "20000" },
  largeSurplus: { ...base, selectedModules: ["cash", "investments", "pension"], age: "40", salary: "95000", monthlyExpenses: "1600",
    cashSavings: "45000", savingsRate: "2.0", cashTiers: [{ amount: "45000", rate: "2.0" }], premiumBonds: "8000",
    unwrappedValue: "10000", unrealisedGains: "4200", isaThisYearSS: "3000", isaPrevSS: "9000", myContribution: "6", employerMatch: "6", potValue: "70000", niYears: "15" },
  freshMinimal: { ...base, selectedModules: ["cash"], age: "24", salary: "26000", monthlyExpenses: "1200",
    cashSavings: "500", savingsRate: "0", cashTiers: [{ amount: "500", rate: "0" }], hasInvestments: "no", isaThisYearSS: "0", isaPrevSS: "0",
    hasPension: "no", myContribution: "0", employerMatch: "0", potValue: "0", niYears: "2" },
  taper110k: { ...base, selectedModules: all4, age: "45", salary: "112000", bonusAmount: "15000", monthlyExpenses: "3500",
    cashSavings: "60000", cashTiers: [{ amount: "40000", rate: "4.1" }, { amount: "20000", rate: "0.5" }], pensionType: "relief",
    myContribution: "4", employerMatch: "4", potValue: "180000", niYears: "24", studentLoan: "plan1", loanBalance: "6000" },
  veryHigh: { ...base, selectedModules: all4, age: "52", salary: "240000", otherIncome: "12000", dividendIncome: "8000", monthlyExpenses: "6000",
    cashSavings: "150000", cashTiers: [{ amount: "150000", rate: "3.0" }], unwrappedValue: "90000", unrealisedGains: "40000",
    isaThisYearSS: "20000", isaPrevSS: "200000", myContribution: "10", employerMatch: "8", potValue: "650000", niYears: "30", retirementAge: "60" },
  selfEmployed: { ...base, selectedModules: ["cash", "pension", "investments"], employmentStatus: "self_employed", age: "38", salary: "60000",
    myContribution: "8", employerMatch: "0", pensionType: "relief", potValue: "45000", cashSavings: "25000", cashTiers: [{ amount: "25000", rate: "1.0" }] },
  plan4: { ...base, selectedModules: all4, age: "27", salary: "38000", studentLoan: "plan4", loanBalance: "31000" },
  plan5: { ...base, selectedModules: all4, age: "22", salary: "29000", studentLoan: "plan5", loanBalance: "48000", monthlyExpenses: "1400",
    cashSavings: "3000", cashTiers: [{ amount: "3000", rate: "3.5" }], potValue: "2000" },
  postgrad: { ...base, selectedModules: all4, age: "30", salary: "52000", studentLoan: "postgrad", loanBalance: "14000" },
  nearRetirement: { ...base, selectedModules: all4, age: "59", salary: "68000", retirementAge: "62", potValue: "420000", potValue2: "60000",
    niYears: "38", cashSavings: "80000", cashTiers: [{ amount: "80000", rate: "4.5" }], premiumBonds: "50000" },
  pastRetirement: { ...base, selectedModules: ["cash", "pension", "investments"], age: "68", salary: "0", otherIncome: "9000",
    retirementAge: "65", potValue: "300000", niYears: "40", cashSavings: "40000", cashTiers: [{ amount: "40000", rate: "2.0" }] },
  flatCashOnly: { ...base, selectedModules: ["cash", "investments"], cashSavings: "22000", savingsRate: "1.2", cashTiers: [{ amount: "", rate: "" }],
    hasOtherIsaThisYear: "yes", isaThisYearOtherTypes: "4000", higherBuffer: "yes" },
  pensionUnknown: { ...base, selectedModules: ["pension"], hasPension: "no", pensionUnknown: true, myContribution: "", employerMatch: "", potValue: "" },
  buyerAlone: { ...base, selectedModules: ["cash", "pension"], interests: ["property"], financialGoals: ["buy_house"],
    propertyPrice: "325000", propertyRegion: "london", propertyFirstTimeBuyer: "yes", propertyMonthlyRent: "1650", propertyHorizonYears: "10",
    cashSavings: "45000", cashTiers: [{ amount: "45000", rate: "4.0" }] },
  buyersTogether: { ...base, selectedModules: all4, interests: ["property"], propertyBuyingMode: "together", propertyPrice: "450000",
    propertyRegion: "south_east", propertyFirstTimeBuyer: "yes", partnerFirstTimeBuyer: "no", partnerSalary: "41000", partnerMyContribution: "4",
    partnerEmployerMatch: "3", partnerIsaThisYear: "2000", propertySpendingScope: "household", propertyMonthlyRent: "1900",
    propertyTenure: "leasehold", propertyGroundRent: "250", propertyServiceCharge: "1800", propertyRenterMoney: "invested",
    propertyMortgageTerm: "30", propertyFixedYears: "5", propertyMortgageRate: "4.6", cashSavings: "70000", cashTiers: [{ amount: "70000", rate: "3.1" }],
    studentLoan: "plan2", loanBalance: "38000" },
  hiddenModules: { ...base, selectedModules: ["cash"], hasMortgage: "yes", mortgageBalance: "180000", mortgageRate: "5.4", monthlyMortgage: "1100",
    hasPersonalLoan: "yes", personalLoanBalance: "8000", personalLoanRate: "11.9", hasKids: "yes", numKids: "2", kidsAges: "3,6" },
};

const RATE_ROWS = [
  { id: "r1", provider_name: "Cahoot", product_name: "Sunny Day Saver", account_type: "Easy access", rate_aer: "5.00", max_balance: 3000, is_isa: false },
  { id: "r2", provider_name: "Chase", product_name: null, account_type: "Easy access", rate_aer: "4.50", is_isa: false },
  { id: "r3", provider_name: "Chip", product_name: "Smart Cash ISA", account_type: "Easy access ISA", rate_aer: "4.72", bonus_rate: "1.22", bonus_months: 12, is_isa: true },
  { id: "r4", provider_name: "Plum", product_name: "Cash ISA", account_type: "Easy access ISA", rate_aer: "4.68", is_isa: true },
  { id: "r5", provider_name: "NS&I", product_name: "Premium Bonds", account_type: "Premium Bonds", rate_aer: "3.60", max_balance: 50000, is_isa: false },
  { id: "r6", provider_name: "Atom", product_name: "Fixed Saver 1 year", account_type: "Fixed term", rate_aer: "4.40", is_isa: false },
];
const MARKET = { isaRate: 4.72, nonIsaRate: 5.0, rows: RATE_ROWS };
const REGIONAL = [{ region: "london", rent_growth_pct: "3.1", house_price_growth_pct: "1.9" }, { region: "south_east", rent_growth_pct: "2.6", house_price_growth_pct: "2.4" }];

// JSON-safe copy: functions and React elements as markers, non-finite numbers as text.
function plain(v, seen = new WeakSet()) {
  if (v === undefined) return "<undefined>";
  if (typeof v === "number") return Number.isFinite(v) ? v : String(v);
  if (typeof v === "function") return `<fn ${v.name || "anonymous"}>`;
  if (typeof v === "symbol") return String(v);
  if (v === null || typeof v !== "object") return v;
  if (v.$$typeof) return `<element ${v.type?.displayName || v.type?.name || v.type?.render?.displayName || typeof v.type}>`;
  if (seen.has(v)) return "<circular>";
  seen.add(v);
  if (Array.isArray(v)) return v.map(x => plain(x, seen));
  if (v instanceof Date) return `<date ${v.toISOString()}>`;
  const out = {};
  for (const k of Object.keys(v)) out[k] = plain(v[k], seen);
  return out;
}
const attempt = fn => { try { return plain(fn()); } catch (e) { return `<throws ${e.message}>`; } };

function runProfile(raw, market) {
  const rolled = rollTaxYear(raw, new Date());
  const d = sanitizeForMvp(rolled);
  const m = calcMetrics(d, market);
  const statuses = computeModuleStatuses(d, m, market);
  const b = borrowingInputs(d, m);
  const r = calcBorrowingCheck(b);
  const mi = mortgageInputs(d, r.loanNeeded);
  const rvbIn = rentVsBuyInputs(d, m, REGIONAL, "moderate", market);
  const sl = calcStudentLoanScenario(d, m);
  return {
    activeSteps: attempt(() => getActiveSteps(d).map(s => s.id)),
    metrics: plain(m),
    statuses: plain(statuses),
    score: calcCandidScore(statuses),
    summaries: attempt(() => Object.fromEntries(MODULE_META.map(mm => [mm.key, getModuleSummary(mm, d, m, statuses, null)]))),
    breakdown: attempt(() => getModuleBreakdown(d, m, statuses, null)),
    baselinePatch: attempt(() => baselinePatch(d, statuses)),
    gainedSoFar: attempt(() => gainedSoFar(d)),
    reveals: attempt(() => Object.fromEntries(Object.entries(MODULE_REVEALS).map(([k, f]) => [k, f(d, m, { marketRates: market })]))),
    propertyReveals: attempt(() => Object.fromEntries(Object.entries(PROPERTY_REVEALS).map(([k, f]) => [k, f(d, m, { regionalRows: REGIONAL, marketRates: market })]))),
    forecast: attempt(() => calcForecast(d, m, undefined, 10)),
    forecastSeries: attempt(() => calcForecastSeries(d, m, undefined, 25)),
    forecastAssumptions: attempt(() => buildForecastAssumptions(d, m)),
    netWorthTrajectory: attempt(() => calcNetWorthTrajectory(d, m, 30)),
    borrowing: plain({ b, r, max: attempt(() => maxPriceFor(d, m)) }),
    mortgage: attempt(() => mortgageSummary(mi)),
    rentVsBuy: attempt(() => (b.price > 0 ? calcRentVsBuy(rvbIn) : null)),
    budget: attempt(() => ({ monthly: monthlyBudget(d, m), max: affordableMaxPrice(d, m) })),
    readinessMissing: attempt(() => readinessMissing(d, m)),
    assist: attempt(() => ({ items: assistItems(d, m, market.rows || []), plan: cashPlan(d, m, market.rows || []) })),
    crossModule: attempt(() => ({ estimates: Object.fromEntries(all4.map(k => [k, moduleEstimate(k, d, m)])), outlook: pensionOutlook(d, m), loans: loanAlternatives(m) })),
    waterfall: attempt(() => runWaterfall(waterfallInputs(d, m))),
    priorities: attempt(() => ({ first: whatToDoFirst(d, m, statuses), onTrack: onTrackModules(d, m, statuses) })),
    drawdown: attempt(() => ({ phased: calcDrawdown(d, m), best: bestDrawdown(d, m) })),
    studentLoan: plain({ sl, overpay: attempt(() => calcOverpaymentScenarios(m, sl)) }),
    cash: attempt(() => calcCashOptimisation(m, market.isaRate, market.nonIsaRate, market.rows)),
    pension: attempt(() => ({ aaRoom: calcAnnualAllowanceRoom(d, m), bonus: calcBonusSacrificePotential(d, m), growth: calcPensionGrowthTrajectory(d, m) })),
    // The provider lists the Cash, Investments and Pension screens show.
    products: attempt(() => Object.fromEntries(["cash", "investments", "pension"].map(k => [k, getModuleProducts(k, d, m, market.rows || null)]))),
    // The columns written to the user's row in Supabase.
    reportRow: attempt(() => ({ inputs: rowInputFields(d, m), report: rowReportFields(statuses, calcCandidScore(statuses)), property: propertyRowFields(d, m, REGIONAL, market) })),
  };
}

function computeAll() {
  const out = {};
  for (const [name, p] of Object.entries(PROFILES)) {
    out[name] = { withRates: runProfile(p, MARKET), ratesLoading: runProfile(p, {}) };
  }
  return out;
}

test("engine outputs match the characterisation snapshot", () => {
  const actual = computeAll();
  if (process.env.CHARACTERISATION_UPDATE === "1" || !existsSync(SNAPSHOT)) {
    writeFileSync(SNAPSHOT, JSON.stringify(actual, null, 1) + "\n");
    return;
  }
  const expected = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  for (const name of Object.keys(expected)) {
    for (const mode of Object.keys(expected[name])) {
      for (const key of Object.keys(expected[name][mode])) {
        assert.deepStrictEqual(JSON.parse(JSON.stringify(actual[name]?.[mode]?.[key])), expected[name][mode][key], `${name} / ${mode} / ${key} changed`);
      }
    }
  }
  assert.deepStrictEqual(Object.keys(actual), Object.keys(expected));
});
