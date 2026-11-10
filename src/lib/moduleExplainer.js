import { fmt } from "./format.js";
import { CGT_ANNUAL_ALLOWANCE, ISA_ALLOWANCE, PSA_BY_BAND, cashIsaLimit, taxFreeInterest } from "./tax.js";
import { EMERGENCY_MONTHS_HINT } from "./metrics.js";
import { PB_RATE } from "./cash.js";
import { premiumBondsRow } from "./savingsRates.js";
import { TYPICAL_EASY_ACCESS_PCT } from "./cashQuick.js";

// A module's optional walk-through: a few short pages on how the area works,
// offered once the questions are answered and before the answer. Plain data,
// drawn by mobile/explainer/ModuleExplainer.jsx; every rule and the user's own
// figures come from the engine, so the pages can't drift from the answer.
// Facts only, never a recommendation (CLAUDE.md, Product rules).
//
// A page: { id, title, intro, scene }. `intro` builds at the top of the page,
// then gives way to the scene's captions in the same place. `scene.kind` is a
// scene in KINDS there; the rest of it is that scene's props.

const pct = rate => `${Math.round(rate * 100)}%`;
const pence = n => Math.round(n * 100) / 100;
// Pence where they matter: tax on a single share.
const money = n => Number.isInteger(n) ? fmt(n) : `£${n.toFixed(2)}`;
// Short enough for the label riding a bar: £1.5k, £20k.
const short = n => n >= 1000 ? `£${Math.round(n / 100) / 10}k` : fmt(n);

// One share carries pages 1 to 3; a larger holding the allowance on page 4.
const SHARE_START = 100, SHARE_END = 110;
// Thirty days' closes, with falls as well as rises.
const SHARE_PATH = [100, 102, 99, 101, 104, 103, 100, 97, 99, 102, 105, 103, 101, 98, 100, 103, 106, 104, 107, 105, 102, 104, 108, 106, 103, 105, 109, 107, 106, 108, 110];
const BOUGHT = 10000, SOLD = 15000;

const CALENDAR_MONTHS = ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
// How far each allowance has got by the last day, in the page 5 illustration.
const NEARLY_ISA = 0.8, NEARLY_CGT = 0.45;

