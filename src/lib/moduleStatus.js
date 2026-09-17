import { PoundSterling, TrendingUp, Landmark, GraduationCap, Home, CreditCard, Baby } from "lucide-react";
import { fmt } from "./format.js";
import { calcCashOptimisation } from "./cash.js";
import { isPensionContributing, calcPensionTaperSaving } from "./pension.js";
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
  const cashOpt = calcCashOptimisation(m, isaRate, nonIsaRate);
  const cashImpact = Math.max(0, Math.round(cashOpt.optimisationGain));
  // Approaching-deadline urgency is a sort-priority-only nudge, kept separate from
  // the £/yr figures shown to the user (see pension's +99999 sentinel below for the
  // same pattern).
  const cashSortPriority = cashImpact + Math.round(m.isaHeadroom * (isaRate / 100) * (isaUrgencyBoost - 1));
  const tooMuchCash = m.emergencyBuffer > 0 && m.emergencyFund > m.emergencyBuffer * 2;
  const genuinelyLowCash = m.emergencyFund === 0 && m.expenses > 0;
  const accessType = d.cashAccessType || "partial";
  const accessOk = m.emergencyFund >= m.emergencyBuffer;
  // Emergency access warnings — only critical when truly no cash at all
  let accessLabel = null;
  if (accessType === "no" && accessOk) {
    accessLabel = `Cash not in easy-access — consider keeping ${m.bufferMonths} months in instant-access`;
  } else if (accessType === "partial") {
    accessLabel = accessOk ? "Some cash may not be immediately accessible" : null;
  }

  let cashImpactLabel;
  if (tooMuchCash) {
    // emergencyExcess is a principal (the £ sitting above the buffer), not a £/yr
    // figure — never label it "/yr" or use it as the amount. The actual annual
    // benefit is the same optimisation-gain figure used below, just called out
    // alongside the excess for context.
    cashImpactLabel = cashImpact > 0
      ? `${fmt(cashImpact)}/yr in tax-efficiency gain available — ${fmt(Math.round(m.emergencyExcess))} of it sits above your buffer`
      : `${fmt(Math.round(m.emergencyExcess))} sits above your buffer, earning below its potential`;
  } else if (accessLabel) {
    cashImpactLabel = accessLabel;
  } else if (cashImpact > 0) {
    cashImpactLabel = `${fmt(cashImpact)}/yr in tax-efficiency gain available`;
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
    status: tooMuchCash || cashImpact > 800 ? "critical"
          : cashImpact > 200 || (genuinelyLowCash && accessType !== "yes") || (accessType === "no" && !accessOk) ? "attention" : "ok",
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
  const isaSortWeight = Math.round(m.isaHeadroom * 0.07 * m.tr * isaUrgencyBoost);
  s.investments = {
    status: (m.isaHeadroom > 10000 && daysToTaxEnd < 60) ? "critical"
          : m.isaHeadroom > 2000 || m.cgtSaving > 0 ? "attention" : "ok",
    impact: isaSortWeight + m.cgtSaving,
    impactLabel: m.cgtSaving > 0 && m.isaHeadroom > 0
      ? `${fmt(m.cgtSaving)} CGT saving + ${fmt(m.isaHeadroom)} ISA headroom`
      : m.cgtSaving > 0
        ? `${fmt(m.cgtSaving)} CGT saving available`
        : m.isaHeadroom > 0
          ? `${fmt(m.isaHeadroom)} ISA headroom unused`
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
  const contributing = isPensionContributing(d);
  const bonusSacrificeOpportunity = (+d.bonusAmount||0) * m.tr;
  const pensionTaper = calcPensionTaperSaving(m);
  const pensionTaperAmount = pensionTaper.inTaper ? pensionTaper.taperTotalSaving : 0;
  // "Not contributing" and "missed employer match" are mutually exclusive (the
  // latter only applies once you're contributing) — taper is an independent
  // opportunity that can stack on top of either.
  const pensionPrimaryAmount = !contributing ? Math.round(m.salary * 0.05 * m.tr) : m.missedMatch;
  const pensionAmount = Math.round(pensionPrimaryAmount + pensionTaperAmount); // definitive only
  const pensionPotentialAmount = Math.round(bonusSacrificeOpportunity); // potential — not in amount
  // Sort priority still weighs the potential upside too, so a large bonus-sacrifice
  // opportunity isn't buried in the module ordering just because it's not "definitive".
  const pensionImpact = (!contributing ? pensionAmount + 99999 : pensionAmount) + pensionPotentialAmount;
  const pensionLabelParts = [
    !contributing
      ? `No pension — ${fmt(pensionPrimaryAmount)}/yr tax relief foregone`
      : m.missedMatch > 0 ? `${fmt(m.missedMatch)}/yr missed employer match` : null,
    pensionTaperAmount > 0 ? `${fmt(pensionTaperAmount)}/yr Personal Allowance recovery` : null,
    pensionPotentialAmount > 0 ? `up to ${fmt(pensionPotentialAmount)} bonus sacrifice saving` : null,
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
    // Only "critical" when genuinely missing match or not contributing at all
    status: !contributing ? "critical" : m.missedMatch > 0 ? "critical" : "attention",
    impact: pensionImpact,
    impactLabel: pensionLabelParts.join(" + ") || null,
    amount: pensionAmount,
    potentialAmount: pensionPotentialAmount,
  };

  // Student loan — calcStudentLoanScenario is the single source of truth, shared
  // with the module's own Win/info tile (see there for the full scenario logic).
  // Overpaying only genuinely matters when the loan will actually clear before
  // write-off AND beats the user's cash rate — that's the only case with a
  // non-zero £/yr amount; everything else (written off regardless, or clears
  // but saving beats overpaying, or below threshold) has nothing actionable.
  const sl = calcStudentLoanScenario(d, m);
  const slWorthOverpaying = sl.willClear && sl.effectiveBenefit > 0;
  const slAmount = slWorthOverpaying ? sl.overpayAnnualBenefit : 0;
  s.studentLoan = {
    status: d.studentLoan === "none" ? "na"
          : slWorthOverpaying ? (sl.balanceGrowing ? "critical" : "attention")
          : sl.belowThreshold ? "attention"
          : "ok",
    impact: slAmount,
    impactLabel: sl.belowThreshold
      ? "Below repayment threshold — no deductions currently"
      : slWorthOverpaying
        ? `${fmt(sl.overpayAnnualBenefit)}/yr effective benefit from overpaying vs your cash rate`
        : sl.balanceGrowing
          ? `${fmt(Math.round(sl.netAnnualChange))}/yr, balance growing — but will be written off regardless`
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

// Merges a module's local (deterministic) status with the AI-generated narrative summary,
// applying the pension false-positive guard. Single source of truth for the explainer copy
// shown in the "Module breakdown" cards, ModuleDeepDive's header, and the PDF report.
export function getModuleSummary(mm, d, m, statuses, insights) {
  const local = statuses[mm.key] || { status:"na", impact:0 };
  const aiMod = insights?.modules?.[mm.key];
  // A local "na" is authoritative and must never be overridden by the AI (or its
  // offline fallback, which has no awareness of module selection at all) — this
  // is what's now hidden-for-MVP, opted out of module selection, or otherwise
  // genuinely not applicable, regardless of what a stale/generic AI status says.
  // Pension + personalLoan additionally always trust local even when it's NOT
  // "na" — a separate, pre-existing guard against stale AI data on those two.
  const status = local.status === "na" ? "na"
    : (mm.key === "pension" || mm.key === "personalLoan")
    ? local.status
    : (aiMod?.status && aiMod.status !== "na") ? aiMod.status : local.status;
  const rawSummary = aiMod?.summary || (local.status !== "na" ? `Review your ${mm.title.toLowerCase()} situation.` : "N/A");
  // For pension: if contributing, never show AI copy that says "no pension" or "start contributions"
  const pensionContrib = mm.key === "pension" && isPensionContributing(d);
  const aiHasFalsePositive = pensionContrib && (
    rawSummary.toLowerCase().includes("no pension") ||
    rawSummary.toLowerCase().includes("start contribution") ||
    rawSummary.toLowerCase().includes("not contributing")
  );
  const summary = aiHasFalsePositive
    ? `Contributing ${d.myContribution||""}% with ${d.employerMatch||"0"}% employer match. ${m.missedMatch > 0 ? `Increase to ${d.employerMatch}% to capture ${fmt(m.missedMatch)}/yr in free employer match.` : "Review your projected pot and bonus sacrifice options."}`
    : rawSummary;
  // Always use local impact for sorting — AI doesn't provide numeric impact
  const impact = local.impact || 0;
  return { ...mm, status, summary, impact, impactLabel: local.impactLabel, amount: local.amount || 0, amountIsLumpSum: !!local.amountIsLumpSum };
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
