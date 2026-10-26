import { taxYearOf } from "./taxYear.js";

// An opportunity the user has answered for themselves: "done" (they've made
// the change) or "notForMe" (they've set it aside). Either way it stops
// counting as something to act on, for the tax year it was chosen in; on
// 6 April it's back, since a new year brings a new bonus and a fresh look
// at retirement income. `d.opportunityChoices`: { [id]: { choice, taxYear,
// perYear?, on? } }, perYear/on being what "done" banked (moduleStatus.js
// bankChange), so taking it back can unbank it.
// The ids in use: pension's bonus sacrifice and its retirement income gap.
export const CHOICE_IDS = { bonus: "pension.bonus", retirementGap: "pension.retirementGap" };

export function choiceFor(d, id, now = new Date()) {
  const c = (d.opportunityChoices || {})[id];
  return c && c.taxYear === taxYearOf(now) ? c : null;
}

export function withChoice(d, id, choice, extra = {}, now = new Date()) {
  return { ...(d.opportunityChoices || {}), [id]: { choice, taxYear: taxYearOf(now), ...extra } };
}

export function withoutChoice(d, id) {
  const { [id]: _gone, ...rest } = d.opportunityChoices || {};
  return rest;
}