function investmentsExplainer(d, m) {
  const rate = pct(m.cgtRate);
  const shareGain = SHARE_END - SHARE_START;
  const shareTax = pence(shareGain * m.cgtRate);
  const shareKeep = pence(shareGain - shareTax);
  const shareReceived = pence(SHARE_END - shareTax);
  // The same 10% on a full year's ISA allowance.
  const fullIsaSaved = ISA_ALLOWANCE * (shareGain / SHARE_START) * m.cgtRate;
  const gain = SOLD - BOUGHT;
  const taxable = Math.max(0, gain - CGT_ANNUAL_ALLOWANCE);
  const tax = taxable * m.cgtRate;
  const kept = taxable - tax;
  const received = CGT_ANNUAL_ALLOWANCE + kept;
  const isaLeft = m.isaHeadroom;
  const isaUsed = ISA_ALLOWANCE - isaLeft;
  const cgtLeft = m.remainingCgtAllowance;
  return [
    {
      id: "what",
      title: "Investing means owning part of a company",
      intro: "When you buy shares, or a fund that holds them, you own a small part of those companies. Their value can rise. It can also fall, and you could get back less than you put in.",
      scene: { id: "what-scene", kind: "journey", start: SHARE_START, end: SHARE_END, points: SHARE_PATH,
        dayLabel: i => i === 0 ? "Today" : `Day ${i}`,
        labels: { company: "Company A", monogram: "A", oneShare: "One share", endLabel: "After 30 days", startAxis: "Today", endAxis: "Day 30", paidColumn: "What you paid", nowColumn: "What you have now",
          captionBuy: `You buy one share for ${money(SHARE_START)}.`, captionMoves: "Its price moves up and down every day.", captionEnd: `After 30 days, in this example, it's worth ${money(SHARE_END)}.`, captionStack: `You paid ${money(SHARE_START)}. You now have ${money(SHARE_END)}.` },
        ariaLabel: `An example share bought for ${money(SHARE_START)} moves up and down for 30 days and ends at ${money(SHARE_END)}: ${money(SHARE_START)} paid and ${money(shareGain)} of gain.` },
    },
    {
      id: "gain",
      title: "The rise in value is a capital gain",
      intro: `Only the rise is taxed, and only when you sell. Capital gains tax is separate from income tax, and on your income the rate would be ${rate}.`,
      scene: { id: "gain-scene", kind: "taxed", paid: SHARE_START, gain: shareGain, tax: shareTax, keep: shareKeep,
        labels: { noTax: "No tax", gainCol: "Gain", taxableAt: `Taxed at ${rate}`, keepLabel: "You keep", taxLabel: "Tax",
          captionPaid: `The ${money(SHARE_START)} you put in isn't a gain, so there's no tax on it.`, captionGain: `The ${money(shareGain)} rise is your gain.`, captionPull: "When you sell, tax is due on the gain.", captionSplit: `At ${rate}, ${money(shareTax)} goes in tax.`, captionEnd: `You keep ${money(shareKeep)} of the ${money(shareGain)} gain.` },
        ariaLabel: `Of ${money(SHARE_END)}, the ${money(SHARE_START)} you paid has no tax. The ${money(shareGain)} gain is taxable at ${rate}: ${money(shareKeep)} you keep and ${money(shareTax)} tax.` },
    },
    {
      id: "isa",
      title: "An ISA is a tax-free shield",
      intro: `An ISA is a wrapper that shields the gains and dividends on what you hold inside it from tax. UK residents aged 18 or over can put in up to ${fmt(ISA_ALLOWANCE)} a year across all their ISAs.`,
      scene: { id: "isa-scene", kind: "compare", start: SHARE_START, end: SHARE_END, tax: shareTax, received: shareReceived, exampleSaved: fullIsaSaved, used: isaUsed, limit: ISA_ALLOWANCE,
        labels: { inside: "ISA", outside: "Outside an ISA", oneShare: "One share", sold: "SOLD", soldFor: "Sold for", taxRow: "Tax", noTax: "No tax", receiveRow: "You receive", saved: "Saved by utilising your ISA", exampleLine: `A full ${fmt(ISA_ALLOWANCE)} ISA, with the same 10% gain`, exampleSaved: "Saved", usedLabel: "ISA allowance used", ofLabel: "of",
          captionTwo: "The same share, held two ways.", captionWrap: "An ISA wraps around one, shielding it from tax.", captionGrow: "Both grow by the same amount.", captionSell: "Now both are sold.", captionReceive: "Only the one outside the ISA has tax to pay.", captionSaved: "That's the difference the shield makes.", captionExample: "The same gain, at a larger size.", captionUsed: isaLeft > 0 ? `You have ${fmt(isaLeft)} left this tax year.` : "You've used all of it this tax year." },
        ariaLabel: `Two shares grow to ${money(SHARE_END)} and are sold. The one in an ISA pays no tax; the other pays ${money(shareTax)}. You've used ${fmt(isaUsed)} of your ${fmt(ISA_ALLOWANCE)} ISA allowance this tax year.` },
    },
    {
      id: "outside",
      title: "Outside an ISA, some of a gain can be taxed",
      intro: `A general investment account has no shield. The first ${fmt(CGT_ANNUAL_ALLOWANCE)} of gains you take each tax year is tax-free, and the rest is taxable.`,
      scene: { id: "outside-scene", kind: "waterfall", invested: BOUGHT, value: SOLD, gain, exempt: CGT_ANNUAL_ALLOWANCE, taxable, tax, kept, received,
        labels: { invested: "Invested", growth: "Growth", worth: "Worth now", gainCol: "Gain", exemptCol: "Tax-free", taxableCol: "Taxable", splitCol: "After tax", toUser: "To you", toTaxman: "To HMRC", taxTitle: "To HMRC", receiveTitle: "You receive", receiveWorking: `${fmt(CGT_ANNUAL_ALLOWANCE)} + ${fmt(taxable)} − ${fmt(tax)}`,
          captionInvested: `Say you invest ${fmt(BOUGHT)}.`, captionGrowth: `It grows by ${fmt(gain)}.`, captionWorth: `It's now worth ${fmt(SOLD)}.`, captionGain: `If you sold, ${fmt(gain)} is your gain.`, captionExempt: `The first ${fmt(CGT_ANNUAL_ALLOWANCE)} is tax-free, and goes to you.`, captionTaxable: `That leaves ${fmt(taxable)} taxable.`, captionSplit: `At ${rate}, ${fmt(tax)} goes to HMRC and ${fmt(kept)} to you.`, captionPayoff: `Where the ${fmt(gain)} gain goes, assuming no other gains that tax year.` },
        ariaLabel: `${fmt(BOUGHT)} grows to ${fmt(SOLD)}, a ${fmt(gain)} gain. ${fmt(CGT_ANNUAL_ALLOWANCE)} is tax-free. Of the ${fmt(taxable)} taxable, ${fmt(tax)} goes to HMRC. You receive ${fmt(received)} of the gain.` },
    },
    {
      id: "reset",
      title: "Both allowances reset every April",
      intro: "The ISA and capital gains allowances run from 6 April to 5 April. Selling and buying back the same shares within 30 days, outside an ISA, doesn't reset a gain.",
      scene: { id: "reset-scene", kind: "calendar", start: { top: "April", big: "6" }, months: CALENDAR_MONTHS.map(big => ({ top: "", big })), aprilDays: ["1", "2", "3", "4"].map(big => ({ top: "April", big })), lastDay: { top: "April", big: "5" }, firstDay: { top: "April", big: "6" },
        meters: [{ label: "ISA allowance", full: ISA_ALLOWANCE, nearly: ISA_ALLOWANCE * NEARLY_ISA }, { label: "Capital gains allowance", full: CGT_ANNUAL_ALLOWANCE, nearly: CGT_ANNUAL_ALLOWANCE * NEARLY_CGT }],
        labels: { yearNow: "This tax year", yearNext: "New tax year", lastDayFlag: "LAST DAY", usedSuffix: " used", captionYear: "Through the tax year, allowances get used.", captionFlag: "5 April is the last day to use these allowances before they reset.", captionFinal: "In this example, a final use fills them up.", captionReset: "On 6 April they reset. Anything unused doesn't carry over." },
        ariaLabel: "A calendar runs through the tax year as two allowances fill up. 5 April is the last day to use them. On 6 April they reset to zero." },
    },
    {
      id: "yours",
      title: "Now, your own figures",
      intro: "Those are the rules. Next, what they mean for your own allowances this tax year.",
      scene: { id: "yours-scene", kind: "bars",
        bars: [{ label: "ISA allowance", used: isaUsed, limit: ISA_ALLOWANCE, unused: isaLeft, usedShort: short(isaUsed) }, { label: "Capital gains allowance", used: CGT_ANNUAL_ALLOWANCE - cgtLeft, limit: CGT_ANNUAL_ALLOWANCE, unused: cgtLeft, usedShort: short(CGT_ANNUAL_ALLOWANCE - cgtLeft) }],
        labels: { unusedLabel: "Unused", captionUsed: "This is what you've used so far this tax year.", captionLeft: "And this is what's still unused. Your answer shows what that could mean for you." },
        ariaLabel: `You've used ${fmt(isaUsed)} of your ISA allowance, with ${fmt(isaLeft)} unused, and ${fmt(CGT_ANNUAL_ALLOWANCE - cgtLeft)} of your capital gains allowance, with ${fmt(cgtLeft)} unused.` },
    },
  ].map(({ id, title, intro, scene }) => ({ id, title, blocks: [{ ...scene, intro, gap: 0, fill: true }] }));
}

