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
import { isPensionContributing, calcAnnualAllowanceRoom, calcBonusSacrificePotential, missedPensionRelief, calcTaxFreeCash, LUMP_SUM_ALLOWANCE, inRetirement, pensionAccessAge, NON_EARNER_PENSION_NET, NON_EARNER_PENSION_RELIEF, PENSION_RELIEF_MAX_AGE, finalSalaryScheme } from "./pension.js";
import { bestDrawdown, defaultDrawdownYears } from "./drawdown.js";
import { retirementAgeFor, isaFillable, calcMetrics } from "./metrics.js";
import { estimatePensionPot, childBenefitCharge, HICBC_START } from "./pension.js";
import { retirementAdequacy } from "./crossModule.js";
import { childcareSupport, kidsSituation } from "./childcare.js";
import { taxTrap, trapInView, lostTo } from "./taxTrap.js";
import { loanVerdictReady } from "./appEntry.js";
import { calcCashOptimisation } from "./cash.js";
import { cashOpportunity } from "./assist.js";
import { calcStudentLoanScenario, pgScenario, bestLumpSum, SL_REPAYMENT_RATES, pensionCaveat, resolveSlRate } from "./studentLoan.js";
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
  // Not sure, employed with a salary: worked out on the legal minimum
  // (5% from them, 3% from the employer) and an estimated pot, rather than
  // nothing.
  if (m.pensionStatus === "unknown" && d.employmentStatus === "employed" && m.salary > 0 && +d.age > 0) {
    const pot = +d.potValue > 0 ? +d.potValue : estimatePensionPot(d);
    // The minimum is on qualifying earnings, £6,240 to £50,270, not the
    // whole salary: as a share of salary, so the usual sums apply.
    const qualifying = Math.max(0, Math.min(m.salary, 50270) - 6240);
    const share = pctOfQualifying => String(Math.round(pctOfQualifying * qualifying / m.salary * 100) / 100);
    const assumed = calcMetrics({ ...d, pensionUnknown: false, hasPension: "yes", pensionKind: "dc", myContribution: share(5), employerMatch: share(3), employerContributionType: "fixed", potValue: String(pot) });
    return [
      { label: ANSWER, figure: fmt(Math.round(assumed.projectedPot)), title: `projected in your pension by ${retirementAgeFor(d)}, if you pay the legal minimum.` },
      { label: WHY, title: "The legal minimum is 5% from you and 3% from your employer, on pay between £6,240 and £50,270. Many employers add more.",
        body: +d.potValue > 0 ? "In today's money: growth of 6% a year, less 2% inflation." : `Your pot today is our estimate from your age and salary, about ${fmt(pot)}.` },
      { label: ACTION, title: "Your payslip shows what you pay in; HR or payroll can say what your employer adds.", body: "With the real figures, Candid can check you're getting all of your employer's money." },
    ];
  }
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
  // A final salary or career average scheme: no pot to project. (The £100k
  // trap is its own module: taxTrapReveal.)
  if (finalSalaryScheme(d) && !inRetirement(d)) return finalSalarySteps(d, m);

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
      { label: ANSWER, figure: `${fmt(m.missedMatch)} a year`, title: "of employer match left on the table." },
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

  // (The £100k tax trap is its own module now: taxTrapReveal.)

  // Short of what they'd like to live on in retirement.
  const adequacy = retirementAdequacy(d, m);
  if (adequacy && adequacy.gap > adequacy.target * 0.05) {
    return [
      { label: ANSWER, figure: `${fmt(adequacy.gap)} a year`, title: `short of the ${fmt(adequacy.target)} a year you'd like in retirement.` },
      { label: WHY, title: `On your figures you'd have about ${fmt(adequacy.net)} a year after tax, from your pension and a full State Pension, in today's money.` },
      { label: ACTION, title: adequacy.extraPct ? `Paying in about ${adequacy.extraPct}% more of your salary would close it.` : "Paying in more, or retiring later, would close some of it.",
        body: "Each extra payment gets tax relief too. The Retirement age and contribution steppers on this screen show the effect." },
    ];
  }

  // On track: where it's heading, and the bonus if there's one to use.
  const bonus = calcBonusSacrificePotential(d, m);
  return [
    { label: ANSWER, figure: fmt(Math.round(m.projectedPot)), title: `projected in your pension by ${retirementAgeFor(d)}.` },
    { label: WHY, title: `You pay ${myPct}%${empPct > 0 && !selfEmployed(d) ? (d.employerContributionType === "fixed" ? ` and your employer pays ${empPct}%` : ` and get your employer's full ${empPct}% match`) : ""}, so you're not leaving money on the table.`,
      body: "In today's money: growth of 6% a year, less 2% inflation." },
    bonus.standalone > 0
      ? { label: ACTION, title: `Up to ${fmt(bonus.standalone)} of tax on your ${fmt(+d.bonusAmount)} bonus is avoidable, if it's paid into your pension.`, body: "It has to be arranged with HR or payroll before the bonus is paid." }
      : { label: ACTION, title: "Nothing to change right now.", body: checkedLine(d, m, adequacy) },
  ];
}

