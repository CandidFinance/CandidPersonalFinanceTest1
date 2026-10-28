// Childcare support for working parents, and what crossing £100,000 costs.
// The Kids & family module's figures. Pure, unit tested in childcare.test.js.
//
// Rules (checked 19 October 2026):
//  - Tax-Free Childcare, UK-wide (gov.uk/tax-free-childcare): £2 for every
//    £8 paid in, so 20% of the bill, up to £2,000 a child a year, for
//    children 11 or under. Not available if either parent's adjusted net
//    income is over £100,000, or a parent isn't working.
//  - Funded hours, which differ by nation:
//    England (gov.uk/check-eligible-free-childcare-if-youre-working): 30
//      hours a week for 38 weeks, from 9 months until school, for working
//      parents; the same £100,000 test, on adjusted net income, so a pension
//      payment that brings income to £100,000 restores it.
//    Wales (the Childcare Offer): 30 hours for 3 and 4 year olds, tested on
//      each parent's GROSS income, pension contributions and salary
//      sacrifice included, so a pension payment doesn't restore it. Not
//      counted in the figures; the answer says so.
//    Scotland (mygov.scot): 1,140 hours a year for 3 to 5 year olds, with no
//      income test, so nothing is at stake.
//    Northern Ireland: no funded hours; a 15% Childcare Subsidy for families
//      getting Tax-Free Childcare (education-ni.gov.uk). Its cap isn't
//      clearly published, so it isn't counted (moduleLimits says so).
//  - What the English hours are worth: 1,140 hours at £7.27 an hour, the
//    average of Coram's 2026 survey prices for a 25-hour week in England
//    (under 2s £188.75, 2 year olds £174.85). The real figure varies by area
//    and nursery.

import { calcAnnualAllowanceRoomBeforeTopUps } from "./pension.js";

export const CHILDCARE_INCOME_LIMIT = 100000;
export const TFC_RATE = 0.2;
export const TFC_CAP_PER_CHILD = 2000;
export const ENGLAND_FUNDED_HOURS = 30 * 38;
export const CHILDCARE_HOURLY_PRICE = 7.27;
export const FUNDED_HOURS_VALUE = Math.round(ENGLAND_FUNDED_HOURS * CHILDCARE_HOURLY_PRICE / 10) * 10;
// Within this of £100,000, a pay rise or bonus could cross it.
export const NEAR_LIMIT = 10000;
export const NATIONS = ["england", "wales", "scotland", "ni"];

const filled = v => v !== "" && v !== null && v !== undefined && !isNaN(+v);

// Where they live: the answer to "Where in the UK do you live?", or Scotland
// from the older "Do you live in Scotland?". Null when not known.
export function nationOf(d) {
  if (NATIONS.includes(d.ukNation)) return d.ukNation;
  return d.scottishTaxpayer === "yes" ? "scotland" : null;
}

// Children, or planning them in the next year or two: Kids & family's first
// question ("yes", "planning" or "no"). Anyone who answered before it was
// asked, with children's ages given, has children.
export function kidsSituation(d) {
  if (["yes", "planning", "no"].includes(d.kidsStatus)) return d.kidsStatus;
  return (+d.kidsPreschool || 0) + (+d.kidsSchool || 0) > 0 ? "yes" : null;
}

// A partner's pension payment can bring their income back to £100,000 within
// the standard £60,000 Annual Allowance; their own contributions aren't
// known, so it's the standard allowance.
export const PARTNER_PENSION_ALLOWANCE = 60000;

// What childcare support is worth as pay: the pay before tax it would take
// to bring home the same, at the marginal rate of whoever's income is over
// £100,000 (60% to £125,140, 67.5% in Scotland, then 45% or 48%), with 2%
// National Insurance. Rounded to £10.
export function payEquivalent(amount, income, scottish = false) {
  const tax = income > 125140 ? (scottish ? 0.48 : 0.45) : income > CHILDCARE_INCOME_LIMIT ? (scottish ? 0.675 : 0.60) : (scottish ? 0.42 : 0.40);
  return Math.round(amount / (1 - tax - 0.02) / 10) * 10;
}

