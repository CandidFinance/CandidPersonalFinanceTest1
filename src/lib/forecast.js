import { resolveSlRate } from "./studentLoan.js";
import { pensionReturnRatio } from "./pension.js";

// Static defaults — replace with live Moneyfacts API rates in future
export const CASH_RATE_LOW     = 0.030; // below average, high-street loyal-customer rate
export const CASH_RATE_CENTRAL = 0.045; // market-leading easy access rate
export const CASH_RATE_HIGH    = 0.050; // best available, a ceiling not a guarantee

// ── Month-by-month student loan simulator ────────────────────────────────────────────
export function simulateLoan(openingBalance, annualSalary, salaryGrowthRate, interestRate, repaymentThreshold, repaymentRate, maxYears = 30, extraMonthly = 0, trackYearly = false) {
  let balance = openingBalance;
  let salary = annualSalary;
  let totalInterest = 0;
  let totalPaid = 0;
  let monthsToClear = null;
  const monthlyRate = interestRate / 12;
  // yearlyInterest[y] = cumulative interest accrued through end of year y (index 0 = £0 at start)
  const yearlyInterest = trackYearly ? [0] : null;
  for (let month = 0; month < maxYears * 12; month++) {
    if (balance <= 0) break;
    const interest = balance * monthlyRate;
    balance += interest;
    totalInterest += interest;
    const annualRepayment = Math.max(0, (salary - repaymentThreshold) * repaymentRate);
    const monthlyRepayment = annualRepayment / 12 + extraMonthly;
    const payment = Math.min(monthlyRepayment, balance);
    balance -= payment;
    totalPaid += payment;
    if (balance <= 0 && monthsToClear === null) monthsToClear = month + 1;
    if ((month + 1) % 12 === 0) {
      salary *= (1 + salaryGrowthRate);
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

// Projects low/central/high values at `horizonYears` for each way the user's
// monthly surplus could be put to work: mortgage overpayment, student loan
// overpayment, Stocks & Shares ISA, cash savings, and pension salary sacrifice.
// Returns { horizonYears, monthlySurplus, options }, where `options` only
// includes entries applicable to this user (applicable: true).
export function calcForecast(d, m, surplusOverride, horizonYears, lumpSumOverride = 0) {
  const surplus = surplusOverride != null ? +surplusOverride : m.monthlySurplus;
  const lump = +lumpSumOverride || 0;
  const months = horizonYears * 12;
  const options = [];

  // ── 1. Mortgage overpayment ────────────────────────────────────────────
  const hasOverpayableMortgage = d.hasMortgage === "yes" && !d.ownsOutright && (+d.mortgageBalance||0) > 0;
  if (hasOverpayableMortgage) {
    const bal = +d.mortgageBalance||0;
    const pay = +d.monthlyMortgage||0;
    const baseRate = +d.mortgageRate||0;
    const valueAtRate = (rate) => {
      // Lump sum reduces opening balance immediately; monthly surplus added to regular payment
      const openBal = Math.max(0, bal - lump);
      const base = simulateAmortisation(bal, rate, pay, months);
      const over = simulateAmortisation(openBal, rate, pay + surplus, months);
      let value = base.totalInterest - over.totalInterest + lump;
      if (over.monthsToClear !== null && over.monthsToClear < months) {
        // Freed-up payment invested in cash savings for remaining months
        value += fvAnnuity(pay + surplus, CASH_RATE_CENTRAL * 100, months - over.monthsToClear);
      }
      return value;
    };
    options.push({
      label: "Mortgage overpayment",
      low: Math.round(valueAtRate(Math.max(0, baseRate - 0.5))),
      central: Math.round(valueAtRate(baseRate)),
      high: Math.round(valueAtRate(baseRate + 0.5)),
      applicable: true,
    });
  }

  // ── 2. Student loan overpayment ────────────────────────────────────────
  if (m.loanBal > 0) {
    const writeOffYr = d.studentLoan === "plan2" ? 30 : d.studentLoan === "plan5" ? 40 : 25;
    const threshold  = d.studentLoan === "plan2" ? 27295 : d.studentLoan === "plan5" ? 25000 : 24990;
    const baseSlRate = resolveSlRate(d, m.salary);
    // Cap simulation at write-off year — no point modelling interest past when the loan is forgiven
    const simYears = Math.min(horizonYears, writeOffYr);
    // Lump sum reduces opening balance for the overpayment scenario; baseline is unchanged
    const overBal = Math.max(0, m.loanBal - lump);

    // First check whether overpaying changes the write-off outcome at all
    const baseWriteOff = simulateLoan(m.loanBal, m.salary, m.salaryGrowthRate, baseSlRate, threshold, 0.09, writeOffYr, 0);
    const overWriteOff = simulateLoan(overBal, m.salary, m.salaryGrowthRate, baseSlRate, threshold, 0.09, writeOffYr, surplus);
    // If the loan is written off in both scenarios, overpaying just reduces the amount forgiven — no benefit
    const writtenOffAnyway = !baseWriteOff.cleared && !overWriteOff.cleared;

    let slCentral = 0, slLow = 0, slHigh = 0;
    if (!writtenOffAnyway) {
      // Benefit = cumulative interest saved vs baseline (not a compounding figure)
      const base = simulateLoan(m.loanBal, m.salary, m.salaryGrowthRate, baseSlRate, threshold, 0.09, simYears, 0);
      const over = simulateLoan(overBal, m.salary, m.salaryGrowthRate, baseSlRate, threshold, 0.09, simYears, surplus);
      const interestSaved = Math.max(0, base.totalInterest - over.totalInterest);
      // Low/high reflect salary growth uncertainty — not rate-sensitive
      slCentral = Math.round(interestSaved);
      slLow     = Math.round(interestSaved * 0.85); // slower salary growth → mandatory repayments stretch, less benefit
      slHigh    = Math.round(interestSaved * 1.05); // marginal upside from faster clearance
    }

    options.push({
      label: "Student loan overpayment",
      low: slLow, central: slCentral, high: slHigh,
      applicable: true,
      writtenOffAnyway,
      note: writtenOffAnyway
        ? "Overpaying doesn't change the outcome — this loan is likely written off before clearance regardless."
        : null,
    });
  }

  // ── 3. Stocks & Shares ISA ──────────────────────────────────────────────
  options.push({
    label: "Stocks & Shares ISA",
    low: Math.round(fvSingle(lump, 4, months) + fvAnnuity(surplus, 4, months)),
    central: Math.round(fvSingle(lump, 6, months) + fvAnnuity(surplus, 6, months)),
    high: Math.round(fvSingle(lump, 8, months) + fvAnnuity(surplus, 8, months)),
    applicable: true,
  });

  // ── 4. Cash savings ───────────────────────────────────────────────────────
  // Use hardcoded UK market defaults unless the user has supplied their own rate.
  // d.cashRate and d.savingsRate are stored as percentages (e.g. 4.5 = 4.5%).
  const userRatePct = +d.cashRate > 0 ? +d.cashRate : +d.savingsRate > 0 ? +d.savingsRate : 0;
  // Convert to decimal for spread arithmetic, then back to % for fvAnnuity/fvSingle
  const cashCentralDec = userRatePct > 0 ? userRatePct / 100 : CASH_RATE_CENTRAL;
  const cashLowDec     = userRatePct > 0 ? cashCentralDec - 0.015 : CASH_RATE_LOW;
  const cashHighDec    = Math.min(userRatePct > 0 ? cashCentralDec + 0.005 : CASH_RATE_CENTRAL + 0.005, CASH_RATE_HIGH);
  options.push({
    label: "Cash savings",
    low: Math.round(fvSingle(lump, Math.max(0, cashLowDec * 100), months) + fvAnnuity(surplus, Math.max(0, cashLowDec * 100), months)),
    central: Math.round(fvSingle(lump, cashCentralDec * 100, months) + fvAnnuity(surplus, cashCentralDec * 100, months)),
    high: Math.round(fvSingle(lump, cashHighDec * 100, months) + fvAnnuity(surplus, cashHighDec * 100, months)),
    applicable: true,
  });

  // ── 5. Pension (salary sacrifice) ──────────────────────────────────────
  if (d.pensionType === "sacrifice") {
    // Tax + NI relief boosts every £1 of surplus into the pension immediately.
    const ratio = pensionReturnRatio(d, m);
    options.push({
      label: "Pension (salary sacrifice)",
      low: Math.round(fvSingle(lump * ratio, 4, months) + fvAnnuity(surplus * ratio, 4, months)),
      central: Math.round(fvSingle(lump * ratio, 6, months) + fvAnnuity(surplus * ratio, 6, months)),
      high: Math.round(fvSingle(lump * ratio, 8, months) + fvAnnuity(surplus * ratio, 8, months)),
      applicable: true,
    });
  }

  // ── 6. Pension (relief at source) ──────────────────────────────────────
  if (d.pensionType === "relief") {
    // HMRC adds 20% basic-rate relief automatically — every £1 you put in becomes £1.25 in the pension.
    // Higher/additional rate taxpayers can claim further relief via self-assessment, but we model the
    // conservative floor (basic rate top-up only) to avoid over-stating the benefit.
    const effectiveLump = lump * 1.25;
    const effectiveMonthly = surplus * 1.25;
    options.push({
      label: "Pension (relief at source)",
      low: Math.round(fvSingle(effectiveLump, 4, months) + fvAnnuity(effectiveMonthly, 4, months)),
      central: Math.round(fvSingle(effectiveLump, 6, months) + fvAnnuity(effectiveMonthly, 6, months)),
      high: Math.round(fvSingle(effectiveLump, 8, months) + fvAnnuity(effectiveMonthly, 8, months)),
      applicable: true,
    });
  }

  return { horizonYears, monthlySurplus: surplus, options };
}

// Returns the year-by-year CENTRAL trajectory (years 0..horizonYears) for
// each applicable forecast option, for plotting on a line graph.
// Student loan uses a dedicated cumulative-interest-saved model (rises then
// flatlines once the overpayment scenario clears the loan — see note inline).
// All other options use calcForecast evaluated at each year.
export function calcForecastSeries(d, m, surplusOverride, horizonYears, lumpSumOverride = 0) {
  const surplus = surplusOverride != null ? +surplusOverride : m.monthlySurplus;
  const lump = +lumpSumOverride || 0;
  const years = Array.from({ length: horizonYears + 1 }, (_, i) => i);
  const { options } = calcForecast(d, m, surplusOverride, horizonYears, lump);

  const series = options.map(opt => {
    if (opt.label === "Student loan overpayment") {
      // All-zero if written off in both scenarios
      if (opt.writtenOffAnyway) return { label: opt.label, values: years.map(() => 0) };

      const writeOffYr = d.studentLoan === "plan2" ? 30 : d.studentLoan === "plan5" ? 40 : 25;
      const threshold  = d.studentLoan === "plan2" ? 27295 : d.studentLoan === "plan5" ? 25000 : 24990;
      const baseSlRate = resolveSlRate(d, m.salary);
      const overBal = Math.max(0, m.loanBal - lump);
      // Simulate both scenarios once, capturing yearly cumulative interest snapshots
      const simYears = Math.min(horizonYears, writeOffYr);
      const base = simulateLoan(m.loanBal, m.salary, m.salaryGrowthRate, baseSlRate, threshold, 0.09, simYears, 0, true);
      const over = simulateLoan(overBal, m.salary, m.salaryGrowthRate, baseSlRate, threshold, 0.09, simYears, surplus, true);
      // Flatline at the year the overpayment scenario clears: once cleared, the
      // interest saving is fully realised and the curve stops growing.
      const clearYear = over.monthsToClear !== null ? Math.ceil(over.monthsToClear / 12) : null;
      // termYear = the year where the series stops changing (loan cleared or written off)
      const flatlineAt = Math.min(clearYear !== null ? clearYear : simYears, simYears);
      const termYear = flatlineAt < horizonYears ? flatlineAt : null;
      const termLabel = termYear !== null ? (clearYear !== null ? "Cleared" : "Written off") : null;
      return {
        label: opt.label,
        termYear,
        termLabel,
        values: years.map(y => {
          const capY = Math.min(y, clearYear !== null ? clearYear : simYears, simYears);
          const baseInt = base.yearlyInterest[capY] ?? 0;
          const overInt = over.yearlyInterest[capY] ?? 0;
          return Math.max(0, Math.round(baseInt - overInt));
        }),
      };
    }

    // All other options: evaluate calcForecast at each year for the central value
    return {
      label: opt.label,
      values: years.map(y => calcForecast(d, m, surplusOverride, y, lump).options.find(o => o.label === opt.label)?.central ?? 0),
    };
  });

  return { years, series };
}

// Assumption notes + rate ranges shown behind each forecast option's "?" —
// single source of truth for both desktop's ForecastScreen table and the
// mobile Forecast screen, so the two can't drift into different wording.
export function buildForecastAssumptions(d, m) {
  const slRatePct = Math.round(resolveSlRate(d, m.salary) * 1000) / 10;
  return {
    "Mortgage overpayment": {
      lines: [
        `Interest saved by overpaying at your current mortgage rate.`,
        `If cleared early, freed-up payments earn ${(CASH_RATE_CENTRAL*100).toFixed(1)}% in savings for the remaining period.`,
        `Low / High shift the mortgage rate ±0.5%.`,
      ],
      rates: {
        low: `${Math.max(0, (+d.mortgageRate||0) - 0.5).toFixed(1)}%`,
        central: `${(+d.mortgageRate||0).toFixed(1)}%`,
        high: `${((+d.mortgageRate||0) + 0.5).toFixed(1)}%`,
      },
    },
    "Student loan overpayment": {
      lines: [
        `Cumulative interest saved vs making no extra repayments.`,
        `Interest rate: ${slRatePct}% p.a. (${+d.studentLoanRate > 0 ? "your entered rate" : "SLC 2024/25 default"}).`,
        `Low / High reflect salary growth uncertainty — not a rate variation.`,
        `Benefit is zero if the loan is written off regardless of overpayment.`,
      ],
      rates: {
        low: `${slRatePct}%`,
        central: `${slRatePct}%`,
        high: `${slRatePct}%`,
      },
    },
    "Stocks & Shares ISA": {
      lines: [
        `Globally diversified index fund, returns compound monthly.`,
        `Tax-free inside an ISA.`,
        `Past performance is not a reliable guide to future returns.`,
      ],
      rates: { low: "4% p.a.", central: "6% p.a.", high: "8% p.a." },
    },
    "Cash savings": {
      lines: [
        `Easy-access savings account or Cash ISA.`,
        `UK market defaults (Sep 2024). Your entered rate used as central if provided, with a ±1.5% spread.`,
      ],
      rates: {
        low: `${(CASH_RATE_LOW*100).toFixed(1)}% p.a.`,
        central: `${(CASH_RATE_CENTRAL*100).toFixed(1)}% p.a.`,
        high: `${(CASH_RATE_HIGH*100).toFixed(1)}% p.a.`,
      },
    },
    "Pension (salary sacrifice)": {
      lines: [
        `Surplus paid before tax and NI — HMRC effectively tops it up immediately.`,
        `Uplift reflects your marginal tax rate plus the employer NI saving passed through.`,
        `Excludes employer contributions on the extra amount.`,
      ],
      rates: { low: "4% p.a.", central: "6% p.a.", high: "8% p.a." },
    },
    "Pension (relief at source)": {
      lines: [
        `Every £1 you contribute becomes £1.25 in the pension (20% HMRC basic-rate top-up).`,
        `Higher-rate relief via self-assessment not modelled — conservative estimate.`,
      ],
      rates: { low: "4% p.a.", central: "6% p.a.", high: "8% p.a." },
    },
  };
}
