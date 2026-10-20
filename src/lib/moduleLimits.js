// What a module's answer doesn't take into account yet, for this person: one
// line under the answer (MobileModuleReveal) and at the foot of the module's
// page (GuidanceFooter), so an answer is never read as covering more than it
// does. Up to three, the most relevant to them first; null for a module
// without one. Pure, unit tested in moduleLimits.test.js.

import { nationOf, kidsSituation } from "./childcare.js";

const MAX = 3;
// Share awards (RSUs, options, SAYE) mostly come with higher-paid jobs.
const SHARE_AWARDS_FROM = 75000;

function line(items) {
  const xs = items.filter(Boolean).slice(0, MAX);
  if (!xs.length) return null;
  const body = xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
  return `Not included yet: ${body}.`;
}

const employed = d => d.employmentStatus === "employed";
const selfEmployed = d => d.employmentStatus === "self_employed";
const highPaid = (d, m) => employed(d) && Math.max(m.salary || 0, m.adjustedNetIncome || 0) >= SHARE_AWARDS_FROM;
const LOWER_PAY = "pay that's lower for a while (parental leave or part-time)";
const UNEVEN = "earnings that change from year to year";

const LIMITS = {
  pension: (d, m) => [
    d.pensionKind === "db" && "your scheme's own rules (such as reductions for retiring early)",
    highPaid(d, m) && "share awards from work",
    employed(d) && !m.noEarnings && LOWER_PAY,
    selfEmployed(d) && UNEVEN,
    "a partner's pension",
  ],
  cash: () => [
    "Sharia-compliant accounts",
    "savings in a partner's name",
  ],
  investments: (d, m) => [
    highPaid(d, m) && "share awards from work",
    "crypto",
    "Sharia-compliant funds",
    "investments in a partner's name",
  ],
  // No children, and none planned: nothing to qualify.
  kids: d => kidsSituation(d) === "no" ? [] : [
    "the extra help for disabled children",
    nationOf(d) === "ni" && "Northern Ireland's Childcare Subsidy",
    "Junior ISAs",
  ],
  taxTrap: (d, m) => [
    "Gift Aid you already give",
    highPaid(d, m) && "share awards from work",
    "a partner's income (Kids & family has it, for childcare)",
  ],
  studentLoan: d => [
    d.studentLoan === "postgrad" ? "an undergraduate loan repaid alongside this one" : d.studentLoan === "plan4" ? "a Postgraduate loan repaid alongside this one" : null,
    employed(d) && LOWER_PAY,
    selfEmployed(d) && UNEVEN,
  ],
};

export function moduleLimits(key, d, m) {
  return LIMITS[key] ? line(LIMITS[key](d, m)) : null;
}
