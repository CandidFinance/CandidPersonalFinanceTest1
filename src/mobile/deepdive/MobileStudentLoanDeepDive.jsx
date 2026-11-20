import { useState, useRef, useId, Children, cloneElement } from "react";
import { GROWTH_NOMINAL_PCT } from "../../lib/growth.js";
import { useElementWidth } from "../useElementWidth.js";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Check, CircleAlert, Pencil, Wrench, ChartLine, AlertTriangle, Info, ChevronDown } from "lucide-react";
import { calcStudentLoanScenario, calcOverpaymentScenarios, describeLoanVsPension, pgScenario, loanCostComparison, bestLumpSum, lumpToClear, SL_REPAYMENT_THRESHOLDS, SL_REPAYMENT_RATES, slFirstDueRange, pensionCaveat, savingsRateName, SL_RPI_LONG_RUN } from "../../lib/studentLoan.js";
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
import YearPicker, { yearInRange } from "../YearPicker.jsx";
import { loanVerdictReady, loanPensionChecked, loanSavingsIn, loanIsaIn, hasEmployerMatch } from "../../lib/appEntry.js";
import { premiumOpen } from "../../lib/unlock.js";
import { ON_TRACK_FLOOR } from "../../lib/moduleStatus.js";
import LoanBalanceEditor from "../LoanBalanceEditor.jsx";
import LoanCompare, { loanCompareSummary } from "./LoanCompare.jsx";
import LoanChain, { RatesArt, BufferArt, FanArt } from "./LoanChain.jsx";
import ScenarioModelling from "./ScenarioModelling.jsx";
import { runPlan } from "../../lib/loanPlan.js";
import { studentLoanDecision } from "../../lib/valueMetrics.js";
import useDecisionLog from "../useDecisionLog.js";
import { PAY_GROWTH_OPTIONS } from "../../lib/moduleGuide.js";
import { calcLoanMarginalReturnCurve } from "../../lib/forecast.js";
import { fmt, fmtK } from "../../lib/format.js";
import { salaryGrowthOf, trajectoryNearest, payPathOf, SALARY_GROWTH_MIN_PCT, SALARY_GROWTH_MAX_PCT } from "../../lib/metrics.js";
import { PillSlider } from "../PillSlider.jsx";
import PillMoneyInput from "../PillMoneyInput.jsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import MobileTile, { TileRow, ROW, RowText, withIcon, Nested, TilePopover, anchor } from "../MobileTile.jsx";
import InfoButton from "../InfoButton.jsx";
import { G, GOLD, WHITE, MUT, TEXT, CRITICAL, SUCCESS, STUDENT_PURPLE, CASH_BLUE, GOLD_TEXT, SANS, SERIF, TILE_KICKER } from "../../design-tokens.js";
import ModuleBand from "../ModuleBand.jsx";

// £ in thousands, to one place under £100k: £18.5k, £3.9k, £15k, £120k.
const k = n => { const v = Math.abs(Math.round(n || 0)); return v >= 100000 ? `£${Math.round(v / 1000)}k` : v >= 1000 ? `£${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : fmt(v); };

// Overpayment slider stops — round amounts, dropping any that sit within 10%
// of the full balance (e.g. a £20,500 loan shouldn't show both "£20k" and
// "Full" — they're practically the same repayment) and always ending on the
// exact full balance itself.
function buildOverpayOptions(loanBal) {
  const bal = Math.round(loanBal || 0);
  if (bal <= 0) return [];
  const round = [1000, 5000, 10000, 20000].filter(x => x < bal * 0.9);
  return [...round, bal];
}
// The page's top, on the dark band (ModuleBand): what not paying it off
// early loses a year, the same sum the Modules card shows (moduleStatus.js
// s.studentLoan: the main loan's yearly gain, the Postgraduate loan's, and
// a lump sum's gain spread over the years to clearing), then what that comes
// to in all. Before the verdict (savings and pension in), only what it waits
// on; with nothing to gain, £0 and why.
export function StudentLoanBand({ d, m, status, statusTone, onShowReveal, onEditInputs }) {
  const band = { title: "Student loan", status, statusTone, onShowReveal, onEditInputs };
  if (d.studentLoan === "none" || !(m.loanBal > 0)) return <ModuleBand {...band} line="No student loan on record."/>;
  const sl = calcStudentLoanScenario(d, m);
  if (sl.belowThreshold) {
    return <ModuleBand {...band} line={m.noEarnings ? "Nothing is repaid while you're not earning." : "You earn below the repayment threshold, so nothing comes off your pay."}/>;
  }
  if (!loanVerdictReady(d)) {
    const missing = [!loanSavingsIn(d) && "savings", hasEmployerMatch(d) && !loanPensionChecked(d) && "pension"].filter(Boolean);
    return <ModuleBand {...band} line={`Whether paying it off early comes out ahead depends on your ${missing.join(" and your ")}, which ${missing.length > 1 ? "aren't" : "isn't"} in yet.`}/>;
  }
  const pg = pgScenario(d, m);
  const lump = bestLumpSum(m, sl, m.surplusCash || 0);
  const main = sl.worthOverpaying ? sl.overpayAnnualBenefit : 0;
  const pgGain = pg?.worthOverpaying ? pg.overpayAnnualBenefit : 0;
  const lumpYearly = lump ? Math.round(lump.saving / Math.max(1, lump.clearYr)) : 0;
  const total = main + pgGain + lumpYearly;
  if (!(total > 0)) {
    const why = !sl.willClear
      ? `It's expected to be written off in April ${sl.writeOffTaxYear}. Overpaying would mostly go on debt that's written off anyway.`
      : sl.effectiveBenefit > 0
        ? `The loan's ${sl.lifeRatePct}% average rate is only just above ${savingsRateName(sl)}, ${sl.cashRate}%, so the interest saved and the savings interest given up come out level.`
        : `${cap(savingsRateName(sl))}, ${sl.cashRate}%, is ${sl.effectiveBenefit < 0 ? "more than" : "the same as"} the loan's ${sl.lifeRatePct}% average rate.`;
    // The £ is the answer; the line names what it measures, the same measure
    // as the non-zero band below, never a yes/no (Harvey, 19 Nov 2026).
    return <ModuleBand {...band} figure={fmt(0)} suffix="a year" line="Lost to loan interest above what savings pay, on your figures." note={why}/>;
  }
  const line = main > 0 ? "Lost to loan interest above what savings pay"
    : lump ? `Lost to interest by not paying ${k(lump.amount)} off now`
    : "Lost to Postgraduate loan interest above what savings pay";
  const inAll = main > 0 ? `${fmt(sl.overpayTotalBenefit)} lost in all by April ${clearedBy(sl)}, more if your savings interest is taxed.`
    : lump ? `${fmt(lump.saving)} in all, in today's money after savings interest, cleared in ${lump.clearYr === 1 ? "a year" : `${lump.clearYr} years`}.`
    : "From your Postgraduate loan alone.";
  const pgPart = pgGain > 0 && pgGain < total ? ` Includes ${fmt(pgGain)} a year on your Postgraduate loan.` : "";
  // Under the Modules card's floor (statusLabel.js "On track"), no £ as the
  // headline either, but the in-all £ the tile below adds up to.
  if (total < ON_TRACK_FLOOR) {
    return <ModuleBand {...band} line="Little in it either way: paying it off early comes out under £50 a year ahead of savings." note={`${inAll}${pgPart}`}/>;
  }
  return <ModuleBand {...band} figure={fmt(total)} suffix="a year" line={line} note={`${inAll}${pgPart}`}/>;
}

// The April a loan that clears is cleared by (as ClearOrWriteOff says it),
// or a plan's clearing year on the same scale.
const clearedBy = (sl, clearYr = sl.clearYr) => sl.writeOffTaxYear - sl.writeOffYr + clearYr;

// A tile's explanation, from its "…" menu: the item, and the pop-out it
// opens over the tile (Cash's "How this is worked out").
function useHow(title, body, label = "How this is worked out") {
  const [open, setOpen] = useState(false);
  const item = body && { icon: Info, label: open ? "Hide the explanation" : label, onClick: () => setOpen(o => !o) };
  const pop = (
    <AnimatePresence>
      {open && body && (
        <TilePopover key="how" title={title} onClose={() => setOpen(false)} style={{top:"44px"}}>
          <p style={{...ROW.text,margin:0}}>{body}</p>
        </TilePopover>
      )}
    </AnimatePresence>
  );
  return [item, pop];
}

