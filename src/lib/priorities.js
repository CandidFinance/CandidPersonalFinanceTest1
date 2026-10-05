// "What to do first", worked out by the code rather than an AI report: the
// modules with money to act on, largest £ a year first, each with its own
// one-line summary. Plus the line under the score, and the modules that are
// on track. Pure, unit tested in priorities.test.js. Plan:
// score-without-ai-plan.md.

import { fmt } from "./format.js";
import { getModuleBreakdown } from "./moduleStatus.js";

export const MAX_PRIORITIES = 4;

export function whatToDoFirst(d, m, statuses, max = MAX_PRIORITIES) {
  return getModuleBreakdown(d, m, statuses, null, "amount").modulesWithRec.slice(0, max).map(mm => ({
    key: mm.key, title: mm.title, amount: mm.amount, amountIsLumpSum: mm.amountIsLumpSum, line: mm.summary,
  }));
}

// The line under the score: the biggest win, or that everything answered is
// on track.
export function scoreHeadline(priorities) {
  const top = priorities[0];
  if (!top) return "You're on track across the modules you've answered.";
  return `Your biggest win: ${top.title}, ${fmt(top.amount)}${top.amountIsLumpSum ? " by 18" : " a year"}.`;
}

// Answered modules with nothing to act on.
export function onTrackModules(d, m, statuses) {
  return getModuleBreakdown(d, m, statuses, null, "amount").moduleList
    .filter(mm => mm.status === "ok" && !(mm.amount > 0))
    .map(mm => mm.title);
}
