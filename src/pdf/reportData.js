import { MODULE_META, getModuleSummary } from "../lib/moduleStatus.js";
import { fmt } from "../lib/format.js";
import { G, GOLD, SUCCESS, CRITICAL, CASH_BLUE, STUDENT_PURPLE, PENSION_RAS } from "../design-tokens.js";

// Turns a brand token into its own pale tint at low alpha — same "solid hue
// as text colour, faint tint of the same hue as fill" convention the rest
// of the app uses (e.g. the module tile's `${statusColor}1f` background).
function paleTint(hex, alpha = 0.12) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Restrained, low-saturation tint per module — pale fills with a darker on-tint text
// colour. Reuses the same per-category colours FORECAST_COLORS already assigns
// where a module has a direct forecast-tab counterpart (cash/investments/pension/
// studentLoan/mortgage all do); personalLoan and kids don't, so they get the two
// remaining named brand hues not already spoken for elsewhere. Previously this was
// its own independently-chosen hex palette with no link back to the app's tokens.
const MODULE_TINTS = {
  cash:         { bg: paleTint(CASH_BLUE),      fg: CASH_BLUE },
  investments:  { bg: paleTint(GOLD),           fg: GOLD },
  pension:      { bg: paleTint(SUCCESS),        fg: SUCCESS },
  studentLoan:  { bg: paleTint(STUDENT_PURPLE), fg: STUDENT_PURPLE },
  mortgage:     { bg: paleTint(CRITICAL),       fg: CRITICAL },
  personalLoan: { bg: paleTint(PENSION_RAS),    fg: PENSION_RAS },
  kids:         { bg: paleTint(G),              fg: G },
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

// scoreBand itself now lives in design-tokens.js (the one dependency-free,
// framework-agnostic home both this file and CandidApp.jsx can import from
// without pulling in the other's runtime deps) — re-exported here so
// ReportPdf.jsx's existing `import { scoreBand } from "./reportData.js"`
// keeps working. This used to be its own separate 4-band function with
// different score thresholds (86/66/41 vs the app's 80/65/50/35) — the same
// score could show a different band and colour in the PDF than in the live
// app. Now there's exactly one definition.
export { scoreBand } from "../design-tokens.js";
