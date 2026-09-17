import { fmt } from "./format.js";
import { isPensionContributing, pensionReturnRatio } from "./pension.js";

// Builds the plain-object financial summary handed to Claude — pulled out of
// generateDashboard()'s closure so it stays testable independent of the
// stateful Supabase/PostHog orchestration around it.
export function buildFinancialSummary(d, m, statuses) {
  const isaPrev = (+d.isaPrevCash||0)+(+d.isaPrevSS||0)+(+d.isaPrevLISA||0)+(+d.isaPrevOther||0);
  const totalOppForSummary = Object.entries(statuses).reduce((sum, [,v]) => sum + Math.min(v.impact||0, 99998), 0);

  return {
    name: d.name || "User",
    age: +d.age || null,

    // Income
    grossSalary: fmt(+d.salary||0),
    adjustedNetIncome: fmt(m.adjustedNetIncome||0),
    taxBand: m.tr >= 0.45 ? "Additional rate (45%)" : m.tr === 0.40 ? "Higher rate (40%)" : m.adjustedNetIncome > 100000 ? "60% taper zone (£100k–£125,140)" : "Basic rate (20%)",
    otherIncome: +d.otherIncome > 0 ? fmt(+d.otherIncome) : null,
    dividendIncome: +d.dividendIncome > 0 ? fmt(+d.dividendIncome) : null,
    bonusAmount: +d.bonusAmount > 0 ? fmt(+d.bonusAmount) : null,

    // Cash
    cashSavings: fmt(m.cash||0),
    premiumBonds: fmt(+d.premiumBonds||0),
    totalLiquid: fmt(m.totalLiquid||0),
    monthlyExpenses: fmt(m.expenses||0),
    runwayMonths: +m.runwayMonths.toFixed(1),
    emergencyStatus: m.emergencyFund >= m.emergencyBuffer
      ? `Adequate (${m.runwayMonths.toFixed(1)} months)`
      : `Shortfall of ${fmt(m.emergencyBuffer - m.emergencyFund)}`,
    effectiveSavingsRate: m.effectiveSavingsRate.toFixed(2) + "%",
    annualYieldGap: fmt(Math.round(m.annualYieldGap||0)),

    // ISA
    isaUsedThisYear: fmt(m.isaUsedThisYear||0),
    isaHeadroom: fmt(m.isaHeadroom||0),
    isaPreviousBalance: isaPrev > 0 ? fmt(isaPrev) : null,

    // Investments
    hasInvestments: d.hasInvestments === "yes",
    unwrappedValue: +d.unwrappedValue > 0 ? fmt(+d.unwrappedValue) : null,
    unrealisedGains: +d.unrealisedGains > 0 ? fmt(+d.unrealisedGains) : null,
    cgtSaving: m.cgtSaving > 0 ? fmt(Math.round(m.cgtSaving)) : null,

    // Pension
    pensionContributing: isPensionContributing(d),
    myContributionPct: isPensionContributing(d) ? (+d.myContribution||0) + "%" : null,
    employerMatchCap: (+d.employerMatch||0) + "%",
    missedMatchAnnual: m.missedMatch > 0 ? fmt(Math.round(m.missedMatch)) + "/yr" : "None",
    pensionPot: (+d.potValue||0) + (+d.potValue2||0) > 0 ? fmt((+d.potValue||0)+(+d.potValue2||0)) : null,
    projectedPotAtRetirement: fmt(Math.round(m.projectedPot||0)),
    retirementAge: +d.retirementAge||65,
    pensionReturnRatio: "1:" + pensionReturnRatio(d, m).toFixed(2),
    pensionType: d.pensionType === "sacrifice" ? "Salary sacrifice" : d.pensionType === "relief" ? "Relief at source" : "Unknown",

    // Student loan
    studentLoan: d.studentLoan !== "none" ? {
      plan: d.studentLoan,
      balance: fmt(+d.loanBalance||0),
      annualRepayment: fmt(Math.round(m.annualRepayment||0)),
      willClear: m.willClear ? "Yes — before write-off" : "No — likely written off",
    } : null,

    // Mortgage
    mortgage: d.hasMortgage === "yes" ? {
      balance: fmt(+d.mortgageBalance||0),
      rate: (+d.mortgageRate||0) + "%",
      monthlyPayment: fmt(+d.monthlyMortgage||0),
      daysToFixExpiry: m.daysToFixExpiry || null,
    } : null,

    // Personal loan
    personalLoan: d.hasPersonalLoan === "yes" ? {
      balance: fmt(+d.personalLoanBalance||0),
      rate: (+d.personalLoanRate||0) + "%",
    } : null,

    // Kids
    kids: d.hasKids === "yes" ? {
      numKids: d.numKids,
      ages: d.kidsAges,
      hasJISA: d.hasJISA === "yes",
      jisaValue: d.hasJISA === "yes" ? fmt(+d.juniorISAValue||0) : null,
    } : null,

    // Net worth
    netWorth: fmt(m.netWorth||0),
    totalAssets: fmt(m.totalAssets||0),
    totalLiabilities: fmt(m.totalLiabilities||0),

    // Pre-calculated module statuses — Claude uses these, does not recalculate
    moduleStatuses: Object.fromEntries(
      Object.entries(statuses).map(([key, s]) => [key, {
        status: s.status,
        impact: s.impact > 0 ? fmt(Math.min(s.impact, 99998)) : null,
        impactLabel: s.impactLabel || null,
      }])
    ),

    totalOpportunity: fmt(Math.round(totalOppForSummary / 100) * 100),
  };
}

