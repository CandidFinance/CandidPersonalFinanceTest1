// Rent vs buy engine for the Property module: the buyer's and the renter's
// net wealth, year by year, over the years the buyer expects to stay. Pure
// functions, unit tested in rentVsBuy.test.js.
//
// Buyer: pays the deposit, stamp duty and fees upfront, then each month the
// mortgage payment plus maintenance, ground rent and service charge (and a
// remortgage fee at the start of each new deal). Net wealth at the end of a
// year is what selling would leave: property value less selling costs, less
// the mortgage still owed.
//
// Renter ("invest the difference"): invests the same upfront sum, then each
// month invests the gap between the buyer's monthly cost and rent, or draws
// on the investments when rent costs more. ISAs first, up to each person's
// allowance; the rest is taxed: dividends each year, gains when sold. Net
// wealth is what cashing in would leave, after capital gains tax.
//
// Both sides spend the same cash each month. The part of the buyer's
// mortgage payment that repays the loan isn't lost: it shows up as equity.
import { mortgageSchedule, mortgageInputs } from "./mortgage.js";
import { calcIncomeTax } from "./tax.js";
import { borrowingInputs, calcBorrowingCheck } from "./borrowing.js";
import { regionalRates } from "./regionalRates.js";

export const DEFAULT_HORIZON_YEARS = 5;
const MAX_HORIZON_YEARS = 40;
export const SELLING_COSTS_PCT = 1.5;
// Candid's own assumption, not a published figure.
export const MODERATE_HOUSE_PRICE_GROWTH_PCT = 3.0;
// Royal London's UK equity growth assumptions (mid 5%, low 2%): Royal
// London's own figures, not FCA-prescribed rates.
export const INVESTMENT_RETURN_PCT = { moderate: 5, stress: 2 };
// The part of the investment return paid out as dividends (taxed each year
// outside an ISA); the rest is growth (taxed on sale).
export const DEFAULT_DIVIDEND_YIELD_PCT = 2;
export const FREEHOLD_MAINTENANCE_PCT = 1;
// Leasehold flat: internal upkeep only, since the service charge covers the
// building. Candid's estimate, rising with inflation at 2% (the Bank of
// England target).
export const LEASEHOLD_MAINTENANCE = 1200;
export const MAINTENANCE_INFLATION_PCT = 2;
export const SERVICE_CHARGE_GROWTH_PCT = 5;
// UK private rent growth, 12 months to August 2026 (ONS): only used if the
// region has no figure.
const UK_RENT_GROWTH_PCT = 3.8;
export const ISA_ALLOWANCE = 20000;
export const DIVIDEND_ALLOWANCE = 500;
export const CGT_ALLOWANCE = 3000;
const DIVIDEND_TAX = { basic: 0.0875, higher: 0.3375, additional: 0.3935 };
const CGT_RATE = { basic: 0.18, higher: 0.24, additional: 0.24 };

const filled = v => v !== "" && v !== null && v !== undefined && !isNaN(+v);
const monthlyRate = annualPct => Math.pow(1 + annualPct / 100, 1 / 12) - 1;

export function taxBandFor(taxableIncome) {
  return taxableIncome > 125140 ? "additional" : taxableIncome > 50270 ? "higher" : "basic";
}

// Rough take-home pay and room to save for a partner Candid only knows a
// salary for: income tax and employee NI on salary plus other income, less
// pension contributions; living costs are the user's monthly expenses scaled
// by the ratio of the two salaries. What's left, up to the £20,000
// allowance, is what they could realistically put into an ISA each year.
export function partnerSavingsEstimate({ salary = 0, otherIncome = 0, pensionPct = 0, yourSalary = 0, yourMonthlyExpenses = 0 }) {
  const pension = salary * pensionPct / 100;
  const taxable = Math.max(0, salary + otherIncome - pension);
  const ni = 0.08 * Math.min(Math.max(0, salary - 12570), 37700) + 0.02 * Math.max(0, salary - 50270);
  const takeHome = Math.max(0, salary + otherIncome - pension - calcIncomeTax(taxable) - ni);
  const costs = 12 * yourMonthlyExpenses * (yourSalary > 0 ? salary / yourSalary : 1);
  const surplus = Math.max(0, takeHome - costs);
  return { takeHome, costs, surplus, isaCapacity: Math.min(ISA_ALLOWANCE, surplus), taxBand: taxBandFor(taxable) };
}

