import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation, useParams, Navigate } from "react-router-dom";
import posthog from "posthog-js";
import { topRate } from "./lib/savingsRates.js";
import { calcMetrics } from "./lib/metrics.js";
import { MODULE_META, HIDE_MVP_MODULES, HIDDEN_MVP_MODULE_KEYS, sanitizeForMvp, computeModuleStatuses, calcCandidScore, baselinePatch } from "./lib/moduleStatus.js";
import { ALL_STEP_DEFS, getActiveSteps, capField } from "./lib/onboarding.js";
import { G, WHITE, FONT_SIZE } from "./design-tokens.js";
import MobileLayout from "./mobile/MobileLayout.jsx";
import MobileHomeScreen from "./mobile/screens/MobileHomeScreen.jsx";
import MobileModulesScreen from "./mobile/screens/MobileModulesScreen.jsx";
import MobileForecastScreen from "./mobile/screens/MobileForecastScreen.jsx";
import MobileChatScreen from "./mobile/screens/MobileChatScreen.jsx";
import CandidAssist from "./mobile/assist/CandidAssist.jsx";
import MobileModuleDeepDive from "./mobile/screens/MobileModuleDeepDive.jsx";
import MobileUnlock from "./mobile/screens/MobileUnlock.jsx";
import MobileInputsScreen from "./mobile/screens/MobileInputsScreen.jsx";
import { isLocked, unlockPatch, firstUnlockPatch, unlockAsk, UNLOCK_GATE_ON } from "./lib/unlock.js";
import { checkAccessOnLoad, accessInfo, saveStateSoon } from "./lib/entitlement.js";
import MobileOnboardingScreen from "./mobile/screens/MobileOnboardingScreen.jsx";
import MobilePropertyScreen from "./mobile/screens/MobilePropertyScreen.jsx";
import MobileEntryScreen from "./mobile/screens/MobileEntryScreen.jsx";
import MobileModuleGuide from "./mobile/screens/MobileModuleGuide.jsx";
import MobileModuleReveal from "./mobile/screens/MobileModuleReveal.jsx";
import { MODULE_REVEALS } from "./lib/moduleReveal.js";
import { moduleLimits } from "./lib/moduleLimits.js";
import { appUnlocked, scoreUnlocked, withAnswered, START_MODULES, entryGoals, firstPick, modulePath } from "./lib/appEntry.js";
import { moduleGuideStarts } from "./lib/moduleGuide.js";
import { rollTaxYear } from "./lib/taxYear.js";
import { readinessMissing } from "./lib/propertyReadiness.js";
import { selectRows, updateRow } from "./lib/supabase.js";
import { propertyRowFields } from "./lib/reportRow.js";
import { useReportRow } from "./useReportRow.js";
import { reportStorageFailure } from "./lib/storage.js";

// Module names for Candid Assist's labels and "Elsewhere" list.
const ASSIST_MODULE_LABELS = { ...Object.fromEntries(MODULE_META.map(mm => [mm.key, mm.title])), property: "Property" };

