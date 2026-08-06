import { MODULE_META, getModuleSummary, fmt } from "../CandidApp.jsx";

// Restrained, low-saturation tint per module — pale fills with a darker on-tint text
// colour, all mixed from the brand palette rather than arbitrary hues.
const MODULE_TINTS = {
  cash:         { bg: "#EAF3EE", fg: "#1F5E42" },
  investments:  { bg: "#F7EFDC", fg: "#8A6A1D" },
  pension:      { bg: "#E7F0E9", fg: "#1B4332" },
  studentLoan:  { bg: "#FBEAE7", fg: "#B54A38" },
  mortgage:     { bg: "#E8EEF3", fg: "#355070" },
  personalLoan: { bg: "#FBEFE3", fg: "#8C5A2B" },
  kids:         { bg: "#EFEAF5", fg: "#5B4B8A" },
};

// Modules whose "status" reflects a genuine live recommendation for this user (an
// all-clear "ok" status means nothing to act on, so it gets no card) with a real
// £ figure attached (see the `amount` field added in computeModuleStatuses — never
// the sort-priority `impact`, which can include non-monetary sentinels).
const LIVE_STATUSES = new Set(["critical", "attention"]);

// Builds the module cards + hero total for the PDF report from already-computed
// app state. Pure and framework-agnostic — no JSX, so it's usable from a Node
// script or a future serverless function without pulling in react-pdf here.
export function buildReportCards(d, m, statuses, insights) {
  const cards = MODULE_META
    .map(mm => getModuleSummary(mm, d, m, statuses, insights))
    .filter(mm => LIVE_STATUSES.has(mm.status) && mm.amount > 0)
    // /yr figures first (ranked by size), lump-sum figures (different unit, not
    // part of the /yr hero total) after — otherwise a large one-off projection like
    // the kids' JISA figure would misleadingly outrank real annual savings.
    .sort((a, b) => (!!a.amountIsLumpSum - !!b.amountIsLumpSum) || (b.amount - a.amount))
    .map(mm => ({
      key: mm.key,
      title: mm.title,
      summary: mm.summary,
      amount: mm.amount,
      amountIsLumpSum: mm.amountIsLumpSum,
      amountLabel: mm.amountIsLumpSum ? `${fmt(mm.amount)} by 18` : `${fmt(mm.amount)}/yr`,
      tint: MODULE_TINTS[mm.key] || { bg: "#EFEFEF", fg: "#444444" },
    }));

  // Lump-sum figures (kids' JISA projection) use a different unit than the annual
  // savings the other cards show — summing them together would misrepresent both.
  const totalOpportunity = cards
    .filter(c => !c.amountIsLumpSum)
    .reduce((sum, c) => sum + c.amount, 0);

  return { cards, totalOpportunity };
}

export function scoreBand(score) {
  if (score >= 86) return { color: "#162f24", label: "Optimised" };
  if (score >= 66) return { color: "#2d6b4a", label: "On track" };
  if (score >= 41) return { color: "#c4963a", label: "Room to improve" };
  return { color: "#c0392b", label: "Needs attention" };
}
