// Fringe personas: 25 unusual people run through the same engine functions
// the app's screens show figures from, to check the logic holds at the edges
// (no earnings, huge loans, near retirement, assets without income...).
// Prints what each person would read, module by module, plus the automatic
// checks below that failed. Run:
//   node scripts/fringe-personas.js            (all, as text)
//   node scripts/fringe-personas.js redundant  (one, by id)
//   node scripts/fringe-personas.js --json > out.json
import { calcMetrics } from "../src/lib/metrics.js";
import { sanitizeForMvp, computeModuleStatuses, calcCandidScore, getModuleSummary, MODULE_META } from "../src/lib/moduleStatus.js";
import { MODULE_REVEALS } from "../src/lib/moduleReveal.js";
import { assistItems } from "../src/lib/assist.js";
import { whatToDoFirst } from "../src/lib/priorities.js";
import { moduleEstimate, pensionOutlook, loanAlternatives } from "../src/lib/crossModule.js";
import { calcStudentLoanScenario } from "../src/lib/studentLoan.js";
import { calcCashOptimisation } from "../src/lib/cash.js";
import { rollTaxYear } from "../src/lib/taxYear.js";

// Every input the app keeps (as the characterisation test's base profile):
// a 32-year-old on £55k with modest savings, then overridden per persona.
const base = {
  name: "", email: "", interests: [], selectedModules: [], financialGoals: [],
  age: "32", salary: "55000", otherIncome: "0", dividendIncome: "0", bonusAmount: "0", salaryTrajectory: "stable",
  employmentStatus: "employed", monthlyExpenses: "1800", higherBuffer: "no",
  cashSavings: "10000", savingsRate: "2.5", premiumBonds: "0", cashAccessType: "yes", cashTiers: [{ amount: "10000", rate: "2.5" }],
  hasInvestments: "yes", isaType: "stocks", unwrappedValue: "0", unrealisedGains: "0", hasSoldAssetsOutsideWrapper: "no", realisedCgtGains: "",
  isaThisYearCash: "0", isaThisYearSS: "0", isaThisYearLISA: "0", isaThisYearOther: "0",
  isaPrevCash: "0", isaPrevSS: "0", isaPrevLISA: "0", isaPrevOther: "0",
  hasPension: "yes", myContribution: "5", employerMatch: "5", potValue: "30000", potValue2: "0", retirementAge: "65", pensionType: "sacrifice",
  pensionUnknown: false, niYears: "10",
  studentLoan: "none", loanBalance: "0", studentLoanRate: "",
  hasMortgage: "no", ownsOutright: false, hasPersonalLoan: "no", hasKids: "no",
  assistSnoozed: null, assistSkipIsa: false, assistSkipPb: false, assistAccounts: [],
};
const ALL = ["cash", "investments", "pension", "studentLoan"];
const cash = (amount, rate) => ({ cashSavings: String(amount), savingsRate: String(rate), cashTiers: [{ amount: String(amount), rate: String(rate) }] });
const notWorking = { employmentStatus: "not_working", salary: "0", myContribution: "0", employerMatch: "0" };

