import { isaUsedThisYear as isaUsedAcrossAll } from "./isa.js";
import { employerPct } from "./employer.js";
import { resolveSlRate, slRateIn, slYearsLeft, slThresholdIn, SL_REPAYMENT_RATES, calcStudentLoanScenario } from "./studentLoan.js";
import { payFactor, payGrowthIn } from "./growth.js";
import { taxYearFor } from "./taxYear.js";
import { GROWTH_NOMINAL_PCT } from "./growth.js";
import { retirementAgeFor } from "./metrics.js";
import { DRAWDOWN_TO_AGE } from "./drawdown.js";
import { calcAnnualAllowanceRoom, reliefBandByBand, grossForNet } from "./pension.js";
import { calcNI, taxFreeInterest, savingsTaxRates, dividendTaxRates, salarySacrificeNiCap, cashIsaLimit, ISA_ALLOWANCE, DIVIDEND_ALLOWANCE } from "./tax.js";

// Static defaults — replace with live Moneyfacts API rates in future
export const CASH_RATE_LOW     = 0.030; // below average, high-street loyal-customer rate
export const CASH_RATE_CENTRAL = 0.045; // market-leading easy access rate
export const CASH_RATE_HIGH    = 0.050; // best available, a ceiling not a guarantee

// The terms simulateLoan runs on, the same as calcStudentLoanScenario's:
// years left to write-off (from when repayments started), the plan's
// threshold each year and repayment rate, and pay including the bonus less
// salary sacrifice (m.slEarnings).
export function studentLoanTerms(d, m) {
  const taxYear = taxYearFor(d);
  return {
    writeOffYr: slYearsLeft(d, taxYear),
    threshold: year => slThresholdIn(d.studentLoan, taxYear + year),
    repayRate: SL_REPAYMENT_RATES[d.studentLoan] ?? SL_REPAYMENT_RATES.plan1,
    earnings: m.slEarnings ?? m.salary,
    // The interest rate in each year (0 = this one), on that year's pay.
    rate: year => slRateIn(d, m.salary * payFactor(m.payGrowth ?? (m.salaryGrowthRate || 0), year), year, taxYear),
  };
}

// ── Month-by-month student loan simulator ────────────────────────────────────────────
// `repaymentThreshold` and `interestRate` are figures, or functions of the
// year (0 = this tax year) for ones that change (studentLoanTerms).
export function simulateLoan(openingBalance, annualSalary, salaryGrowthRate, interestRate, repaymentThreshold, repaymentRate, maxYears = 30, extraMonthly = 0, trackYearly = false) {
  let balance = openingBalance;
  let salary = annualSalary;
  let totalInterest = 0;
  let totalPaid = 0;
  let monthsToClear = null;
  // yearlyInterest[y] = cumulative interest accrued through end of year y (index 0 = £0 at start)
  const yearlyInterest = trackYearly ? [0] : null;
  for (let month = 0; month < maxYears * 12; month++) {
    if (balance <= 0) break;
    const interest = balance * (typeof interestRate === "function" ? interestRate(Math.floor(month / 12)) : interestRate) / 12;
    balance += interest;
    totalInterest += interest;
    const threshold = typeof repaymentThreshold === "function" ? repaymentThreshold(Math.floor(month / 12)) : repaymentThreshold;
    const annualRepayment = Math.max(0, (salary - threshold) * repaymentRate);
    const monthlyRepayment = annualRepayment / 12 + extraMonthly;
    const payment = Math.min(monthlyRepayment, balance);
    balance -= payment;
    totalPaid += payment;
    if (balance <= 0 && monthsToClear === null) monthsToClear = month + 1;
    if ((month + 1) % 12 === 0) {
      // Pay rises at the expected rate for ten years, then with prices.
      salary *= 1 + payGrowthIn(salaryGrowthRate, Math.floor(month / 12));
      if (trackYearly) yearlyInterest.push(Math.round(totalInterest));
    }
  }
  // Pad remaining years (if loan cleared early) so yearlyInterest[y] is always valid up to maxYears
  if (trackYearly) {
    while (yearlyInterest.length <= maxYears) yearlyInterest.push(Math.round(totalInterest));
  }
  const cleared = balance <= 0;
  return { totalInterest: Math.round(totalInterest), totalPaid: Math.round(totalPaid), cleared, writtenOff: !cleared, monthsToClear, yearlyInterest };
}

// Future value of a single lump sum invested today, compounded monthly.
export function fvSingle(pv, annualRatePct, months) {
  if (pv <= 0 || months <= 0) return 0;
  return pv * Math.pow(1 + annualRatePct / 100 / 12, months);
}