// Null without children 11 or under (or one on the way), or when they've no
// children and aren't planning any. Otherwise:
//  planning: no children yet; counted as one baby, with no bill.
//  state: "notWorking" (Tax-Free Childcare needs work), "partner" (their
//    partner's income is over £100,000, theirs perhaps too), "lost" (their
//    own income is over £100,000), "near" (within £10,000 of it) or "fine".
//  tfc / hours: Tax-Free Childcare and funded hours, £ a year; atStake the
//    two together. hours is England's only.
//  payInNeeded: their own income over £100,000; partnerPayIn their
//    partner's, when they've said what it is.
//  recoverable: a pension payment brings every income over £100,000 back to
//    it: theirs within this year's Annual Allowance, their partner's within
//    the standard one (PARTNER_PENSION_ALLOWANCE).
//  payValue: atStake as pay before tax, for whoever is over £100,000.
//  unclaimed: eligible, paying for childcare, and not using Tax-Free
//    Childcare: what it would add.
export function childcareSupport(d, m) {
  const situation = kidsSituation(d);
  if (situation !== "yes" && situation !== "planning") return null;
  const planning = situation === "planning";
  // The ages can't add up to more children than they have.
  const total = +d.kidsCount > 0 ? Math.round(+d.kidsCount) : Infinity;
  const preschool = planning ? 1 : Math.min(total, Math.max(0, Math.round(+d.kidsPreschool || 0)));
  const school = planning ? 0 : Math.min(total - preschool, Math.max(0, Math.round(+d.kidsSchool || 0)));
  const children = preschool + school;
  if (!children) return null;
  const nation = nationOf(d) || "england";
  const billKnown = !planning && filled(d.childcareMonthly);
  // Not sure of the bill: a preschool child in full-time nursery costs well
  // over the £10,000 the cap needs, so each counts at the cap; school-age
  // children (clubs and holidays) aren't counted.
  const tfc = Math.round(billKnown
    ? Math.min(TFC_RATE * +d.childcareMonthly * 12, TFC_CAP_PER_CHILD * children)
    : TFC_CAP_PER_CHILD * preschool);
  const hours = nation === "england" ? preschool * FUNDED_HOURS_VALUE : 0;
  const ani = m.adjustedNetIncome || 0;
  const over = ani > CHILDCARE_INCOME_LIMIT;
  const state = m.noEarnings ? "notWorking"
    : d.partnerOver100k === "yes" ? "partner"
    : over ? "lost"
    : ani > CHILDCARE_INCOME_LIMIT - NEAR_LIMIT ? "near"
    : "fine";
  const payInNeeded = over ? Math.ceil(ani - CHILDCARE_INCOME_LIMIT) : 0;
  const ownFits = !over || payInNeeded <= calcAnnualAllowanceRoomBeforeTopUps(d, m).room - (m.topUpsTotal || 0);
  const partnerIncome = state === "partner" && +d.partnerIncome > CHILDCARE_INCOME_LIMIT ? +d.partnerIncome : null;
  const partnerPayIn = partnerIncome ? Math.ceil(partnerIncome - CHILDCARE_INCOME_LIMIT) : null;
  const recoverable = state === "lost" ? ownFits
    : state === "partner" ? partnerPayIn != null && partnerPayIn <= PARTNER_PENSION_ALLOWANCE && ownFits
    : false;
  const eligible = state === "fine" || state === "near";
  const atStake = tfc + hours;
  return {
    nation, planning, preschool, school, children, billKnown,
    tfc, hours, atStake,
    state, ani, payInNeeded, partnerIncome, partnerPayIn, recoverable,
    payValue: payEquivalent(atStake, state === "partner" ? (partnerIncome ?? CHILDCARE_INCOME_LIMIT + 1) : ani, !!m.scottish),
    headroom: eligible ? Math.round(CHILDCARE_INCOME_LIMIT - ani) : 0,
    unclaimed: eligible && d.tfcClaiming === "no" && billKnown ? tfc : 0,
  };
}