// Full mobile version of desktop's Student Loan deep dive (ModuleDeepDive,
// moduleKey==="studentLoan" — CandidApp.jsx), as MobileTiles (rows on the
// tile, never a tile inside one), after Pension: the Opportunity tile and
// whether the money is spare; the balance, its chart and its figures; What
// ifs, the calculators (a repayment plan, salary growth, a lump sum, the
// return on each £1 overpaid against the pension), one open at a time; a
// Postgraduate loan; where the money does most; and whether overpaying beats
// saving. calcStudentLoanScenario/calcOverpaymentScenarios/
// calcLoanMarginalReturnCurve are the same single source of truth desktop
// and computeModuleStatuses use, so the numbers can't drift between mobile
// and desktop.
export default function MobileStudentLoanDeepDive({ d, m, set, savingsRates, onRecordLoanOverpayment, onEditInputs }) {
  // The what-if open under its row in What ifs: one at a time.
  const [whatIf, setWhatIf] = useState(null);
  const toggleWhatIf = key => setWhatIf(w => w === key ? null : key);
  const [editingBalance, setEditingBalance] = useState(false);
  // null = still following the overpayment slider automatically; a number
  // once the user types their own value into the editor, which then stops
  // tracking further slider movement (their explicit edit wins).
  const [manualBalanceInput, setManualBalanceInput] = useState(null);
  // Model your loan and Repayment plans start as squares in Planning
  // (Harvey, 18 and 19 Nov 2026): large, and only for anyone who wants to
  // model it.
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  // The return chart opens under its What ifs row, inside the plans square:
  // measured again whenever either opens (a new chart element each time).
  const [chartWrapRef, chartWidth] = useElementWidth(300, [whatIf === "return", plansOpen]);
  const [balanceChartRef, balanceChartWidth] = useElementWidth(300, [balanceOpen]);
  // The lump sum being modelled (LumpSum, in What ifs): none until one's
  // picked, so the chart starts as it is.
  const [overpayAmt, setOverpayAmt] = useState(0);

  // The write-off assumption's editor (below); hooks stay above the return.
  const [editingStart, setEditingStart] = useState(false);
  const [startInput, setStartInput] = useState(null);
  // A payment added to or changed in a plan (ScenarioModelling): back up to
  // the chart, where the plan's line glows once (BalanceChart planFlash).
  const [planFlash, setPlanFlash] = useState(0);
  // The overpay-or-leave answer, once it's in, for the value measures.
  useDecisionLog(d, set, m.loanBal > 0 ? studentLoanDecision(d, m) : null);
  // Where it does most: its explanation, from its menu.
  const compareHow = useHow("How this is worked out",
    "The same money in each place, valued on the date your loan would end, largest first. It starts from your whole balance, or the cash spare above your buffer when that's less; to try another amount, set the lump sum in Model your loan. Paying it into the loan is worth the repayments you'd no longer make, kept in savings. Figures resting on assumed growth can come out higher or lower.");

  if (d.studentLoan === "none" || m.loanBal <= 0) {
    return null; // The band says so (StudentLoanBand).
  }

  const sl = calcStudentLoanScenario(d, m);
  const pg = pgScenario(d, m);
  // Whether paying it off comes out ahead: only once Cash and
  // Pension are answered (appEntry.js loanVerdictReady).
  const verdict = loanVerdictReady(d);
  const worthOverpaying = verdict && sl.worthOverpaying;
  // A lump sum against every place it could go (LoanCompare): premium. Others
  // keep the £100 a month view above, and once the verdict's ready and the
  // pension's checked, the comparison's top row and the way to subscribe.
  const compareOpen = premiumOpen(d);
  const pensionChecked = loanPensionChecked(d);
  const surplusCash = m.surplusCash || 0;
  const curve = calcLoanMarginalReturnCurve(d, m, sl, chartWidth);

  const overpayOptionsBase = buildOverpayOptions(m.loanBal);
  const { scenarios, baseProjection } = calcOverpaymentScenarios(m, sl, [overpayAmt]);
  const selectedScenario = scenarios[0];
  const cost = loanCostComparison(m, sl);
  // A subscriber's repayment plan on the chart (ScenarioModelling), beside
  // the lump sum: the one picked, once it has a payment in it.
  const shownPlan = compareOpen ? (d.slPlans || []).find(p => p.id === d.slPlanShown && p.items?.length) : null;
  const planRun = shownPlan ? runPlan(m, sl, shownPlan) : null;
  // Heading for write-off: the smallest lump sum that clears it, and the
  // best one from spare cash if it comes out ahead counting savings interest.
  const tip = lumpToClear(m, sl);
  const lump = verdict ? bestLumpSum(m, sl, m.surplusCash || 0) : null;
  // The tipping point and the Opportunity tile's lump sum are among the
  // amounts offered.
  const overpayOptions = [...new Set([...overpayOptionsBase, tip, lump?.amount].filter(a => a > 0))].sort((x, y) => x - y);
  const showLump = overpayOptions.length > 0 && !sl.belowThreshold;

  const editItem = onEditInputs && { icon: Pencil, label: "Edit my figures", onClick: onEditInputs };
  const openBalanceEditor = () => {
    setManualBalanceInput(null); setEditingBalance(true);
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("sl-balance-row")?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
  };
  const closeBalanceEditor = () => { setEditingBalance(false); setManualBalanceInput(null); };
  // From Planning's menu: opens Model your loan first, once the menu has
  // closed and handed focus back, so the pop-out keeps it.
  const updateBalance = () => { if (!balanceOpen) setBalanceOpen(true); setTimeout(openBalanceEditor, 250); };
  const plans = !!set && !sl.belowThreshold;
  const showPlan = () => {
    setBalanceOpen(true);
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // After the square's 0.25s layout move, so it scrolls to where the chart ends up.
    setTimeout(() => balanceChartRef.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" }), still ? 50 : 320);
    setPlanFlash(n => n + 1);
  };
  // The tiles under the band, as a chain each leading to the next
  // (LoanChain): the sum behind the band's £ (Overpaying), whether the money
  // to pay it off is spare, where the same money does most, then the tools
  // to model it (Planning). Each only where it applies.
  const spareAmount = worthOverpaying ? cost.balance : lump ? lump.amount : null;
  const compareShown = !sl.belowThreshold && (compareOpen || (verdict && pensionChecked));
  // The money the spare square leads on to, until another sum's picked in
  // Model your loan: what's spare above the buffer when that falls short of
  // paying it off (Harvey, 20 Nov 2026), otherwise the sum it checks.
  const whereAmt = overpayAmt > 0 ? overpayAmt
    : spareAmount != null && surplusCash > 0 && surplusCash < spareAmount ? Math.round(surplusCash)
    : spareAmount ?? 0;
  const comparePlan = compareOpen && planRun ? { name: shownPlan.name, run: planRun } : null;
  const compareSum = compareShown ? loanCompareSummary(d, m, sl, whereAmt, comparePlan) : null;
  const planSaved = plans && planRun ? planRun.base.totalPaid - planRun.totalPaid : null;
  const chain = [
    verdict && sl.willClear && {
      id: "sl-overpaying", title: "Overpaying", look: CHAIN_LOOK.overpay, art: <RatesArt/>,
      // A loss in red, against keeping the money in savings; with none, why.
      headline: fmt(sl.overpayTotalBenefit), color: sl.overpayTotalBenefit > 0 ? CRITICAL : G,
      line: sl.overpayTotalBenefit > 0 ? `lost by keeping the money in savings instead, by April ${clearedBy(sl)}` : worthOverpaying ? "lost, little in it either way" : "lost, as savings earn at least what the loan costs",
      body: p => <OverpayingTile sl={sl} worthOverpaying={worthOverpaying} m={m} surplusCash={surplusCash} menu={[editItem]} showSpare={spareAmount == null} {...p}/>,
    },
    spareAmount != null && {
      id: "sl-spare", title: "Is the money spare?", look: CHAIN_LOOK.spare, art: <BufferArt/>,
      // The answer on every branch: what's above the buffer (£0 too), and
      // when it falls short, of what (the amount the next square moves).
      headline: fmt(surplusCash), line: surplusCash >= spareAmount ? `spare above your buffer, enough for the ${fmt(spareAmount)} to pay it off` : `above your buffer, short of the ${fmt(spareAmount)} to pay it off`,
      body: p => <SpareCheck d={d} m={m} sl={sl} amount={spareAmount} menu={[editItem]} {...p}/>,
    },
    compareSum && {
      id: "sl-compare", title: compareSum.title, look: CHAIN_LOOK.where, art: <FanArt/>,
      headline: compareSum.headline, line: compareSum.line,
      body: p => <LoanCompare d={d} m={m} sl={sl} set={set} open={compareOpen} picked={whereAmt} plan={comparePlan} menu={[editItem]} how={compareHow} {...p}/>,
    },
    {
      id: "sl-planning", title: "Planning", look: CHAIN_LOOK.overpay,
      inner: ({ rect }) => <PlanningParts sl={sl} plans={plans} curve={curve} saved={planSaved} rect={rect}/>,
      body: p => planningTile(p),
    },
  ];
  const planningTile = p => (
      <PlanningTile d={d} sl={sl} menu={[editItem]} subscriber={compareOpen} onUpdateBalance={set ? updateBalance : null} {...p}
        balanceOpen={balanceOpen} toggleBalance={() => setBalanceOpen(o => !o)} plansOpen={plansOpen} togglePlans={() => setPlansOpen(o => !o)}
        plans={plans} curve={curve} planRun={planRun} planName={shownPlan?.name}
        balance={
          <BalancePanel d={d} m={m} sl={sl} set={set} savingsRates={savingsRates} overpayAmt={overpayAmt} setOverpayAmt={setOverpayAmt}
            overpayOptions={overpayOptions} showLump={showLump} tip={tip} selectedScenario={selectedScenario} baseProjection={baseProjection} worthOverpaying={worthOverpaying}
            planRun={planRun} planName={shownPlan?.name} planFlash={planFlash} balanceChartRef={balanceChartRef} balanceChartWidth={balanceChartWidth}
            editingBalance={editingBalance} openBalanceEditor={openBalanceEditor} closeBalanceEditor={closeBalanceEditor} manualBalanceInput={manualBalanceInput} setManualBalanceInput={setManualBalanceInput}
            editingStart={editingStart} setEditingStart={setEditingStart} startInput={startInput} setStartInput={setStartInput}/>
        }
        whatIfs={
          <WhatIfsPanel d={d} m={m} sl={sl} set={set} plans={plans} whatIf={whatIf} toggleWhatIf={toggleWhatIf} subscriber={compareOpen} planRun={planRun} showPlan={showPlan}
            curve={curve} chartWrapRef={chartWrapRef}/>
        }/>
  );
  // 1. The answer is on the band above the page (StudentLoanBand); under
  // it, what it waits on, then the chain.
  return (
    <div>
      {!verdict && !sl.belowThreshold && <NeedsDetails d={d} menu={[editItem]}/>}
      <LoanChain items={chain}/>
      {pg && <PostgradLoan pg={pg} sl={sl} menu={[editItem]}/>}
    </div>
  );
}

// Each chain tile's fill (LoanChain), in its picture's colour family:
// white for the sums, gold for the cash, blue for where it goes.
const CHAIN_LOOK = {
  overpay: { bg: WHITE, border: "1px solid rgba(22,47,36,0.08)", art: G },
  spare: { bg: "#fbf6ea", border: "1px solid rgba(196,150,58,0.25)", art: GOLD },
  where: { bg: "#f2f6fb", border: "1px solid rgba(26,111,163,0.18)", art: CASH_BLUE },
};

// Planning's closed square in the chain: its two parts as small tiles, so
// what's inside shows before it's opened. Stacked in a square, side by side
// in a rectangle.
function PlanningParts({ sl, plans, curve, saved, rect }) {
  const both = plans || !!curve;
  const part = (look, title, value, art) => (
    // Tint alone, no border: content of the one square, not cards to tap.
    <span style={{flex:1,minWidth:0,minHeight:0,position:"relative",overflow:"hidden",borderRadius:"9px",background:look.bg,padding:"5px 10px",display:"flex",flexDirection:"column",justifyContent:rect ? "flex-start" : "center",boxSizing:"border-box",color:look.art}}>
      {/* The picture low on the right, clear of the title. */}
      <span aria-hidden="true" style={{position:"absolute",right:"6px",bottom:"4px",width:"30px",height:"22px",display:"flex"}}>{art}</span>
      {/* Wrapping, never cut short: each part has room for two lines of each. */}
      <span style={{position:"relative",...TILE_KICKER,fontFamily:SANS,fontSize:"11px",lineHeight:1.25,color:"#585858"}}>{title}</span>
      <span style={{position:"relative",fontSize:"12px",fontWeight:700,lineHeight:1.25,color:G,marginTop:"3px",paddingRight:"8px"}}>{value}</span>
    </span>
  );
  return (
    <span style={{flex:1,width:"100%",display:"flex",flexDirection:rect ? "row" : "column",gap:"6px"}}>
      {part(PLAN_LOOK.model, "Model your loan", `${fmt(sl.totalRepaidProjected)} repaid, ${sl.willClear ? `cleared April ${clearedBy(sl)}` : `written off ${sl.writeOffTaxYear}`}`, <FallingArt/>)}
      {both && part(PLAN_LOOK.plans, plans ? "Repayment plans" : "Vs your pension",
        saved != null ? `${fmt(Math.abs(saved))} ${saved >= 0 ? "saved" : "costs more"}` : plans ? "Paying it off sooner" : "Each £1 compared",
        plans ? <BarsArt/> : <PensionArt/>)}
    </span>
  );
}

// Your balance: whether it clears or is written off, the balance year by
// year, and under it the figures that move it, open: salary growth, which
// decides most whether the loan clears, and a lump sum paid today. Then the
// figures behind it, a row each on one line, the two the user can correct
// (the balance, and when repayments started, which sets the write-off) with
// a spanner that pops their input out from the row (TilePopover).
// Opened from its square in Planning (PlanningTile).
function BalancePanel({ d, m, sl, set, savingsRates, overpayAmt, setOverpayAmt, overpayOptions, showLump, tip, selectedScenario, baseProjection, worthOverpaying, planRun, planName, planFlash, balanceChartRef, balanceChartWidth, editingBalance, openBalanceEditor, closeBalanceEditor, manualBalanceInput, setManualBalanceInput, editingStart, setEditingStart, startInput, setStartInput }) {
  // Suggests the balance after paying the currently-selected slider amount,
  // rather than a blank/current-balance starting point — if the user came
  // here having just modelled an overpayment, that's almost certainly the
  // figure they're about to confirm. Stays live-synced to the slider
  // (recomputed every render, not snapshotted on open) until the user types
  // their own value, and re-syncs the next time the editor is opened fresh.
  const suggestedBalance = Math.max(0, Math.round(m.loanBal) - (overpayAmt || 0));
  const balanceInput = manualBalanceInput != null ? manualBalanceInput : suggestedBalance;
  // When repayments started decides when the loan is written off. Estimated
  // from age unless the user says (studentLoan.js slFirstDueYear).
  // Only a year the plan allows (studentLoan.js slFirstDueRange).
  const startValue = startInput ?? String(sl.firstDueYear);
  const startRange = slFirstDueRange(d.studentLoan);
  const startOk = yearInRange(startValue, startRange);
  const closeStart = () => { setEditingStart(false); setStartInput(null); };
  const saveStart = () => {
    if (!startOk) return;
    if (set) set("slFirstDueYear", String(+startValue));
    closeStart();
  };
  const resetStart = () => { if (set) set("slFirstDueYear", ""); closeStart(); };
  const pill = { flex:1, borderRadius:"100px", padding:"10px", fontSize:"13px", fontWeight:600, fontFamily:"inherit" };
  const growth = set ? growthRowOf(d, m) : null;
  return (
    <>
      <TileRow first><ClearOrWriteOff sl={sl}/></TileRow>

      <TileRow>
        <div ref={balanceChartRef} style={{width:"100%"}}>
          <BalanceChart sl={sl} width={balanceChartWidth} alt={selectedScenario?.path} altLabel={overpayAmt > 0 ? `With ${fmt(overpayAmt)} paid now` : null}
            plan={planRun?.path} planLabel={planRun ? planName : null} planFlash={planFlash}/>
        </div>
      </TileRow>

      {/* The figures the chart moves with, open under it. */}
      {set && (
        <TileRow>
          <RowText inline label="Salary growth" note={growth.path ? "set year by year" : growth.inTen ? `${fmtK(growth.inTen)} in 10 years` : null} figure={`+${growth.pct}%/yr`}/>
          <div style={{marginTop:"8px"}}><PayGrowth d={d} m={m} set={set}/></div>
        </TileRow>
      )}
      {showLump && (
        <TileRow id="sl-lump">
          <RowText inline label="Lump sum" note={overpayAmt > 0 ? "paid today, the gold line" : tip ? `clears it from ${k(tip)}` : "paid today"}/>
          <div style={{marginTop:"8px"}}>
            <LumpSum m={m} sl={sl} tip={tip} overpayAmt={overpayAmt} setOverpayAmt={setOverpayAmt} options={overpayOptions} scenario={selectedScenario} base={baseProjection} worthOverpaying={worthOverpaying}/>
          </div>
        </TileRow>
      )}

      {/* The figures behind it; what's left as it is explained under
          "Total you'll repay". */}
      <LoanStats sl={sl} balanceLabel="Estimated balance" balance={m.loanBal} balanceId="sl-balance-row"
        balanceTool={set && <Spanner label="Update your loan balance" open={editingBalance} onClick={editingBalance ? closeBalanceEditor : openBalanceEditor}/>}
        balancePopover={editingBalance && (
          <TilePopover key="balance" title="Update your balance" onClose={closeBalanceEditor}>
            <LoanBalanceEditor bare d={d} m={m} set={set} savingsRates={savingsRates} initial={balanceInput} onClose={closeBalanceEditor}/>
          </TilePopover>
        )}
        cost={sl.belowThreshold ? null : loanCostComparison(m, sl)}/>

      {/* When repayments started sets the write-off date at the top. */}
      <TileRow style={anchor}>
        <RowText inline label="Repaying since" note={sl.firstDueEstimated ? "estimated" : null} figure={`April ${sl.firstDueYear}`}
          tool={set && <Spanner label="Change when repayments started" open={editingStart} onClick={() => (editingStart ? closeStart() : setEditingStart(true))}/>}/>
        <AnimatePresence>
          {editingStart && (
            <TilePopover key="start" title="When repayments started" onClose={closeStart}>
              <YearPicker label="April of" range={startRange} value={startValue} onChange={v => setStartInput(v)} blankLabel={null}/>
              <p style={{...ROW.note,marginTop:"10px"}}>
                Usually the April after you left your course. Your payslips or your online student loan account will show it. It sets when the loan is written off.
              </p>
              <div style={{display:"flex",gap:"8px",marginTop:"12px"}}>
                <button type="button" onClick={sl.firstDueEstimated ? closeStart : resetStart} style={{...pill,background:"transparent",border:"1.3px solid rgba(22,47,36,0.2)",color:G,cursor:"pointer"}}>
                  {sl.firstDueEstimated ? "Cancel" : "Use the estimate"}
                </button>
                <button type="button" onClick={saveStart} disabled={!startOk} style={{...pill,background:startOk ? G : "rgba(22,47,36,0.2)",border:"none",color:WHITE,cursor:startOk ? "pointer" : "not-allowed"}}>Save</button>
              </div>
            </TilePopover>
          )}
        </AnimatePresence>
      </TileRow>
    </>
  );
}

// Planning (Harvey, 19 Nov 2026): Model your loan and Repayment plans as two
// filled squares side by side, as Home's £100k tax trap tile: the title, a
// large faint picture behind it (the balance falling; payments as bars), and
// one figure where there is one. Opened, a square moves to the top at the
// full width with its calculators in it, and the other sits under it. Only
// the square's own header opens and closes it. The menu holds both
// explanations.
function PlanningTile({ d, sl, menu, subscriber, onToggle = null, style, onUpdateBalance, balanceOpen, toggleBalance, plansOpen, togglePlans, plans, curve, planRun, planName, balance, whatIfs }) {
  const [modelHow, modelPop] = useHow("How the model works",
    `Year by year: interest is added at the loan's rate, and ${Math.round((SL_REPAYMENT_RATES[d.studentLoan] ?? 0.09) * 100)}% of your pay over ${fmt(sl.threshold)} comes off, with your salary growing as set in the model. Whatever is left in April ${sl.writeOffTaxYear} is written off, and you don't repay it.`,
    "How the model works");
  const both = !!(plans || curve);
  const plansLabel = plans ? "How the plans work" : "How the pension comparison works";
  const [plansHow, plansPop] = useHow(plansLabel,
    both && (plans
      ? "Each works from your balance, pay and pension as they are in Candid. A repayment plan you make shows as its own line on Model your loan's chart."
      : "What each £1 overpaid returns, against the same £1 paid into your pension, from your balance, pay and pension as they are in Candid."),
    plansLabel);
  // The plan on the chart's saving, as its calculator gives it
  // (ScenarioModelling).
  const saved = plans && planRun ? planRun.base.totalPaid - planRun.totalPaid : null;
  // A square on its own row (the other one open, or the only one) is a
  // full-width rectangle with room for one more line (Harvey, 19 Nov 2026).
  // It stays one until the other has folded away, not as soon as it starts
  // closing (each square's own `wide`, mirrored here).
  const reduce = useReducedMotion();
  const [balanceWide, setBalanceWide] = useState(balanceOpen);
  const [plansWide, setPlansWide] = useState(plansOpen);
  if (balanceOpen && !balanceWide) setBalanceWide(true);
  if (plansOpen && !plansWide) setPlansWide(true);
  if (reduce && !balanceOpen && balanceWide) setBalanceWide(false);
  if (reduce && !plansOpen && plansWide) setPlansWide(false);
  // Both squares' open and settled states: what their layout moves follow.
  const moves = `${both}${balanceOpen}${plansOpen}${balanceWide}${plansWide}`;
  // One fact a line, worded as the rows they repeat.
  const modelDetail = [sl.willClear ? `Cleared by April ${clearedBy(sl)}` : `${fmt(sl.writeOffBal)} written off April ${sl.writeOffTaxYear}`,
    sl.annualRep > 0 ? `${fmt(sl.annualRep)} repayments this year` : "No repayments this year"];
  // A plan cleared at once (year 0) reads as ScenarioModelling's "Cleared / Today".
  const plansDetail = !plans
    ? ["What each £1 overpaid returns,", "against the same £1 in your pension"]
    : planRun
      ? [planRun.clearYr === 0 ? "Cleared today on this plan" : planRun.clearYr != null ? `Cleared by April ${clearedBy(sl, planRun.clearYr)} on this plan` : `${fmt(planRun.writeOffBal)} written off on this plan`]
      : [subscriber ? "Scenario modelling" : "Scenario modelling, for subscribers", ...(curve ? ["Overpaying vs your pension"] : [])];
  return (
    <MobileTile id="sl-planning" title="Planning"
      subtitle={plans ? "Your balance year by year, and plans to pay it off sooner, worked out on your figures."
        : curve ? "Your balance year by year, and overpaying against your pension, worked out on your figures."
        : "Your balance year by year, worked out on your figures."}
      menu={[onUpdateBalance && { icon: Wrench, label: "Update your balance", onClick: onUpdateBalance }, modelHow, plansHow, ...menu]}
      open={onToggle ? true : undefined} onToggle={onToggle} style={style}>
      {modelPop}{plansPop}
      <div style={{display:"flex",flexWrap:"wrap",gap:"16px",alignItems:"flex-start",padding:"0 16px 16px 0"}}>
        <PlanSquare id="sl-balance" title="Model your loan" open={balanceOpen} onToggle={toggleBalance} onClosed={() => setBalanceWide(false)} moves={moves} full={!both || plansWide} look={PLAN_LOOK.model} art={<FallingArt/>}
          headline={fmt(sl.totalRepaidProjected)} line="you'll repay in all" detail={modelDetail}>
          {balance}
        </PlanSquare>
        {both && (
          <PlanSquare id="sl-whatifs" title={plans ? "Repayment plans" : "Vs your pension"} open={plansOpen} onToggle={togglePlans} onClosed={() => setPlansWide(false)} moves={moves} full={balanceWide} look={PLAN_LOOK.plans} art={plans ? <BarsArt/> : <PensionArt/>} detail={plansDetail}
            headline={saved != null ? fmt(Math.abs(saved)) : null} line={saved != null ? `${saved >= 0 ? "saved" : "costs more"} with ${planName}` : null}>
            {whatIfs}
          </PlanSquare>
        )}
      </div>
    </MobileTile>
  );
}

// Each square's fill, as Home's light tiles (HERO_TILE_BG) but with no
// warm corner (no beige, Harvey 19 Nov 2026): green for the model, a lilac
// wash for plans, after the plan's purple line on the chart.
const PLAN_LOOK = {
  model: {
    bg: [
      "radial-gradient(120% 95% at 0% 0%, #E6F0EA 0%, rgba(230,240,234,0) 62%)",
      "radial-gradient(90% 80% at 100% 0%, #E8F3EF 0%, rgba(232,243,239,0) 60%)",
      "#F5F9F6",
    ].join(", "),
    border: "1px solid rgba(22,47,36,0.10)", art: G,
  },
  plans: {
    bg: [
      "radial-gradient(120% 95% at 0% 0%, #EEE5F4 0%, rgba(238,229,244,0) 62%)",
      "radial-gradient(90% 80% at 100% 0%, #F2EBF7 0%, rgba(242,235,247,0) 60%)",
      "#F9F7FB",
    ].join(", "),
    border: "1px solid rgba(138,79,174,0.20)", art: STUDENT_PURPLE,
  },
};

// One of Planning's squares. Closed: a filled square, its title and chevron
// at the top, its picture faint and centred behind, and its figure, if it
// has one, at the foot. Open: first in the tile at the full width, in the
// same fill, its header the way to close it.
function PlanSquare({ id, title, open, onToggle, onClosed, moves = "", full = false, look, art, headline = null, line = null, detail = null, children }) {
  const reduce = useReducedMotion();
  // As Home's trap tile (TrapTile.jsx): the square grows into place, and
  // its header moves with it at its own size, its contents fading in.
  // Closing runs in two steps, so a tall square
  // (Model your loan) doesn't snap: the contents fold away first, then the
  // square settles back (`wide` follows `open` once they've gone).
  const move = { duration: 0.25 };
  const [wide, setWide] = useState(open);
  if (open && !wide) setWide(true);
  if (reduce && !open && wide) setWide(false);
  // Layout moves only when a square opens, closes or settles (this one's or
  // its sibling's, `moves`). Without it, a figure changing inside (the salary
  // slider flipping cleared to written off) or a line changing higher up the
  // page played as the square leaping up and sliding back.
  const moveKey = `${moves}|${open}|${wide}`;
  const ref = useRef(null);
  const toggle = () => {
    // Closing from further down: back up to the square as it folds.
    const top = ref.current?.getBoundingClientRect().top ?? 0;
    if (open && top < 80) window.scrollBy({ top: top - 80, behavior: reduce ? "auto" : "smooth" });
    onToggle();
  };
  const kicker = <span style={{...TILE_KICKER,fontFamily:SANS,lineHeight:1.3,color:"#585858"}}>{title}</span>;
  const chevron = <ChevronDown size={16} color="#585858" strokeWidth={2.5} aria-hidden="true" style={{flexShrink:0,transform:open ? "rotate(180deg)" : "none",transition:"transform 0.2s"}}/>;
  // Closed on its own row: a short full-width rectangle, the picture to the
  // right, and the detail line under the £.
  const rect = !wide && full;
  // Muted, under the £ and its caption: secondary to both. One fact a line;
  // on a narrow phone a long one wraps rather than being cut off.
  const detailLines = rect && detail?.length > 0 && (
    <span style={{display:"flex",flexDirection:"column",marginTop:headline == null ? 0 : "4px",fontSize:"12px",color:"#585858",lineHeight:1.45,maxWidth:"70%"}}>
      {detail.map(t => <span key={t}>{t}</span>)}
    </span>
  );
  return (
    <motion.div ref={ref} id={id} layout={!reduce} layoutDependency={moveKey} transition={move}
      style={{order:wide ? -1 : 0,position:"relative",overflow:"hidden",width:wide || full ? "100%" : "calc(50% - 8px)",...(!wide && (full ? { minHeight: headline == null ? "96px" : "120px" } : { aspectRatio:"1" })),
        background:look.bg,border:look.border,boxShadow:"0 4px 18px rgba(22,47,36,0.06)",borderRadius:"14px",boxSizing:"border-box",display:"flex",flexDirection:"column",scrollMarginTop:"80px"}}>
      {/* The picture, faint and centred in the square. */}
      {!wide && (
        <motion.span layout={reduce ? false : "position"} layoutDependency={moveKey} aria-hidden="true"
          initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...move, opacity: { duration: 0.2 } }}
          style={{position:"absolute",...(rect ? { top:0, right:0, bottom:0, width:"30%", padding:"40px 16px 16px 0" } : { inset:0, padding:"52px 8% 6%" }),boxSizing:"border-box",display:"flex",pointerEvents:"none",color:look.art}}>{art}</motion.span>
      )}
      <motion.button layout={reduce ? false : "position"} layoutDependency={moveKey} transition={move} type="button" onClick={toggle} aria-expanded={open}
        style={{position:"relative",display:"flex",flexDirection:"column",justifyContent:rect && headline == null ? "flex-start" : "space-between",gap:"10px",flex:wide ? "none" : 1,width:"100%",background:"none",border:"none",
          padding:wide ? "14px 16px 10px" : "14px 16px 16px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",color:"inherit"}}>
        <span style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"6px",width:"100%"}}>{kicker}{chevron}</span>
        {!wide && headline != null && (
          <span style={{display:"flex",flexDirection:"column",gap:"4px"}}>
            <span style={{fontFamily:SERIF,fontSize:"26px",fontWeight:700,color:G,lineHeight:1,letterSpacing:"-0.01em"}}>{headline}</span>
            {/* Two lines at most, so a long plan name can't push the £ out of the square. */}
            {line && <span title={line} style={{fontSize:"12px",fontWeight:700,color:G,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{line}</span>}
            {rect && detailLines}
          </span>
        )}
        {headline == null && detailLines}
      </motion.button>
      <AnimatePresence initial={false} onExitComplete={() => { setWide(false); onClosed?.(); }}>
        {open && (
          <motion.div key="contents" layout={reduce ? false : "position"} layoutDependency={moveKey}
            // Opening, only a fade: the square's own growth carries it (an
            // unfolding height fights that and overshoots).
            initial={reduce ? false : { opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.2 } }}
            style={{position:"relative",paddingLeft:"16px",overflow:"hidden"}}>
            {/* Each panel's first row passes TileRow `first`: no rule above it. */}
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// The squares' pictures, in their square's colour (currentColor), faint.
// A balance falling to nothing.
// The area under the line fades out, so it doesn't read as a grey block.
function FallingArt() {
  const fade = `fall-${useId().replace(/:/g, "")}`;
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 80" preserveAspectRatio="xMidYMid meet" style={{display:"block"}}>
      <defs>
        <linearGradient id={fade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.07"/>
          <stop offset="1" stopColor="currentColor" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d="M6 4 L30 14 L46 11 L72 28 L94 36 L94 76 L6 76 Z" fill={`url(#${fade})`}/>
      <path d="M6 4 L30 14 L46 11 L72 28 L94 36" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.11"/>
      <circle cx="94" cy="36" r="6" fill="currentColor" opacity="0.14"/>
    </svg>
  );
}
// Payments as bars, one a year.
function BarsArt() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 80" preserveAspectRatio="xMidYMid meet" style={{display:"block"}}>
      {[[6, 46], [26, 34], [46, 60], [66, 24], [86, 40]].map(([x, h]) => <rect key={x} x={x} y={76 - h} width="12" height={h} rx="3" fill="currentColor" opacity="0.12"/>)}
    </svg>
  );
}
// Each £1 overpaid against the same £1 in the pension: two lines rising.
function PensionArt() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 80" preserveAspectRatio="xMidYMid meet" style={{display:"block"}}>
      <path d="M6 70 C 36 64, 64 44, 94 12" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.16"/>
      <path d="M6 72 C 40 68, 70 58, 94 46" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray="8 8" opacity="0.12"/>
    </svg>
  );
}