export const PERSONAS = [
  { id: "redundant", name: "Made redundant, ~£20k payout coming", why: "No earnings for now, a growing Plan 2 loan, a pension with nothing going in, and a lot of cash.",
    d: { ...notWorking, age: "33", monthlyExpenses: "2000", ...cash(80000, 3.0), isaPrevSS: "30000", potValue: "42000",
      studentLoan: "plan2", loanBalance: "48000", selectedModules: ALL } },
  { id: "stale-salary", name: "Switched to 'Not working' after entering a salary", why: "The salary question hides when not working; does the old £55k still count?",
    d: { employmentStatus: "not_working", salary: "55000", age: "36", ...cash(30000, 2.0), potValue: "60000", studentLoan: "plan2", loanBalance: "35000", selectedModules: ALL } },
  { id: "career-break", name: "Career break to look after children", why: "No pay for a year or two, then back to work; pension and NI gaps matter more than drawdown.",
    d: { ...notWorking, age: "35", monthlyExpenses: "1500", ...cash(15000, 1.5), potValue: "60000", niYears: "13", studentLoan: "plan2", loanBalance: "30000", selectedModules: ALL } },
  { id: "new-grad", name: "New graduate, no job yet", why: "Plan 5 loan, no income, almost no cash.",
    d: { ...notWorking, age: "22", monthlyExpenses: "900", ...cash(800, 0), hasPension: "no", potValue: "0", hasInvestments: "no", niYears: "1",
      studentLoan: "plan5", loanBalance: "52000", selectedModules: ALL } },
  { id: "early-retired", name: "Retired early at 55, big pot", why: "No earnings, pension over the Lump Sum Allowance's 25%, can draw it now.",
    d: { ...notWorking, age: "55", retirementAge: "55", monthlyExpenses: "3000", ...cash(30000, 4.0), potValue: "1200000", niYears: "33", selectedModules: ["cash", "pension", "investments"] } },
  { id: "fire-dividends", name: "Lives off dividends at 40", why: "No salary, £30k of dividends, £800k invested outside an ISA.",
    d: { ...notWorking, age: "40", dividendIncome: "30000", unwrappedValue: "800000", unrealisedGains: "300000", isaPrevSS: "120000", ...cash(40000, 4.0),
      potValue: "150000", monthlyExpenses: "2500", selectedModules: ["cash", "pension", "investments"] } },
  { id: "low-earn-high-assets", name: "Part-time £18k, inherited £400k", why: "Low income, large assets mostly outside wrappers.",
    d: { age: "45", salary: "18000", monthlyExpenses: "1300", ...cash(80000, 0.5), unwrappedValue: "400000", unrealisedGains: "40000",
      myContribution: "3", employerMatch: "3", potValue: "20000", selectedModules: ["cash", "pension", "investments"] } },
  { id: "low-income-near-retirement", name: "63, £19k, small pot", why: "Close to State Pension age with little saved; NI years matter.",
    d: { age: "63", salary: "19000", monthlyExpenses: "1400", ...cash(3000, 0), myContribution: "3", employerMatch: "3", potValue: "25000", niYears: "28",
      retirementAge: "67", hasInvestments: "no", selectedModules: ["cash", "pension"] } },
  { id: "high-income-near-retirement", name: "61, £120k, £900k pot", why: "£100k trap, Lump Sum Allowance, retiring at 63.",
    d: { age: "61", salary: "120000", monthlyExpenses: "4000", ...cash(150000, 3.5), unwrappedValue: "200000", unrealisedGains: "90000", isaPrevSS: "250000",
      myContribution: "8", employerMatch: "8", potValue: "900000", niYears: "40", retirementAge: "63", pensionType: "relief", selectedModules: ["cash", "pension", "investments"] } },
  { id: "doctor-huge-loan", name: "Doctor, £145k, £95k Plan 2", why: "Very large loan and a very high salary: the one case overpaying might win.",
    d: { age: "31", salary: "145000", monthlyExpenses: "3500", ...cash(40000, 4.0), myContribution: "8", employerMatch: "14", potValue: "60000", pensionType: "relief",
      studentLoan: "plan2", loanBalance: "95000", salaryTrajectory: "moderate", selectedModules: ALL } },
  { id: "low-earner-small-loan", name: "£24k, £8k Plan 2", why: "Below the repayment threshold with a small balance.",
    d: { age: "26", salary: "24000", monthlyExpenses: "1300", ...cash(2000, 1.0), myContribution: "5", employerMatch: "3", potValue: "6000",
      studentLoan: "plan2", loanBalance: "8000", selectedModules: ALL } },
  { id: "part-time-huge-loan", name: "Part-time £26k, £70k Plan 2", why: "Will never repay; overpaying would be wasted.",
    d: { age: "30", salary: "26000", monthlyExpenses: "1500", ...cash(12000, 4.5), myContribution: "5", employerMatch: "5", potValue: "15000",
      studentLoan: "plan2", loanBalance: "70000", selectedModules: ALL } },
  { id: "plan1-high-earner", name: "44, £90k, £4k Plan 1 left", why: "Clears in months; nothing to do.",
    d: { age: "44", salary: "90000", monthlyExpenses: "3000", ...cash(25000, 4.2), potValue: "180000", myContribution: "6", employerMatch: "6", niYears: "22",
      studentLoan: "plan1", loanBalance: "4000", selectedModules: ALL } },
  { id: "trap-100k", name: "£105k plus £20k bonus", why: "In the £100k personal allowance trap; bonus sacrifice should show.",
    d: { age: "39", salary: "105000", bonusAmount: "20000", monthlyExpenses: "3800", ...cash(35000, 3.0), myContribution: "4", employerMatch: "4", potValue: "140000",
      pensionType: "relief", niYears: "18", selectedModules: ["cash", "pension", "investments"] } },
  { id: "very-high-taper", name: "£400k earner", why: "Tapered annual allowance; large contributions may exceed it.",
    d: { age: "48", salary: "400000", monthlyExpenses: "10000", ...cash(250000, 3.0), myContribution: "10", employerMatch: "10", potValue: "1500000",
      isaPrevSS: "300000", isaThisYearSS: "20000", unwrappedValue: "500000", unrealisedGains: "200000", niYears: "26", selectedModules: ["cash", "pension", "investments"] } },
  { id: "working-past-spa", name: "70, still working on £30k", why: "Past State Pension age: no NI, State Pension in payment.",
    d: { age: "70", salary: "30000", monthlyExpenses: "1600", ...cash(20000, 3.0), myContribution: "0", employerMatch: "0", potValue: "200000", niYears: "40",
      retirementAge: "72", selectedModules: ["cash", "pension"] } },
  { id: "self-employed-no-pension", name: "Self-employed £35k, no pension", why: "All cash in a 0% current account; no employer to match.",
    d: { employmentStatus: "self_employed", age: "34", salary: "35000", monthlyExpenses: "1600", ...cash(40000, 0), hasPension: "no", myContribution: "0", employerMatch: "0",
      potValue: "0", pensionType: "relief", selectedModules: ["cash", "pension", "investments"] } },
  { id: "young-hoarder", name: "25, £45k, £60k at 0.5%", why: "Big cash pile at a poor rate, no ISA used.",
    d: { age: "25", salary: "45000", monthlyExpenses: "1200", ...cash(60000, 0.5), myContribution: "5", employerMatch: "5", potValue: "8000", selectedModules: ["cash", "pension", "investments"] } },
  { id: "overspending", name: "Spends more than they earn", why: "£28k salary, £3,000 a month out: no surplus to save.",
    d: { age: "29", salary: "28000", monthlyExpenses: "3000", ...cash(1500, 0), myContribution: "5", employerMatch: "3", potValue: "9000", hasInvestments: "no", selectedModules: ["cash", "pension", "investments"] } },
  { id: "zero-expenses", name: "Expenses left at £0", why: "An emergency buffer of nothing: is all cash 'spare'?",
    d: { age: "31", salary: "50000", monthlyExpenses: "0", ...cash(20000, 2.0), selectedModules: ["cash", "pension", "investments"] } },
  { id: "premium-bonds-only", name: "£50k in Premium Bonds, nothing else", why: "Maxed Premium Bonds as their only savings.",
    d: { age: "42", salary: "40000", monthlyExpenses: "2000", ...cash(0, 0), premiumBonds: "50000", potValue: "70000", selectedModules: ["cash", "pension"] } },
  { id: "over-fscs", name: "£500k cash in one bank", why: "Far above the £120k FSCS limit.",
    d: { age: "40", salary: "50000", monthlyExpenses: "2500", ...cash(500000, 3.0), potValue: "90000", selectedModules: ["cash", "pension", "investments"] } },
  { id: "cgt-heavy", name: "£150k of shares outside an ISA, £80k gains", why: "Capital gains tax exposure; Bed and ISA.",
    d: { age: "37", salary: "60000", monthlyExpenses: "2200", ...cash(20000, 4.0), unwrappedValue: "150000", unrealisedGains: "80000", hasSoldAssetsOutsideWrapper: "yes",
      realisedCgtGains: "5000", potValue: "50000", selectedModules: ["cash", "pension", "investments"] } },
  { id: "everything-maxed", name: "Everything already maxed", why: "ISA full, full match, good rates: should say little.",
    d: { age: "35", salary: "70000", monthlyExpenses: "2000", ...cash(12000, 4.6), isaThisYearSS: "20000", isaPrevSS: "90000", myContribution: "8", employerMatch: "8",
      potValue: "110000", selectedModules: ["cash", "pension", "investments"] } },
  { id: "apprentice", name: "19, apprentice on £14k", why: "Below the auto-enrolment trigger and the tax threshold.",
    d: { age: "19", salary: "14000", monthlyExpenses: "600", ...cash(2000, 0), hasPension: "no", myContribution: "0", employerMatch: "0", potValue: "0", niYears: "1",
      hasInvestments: "no", selectedModules: ["cash", "pension"] } },
];

