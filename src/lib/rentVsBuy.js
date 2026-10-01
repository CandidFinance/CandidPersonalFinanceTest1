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
// Renter: puts the same upfront sum to work, then each month adds the gap
// between the buyer's monthly cost and rent, or draws on it when rent costs
// more. The money is either kept in cash (the default: someone saving to buy
// usually holds their deposit in cash) or invested. ISAs first, up to each
// person's allowance; outside them, cash interest is taxed each year above
// the Personal Savings Allowance, and investments are taxed on dividends
// each year and on gains when sold. Net wealth is what cashing in would
// leave, after capital gains tax.
//
// Both sides spend the same cash each month. The part of the buyer's
// mortgage payment that repays the loan isn't lost: it shows up as equity.
import { mortgageSchedule, mortgageInputs } from "./mortgage.js";
import { calcIncomeTax } from "./tax.js";
import { borrowingInputs, calcBorrowingCheck, cashIsaBalance } from "./borrowing.js";
import { PB_RATE } from "./cash.js";
import { regionalRates } from "./regionalRates.js";

export const DEFAULT_HORIZON_YEARS = 5;
const MAX_HORIZON_YEARS = 40;
export const SELLING_COSTS_PCT = 1.5;
// Candid's own assumption, not a published figure.
export const MODERATE_HOUSE_PRICE_GROWTH_PCT = 3.0;
// Where the renter's money sits. "cash" (the default) earns the blended rate
// on the user's own cash savings, Premium Bonds and Cash ISAs (cashRate).
// "invested" earns 7% a year, the rate Candid uses for Stocks & Shares ISA
// growth elsewhere (Forecast and the Investments module); the stress
// scenario cuts it to 2%, all of it dividends.
export const INVESTED_RETURN_PCT = 7;
export const STRESS_INVESTED_RETURN_PCT = 2;
// The part of an invested return paid out as dividends (taxed each year
// outside an ISA); the rest is growth (taxed on sale).
export const DEFAULT_DIVIDEND_YIELD_PCT = 2;
// Used only if the user has no cash figures at all.
const DEFAULT_CASH_RATE_PCT = 4.5;
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
// Cash interest outside an ISA: income tax above the Personal Savings Allowance.
const SAVINGS_ALLOWANCE = { basic: 1000, higher: 500, additional: 0 };
const SAVINGS_TAX = { basic: 0.20, higher: 0.40, additional: 0.45 };

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
//   returnType ("cash" | "invested"), investmentReturnPct, dividendYieldPct
//   (the part paid as income: all of it for cash), alreadyInIsa (the part
//   of the upfront sum already in Cash ISAs, so needing no new allowance),
//   people: [{ who, isaHeadroom (this tax year), isaCapacity (a year, from
//     income), share (of the money invested), taxBand }]
export function calcRentVsBuy(input) {
  const years = Math.max(1, Math.min(MAX_HORIZON_YEARS, Math.round(input.horizonYears || DEFAULT_HORIZON_YEARS)));
  const schedule = mortgageSchedule({ ...input.mortgage, scenario: input.mortgageScenario || "moderate" });
  const cash = input.returnType === "cash";
  // Cash: the whole return is interest. Invested: dividends plus growth.
  const incomePct = cash ? input.investmentReturnPct : input.dividendYieldPct;
  const growthM = monthlyRate(cash ? 0 : input.investmentReturnPct - input.dividendYieldPct);
  const incomeM = incomePct / 100 / 12;
  const incomeAllowance = band => cash ? SAVINGS_ALLOWANCE[band] : DIVIDEND_ALLOWANCE;
  const incomeTaxRate = band => cash ? SAVINGS_TAX[band] : DIVIDEND_TAX[band];
  const people = input.people.map(p => ({ ...p, isa: 0, gia: 0, basis: 0, income: 0, realised: 0, isaRoom: 0, isaPaidIn: 0, giaPaidIn: 0 }));
  let shortfall = 0; // rent the investments couldn't cover

  // Upfront sum: money already in Cash ISAs stays sheltered; the rest fills
  // each person's remaining allowance for this tax year (it's existing
  // savings, so not limited by income), then goes outside.
  let lump = Math.max(0, input.upfront);
  const alreadyInIsa = Math.min(lump, Math.max(0, input.alreadyInIsa || 0));
  people[0].isa += alreadyInIsa; people[0].isaPaidIn += alreadyInIsa; lump -= alreadyInIsa;
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
        const isaIncome = p.isa * incomeM, giaIncome = p.gia * incomeM;
        p.isa = p.isa * (1 + growthM) + isaIncome;
        p.gia = p.gia * (1 + growthM) + giaIncome;
        p.basis += giaIncome;
        p.income += giaIncome;
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
      const incomeTax = Math.max(0, p.income - incomeAllowance(p.taxBand)) * incomeTaxRate(p.taxBand);
      const realisedTax = Math.max(0, p.realised - CGT_ALLOWANCE) * CGT_RATE[p.taxBand];
      const allowanceLeft = Math.max(0, CGT_ALLOWANCE - p.realised);
      const unrealisedTax = Math.max(0, p.gia - p.basis - allowanceLeft) * CGT_RATE[p.taxBand];
      p.gia -= incomeTax + realisedTax;
      taxPaid += incomeTax + realisedTax;
      renterWealth += p.isa + p.gia - unrealisedTax;
      p.income = 0; p.realised = 0;
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

// The blended rate on the user's cash: savings accounts at their own rates,
// Premium Bonds at NS&I's prize-fund average, and Cash ISAs at the user's
// savings rate (Candid doesn't ask for a Cash ISA rate).
export function cashRate(d, m) {
  const cashIsa = cashIsaBalance(d);
  const savingsRate = m.effectiveSavingsRate || 0;
  const total = (m.cash || 0) + (m.bonds || 0) + cashIsa;
  if (!(total > 0)) return savingsRate || DEFAULT_CASH_RATE_PCT;
  return ((m.cash || 0) * savingsRate + (m.bonds || 0) * PB_RATE * 100 + cashIsa * savingsRate) / total;
}

// Builds calcRentVsBuy's input from Candid's saved inputs (`d`), calcMetrics'
// output (`m`) and the regional rates rows (null while loading).
//
// Scenarios: moderate uses house price growth of 3% (Candid's assumption),
// editable. Stress uses the region's latest ONS house price figure, but
// never more than the moderate figure (the latest figure is above 3% in some
// regions, which would make "stress" the more optimistic case), and
// remortgages 1.5 points higher. Rent growth is the region's ONS figure in
// both, unless the user changes it. The renter's money earns the user's
// blended cash rate (cashRate), or if invested 7% (2% in stress, all
// dividends); either rate is editable.
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
  const returnType = d.propertyRenterMoney === "invested" ? "invested" : "cash";
  const investmentReturnPct = returnType === "cash"
    ? (filled(d.propertyCashReturn) ? +d.propertyCashReturn : cashRate(d, m))
    : scenario === "stress" ? STRESS_INVESTED_RETURN_PCT
    : filled(d.propertyInvestmentReturn) ? +d.propertyInvestmentReturn : INVESTED_RETURN_PCT;
  const dividendYieldPct = returnType === "cash" ? investmentReturnPct
    : Math.min(filled(d.propertyDividendYield) ? +d.propertyDividendYield : DEFAULT_DIVIDEND_YIELD_PCT, investmentReturnPct);
  const upfront = r.usableDeposit + b.stampDuty + b.fees;
  // The share of the upfront sum coming out of Cash ISAs, in proportion to
  // the cash pot the suggested cash available is drawn from.
  const cashIsa = cashIsaBalance(d);
  const cashPot = m.totalLiquid + cashIsa;

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
    upfront,
    alreadyInIsa: cashPot > 0 ? Math.min(cashIsa, upfront * cashIsa / cashPot) : 0,
    mortgage: mortgageInputs(d, r.loanNeeded),
    mortgageScenario: scenario,
    housePriceGrowthPct,
    tenure: d.propertyTenure === "leasehold" ? "leasehold" : "freehold",
    groundRent: +d.propertyGroundRent || 0,
    groundRentGrowthPct: +d.propertyGroundRentGrowth || 0,
    serviceCharge: +d.propertyServiceCharge || 0,
    monthlyRent: +d.propertyMonthlyRent || 0,
    rentGrowthPct: filled(d.propertyRentGrowth) ? +d.propertyRentGrowth : (regional ? regional.rentGrowthPct : UK_RENT_GROWTH_PCT),
    returnType,
    investmentReturnPct,
    dividendYieldPct,
    people,
    partnerEstimate,
  };
}