export function buildDashboardPrompt(financialSummary) {
  return `You are Candid, a UK personal finance guidance tool. A user has completed their financial health assessment. Below are their pre-calculated financial metrics. Your job is to generate a personalised financial health report based ONLY on these figures — do not recalculate or re-derive any numbers.

USER FINANCIAL SUMMARY:
${JSON.stringify(financialSummary, null, 2)}

Generate a JSON response with exactly this structure:
{"score":<integer 0-100 based on moduleStatuses>,"headline":"<one punchy sentence, under 12 words: the single most important thing to address>","narrative":"<Max 2 short, punchy sentences, under 30 words total. Lead with the standout figure, close with the single biggest quick win. Use first name if provided. Tone: direct, like a knowledgeable friend.>","priorities":[{"title":"<max 6 words>","impact":"<£ figure>","description":"<1 short sentence, under 18 words, explaining why this matters for this specific person>","urgency":"<immediate|soon|this tax year>","module":"<cash|investments|pension|studentLoan|mortgage|personalLoan|kids|inheritance>"}],"modules":{"cash":{"status":"<ok|attention|critical>","summary":"<one short sentence, under 15 words>"},"investments":{"status":"<ok|attention|critical|na>","summary":"<one short sentence, under 15 words>"},"pension":{"status":"<ok|attention|critical>","summary":"<one short sentence, under 15 words>"},"studentLoan":{"status":"<ok|attention|critical|na>","summary":"<one short sentence, under 15 words>"},"mortgage":{"status":"<ok|attention|critical|na>","summary":"<one short sentence, under 15 words>"},"personalLoan":{"status":"<ok|attention|critical|na>","summary":"<one short sentence, under 15 words>"},"kids":{"status":"<ok|attention|critical|na>","summary":"<one short sentence, under 15 words>"}}}

Rules:
- Use ONLY the figures in the summary above. Do not invent or recalculate numbers.
- If a module has status "na" in moduleStatuses, set its status to "na" and summary to "Not applicable based on your inputs."
- Pension summary MUST reflect pensionContributing: ${financialSummary.pensionContributing} — never say "no contributions" or "start contributing" if pensionContributing is true.
- Priorities ordered by urgency then impact. Maximum 4 priorities. No insurance priorities.
- Be ruthlessly concise. Every field above has a hard word limit — treat it as a ceiling, not a target. Cut adjectives, hedging, and any clause that doesn't carry a number or an action. Never write "you are currently", "in order to", or "this means that".
- Module summaries must be direct and specific, not hedgy — cite the actual £ figure from the summary above (e.g. "£8,000 unused ISA allowance") rather than vague phrasing like "may not be fully utilised".
- Score should correlate with moduleStatuses: each critical module reduces score significantly.
- Write in British English. Do not use "silently", "quietly", or "invisible".
- Return valid JSON only. No preamble, no markdown, no backticks.`;
}

export function buildFallbackInsights(d, m) {
  return {
    isFallback:true,
    score:46, headline:"You're leaving money on the table — but it's fixable.",
    narrative:`${d.name?d.name.split(" ")[0]+", s":"S"}olid foundations, clear gaps. Pension and ISA are your fastest wins — see below.`,
    priorities:[
      {title:"Review your pension contributions",impact:"£3,000+",description:"Tax relief plus employer match means £100 in costs ~£80 take-home.",urgency:"immediate"},
      {title:"Maximise ISA allowance before April",impact:"£800+",description:"Unused ISA allowance expires April 5th — shelter it to protect future growth from tax.",urgency:"this tax year"},
      {title:"Review student loan strategy",impact:"Varies",description:"Most Plan 2/5 loans are written off before you'd clear them — that money works harder in a pension.",urgency:"soon"},
    ],
    modules:{
      cash:{status:"attention",summary:"Cash position's fine, but yield could be higher."},
      investments:{status:"attention",summary: m.isaHeadroom > 0
        ? `${fmt(m.isaHeadroom)} of ISA allowance unused this year — shelter it before April 5th.`
        : "Your ISA allowance is fully used this tax year — well done."},
      pension:{status:"attention",summary:"Review your contributions and projected pot."},
      studentLoan:{status:"attention",summary:"Overpayment strategy worth reviewing at your income."},
      mortgage:{status:"na",summary:"Not applicable based on your inputs."},
      personalLoan:{status:"na",summary:"Not applicable based on your inputs."},
      kids:{status:"na",summary:"Not applicable based on your inputs."},
    }
  };
}

// Same shape as `fallback` (so nothing downstream needs to special-case it),
// just a headline/narrative that actually tells the user what happened
// instead of reading like a generic AI hiccup.
export function buildRateLimitedFallback(fallback, d) {
  return {
    ...fallback,
    isRateLimited: true,
    headline: "You're regenerating too fast — please try again shortly.",
    narrative: `${d.name?d.name.split(" ")[0]+", y":"Y"}our inputs are saved. Wait a moment, then hit "Regenerate my report" again.`,
  };
}