// Buyer's costs in a given year (1-based), from that year's mortgage row.
function buyerYearCosts(input, scheduleRow, year) {
  const valueAtStart = input.price * Math.pow(1 + input.housePriceGrowthPct / 100, year - 1);
  const maintenance = input.tenure === "leasehold"
    ? LEASEHOLD_MAINTENANCE * Math.pow(1 + MAINTENANCE_INFLATION_PCT / 100, year - 1)
    : valueAtStart * FREEHOLD_MAINTENANCE_PCT / 100;
  const leasehold = input.tenure === "leasehold";
  const groundRent = leasehold ? (input.groundRent || 0) * Math.pow(1 + (input.groundRentGrowthPct || 0) / 100, year - 1) : 0;
  const serviceCharge = leasehold ? (input.serviceCharge || 0) * Math.pow(1 + SERVICE_CHARGE_GROWTH_PCT / 100, year - 1) : 0;
  const mortgagePayment = scheduleRow ? scheduleRow.monthlyPayment : 0;
  return {
    mortgagePayment,
    maintenance: maintenance / 12,
    groundRent: groundRent / 12,
    serviceCharge: serviceCharge / 12,
    monthlyTotal: mortgagePayment + (maintenance + groundRent + serviceCharge) / 12,
    remortgageFee: scheduleRow ? scheduleRow.fee : 0,
  };
}

