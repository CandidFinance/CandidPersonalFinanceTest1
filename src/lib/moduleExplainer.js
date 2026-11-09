import { fmt } from "./format.js";
import { CGT_ANNUAL_ALLOWANCE, ISA_ALLOWANCE } from "./tax.js";

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
          captionPaid: `The ${money(SHARE_START)} you put in isn't a gain, so there's no tax on it.`, captionGain: `The ${money(shareGain)} rise is your gain.`, captionPull: "When you sell, tax is due on the gain.", captionSplit: `At ${rate}, ${money(shareTax)} goes in tax.`, captionEnd: `You keep ${money(shareKeep)} of the ${money(shareGain)} gain.`, footnote: "Before the yearly allowance, coming up." },
        ariaLabel: `Of ${money(SHARE_END)}, the ${money(SHARE_START)} you paid has no tax. The ${money(shareGain)} gain is taxable at ${rate}: ${money(shareKeep)} you keep and ${money(shareTax)} tax.` },
    },
    {
      id: "isa",
      title: "An ISA is a tax-free shield",
      intro: `An ISA is a wrapper that shields the gains and dividends on what you hold inside it from tax. UK residents aged 18 or over can put in up to ${fmt(ISA_ALLOWANCE)} a year across all their ISAs.`,
      scene: { id: "isa-scene", kind: "compare", start: SHARE_START, end: SHARE_END, tax: shareTax, received: shareReceived, exampleSaved: fullIsaSaved, used: isaUsed, limit: ISA_ALLOWANCE,
        labels: { inside: "ISA", outside: "Outside an ISA", oneShare: "One share", sold: "SOLD", soldFor: "Sold for", taxRow: "Tax", noTax: "No tax", receiveRow: "You receive", saved: "Saved by utilising your ISA", exampleLine: `A full ${fmt(ISA_ALLOWANCE)} ISA, with the same 10% gain`, exampleSaved: "Saved", usedLabel: "ISA allowance used", ofLabel: "of",
          captionTwo: "The same share, held two ways.", captionWrap: "An ISA wraps around one, shielding it from tax.", captionGrow: "Both grow by the same amount.", captionSell: "Now both are sold.", captionReceive: "Only the one outside the ISA has tax to pay.", captionSaved: "That's the difference the shield makes.", captionExample: "The same gain, at a larger size.", captionUsed: isaLeft > 0 ? `You have ${fmt(isaLeft)} left this tax year.` : "You've used all of it this tax year.", footnote: `Assumes your ${fmt(CGT_ANNUAL_ALLOWANCE)} capital gains allowance is already used.` },
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

export const MODULE_EXPLAINERS = { investments: investmentsExplainer };
