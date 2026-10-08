// A module's answer in three steps, shown the first time its walk-through is
// finished (and again on request): the answer, why, and what the user could
// do. Worked out from the same figures the module's own screen shows, so the
// two always agree. Phrased as information, not instruction: Candid is
// guidance, not advice. Pure, unit tested in moduleReveal.test.js.
//
// A step is { label, figure?, title, body? }. Each function takes (d, m,
// ctx), ctx being { marketRates } (the live best rates, as the screens use),
// and returns three steps, or null when there's nothing to explain (no
// student loan, say), in which case no reveal or "Explain this" is offered.

import { fmt } from "./format.js";
import { isPensionContributing, calcAnnualAllowanceRoom, calcPensionTaperSaving, calcBonusSacrificePotential, missedPensionRelief, calcTaxFreeCash, LUMP_SUM_ALLOWANCE, LSA_INFLECTION_POT } from "./pension.js";
import { calcDrawdown, DEFAULT_DRAWDOWN_YEARS } from "./drawdown.js";
import { calcCashOptimisation } from "./cash.js";
import { cashOpportunity } from "./assist.js";
import { calcStudentLoanScenario } from "./studentLoan.js";
import { CGT_ALLOWANCE } from "./rentVsBuy.js";

const ANSWER = "Your answer", WHY = "Why", ACTION = "What you could do";
const HR = "HR or payroll can change it, usually from the next month.";