// The spanner beside a figure the user can correct: pops its input out from
// the row. Kept within the row's line height, so the row's depth matches
// its neighbours'.
function Spanner({ label, open, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-haspopup="dialog" aria-expanded={!!open} className="tap44"
      style={{background:"rgba(22,47,36,0.06)",border:"none",borderRadius:"50%",width:"24px",height:"24px",margin:"-2px 0",display:"inline-flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,padding:0}}>
      <Wrench size={12} color={MUT}/>
    </button>
  );
}

// What ifs: a row each, its calculator opening under it, one at a time. A
// repayment plan moves the balance chart above; the other weighs each £1
// overpaid against the pension.
// Opened from its square in Planning (PlanningTile).
function WhatIfsPanel({ d, m, sl, set, plans, whatIf, toggleWhatIf, subscriber, planRun, showPlan, curve, chartWrapRef }) {
  return (
    <>
      {plans && (
        <ScenarioModelling first expanded={whatIf === "plans"} onToggle={() => toggleWhatIf("plans")} d={d} m={m} sl={sl} set={set} open={subscriber} run={planRun} onPlanSaved={showPlan}/>
      )}
      {curve && (
        <>
          <TileRow first={!plans} onClick={() => toggleWhatIf("return")} expanded={whatIf === "return"}>
            {withIcon(ChartLine, <RowText label="Overpaying vs your pension" note="What each £1 overpaid returns, against the same £1 in your pension"/>)}
          </TileRow>
          {whatIf === "return" && <Nested><ReturnChart sl={sl} curve={curve} chartWrapRef={chartWrapRef}/></Nested>}
        </>
      )}
    </>
  );
}

// Salary growth as its row in Your balance shows it: the rate, and the salary it
// comes to in ten years; or, with pay set year by year, the average rate
// that comes to (the same figures PayGrowth works with).
function growthRowOf(d, m) {
  const salary = m.salary || 0;
  const path = payPathOf(d, +d.salary || 0, m.taxYear);
  if (path) return { path: true, pct: Math.round((Math.pow(path.factor(10), 0.1) - 1) * 1000) / 10, inTen: Math.round(salary * path.factor(10) / 100) * 100 };
  const exact = salaryGrowthOf(d) * 100;
  return { path: false, pct: Math.round(exact * 10) / 10, inTen: salary > 0 ? salaryInTen(salary, exact) : 0 };
}
// A salary after ten years at `pct`% a year, to the nearest £100.
const salaryInTen = (salary, pct) => Math.round(salary * Math.pow(1 + pct / 100, 10) / 100) * 100;

// Salary growth, their own: 1% to 10% a year for ten years, then with
// prices (growth.js payFactor). Set as a rate on the slider, or the other
// way round, as the salary they expect then (the rate it takes kept to the
// same range). Opens under its What ifs row, which shows the rate and the
// salary it comes to. It's the one pay growth figure the whole app uses
// (metrics.js salaryGrowthOf).
function PayGrowth({ d, m, set }) {
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState(null);
  const salary = m.salary || 0;
  const exact = salaryGrowthOf(d) * 100;
  const pct = Math.round(exact * 10) / 10;
  const inTen = p => salaryInTen(salary, p);
  // To 0.01%, so a typed figure comes back as typed.
  const keep = p => Math.min(SALARY_GROWTH_MAX_PCT, Math.max(SALARY_GROWTH_MIN_PCT, Math.round(p * 100) / 100));
  const setPct = p => { set("salaryGrowthPct", String(keep(p))); set("salaryTrajectory", trajectoryNearest(keep(p))); };
  // The rate a typed figure takes, before it's kept to the range.
  const implied = typed > 0 && salary > 0 ? Math.round((Math.pow(typed / salary, 0.1) - 1) * 1000) / 10 : null;
  const shown = p => Math.round(p * 10) / 10;
  const onType = v => { setTyped(v); if (v > 0 && salary > 0) setPct((Math.pow(v / salary, 0.1) - 1) * 100); };
  const link = { background:"none", border:"none", padding:0, color:G, fontSize:"12px", fontWeight:600, textDecoration:"underline", cursor:"pointer", fontFamily:"inherit" };
  // Pay by year in use (Scenario modelling): it sets pay, not the slider.
  if (payPathOf(d, +d.salary || 0, m.taxYear)) return (
    <button type="button" onClick={() => set("payByYear", [])} className="tap44" style={link}>Use a % instead</button>
  );
  return (
    <div>
      {typing && salary > 0
        ? <PillMoneyInput label="Your salary in 10 years" value={typed} onChange={onType}/>
        : <input type="range" min={SALARY_GROWTH_MIN_PCT} max={SALARY_GROWTH_MAX_PCT} step="0.5" value={pct} aria-label="Salary growth a year"
            onChange={e => setPct(+e.target.value)} style={{width:"100%",accentColor:G,margin:0}}/>}
      {typing && implied != null && (implied < SALARY_GROWTH_MIN_PCT || implied > SALARY_GROWTH_MAX_PCT) && (
        <p style={{...ROW.note,margin:"6px 0 0"}}>
          That's {implied}% a year. Candid works between {SALARY_GROWTH_MIN_PCT}% and {SALARY_GROWTH_MAX_PCT}% a year, so it uses {shown(keep(implied))}%.
        </p>
      )}
      {salary > 0 && (
        <button type="button" onClick={() => { setTyping(t => !t); setTyped(typing ? null : inTen(exact)); }} className="tap44" style={{...link,marginTop:"8px"}}>
          {typing ? "Enter a % instead" : "Enter your salary in 10 years instead"}
        </button>
      )}
    </div>
  );
}

// The answer the rest of the tile explains: whether the loan clears before
// it's written off, and so whether paying early changes what's repaid. Plain
// pounds only; whether it beats savings is the Opportunity tile's answer.
// Year 1 is this tax year, so a loan cleared in year n is cleared by April
// taxYear + n, and the write-off is in April taxYear + writeOffYr.
// Under it, one line: whether the balance is falling (the turning point,
// where repayments overtake the interest), the write-off, and what paying
// early does.
function ClearOrWriteOff({ sl }) {
  const figure = sl.willClear ? `Cleared by April ${clearedBy(sl)}` : `Written off April ${sl.writeOffTaxYear}`;
  const [lead, turning] = sl.balanceFallingNow
    ? ["Falling", "repayments outpace interest"]
    : sl.turningTaxYear
      ? [`Rising until April ${sl.turningTaxYear}`, "then repayments outpace interest"]
      : ["Rising", "repayments never outpace interest"];
  const parts = sl.willClear
    ? [`Write-off April ${sl.writeOffTaxYear}`, "Paying early lowers total cost"]
    : [`${fmt(sl.writeOffBal)} written off`, "Paying early mostly shrinks that"];
  const dot = <span aria-hidden="true" style={{color:MUT,margin:"0 6px"}}>•</span>;
  return (
    <div>
      <div style={{fontFamily:SANS,fontSize:"13px",color:G,fontWeight:700,lineHeight:1.15}}>{figure}</div>
      <div style={{fontSize:"12px",color:TEXT,lineHeight:1.5,marginTop:"4px"}}>
        <span style={{color:G,fontWeight:700}}>{lead}:</span> {turning}{dot}{parts[0]}{dot}{parts[1]}
      </div>
    </div>
  );
}

// The figures behind it, a row each on one line: today's balance and what's
// repaid in all, then this year's interest and this year's repayments (from
// today's pay, so salary growth doesn't move them). `balanceTool`: the
// spanner beside the balance, popping out `balancePopover` from its row.
// With `cost` (studentLoan.js loanCostComparison), "Total you'll repay" has
// a ? that pops out what that total is made of and what paying it off
// today would cost instead.
function LoanStats({ sl, balanceLabel, balance, balanceId, balanceTool = null, balancePopover = null, cost = null }) {
  const [why, setWhy] = useState(false);
  return (
    <>
      <TileRow id={balanceId} style={anchor}>
        <RowText inline label={balanceLabel} tool={balanceTool} figure={fmt(balance)}/>
        <AnimatePresence>{balancePopover}</AnimatePresence>
      </TileRow>
      <TileRow style={anchor}>
        <RowText inline label="Total you'll repay" figure={fmt(sl.totalRepaidProjected)}
          tool={cost && <span style={{display:"inline-flex",margin:"-4px 0"}}><InfoButton onClick={() => setWhy(w => !w)} open={why}/></span>}/>
        <AnimatePresence>
          {cost && why && (
            <TilePopover key="why" title="What you'll repay" onClose={() => setWhy(false)}>
              <p style={{...ROW.text,margin:0}}>
                {sl.willClear
                  ? `${fmt(cost.balance)} owed + ${fmt(cost.interest)} interest, over ${cost.years === 1 ? "a year" : `${cost.years} years`}: about ${fmt(cost.interestPerYear)} of interest a year.`
                  : `Repaid over ${cost.years} years, before the rest is written off.`}
                {" "}{cost.payNowSaves >= 0
                  ? `Paying it off today would cost ${fmt(cost.balance)}, ${fmt(cost.payNowSaves)} less in all, before what the money could earn elsewhere meanwhile.`
                  : `Paying it off today would cost ${fmt(cost.balance)}, ${fmt(-cost.payNowSaves)} more than you'd ever repay.`}
              </p>
            </TilePopover>
          )}
        </AnimatePresence>
      </TileRow>
      <TileRow><RowText inline label="Interest this year" note={`at ${sl.slRatePct}%`} figure={`${fmt(sl.annualInterest)}/yr`}/></TileRow>
      <TileRow><RowText inline label="Repayments this year" figure={`${fmt(sl.annualRep)}/yr`}/></TileRow>
    </>
  );
}

// A Postgraduate loan alongside the main one (studentLoan.js pgScenario):
// repaid at the same time, with its own interest and write-off date.
// Its last row: both loans' repayments this year together, the main loan's
// (Your balance) plus this one's (the row above it).
function PostgradLoan({ pg, sl, menu }) {
  const [howItem, howPop] = useHow("How this is worked out",
    `Repaid at the same time as your main loan: 6% of pay over ${fmt(SL_REPAYMENT_THRESHOLDS.postgrad)}, on top of 9% over ${fmt(sl.threshold)}. It has its own interest rate and write-off date.`);
  return (
    <MobileTile title="Postgraduate loan" menu={[howItem, ...menu]}>
      {howPop}
      <TileRow first><ClearOrWriteOff sl={pg}/></TileRow>
      <LoanStats sl={pg} balanceLabel="Current balance" balance={pg.balancePath[0]?.bal ?? 0}/>
      <TileRow><RowText inline label={<span style={{fontWeight:700}}>Both loans this year</span>} note={`${fmt(sl.annualRep)} + ${fmt(pg.annualRep)}`} figure={`${fmt(Math.round(sl.annualRep) + Math.round(pg.annualRep))}/yr`}/></TileRow>
    </MobileTile>
  );
}

// A lump sum paid today, modelled on the chart above as its second line:
// when it would clear, and what it saves (or costs) in all against letting
// it run. Paying on the Student Loans Company's site, where it comes out
// ahead and there's cash to spare.
// Heading for write-off (`tip`, the smallest lump sum that clears it):
// below it a lump sum mostly shrinks what's written off; from it, it clears,
// and what that's worth is given in today's money too, counting what the
// money would earn in savings, since in plain pounds it can look better
// than it is.
function LumpSum({ m, sl, tip, overpayAmt, setOverpayAmt, options, scenario, base, worthOverpaying }) {
  const full = Math.round(m.loanBal);
  const saved = scenario ? base.totalPaid - scenario.totalPaid : 0;
  // Or typed as a £ amount, as PayGrowth's salary in 10 years; no more than
  // the balance. Back to the chips: a typed amount that isn't one goes.
  // Reopened with a typed amount (the square unmounts this; the amount is
  // kept above): back in the box, not a slider with no chip picked.
  const ownAmount = overpayAmt > 0 && !options.includes(overpayAmt);
  const [typing, setTyping] = useState(ownAmount);
  const [typed, setTyped] = useState(ownAmount ? overpayAmt : null);
  const onType = v => { setTyped(v); setOverpayAmt(v > 0 ? Math.min(Math.round(v), full) : 0); };
  const toggleTyping = () => {
    if (typing && !options.includes(overpayAmt)) setOverpayAmt(0);
    setTyped(typing ? null : overpayAmt > 0 ? overpayAmt : null);
    setTyping(t => !t);
  };
  const link = { background:"none", border:"none", padding:0, color:G, fontSize:"12px", fontWeight:600, textDecoration:"underline", cursor:"pointer", fontFamily:"inherit" };
  const stat = (label, value) => (
    <div>
      <div style={{fontSize:"11px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{label}</div>
      <div style={{fontFamily:SANS,fontSize:"13px",color:G,fontWeight:700,marginTop:"2px"}}>{value}</div>
    </div>
  );
  return (
    <div>
      {typing
        ? <PillMoneyInput label="Lump sum repayment" value={typed} onChange={onType}/>
        : <PillSlider compact onTint label="Lump sum repayment" value={overpayAmt} onChange={setOverpayAmt} options={[{ value:0, label:"None" }, ...options.map(a => ({ value:a, label: a === full ? "All" : fmtK(a) }))]}/>}
      {typing && typed > full && (
        <p style={{fontSize:"12px",color:MUT,lineHeight:1.45,margin:"6px 0 0"}}>That's more than the {fmt(full)} you owe, so it uses {fmt(full)}.</p>
      )}
      <button type="button" onClick={toggleTyping} className="tap44" style={{...link,marginTop:"8px"}}>
        {typing ? "Pick an amount instead" : "Enter your own amount"}
      </button>
      {/* Whether it's spare: against cash above the emergency buffer. */}
      {overpayAmt > 0 && (m.expensesUnknown
        ? <p style={{fontSize:"12px",color:MUT,lineHeight:1.45,margin:"6px 0 0"}}>Add your monthly spending in Cash to check you could spare this.</p>
        : overpayAmt > (m.surplusCash || 0) && (
          <div style={{display:"flex",gap:"6px",alignItems:"flex-start",fontSize:"12px",lineHeight:1.45,color:TEXT,marginTop:"6px"}}>
            <CircleAlert size={13} color={CRITICAL} style={{flexShrink:0,marginTop:"1px"}}/>
            {(m.surplusCash || 0) > 0
              ? `More than the ${fmt(Math.round(m.surplusCash))} you have above your ${m.bufferMonths}-month cash buffer.`
              : `You have no cash above your ${m.bufferMonths}-month buffer, so this would come from it.`}
          </div>
        ))}
      {!scenario && tip && (
        <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>Under {k(tip)} it mostly shrinks what's written off. From {k(tip)} it clears before write-off.</p>
      )}
      {scenario && (
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginTop:"12px"}}>
            {stat(scenario.clearYr === 0 ? "Cleared" : scenario.clearYr ? "Clears in" : "Written off", scenario.clearYr === 0 ? "Today" : scenario.clearYr ? `${scenario.clearYr} yrs` : fmt(scenario.writeOffBal))}
            {stat(saved >= 0 ? "Saves in all" : "Costs more", fmt(Math.abs(saved)))}
            {stat("You'd pay in all", fmt(scenario.totalPaid))}
          </div>
          <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>
            Against {base.clearYr ? `clearing in ${base.clearYr} yrs` : `${fmt(base.writeOffBal)} written off`} and {fmt(base.totalPaid)} paid in all, as it is.{saved < 0 && !scenario.clearYr ? " It would mostly shrink what's written off." : ""}
            {!base.clearYr && scenario.clearYr > 0 && (() => {
              const diff = scenario.paidToday - base.paidToday;
              return ` In today's money, counting what the ${k(overpayAmt)} would earn in savings at ${sl.cashRate}%, it costs ${k(Math.abs(diff))} ${diff < 0 ? "less" : "more"}.`;
            })()}
            {!base.clearYr && !scenario.clearYr && tip ? ` From ${k(tip)} it clears before write-off instead.` : ""}
          </p>
          {worthOverpaying && (m.surplusCash || 0) > 0 && (
            <a href="https://www.gov.uk/sign-in-to-manage-your-student-loan-balance" target="_blank" rel="noopener noreferrer" style={{
              marginTop:"12px",width:"100%",background:G,color:WHITE,borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,
              display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",textDecoration:"none",boxSizing:"border-box",
            }}>
              Overpay on the SLC site <ExternalLink size={14}/>
            </a>
          )}
        </>
      )}
    </div>
  );
}

// Until Cash and Pension are answered, whether paying it off early comes out
// ahead can't be said (the band says so): whether the money's spare, and
// whether paying the loan off beats saving or the pension, depend on them.
// A row each, leading to Cash & savings' short route (moduleGuide.js
// briefQuestions) or Pension's and back; a tick once it's in.
function NeedsDetails({ d, menu }) {
  const navigate = useNavigate();
  const [howItem, howPop] = useHow("How this is worked out",
    "Paying the loan off early comes out ahead only if it saves more interest than the money would earn in savings, and doesn't cost you an employer's pension match. Your savings and pension are what that's checked against.");
  const step = (done, to, label) => done
    ? <TileRow key={label} align><RowText inline label={label} figure={<Check size={17} color={SUCCESS} strokeWidth={3} role="img" aria-label="Added"/>}/></TileRow>
    : <TileRow key={label} onClick={() => navigate(to)}><RowText inline label={`Add ${label.toLowerCase()}`}/></TileRow>;
  return (
    <MobileTile title="Is paying it off early worth it?" subtitle="A few more details show the full trade-offs." menu={[howItem, ...menu]}>
      {howPop}
      {step(loanSavingsIn(d), "/app/module/cash?from=studentLoan", "Your savings")}
      {hasEmployerMatch(d) && step(loanPensionChecked(d), "/app/module/pension?from=studentLoan", "Your pension")}
    </MobileTile>
  );
}

// Whether the money to pay it off is spare: how the cash buffer, this year's
// ISA allowance and the employer's pension match stand. As they are, not an
// order to do things in.
// `onToggle`, `style`: opened in the chain (LoanChain), where it also
// carries the spare cash row (from Overpaying).
function SpareCheck({ d, m, sl, amount, menu, onToggle = null, style }) {
  const navigate = useNavigate();
  // Each point leads with its topic, in bold, for anyone scanning.
  const items = [];
  if (m.expenses > 0) {
    // The explanation says what the buffer is before what paying does to it.
    const buffer = `Your cash buffer is ${m.bufferMonths} month${m.bufferMonths === 1 ? "" : "s"} of spending (${fmt(Math.round(m.emergencyBuffer))}).`;
    items.push((m.surplusCash || 0) >= amount
      ? { topic: "Cash runway", ok: true, text: "Good", long: `${buffer} Paying it off would still leave that in cash, so your cash runway isn't affected.` }
      : { topic: "Cash runway", ok: false, text: `Leaves under ${m.bufferMonths} months' cash`, long: `${buffer} Paying it off would leave ${fmt(Math.max(0, Math.round(m.emergencyFund - amount)))} in cash, under that, cutting your cash runway.` });
  } else items.push({ topic: "Cash runway", ok: null, text: "Not checked yet", long: "Your spending isn't in yet, so whether paying it off would cut your cash runway can't be checked (Cash)." });
  if (loanIsaIn(d)) {
    items.push(m.isaHeadroom > 0
      // Allowance left is a fact, not a fault: an info mark, not a warning.
      ? { topic: "ISA allowance", ok: "info", text: `${k(m.isaHeadroom)} remaining`, long: `${k(m.isaHeadroom)} of this year's ISA allowance is unused. Growth in an ISA is tax-free, and the allowance is use it or lose it on 5 April; the loan isn't.` }
      : { topic: "ISA allowance", ok: true, text: "Used", long: "This year's ISA allowance is used, so there's no tax-free allowance this money would miss." });
  }
  // An employer's match beats any overpayment: critical until it's checked
  // (Pension's short route), and while any of it is missed.
  if (hasEmployerMatch(d)) {
    const checked = loanPensionChecked(d);
    items.push(!checked
      ? { topic: "Pension match", ok: "critical", text: "Not checked yet", long: "Your employer may match what you pay into your pension. Paying in up to the match beats overpaying.", add: "Add your pension" }
      : d.pensionStatus === "no"
        ? { topic: "Pension match", ok: "critical", text: "Not paying into a pension", long: "Most employers pay into your pension when you do, which beats overpaying.", add: "See your full pension answer" }
        : m.missedMatch > 0
          ? { topic: "Pension match", ok: "critical", text: `${k(m.missedMatch)}/yr unclaimed`, long: `${fmt(Math.round(m.missedMatch))} a year of your employer's pension match is unclaimed. Every £1 paid in up to the match gets another £1 from them, plus tax relief: more than overpaying returns.`, add: "See your full pension answer" }
          : { topic: "Pension match", ok: true, text: "Full match", long: "You get your employer's full pension match, so overpaying doesn't miss any money they'd add." });
  }
  // A pension's assumed growth beating the loan: flagged, with its caveats.
  const caveat = pensionCaveat(sl);
  if (caveat) items.push({ topic: "Pension growth", ok: false, text: `${sl.pensionGrowthPct}% a year, not guaranteed`, long: caveat });
  const [howItem, howPop] = useHow("How this is worked out",
    `What paying ${k(amount)} off now would leave: the cash you'd still hold against ${m.bufferMonths} months of spending, any of this year's ISA allowance unused, and whether your employer's pension match is all claimed.`);
  // Which row's explanation is open.
  const [open, setOpen] = useState(null);
  // A row each: the icon in line with the topic, and what it shows where a
  // row's £ goes, in a note's type. A tap opens what it means or, with more
  // to add, leads to Pension.
  const icon = it => it.ok === true
    ? <Check size={18} color={SUCCESS} strokeWidth={3} role="img" aria-label="Fine" style={{flexShrink:0}}/>
    : it.ok === "info" ? <Info size={18} color={MUT} role="img" aria-label="For information" style={{flexShrink:0}}/>
    : <CircleAlert size={18} color={it.ok === "critical" ? CRITICAL : it.ok === false ? GOLD_TEXT : MUT} role="img" aria-label={it.ok === "critical" ? "Critical" : it.ok === false ? "Worth a look" : "Not known"} style={{flexShrink:0}}/>;
  return (
    <MobileTile title="Is the money spare?" subtitle={`Paying it off uses ${k(amount)}`} menu={[howItem, ...menu]} open={onToggle ? true : undefined} onToggle={onToggle} style={style}>
      {howPop}
      {onToggle && <SpareCashRow m={m} surplusCash={m.surplusCash || 0} alone/>}
      {items.map(it => (
        <div key={it.topic} style={anchor}>
          <TileRow onClick={it.add ? () => navigate(loanPensionChecked(d) ? "/app/module/pension" : "/app/module/pension?from=studentLoan") : () => setOpen(o => o === it.topic ? null : it.topic)}>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              {icon(it)}
              <div style={{flex:1,minWidth:0}}>
                <RowText label={it.topic} figure={it.text} figureStyle={{...ROW.note,fontWeight:400,marginTop:0,whiteSpace:"normal",textAlign:"right",maxWidth:"55%"}}/>
              </div>
            </div>
          </TileRow>
          <AnimatePresence>
            {open === it.topic && (
              <TilePopover key={it.topic} title={it.topic} onClose={() => setOpen(null)}>
                <p style={{...ROW.text,margin:0}}>{it.long}</p>
              </TilePopover>
            )}
          </AnimatePresence>
        </div>
      ))}
    </MobileTile>
  );
}

// The balance year by year (sl.balancePath), its peak marked: the peak is
// the turning point, where repayments overtake the interest.
// `alt`: the same, with a lump sum paid today (calcOverpaymentScenarios), as
// a dashed second line.
// `alt`: a lump sum today, dashed gold; `plan`: a repayment plan
// (ScenarioModelling), purple. Each named in a key at the top. `planFlash`:
// a count that, each time it goes up, makes the plan's line glow once.
const FLASH_CSS = `
.plan-flash { opacity: 0; animation: plan-flash 1.6s ease-out 0.35s; }
@keyframes plan-flash { 0% { opacity: 0; } 25% { opacity: 0.45; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .plan-flash { animation: none; } }
`;
function BalanceChart({ sl, width, alt = null, altLabel = null, plan = null, planLabel = null, planFlash = 0 }) {
  const path = sl.balancePath || [];
  if (path.length < 2) return null;
  const VW = width, VH = 160, PL = 36, PR = 8, PT = 24, PB = 20;
  const lastYr = path[path.length - 1].yr;
  // The y-axis spans the balance's own range, not £0 up, so a hump of a few
  // thousand on a £40k loan is visible; the labelled gridlines keep the scale
  // honest. A loan that clears runs to £0, so its axis starts there anyway.
  const lo = Math.min(...path.map(p => p.bal), ...(alt || []).map(p => p.bal), ...(plan || []).map(p => p.bal)), hi = sl.peakBal;
  const pad = (hi - lo) * 0.25 || hi * 0.05 || 1;
  const yMin = Math.max(0, lo - pad), yMax = hi + pad * 0.5;
  const sx = yr => PL + (yr / lastYr) * (VW - PL - PR);
  const sy = bal => PT + (1 - (bal - yMin) / (yMax - yMin)) * (VH - PT - PB);
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const line = path.map((p, i) => `${i ? "L" : "M"}${sx(p.yr).toFixed(1)},${sy(p.bal).toFixed(1)}`).join(" ");
  const startYear = sl.writeOffTaxYear - sl.writeOffYr;
  // The peak is marked only when the balance climbs to it first and falls
  // after it: today's balance if it's already falling, the last year's if
  // it never turns (then the write-off label covers it).
  const peakIdx = path.findIndex(p => p.bal === sl.peakBal);
  const showPeak = peakIdx > 0 && peakIdx < path.length - 1;
  const peak = path[peakIdx];
  const end = path[path.length - 1];
  const anchorFor = x => (x < VW * 0.25 ? "start" : x > VW * 0.75 ? "end" : "middle");
  // The year the lump sum clears it, on the x-axis under where the dashed
  // line ends: not when it's the start or end year already labelled.
  const altClear = alt?.find(p => p.bal <= 0)?.yr;
  const altX = altClear != null ? sx(altClear) : null;
  const showAltYear = altX != null && altClear !== lastYr && altX - PL > 30 && VW - PR - altX > 30;
  // A faint line each year, so the loan's length reads at a glance: the
  // chart always spans start to end, so a loan clearing in 4 years and one
  // in 3 would otherwise look alike. Every 2, 5 or 10 years when yearly
  // lines would crowd. Labelled every year, or every 2, 5, 10 or 20 where
  // that leaves room, clear of the start, end and lump-sum years already
  // shown.
  const perYear = (VW - PL - PR) / lastYr;
  const step = [1, 2, 5, 10].find(n => n * perYear >= 14) || 10;
  const labelEvery = [1, 2, 5, 10, 20].find(n => n % step === 0 && n * perYear >= 40) || 20;
  const yearLines = [];
  for (let yr = step; yr < lastYr; yr += step) yearLines.push(yr);
  const labelled = yr => yr % labelEvery === 0 && sx(yr) - PL > 44 && VW - PR - sx(yr) > 44 && !(showAltYear && Math.abs(sx(yr) - altX) < 40);
  return (
    <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`} style={{display:"block"}} role="img"
      aria-label={`Loan balance from ${fmt(path[0].bal)} today${showPeak ? `, peaking at ${fmt(peak.bal)}` : ""}, to ${end.bal > 0 ? `${fmt(end.bal)} written off` : "cleared"} in ${startYear + lastYr}`}>
      {yearLines.map(yr => (
        <g key={`yr${yr}`}>
          <line x1={sx(yr)} x2={sx(yr)} y1={PT} y2={VH-PB} stroke="rgba(22,47,36,0.07)" strokeWidth="1"/>
          {labelled(yr) && <text x={sx(yr)} y={VH-4} fontSize="9" fontWeight="600" fill={MUT} textAnchor="middle" opacity="0.8">{startYear + yr}</text>}
        </g>
      ))}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PL} x2={VW-PR} y1={sy(t)} y2={sy(t)} stroke={i ? "rgba(22,47,36,0.08)" : "rgba(22,47,36,0.25)"} strokeWidth={i ? 1 : 1.3}/>
          <text x={PL-6} y={sy(t)+3} fontSize="9" fontWeight="700" fill={MUT} textAnchor="end">{fmtK(Math.round(t / 1000) * 1000)}</text>
        </g>
      ))}
      <path d={line} fill="none" stroke={G} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      {alt && alt.length > 1 && (
        <path d={alt.map((p, i) => `${i ? "L" : "M"}${sx(p.yr).toFixed(1)},${sy(p.bal).toFixed(1)}`).join(" ")}
          fill="none" stroke={GOLD} strokeWidth="2.2" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round"/>
      )}
      {showPeak && (
        <g>
          <circle cx={sx(peak.yr)} cy={sy(peak.bal)} r="4.5" fill={GOLD} stroke={WHITE} strokeWidth="1.5"/>
          <text x={sx(peak.yr)} y={sy(peak.bal) - 10} fontSize="10" fontWeight="700" fill={G} textAnchor={anchorFor(sx(peak.yr))}>Peak {fmt(peak.bal)}</text>
        </g>
      )}
      {/* Under the line's end while it's falling, over it while it's rising,
          so the label never sits on the line itself. */}
      {end.bal > 0 && (
        <text x={VW-PR} y={sy(end.bal) + (end.bal < path[path.length - 2].bal ? 16 : -10)} fontSize="10" fontWeight="700" fill={G} textAnchor="end">{fmt(end.bal)} written off</text>
      )}
      {plan && plan.length > 1 && (() => {
        const planLine = plan.map((p, i) => `${i ? "L" : "M"}${sx(p.yr).toFixed(1)},${sy(p.bal).toFixed(1)}`).join(" ");
        return (
          <g>
            {planFlash > 0 && (
              <g key={planFlash}>
                <style>{FLASH_CSS}</style>
                <path className="plan-flash" d={planLine} fill="none" stroke={STUDENT_PURPLE} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
              </g>
            )}
            <path d={planLine} fill="none" stroke={STUDENT_PURPLE} strokeWidth="2.2" strokeDasharray="1.5 3.5" strokeLinecap="round" strokeLinejoin="round"/>
          </g>
        );
      })()}
      {altLabel && (
        <g>
          <line x1={PL} x2={PL + 16} y1={8} y2={8} stroke={GOLD} strokeWidth="2.2" strokeDasharray="5 4"/>
          <text x={PL + 20} y={11} fontSize="9.5" fontWeight="700" fill={G}>{altLabel}</text>
        </g>
      )}
      {planLabel && plan && (
        <g>
          <line x1={VW - PR - 16} x2={VW - PR} y1={8} y2={8} stroke={STUDENT_PURPLE} strokeWidth="2.2" strokeDasharray="1.5 3.5" strokeLinecap="round"/>
          <text x={VW - PR - 20} y={11} fontSize="9.5" fontWeight="700" fill={G} textAnchor="end">{planLabel}</text>
        </g>
      )}
      <text x={PL} y={VH-4} fontSize="9" fontWeight="700" fill={MUT} textAnchor="start">{startYear}</text>
      <text x={VW-PR} y={VH-4} fontSize="9" fontWeight="700" fill={MUT} textAnchor="end">{startYear + lastYr}</text>
      {showAltYear && (
        <g>
          <line x1={altX} x2={altX} y1={VH-PB} y2={VH-PB+4} stroke={GOLD} strokeWidth="1.5"/>
          <text x={altX} y={VH-4} fontSize="9" fontWeight="700" fill={GOLD_TEXT} textAnchor="middle">{startYear + altClear}</text>
        </g>
      )}
    </svg>
  );
}

// The overpaying tile, straight under the band, in three groups: where
// paying it off comes out ahead, the sum behind the band's "lost in all"
// (the loan interest that would be paid, less the savings interest given
// up: studentLoan.js overpayTotalBenefit, on Where it does most's basis), its total in bold;
// the loan itself; and what else bears on it. Only the total's £ is bold.
// Against savings only: the pension, in £ with tax relief, is Where it does
// most's (Harvey, 18 Nov 2026), so the two can't disagree. The gap between
// the rates says which is higher, not what to do.
// `onToggle`, `style`: opened in the chain (LoanChain). `showSpare`: the
// spare cash row, here unless Is the money spare? carries it.
function OverpayingTile({ sl, worthOverpaying, m, surplusCash, menu, onToggle = null, style, showSpare = true }) {
  const [howItem, howPop] = useHow("How this is worked out",
    `The loan's ${sl.lifeRatePct}% is its average rate over its life: ${sl.lifeRatePct === Math.round(sl.slInterestRate * 1000) / 10 ? "the same rate every year." : `today's rate this year, then the rate your plan sets each year with RPI at Candid's long-run ${SL_RPI_LONG_RUN * 100}%.`} Savings are at ${savingsRateName(sl)}${sl.cashRateOwn ? "" : " (yours isn't in yet)"}. Loan interest is what you'd pay from now until it's cleared. Savings interest is what the money would earn kept in savings until then, less what the repayments you'd no longer make would earn there, before tax. The same basis as Where it does most, so the two agree.`);
  if (!sl.willClear) return null;
  // One loan rate on the tile: its average over its life, what the £ is
  // worked on (Harvey, 20 Nov 2026), today's in brackets once.
  const loanRate = `${sl.lifeRatePct}% on average over its life${sl.lifeRatePct !== sl.slRatePct ? ` (${sl.slRatePct}% today)` : ""}`;
  const saveRate = `${savingsRateName(sl)} (${sl.cashRate}%)`;
  const headline = worthOverpaying
    ? `Your loan's rate, ${loanRate}, is above ${saveRate}.`
    : sl.effectiveBenefit === 0
      ? `Your loan's rate, ${loanRate}, matches ${saveRate}, so overpaying doesn't come out ahead.`
      : `Your loan's rate, ${loanRate}, is below ${saveRate}.`;
  const plain = { fontWeight:400 };
  const gap = sl.effectiveBenefit;
  return (
    <MobileTile id="sl-overpaying" title="Overpaying" subtitle={headline} menu={[howItem, ...menu]} open={onToggle ? true : undefined} onToggle={onToggle} style={style}>
      {howPop}
      {worthOverpaying && (
        <RowGroup>
          <TileRow><RowText label="Loan interest you'd pay" figure={fmt(sl.interestAvoided)} figureStyle={plain} figureOnLabel/></TileRow>
          {/* Taken off in the label, not as a negative £ (Harvey, 19 Nov 2026). */}
          <TileRow><RowText label="Less savings interest you'd give up" note="before tax" figure={fmt(sl.savingsForgone)} figureStyle={plain} figureOnLabel/></TileRow>
          <TileRow><RowText label={<span style={{fontWeight:700}}>Lost in all, by April {clearedBy(sl)}</span>} figure={fmt(sl.overpayTotalBenefit)} figureOnLabel/></TileRow>
        </RowGroup>
      )}
      <RowGroup>
        {sl.balanceGrowing && (
          <TileRow>
            <div style={{...ROW.label,fontWeight:600,color:CRITICAL,display:"flex",alignItems:"center",gap:"8px"}}>
              <AlertTriangle size={18} color={CRITICAL} aria-hidden="true" style={{flexShrink:0}}/>Why your balance is growing
            </div>
            <div style={{...ROW.note,marginLeft:"26px"}}>
              Repayments (9% of what you earn over the threshold) haven't caught up with the interest yet. {sl.turningTaxYear
                ? `With your pay rising as expected, they overtake it from April ${sl.turningTaxYear}, and your balance starts falling.`
                : "On these figures they don't overtake it before the loan is written off."}
            </div>
          </TileRow>
        )}
        <TileRow><RowText label="Outstanding balance" figure={fmt(m.loanBal)} figureStyle={plain} figureOnLabel/></TileRow>
      </RowGroup>
      {/* The buffer is Cash's emergency fund: the row leads to its tile. */}
      <RowGroup>
        {showSpare && <SpareCashRow m={m} surplusCash={surplusCash}/>}
        <TileRow><RowText label="Loan vs your savings" note={`${sl.lifeRatePct}% vs ${sl.cashRate}%`} figureStyle={plain} figureOnLabel
          figure={gap > 0 ? `Loan ${gap}% higher` : gap === 0 ? "Level" : `Savings ${Math.abs(gap)}% higher`}/></TileRow>
      </RowGroup>
    </MobileTile>
  );
}

// The cash held above the emergency buffer, the buffer leading to Cash's
// emergency fund tile (with the way back here, ?back=).
// `alone`: in Is the money spare?, where there's no comparison beside it.
function SpareCashRow({ m, surplusCash, first, style, alone = false }) {
  const navigate = useNavigate();
  const toBuffer = () => navigate("/app/module/cash?back=studentLoan#cash-fund");
  const bufferLink = <button type="button" onClick={toBuffer} className="tap44" style={{background:"none",border:"none",padding:0,font:"inherit",color:"inherit",textDecoration:"underline",textUnderlineOffset:"2px",cursor:"pointer"}}>{m.bufferMonths} months of spending</button>;
  return surplusCash > 0
    ? <TileRow first={first} style={style}><RowText label="Spare cash above your buffer" note={<>Your buffer: {bufferLink}</>} figure={fmt(surplusCash)} figureStyle={{fontWeight:400}} figureOnLabel/></TileRow>
    : <TileRow first={first} style={style}><p style={ROW.text}>You don't currently hold cash above your emergency buffer ({bufferLink}){alone ? "." : "; the comparison still applies to any spare cash you build up."}</p></TileRow>;
}

// Rows that belong together: a hairline above the group, none between its
// rows, and more room above and below it than between them, so the groups
// read apart (Harvey, 18 Nov 2026).
function RowGroup({ children }) {
  const rows = Children.toArray(children).filter(Boolean);
  return rows.map((row, i) => cloneElement(row, {
    first: i > 0 || row.props.first,
    style: { ...row.props.style, padding: `${i ? 6 : 14}px 16px ${i === rows.length - 1 ? 14 : 6}px 0` },
  }));
}

// Under its What ifs row: the return on each £1 overpaid against putting
// it in the pension, with the verdict above the chart.
function ReturnChart({ sl, curve, chartWrapRef }) {
  const { VW, VH, PL, PR, PT, PB, sx, sy, path, pensionPath, yTicks, xTicks } = curve;
  return (
    <>
      <TileRow><p style={{...ROW.text,fontWeight:500}}>{describeLoanVsPension(sl)}</p></TileRow>
      <TileRow>
        <div ref={chartWrapRef} style={{width:"100%"}}>
          <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`} style={{display:"block"}}>
            {yTicks.map(r => (
              <g key={r}>
                <line x1={PL} x2={VW-PR} y1={sy(r)} y2={sy(r)} stroke="rgba(22,47,36,0.08)" strokeWidth="1"/>
                <text x={PL-6} y={sy(r)+3} fontSize="9" fontWeight="700" fill={MUT} textAnchor="end">{r.toFixed(2)}×</text>
              </g>
            ))}
            <path d={path} fill="none" stroke={G} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            {/* Drawn over the loan line, dashed, so it stays visible where the two coincide */}
            <path d={pensionPath} fill="none" stroke={GOLD} strokeWidth="1.6" strokeDasharray="5,3"/>
            <line x1={PL} x2={VW-PR} y1={VH-PB} y2={VH-PB} stroke="rgba(22,47,36,0.25)" strokeWidth="1.3"/>
            {xTicks.map((amt,i) => (
              <text key={i} x={sx(amt)} y={VH-PB+13} fontSize="9" fontWeight="700" fill={MUT} textAnchor={i===0?"start":i===xTicks.length-1?"end":"middle"}>{fmtK(amt)}</text>
            ))}
            <line x1={PL} x2={PL} y1={PT} y2={VH-PB} stroke="rgba(22,47,36,0.25)" strokeWidth="1.3"/>
          </svg>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:"6px 14px",marginTop:"8px"}}>
          <span style={{display:"flex",alignItems:"center",gap:"6px"}}>
            <span style={{width:"14px",height:"2px",background:G,display:"inline-block"}}/>
            <span style={{fontSize:"11px",color:MUT}}>Overpaying</span>
          </span>
          <span style={{display:"flex",alignItems:"center",gap:"6px"}}>
            <span style={{width:"14px",height:"2px",background:GOLD,display:"inline-block"}}/>
            <span style={{fontSize:"11px",color:MUT}}>Your pension over the same years, {sl.pensionGrowthPct}% a year</span>
          </span>
        </div>
        <p style={{...ROW.note,marginTop:"6px",marginBottom:0}}>Tax relief isn't included: you'd get it whether you pay in now or once the loan clears.</p>
      </TileRow>
    </>
  );
}