// `input`:
//   horizonYears, price, upfront (deposit + stamp duty + fees),
//   mortgage { loan, termYears, fixedYears, ratePct, remortgageFee },
//   mortgageScenario ("moderate" | "stress"), housePriceGrowthPct,
//   tenure ("freehold" | "leasehold"), groundRent, groundRentGrowthPct,
//   serviceCharge (both £ a year), monthlyRent, rentGrowthPct,
//   investmentReturnPct, dividendYieldPct,
//   people: [{ who, isaHeadroom (this tax year), isaCapacity (a year, from
//     income), share (of the money invested), taxBand }]
export function calcRentVsBuy(input) {
  const years = Math.max(1, Math.min(MAX_HORIZON_YEARS, Math.round(input.horizonYears || DEFAULT_HORIZON_YEARS)));
  const schedule = mortgageSchedule({ ...input.mortgage, scenario: input.mortgageScenario || "moderate" });
  const growthPct = input.investmentReturnPct - input.dividendYieldPct;
  const growthM = monthlyRate(growthPct);
  const dividendM = input.dividendYieldPct / 100 / 12;
  const people = input.people.map(p => ({ ...p, isa: 0, gia: 0, basis: 0, dividends: 0, realised: 0, isaRoom: 0, isaPaidIn: 0, giaPaidIn: 0 }));
  let shortfall = 0; // rent the investments couldn't cover

  // Upfront sum: fills each person's remaining allowance for this tax year
  // (it's existing savings, so not limited by income), the rest outside.
  let lump = Math.max(0, input.upfront);
  for (const p of people) {
    const toIsa = Math.min(lump, Math.max(0, p.isaHeadroom));
    p.isa += toIsa; p.isaPaidIn += toIsa; lump -= toIsa;
    p.isaRoom = Math.min(Math.max(0, p.isaHeadroom) - toIsa, p.isaCapacity);
  }
  for (const p of people) { const out = lump * p.share; p.gia += out; p.basis += out; p.giaPaidIn += out; }

  const rows = [];
  for (let year = 1; year <= years; year++) {
    const scheduleRow = schedule.years[year - 1] || null;
    const costs = buyerYearCosts(input, scheduleRow, year);
    const rent = input.monthlyRent * Math.pow(1 + input.rentGrowthPct / 100, year - 1);
    for (let month = 1; month <= 12; month++) {
      for (const p of people) {
        const isaDiv = p.isa * dividendM, giaDiv = p.gia * dividendM;
        p.isa = p.isa * (1 + growthM) + isaDiv;
        p.gia = p.gia * (1 + growthM) + giaDiv;
        p.basis += giaDiv;
        p.dividends += giaDiv;
      }
      const difference = costs.monthlyTotal + (month === 1 ? costs.remortgageFee : 0) - rent;
      if (difference >= 0) {
        for (const p of people) {
          const amount = difference * p.share;
          const toIsa = Math.min(amount, p.isaRoom);
          p.isa += toIsa; p.isaRoom -= toIsa; p.isaPaidIn += toIsa;
          p.gia += amount - toIsa; p.basis += amount - toIsa; p.giaPaidIn += amount - toIsa;
        }
      } else {
        // Draw on investments: outside an ISA first (realising gains), then ISAs.
        let need = -difference;
        const giaTotal = people.reduce((s, p) => s + Math.max(0, p.gia), 0);
        const fromGia = Math.min(need, giaTotal);
        for (const p of people) {
          if (giaTotal <= 0 || p.gia <= 0) continue;
          const take = fromGia * (p.gia / giaTotal);
          const basisShare = p.basis * (take / p.gia);
          p.realised += take - basisShare;
          p.basis -= basisShare; p.gia -= take;
        }
        need -= fromGia;
        const isaTotal = people.reduce((s, p) => s + Math.max(0, p.isa), 0);
        const fromIsa = Math.min(need, isaTotal);
        for (const p of people) if (isaTotal > 0) p.isa -= fromIsa * (Math.max(0, p.isa) / isaTotal);
        shortfall += need - fromIsa;
      }
    }

    // Year end: what cashing in now would leave, then pay this year's tax and
    // start a fresh allowance year.
    let renterWealth = -shortfall;
    let taxPaid = 0;
    for (const p of people) {
      const dividendTax = Math.max(0, p.dividends - DIVIDEND_ALLOWANCE) * DIVIDEND_TAX[p.taxBand];
      const realisedTax = Math.max(0, p.realised - CGT_ALLOWANCE) * CGT_RATE[p.taxBand];
      const allowanceLeft = Math.max(0, CGT_ALLOWANCE - p.realised);
      const unrealisedTax = Math.max(0, p.gia - p.basis - allowanceLeft) * CGT_RATE[p.taxBand];
      p.gia -= dividendTax + realisedTax;
      taxPaid += dividendTax + realisedTax;
      renterWealth += p.isa + p.gia - unrealisedTax;
      p.dividends = 0; p.realised = 0;
      p.isaRoom = Math.min(ISA_ALLOWANCE, p.isaCapacity);
    }
    const propertyValue = input.price * Math.pow(1 + input.housePriceGrowthPct / 100, year);
    const mortgageBalance = scheduleRow ? scheduleRow.balance : 0;
    rows.push({
      year,
      buyerWealth: propertyValue * (1 - SELLING_COSTS_PCT / 100) - mortgageBalance,
      renterWealth,
      propertyValue, mortgageBalance,
      buyerMonthlyCost: costs.monthlyTotal, monthlyRent: rent, taxPaid,
    });
  }

  const breakeven = rows.find(r => r.buyerWealth > r.renterWealth);
  const last = rows[rows.length - 1];
  return {
    years: rows,
    horizonYears: years,
    breakevenYear: breakeven ? breakeven.year : null,
    // Positive: buying ahead at the horizon; negative: renting ahead.
    gapAtHorizon: last.buyerWealth - last.renterWealth,
    firstYearCosts: buyerYearCosts(input, schedule.years[0] || null, 1),
    firstYearRent: input.monthlyRent,
    isaPaidIn: people.reduce((s, p) => s + p.isaPaidIn, 0),
    outsideIsaPaidIn: people.reduce((s, p) => s + p.giaPaidIn, 0),
  };
}

