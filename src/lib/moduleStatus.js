import { PoundSterling, TrendingUp, Landmark, GraduationCap, Home, CreditCard, Baby } from "lucide-react";
import { fmt } from "./format.js";
import { calcCashOptimisation } from "./cash.js";
import { cashOpportunity } from "./assist.js";
import { isPensionContributing, calcPensionTaperSaving, calcAnnualAllowanceRoom, calcBonusSacrificePotential } from "./pension.js";
import { calcStudentLoanScenario } from "./studentLoan.js";

export const MODULE_META = [
  { key:"cash",        icon:PoundSterling, title:"Cash & savings"  },
  { key:"investments", icon:TrendingUp,    title:"Investments"     },
  { key:"pension",     icon:Landmark,      title:"Pension"         },
  { key:"studentLoan", icon:GraduationCap, title:"Student loan"    },
  { key:"mortgage",    icon:Home,          title:"Mortgage"        },
  { key:"personalLoan",icon:CreditCard,    title:"Personal loan"   },
  { key:"kids",        icon:Baby,          title:"Kids & family"   },
];

// ── Dashboard module tiles — category pill + short context, keyed to MODULE_META ──
// "Today" = act now for an immediate saving; "Future opportunity" = value that builds
// over a longer horizon (growth, compounding, tax-free wrappers).
export const MODULE_TAG = {
  cash:         { label:"Today",             color:"#c4963a" },
  investments:  { label:"Future opportunity", color:"#2d6b4a" },
  pension:      { label:"Future opportunity", color:"#2d6b4a" },
  studentLoan:  { label:"Today",             color:"#c4963a" },
  mortgage:     { label:"Today",             color:"#c4963a" },
  personalLoan: { label:"Today",             color:"#c4963a" },
  kids:         { label:"Future opportunity", color:"#2d6b4a" },
};

// ── MVP scope ──────────────────────────────────────────────────────────────
// Candid's active MVP surface is Savings, Investments, Pensions & Student
// Loans. Mortgages, Personal Loans and Children remain fully built — onboarding
// fields, calcMetrics/computeModuleStatuses logic, module deep-dive pages, dev
// presets — nothing below is deleted. HIDE_MVP_MODULES just makes them read as
// "not applicable" everywhere `d` is consumed (Dashboard, the AI prompt, the
// PDF report, Supabase writes, module routing) without mutating or overwriting
// any data a user already has stored locally from before this narrowing.
// To re-enable a module: flip this back to false — onboarding fields, dashboard
// tiles and routing all reappear at once, no other code changes needed.
export const HIDE_MVP_MODULES = true;
export const HIDDEN_MVP_MODULE_KEYS = ["mortgage", "personalLoan", "kids"];

export function sanitizeForMvp(d) {
  if (!HIDE_MVP_MODULES) return d;
  return { ...d, hasMortgage: "no", ownsOutright: false, hasPersonalLoan: "no", hasKids: "no" };
}