// What was checked and found fine, so "nothing to change" reassures rather
// than dismisses.
function checkedLine(d, m, adequacy) {
  const ok = [];
  const empPct = +d.employerMatch || 0;
  if (empPct > 0 && !selfEmployed(d)) ok.push(d.employerContributionType === "fixed" ? `your employer's ${empPct}% goes in` : "you get your employer's full match");
  if ((m.adjustedNetIncome || 0) < 100000) ok.push("you're under the £100,000 tax trap");
  if (adequacy && adequacy.gap === 0) ok.push(`you're on course for about ${fmt(adequacy.net)} a year, above your ${fmt(adequacy.target)}`);
  const outlook = calcTaxFreeCash(d);
  if (!outlook.capped) ok.push("your pot isn't near the limit on tax-free cash");
  return ok.length ? `Checked: ${ok.length > 1 ? ok.slice(0, -1).join(", ") + " and " + ok[ok.length - 1] : ok[0]}. Worth checking again when your pay or job changes.` : "Worth checking again when your pay or job changes.";
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

// A final salary or career average member: what Candid can and can't say.
function finalSalarySteps(d, m) {
  const income = +d.dbPensionIncome || 0;
  const trPct = Math.round((m.tr || 0) * 100);
  return [
    income > 0
      ? { label: ANSWER, figure: `${fmt(income)} a year`, title: `from your scheme when you retire, as your statement shows it.` }
      : { label: ANSWER, title: "Your scheme pays a set income, worked out from your pay and years in it." },
    { label: WHY, title: "There's no pot to grow or invest, so Candid doesn't project it like one.",
      body: income > 0 ? "Statements usually show it in today's money, before tax." : "Your scheme's latest annual statement shows what you've built up so far." },
    withBody({ label: ACTION, title: `Additional Voluntary Contributions, or buying added pension, add to it with tax relief at ${trPct}%.`, body: "Your scheme's website says what it offers." },
      (() => { const a = retirementAdequacy(d, m); return a ? (a.gap > 0 ? `With a full State Pension that's about ${fmt(a.net)} a year after tax, ${fmt(a.gap)} short of the ${fmt(a.target)} you'd like.` : `With a full State Pension that's about ${fmt(a.net)} a year after tax, above the ${fmt(a.target)} you'd like.`) : null; })()),
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
  const rateLine = opp && opp.gain > 50 ? `Against today's top rates, your savings lose about ${fmt(opp.gain)} a year after tax.` : null;
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
      { label: ANSWER, figure: `${fmt(opp.gain)} a year`, title: "lost each year to below-top savings rates, after tax." },
      withBody({ label: WHY, title: `Your ${fmt(opp.cash)} in savings earns about ${fmt(opp.currentKept)} a year after tax. The highest-rate options today include ${best.length > 1 ? `${best.slice(0, -1).join(", ")} and ${best[best.length - 1]}` : best[0]}.` },
        m.expensesUnknown ? "Add your monthly spending in Edit inputs to see how much to keep as an emergency fund." : null),
      { label: ACTION, title: "Candid Assist lays out the options in each and how to move, whichever you choose.",
        body: "Open it from the button at the bottom right of the screen." },
    ];
  }
  const opt = calcCashOptimisation(m, marketRates.isaRate ?? null, marketRates.nonIsaRate ?? null, marketRates.rows);
  if (!opp && opt.optimisationGain > 50) {
    return [
      { label: ANSWER, figure: `${fmt(opt.optimisationGain)} a year`, title: "lost each year to below-top savings rates." },
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
      { label: ANSWER, figure: fmt(Math.round(m.cgtSaving)), title: "of avoidable capital gains tax: this year's tax-free allowance ends 5 April." },
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
  const steps = studentLoanSteps(d, m);
  // A Postgraduate loan alongside: what it adds, under the why.
  const pg = pgScenario(d, m);
  if (!pg) return steps;
  const pgLine = `Your Postgraduate loan is repaid at the same time: about ${fmt(pg.annualRep)} a year now (6% of pay over £21,000), ${pg.belowThreshold ? "once you earn over £21,000" : pg.willClear ? `paid off in ${years(pg.clearYr)}` : `with about ${fmt(pg.writeOffBal)} written off in April ${pg.writeOffTaxYear}`}.`;
  return steps.map(s => s.label === WHY ? withBody(s, join(s.body, pgLine)) : s);
}
// `rows` lay a step out as large figures, each with a line above and a note
// below (MobileModuleReveal's large layout); `tone` "repay" or "cost"
// colours the figure. The title and body stay, for the usual layout.
function studentLoanSteps(d, m) {
  const sl = calcStudentLoanScenario(d, m);
  const ratePct = Math.round(resolveSlRate(d, m.salary || 0) * 1000) / 10;
  // The overpaying verdict needs their savings and pension match (appEntry.js).
  const verdict = loanVerdictReady(d);
  const repayPct = `${Math.round((SL_REPAYMENT_RATES[d.studentLoan] ?? 0.09) * 100)}%`;
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
  if (sl.worthOverpaying && verdict) {
    return [
      { label: ANSWER, figure: fmt(sl.overpayTotalBenefit), title: `lost to interest by letting it run ${years(sl.clearYr)}, against paying it off now.`, ...turning },
      withBody({ label: WHY, title: `Paying it off avoids about ${fmt(sl.interestAvoided)} of interest. In savings at ${sl.cashRate}%, the same money would earn about ${fmt(sl.savingsForgone)} meanwhile.` },
        join(m.missedMatch > 0 ? `Separately, your employer would add ${fmt(m.missedMatch)} a year to your pension if you paid in up to its match (see Pension).` : null, pensionCaveat(sl))),
      { label: ACTION, title: `It would use ${fmt(Math.round(m.loanBal))} of cash. The page shows how your buffer, ISA allowance and pension match stand.`,
        body: "You can overpay on the Student Loans Company website, all of it or part." },
    ];
  }
  // Written off: what they'd repay in all, and what's left to write off;
  // and a lump sum from their spare cash, if one clears it and comes out
  // ahead counting savings interest (studentLoan.js bestLumpSum).
  const lump = verdict && !sl.willClear ? bestLumpSum(m, sl, m.surplusCash || 0) : null;
  // Until their savings and pension match are in: what would tell them
  // whether paying it off early is worth it.
  const needVerdict = { label: ACTION, title: "Exactly what paying it off early could save needs the full module.", body: "It weighs your savings and pension match too. Adding them on the page shows it." };
  // Why, in two figures: what comes off pay, and what interest adds.
  const whyRows = [
    { lead: "Your repayments", figure: fmt(sl.annualRep), tone: "repay", size: "xl", note: `a year: ${repayPct} of your salary over the ${fmt(sl.threshold)} threshold` },
    { lead: "Interest adds", figure: fmt(sl.annualInterest), tone: "cost", size: "l", note: `a year, at ${ratePct}%` },
  ];
  if (!sl.willClear) {
    return [
      { label: ANSWER, figure: fmt(sl.totalRepaidProjected), title: `you're expected to repay in all, before about ${fmt(sl.writeOffBal)} is written off in April ${sl.writeOffTaxYear}.`, ...turning,
        rows: [{ lead: "You're expected to repay", figure: fmt(sl.totalRepaidProjected), size: "xl", note: `Then about ${fmt(sl.writeOffBal)} is written off in April ${sl.writeOffTaxYear}.` }] },
      { label: WHY, title: `Repayments are ${repayPct} of your pay over ${fmt(sl.threshold)}, about ${fmt(sl.annualRep)} a year now, while interest adds about ${fmt(sl.annualInterest)}.`, rows: whyRows },
      lump
        ? { label: ACTION, title: `Paying ${fmt(lump.amount)} now would clear it in ${years(lump.clearYr)}, and cost about ${fmt(lump.saving)} less in all, counting what the money would earn in savings.`,
            body: "Smaller sums would mostly shrink what's written off. The page shows how your cash buffer, ISA allowance and pension match stand." }
        : verdict ? { label: ACTION, title: "Overpaying would mostly go on debt that's written off anyway.", body: "On these assumptions, savings or a pension may earn more than overpaying." }
        : { label: ACTION, title: "Overpaying would mostly go on debt that's written off anyway.", body: "Exactly what paying it off early could save needs the full module: your savings and pension match too." },
    ];
  }
  // Clears by itself: what it'll cost in all, against what's owed today.
  const interest = Math.max(0, sl.totalRepaidProjected - Math.round(m.loanBal));
  return [
    { label: ANSWER, figure: fmt(sl.totalRepaidProjected), title: `you're expected to repay in all, clearing it in ${years(sl.clearYr)}.`,
      body: join(`That's ${fmt(interest)} of interest on top of the ${fmt(Math.round(m.loanBal))} you owe today.`, turning.body),
      rows: [{ lead: "You're expected to pay", figure: fmt(sl.totalRepaidProjected), size: "xl", note: `You'll likely clear it in ${years(sl.clearYr)}, repaying it all.` }] },
    verdict
      ? { label: WHY, title: `Savings pay ${sl.cashRate}%, ${sl.effectiveBenefit < 0 ? "more than" : "the same as"} your loan's ${sl.lifeRatePct}% a year on average over its life, so overpaying doesn't come out ahead.` }
      : { label: WHY, title: `Repayments are ${repayPct} of your pay over ${fmt(sl.threshold)}, about ${fmt(sl.annualRep)} a year now, while interest adds about ${fmt(sl.annualInterest)}.`, rows: whyRows },
    verdict ? nothing : needVerdict,
  ];
}

// Kids & family: childcare support first (the largest figure, and lost all at
// once over £100,000), then Tax-Free Childcare not claimed, then Child
// Benefit paid back. The same figures as the module's status and page.
const NATION_HOURS_NOTE = {
  wales: "Wales's Childcare Offer for 3 and 4 year olds is tested on gross income, which a pension payment doesn't change, so it isn't counted here.",
  scotland: "Scotland's 1,140 funded hours have no income limit, so they aren't affected.",
};
export function kidsReveal(d, m) {
  if (kidsSituation(d) === "no") return null;
  const cc = childcareSupport(d, m);
  const cb = childBenefitCharge(d, m);
  const aa = calcAnnualAllowanceRoom(d, m);
  if (!cc && !cb) return null;
  const support = cc?.hours > 0 ? "Tax-Free Childcare and the 30 funded hours" : "Tax-Free Childcare";
  const nationNote = cc?.preschool > 0 ? NATION_HOURS_NOTE[cc.nation] || null : null;
  const cbLine = cb && cb.charge > 0 ? `You also pay back ${fmt(cb.charge)} of Child Benefit a year.` : null;
  const asPay = cc?.payValue > 0 ? `It's worth the same as about ${fmt(cc.payValue)} of pay before tax.` : null;
  const partner = cc?.state === "partner";
  // A pension payment, theirs or their partner's (or both), brings every
  // income back to £100,000: the support opens up.
  if (cc?.recoverable && cc.atStake > 0) {
    return [
      { label: ANSWER, figure: `${fmt(cc.atStake)} a year`,
        title: cc.planning ? "of childcare support you could get once your child arrives." : partner ? "of childcare support you and your partner could get." : "of childcare support stops while your income is over £100,000." },
      withBody({ label: WHY, title: `${support} stop for the whole year once either parent's income is over £100,000. ${partner ? "Your partner's is." : `Yours is ${fmt(Math.round(cc.ani))}.`}` }, join(asPay, nationNote, cbLine)),
      partner
        ? { label: ACTION, title: `A pension payment of ${fmt(cc.partnerPayIn)} from your partner (including the tax relief added) would bring their income to £100,000${cc.payInNeeded > 0 ? `, and ${fmt(cc.payInNeeded)} from you would do the same for yours` : ""}.`,
            body: "It saves tax at their top rate as well." }
        : cc.planning
          ? { label: ACTION, title: `A pension payment of ${fmt(cc.payInNeeded)} (including the tax relief added) would bring your income to £100,000 and keep it open to you.`,
              body: "The £100k tax trap shows the other ways under it, and what each costs." }
          : { label: ACTION, title: "The £100k tax trap shows the ways back under £100,000, and what each costs in take-home pay.",
              body: `A pension payment of ${fmt(cc.payInNeeded)} (including the tax relief added) is one.` },
    ];
  }
  if (cc?.unclaimed > 0 && !cc.planning) {
    return [
      { label: ANSWER, figure: `${fmt(cc.unclaimed)} a year`, title: "of Tax-Free Childcare you could claim." },
      { label: WHY, title: "The government adds £2 for every £8 you pay for childcare, up to £2,000 a child a year." },
      { label: ACTION, title: "Applying on GOV.UK opens an account you pay your provider through.", body: "Eligibility is reconfirmed every three months." },
    ];
  }
  // Child Benefit paid back (income over £60,000), and the pension payment
  // that brings income to £60,000.
  if (cb && cb.charge > 0 && cb.payInNeeded <= aa.room) {
    return [
      { label: ANSWER, figure: `${fmt(cb.charge)} a year`, title: "of Child Benefit you're paying back in tax." },
      { label: WHY, title: `Above ${fmt(HICBC_START)} of income, 1% of your Child Benefit is clawed back for every £200, all of it by £80,000.` },
      selfEmployed(d)
        ? { label: ACTION, title: `Paying ${fmt(cb.payInNeeded)} more into a pension (including the tax relief added) would bring your income to £60,000 and keep it all.`, body: SELF_EMPLOYED_PENSION }
        : { label: ACTION, title: `Paying ${fmt(cb.payInNeeded)} more into your pension would bring your income to £60,000 and keep it all.`, body: `On top of the usual tax relief. ${HR}` },
    ];
  }

  // Their partner is over £100,000, and either their income isn't known or
  // the payment would be more than the usual allowance.
  if (partner) {
    return [
      { label: ANSWER, figure: cc.atStake > 0 ? `${fmt(cc.atStake)} a year` : undefined, title: "of childcare support you and your partner could get." },
      withBody({ label: WHY, title: `${support} stop once either parent's income is over £100,000, and your partner's is.` }, join(asPay, nationNote)),
      cc.partnerPayIn == null
        ? { label: ACTION, title: "A pension payment from your partner that brings their income to £100,000 would open it up.", body: "Their income, in Edit inputs, shows how much it would take." }
        : { label: ACTION, title: `Bringing your partner's income to £100,000 would take a pension payment of ${fmt(cc.partnerPayIn)}, more than the usual £60,000 a year allowance.`,
            body: "Allowance unused in the last three years can sometimes be carried forward: their pension provider can say." },
    ];
  }
  // Planning: what they could get, and whether their income puts it at risk.
  if (cc?.planning && (cc.state === "fine" || cc.state === "near")) {
    return [
      { label: ANSWER, figure: `${fmt(cc.atStake)} a year`, title: "of childcare support you could get once your child arrives." },
      withBody({ label: WHY, title: `Tax-Free Childcare adds 20% of childcare costs, up to £2,000 a child${cc.hours > 0 ? ", and in England the 30 funded hours start at 9 months" : ""}.` },
        cc.state === "near" ? `You're ${fmt(cc.headroom)} under the £100,000 limit, so a pay rise could take you over it.` : nationNote),
      { label: ACTION, title: "Nothing to change right now.", body: "Both of you need to be working, and each under £100,000, when you apply." },
    ];
  }
  if (cc?.state === "lost") {
    return [
      { label: ANSWER, figure: `${fmt(cc.atStake)} a year`, title: "of childcare support you're not getting." },
      withBody({ label: WHY, title: `${support} stop once either parent's income is over £100,000. Yours is ${fmt(Math.round(cc.ani))}.` }, nationNote),
      { label: ACTION, title: `Getting back to £100,000 would take a pension payment of ${fmt(cc.payInNeeded)}, more than this year's pension allowance.` },
    ];
  }
  if (cc?.state === "near" && cc.atStake > 0) {
    return [
      { label: ANSWER, figure: `${fmt(cc.atStake)} a year`, title: "of childcare support you'd lose over £100,000." },
      withBody({ label: WHY, title: `You're ${fmt(cc.headroom)} under it. A pay rise or bonus that takes you over stops it for the whole year.` }, nationNote),
      { label: ACTION, title: "Nothing to change right now.", body: "If a rise takes you over, a pension payment would bring your income back under it." },
    ];
  }
  if (cc?.state === "notWorking") {
    return [
      { label: ANSWER, title: "Tax-Free Childcare needs you to be working." },
      { label: WHY, title: "Each parent needs to expect to earn at least 16 hours a week at the minimum wage." },
      { label: ACTION, title: "Nothing to change right now.", body: "It opens up again once you're back in work." },
    ];
  }
  const checked = [cc && "you're under the £100,000 childcare limit", cc?.billKnown && d.tfcClaiming === "yes" && "you use Tax-Free Childcare",
    cb && !(cb.charge > 0) && "no Child Benefit is being paid back"].filter(Boolean);
  return [
    { label: ANSWER, title: cc ? "Your childcare support is safe." : "No Child Benefit is being paid back." },
    { label: WHY, title: checked.length ? `Checked: ${checked.length > 1 ? `${checked.slice(0, -1).join(", ")} and ${checked[checked.length - 1]}` : checked[0]}.` : "Nothing here is costing you anything." },
    { label: ACTION, title: "Nothing to change right now.", body: "Worth checking again if your pay, or your partner's, changes." },
  ];
}

// The modules with a reveal, by key.
// £100k tax trap (taxTrap.js): over it, what returning to £100,000 is worth
// and why; under it, how far, and what changes past it. The same figures as
// the module's status and page.
const pctOf = r => `${Math.round(r * 1000) / 10}%`;
const penceOf = r => `${Math.round(r * 1000) / 10}p`;
function rateParts(rate) {
  return [`${pctOf(rate.tax)} tax`, rate.ni > 0 ? `${pctOf(rate.ni)} National Insurance` : null, rate.sl > 0 ? `${pctOf(rate.sl)} student loan` : null].filter(Boolean)
    .reduce((out, part, i, all) => out + (i === 0 ? "" : i === all.length - 1 ? " and " : ", ") + part, "");
}
export function taxTrapReveal(d, m) {
  const t = taxTrap(d, m);
  if (!t || !trapInView(d, m.adjustedNetIncome)) return null;
  const support = t.nation === "england" ? "Tax-Free Childcare and the 30 funded hours" : "Tax-Free Childcare";
  if (t.over) {
    // Over £125,140 the allowance has gone already: the rate is the top one,
    // and getting back to £100k wins all of the allowance back.
    const how = t.aboveTaper ? "Over £125,140 your tax-free allowance has gone completely" : "Over £100k you lose £1 of tax-free allowance for every £2 earned";
    const pension = t.options.find(o => o.key === "pension");
    return [
      withBody({ label: ANSWER, figure: `${fmt(t.amount)} a year`, title: "lost each year to the £100k tax trap." },
        `${fmt(t.allowance.tax)} of extra tax on the tax-free allowance you've lost${t.childcareLost > 0 ? `, and ${fmt(t.childcareLost)} of ${support}` : ""}.`),
      { label: WHY, title: `${how}, so your marginal tax rate is ${pctOf(t.rate.rate)}: for every extra £1 you earn, ${penceOf(t.rate.rate)} is lost to ${lostTo(t.rate)} (${rateParts(t.rate)}).` },
      t.fits
        ? withBody({ label: ACTION, title: `Paying ${fmt(t.needed)} into your pension would bring your income back to £100k.` },
            `It costs ${fmt(pension.takeHome)} of take-home, and your pension gains ${fmt(pension.pension)}.${pension.childcare > 0 ? ` Your childcare support comes back too.` : ""}`)
        : { label: ACTION, title: `Getting back to £100k would take ${fmt(t.needed)}, more than this year's pension allowance left.`, body: "A 4-day week and the other ways back are on the module's page." },
    ];
  }
  return [
    { label: ANSWER, figure: fmt(t.headroom), title: `under £100k, where your marginal tax rate jumps to ${pctOf(t.trapRate)}.` },
    withBody({ label: WHY, title: "From £100k you lose £1 of tax-free allowance for every £2 earned, until it's gone at £125,140." },
      t.childcareAtRisk > 0 ? `${support}, worth ${fmt(t.childcareAtRisk)} a year, stop as soon as you're over.` : null),
    { label: ACTION, title: "A pay rise or bonus that takes you over can go into your pension instead, to keep you under.", body: "The module shows what crossing would cost you." },
  ];
}

export const MODULE_REVEALS = { pension: pensionReveal, cash: cashReveal, investments: investmentsReveal, studentLoan: studentLoanReveal, kids: kidsReveal, taxTrap: taxTrapReveal };