// ── Main app ──────────────────────────────────────────────────────────────────
const BLANK_DATA = {
  // `interests`: the modules picked at the app's entry
  // (src/lib/appEntry.js), plus "property" or "exploring". `appEntered`:
  // they've been through that entry, which opens the app before any report.
  name:"", email:"", interests:[], appEntered:false, notWorkingReason:"", earnedThisTaxYear:"", askedFields:[], scottishTaxpayer:"",
  // `goalPicks`: the answer to the goals card on home (merged into
  // financialGoals); `goalsAsked`: that card has been answered or dismissed.
  // `scoreShown`: the Candid score has appeared (src/lib/appEntry.js
  // scoreUnlocked), so its first appearance is recorded once.
  goalPicks:[], goalsAsked:false, scoreShown:false,
  // Which of the 4 active MVP modules (cash, investments, pension, studentLoan —
  // matching MODULE_META keys) the user picked on the "Focus" onboarding step.
  // Drives which subsequent steps are shown (getActiveSteps) and which modules
  // computeModuleStatuses treats as applicable.
  selectedModules:[],
  // Multi-select goals from the "Your goals" onboarding step, right after
  // module selection — collected so future advice can be weighed against what
  // the user is actually trying to do, not just their raw numbers. Not yet
  // read by any calc-engine logic (see MobileInvestmentsDeepDive/CGT-style
  // features for the pattern once that wiring is scoped).
  financialGoals:[],
  houseTargetAmount:"", houseTimeframe:"",
  bigPurchaseTargetAmount:"", bigPurchaseTimeframe:"",
  age:"", salary:"", otherIncome:"", dividendIncome:"", bonusAmount:"", salaryTrajectory:"stable",
  // "employed" | "self_employed" | "not_working" — collected so commentary
  // that only makes sense for a PAYE employee (e.g. employer NI savings on a
  // pension sacrifice, see calcBonusSacrifice in lib/pension.js) can be
  // suppressed for a self-employed user, who has no employer to pass it on.
  employmentStatus:"employed",
  monthlyExpenses:"", higherBuffer:"no",
  cashSavings:"", savingsRate:"", premiumBonds:"", cashAccessType:"",
  cashTiers:[{amount:"",rate:""}],
  hasInvestments:"no", isaUsedThisYear:"", isaPreviousBalance:"", isaType:"none", unwrappedValue:"", unrealisedGains:"",
  hasSoldAssetsOutsideWrapper:"no", realisedCgtGains:"",
  isaThisYearCash:"", isaThisYearSS:"", isaThisYearLISA:"", isaThisYearOther:"",
  // Other ISAs paid into this year, as one total, asked in Cash when
  // Investments hasn't itemised them (src/lib/isa.js).
  hasOtherIsaThisYear:"", isaThisYearOtherTypes:"",
  isaPrevCash:"", isaPrevSS:"", isaPrevLISA:"", isaPrevOther:"",
  hasPension:"no", myContribution:"", employerMatch:"", potValue:"", potValue2:"", retirementAge:"65", pensionType:"",
  pensionUnknown:false,
  niYears:"",
  studentLoan:"none", loanBalance:"", studentLoanRate:"",
  hasMortgage:"no", mortgageType:"fixed", mortgageBalance:"", mortgageRate:"", monthlyMortgage:"",
  fixExpiryMonth:"", fixExpiryYear:"", mortgageProvider:"", propertyEquity:"",
  ownsOutright:false, outrightPropertyValue:"",
  savingsGoal:"goals", investHorizon:"5to10",
  inheritDirection:"", estateValue:"", hasWill:"no",
  hasPersonalLoan:"no", personalLoanBalance:"", personalLoanRate:"", personalLoanMonthly:"", personalLoanTermRemaining:"", personalLoanAnnualExtra:"", personalLoanProvider:"",
  hasKids:"no", numKids:"", kidsAges:"", hasJISA:"no", juniorISAValue:"",
  // Property module (MobilePropertyScreen). The partner figures are only asked
  // when buying together: nothing else in Candid holds a second person's
  // finances yet.
  propertyBuyingMode:"alone", propertyPrice:"", propertyCashAvailable:"", propertyStampDuty:"", propertyFees:"",
  partnerSalary:"", partnerOtherIncome:"", partnerMyContribution:"", partnerEmployerMatch:"", partnerIsaThisYear:"",
  // propertyRegion is a PROPERTY_REGIONS value (src/lib/regions.js). Stamp
  // duty is calculated from it in England/NI; propertyStampDuty is only the
  // user's own figure for Scotland and Wales. Blank mortgage fields use the
  // defaults in src/lib/mortgage.js.
  propertyRegion:"", propertyFirstTimeBuyer:"", partnerFirstTimeBuyer:"", propertySoleProperty:"yes",
  propertyMortgageTerm:"", propertyFixedYears:"", propertyMortgageRate:"", propertyRemortgageFee:"",
  // Rent vs buy (step 3). Blank assumptions use the defaults and regional
  // figures in src/lib/rentVsBuy.js.
  propertyMonthlyRent:"", propertyHorizonYears:"", propertyTenure:"freehold",
  propertyGroundRent:"", propertyGroundRentGrowth:"", propertyServiceCharge:"",
  propertyHousePriceGrowth:"", propertyRentGrowth:"", propertyInvestmentReturn:"", propertyDividendYield:"",
  propertyRenterMoney:"cash", propertyCashReturn:"",
  propertyMaintenancePct:"", propertyLeaseholdMaintenance:"", propertySellingCosts:"",
  // Buying together: whether monthlyExpenses is the household's ("household")
  // or the user's own ("mine"); blank counts as their own (spendingShared).
  propertySpendingScope:"",
  // Candid Assist: the figures the user said "not now" to, per item, so they
  // aren't raised again until the rates behind them change.
  assistSnoozed:null,
  // Candid Assist: the user is keeping their ISA allowance for investing.
  assistSkipIsa:false,
  // Candid Assist: the user doesn't want Premium Bonds offered.
  assistSkipPb:false,
  // Candid Assist: accounts opened through it, so it can warn when a rate
  // period is ending or the provider cuts the rate (src/lib/assist.js).
  assistAccounts:[],
  // Whether each step's guided walk-through has been finished or skipped
  // (STEP_GUIDES, src/lib/propertyGuide.js). Kept on this device only, not
  // sent to Supabase.
  propertyGuideReadinessDone:false, propertyGuideMortgageDone:false, propertyGuideRentVsBuyDone:false,
  // Supabase schema note: isa_this_year_other NUMERIC
};

// rollTaxYear (src/lib/taxYear.js) moves last tax year's ISA payments and
// realised gains out of the "this tax year" fields once a new tax year has
// started, and stamps the inputs with the current one (inputsTaxYear).
function loadInitialData() {
  const now = new Date();
  try {
    const saved = localStorage.getItem('candid_inputs');
    if (saved) {
      // Inputs saved before inputsTaxYear existed are dated by their last report.
      const reportDate = localStorage.getItem('candid_insights_date');
      return rollTaxYear({ ...BLANK_DATA, ...JSON.parse(saved) }, now, reportDate ? new Date(reportDate) : null);
    }
  } catch(e) { reportStorageFailure("load_inputs", e); }
  return rollTaxYear(BLANK_DATA, now);
}

function loadSavedInsights() {
  try {
    const saved = localStorage.getItem('candid_insights');
    if (saved) return JSON.parse(saved);
  } catch(e) { reportStorageFailure("load_insights", e); }
  return null;
}

// Which module keys the user has marked reviewed — persisted so "Reviewed X
// of Y modules" (MobileHomeScreen) reflects real progress across
// visits, not just within one session.
function loadCompletedModules() {
  try {
    const saved = localStorage.getItem('candid_completed_modules');
    if (saved) return JSON.parse(saved);
  } catch(e) { reportStorageFailure("load_completed_modules", e); }
  return [];
}