// Future value of a stream of equal monthly contributions, compounded monthly.
// FV = PMT × (((1+r)^n - 1) / r), where r = monthly rate and n = number of months.
export function fvAnnuity(pmt, annualRatePct, months) {
  if (months <= 0 || pmt <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return pmt * months;
  return pmt * ((Math.pow(1 + r, months) - 1) / r);
}

// Amortises a repayment loan/mortgage month-by-month at a fixed annual rate,
// with an optional extra monthly overpayment on top of the normal payment.
// Returns total interest paid over maxMonths, and (if the balance clears
// within that window) the month it cleared.
export function simulateAmortisation(balance, annualRatePct, monthlyPayment, maxMonths) {
  const r = annualRatePct / 100 / 12;
  let bal = balance, totalInterest = 0, monthsToClear = null;
  for (let month = 1; month <= maxMonths; month++) {
    if (bal <= 0) break;
    const interest = bal * r;
    totalInterest += interest;
    bal += interest;
    const payment = Math.min(monthlyPayment, bal);
    bal -= payment;
    if (bal <= 0 && monthsToClear === null) monthsToClear = month;
  }
  return { totalInterest, monthsToClear, cleared: monthsToClear !== null };
}

// ── Return per £1 overpaid vs the pension, like for like. For each overpayment
// amount, the loan's return is the repayments it saves per £1 — its interest
// rate compounded over an effective number of years. The pension line
// compounds the pension's assumed growth over those same years. Tax relief
// isn't in it: it applies whether the money goes in now or once the loan
// clears (see calcStudentLoanScenario). So when the two rates match the lines
// sit together, and when they don't one sits above the other throughout.
// Shared by desktop's and mobile's student loan deep dives. `sl` is
// calcStudentLoanScenario(d, m); `chartWidth` lets the caller pass a measured
// container width so the returned coordinates match the rendered SVG 1:1 (see
// mobile Forecast chart for the same pattern); `layout` overrides the height,
// padding and x-axis tick positions (fractions of the balance).
export function calcLoanMarginalReturnCurve(d, m, sl, chartWidth = 340, layout = {}) {
  const loanRate = sl?.slInterestRate || 0;
  if (!sl?.willClear || m.loanBal <= 0 || loanRate <= 0) return null;
  const writeOffYr = sl.writeOffYr;
  const pensionGrowth = sl.pensionGrowthPct / 100;
  const mortRate = d.hasMortgage === "yes" && +d.mortgageRate > 0 ? +d.mortgageRate : 4.5;
  const mortReturn = 1 + mortRate / 100;
  const terms = studentLoanTerms(d, m);
  const planThreshold = terms.threshold;
  const growthRate = m.payGrowth ?? m.salaryGrowthRate;
  // simulateLoan compounds monthly, so the pension compounds monthly too —
  // equal rates then give identical lines.
  const pensionExponent = Math.log(1 + pensionGrowth / 12) / Math.log(1 + loanRate / 12);
  const point = (amt, ratio) => ({ amt, ratio, pension: Math.pow(ratio, pensionExponent) });
  const baseCase = simulateLoan(m.loanBal, terms.earnings, growthRate, loanRate, planThreshold, terms.repayRate, writeOffYr);
  const tiny = simulateLoan(Math.max(0, m.loanBal - 100), terms.earnings, growthRate, loanRate, planThreshold, terms.repayRate, writeOffYr);
  const tinyIntSaved = Math.max(0, baseCase.totalInterest - tiny.totalInterest);
  const STEPS = 36;
  const data = [point(0, 1 + tinyIntSaved / 100), ...Array.from({ length: STEPS }, (_, i) => {
    const amt = (m.loanBal * (i + 1)) / STEPS;
    const oc = simulateLoan(Math.max(0, m.loanBal - amt), terms.earnings, growthRate, loanRate, planThreshold, terms.repayRate, writeOffYr);
    const intSaved = Math.max(0, baseCase.totalInterest - oc.totalInterest);
    return point(amt, (amt + intSaved) / amt);
  })];
  // Scale to the curves from the second point on, capped — the return at amt≈0
  // can spike to 4-8x+ for loans that stay outstanding almost the entire
  // write-off window, which would compress every tick into a sliver near the
  // axis floor.
  const peak = Math.max(...data.slice(1).map(p => Math.max(p.ratio, p.pension)));
  const yMax = Math.max(1.6, Math.min(peak, 2.5) + 0.15);
  const yMin = 0.92;
  const { VH = 170, PL = 38, PR = 8, PT = 14, PB = 26, xTickFractions = [0, 0.5, 1] } = layout;
  const VW = chartWidth;
  const cW = VW - PL - PR, cH = VH - PT - PB;
  const sx = a => PL + (a / m.loanBal) * cW;
  const sy = r => PT + cH - ((r - yMin) / (yMax - yMin)) * cH;
  // Clamp plotted points to yMax so an outlier flattens visually at the top of
  // the chart instead of stretching the axis.
  const toPath = key => data.map((p,i) => `${i===0?"M":"L"}${sx(p.amt).toFixed(1)},${sy(Math.min(p[key], yMax)).toFixed(1)}`).join(" ");
  const yTicks = [1.0, 1.25, 1.5, 1.75, 2.0, 2.5].filter(r => r >= yMin && r <= yMax + 0.05);
  const xTicks = xTickFractions.map(f => m.loanBal * f);
  return {
    writeOffYr, loanRatePct: sl.slRatePct, pensionGrowthPct: sl.pensionGrowthPct, mortRate, mortReturn,
    data, yMax, yMin, VW, VH, PL, PR, PT, PB, cW, cH, sx, sy,
    path: toPath("ratio"), pensionPath: toPath("pension"), yTicks, xTicks,
  };
}

// ── Tax on growth outside a wrapper ─────────────────────────────────────
// Forecast lines grow net of tax (Harvey, 16 Nov 2026): interest above the
// tax-free amount at the savings rates for each tax year (24/44/49% from
// April 2027), and dividends above the £500 allowance at the dividend rates.
// Shares outside an ISA are assumed to pay DIVIDEND_YIELD of their value a
// year (part of the 6% growth); gains aren't taxed until sold, so not here.
// Pension lines aren't taxed on the way out either: the screen says so.
export const DIVIDEND_YIELD = 0.02;
// `usedInterest`/`usedDividends`: what their existing savings and holdings
// already earn, which uses the tax-free amounts first.
export function growthTax(d, m, { usedInterest = m.savingsInterest || 0, usedDividends = +d.dividendIncome || 0 } = {}) {
  const band = m.taxBandLabel || "basic";
  const taxYear = m.taxYear || taxYearFor(d);
  const freeInterest = Math.max(0, taxFreeInterest(m.nonSavingsIncome ?? m.salary ?? 0, band) - usedInterest);
  const freeDividends = Math.max(0, DIVIDEND_ALLOWANCE - usedDividends);
  return {
    interest: (amount, y) => Math.max(0, amount - freeInterest) * savingsTaxRates(taxYear + y)[band],
    dividends: (amount, y) => Math.max(0, amount - freeDividends) * dividendTaxRates(taxYear + y)[band],
  };
}

// One place money goes, month by month: `lump` today and `monthly` (a
// figure, or a function of the year, 0 = this one) at each month's end. Up
// to `isaRoom(year)` a year goes into an ISA, growing tax-free at `ratePct`
// a year; the rest (the overflow) is held outside one, growing at
// `outRatePct` and taxed at each year's end (`kind` "cash": its interest;
// "shares": its dividends) when `tax` (growthTax) is given. With no ISA
// room and no tax, it's fvSingle(lump) + fvAnnuity(monthly). `split`:
// returns { isa, out, total } instead of the total.
export function growPot({ months, ratePct, outRatePct = ratePct, monthly = 0, lump = 0, isaRoom = () => Infinity, kind = "cash", tax = null, split = false }) {
  const r = ratePct / 100 / 12, ro = outRatePct / 100 / 12;
  const perMonth = typeof monthly === "function" ? monthly : () => monthly;
  let isa = 0, out = 0, room = 0, income = 0;
  const place = amt => { const toIsa = Math.min(amt, room); room -= toIsa; isa += toIsa; out += amt - toIsa; };
  // The lump goes in today, so it's there at year 0 too.
  room = Math.max(0, isaRoom(0));
  if (lump > 0) place(lump);
  for (let mth = 0; mth < months; mth++) {
    const y = Math.floor(mth / 12);
    if (mth % 12 === 0) { if (mth > 0) room = Math.max(0, isaRoom(y)); income = 0; }
    isa *= 1 + r;
    income += out * (kind === "cash" ? ro : DIVIDEND_YIELD / 12);
    out *= 1 + ro;
    place(Math.max(0, perMonth(y) || 0));
    if (tax && (mth % 12 === 11 || mth === months - 1)) {
      out -= kind === "cash" ? tax.interest(income, y) : tax.dividends(income, y);
      income = 0;
    }
  }
  return split ? { isa, out, total: isa + out } : isa + out;
}

// A debt, month by month for up to `months`: each month it charges interest
// (`ratePct(year)`, % a year), then `due(month, balance after interest)` is
// paid, `extra` more on top, and `lump` today. At `endsAt` (months; a
// student loan's write-off) what's left is written off. Stops the month it
// clears (`clearedAt`, months from now; 0 if the lump clears it today).
// `paidFrom`: what's paid from month `countFrom` on.
function debtScenario({ months, balance, ratePct, due, extra = 0, lump = 0, endsAt = Infinity, countFrom = Infinity }) {
  let bal = Math.max(0, balance - lump), interestPaid = 0, clearedAt = bal <= 0 ? 0 : null, paidFrom = 0;
  for (let mth = 0; mth < months && clearedAt === null; mth++) {
    if (mth === endsAt) { bal = 0; break; }
    const interest = bal * ratePct(Math.floor(mth / 12)) / 100 / 12;
    bal += interest; interestPaid += interest;
    const paid = Math.min(bal, due(mth, bal, interest) + extra);
    bal -= paid;
    if (mth >= countFrom) paidFrom += paid;
    if (bal <= 0) clearedAt = mth + 1;
  }
  return { balance: bal, interestPaid, clearedAt, paidFrom };
}

// What overpaying a debt is worth: what you'd no longer owe (the money paid
// in and the interest saved), up to the month it clears, then held there.
// It can't be more than the balance and the interest it would have charged.
function overpaid(run, extra, lump) {
  const over = run(extra, lump, null);
  const base = run(0, 0, over.clearedAt);
  return { worth: Math.max(0, base.balance - over.balance), interestSaved: Math.max(0, base.interestPaid - over.interestPaid), clearedAt: over.clearedAt };
}

// Money paid into a pension, gross: what `net` of take-home a year puts in
// once the tax relief (band by band: pension.js reliefBandByBand) and, for
// salary sacrifice, the NI saved are added. Relief only up to the annual
// allowance room. From April 2029 a sacrifice saves NI on only the first
// £2,000 a year, after their own regular sacrifice (tax.js
// salarySacrificeNiCap). Pay held at today's.
function pensionGrossFor(d, m, sacrifice) {
  const income = m.adjustedNetIncome || 0, scottish = !!m.scottish;
  const room = calcAnnualAllowanceRoom(d, m).room;
  const opts = { pastStatePensionAge: !!m.pastStatePensionAge };
  const ongoing = sacrifice ? (m.salary || 0) * (+d.myContribution || 0) / 100 : 0;
  const taxYear = m.taxYear || taxYearFor(d);
  const cache = new Map();
  return (net, y) => {
    const cap = salarySacrificeNiCap(taxYear + y);
    const niRoom = sacrifice ? Math.max(0, cap - ongoing) : 0;
    const key = `${net}|${niRoom}`;
    if (cache.has(key)) return cache.get(key);
    const niPay = (m.salary || 0) - Math.min(ongoing, cap);
    const saved = g => {
      const tax = reliefBandByBand(income, Math.min(g, room), { scottish, atSource: !sacrifice });
      const n = Math.min(g, niRoom);
      return tax + (n > 0 ? calcNI(niPay, opts) - calcNI(Math.max(0, niPay - n), opts) : 0);
    };
    const gross = grossForNet(net, saved);
    cache.set(key, gross);
    return gross;
  };
}

// Projects low/central/high values at `horizonYears` for each way the user's
// monthly surplus could be put to work: mortgage overpayment, student loan
// overpayment, a Stocks & Shares ISA, a Cash ISA, and a pension. The same
// money goes into each line, so each ISA line has the whole allowance.
// For a debt, it's what you'd no longer owe, held once it's clear.
// `overflow`: where money over the ISA allowance goes on both ISA lines,
// "shares" (held outside an ISA) or "cash" (a savings account), taxed.
// Returns { horizonYears, monthlySurplus, overflow, overAllowance, options },
// where `options` only includes entries applicable to this user
// (applicable: true), a debt's with `clearedAt` (months) and an ISA line's
// with `split` ({ isa, out }, central £).
export function calcForecast(d, m, surplusOverride, horizonYears, lumpSumOverride = 0, { overflow = "shares" } = {}) {
  const surplus = Math.max(0, surplusOverride != null ? +surplusOverride || 0 : m.monthlySurplus || 0);
  const lump = Math.max(0, +lumpSumOverride || 0);
  const months = horizonYears * 12;
  const options = [];
  const tax = growthTax(d, m);

  // ── 1. Mortgage overpayment ────────────────────────────────────────────
  const hasOverpayableMortgage = d.hasMortgage === "yes" && !d.ownsOutright && (+d.mortgageBalance||0) > 0;
  if (hasOverpayableMortgage) {
    const bal = +d.mortgageBalance||0;
    const pay = +d.monthlyMortgage||0;
    const baseRate = +d.mortgageRate||0;
    // With no payment entered (or one under the interest), at least today's
    // interest is paid each month: an interest-only mortgage, not a growing
    // one. A fixed payment, so overpaying still saves.
    const atRate = rate => {
      const due = () => Math.max(pay, bal * rate / 100 / 12);
      return overpaid((extra, l, upTo) => debtScenario({ months: upTo ?? months, balance: bal, ratePct: () => rate, due, extra, lump: l }), surplus, lump);
    };
    const central = atRate(baseRate);
    options.push({
      label: "Mortgage overpayment",
      low: Math.round(atRate(Math.max(0, baseRate - 0.5)).worth),
      central: Math.round(central.worth),
      high: Math.round(atRate(baseRate + 0.5).worth),
      clearedAt: central.clearedAt,
      applicable: true,
    });
  }

  // ── 2. Student loan overpayment ────────────────────────────────────────
  if (m.loanBal > 0) {
    const { writeOffYr, threshold, repayRate, earnings, rate: baseSlRate } = studentLoanTerms(d, m);
    const growth = m.payGrowth ?? m.salaryGrowthRate;
    // Lump sum reduces opening balance for the overpayment scenario; baseline is unchanged
    const overBal = Math.max(0, m.loanBal - lump);

    // First check whether overpaying changes the write-off outcome at all
    const baseWriteOff = simulateLoan(m.loanBal, earnings, growth, baseSlRate, threshold, repayRate, writeOffYr, 0);
    const overWriteOff = simulateLoan(overBal, earnings, growth, baseSlRate, threshold, repayRate, writeOffYr, surplus);
    // If the loan is written off in both scenarios, overpaying just reduces the amount forgiven — no benefit
    const writtenOffAnyway = !baseWriteOff.cleared && !overWriteOff.cleared;

    let slCentral = 0, slLow = 0, slHigh = 0, clearedAt = null;
    if (!writtenOffAnyway) {
      // The repayment due each month: the plan's share of that year's pay
      // over the threshold (pay rising as simulateLoan's).
      const payIn = y => earnings * payFactor(growth, y);
      const due = mth => { const y = Math.floor(mth / 12); return Math.max(0, (payIn(y) - threshold(y)) * repayRate) / 12; };
      const loan = o => debtScenario({ balance: m.loanBal, ratePct: y => baseSlRate(y) * 100, due, endsAt: writeOffYr * 12, ...o });
      const r = overpaid((extra, l, upTo) => loan({ months: upTo ?? months, extra, lump: l }), surplus, lump);
      clearedAt = r.clearedAt;
      // Left alone it would be written off: what overpaying saves is only
      // the repayments that would still have been taken from then to the
      // write-off, not the balance that would have been forgiven.
      if (!baseWriteOff.cleared && r.clearedAt != null) {
        r.worth = Math.min(r.worth, loan({ months: writeOffYr * 12, countFrom: r.clearedAt }).paidFrom);
      }
      // Low/high reflect salary growth uncertainty on the interest saved
      slCentral = Math.round(r.worth);
      slLow     = Math.max(0, Math.round(r.worth - r.interestSaved * 0.15)); // slower salary growth → mandatory repayments stretch, less benefit
      slHigh    = Math.round(r.worth + r.interestSaved * 0.05); // marginal upside from faster clearance
    }

    options.push({
      label: "Student loan overpayment",
      low: slLow, central: slCentral, high: slHigh,
      clearedAt,
      applicable: true,
      writtenOffAnyway,
      note: writtenOffAnyway
        ? "Overpaying doesn't change the outcome — this loan is likely written off before clearance regardless."
        : null,
    });
  }

  // ── 3 and 4. ISAs ────────────────────────────────────────────────────────
  // Each fills the allowance first (what's left of this tax year's, then
  // £20,000 a year); over it, the overflow goes where `overflow` says,
  // taxed. Shares at 4/6/8%; cash at the user's own rate if given, else
  // UK market defaults (d.cashRate and d.savingsRate are percentages).
  const userRatePct = +d.cashRate > 0 ? +d.cashRate : +d.savingsRate > 0 ? +d.savingsRate : 0;
  const cashCentralDec = userRatePct > 0 ? userRatePct / 100 : CASH_RATE_CENTRAL;
  const cashLowDec     = userRatePct > 0 ? cashCentralDec - 0.015 : CASH_RATE_LOW;
  // Half a point over central, held to the best rate around unless their
  // own rate is already above it (never under central).
  const cashHighDec    = Math.max(cashCentralDec, Math.min(cashCentralDec + 0.005, CASH_RATE_HIGH));
  const sharesRates = [4, GROWTH_NOMINAL_PCT, 8];
  const cashRates = [cashLowDec, cashCentralDec, cashHighDec].map(r => Math.max(0, r * 100));
  const outRates = overflow === "cash" ? cashRates : sharesRates;
  const outKind = overflow === "cash" ? "cash" : "shares";
  const isaLine = (label, isaRates, room) => {
    const at = (i, split = false) => growPot({ months, ratePct: isaRates[i], outRatePct: outRates[i], monthly: surplus, lump, isaRoom: room, kind: outKind, tax, split });
    const mid = at(1, true);
    return { label, low: Math.round(at(0)), central: Math.round(mid.total), high: Math.round(at(2)),
      split: { isa: Math.round(mid.isa), out: Math.round(mid.out) }, applicable: true };
  };
  options.push(isaLine("Stocks & Shares ISA", sharesRates, y => y === 0 ? (m.isaHeadroom ?? ISA_ALLOWANCE) : ISA_ALLOWANCE));
  options.push(isaLine("Cash savings", cashRates, y => y === 0 ? (m.cashIsaHeadroom ?? cashIsaLimit()) : cashIsaLimit()));

  // ── 5 and 6. Pension ─────────────────────────────────────────────────────
  // What the money becomes in the pension once relief is added, band by
  // band (and the NI a salary sacrifice saves). The lump goes in this year,
  // with this year's monthly amounts.
  if (d.pensionType === "sacrifice" || d.pensionType === "relief") {
    const sacrifice = d.pensionType === "sacrifice";
    const grossFor = pensionGrossFor(d, m, sacrifice);
    const yearNet = surplus * 12;
    let firstGross, lumpGross;
    if (sacrifice) {
      // A one-off from savings can't be sacrificed from pay: it's a personal
      // payment, with the provider's 20% and the rest band by band, on the
      // income left after this year's sacrifice, and no NI saved.
      const yearGross = grossFor(yearNet, 0);
      const income = (m.adjustedNetIncome || 0) - yearGross;
      const room = Math.max(0, calcAnnualAllowanceRoom(d, m).room - yearGross);
      lumpGross = grossForNet(lump, g => reliefBandByBand(income, Math.min(g, room), { scottish: !!m.scottish, atSource: true }));
      firstGross = yearGross + lumpGross;
    } else {
      firstGross = grossFor(yearNet + lump, 0);
      lumpGross = yearNet + lump > 0 ? firstGross * lump / (yearNet + lump) : 0;
    }
    const monthlyGross = y => y === 0 ? (firstGross - lumpGross) / 12 : grossFor(yearNet, y) / 12;
    const pension = rate => growPot({ months, ratePct: rate, monthly: monthlyGross, lump: lumpGross });
    options.push({
      label: sacrifice ? "Pension (salary sacrifice)" : "Pension (relief at source)",
      low: Math.round(pension(4)),
      central: Math.round(pension(6)),
      high: Math.round(pension(8)),
      applicable: true,
    });
  }

  const overAllowance = options.some(o => o.split?.out > 0);
  return { horizonYears, monthlySurplus: surplus, overflow, overAllowance, options };
}

// Returns the year-by-year CENTRAL trajectory (years 0..horizonYears) for
// each applicable forecast option, for plotting on a line graph: calcForecast
// at each year. A debt's line stops the year it clears (`termYear`).
export function calcForecastSeries(d, m, surplusOverride, horizonYears, lumpSumOverride = 0, opts = {}) {
  const lump = +lumpSumOverride || 0;
  const years = Array.from({ length: horizonYears + 1 }, (_, i) => i);
  const byYear = years.map(y => calcForecast(d, m, surplusOverride, y, lump, opts).options);
  const series = byYear[horizonYears].map(opt => {
    const termYear = opt.clearedAt != null ? Math.ceil(opt.clearedAt / 12) : null;
    return {
      label: opt.label,
      ...(termYear != null && termYear < horizonYears ? { termYear, termLabel: "Cleared" } : {}),
      values: opt.writtenOffAnyway ? years.map(() => 0) : byYear.map(o => o.find(x => x.label === opt.label)?.central ?? 0),
    };
  });
  return { years, series };
}

// Assumption notes + rate ranges shown behind each forecast option's "?" —
// single source of truth for the Forecast screen. `overflow`: where money
// over the ISA allowance goes (calcForecast).
export function buildForecastAssumptions(d, m, overflow = "shares") {
  const slRatePct = Math.round(resolveSlRate(d, m.salary) * 1000) / 10;
  const pct = dec => `${(dec * 100).toFixed(1)}%`;
  const userRatePct = +d.cashRate > 0 ? +d.cashRate : +d.savingsRate > 0 ? +d.savingsRate : 0;
  const cashCentral = userRatePct > 0 ? userRatePct / 100 : CASH_RATE_CENTRAL;
  const cashLow = userRatePct > 0 ? Math.max(0, cashCentral - 0.015) : CASH_RATE_LOW;
  const cashHigh = Math.max(cashCentral, Math.min(cashCentral + 0.005, CASH_RATE_HIGH));
  const allowance = "the ISA allowance (what's left of this tax year's, then £20,000 a year)";
  const growth = { low: "4%", central: `${GROWTH_NOMINAL_PCT}%`, high: "8%" };
  const over = overflow === "cash"
    ? "Over it, in a savings account: interest above your tax-free amount (after what your savings already earn) is taxed at your rate."
    : `Over it, in shares held outside an ISA: dividends (${DIVIDEND_YIELD * 100}% a year of the growth) are taxed over the £500 allowance; tax on gains when sold isn't counted.`;
  const notTaxedOut = "Income drawn from a pension is taxed, and that tax isn't taken off here.";
  return {
    "Mortgage overpayment": {
      lines: [
        "The mortgage you'd no longer owe: the money paid in and the interest saved.",
        "If it's cleared, the line stops there.",
        "Low and high move the mortgage rate half a point either way.",
      ],
      rates: {
        low: `${Math.max(0, (+d.mortgageRate||0) - 0.5).toFixed(1)}%`,
        central: `${(+d.mortgageRate||0).toFixed(1)}%`,
        high: `${((+d.mortgageRate||0) + 0.5).toFixed(1)}%`,
      },
    },
    "Student loan overpayment": {
      lines: [
        "The loan you'd no longer owe: the money paid in and the interest saved. If it's cleared, the line stops there.",
        `Interest rate: ${slRatePct}% a year (${+d.studentLoanRate > 0 ? "your entered rate" : "the plan's rate"}).`,
        "Low and high reflect how fast your pay grows, not a different rate.",
        "If the loan is written off whether you overpay or not, overpaying gains nothing.",
      ],
      rates: { low: `${slRatePct}%`, central: `${slRatePct}%`, high: `${slRatePct}%` },
    },
    "Stocks & Shares ISA": {
      lines: [
        "An illustrative growth rate for shares, compounding monthly.",
        `Tax-free in an ISA up to ${allowance}.`,
        over,
        "Past performance is not a reliable guide to future returns.",
      ],
      rates: growth,
    },
    "Cash savings": {
      lines: [
        `An easy-access Cash ISA, tax-free up to ${allowance}.`,
        over,
        userRatePct > 0 ? "Your own rate in the middle, 1.5 points lower and half a point higher either side." : "Typical UK easy-access rates.",
      ],
      rates: { low: pct(cashLow), central: pct(cashCentral), high: pct(cashHigh) },
    },
    "Pension (salary sacrifice)": {
      lines: [
        "Paid before income tax and National Insurance, so each £1 of take-home puts more in: the tax on each slice of your income at its own rate.",
        "From April 2029 National Insurance is saved on only the first £2,000 a year sacrificed.",
        `Excludes employer contributions on the extra amount. ${notTaxedOut}`,
      ],
      rates: growth,
    },
    "Pension (relief at source)": {
      lines: [
        "Your provider adds 20%; on income taxed above 20%, the rest is claimed through Self Assessment, slice by slice at its own rate.",
        notTaxedOut,
      ],
      rates: growth,
    },
  };
}

// ── Net worth trajectory — year-by-year projection of the same asset/
// liability breakdown calcMetrics uses for today's net worth (m.netWorth),
// each component grown forward under assumptions already used elsewhere in
// the app rather than new invented rates:
//   - Cash: at the user's own effective savings rate (a stated 0% stays
//     0%), topped up monthly by ongoing surplus only until it reaches the
//     emergency buffer target (m.emergencyBuffer — expenses × buffer
//     months, already computed). Beyond that, surplus is assumed to flow
//     into investments instead. Interest outside ISAs is taxed each year
//     above the tax-free amount (growthTax).
//   - Investments: ISAs and unwrapped holdings grown at 6% nominal. Surplus
//     swept in goes into an ISA up to the allowance (what's left this tax
//     year, then £20,000 a year), the rest unwrapped. Unwrapped holdings pay
//     tax on their dividends (DIVIDEND_YIELD) above the £500 allowance.
//   - Pension: potVal plus ongoing contributions grown at 6% a year until
//     they stop working, then drawn down evenly to empty by 87. Not taxed
//     on the way out.
//   - Student loan: the same year-stepping interest/repayment model
//     calcStudentLoanScenario uses, extended to expose every year's balance.
//   - Personal loan / mortgage: amortised at their own entered rate and
//     repayment; with no mortgage payment entered (or one under the
//     interest), interest-only, so the balance holds rather than grows.
//   - Property equity: property VALUE held flat (no house-price growth is
//     assumed anywhere else in the app) — equity only grows as the mortgage
//     balance is paid down; owned-outright property stays flat throughout.
// Net worth = assets (incl. property equity, already net of mortgage) minus
// remaining student loan + personal loan — mortgage is deliberately not
// subtracted again here, matching calcMetrics' own netWorth formula exactly
// (double-subtracting it would double-count debt already reflected in a
// reduced propertyEquity).
// `surplusOverride`: the monthly amount saved, in place of the estimate from
// their answers (m.monthlySurplus); Forecast passes only what the user typed.
export function calcNetWorthTrajectory(d, m, horizonYears, surplusOverride = null) {
  // Pensions and investments both at 6% a year before inflation (growth.js).
  const PENSION_RATE = GROWTH_NOMINAL_PCT / 100, INVESTMENT_RATE = GROWTH_NOMINAL_PCT / 100;
  const cashRatePct = m.effectiveSavingsRate ?? 3.5;
  const cashMonthlyRate = cashRatePct / 100 / 12;
  const investMonthlyRate = INVESTMENT_RATE / 12;
  const cashCapTarget = m.emergencyBuffer || 0;
  const monthlySurplus = Math.max(0, (surplusOverride != null ? +surplusOverride : m.monthlySurplus) || 0);

  // Tax on today's own savings and holdings: the tax-free amounts are theirs
  // to use. The share of the cash line whose interest is taxable: their cash
  // less the Cash ISA money they've told us about, of everything in the line
  // (m.totalLiquid, Premium Bonds included, whose prizes are tax-free).
  const tax = growthTax(d, m, { usedInterest: 0, usedDividends: 0 });
  const cashIsaMoney = (+d.isaPrevCash || 0) + (+d.isaThisYearCash || 0);
  const taxableShare = (m.totalLiquid || 0) > 0 ? Math.min(1, Math.max(0, (m.cash || 0) - cashIsaMoney) / m.totalLiquid) : 1;

  const potVal = (+d.potValue||0) + (+d.potValue2||0);
  // The employer matches what the user pays, up to its cap (as calcMetrics).
  const pensionAnnualContrib = ((+d.myContribution||0) + employerPct(d)) / 100 * m.salary;

  const isaUsedThisYear = isaUsedAcrossAll(d);
  const isaPrev = (+d.isaPrevCash||0) + (+d.isaPrevSS||0) + (+d.isaPrevLISA||0) + (+d.isaPrevOther||0) || (+d.isaPreviousBalance||0);
  let isaBal = isaUsedThisYear + isaPrev;
  let giaBal = +d.unwrappedValue||0;
  let cashBal = m.totalLiquid || 0;

  // Written off when calcStudentLoanScenario says (from when repayments started).
  // The balance each year as the student loan module projects it
  // (calcStudentLoanScenario's balancePath): £0 once it clears or is written off.
  const slPath = d.studentLoan && d.studentLoan !== "none" && m.loanBal > 0 ? calcStudentLoanScenario(d, m).balancePath : [];

  const plRate = (+d.personalLoanRate||0) / 100;
  const plAnnualPmt = m.personalLoanAnnualRepayment || 0;

  const mortRate = (+d.mortgageRate||0) / 100;
  let loanBal = m.loanBal || 0;
  let plBal = d.hasPersonalLoan === "yes" ? (+d.personalLoanBalance||0) : 0;
  let mortBal = d.hasMortgage === "yes" ? (+d.mortgageBalance||0) : 0;
  // At least today's interest each month: with no payment entered, an
  // interest-only mortgage that holds its balance.
  const monthlyMortgagePmt = Math.max(+d.monthlyMortgage||0, mortBal * mortRate / 12);

  // Working until they stop (metrics retirementAgeFor): until then, the
  // monthly surplus is saved and pension payments go in. After, both stop,
  // and the pension is drawn down evenly to empty by DRAWDOWN_TO_AGE (87),
  // the money spent rather than saved.
  const age = +d.age || 0;
  const workYears = age > 0 ? Math.max(0, retirementAgeFor(d) - age) : Infinity;
  let pensionBal = potVal;

  const rows = [];
  for (let yr = 0; yr <= horizonYears; yr++) {
    const working = yr <= workYears;
    const surplusNow = working ? monthlySurplus : 0;
    if (yr > 0) {
      // The tax year this projection year falls in (0 = this one), for the
      // rates and the ISA allowance.
      const y = yr - 1;
      if (working) pensionBal = pensionBal * (1 + PENSION_RATE) + pensionAnnualContrib;
      else {
        const yearsLeft = DRAWDOWN_TO_AGE - (age + yr - 1);
        const draw = yearsLeft <= 1 ? pensionBal * (1 + PENSION_RATE) : pensionBal * PENSION_RATE / (1 - Math.pow(1 + PENSION_RATE, -yearsLeft));
        pensionBal = Math.max(0, pensionBal * (1 + PENSION_RATE) - draw);
      }
      loanBal = slPath[yr]?.bal ?? 0;
      if (plBal > 0) plBal = Math.max(0, plBal * (1 + plRate) - plAnnualPmt);
      const mortMonthlyRate = mortRate / 12;
      let isaRoom = y === 0 ? (m.isaHeadroom ?? ISA_ALLOWANCE) : ISA_ALLOWANCE;
      let cashInterest = 0, dividends = 0;
      const invest = amt => { const toIsa = Math.min(amt, isaRoom); isaRoom -= toIsa; isaBal += toIsa; giaBal += amt - toIsa; };
      for (let mth = 0; mth < 12; mth++) {
        if (mortBal > 0) {
          mortBal += mortBal * mortMonthlyRate;
          mortBal = Math.max(0, mortBal - monthlyMortgagePmt);
        }
        cashInterest += cashBal * cashMonthlyRate;
        cashBal *= (1 + cashMonthlyRate);
        dividends += giaBal * DIVIDEND_YIELD / 12;
        isaBal *= (1 + investMonthlyRate);
        giaBal *= (1 + investMonthlyRate);
        if (cashBal < cashCapTarget) {
          const toCash = Math.min(surplusNow, cashCapTarget - cashBal);
          cashBal += toCash;
          invest(surplusNow - toCash);
        } else {
          invest(surplusNow);
        }
      }
      cashBal = Math.max(0, cashBal - tax.interest(cashInterest * taxableShare, y));
      giaBal = Math.max(0, giaBal - tax.dividends(dividends, y));
    }
    const pension = pensionBal;
    const cash = cashBal, investments = isaBal + giaBal;
    const propertyEquity = d.hasMortgage === "yes" ? Math.max(0, (m.propertyValue||0) - mortBal)
      : d.ownsOutright ? (+d.outrightPropertyValue||0)
      : 0;
    const debts = loanBal + plBal;
    const assets = cash + investments + pension + propertyEquity;
    rows.push({
      year: yr,
      cash: Math.round(cash), investments: Math.round(investments), pension: Math.round(pension),
      propertyEquity: Math.round(propertyEquity), mortgageBalance: Math.round(mortBal), debts: Math.round(debts),
      netWorth: Math.round(assets - debts),
    });
  }
  return rows;
}
