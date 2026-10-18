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
import { isPensionContributing, calcAnnualAllowanceRoom, calcPensionTaperSaving, calcBonusSacrificePotential, missedPensionRelief, calcTaxFreeCash, LUMP_SUM_ALLOWANCE, inRetirement, pensionAccessAge, NON_EARNER_PENSION_NET, NON_EARNER_PENSION_RELIEF, PENSION_RELIEF_MAX_AGE } from "./pension.js";
import { bestDrawdown, defaultDrawdownYears } from "./drawdown.js";
import { retirementAgeFor, isaFillable } from "./metrics.js";
import { calcCashOptimisation } from "./cash.js";
import { cashOpportunity } from "./assist.js";
import { calcStudentLoanScenario } from "./studentLoan.js";
import { CGT_ALLOWANCE } from "./rentVsBuy.js";
import { STATE_PENSION_AGE } from "./tax.js";

const ANSWER = "Your position", WHY = "Why", ACTION = "What you could do";
const HR = "HR or payroll can change it, usually from the next month.";
// Self-employed, there's no payroll: payments go to a personal pension or SIPP.
const SELF_EMPLOYED_PENSION = "A personal pension or SIPP takes payments directly. The provider adds basic-rate relief, and any higher-rate relief is claimed through Self Assessment.";
const selfEmployed = d => d.employmentStatus === "self_employed";
const years = n => `${n} year${n === 1 ? "" : "s"}`;

// On course to fall short of a full State Pension (35 qualifying years) by
// State Pension age: the years they have, plus one a year still working
// (none while not earning). From 45, while there's time to fill gaps.
function niLine(d, m) {
  const age = +d.age || 0;
  if (age < 45 || m.pastStatePensionAge || !(m.niYearsToFull > 0) || !(+d.niYears > 0)) return null;
  const yearsAhead = m.noEarnings ? 0 : Math.max(0, STATE_PENSION_AGE - age);
  if (+d.niYears + yearsAhead >= 35) return null;
  return `You have ${years(+d.niYears)} of National Insurance; a full State Pension needs 35. Gaps from the last six tax years can usually be filled with voluntary contributions: your State Pension forecast on gov.uk shows which.`;
}
const withNi = (steps, d, m) => {
  const line = niLine(d, m);
  if (!line || !steps) return steps;
  const last = steps[steps.length - 1];
  return [...steps.slice(0, -1), { ...last, body: last.body ? `${last.body} ${line}` : line }];
};