// Screens open at their top, not where the last one was scrolled to.
const scrollToTop = () => window.scrollTo({ top: 0, behavior: "instant" });

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const pathname = location.pathname;
  const assessmentStepNum = pathname.startsWith("/app/assessment/") ? parseInt(params.step, 10) : null;

  // rawD is the true persisted state — never mutated by the MVP hide, so any
  // mortgage/personal-loan/kids answers a user already saved before the MVP
  // narrowing stay intact in localStorage. `d` below is the sanitized view
  // every other consumer in this component reads instead — see
  // sanitizeForMvp/HIDE_MVP_MODULES.
  const [rawD,             setRawD]             = useState(loadInitialData);
  const d = useMemo(() => sanitizeForMvp(rawD), [rawD]);
  const [insights]                              = useState(loadSavedInsights);
  const [completedModules, setCompletedModules] = useState(loadCompletedModules);
  // Where a mobile edit started from a screen other than Home (e.g. the
  // Property screen's "Add Cash & savings", see openMobileStep) returns to
  // once the user regenerates or goes back to their report. Cleared if they
  // leave the assessment any other way, so a stale path can't hijack a later
  // edit started from Home.
  const assessmentReturnPath = useRef(null);
  useEffect(() => {
    if (!pathname.startsWith("/app/assessment/")) assessmentReturnPath.current = null;
  }, [pathname]);
  // Edit inputs (/app/inputs): where it was opened from, to go back to,
  // and the user's row saved when they leave it, however they leave.
  const inputsReturnPath = useRef(null);
  const wasOnInputs = useRef(false);
  useEffect(() => {
    const onInputs = pathname === "/app/inputs";
    if (wasOnInputs.current && !onInputs) setRowSaveTick(t => t + 1);
    wasOnInputs.current = onInputs;
  }, [pathname]);

  // ── assessment_abandoned — fires on real tab/page close mid-assessment ──────
  // Refs (not state) because the pagehide listener is registered once and reads
  // whatever the latest values were at unload time, not whatever they were when
  // the listener was attached.
  const pathnameRef = useRef(pathname);
  const assessmentStepRef = useRef(assessmentStepNum);
  const assessmentStepLabelRef = useRef(null);
  const assessmentCompletedRef = useRef(false);
  pathnameRef.current = pathname;
  assessmentStepRef.current = assessmentStepNum;
  // getActiveSteps(d) is selection-dependent, so — unlike the old fixed STEPS
  // array — the label for a given step number can only be resolved per-render,
  // not read directly inside the pagehide handler below (which runs outside
  // React's render cycle via a stale closure).
  assessmentStepLabelRef.current = Number.isInteger(assessmentStepNum)
    ? getActiveSteps(d)[assessmentStepNum - 1]?.label ?? null
    : null;
  useEffect(() => {
    function handlePageHide() {
      if (pathnameRef.current?.startsWith("/app/assessment/") && !assessmentCompletedRef.current) {
        const stepN = assessmentStepRef.current;
        // sendBeacon transport — same one PostHog's own $pageleave uses — so this
        // has a real chance of actually reaching the server as the page unloads.
        posthog.capture("assessment_abandoned", {
          step: Number.isInteger(stepN) ? stepN : null,
          step_name: assessmentStepLabelRef.current,
          reason: "page_unload",
        }, { transport: "sendBeacon" });
      }
    }
    // capture: true — runs before PostHog's own pagehide listener (registered in
    // the default bubble phase during posthog.init()), so this fires and queues
    // its sendBeacon call before PostHog's internal unload handler tears down/
    // flushes its request queue. Registered afterwards (bubble phase), this event
    // was landing too late and silently never reaching PostHog — confirmed live.
    window.addEventListener("pagehide", handlePageHide, { capture: true });
    return () => window.removeEventListener("pagehide", handlePageHide, { capture: true });
  }, []);

  const set = (k, v) => setRawD(p => ({...p, [k]:v}));

  // Records a student loan overpayment made outside the app (e.g. via the
  // mobile deep dive's "Model a lump sum overpayment" slider, then actually
  // paid through SLC): updates the recorded balance AND deducts the same
  // amount from cash, since that money didn't vanish — it's what paid the
  // loan down. Without this, manually lowering just the loan balance would
  // make net worth look like it increased for free. Reduces cash tiers
  // (largest first) when populated, else the flat cashSavings fallback —
  // mirrors calcMetrics' own tiers-vs-flat preference (src/lib/metrics.js).
  const recordLoanOverpayment = (newBalance) => {
    const capped = capField("loanBalance", newBalance);
    setRawD(p => {
      const delta = Math.max(0, (+p.loanBalance||0) - (+capped||0));
      const next = { ...p, loanBalance: String(capped) };
      if (delta > 0) {
        const tiers = Array.isArray(p.cashTiers) ? p.cashTiers : [];
        const tiersTotal = tiers.reduce((s,t) => s + (+t.amount||0), 0);
        if (tiersTotal > 0) {
          let remaining = delta;
          const newTiers = tiers.map(t => ({...t}));
          const byLargest = newTiers.map((t,i) => i).sort((a,b) => (+newTiers[b].amount||0) - (+newTiers[a].amount||0));
          for (const i of byLargest) {
            if (remaining <= 0) break;
            const amt = +newTiers[i].amount || 0;
            const take = Math.min(amt, remaining);
            newTiers[i] = { ...newTiers[i], amount: String(amt - take) };
            remaining -= take;
          }
          next.cashTiers = newTiers;
        } else {
          next.cashSavings = String(Math.max(0, (+p.cashSavings||0) - delta));
        }
      }
      return next;
    });
  };

  // Records a non-ISA/pension sale made outside the app (the mobile deep
  // dive's "I've sold some" editor on the Investments module's "Crystallise
  // paper gains" tile): moves `amountSold` out of unwrappedValue and into
  // cash (it didn't vanish, it's now sitting as cash — added to the first
  // cash tier when populated, else the flat cashSavings fallback, mirroring
  // recordLoanOverpayment's tiers-vs-flat preference above), moves
  // `gainCrystallised` out of unrealisedGains (that portion of paper gain is
  // no longer unrealised), and adds it to realisedCgtGains so it counts
  // against this year's £3,000 CGT allowance (src/lib/metrics.js) exactly
  // like a sale reported during onboarding would.
  const recordCrystallisedGain = (amountSold, gainCrystallised) => {
    const soldCapped = Math.max(0, +capField("unwrappedValue", amountSold) || 0);
    const gainCapped = Math.max(0, +capField("unrealisedGains", gainCrystallised) || 0);
    setRawD(p => {
      const next = {
        ...p,
        unwrappedValue: String(Math.max(0, (+p.unwrappedValue||0) - soldCapped)),
        unrealisedGains: String(Math.max(0, (+p.unrealisedGains||0) - gainCapped)),
        hasSoldAssetsOutsideWrapper: "yes",
        realisedCgtGains: String(Math.max(0, (+p.realisedCgtGains||0) + gainCapped)),
      };
      if (soldCapped > 0) {
        const tiers = Array.isArray(p.cashTiers) ? p.cashTiers : [];
        if (tiers.length > 0) {
          const newTiers = tiers.map(t => ({...t}));
          newTiers[0] = { ...newTiers[0], amount: String((+newTiers[0].amount||0) + soldCapped) };
          next.cashTiers = newTiers;
        } else {
          next.cashSavings = String((+p.cashSavings||0) + soldCapped);
        }
      }
      return next;
    });
  };

  useEffect(() => {
    try { localStorage.setItem('candid_inputs', JSON.stringify(rawD)); }
    catch(e) { reportStorageFailure("save_inputs", e); }
  }, [rawD]);

  useEffect(() => {
    try { localStorage.setItem('candid_completed_modules', JSON.stringify(completedModules)); }
    catch(e) { reportStorageFailure("save_completed_modules", e); }
  }, [completedModules]);

  // ── Savings rates — fetched once here (not per-component) since Assist and
  // the Cash screen both need it. null = still loading.
  const [savingsRates, setSavingsRates] = useState(null);
  // Candid Assist's panel: open or minimised, and its place in a walkthrough.
  // Held here, not in the panel, so it survives moving between screens.
  const [assistState, setAssistState] = useState({ open: false, itemId: null, step: "overview", isaChoice: null, isaChoice2: null, savingsChoice: null, savingsChoice2: null, pbChoice: null, accountChoice: null, done: {} });
  useEffect(() => {
    let cancelled = false;
    selectRows("savings_rates", "?select=id,provider_name,product_name,account_type,rate_aer,max_balance,bonus_rate,bonus_months,rate_after,app_only,ios_app_url,android_app_url,product_url,updated_at,is_isa&order=rate_aer.desc")
      .then(rows => { if (!cancelled) setSavingsRates(rows || []); });
    return () => { cancelled = true; };
  }, []);

  // ── Regional rent and house price growth (Property's rent vs buy) — from
  // property_regional_rates, updated by hand with each ONS release. null
  // while loading or if it fails; src/lib/regionalRates.js then falls back
  // to its snapshot.
  const [regionalRates, setRegionalRates] = useState(null);
  useEffect(() => {
    let cancelled = false;
    selectRows("property_regional_rates", "?select=region,rent_growth_pct,house_price_growth_pct")
      .then(rows => { if (!cancelled) setRegionalRates(rows); });
    return () => { cancelled = true; };
  }, []);

  // ── Return from TrueLayer bank-connect redirect — runs once on mount ─────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tlStatus = params.get("truelayer");
    if (!tlStatus) return;
    const reason = params.get("reason");
    // Strip the query string immediately so a refresh doesn't reprocess it.
    window.history.replaceState({}, "", window.location.pathname);

    if (tlStatus === "success") {
      // The mapped data lives server-side in a one-time HttpOnly cookie set by
      // the callback — fetched here rather than read off the URL, so it never
      // touches browser history, server logs, or Referer headers.
      fetch("/api/truelayer/session-data")
        .then(res => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`))))
        .then(parsed => {
          setRawD(p => ({
            ...p,
            cashSavings: parsed.cashSavings != null ? String(parsed.cashSavings) : p.cashSavings,
            cashTiers: parsed.cashTiers?.length ? parsed.cashTiers : p.cashTiers,
            monthlyExpenses: parsed.monthlyExpenses != null ? String(parsed.monthlyExpenses) : p.monthlyExpenses,
          }));
          // Home already forwarded this mount to /assessment/5 (Cash & savings)
          // before CandidApp/AppShell ever rendered — no navigation needed here.
          posthog.capture("truelayer_connected", { accounts: parsed.accountsConnected ?? null });
        })
        .catch(e => { if (import.meta.env.DEV) console.warn("[Candid] Failed to fetch TrueLayer session data:", e); });
    } else if (tlStatus === "error") {
      posthog.capture("truelayer_connect_failed", { reason: reason || null });
    }
  }, []);

  // ── Return from TrueLayer hosted payment page — runs once on mount ───────────
  // There's no data to merge here (the payment's own state lives with TrueLayer,
  // not in a cookie like the bank-connect flow) — this just confirms the return
  // landed and cleans the query string, matching the pattern above.
  useEffect(() => {
    const paymentStatus = new URLSearchParams(window.location.search).get("truelayer_payment");
    if (!paymentStatus) return;
    window.history.replaceState({}, "", window.location.pathname);
    posthog.capture("truelayer_payment_returned", { status: paymentStatus });
  }, []);

  // Resolved once here from the already-fetched savings_rates and threaded into both
  // functions as plain numbers — calcMetrics/computeModuleStatuses stay synchronous.
  // rate_aer comes back from PostgREST as a string (numeric columns are stringified
  // for precision) — converted explicitly here rather than relying on JS's implicit
  // coercion throughout the downstream arithmetic.
  const marketRates = useMemo(() => {
    const topIsa = topRate(savingsRates, true);
    const topNonIsa = topRate(savingsRates, false);
    return {
      isaRate: topIsa ? +topIsa.rate_aer : undefined,
      nonIsaRate: topNonIsa ? +topNonIsa.rate_aer : undefined,
      // The rows too, so cash figures can spread money across accounts by
      // rate and balance cap (allocateCash).
      rows: savingsRates || null,
    };
  }, [savingsRates]);
  const m = useMemo(() => calcMetrics(d, marketRates), [d, marketRates]);
  const statuses = useMemo(() => computeModuleStatuses(d, m, marketRates), [d, m, marketRates]);
  // The user's row in Supabase: its id, inserting it and PATCHing it.
  const { currentRowId, insertReportRow, saveRow, rowInputFields, rowReportFields } = useReportRow(d, m, statuses);
  // Each module's £ when first answered, for what's been banked since
  // (moduleStatus.js bankedFor).
  useEffect(() => {
    const next = baselinePatch(d, statuses);
    if (next) set("moduleBaselines", next);
  }, [statuses]);

  // Property inputs → the report row. Only edits made on the Property screen
  // are sent (not the values already there when it opens), once they've
  // settled for 2 seconds so typing a price doesn't PATCH per keystroke; an
  // edit still pending when the user leaves the screen is sent straight away.
  // The row is created at entry, before most of these are known.
  const propertyPatch = useMemo(() => pathname.startsWith("/app/property") ? propertyRowFields(d, m, regionalRates, marketRates) : null,
    [pathname, d, m, regionalRates, marketRates]);
  const propertyBaseline = useRef(null);
  const pendingPropertyPatch = useRef(null);
  // The insert in flight when a Property save has had to create the report
  // row, so a second save in the meantime PATCHes it rather than inserting
  // another.
  const creatingReportRow = useRef(null);
  useEffect(() => {
    async function send() {
      const patch = pendingPropertyPatch.current;
      if (!patch) return;
      pendingPropertyPatch.current = null;
      propertyBaseline.current = JSON.stringify(patch);
      if (patch.salary) { try { localStorage.setItem('candid_property_income_saved', '1'); } catch(e) { reportStorageFailure("save_property_income_flag", e); } }
      const full = { ...patch, property_updated_at: new Date().toISOString() };
      if (creatingReportRow.current) {
        const id = await creatingReportRow.current;
        if (id) updateRow("test", id, full);
        return;
      }
      const rowId = currentRowId();
      const outcome = await updateRow("test", rowId, full);
      if (outcome === "missing") {
        // This browser's report never got a row (it was made while report
        // saves were failing, before 29 Sept 2026) or the row is gone. Create
        // it now, with the Property fields, rather than lose them.
        posthog.capture("property_save_without_report_row", { had_row_id: !!rowId });
        creatingReportRow.current = insertReportRow(insights?.score ?? calcCandidScore(statuses), full);
        try { await creatingReportRow.current; } finally { creatingReportRow.current = null; }
      }
    }
    if (!propertyPatch) { send(); propertyBaseline.current = null; return; }
    const json = JSON.stringify(propertyPatch);
    if (propertyBaseline.current === null) {
      // Salary entered on Property before 6 Oct 2026 was never saved to the
      // row (the patch left it out), so it's sent once on the next visit.
      // Only when there is one: a newcomer's row is still being created.
      let incomeSaved = true;
      try { incomeSaved = !!localStorage.getItem('candid_property_income_saved'); } catch(e) { reportStorageFailure("read_property_income_flag", e); }
      propertyBaseline.current = !incomeSaved && propertyPatch.salary ? "" : json;
      if (propertyBaseline.current === json) return;
    }
    if (json === propertyBaseline.current) { pendingPropertyPatch.current = null; return; }
    pendingPropertyPatch.current = propertyPatch;
    const t = setTimeout(send, 2000);
    return () => clearTimeout(t);
  }, [propertyPatch]);

  function markModuleComplete(key) {
    setCompletedModules(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      if (!prev.includes(key)) {
        posthog.capture("module_completed", { module_key: key, total_completed: next.length });
        updateRow("test", currentRowId(), { modules_completed: next.length });
      }
      return next;
    });
  }

  // Saving a module's answers waits a render (rowSaveTick), so the last
  // answer, set the moment before the walk-through ended, is in `d`.
  const [rowSaveTick, setRowSaveTick] = useState(0);
  // The module whose answer is being shown step by step (MODULE_REVEALS):
  // after its first walk-through, or replayed from its screen.
  const [revealModule, setRevealModule] = useState(null);
  // An unlock's answers, saved a render later so they're in `d`. The email
  // goes with the inputs; the unlock columns on their own, so a missing
  // column grant can't stop the email saving.
  const [unlockSaveTick, setUnlockSaveTick] = useState(0);
  // A subscription (src/lib/entitlement.js): checked with the server on
  // opening, including back from checkout or a sign-in link. A change
  // redraws, since what's locked reads it. Back from paying on a module's
  // page, its answer is shown step by step, as after a free unlock.
  const [accessTick, setAccessTick] = useState(0);
  useEffect(() => {
    const redraw = () => setAccessTick(t => t + 1);
    window.addEventListener("candid-access", redraw);
    checkAccessOnLoad().then(outcome => {
      if (outcome === "paid" || outcome === "restored") {
        posthog.capture(outcome === "paid" ? "checkout_completed" : "access_restored", { plan: accessInfo()?.plan ?? null });
        const email = accessInfo()?.email;
        if (email && !d.email) { set("email", email); setUnlockSaveTick(t => t + 1); }
        const onModule = window.location.pathname.match(/^\/app\/module\/([a-zA-Z]+)/);
        if (outcome === "paid" && onModule) setRevealModule(onModule[1]);
      } else if (outcome === "cancelled") posthog.capture("checkout_cancelled");
    });
    return () => window.removeEventListener("candid-access", redraw);
  }, []);
  // A subscriber's answers go to their subscription as they change (and
  // once on subscribing), for signing in on another device. Does nothing
  // without one.
  useEffect(() => { saveStateSoon({ inputs: rawD, completedModules }); }, [rawD, completedModules, accessTick]);
  useEffect(() => {
    if (!unlockSaveTick) return;
    // One after the other, so a missing row is only created once.
    (async () => {
      await saveRow(rowInputFields());
      await saveRow({ unlock_call_ok: d.unlockCallOk ?? null, unlock_feedback: d.unlockFeedback || null, unlocked_modules: (d.unlockedModules || []).join(", ") || null });
      // Asked for emails (api/alerts.js reads it). On its own, so a missing
      // column grant can't stop the rest saving
      // (supabase/hand-run/supabase_alerts_migration.sql).
      if (d.alertsOptIn) await saveRow({ alerts_opt_in: true });
    })();
  }, [unlockSaveTick]);
  // Whether the Candid score is showing: once every module picked at the
  // entry is answered (scoreUnlocked), or for a user with an old report.
  // It's worked out by the code, so the row gets the score with the inputs.
  const scoreShowing = !!insights || scoreUnlocked(d, readinessMissing(d, m).length === 0);
  useEffect(() => {
    if (rowSaveTick) saveRow({ ...rowInputFields(), ...(scoreShowing ? rowReportFields(calcCandidScore(statuses)) : {}) });
  }, [rowSaveTick]);
  // A shared link straight to Property (/app/property) or a module
  // (/app/module/studentLoan, e.g. from LinkedIn) opens the app for a
  // newcomer as if they'd picked it at the entry, so they go straight into
  // its walk-through rather than the entry's questions or the homepage.
  // Their row is created once appEntered has landed in `d`.
  const linkedModule = pathname.startsWith("/app/property") ? "property"
    : pathname.startsWith("/app/module/") && START_MODULES.includes(pathname.split("/")[3]) ? pathname.split("/")[3]
    : null;
  const linkRow = useRef(false);
  useEffect(() => {
    if (!linkedModule || appUnlocked(d, insights)) return;
    set("appEntered", true);
    if (UNLOCK_GATE_ON) set("unlockGate", true);
    if (linkedModule !== "property") set("answeredModules", []);
    if (!(d.interests || []).length) { set("interests", [linkedModule]); set("financialGoals", entryGoals([linkedModule])); }
    posthog.capture("app_entered", { interests: linkedModule, via: linkedModule === "property" ? "property_link" : "module_link" });
    linkRow.current = true;
  }, [linkedModule, d.appEntered, insights]);
  useEffect(() => {
    if (!linkRow.current || !d.appEntered) return;
    linkRow.current = false;
    insertReportRow(null);
  }, [d.appEntered]);

  // The score's first appearance, recorded once: an event in place of the
  // old report_generated, and the score on the user's row.
  useEffect(() => {
    if (!scoreShowing || d.scoreShown || !d.appEntered) return;
    set("scoreShown", true);
    posthog.capture("score_unlocked", { score: calcCandidScore(statuses), modules: (d.selectedModules || []).join(",") });
    saveRow({ ...rowInputFields(), ...rowReportFields(calcCandidScore(statuses)) });
  }, [scoreShowing]);

  // Opens one onboarding step by id ("cash",
  // "investments", "about"...), first adding its module to the user's
  // selection if they skipped it. Used by the Property screen to send a
  // missing figure to the step that normally asks for it.
  function openMobileStep(stepId) {
    // A module not answered yet opens on its walk-through, which ends on the
    // module's own screen, rather than the old step, which ends by making a
    // report.
    if (moduleGuideStarts(stepId, d)) { navigate(`/app/module/${stepId}`); return; }
    // Answered already: the field is on Edit inputs, in that module's tile.
    if (stepId === "about" || (d.selectedModules || []).includes(stepId)) { openInputs(stepId === "about" ? null : stepId); return; }
    const def = ALL_STEP_DEFS.find(s => s.id === stepId);
    let selected = d.selectedModules || [];
    if (def?.moduleKey && !selected.includes(def.moduleKey)) {
      selected = [...selected, def.moduleKey];
      set("selectedModules", selected);
    }
    const idx = getActiveSteps({ selectedModules: selected }).findIndex(s => s.id === stepId);
    if (idx >= 0) {
      assessmentReturnPath.current = pathname;
      navigate(`/app/assessment/${idx + 1}`);
    }
  }
  function openInputs(moduleKey = null) {
    inputsReturnPath.current = pathname;
    posthog.capture("edit_inputs_opened", { from: pathname, module: moduleKey });
    navigate(moduleKey ? `/app/inputs?open=${moduleKey}` : "/app/inputs");
  }
  function takeAssessmentReturnPath() {
    const path = assessmentReturnPath.current || "/app/home";
    assessmentReturnPath.current = null;
    return path;
  }

  // ── Router ──
  // Deep-link guard: the app's screens open once the user has been through
  // its entry (appUnlocked). Before that, a stale bookmark, shared link or
  // bare reload goes home rather than to a broken or empty page.
  const APP_PATHS = ["/app/home", "/app/modules", "/app/forecast", "/app/inputs", "/app/chat", "/app/property", "/app/property/mortgage", "/app/property/rent-vs-buy"];
  if ((APP_PATHS.includes(pathname) || pathname.startsWith("/app/module/")) && !appUnlocked(d, insights)) {
    // A Property or module link is let in (the effect above); blank for that moment.
    if (linkedModule) return null;
    return <Navigate to="/" replace />;
  }

  // The entry. Anyone the app is already open to goes home.
  if (pathname === "/app/start") {
    if (appUnlocked(d, insights)) return <Navigate to="/app/home" replace />;
    return (
      <MobileEntryScreen d={d} m={m} set={set} onDone={() => {
        set("appEntered", true);
        // Which modules are answered, not just opened, is tracked from here.
        set("answeredModules", []);
        // New users unlock each module's answer (src/lib/unlock.js).
        if (UNLOCK_GATE_ON) set("unlockGate", true);
        posthog.capture("app_entered", { interests: (d.interests || []).join(",") });
        // The user's row from the start (name and interests), not only once
        // a report exists. The report still adds its own row when it's made.
        insertReportRow(null);
        // Straight into the first module they picked; Home for "Just exploring".
        const pick = firstPick(d);
        navigate(pick ? modulePath(pick) : "/app/home");
      }}/>
    );
  }

  if (pathname.startsWith("/app/assessment/")) {
    // getActiveSteps(d) reflects the CURRENT d.selectedModules, so forward/back
    // navigation always lines up with the steps active for this user right now.
    const activeSteps = getActiveSteps(d);
    const stepNum = parseInt(params.step, 10);
    if (!Number.isInteger(stepNum) || stepNum < 1 || stepNum > activeSteps.length) {
      return <Navigate to="/app/assessment/1" replace />;
    }
    const step = stepNum - 1;
    return (
      <MobileOnboardingScreen step={step} steps={activeSteps} d={d} set={set} insights={insights}
        onBack={() => {
          if (step > 0) { navigate(`/app/assessment/${step}`); return; }
          posthog.capture("assessment_abandoned", { step: step + 1, step_name: activeSteps[step].label, reason: "back_to_welcome" });
          navigate("/welcome");
        }}
        onBackToDashboard={() => navigate(takeAssessmentReturnPath())}
        onContinue={() => {
          posthog.capture("assessment_question_completed", { step: step + 1, step_name: activeSteps[step].label });
          if (step < activeSteps.length - 1) { navigate(`/app/assessment/${step+2}`); return; }
          // Saves and goes back, with no AI report: the score and "what to
          // do first" are worked out by the code (docs/score-without-ai-plan.md).
          // appEntered keeps the app open for someone whose old report was
          // cleared ("Update my inputs" on the welcome-back screen).
          assessmentCompletedRef.current = true;
          posthog.capture("assessment_completed");
          set("appEntered", true);
          setRowSaveTick(t => t + 1);
          navigate(takeAssessmentReturnPath());
          scrollToTop();
        }}
      />
    );
  }

  // Shared by the Home, Modules and Forecast tabs so the edit-inputs entry
  // point sits in the same header slot on each.
  // Said in words: the spanner icon it replaced wasn't clear. On a module's
  // page it opens that module's tile.
  const editInputsFor = moduleKey => (
    <button onClick={() => openInputs(moduleKey)} style={{background:"none",border:`1.5px solid rgba(22,47,36,0.18)`,borderRadius:"100px",padding:"6px 14px",cursor:"pointer",color:G,fontSize:"13px",fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap"}}>
      Edit inputs
    </button>
  );
  const editInputsButton = editInputsFor(null);
  // The way back from a module page, the Property steps and a walk-through.
  const modulesBackButton = (
    <button onClick={() => navigate("/app/modules")} style={{background:"none",border:"none",padding:0,color:G,fontSize:FONT_SIZE.BODY,fontWeight:700,cursor:"pointer"}}>‹ Modules</button>
  );

  // On every tab-bar screen (MobileLayout renders it).
  // Assist deals with the module page it's on (null: an overview page).
  const assistPage = pathname.startsWith("/app/module/") ? pathname.split("/")[3] || null : pathname.startsWith("/app/property") ? "property" : null;
  const assistNode = (
    <CandidAssist d={d} m={m} set={set} savingsRates={savingsRates} state={assistState} setState={setAssistState}
      page={assistPage} moduleLabels={ASSIST_MODULE_LABELS}
      onGoTo={key => navigate(key === "property" ? "/app/property" : `/app/module/${key}`)}/>
  );

  if (pathname === "/app/home") return (
    <MobileLayout assist={assistNode} activeTab="home" headerRight={editInputsButton}>
      <MobileHomeScreen insights={insights} d={d} m={m} set={set} statuses={statuses} completedModules={completedModules}
        onStartModule={key => navigate(key === "property" ? "/app/property" : `/app/module/${key}`)}
        onGoalsDone={(how, goals) => {
          set("goalsAsked", true);
          posthog.capture(how === "answered" ? "goals_answered" : "goals_dismissed", { goals: (goals || []).join(",") });
          if (how === "answered") setRowSaveTick(t => t + 1);
        }}/>
    </MobileLayout>
  );

  if (pathname === "/app/modules") return (
    <MobileLayout assist={assistNode} activeTab="modules" headerRight={editInputsButton}>
      <MobileModulesScreen d={d} m={m} set={set} statuses={statuses} insights={insights}
        completedModules={completedModules}
        onMarkReviewed={markModuleComplete}
        onOpenModule={key => navigate(`/app/module/${key}`)}
        onOpenProperty={() => navigate("/app/property")}/>
    </MobileLayout>
  );

  const PROPERTY_STEP_PATHS = { readiness:"/app/property", mortgage:"/app/property/mortgage", rentVsBuy:"/app/property/rent-vs-buy" };
  const propertyStep = Object.keys(PROPERTY_STEP_PATHS).find(k => PROPERTY_STEP_PATHS[k] === pathname);
  if (propertyStep) {
    // Steps 2 and 3 stay locked until step 1 is complete, including for a direct link.
    if (propertyStep !== "readiness" && readinessMissing(d, m).length > 0) return <Navigate to="/app/property" replace />;
    return (
      <MobileLayout assist={assistNode} activeTab="modules" pageLabel="Property"
        headerRight={modulesBackButton}>
        <MobilePropertyScreen step={propertyStep} d={d} m={m} set={set} regionalRows={regionalRates} marketRates={marketRates} onAddInputs={openMobileStep}
          onOpenModule={key => navigate(`/app/module/${key}`)}
          onSelectStep={next => {
            navigate(PROPERTY_STEP_PATHS[next] || "/app/property");
            scrollToTop();
          }}/>
      </MobileLayout>
    );
  }

  if (pathname === "/app/forecast") return (
    <MobileLayout assist={assistNode} activeTab="forecast" headerRight={editInputsButton}>
      <MobileForecastScreen d={d} m={m}/>
    </MobileLayout>
  );

  if (pathname === "/app/inputs") {
    const open = new URLSearchParams(window.location.search).get("open");
    const back = () => { const to = inputsReturnPath.current || "/app/home"; inputsReturnPath.current = null; navigate(to); scrollToTop(); };
    return (
      <MobileLayout assist={assistNode} activeTab={null} pageLabel="Your inputs"
        headerRight={<button onClick={back} style={{background:G,border:"none",borderRadius:"100px",padding:"7px 16px",cursor:"pointer",color:WHITE,fontSize:"13px",fontWeight:700,fontFamily:"inherit"}}>Done</button>}>
        <MobileInputsScreen key={open || "all"} d={d} m={m} set={set} open={open}
          onStartModule={key => navigate(`/app/module/${key}`)}
          onOpenModule={key => { inputsReturnPath.current = null; navigate(`/app/module/${key}`); scrollToTop(); }}
/>
      </MobileLayout>
    );
  }

  if (pathname === "/app/chat") return (
    // No Candid Assist button here: the conversation is the help, and the
    // button would sit over its running total.
    <MobileLayout activeTab="chat">
      <MobileChatScreen d={d} m={m} set={set} marketRates={marketRates}/>
    </MobileLayout>
  );

  if (pathname.startsWith("/app/module/")) {
    const mobileActiveModule = params.moduleKey || null;
    const moduleLabel = ASSIST_MODULE_LABELS[mobileActiveModule];
    if (!mobileActiveModule || (HIDE_MVP_MODULES && HIDDEN_MVP_MODULE_KEYS.includes(mobileActiveModule)) || !MODULE_META.some(mm => mm.key === mobileActiveModule)) {
      return <Navigate to="/app/modules" replace />;
    }
    // A locked module needing a subscription: its frosted answer and the
    // paywall first, before any questions (unlock.js).
    if (moduleGuideStarts(mobileActiveModule, d) && isLocked(d, mobileActiveModule) && unlockAsk(d).kind === "pay") {
      return (
        <MobileLayout assist={assistNode} activeTab="modules" pageLabel={moduleLabel} headerRight={modulesBackButton}>
          <MobileUnlock preview moduleKey={mobileActiveModule} d={d} m={m} statuses={statuses}
            onLeaveEmail={email => { set("email", email); set("alertsOptIn", true); posthog.capture("email_captured", { source: "paywall" }); setUnlockSaveTick(t => t + 1); }}
            onUnlock={() => {}}/>
        </MobileLayout>
      );
    }
    // Until a module's questions are answered (or skipped) it opens on its
    // walk-through. Then the module joins selectedModules, so its own screen,
    // the answer, takes over, and its answers are saved to the user's row.
    if (moduleGuideStarts(mobileActiveModule, d)) {
      return (
        <MobileLayout assist={assistNode} activeTab="modules" pageLabel={moduleLabel}
          headerRight={modulesBackButton}>
          <MobileModuleGuide moduleKey={mobileActiveModule} d={d} m={m} set={set}
            onDone={(how, at) => {
              const selected = d.selectedModules || [];
              if (!selected.includes(mobileActiveModule)) set("selectedModules", [...selected, mobileActiveModule]);
              if (how === "finished" && Array.isArray(d.answeredModules)) set("answeredModules", withAnswered(d, mobileActiveModule).answeredModules);
              posthog.capture(how === "finished" ? "guide_finished" : "guide_skipped", { module: mobileActiveModule, at });
              posthog.capture("module_answer_shown", { module: mobileActiveModule });
              // The first module finished unlocks by itself (unlock.js).
              const firstFree = how === "finished" ? firstUnlockPatch(d, mobileActiveModule) : null;
              if (firstFree) {
                Object.entries(firstFree).forEach(([k, v]) => set(k, v));
                posthog.capture("module_unlocked", { module: mobileActiveModule, via: "first_free" });
                setUnlockSaveTick(t => t + 1);
              }
              // A walk-through, finished, goes on to the answer step by
              // step (MODULE_REVEALS), when there's one to give.
              if (how === "finished" && (firstFree || !isLocked(d, mobileActiveModule)) && MODULE_REVEALS[mobileActiveModule]?.(d, m, { marketRates })) {
                setRevealModule(mobileActiveModule);
                posthog.capture("reveal_shown", { module: mobileActiveModule, from: "walkthrough" });
              }
              setRowSaveTick(t => t + 1);
              scrollToTop();
            }}/>
        </MobileLayout>
      );
    }
    // The module's answer in three steps, or null when there's nothing to
    // explain (no student loan, say): then no reveal and no "Explain this".
    const revealSteps = MODULE_REVEALS[mobileActiveModule]?.(d, m, { marketRates }) ?? null;
    // Answered but locked: what it's worth, and the way to unlock it, which
    // then goes straight on to the answer.
    if (isLocked(d, mobileActiveModule)) {
      return (
        <MobileLayout assist={assistNode} activeTab="modules" pageLabel={moduleLabel}
          headerRight={modulesBackButton}>
          <MobileUnlock moduleKey={mobileActiveModule} d={d} m={m} statuses={statuses}
            onLeaveEmail={email => {
              set("email", email); set("alertsOptIn", true);
              posthog.capture("email_captured", { source: "paywall" });
              setUnlockSaveTick(t => t + 1);
            }}
            onUnlock={(ask, answer) => {
              const patch = unlockPatch(d, mobileActiveModule, ask, answer);
              Object.entries(patch).forEach(([k, v]) => set(k, v));
              posthog.capture("module_unlocked", { module: mobileActiveModule, via: ask.kind, question: ask.question?.id ?? null, answer: ask.kind === "question" ? answer : null, call_ok: ask.kind === "email" ? !!answer.callOk : null });
              if (ask.kind === "email") { posthog.capture("email_captured", { source: "unlock", call_ok: !!answer.callOk }); if (answer.callOk) set("alertsOptIn", true); }
              setUnlockSaveTick(t => t + 1);
              if (revealSteps) setRevealModule(mobileActiveModule);
            }}/>
        </MobileLayout>
      );
    }
    if (revealModule === mobileActiveModule && revealSteps) {
      return (
        <MobileLayout assist={assistNode} activeTab="modules" pageLabel={moduleLabel}
          headerRight={modulesBackButton}>
          <MobileModuleReveal moduleKey={mobileActiveModule} steps={revealSteps} limits={moduleLimits(mobileActiveModule, d, m)}
            onDone={(how, step) => {
              posthog.capture(how === "finished" ? "reveal_finished" : "reveal_skipped", { module: mobileActiveModule, step });
              setRevealModule(null);
              scrollToTop();
            }}/>
        </MobileLayout>
      );
    }
    return (
      <MobileLayout assist={assistNode} activeTab="modules" pageLabel={moduleLabel} headerRight={editInputsFor(mobileActiveModule)}>
        {/* Keyed by module, so each module page opens fresh, every tile collapsed,
            however it's reached. */}
        <MobileModuleDeepDive key={mobileActiveModule} moduleKey={mobileActiveModule}
          onShowReveal={revealSteps ? () => { setRevealModule(mobileActiveModule); posthog.capture("reveal_shown", { module: mobileActiveModule, from: "replay" }); } : null} d={d} m={m} statuses={statuses} savingsRates={savingsRates} set={set}
          isComplete={completedModules.includes(mobileActiveModule)}
          onMarkReviewed={() => markModuleComplete(mobileActiveModule)}
          onBack={() => navigate("/app/modules")}
          onRecordLoanOverpayment={recordLoanOverpayment}
          onRecordCrystallisedGain={recordCrystallisedGain}/>
      </MobileLayout>
    );
  }

  return <Navigate to="/" replace />;
}