const MARKET = { isaRate: 4.72, nonIsaRate: 5.0, rows: [
  { id: "r1", provider_name: "Chase", account_type: "Easy access", rate_aer: "4.50", is_isa: false },
  { id: "r2", provider_name: "Plum", product_name: "Cash ISA", account_type: "Easy access ISA", rate_aer: "4.68", is_isa: true },
  { id: "r3", provider_name: "NS&I", product_name: "Premium Bonds", account_type: "Premium Bonds", rate_aer: "3.60", max_balance: 50000, is_isa: false },
] };

const attempt = fn => { try { return fn(); } catch (e) { return { error: e.message }; } };
const textOf = v => JSON.stringify(v ?? "");

export function runPersona(p) {
  const d = sanitizeForMvp(rollTaxYear({ ...base, ...p.d }, new Date()));
  const m = calcMetrics(d, MARKET);
  const statuses = computeModuleStatuses(d, m, MARKET);
  const out = {
    id: p.id, name: p.name, why: p.why,
    key: { age: +d.age, salary: m.salary, taxBand: m.tr, takeHomeMonthly: Math.round(m.monthlyTakeHome ?? m.netMonthly ?? 0),
      surplusMonthly: Math.round(m.monthlySurplus ?? 0), emergencyBuffer: m.emergencyBuffer, surplusCash: m.surplusCash, netWorth: m.netWorth },
    score: attempt(() => calcCandidScore(statuses)),
    modules: {},
    firstThing: attempt(() => whatToDoFirst(d, m, statuses)),
    assist: attempt(() => assistItems(d, m, MARKET.rows).map(i => i.title || i.label || i.text || i)),
  };
  for (const mm of MODULE_META.filter(x => d.selectedModules.includes(x.key))) {
    const s = statuses[mm.key] || {};
    out.modules[mm.key] = {
      status: s.status, amount: s.amount, impact: s.impactLabel,
      summary: attempt(() => getModuleSummary(mm, d, m, statuses, null)),
      estimate: attempt(() => moduleEstimate(mm.key, d, m)),
      reveal: attempt(() => (MODULE_REVEALS[mm.key]?.(d, m, { marketRates: MARKET }) || null)?.map(s => [s.label, s.figure, s.title, s.body].filter(Boolean).join(" | "))),
    };
  }
  if (d.studentLoan !== "none") {
    const sl = calcStudentLoanScenario(d, m);
    out.studentLoan = { rate: sl.slRatePct, interestNow: sl.annualInterest, repayNow: sl.annualRep, growing: sl.balanceGrowing, turning: sl.turningTaxYear,
      clearYr: sl.clearYr, writeOff: sl.writeOffBal, worthOverpaying: sl.worthOverpaying, benefit: sl.overpayAnnualBenefit,
      alternatives: attempt(() => loanAlternatives(m)) };
  }
  if (d.selectedModules.includes("pension")) out.pensionOutlook = attempt(() => pensionOutlook(d, m));
  if (d.selectedModules.includes("cash")) out.cash = attempt(() => { const c = calcCashOptimisation(m, MARKET.isaRate, MARKET.nonIsaRate, MARKET.rows); return { gain: c?.annualGain ?? c?.annualYieldGap, isaHeadroom: c?.isaHeadroom, note: c?.headline }; });
  out.flags = checks(d, m, out);
  return out;
}