// Cash's examples: fixed rates, labelled as examples, so the pages don't move
// with the market. The user's own figures are on the last page and the answer.
const EXAMPLE_RATE_PCT = 4;
const RATE_EXAMPLE_POT = 20000, TAX_EXAMPLE_POT = 30000, EXAMPLE_MONTHLY_COSTS = 2000;
const PREMIUM_BONDS_LIMIT = 50000;
const DRAW_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// An illustration of a year's prizes on the example holding. September takes
// whatever brings the year's total to the prize fund rate, to the nearest
// £25 (the smallest prize).
const BONDS_HOLDING = 20000, PRIZE_STEP = 25, BIG_PRIZE_MONTH = 8;
const DRAW_PRIZES = [50, 0, 25, 100, 0, 50, 25, 0, 0, 25, 50, 50];

function cashExplainer(d, m, { marketRates } = {}) {
  const taxRate = m.savingsTr ?? m.tr;
  const rate = pct(taxRate);
  const lowInterest = RATE_EXAMPLE_POT * TYPICAL_EASY_ACCESS_PCT / 100;
  const highInterest = RATE_EXAMPLE_POT * EXAMPLE_RATE_PCT / 100;
  // All the interest that's tax-free on their income, as the Cash answer
  // counts it (cash.js): more than the Personal Savings Allowance on a low
  // income, where unused Personal Allowance and the starting rate apply.
  const psa = PSA_BY_BAND[m.taxBandLabel] ?? 0;
  const taxFree = taxFreeInterest(m.nonSavingsIncome ?? m.adjustedNetIncome, m.taxBandLabel);
  const beyondPsa = taxFree > psa;
  const interest = TAX_EXAMPLE_POT * EXAMPLE_RATE_PCT / 100;
  const exempt = Math.min(taxFree, interest);
  const taxable = interest - exempt;
  const tax = Math.round(taxable * taxRate);
  const kept = taxable - tax;
  const received = exempt + kept;
  const isaLimit = cashIsaLimit(m.taxYear, d.age);
  const isaInterest = isaLimit * EXAMPLE_RATE_PCT / 100;
  const isaTax = Math.round(isaInterest * taxRate);
  const bondsRow = premiumBondsRow(marketRates?.rows);
  const bondsPct = bondsRow ? +bondsRow.rate_aer : PB_RATE * 100;
  const bondsRate = `${bondsPct.toFixed(2)}%`;
  const prizes = [...DRAW_PRIZES];
  const yearsPrizes = Math.round(BONDS_HOLDING * bondsPct / 100 / PRIZE_STEP) * PRIZE_STEP;
  prizes[BIG_PRIZE_MONTH] = Math.max(0, yearsPrizes - prizes.reduce((a, b) => a + b, 0));
  const prizeTotal = prizes.reduce((a, b) => a + b, 0);
  const isaLeft = m.isaHeadroom;
  const yearlyInterest = Math.round((m.cash || 0) * (m.savingsRate || 0) / 100);
  const interestUsed = Math.min(yearlyInterest, taxFree);
  const allowanceName = beyondPsa ? "Tax-free interest" : "Personal Savings Allowance";
  return [
    {
      id: "rates",
      title: "The same money can earn very different amounts",
      intro: "Savings earn interest, and the rate varies widely between accounts. Your bank won't always move you to a better one.",
      scene: { id: "rates-scene", kind: "cashRates", amount: RATE_EXAMPLE_POT, lowInterest, highInterest, difference: highInterest - lowInterest,
        labels: { lowRate: `Bank A\n${TYPICAL_EASY_ACCESS_PCT}%/yr`, highRate: `Bank B\n${EXAMPLE_RATE_PCT}%/yr`, gapLabel: "a year's difference",
          captionSaved: `Say you have ${fmt(RATE_EXAMPLE_POT)} in savings.`, captionRates: `Bank A offers ${TYPICAL_EASY_ACCESS_PCT}%. Bank B offers ${EXAMPLE_RATE_PCT}%.`, captionInterest: "After a year, each has earned interest.", captionGap: "The bank account you use can make a big difference to your outcomes.", captionTakeaway: "Sticking with a low-rate account can cost you money, every year." },
        ariaLabel: `${fmt(RATE_EXAMPLE_POT)} at ${TYPICAL_EASY_ACCESS_PCT}% earns ${fmt(lowInterest)} a year. At ${EXAMPLE_RATE_PCT}% it earns ${fmt(highInterest)}, a difference of ${fmt(highInterest - lowInterest)}.` },
    },
    {
      id: "tax",
      title: "Some interest is tax-free",
      intro: beyondPsa
        ? `Allowances let you earn some interest tax-free each year. On your income, the first ${fmt(taxFree)} is tax-free.`
        : psa > 0
        ? `The Personal Savings Allowance lets you earn some interest tax-free each year. On your income, it's ${fmt(psa)}.`
        : "The Personal Savings Allowance lets many people earn some interest tax-free. On your income there's no allowance, so all of it is taxable.",
      scene: { id: "tax-scene", kind: "interestSteps", interest, exempt, taxable, tax, kept, received,
        labels: { interestCol: "Interest", exemptCol: "Tax-free", taxableCol: "Taxable", splitCol: "After tax", toUser: "To you", toTaxman: "To HMRC", receiveTitle: "You receive", taxTitle: "To HMRC", receiveWorking: taxable === 0 ? "" : exempt > 0 ? `${fmt(exempt)} + ${fmt(taxable)} − ${fmt(tax)}` : `${fmt(taxable)} − ${fmt(tax)}`,
          captionInterest: `Say ${fmt(TAX_EXAMPLE_POT)} in cash savings earns ${EXAMPLE_RATE_PCT}%: ${fmt(interest)} of interest in a year.`, captionExempt: taxable === 0 ? "All of it is within what's tax-free on your income." : exempt > 0 ? `The first ${fmt(exempt)} is tax-free, and goes to you.` : "None of it is tax-free.", captionTaxable: taxable > 0 ? `That leaves ${fmt(taxable)} taxable.` : "So none of it is taxable.", captionSplit: taxable > 0 ? `At ${rate}, ${fmt(tax)} goes to HMRC and ${fmt(kept)} to you.` : "Nothing goes to HMRC.", captionPayoff: `Where the ${fmt(interest)} of interest goes.` },
        ariaLabel: `${fmt(interest)} of interest. ${fmt(exempt)} is tax-free. Of the ${fmt(taxable)} taxable, ${fmt(tax)} goes to HMRC. You receive ${fmt(received)}.` },
    },
    {
      id: "isa",
      title: "A Cash ISA shields interest from tax",
      intro: `Interest inside a Cash ISA is tax-free. You can put in up to ${fmt(isaLimit)} a year across all your ISAs.`,
      scene: { id: "isa-scene", kind: "cashCompare", amount: isaLimit, interest: isaInterest, tax: isaTax, received: isaInterest - isaTax, saved: isaTax,
        labels: { inside: "Cash ISA", outside: "Outside an ISA", interestRow: "Interest", taxRow: "Tax", noTax: "No tax", receiveRow: "You receive", savedLabel: "Saved by holding it in the ISA",
          captionTwo: `The same ${fmt(isaLimit)}, held two ways.`, captionWrap: "A Cash ISA wraps around one, shielding it from tax.", captionEarn: `At ${EXAMPLE_RATE_PCT}%, both earn the same interest.`, captionTax: taxFree > 0 ? "Once your tax-free interest is used up, only the one outside the ISA has tax to pay." : "Only the one outside the ISA has tax to pay.", captionSaved: "That's the difference the shield makes." },
        ariaLabel: `${fmt(isaLimit)} earns ${fmt(isaInterest)} of interest. In a Cash ISA you receive all of it. Outside an ISA, ${fmt(isaTax)} goes in tax and you receive ${fmt(isaInterest - isaTax)}.` },
    },
    {
      id: "bonds",
      title: "Premium Bonds pay prizes, not interest",
      intro: `Premium Bonds are run by NS&I. You can hold up to ${fmt(PREMIUM_BONDS_LIMIT)}, and prizes are tax-free, but they aren't guaranteed.`,
      scene: { id: "bonds-scene", kind: "prizeDraws", amount: BONDS_HOLDING, total: prizeTotal, ratePct: bondsPct, rateText: bondsRate, draws: DRAW_MONTHS.map((label, i) => ({ label, prize: prizes[i] })),
        labels: { heldLabel: "Premium Bonds and prizes", sumLine: `+${fmt(prizeTotal)} in prizes`, rateLine: `About ${bondsRate} on ${fmt(BONDS_HOLDING)}`, averageLabel: "Average", lessLabel: "Won less", moreLabel: "Won more", bondsName: "Premium Bonds", savingsName: "Savings account", taxRow: "Tax", taxBonds: "Tax-free", taxSavings: "Can be taxed", paysRow: "What you get", paysBonds: "Prizes", paysSavings: "Interest", rateRow: "What rate", rateBonds: bondsRate, rateBondsNote: "on average, not guaranteed", rateSavings: `${EXAMPLE_RATE_PCT}%`, rateSavingsNote: "stated interest rate",
          captionDraws: "Instead of interest, each bond enters a monthly draw.", captionSum: `Over this year, the prizes add up to ${fmt(prizeTotal)}.`, captionRate: `On ${fmt(BONDS_HOLDING)}, that's about the ${bondsRate} prize fund rate.`, captionAverage: "That's an average. Some people win a lot more, and some a lot less.", captionLuck: "Your own return depends on luck.", captionTax: "Tax-free can be valuable on high cash balances, where interest could otherwise be taxed.", captionGuarantee: "But prizes aren't guaranteed, while a savings account pays its stated interest." },
        ariaLabel: `${fmt(BONDS_HOLDING)} of Premium Bonds wins ${fmt(prizeTotal)} of prizes over twelve monthly draws, about the ${bondsRate} prize fund rate. That rate is an average: some people win much more, and some much less. Prizes are tax-free but aren't guaranteed.` },
    },
    {
      id: "emergency",
      title: "An emergency fund is measured in months",
      intro: "An emergency fund is money set aside for a rainy day: a broken boiler, a car repair, or time out of work. How many months it covers depends on your life.",
      scene: { id: "emergency-scene", kind: "monthsStack", monthly: EXAMPLE_MONTHLY_COSTS,
        markers: [3, 6, 9].map(months => ({ months, amount: EXAMPLE_MONTHLY_COSTS * months, label: `${months} months`, hint: EMERGENCY_MONTHS_HINT[months] })),
        labels: {
          captionBlock: `Say your costs are ${fmt(EXAMPLE_MONTHLY_COSTS)} a month. Each block is one month.`, captionThree: "A secure income can mean fewer months.", captionSix: "Six months is a common target.", captionNine: "An income that varies can call for more.", captionAccess: "Easy-access money can be withdrawn any time. Fixed and notice accounts limit when you can." },
        ariaLabel: `At ${fmt(EXAMPLE_MONTHLY_COSTS)} a month, three months of costs is ${fmt(EXAMPLE_MONTHLY_COSTS * 3)}, six is ${fmt(EXAMPLE_MONTHLY_COSTS * 6)} and nine is ${fmt(EXAMPLE_MONTHLY_COSTS * 9)}.` },
    },
    {
      id: "yours",
      title: "Now, your own figures",
      intro: "Those are the rules. Next, what they mean for your own savings.",
      scene: { id: "yours-scene", kind: "bars",
        bars: [{ label: "ISA allowance", used: ISA_ALLOWANCE - isaLeft, limit: ISA_ALLOWANCE, unused: isaLeft, usedShort: short(ISA_ALLOWANCE - isaLeft) }, { label: allowanceName, used: interestUsed, limit: taxFree, unused: taxFree - interestUsed, usedShort: short(interestUsed) }],
        labels: { unusedLabel: "Unused", captionUsed: "What's gone into ISAs this tax year, and how much of your tax-free interest your savings use.", captionLeft: "And this is what's still unused. Your answer shows what that could mean for you." },
        ariaLabel: `You've used ${fmt(ISA_ALLOWANCE - isaLeft)} of your ISA allowance, with ${fmt(isaLeft)} unused. Your savings earn about ${fmt(yearlyInterest)} of interest a year, and ${fmt(taxFree)} a year is tax-free on your income.` },
    },
  ].map(({ id, title, intro, scene }) => ({ id, title, blocks: [{ ...scene, intro, gap: 0, fill: true }] }));
}

export const MODULE_EXPLAINERS = { investments: investmentsExplainer, cash: cashExplainer };