// ── Local module status computation ──────────────────────────────────────────
// Computes status + £ impact for all 8 modules from user data alone.
// AI response takes precedence for narrative summary; this drives sorting + visibility.
// marketRates: same shape/contract as calcMetrics — resolved once by the caller.
export function computeModuleStatuses(d, m, marketRates = {}) {
  const { isaRate = 5, nonIsaRate = 4.5 } = marketRates;
  const daysToTaxEnd = (() => {
    const now = new Date(), taxEnd = new Date(now.getFullYear(), 3, 5);
    if (taxEnd < now) taxEnd.setFullYear(taxEnd.getFullYear() + 1);
    return Math.ceil((taxEnd - now) / (1000*60*60*24));
  })();
  const isaUrgencyBoost = daysToTaxEnd < 30 ? 3 : daysToTaxEnd < 90 ? 1.5 : 1;

  const s = {};

  // Cash — access type + emergency buffer + the ISA→PSA→Premium Bonds waterfall
  // (calcCashOptimisation), the same calculation the Cash & Savings module's
  // "Optimise your cash" win uses — so the Dashboard shows the identical £/yr figure
  // rather than a cruder approximation. This also supersedes the old separate
  // Premium-Bonds-only calc: the optimiser already reallocates cash + bonds together.
  // With the rates loaded, the figure is Candid Assist's (cashOpportunity):
  // after tax, the best choice in each section, so Home, the Cash screen and
  // Assist always agree. Before then, the waterfall's estimate.
  const cashOpt = calcCashOptimisation(m, isaRate, nonIsaRate, marketRates.rows);
  const cashOpp = cashOpportunity(d, m, marketRates.rows);
  const cashImpact = Math.max(0, Math.round(cashOpp ? cashOpp.gain : cashOpt.optimisationGain));
  // Approaching-deadline urgency is a sort-priority-only nudge, kept separate from
  // the £/yr figures shown to the user (see pension's +99999 sentinel below for the
  // same pattern).
  const cashSortPriority = cashImpact + Math.round(m.isaHeadroom * (isaRate / 100) * (isaUrgencyBoost - 1));
  const tooMuchCash = m.emergencyBuffer > 0 && m.emergencyFund > m.emergencyBuffer * 2;
  // Emergency fund: any shortfall against the chosen buffer needs attention;
  // less than one month of essential costs covered is critical.
  const emergencyShort = m.emergencyShortfall > 0;
  const emergencyCritical = m.expenses > 0 && m.emergencyFund < m.expenses;
  const accessType = d.cashAccessType || "partial";
  const accessOk = m.emergencyFund >= m.emergencyBuffer;
  // Emergency access warnings — only critical when truly no cash at all
  let accessLabel = null;
  if (accessType === "no" && accessOk) {
    accessLabel = `Your savings aren't instant access. Keep ${m.bufferMonths} months' spending where you can reach it quickly`;
  } else if (accessType === "partial") {
    accessLabel = accessOk ? "Some of your savings may not be reachable quickly" : null;
  }

  let cashImpactLabel;
  if (tooMuchCash) {
    // emergencyExcess is a principal (the £ sitting above the buffer), not a £/yr
    // figure — never label it "/yr" or use it as the amount. The actual annual
    // benefit is the same optimisation-gain figure used below, just called out
    // alongside the excess for context.
    cashImpactLabel = cashImpact > 0
      ? `${fmt(cashImpact)}/yr more your savings could earn, with ${fmt(Math.round(m.emergencyExcess))} more than your emergency fund needs`
      : `${fmt(Math.round(m.emergencyExcess))} more than your emergency fund needs, earning less than it could`;
  } else if (emergencyShort) {
    cashImpactLabel = `${fmt(Math.round(m.emergencyShortfall))} short of your ${m.bufferMonths}-month emergency fund`;
  } else if (cashImpact > 0) {
    // The £ figure's own explanation comes first, since that's the figure
    // shown beside it (cash's `amount`); an access concern follows it.
    cashImpactLabel = `${fmt(cashImpact)}/yr more your savings could earn${accessLabel ? `. ${accessLabel}` : ""}`;
  } else if (accessLabel) {
    cashImpactLabel = accessLabel;
  } else {
    cashImpactLabel = null;
  }
  // amount: a clean, always-£/yr figure for consumers (e.g. the PDF report) that need a
  // real monetary saving rather than `impact` (a sort-priority score — see pension below,
  // where impact includes a +99999 sentinel that must never be summed or displayed).
  // Note: tooMuchCash intentionally falls through to cashImpact here too — emergencyExcess
  // is a principal, not an annual figure, and must never be used as the £/yr amount.
  const cashAmount = cashImpact > 0 ? cashImpact : 0; // accessLabel-only attention has no £ figure
  s.cash = {
    status: tooMuchCash || cashImpact > 800 || emergencyCritical ? "critical"
          : cashImpact > 200 || emergencyShort ? "attention" : "ok",
    impact: cashSortPriority,
    impactLabel: cashImpactLabel,
    amount: cashAmount,
  };

  // Investments — CGT saving is a real, guaranteed, this-tax-year £/yr figure.
  // ISA headroom is not a gain — it's unused capacity that only becomes a gain if
  // invested and if it grows — so unlike Cash/Pension/Student loan, it's excluded
  // from `amount` (the £ figure shown to the user) entirely. It still feeds `impact`
  // (sort priority only, weighted by the same tax-year-end urgency multiplier as
  // Cash's cashSortPriority) and status/impactLabel, so a large unused allowance
  // still surfaces on the dashboard even with no CGT saving to report.
  // Unused allowance only counts as a gap when there's money that could fill it
  // before 5 April: investments held outside an ISA, cash above the emergency
  // buffer, or spare monthly income once any buffer shortfall is topped up.
  // (The shortfall is only known when Cash & savings was picked — otherwise
  // spare income is taken at face value.)
  const cashSelected = (d.selectedModules || []).includes("cash");
  const spareIncomeToTaxEnd = Math.max(0, m.monthlySurplus * (daysToTaxEnd / 30.44) - (cashSelected ? m.emergencyShortfall : 0));
  const unwrappedInvestments = d.hasInvestments === "yes" ? (+d.unwrappedValue||0) : 0;
  const isaFillable = Math.min(m.isaHeadroom, unwrappedInvestments + m.emergencyExcess + spareIncomeToTaxEnd);
  const isaGap = isaFillable > 2000;
  const isaSortWeight = Math.round(isaFillable * 0.07 * m.tr * isaUrgencyBoost);
  s.investments = {
    status: (isaFillable > 10000 && daysToTaxEnd < 60) ? "critical"
          : isaGap || m.cgtSaving > 0 ? "attention" : "ok",
    impact: isaSortWeight + m.cgtSaving,
    impactLabel: m.cgtSaving > 0 && isaGap
      ? `${fmt(m.cgtSaving)} less capital gains tax, and ${fmt(m.isaHeadroom)} of this year's ISA allowance unused`
      : m.cgtSaving > 0
        ? `${fmt(m.cgtSaving)} less capital gains tax available`
        : isaGap
          ? `${fmt(m.isaHeadroom)} of this year's ISA allowance unused`
          : null,
    amount: m.cgtSaving > 0 ? m.cgtSaving : 0,
  };

  // Pension — missed match + contribution check + Personal Allowance taper are
  // DEFINITIVE (based on current, confirmed salary/contributions, via
  // calcPensionTaperSaving, the same shared taper calc the module's own
  // opportunity strip uses). Bonus sacrifice saving is POTENTIAL upside — it
  // depends on actually receiving the stated bonus, which may not have landed
  // yet — so it's kept out of `amount` (mirrors Investments excluding ISA
  // headroom from its definitive total) and exposed separately as
  // `potentialAmount` for the module's own "+ up to £X" signal.
  // Both the taper recovery and the bonus figure are limited to the Annual
  // Allowance room left (calcAnnualAllowanceRoom) — contributing past it just
  // triggers an allowance charge, which is what very high earners on a
  // tapered allowance would otherwise have been nudged towards.
  const contributing = isPensionContributing(d);
  const aaRoom = calcAnnualAllowanceRoom(d, m);
  const pensionTaper = calcPensionTaperSaving(m, aaRoom.room);
  const pensionTaperAmount = pensionTaper.recoverable ? pensionTaper.taperTotalSaving : 0;
  const bonusSacrifice = calcBonusSacrificePotential(d, m);
  // "Not contributing" and "missed employer match" are mutually exclusive (the
  // latter only applies once you're contributing) — taper is an independent
  // opportunity that can stack on top of either.
  const pensionPrimaryAmount = !contributing ? Math.round(m.salary * 0.05 * m.tr) : m.missedMatch;
  const pensionAmount = Math.round(pensionPrimaryAmount + pensionTaperAmount); // definitive only
  const pensionPotentialAmount = Math.round(bonusSacrifice.beyondTaper); // potential — not in amount
  // Sort priority still weighs the potential upside too, so a large bonus-sacrifice
  // opportunity isn't buried in the module ordering just because it's not "definitive".
  const pensionImpact = (!contributing ? pensionAmount + 99999 : pensionAmount) + pensionPotentialAmount;
  const pensionLabelParts = [
    !contributing
      ? `No pension: ${fmt(pensionPrimaryAmount)}/yr of tax relief missed`
      : m.missedMatch > 0 ? `${fmt(m.missedMatch)}/yr of employer match unclaimed` : null,
    pensionTaperAmount > 0 ? `${fmt(pensionTaperAmount)}/yr of tax-free allowance you could win back` : null,
    pensionPotentialAmount > 0 ? `up to ${fmt(pensionPotentialAmount)} saved by paying your bonus into your pension` : null,
    aaRoom.excess > 0 ? `Payments in may go over your reduced ${fmt(aaRoom.approxAA)} pension annual allowance` : null,
  ].filter(Boolean);

  s.pension = m.pensionStatus === "unknown" ? {
    // User told us they don't know their pension situation — neutral/informational,
    // not a scored "missed opportunity"
    status: "unknown",
    impact: 0,
    impactLabel: null,
    amount: 0,
    potentialAmount: 0,
  } : {
    // "critical" when genuinely missing match or not contributing at all;
    // "attention" only when there's still something to act on; otherwise "ok".
    status: !contributing ? "critical" : m.missedMatch > 0 ? "critical"
          : pensionTaperAmount > 0 || pensionPotentialAmount > 0 || aaRoom.excess > 0 ? "attention" : "ok",
    impact: pensionImpact,
    impactLabel: pensionLabelParts.join(" + ") || null,
    amount: pensionAmount,
    potentialAmount: pensionPotentialAmount,
  };

  // Student loan — calcStudentLoanScenario is the single source of truth, shared
  // with the module's own Win/info tile (see there for the full scenario logic).
  // Overpaying only genuinely matters when the loan will actually clear before
  // write-off AND beats both the best savings rate and the pension's assumed
  // growth — that's the only case with a non-zero £/yr amount; everything else
  // (written off regardless, clears but saving or the pension beats
  // overpaying, or below threshold) has nothing actionable.
  const sl = calcStudentLoanScenario(d, m);
  const slAmount = sl.worthOverpaying ? sl.overpayAnnualBenefit : 0;
  s.studentLoan = {
    status: d.studentLoan === "none" ? "na"
          : sl.worthOverpaying ? (sl.balanceGrowing ? "critical" : "attention")
          : sl.belowThreshold ? "attention"
          : "ok",
    impact: slAmount,
    impactLabel: sl.belowThreshold
      ? "You earn below the repayment threshold, so nothing comes off your pay"
      : sl.worthOverpaying
        ? `${fmt(sl.overpayAnnualBenefit)}/yr better off overpaying than saving the money`
        : sl.balanceGrowing && !sl.willClear
          ? `Balance growing by ${fmt(Math.round(sl.netAnnualChange))}/yr, but it'll be written off before you clear it`
          : null,
    belowThreshold: sl.belowThreshold,
    amount: slAmount,
  };

  // Mortgage
  const mortgageImpact = d.hasMortgage === "yes" ? Math.round(+d.mortgageBalance * +d.mortgageRate / 100 * 0.05) : 0;
  s.mortgage = {
    status: d.hasMortgage !== "yes" ? "na" : +d.mortgageRate > 4.5 ? "attention" : "ok",
    impact: mortgageImpact,
    impactLabel: d.hasMortgage === "yes" ? `${d.mortgageRate}% rate — ${+d.mortgageRate > 4.5 ? "above average" : "below average"}` : null,
    amount: mortgageImpact, // only surfaced when status is "attention" (rate above average)
  };

  // Personal loan
  const plBal = +d.personalLoanBalance||0, plRate = +d.personalLoanRate||0;
  const plMo = +d.personalLoanMonthly||0, plTerm = +d.personalLoanTermRemaining||0;
  const plInterestRemaining = Math.max(0, plMo * plTerm - plBal);
  s.personalLoan = {
    status: d.hasPersonalLoan !== "yes" || plBal === 0 ? "na"
          : plRate > 10 ? "critical" : plRate > 6 ? "attention" : "ok",
    impact: plInterestRemaining,
    impactLabel: plBal > 0 ? `${fmt(plInterestRemaining)} interest remaining at ${plRate}%` : null,
    amount: plInterestRemaining,
  };

  // Kids
  const kidsAge = d.hasKids === "yes" && d.kidsAges ? parseInt(d.kidsAges.split(",")[0]) : null;
  const kidsRunway = kidsAge !== null ? Math.max(0, 18 - kidsAge) : 10;
  const kidsImpact = d.hasKids === "yes" && d.hasJISA !== "yes"
    ? Math.round(100 * 12 * ((Math.pow(1.07, kidsRunway)-1)/0.07)) : 0;
  s.kids = {
    status: d.hasKids !== "yes" ? "na" : d.hasJISA !== "yes" ? "attention" : "ok",
    impact: kidsImpact,
    impactLabel: kidsImpact > 0 ? `~${fmt(kidsImpact)} JISA growth potential (£100/mo at 7%)` : null,
    amount: kidsImpact,
    amountIsLumpSum: true, // projected total by age 18, not a £/yr figure — exclude from /yr sums
  };

  // Modules the user didn't pick on the "Focus" onboarding step read as not
  // applicable everywhere (Dashboard tiles, the AI prompt, the PDF report),
  // overriding whatever the blocks above computed from blank/default data.
  // This is what makes it safe to leave e.g. Pension unselected — without this,
  // isPensionContributing(d) reading the blank default would otherwise mark it
  // "critical" (with a +99999 sort sentinel) purely because it was never asked.
  const selectedModules = new Set(d.selectedModules || []);
  for (const key of ["cash", "investments", "pension"]) {
    if (!selectedModules.has(key)) {
      s[key] = { status: "na", impact: 0, impactLabel: null, amount: 0 };
    }
  }
  if (!selectedModules.has("studentLoan")) {
    s.studentLoan = { status: "na", impact: 0, impactLabel: null, belowThreshold: false, amount: 0 };
  }

  return s;
}

