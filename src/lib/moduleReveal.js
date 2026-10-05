// A module's answer in three steps, shown the first time its walk-through is
// finished (and again on request): the answer, why, and what the user could
// do. Worked out from the same figures the module's own screen shows, so the
// two always agree. Phrased as information, not instruction: Candid is
// guidance, not advice. Pure, unit tested in moduleReveal.test.js.
//
// Pilot: Pension only. A step is { label, figure?, title, body? }.

import { fmt } from "./format.js";
import { isPensionContributing, calcAnnualAllowanceRoom, calcPensionTaperSaving, calcBonusSacrificePotential } from "./pension.js";

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
  if (!isPensionContributing(d)) {
    const relief = Math.round(m.salary * 0.05 * m.tr);
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
      body: "Projection assumes 6% growth a year, in today's money." },
    bonus.standalone > 0
      ? { label: ACTION, title: `Paying your ${fmt(+d.bonusAmount)} bonus into your pension could save up to ${fmt(bonus.standalone)} in tax.`, body: "It has to be arranged with HR or payroll before the bonus is paid." }
      : { label: ACTION, title: "Nothing to change right now.", body: "Worth checking again when your pay or job changes." },
  ];
}

// The modules with a reveal (the pilot: Pension).
export const MODULE_REVEALS = { pension: pensionReveal };