// Builds calcRentVsBuy's input from Candid's saved inputs (`d`), calcMetrics'
// output (`m`) and the regional rates rows (null while loading).
//
// Scenarios: moderate uses house price growth of 3% (Candid's assumption)
// and a 5% investment return, both editable. Stress uses the region's latest
// ONS house price figure, but never more than the moderate figure (the
// latest figure is above 3% in some regions, which would make "stress" the
// more optimistic case), a 2% return paid entirely as dividends, and
// remortgages 1.5 points higher. Rent growth is the region's ONS figure in
// both, unless the user changes it.
//
// ISAs, per person: the upfront sum can fill this tax year's remaining
// allowance; after that, each person can add up to what they could
// realistically save from income (Candid's monthly surplus for the user,
// partnerSavingsEstimate for a partner), never more than £20,000 a year.
// The money invested is split between partners by that same capacity to
// save, and each person's money outside an ISA is taxed at their own rates.
export function rentVsBuyInputs(d, m, regionalRows, scenario = "moderate") {
  const b = borrowingInputs(d, m);
  const r = calcBorrowingCheck(b);
  const regional = regionalRates(d.propertyRegion, regionalRows);
  const moderateGrowth = filled(d.propertyHousePriceGrowth) ? +d.propertyHousePriceGrowth : MODERATE_HOUSE_PRICE_GROWTH_PCT;
  const housePriceGrowthPct = scenario === "stress"
    ? Math.min(regional ? regional.housePriceGrowthPct : moderateGrowth, moderateGrowth)
    : moderateGrowth;
  const investmentReturnPct = scenario === "stress" ? INVESTMENT_RETURN_PCT.stress
    : filled(d.propertyInvestmentReturn) ? +d.propertyInvestmentReturn : INVESTMENT_RETURN_PCT.moderate;
  const dividendYieldPct = Math.min(filled(d.propertyDividendYield) ? +d.propertyDividendYield : DEFAULT_DIVIDEND_YIELD_PCT, investmentReturnPct);

  const selected = new Set(d.selectedModules || []);
  const people = [{
    who: "you",
    // Without the user's ISA figures, assume the full allowance is free.
    isaHeadroom: (selected.has("cash") || selected.has("investments")) ? m.isaHeadroom : ISA_ALLOWANCE,
    surplus: Math.max(0, (m.monthlySurplus || 0) * 12),
    taxBand: m.taxBandLabel || "basic",
  }];
  let partnerEstimate = null;
  if (d.propertyBuyingMode === "together") {
    partnerEstimate = partnerSavingsEstimate({
      salary: +d.partnerSalary || 0, otherIncome: +d.partnerOtherIncome || 0, pensionPct: +d.partnerMyContribution || 0,
      yourSalary: m.salary, yourMonthlyExpenses: m.expenses,
    });
    people.push({
      who: "partner",
      isaHeadroom: Math.max(0, ISA_ALLOWANCE - (+d.partnerIsaThisYear || 0)),
      surplus: partnerEstimate.surplus,
      taxBand: partnerEstimate.taxBand,
    });
  }
  const totalSurplus = people.reduce((s, p) => s + p.surplus, 0);
  for (const p of people) {
    p.share = totalSurplus > 0 ? p.surplus / totalSurplus : 1 / people.length;
    p.isaCapacity = Math.min(ISA_ALLOWANCE, p.surplus);
  }

  return {
    horizonYears: filled(d.propertyHorizonYears) && +d.propertyHorizonYears >= 1 ? Math.min(MAX_HORIZON_YEARS, Math.round(+d.propertyHorizonYears)) : DEFAULT_HORIZON_YEARS,
    price: b.price,
    upfront: r.usableDeposit + b.stampDuty + b.fees,
    mortgage: mortgageInputs(d, r.loanNeeded),
    mortgageScenario: scenario,
    housePriceGrowthPct,
    tenure: d.propertyTenure === "leasehold" ? "leasehold" : "freehold",
    groundRent: +d.propertyGroundRent || 0,
    groundRentGrowthPct: +d.propertyGroundRentGrowth || 0,
    serviceCharge: +d.propertyServiceCharge || 0,
    monthlyRent: +d.propertyMonthlyRent || 0,
    rentGrowthPct: filled(d.propertyRentGrowth) ? +d.propertyRentGrowth : (regional ? regional.rentGrowthPct : UK_RENT_GROWTH_PCT),
    investmentReturnPct,
    dividendYieldPct,
    people,
    partnerEstimate,
  };
}