export function pensionReveal(d, m) {
  if (m.pensionStatus === "unknown") {
    return [
      { label: ANSWER, title: "We need two numbers to check your pension." },
      { label: WHY, title: "What you pay in, and how much your employer will match, decide whether you're missing free money." },
      { label: ACTION, title: "Ask HR or payroll what you pay in and what your employer matches.", body: "Then come back and update your answers here." },
    ];
  }

  const trPct = Math.round(m.tr * 100);
  const myPct = +d.myContribution || 0;
  const empPct = +d.employerMatch || 0;

  // Not paying in: the tax relief on 5% of salary, the figure the module's
  // status and the score use (computeModuleStatuses).
  // Not paying in, with no earnings to pay in from (retired, say): what
  // matters is what can come out tax-free, not relief there's none of.
  if (!isPensionContributing(d) && missedPensionRelief(d, m) === 0) {
    const cash = calcTaxFreeCash(d);
    if (!(cash.pot > 0)) return null;
    const plan = calcDrawdown(d, m, { years: DEFAULT_DRAWDOWN_YEARS });
    const protectionUnknown = !d.pensionProtection;
    return [
      { label: ANSWER, figure: fmt(cash.taxFree), title: `of your pension can ${cash.taken > 0 ? "still " : ""}be taken tax-free.` },
      cash.capped
        ? { label: WHY, title: cash.taken > 0
              ? `25% of the part you haven't touched would be ${fmt(cash.quarter)}, but only ${fmt(cash.left)} of your ${fmt(cash.allowance)} limit is left.`
              : `25% of your pot would be ${fmt(cash.quarter)}, but tax-free cash stops at ${fmt(cash.allowance)}${cash.allowance === LUMP_SUM_ALLOWANCE ? ", the Lump Sum Allowance" : ", your protected limit"}.`,
            body: `The rest is taxed as income when it's taken out.${cash.allowance === LUMP_SUM_ALLOWANCE && cash.taken === 0 ? ` That's what happens above a pot of ${fmt(LSA_INFLECTION_POT)}.` : ""}${protectionUnknown ? " A Fixed or Individual Protection from 2012 to 2016 allows more, up to £450,000." : ""}` }
        : { label: WHY, title: `Up to 25% of a pension can be taken tax-free, to a limit of ${fmt(cash.allowance)}${cash.taken > 0 ? `, less the ${fmt(cash.taken)} already taken` : ""}. The rest is taxed as income when it's taken out.` },
      { label: ACTION, title: `Drawn over ${plan.years} years, your pension would pay about ${fmt(plan.yearly)} a year, with ${fmt(plan.phases[0].tax)} of income tax in the first year${plan.other + plan.phases[0].statePension > 0 ? " on all your income" : ""}.`,
        body: "Try other numbers of years on the pension screen. Pension Wise, from MoneyHelper, gives free guidance on taking a pension to anyone over 50." },
    ];
  }

  if (!isPensionContributing(d)) {
    const relief = missedPensionRelief(d, m);
    return [
      { label: ANSWER, figure: `${fmt(relief)} a year`, title: "of tax relief you're not getting, with no pension payments." },
      { label: WHY, title: `Every £${100 - trPct} you pay in becomes £100 in your pension, because of ${trPct}% tax relief.`,
        body: empPct > 0 ? `Your employer would also add up to ${empPct}% of your salary.` : undefined },
      { label: ACTION, title: `Paying in ${empPct > 0 ? empPct : 5}% of your salary would start it.`, body: HR },
    ];
  }

  if (m.missedMatch > 0) {
    const netCost = Math.round((empPct - myPct) / 100 * m.salary * (1 - m.tr));
    return [
      { label: ANSWER, figure: `${fmt(m.missedMatch)} a year`, title: "of your employer's money you're not getting." },
      { label: WHY, title: `Your employer matches up to ${empPct}% of your salary. You pay ${myPct}%.` },
      { label: ACTION, title: `Raising your payments to ${empPct}% would get the full match.`,
        body: `It would cost you about ${fmt(netCost)} a year after tax relief. ${HR}` },
    ];
  }

  // Getting the full match: the £100k tax trap is the next thing to check.
  const taper = calcPensionTaperSaving(m, calcAnnualAllowanceRoom(d, m).room);
  if (taper.recoverable && taper.taperTotalSaving > 0) {
    return [
      { label: ANSWER, figure: `${fmt(taper.taperTotalSaving)} a year`, title: "of tax you could save." },
      { label: WHY, title: "Between £100,000 and £125,140 you lose some of your tax-free allowance, so that slice is taxed at 60%." },
      { label: ACTION, title: `Paying ${fmt(taper.taperSacrificeNeeded)} more into your pension through salary sacrifice would bring your income back to £100,000.`, body: HR },
    ];
  }

  // On track: where it's heading, and the bonus if there's one to use.
  const bonus = calcBonusSacrificePotential(d, m);
  return [
    { label: ANSWER, figure: fmt(Math.round(m.projectedPot)), title: `projected in your pension by ${+d.retirementAge || 65}.` },
    { label: WHY, title: `You pay ${myPct}%${empPct > 0 ? ` and get your employer's full ${empPct}% match` : ""}, so you're not leaving money on the table.`,
      body: "In today's money: growth of 6% a year, less 2% inflation." },
    bonus.standalone > 0
      ? { label: ACTION, title: `Paying your ${fmt(+d.bonusAmount)} bonus into your pension could save up to ${fmt(bonus.standalone)} in tax.`, body: "It has to be arranged with HR or payroll before the bonus is paid." }
      : { label: ACTION, title: "Nothing to change right now.", body: "Worth checking again when your pay or job changes." },
  ];
}

const pct = n => `${Math.round(n * 100) / 100}%`;

// Cash: an emergency fund short of its target comes first (the screen says
// to sort it before anything else), then what better rates would earn.
export function cashReveal(d, m, { marketRates = {} } = {}) {
  if (m.emergencyShortfall > 0) {
    const months = m.monthlySurplus > 0 ? Math.ceil(m.emergencyShortfall / m.monthlySurplus) : null;
    return [
      { label: ANSWER, figure: fmt(m.emergencyShortfall), title: `short of your ${m.bufferMonths}-month emergency fund.` },
      { label: WHY, title: `You have ${fmt(m.totalLiquid)} in savings. ${m.bufferMonths} months of essential spending is ${fmt(m.emergencyBuffer)}.` },
      { label: ACTION, title: months
          ? `Putting aside your spare ${fmt(Math.round(m.monthlySurplus))} a month would close the gap in about ${months} month${months === 1 ? "" : "s"}.`
          : "Building this up comes before chasing better rates.",
        body: "An easy-access account keeps it reachable when you need it." },
    ];
  }
  // With the rates loaded: the same after-tax figure as the screen and
  // Candid Assist (cashOpportunity), and the best choice in each section.
  const opp = cashOpportunity(d, m, marketRates.rows);
  if (opp && opp.gain > 50) {
    const best = opp.lines.map(l => `${l.section === "Premium Bonds" ? "Premium Bonds" : `a ${l.section}`} at ${pct(l.option.ratePct)}`);
    return [
      { label: ANSWER, figure: `${fmt(opp.gain)} a year`, title: "more your savings could earn, after tax." },
      { label: WHY, title: `Your ${fmt(opp.cash)} in savings earns about ${fmt(opp.currentKept)} a year after tax. The best options today include ${best.length > 1 ? `${best.slice(0, -1).join(", ")} and ${best[best.length - 1]}` : best[0]}.` },
      { label: ACTION, title: "Candid Assist lays out the options in each and how to move, whichever you choose.",
        body: "Open it from the button at the bottom right of the screen." },
    ];
  }
  const opt = calcCashOptimisation(m, marketRates.isaRate ?? null, marketRates.nonIsaRate ?? null, marketRates.rows);
  if (!opp && opt.optimisationGain > 50) {
    return [
      { label: ANSWER, figure: `${fmt(opt.optimisationGain)} a year`, title: "more your savings could earn." },
      { label: WHY, title: `Your savings earn about ${pct(opt.todayBlendedRate * 100)} on average. The best rates today are ${opt.isaRateDisplay} in a Cash ISA and ${opt.nonIsaRateDisplay} in a savings account.` },
      { label: ACTION, title: opt.step1Isa > 0
          ? `Moving ${fmt(opt.step1Isa)} into a Cash ISA, and the rest to the best savings rate, would earn it.`
          : "Moving your savings to the best rate would earn it.",
        body: "The best accounts are listed on this screen. Most open online in minutes." },
    ];
  }
  return [
    { label: ANSWER, figure: `${(m.runwayMonths || 0).toFixed(1)} months`, title: "of essential spending your savings would cover." },
    { label: WHY, title: `That's at or above your ${m.bufferMonths}-month target, and your savings are already on good rates.` },
    { label: ACTION, title: "Nothing to change right now.", body: "Worth checking rates every few months: the best ones move." },
  ];
}

// Investments: tax-free gains first (they're lost on 5 April), then the ISA
// allowance.
export function investmentsReveal(d, m) {
  const isaLine = { label: WHY, title: "Anything inside an ISA grows free of tax, for good. Unused allowance is lost on 5 April." };
  if (m.crystallisable > 0) {
    const gains = +d.unrealisedGains || 0;
    return [
      { label: ANSWER, figure: fmt(Math.round(m.cgtSaving)), title: "of capital gains tax you could avoid this tax year." },
      { label: WHY, title: `Each tax year, the first ${fmt(CGT_ALLOWANCE)} of profit you take is tax-free. You have ${fmt(m.remainingCgtAllowance)} of it left, and about ${fmt(gains)} of profit outside an ISA or pension.` },
      { label: ACTION, title: `Taking ${fmt(m.crystallisable)} of that profit before 5 April would use this year's allowance.`,
        body: "Your platform or an adviser can tell you how for your holdings. Buying back inside an ISA keeps you invested." },
    ];
  }
  if (m.isaHeadroom > 0) {
    return [
      { label: ANSWER, figure: fmt(m.isaHeadroom), title: "of this year's ISA allowance unused." },
      isaLine,
      { label: ACTION, title: "Putting money you won't need for five years or more into a Stocks and Shares ISA would use it.",
        body: "Investments can fall as well as rise." },
    ];
  }
  return [
    { label: ANSWER, title: "Your ISA allowance is used, and there's no tax-free profit to take this year." },
    isaLine,
    { label: ACTION, title: "Nothing to change right now.", body: "A fresh allowance opens on 6 April." },
  ];
}

// Student loan: whether overpaying pays off, from the same scenario as the
// screen (calcStudentLoanScenario).
export function studentLoanReveal(d, m) {
  if (d.studentLoan === "none" || !(m.loanBal > 0)) return null;
  const sl = calcStudentLoanScenario(d, m);
  const nothing = { label: ACTION, title: "Nothing to change right now.", body: "Repayments come out of your pay automatically." };
  if (sl.belowThreshold) {
    return [
      { label: ANSWER, title: "Nothing comes off your pay yet." },
      { label: WHY, title: `You earn below the ${fmt(sl.threshold)} repayment threshold. Interest still adds about ${fmt(sl.annualInterest)} a year.` },
      { ...nothing, body: "Repayments start automatically once you earn over the threshold." },
    ];
  }
  if (sl.worthOverpaying) {
    return [
      { label: ANSWER, figure: `${fmt(sl.overpayAnnualBenefit)} a year`, title: "better off overpaying than saving the money." },
      { label: WHY, title: `Your loan charges ${sl.slRatePct}%, more than the best savings rate (${sl.cashRate}%) and your pension's assumed ${sl.pensionGrowthPct}% growth.` },
      { label: ACTION, title: m.surplusCash > 0
          ? `Overpaying with some of your ${fmt(m.surplusCash)} of spare cash would earn that.`
          : "Overpaying with any spare cash you build up would earn that.",
        body: "You can overpay on the Student Loans Company website." },
    ];
  }
  if (!sl.willClear) {
    return [
      { label: ANSWER, title: "You're not expected to clear this loan before it's written off." },
      { label: WHY, title: `Your repayments of about ${fmt(sl.annualRep)} a year don't clear the ${fmt(m.loanBal)} balance in time.` },
      { label: ACTION, title: "Overpaying would mostly shrink what's written off, not what you pay.", body: "That money could do more in savings or your pension." },
    ];
  }
  return [
    { label: ANSWER, figure: `${sl.clearYr} years`, title: "until your loan is paid off." },
    { label: WHY, title: sl.effectiveBenefit <= 0
        ? `Savings pay ${sl.cashRate}%, more than your loan's ${sl.slRatePct}%, so overpaying doesn't come out ahead.`
        : `Your pension's assumed ${sl.pensionGrowthPct}% growth beats your loan's ${sl.slRatePct}%, so overpaying doesn't come out ahead.` },
    nothing,
  ];
}

// The modules with a reveal, by key.
export const MODULE_REVEALS = { pension: pensionReveal, cash: cashReveal, investments: investmentsReveal, studentLoan: studentLoanReveal };