export function pensionReveal(d, m) {
  return withNi(pensionSteps(d, m), d, m);
}
function pensionSteps(d, m) {
  if (m.pensionStatus === "unknown") {
    return [
      { label: ANSWER, title: "We need two numbers to check your pension." },
      { label: WHY, title: selfEmployed(d) ? "What you pay in decides how much tax relief you get." : "What you pay in, and how much your employer will match, decide whether you're missing free money." },
      { label: ACTION, title: selfEmployed(d) ? "Your pension provider's latest statement shows what you pay in." : "Ask HR or payroll what you pay in and what your employer matches.", body: "Then come back and update your answers here." },
    ];
  }

  const trPct = Math.round(m.tr * 100);
  const myPct = +d.myContribution || 0;
  const empPct = +d.employerMatch || 0;

  // Not paying in: the tax relief on 5% of salary, the figure the module's
  // status and the score use (computeModuleStatuses).
  // Not paying in, with no earnings to pay in from (retired, say): what
  // matters is what can come out tax-free, not relief there's none of.
  // No earnings and not retired (between jobs, a career break, studying, or
  // retired before the pension can be taken): the pension is for later.
  if (!isPensionContributing(d) && m.noEarnings && !inRetirement(d)) return pensionForLater(d, m);

  if (!isPensionContributing(d) && missedPensionRelief(d, m) === 0) {
    const cash = calcTaxFreeCash(d);
    if (!(cash.pot > 0)) return null;
    // The answer is the drawdown strategy: drawn to 87, the tax-free cash
    // taken whichever way leaves more after tax (drawdown.js bestDrawdown).
    const years = defaultDrawdownYears(d);
    const best = bestDrawdown(d, m, years);
    const plan = best.plan;
    const how = t => t === "phased" ? "a quarter of each withdrawal tax-free" : "all the tax-free cash at the start";
    const protectionUnknown = !d.pensionProtection;
    const cashLine = cash.capped
      ? `${fmt(cash.taxFree)} can ${cash.taken > 0 ? "still " : ""}be taken tax-free: ${cash.taken > 0 ? `what's left of your ${fmt(cash.allowance)} limit` : cash.allowance === LUMP_SUM_ALLOWANCE ? "25% stops at the Lump Sum Allowance" : "your protected limit"}.${protectionUnknown && cash.allowance === LUMP_SUM_ALLOWANCE ? " A Fixed or Individual Protection from 2012 to 2016 allows more." : ""}`
      : `${fmt(cash.taxFree)} can ${cash.taken > 0 ? "still " : ""}be taken tax-free, 25% of your pension.`;
    return [
      { label: ANSWER, figure: `${fmt(plan.firstYear.afterTax)} a year`, title: `after tax from your pension, drawn over ${years} years, to ${plan.toAge}, with ${how(plan.taxFree)}${plan.upfront > 0 ? ` (${fmt(plan.upfront)})` : ""}.` },
      { label: WHY, title: best.saving > 0
          ? `That leaves ${fmt(best.saving)} more after tax than taking ${how(best.other.taxFree)}. ${Math.round(plan.effectiveRate * 100)}% of what comes out goes in tax, ${fmt(plan.totalTax)} over the ${years} years.`
          : `Either way of taking the tax-free cash leaves the same after tax. ${Math.round(plan.effectiveRate * 100)}% of what comes out goes in tax, ${fmt(plan.totalTax)} over the ${years} years.`,
        body: cashLine },
      { label: ACTION, title: "Try other numbers of years on the pension screen: fewer pays more each year, and more of it goes in tax.",
        body: "Pension Wise, from MoneyHelper, gives free guidance on taking a pension to anyone over 50." },
    ];
  }

  if (!isPensionContributing(d)) {
    const relief = missedPensionRelief(d, m);
    return [
      { label: ANSWER, figure: `${fmt(relief)} a year`, title: "of tax relief you're not getting, with no pension payments." },
      { label: WHY, title: `Every £${100 - trPct} you pay in becomes £100 in your pension, because of ${trPct}% tax relief.`,
        body: empPct > 0 ? `Your employer would also add up to ${empPct}% of your salary.` : undefined },
      selfEmployed(d)
        ? { label: ACTION, title: "Paying in 5% of your earnings would start it.", body: SELF_EMPLOYED_PENSION }
        : (+d.dividendIncome || 0) > (m.salary || 0)
          ? { label: ACTION, title: `Paid in personally, relief is on up to your salary, ${fmt(m.salary)} a year.`, body: "If you run your own company, it can pay in for you instead, usually set against corporation tax rather than your income tax. An accountant can say what suits your company." }
          : { label: ACTION, title: `Paying in ${empPct > 0 ? empPct : 5}% of your salary would start it.`, body: HR },
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

  // Paying in more than the annual allowance (reduced for very high
  // earners, or £10,000 once an income has been drawn): the excess is taxed.
  const aa = calcAnnualAllowanceRoom(d, m);
  if (aa.excess > 0) {
    const charge = Math.round(aa.excess * (m.tr || 0));
    return [
      { label: ANSWER, figure: `${fmt(aa.excess)} a year`, title: `paid into your pension above your ${fmt(aa.approxAA)} annual allowance.` },
      { label: WHY, title: aa.mpaa
          ? `Having taken an income from a pension, ${fmt(aa.approxAA)} a year can go in with tax relief. Payments over it are taxed at your top rate: about ${fmt(charge)} a year here.`
          : `Above £260,000 of income, the £60,000 annual allowance shrinks, to £10,000 at the lowest. Payments over it are taxed at your top rate: about ${fmt(charge)} a year here.`,
        body: `You and your employer pay in about ${fmt(aa.currentInputs)} a year.` },
      { label: ACTION, title: aa.mpaa ? "Lowering payments to the allowance would avoid the charge." : "Allowance unused in the last three tax years can usually be carried forward to cover it.",
        body: "Your pension provider, or an adviser, can confirm your exact allowance." },
    ];
  }

  // Getting the full match: the £100k tax trap is the next thing to check.
  const taper = calcPensionTaperSaving(m, aa.room);
  if (taper.recoverable && taper.taperTotalSaving > 0) {
    return [
      { label: ANSWER, figure: `${fmt(taper.taperTotalSaving)} a year`, title: "of tax you could save." },
      { label: WHY, title: "Between £100,000 and £125,140 you lose some of your tax-free allowance, so that slice is taxed at 60%." },
      selfEmployed(d)
        ? { label: ACTION, title: `Paying ${fmt(taper.taperSacrificeNeeded)} more into a pension (including the tax relief added) would bring your income back to £100,000.`, body: `The money usually can't be taken out until you're 55 (57 from 2028). ${SELF_EMPLOYED_PENSION}` }
        : { label: ACTION, title: `Paying ${fmt(taper.taperSacrificeNeeded)} more into your pension through salary sacrifice would bring your income back to £100,000.`, body: `It lowers your take-home pay, and the money usually can't be taken out until you're 55 (57 from 2028). ${HR}` },
    ];
  }

  // On track: where it's heading, and the bonus if there's one to use.
  const bonus = calcBonusSacrificePotential(d, m);
  return [
    { label: ANSWER, figure: fmt(Math.round(m.projectedPot)), title: `projected in your pension by ${retirementAgeFor(d)}.` },
    { label: WHY, title: `You pay ${myPct}%${empPct > 0 && !selfEmployed(d) ? (d.employerContributionType === "fixed" ? ` and your employer pays ${empPct}%` : ` and get your employer's full ${empPct}% match`) : ""}, so you're not leaving money on the table.`,
      body: "In today's money: growth of 6% a year, less 2% inflation." },
    bonus.standalone > 0
      ? { label: ACTION, title: `Paying your ${fmt(+d.bonusAmount)} bonus into your pension could save up to ${fmt(bonus.standalone)} in tax.`, body: "It has to be arranged with HR or payroll before the bonus is paid." }
      : { label: ACTION, title: "Nothing stands out right now.", body: "Worth checking again when your pay or job changes." },
  ];
}

// No earnings, and not retired: the pot keeps its investments, and up to
// £2,880 a year can still go in with £720 of relief added.
function pensionForLater(d, m) {
  const pot = calcTaxFreeCash(d).pot;
  const from = pensionAccessAge(d);
  const canPayIn = (+d.age || 0) < PENSION_RELIEF_MAX_AGE;
  if (!(pot > 0) && !canPayIn) return null;
  const potLine = pot > 0 ? `Your ${fmt(pot)} pension stays invested while nothing goes in, so it can still grow. It can be taken from ${from}.` : `A pension can be taken from ${from}.`;
  if (!canPayIn) return [
    { label: ANSWER, figure: fmt(pot), title: "in your pension, still invested." },
    { label: WHY, title: potLine },
    { label: ACTION, title: "Nothing stands out right now.", body: "Worth checking again if you start working or retire." },
  ];
  return [
    { label: ANSWER, figure: `${fmt(NON_EARNER_PENSION_RELIEF)} a year`, title: "of tax relief you can still get, with no earnings." },
    { label: WHY, title: `Anyone under 75 can pay up to ${fmt(NON_EARNER_PENSION_NET)} a year into a personal pension and have ${fmt(NON_EARNER_PENSION_RELIEF)} added, earnings or not.`, body: potLine },
    { label: ACTION, title: `Paying ${fmt(NON_EARNER_PENSION_NET)} into a personal pension or SIPP would get the ${fmt(NON_EARNER_PENSION_RELIEF)}.`,
      body: `A workplace pension usually stops taking payments when the job ends. Money paid in can't be taken out until ${from}.` },
  ];
}

const pct = n => `${Math.round(n * 100) / 100}%`;

// Cash: an emergency fund short of its target comes first (the screen says
// to sort it before anything else), then what better rates would earn.
// Someone not working lives off their savings, so how long they'd last comes
// first; someone earning but spending more than they take home sees the gap.
export const FSCS_LIMIT = 120000;
function fscsLine(m) {
  const over = Math.round((m.largestCashHolding || 0) - FSCS_LIMIT);
  return over > 0 ? `The FSCS protects ${fmt(FSCS_LIMIT)} per person at each banking licence; ${fmt(over)} of yours is above that at one bank.` : null;
}
const join = (...parts) => parts.filter(Boolean).join(" ") || undefined;
// A step's body only when there's one, so an empty one isn't carried.
const withBody = (step, body) => body ? { ...step, body } : step;

export function cashReveal(d, m, ctx = {}) {
  const steps = cashSteps(d, m, ctx);
  const fscs = fscsLine(m);
  if (!fscs) return steps;
  return steps.map(s => s.label === WHY ? withBody(s, join(s.body, fscs)) : s);
}

function cashSteps(d, m, { marketRates = {} } = {}) {
  const opp = cashOpportunity(d, m, marketRates.rows);
  const rateLine = opp && opp.gain > 50 ? `Higher rates today could add about ${fmt(opp.gain)} a year after tax.` : null;
  // Retired, a pension pays the way, so this is for someone between jobs.
  if (m.noEarnings && !inRetirement(d) && m.expenses > 0 && m.totalLiquid > 0 && m.monthlyShortfall > 0) {
    const months = m.totalLiquid / m.monthlyShortfall;
    return [
      { label: ANSWER, figure: months >= 120 ? "10 years or more" : `${months < 10 ? months.toFixed(1) : Math.round(months)} months`, title: m.monthlyTakeHome > 0 ? "your savings would cover, at what you spend beyond your income." : "your savings would cover, with no earnings coming in." },
      withBody({ label: WHY, title: `You have ${fmt(m.totalLiquid)} in savings, and about ${fmt(Math.round(m.monthlyShortfall))} a month more going out than coming in.` }, rateLine),
      opp && opp.gain > 50
        ? { label: ACTION, title: "Candid Assist lays out the options in each and how to move, whichever you choose.", body: "Open it from the button at the bottom right of the screen." }
        : { label: ACTION, title: "Nothing stands out right now.", body: "Worth checking rates every few months: the top ones move." },
    ];
  }
  if (!m.noEarnings && m.monthlyShortfall > 0) {
    const months = m.totalLiquid > 0 ? m.totalLiquid / m.monthlyShortfall : 0;
    return [
      { label: ANSWER, figure: `${fmt(Math.round(m.monthlyShortfall))} a month`, title: "more going out than comes in, after tax." },
      { label: WHY, title: `Your take-home pay is about ${fmt(Math.round(m.monthlyTakeHome))} a month, and your essential spending ${fmt(m.expenses)}.` },
      { label: ACTION, title: months >= 120 ? "At that rate your savings would cover the gap for 10 years or more." : months > 0 ? `At that rate your savings would cover the gap for about ${months < 10 ? months.toFixed(1) : Math.round(months)} months.` : "There are no savings to cover the gap.",
        body: "The spending figure is for essentials only: rent or mortgage, bills, food and getting around. Worth checking it's right." },
    ];
  }
  if (m.expensesUnknown && !(opp && opp.gain > 50)) {
    return [
      { label: ANSWER, title: "We need your monthly spending to size your emergency fund." },
      { label: WHY, title: "It's what your savings are measured against: months of essential spending." },
      { label: ACTION, title: "Add it in Edit inputs.", body: "Rent or mortgage, bills, food and getting around." },
    ];
  }
  if (m.emergencyShortfall > 0) {
    const months = m.monthlySurplus > 0 ? Math.ceil(m.emergencyShortfall / m.monthlySurplus) : null;
    return [
      { label: ANSWER, figure: fmt(m.emergencyShortfall), title: `short of your ${m.bufferMonths}-month emergency fund.` },
      { label: WHY, title: `You have ${fmt(m.totalLiquid)} in savings. ${m.bufferMonths} months of essential spending is ${fmt(m.emergencyBuffer)}.` },
      { label: ACTION, title: months
          ? `Putting aside your spare ${fmt(Math.round(m.monthlySurplus))} a month would close the gap in about ${months} month${months === 1 ? "" : "s"}.`
          : "There's nothing spare each month after essentials, so the gap stays as it is for now.",
        body: "An easy-access account keeps it reachable when you need it." },
    ];
  }
  // With the rates loaded: the same after-tax figure as the screen and
  // Candid Assist (cashOpportunity), and the best choice in each section.
  if (opp && opp.gain > 50) {
    const best = opp.lines.map(l => `${l.section === "Premium Bonds" ? "Premium Bonds" : `a ${l.section}`} at ${pct(l.option.ratePct)}`);
    return [
      { label: ANSWER, figure: `${fmt(opp.gain)} a year`, title: "more your savings could earn, after tax." },
      withBody({ label: WHY, title: `Your ${fmt(opp.cash)} in savings earns about ${fmt(opp.currentKept)} a year after tax. The highest-rate options today include ${best.length > 1 ? `${best.slice(0, -1).join(", ")} and ${best[best.length - 1]}` : best[0]}.` },
        m.expensesUnknown ? "Add your monthly spending in Edit inputs to see how much to keep as an emergency fund." : null),
      { label: ACTION, title: "Candid Assist lays out the options in each and how to move, whichever you choose.",
        body: "Open it from the button at the bottom right of the screen." },
    ];
  }
  const opt = calcCashOptimisation(m, marketRates.isaRate ?? null, marketRates.nonIsaRate ?? null, marketRates.rows);
  if (!opp && opt.optimisationGain > 50) {
    return [
      { label: ANSWER, figure: `${fmt(opt.optimisationGain)} a year`, title: "more your savings could earn." },
      { label: WHY, title: `Your savings earn about ${pct(opt.todayBlendedRate * 100)} on average. The highest rates today are ${opt.isaRateDisplay} in a Cash ISA and ${opt.nonIsaRateDisplay} in a savings account.` },
      { label: ACTION, title: opt.step1Isa > 0
          ? `Moving ${fmt(opt.step1Isa)} into a Cash ISA, and the rest to the highest savings rate, would earn it.`
          : "Moving your savings to the highest rate would earn it.",
        body: "The highest-rate accounts are listed on this screen. Most open online in minutes." },
    ];
  }
  return [
    { label: ANSWER, figure: `${(m.runwayMonths || 0).toFixed(1)} months`, title: "of essential spending your savings would cover." },
    { label: WHY, title: `That's at or above your ${m.bufferMonths}-month target, and your savings are already on good rates.` },
    { label: ACTION, title: "Nothing stands out right now.", body: "Worth checking rates every few months: the top ones move." },
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
        body: "Your platform or an adviser can tell you how for your holdings. Some people buy back inside an ISA ('Bed and ISA') to stay invested; prices can move in between." },
    ];
  }
  if (m.isaHeadroom > 0 && isaFillable(d, m) <= 2000) {
    return [
      { label: ANSWER, figure: fmt(m.isaHeadroom), title: "of ISA allowance this tax year, for when there's money to put in." },
      isaLine,
      { label: ACTION, title: "Nothing to change right now.", body: "A fresh allowance opens each 6 April." },
    ];
  }
  if (m.isaHeadroom > 0) {
    return [
      { label: ANSWER, figure: fmt(m.isaHeadroom), title: "of this year's ISA allowance unused." },
      isaLine,
      { label: ACTION, title: "A Stocks and Shares ISA, for money you won't need for five years or more, or a Cash ISA would use it.",
        body: "Over long periods shares have tended to grow faster than cash, which is why many people invest for the long term, but they can fall in value, sometimes for years. Money in a Cash ISA can't fall." },
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
  // While the balance is still growing, when it starts to fall (the year
  // repayments overtake the interest), under the answer.
  const turning = sl.balanceGrowing && !sl.balanceFallingNow
    ? { body: sl.turningTaxYear
        ? `Your balance is still growing. It starts falling from April ${sl.turningTaxYear}, when repayments overtake the interest.`
        : "Your balance is still growing, and on these figures repayments never overtake the interest." }
    : {};
  if (sl.belowThreshold) {
    return [
      m.noEarnings
        ? { label: ANSWER, title: "Nothing is repaid while you're not earning." }
        : { label: ANSWER, title: "Nothing comes off your pay yet." },
      { label: WHY, title: m.noEarnings
          ? `Repayments only come from earnings over ${fmt(sl.threshold)}. Interest still adds about ${fmt(sl.annualInterest)} a year.`
          : `You earn below the ${fmt(sl.threshold)} repayment threshold. Interest still adds about ${fmt(sl.annualInterest)} a year.` },
      { ...nothing, body: "Repayments start automatically once you earn over the threshold." },
    ];
  }
  if (sl.worthOverpaying) {
    return [
      { label: ANSWER, figure: `${fmt(sl.overpayAnnualBenefit)} a year`, title: "better off overpaying than saving the money.", ...turning },
      withBody({ label: WHY, title: `Your loan charges ${sl.slRatePct}% now, about ${sl.lifeRatePct}% a year over its life: more than the best savings rate (${sl.cashRate}%) and your pension's assumed ${sl.pensionGrowthPct}% growth.` },
        m.missedMatch > 0 ? `Separately, your employer would add ${fmt(m.missedMatch)} a year to your pension if you paid in up to its match (see Pension).` : null),
      { label: ACTION, title: m.surplusCash > 0
          ? `Overpaying with some of your ${fmt(m.surplusCash)} of spare cash would earn that.`
          : "Overpaying with any spare cash you build up would earn that.",
        body: "You can overpay on the Student Loans Company website." },
    ];
  }
  if (!sl.willClear) {
    return [
      { label: ANSWER, title: "You're not expected to clear this loan before it's written off.", ...turning },
      { label: WHY, title: `Your repayments of about ${fmt(sl.annualRep)} a year don't clear the ${fmt(m.loanBal)} balance in time.` },
      { label: ACTION, title: "Overpaying would mostly shrink what's written off, not what you pay.", body: "On these assumptions, savings or a pension may earn more than overpaying." },
    ];
  }
  return [
    { label: ANSWER, figure: years(sl.clearYr), title: "until your loan is paid off.", ...turning },
    { label: WHY, title: sl.effectiveBenefit <= 0
        ? `Savings pay ${sl.cashRate}%, ${sl.effectiveBenefit < 0 ? "more than" : "the same as"} your loan's ${sl.lifeRatePct}% a year on average over its life, so overpaying doesn't come out ahead.`
        : `Your pension's assumed ${sl.pensionGrowthPct}% growth beats your loan's ${sl.lifeRatePct}% a year on average over its life, so overpaying doesn't come out ahead.` },
    nothing,
  ];
}

// The modules with a reveal, by key.
export const MODULE_REVEALS = { pension: pensionReveal, cash: cashReveal, investments: investmentsReveal, studentLoan: studentLoanReveal };