// A module's status and one-line summary, both worked out by the code
// (computeModuleStatuses): the AI report no longer has a say, so a module's
// colour and wording always match its figures (score-without-ai-plan.md).
// Single source of truth for the copy in the Modules list, the score sheet
// and the module headers. `insights` is no longer read; kept in the
// signature for existing callers.
export const ON_TRACK_LINE = "On track: nothing to act on right now.";
export function getModuleSummary(mm, d, m, statuses, insights) {
  const local = statuses[mm.key] || { status:"na", impact:0 };
  const status = local.status;
  const summary = status === "na" ? "N/A"
    : local.impactLabel ? local.impactLabel
    : status === "unknown" ? "Find out what you pay into your pension to see where you stand."
    : status === "ok" ? ON_TRACK_LINE
    : `Review your ${mm.title.toLowerCase()} situation.`;
  const impact = local.impact || 0;
  return { ...mm, status, summary, impact, impactLabel: local.impactLabel, amount: local.amount || 0, amountIsLumpSum: !!local.amountIsLumpSum };
}

// ── Candid score — deterministic, local, free ────────────────────────────────
// Replaces an earlier AI-generated score: Claude's number only ever changed
// when the whole assessment was re-run, so nothing short of that — not
// reviewing a module, not any other in-context change — ever moved it. This
// is a pure function of the same `statuses` that already drive every other
// number on the Dashboard (sorting, £ opportunity, tile colours), so it
// updates instantly and for free the moment `d` changes, from ANY source:
// the full "Edit inputs" wizard, or a per-recommendation quick-update inside
// a module deep dive (see ModuleDeepDive's QuickUpdate control).
// Starts at 100 and takes a flat deduction per flagged module. "na" (not
// selected/applicable) is excluded entirely. "unknown" (e.g. pension status
// not known) costs the same as "attention" — not knowing is a real gap, so
// answering "Not sure" can't score better than an honest answer with nothing
// to fix — while still costing less than a confirmed critical one.
const SCORE_PENALTY = { critical: 18, attention: 8, unknown: 8, ok: 0 };
export function calcCandidScore(statuses) {
  let score = 100;
  for (const s of Object.values(statuses || {})) {
    if (s.status === "na") continue;
    score -= SCORE_PENALTY[s.status] ?? 0;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Shared £-ranking for the module breakdown — single source of truth for both
// the Modules screen's full list and Home's "biggest win" teaser, so the two
// can never drift into separate sort implementations.
export function getModuleBreakdown(d, m, statuses, insights, sortMode = "amount") {
  const allModules = MODULE_META.map(mm => getModuleSummary(mm, d, m, statuses, insights));
  const activeModules = allModules.filter(mm => mm.status !== "na");

  // Descending by the clean £/yr `amount` figure (not the sort-priority `impact`,
  // which carries a +99999 sentinel for an uncontributed pension) by default, or
  // grouped by category first when sortMode === "category". This ordering is a
  // mathematical ranking, not an implied recommendation — see the toggle + micro-
  // copy on the Modules screen, which exists specifically so the default £-gap
  // order isn't read as a priority call the app is making on the user's behalf.
  // Modules with nothing actionable (amount === 0) sink to the bottom regardless
  // of sort mode. Kids & Family is excluded from the ranking and always placed
  // last — its `amount` is a lump sum by age 18, not a £/yr figure, so it isn't
  // comparable to the others under either sort mode.
  const rankedModules = activeModules.filter(mm => mm.key !== "kids");
  const kidsModule     = activeModules.find(mm => mm.key === "kids") || null;
  const modulesActionable = rankedModules.filter(mm => mm.amount > 0);
  // "Category" groups Today-actionable items ahead of Future-opportunity items
  // (the same Today/Future split already shown via each tile's TagPill), with
  // largest £ gap as the tie-breaker within each group.
  const CATEGORY_ORDER = { "Today": 0, "Future opportunity": 1 };
  const modulesWithRec = sortMode === "category"
    ? [...modulesActionable].sort((a,b) => {
        const catDiff = (CATEGORY_ORDER[MODULE_TAG[a.key]?.label] ?? 2) - (CATEGORY_ORDER[MODULE_TAG[b.key]?.label] ?? 2);
        return catDiff !== 0 ? catDiff : b.amount - a.amount;
      })
    : [...modulesActionable].sort((a,b) => b.amount - a.amount);
  const modulesNoRec   = rankedModules.filter(mm => mm.amount === 0);
  const moduleList     = [...modulesWithRec, ...modulesNoRec, ...(kidsModule ? [kidsModule] : [])];
  const needActionCount = modulesWithRec.length + (kidsModule && kidsModule.amount > 0 ? 1 : 0);
  const onTrackCount    = modulesNoRec.length + (kidsModule && kidsModule.amount === 0 ? 1 : 0);
  const totalOpp = modulesWithRec.filter(mm => !mm.amountIsLumpSum).reduce((sum, mm) => sum + mm.amount, 0);

  return { moduleList, modulesWithRec, modulesNoRec, kidsModule, needActionCount, onTrackCount, totalOpp };
}