// Automatic checks: things that are wrong whoever the person is.
function checks(d, m, out) {
  const flags = [];
  const all = textOf(out);
  if (/NaN|Infinity|undefined|£-|-£/.test(all)) flags.push("A figure reads NaN, Infinity, undefined or a negative £.");
  if (/"error":/.test(all)) flags.push("A calculation threw: " + (all.match(/"error":"([^"]+)"/) || [])[1]);
  const age = +d.age || 0, earning = m.salary > 0;
  const pensionText = textOf(out.modules.pension?.reveal);
  if (age < 55 && /drawn over|drawdown|tax-free cash|Pension Wise/i.test(pensionText)) flags.push(`Pension answer talks about drawing the pension at ${age}, years before it can be touched (57 from 2028).`);
  if (d.employmentStatus === "not_working" && m.salary > 0) flags.push(`'Not working' but a £${m.salary} salary is still used in the sums.`);
  if (out.studentLoan?.worthOverpaying && out.studentLoan.clearYr == null) flags.push("Overpaying the student loan shown as worth it, but the loan is written off anyway.");
  if (!earning && /tax relief you're not getting|employer/i.test(pensionText)) flags.push("No earnings, but the pension answer talks about relief or an employer match.");
  if ((+d.monthlyExpenses || 0) === 0 && (m.surplusCash || 0) >= (+d.cashSavings || 0) && (+d.cashSavings || 0) > 0) flags.push("Expenses of £0 treat every pound of cash as spare: no emergency buffer.");
  if ((+d.cashSavings || 0) > 120000 && !/FSCS|£120,000|protected/i.test(all)) flags.push("Cash far above the FSCS limit, and nothing mentions protection.");
  if (m.monthlySurplus < 0 && /spare cash|overpay|move .* into/i.test(textOf(out.assist))) flags.push("Spending exceeds income, yet suggestions assume spare money.");
  return flags;
}

const arg = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1:")}` || process.argv[1]?.endsWith("fringe-personas.js")) {
  const pick = arg.filter(a => !a.startsWith("--"));
  const results = PERSONAS.filter(p => !pick.length || pick.includes(p.id)).map(runPersona);
  if (arg.includes("--json")) console.log(JSON.stringify(results, null, 2));
  else for (const r of results) {
    console.log(`\n=== ${r.id}: ${r.name}\n    ${r.why}`);
    console.log("    key:", JSON.stringify(r.key), "score:", JSON.stringify(r.score));
    for (const [k, v] of Object.entries(r.modules)) {
      console.log(`  [${k}] ${v.status} ${v.amount ?? ""} ${v.impact ?? ""}`);
      for (const line of (Array.isArray(v.reveal) ? v.reveal : [JSON.stringify(v.reveal)])) console.log("     -", line);
    }
    if (r.studentLoan) console.log("  [sl]", JSON.stringify({ ...r.studentLoan, alternatives: undefined }));
    if (r.pensionOutlook) console.log("  [outlook]", JSON.stringify(r.pensionOutlook).slice(0, 300));
    console.log("  [first]", JSON.stringify(r.firstThing).slice(0, 300));
    console.log("  [assist]", JSON.stringify(r.assist).slice(0, 400));
    for (const f of r.flags) console.log("  FLAG:", f);
  }
}
