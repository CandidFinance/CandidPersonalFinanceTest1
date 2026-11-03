import { useState } from "react";
import { GROWTH_NOMINAL_PCT } from "../../lib/growth.js";
import { useElementWidth } from "../useElementWidth.js";
import { useNavigate } from "react-router-dom";
import { loanAlternatives } from "../../lib/crossModule.js";
import { ExternalLink, ChevronRight, Check, CircleAlert, Lock, Clock, Pencil, Wrench, ChartLine, AlertTriangle } from "lucide-react";
import { calcStudentLoanScenario, calcOverpaymentScenarios, describeLoanVsPension, pgScenario, loanCostComparison, bestLumpSum, lumpToClear, SL_REPAYMENT_THRESHOLDS, slFirstDueRange, pensionCaveat } from "../../lib/studentLoan.js";
import YearPicker, { yearInRange } from "../YearPicker.jsx";
import { loanVerdictReady, loanPensionChecked, loanSavingsIn, loanIsaIn, hasEmployerMatch } from "../../lib/appEntry.js";
import { hasAccess } from "../../lib/entitlement.js";
import LoanBalanceEditor from "../LoanBalanceEditor.jsx";
import LoanCompare from "./LoanCompare.jsx";
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
import { AnimatePresence } from "framer-motion";
import MobileTile, { TileRow, ROW, RowText, withIcon, Nested, TilePopover, anchor } from "../MobileTile.jsx";
import InfoButton from "../InfoButton.jsx";
import { OPPORTUNITY_TILE_BORDER, OPPORTUNITY_TILE_SHADOW, G, GOLD, WHITE, MUT, TEXT, SERIF, OPPORTUNITY_TILE_BG, OPPORTUNITY_TILE_LABEL, OPPORTUNITY_TILE_FIGURE, OPPORTUNITY_TILE_BODY, OPPORTUNITY_TILE_RADIUS, CRITICAL, SUCCESS, STUDENT_PURPLE, GOLD_TEXT } from "../../design-tokens.js";
import OpportunityTile from "./OpportunityTile.jsx";

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
  // The return chart opens under its What ifs row: measured once it's open.
  const [chartWrapRef, chartWidth] = useElementWidth(300, [whatIf === "return"]);
  const [balanceChartRef, balanceChartWidth] = useElementWidth(300);
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

  if (d.studentLoan === "none" || m.loanBal <= 0) {
    return <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.6}}>No student loan on record.</p>;
  }

  const sl = calcStudentLoanScenario(d, m);
  const pg = pgScenario(d, m);
  // Whether paying it off comes out ahead: only once Cash & savings and
  // Pension are answered (appEntry.js loanVerdictReady).
  const verdict = loanVerdictReady(d);
  const worthOverpaying = verdict && sl.worthOverpaying;
  const pensionChecked = loanPensionChecked(d);
  // Where the money could go instead: for subscribers (and anyone from
  // before the paywall), or once their savings and pension match are in.
  const alternativesOpen = (verdict && pensionChecked) || hasAccess() || d.unlockGate !== true;
  // A lump sum against every place it could go (LoanCompare): subscribers,
  // and anyone from before the paywall. Others keep the £100 a month view
  // above, with the comparison's top row and the way to subscribe.
  const compareOpen = hasAccess() || d.unlockGate !== true;
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
  const smooth = () => (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: smooth(), block: "start" });
  const showPlan = () => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    balanceChartRef.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
    setPlanFlash(n => n + 1);
  };
  // The Opportunity tile's lump sum, picked under the chart.
  const seeLump = () => { setOverpayAmt(lump.amount); scrollTo("sl-balance"); };
  // Where overpaying is weighed against saving, when that tile is shown.
  const toOverpaying = verdict && sl.willClear ? () => scrollTo("sl-overpaying") : null;

  return (
    <div>
      {!verdict && <LockedOpportunity d={d}/>}
      {worthOverpaying && (
        <>
          <OpportunityTile style={{marginBottom:"12px"}}
            figures={[{ value: `${fmt(sl.overpayAnnualBenefit)}/yr`, label: `Lost to interest above savings rates, ${fmt(sl.overpayTotalBenefit)} over the loan's life` }]}
            chips={[`~${k(sl.interestAvoided)} interest avoided`, `~${k(sl.savingsForgone)} savings interest forgone`]}
            action={{ label: "See how", onClick: toOverpaying || (() => scrollTo("sl-balance")) }}/>
          <SpareCheck d={d} m={m} sl={sl} amount={cost.balance} menu={[editItem]}/>
        </>
      )}
      {verdict && !worthOverpaying && !lump && !sl.belowThreshold && <NoGain sl={sl} onSeeWhy={toOverpaying}/>}
      {lump && (
        <>
          <OpportunityTile style={{marginBottom:"12px"}}
            figures={[{ value: fmt(lump.saving), label: `Lost to interest by not paying ${k(lump.amount)} off now, in today's money` }]}
            chips={[`Cleared in ${lump.clearYr} years, net of savings interest`]}
            action={showLump ? { label: "See how", onClick: seeLump } : undefined}/>
          <SpareCheck d={d} m={m} sl={sl} amount={lump.amount} menu={[editItem]}/>
        </>
      )}

      <BalanceTile d={d} m={m} sl={sl} set={set} savingsRates={savingsRates} menu={[editItem]} overpayAmt={overpayAmt} setOverpayAmt={setOverpayAmt}
        overpayOptions={overpayOptions} showLump={showLump} tip={tip} selectedScenario={selectedScenario} baseProjection={baseProjection} worthOverpaying={worthOverpaying}
        planRun={planRun} planName={shownPlan?.name} planFlash={planFlash} balanceChartRef={balanceChartRef} balanceChartWidth={balanceChartWidth}
        editingBalance={editingBalance} setEditingBalance={setEditingBalance} manualBalanceInput={manualBalanceInput} setManualBalanceInput={setManualBalanceInput}
        editingStart={editingStart} setEditingStart={setEditingStart} startInput={startInput} setStartInput={setStartInput}/>

      <WhatIfs d={d} m={m} sl={sl} set={set} menu={[editItem]} whatIf={whatIf} toggleWhatIf={toggleWhatIf} subscriber={compareOpen} planRun={planRun} showPlan={showPlan}
        curve={curve} chartWrapRef={chartWrapRef}/>

      {pg && <PostgradLoan pg={pg} sl={sl} menu={[editItem]}/>}

      {!sl.belowThreshold && (compareOpen
        ? <LoanCompare d={d} m={m} sl={sl} set={set} open picked={overpayAmt} plan={planRun ? { name: shownPlan.name, run: planRun } : null} menu={[editItem]}/>
        : (
          <>
            {!worthOverpaying && <WhereItCouldGo m={m} locked={!alternativesOpen} menu={[editItem]}/>}
            {alternativesOpen && <LoanCompare d={d} m={m} sl={sl} set={set} open={false} picked={overpayAmt} menu={[editItem]}/>}
          </>
        ))}

      {verdict && <OverpayingTile sl={sl} worthOverpaying={worthOverpaying} m={m} surplusCash={surplusCash} menu={[editItem]}/>}
    </div>
  );
}

// Your balance: whether it clears or is written off, the balance year by
// year, and under it the figures that move it, open: salary growth, which
// decides most whether the loan clears, and a lump sum paid today. Then the
// figures behind it, a row each on one line, the two the user can correct
// (the balance, and when repayments started, which sets the write-off) with
// a spanner that pops their input out from the row (TilePopover).
function BalanceTile({ d, m, sl, set, savingsRates, menu, overpayAmt, setOverpayAmt, overpayOptions, showLump, tip, selectedScenario, baseProjection, worthOverpaying, planRun, planName, planFlash, balanceChartRef, balanceChartWidth, editingBalance, setEditingBalance, manualBalanceInput, setManualBalanceInput, editingStart, setEditingStart, startInput, setStartInput }) {
  // Suggests the balance after paying the currently-selected slider amount,
  // rather than a blank/current-balance starting point — if the user came
  // here having just modelled an overpayment, that's almost certainly the
  // figure they're about to confirm. Stays live-synced to the slider
  // (recomputed every render, not snapshotted on open) until the user types
  // their own value, and re-syncs the next time the editor is opened fresh.
  const suggestedBalance = Math.max(0, Math.round(m.loanBal) - (overpayAmt || 0));
  const balanceInput = manualBalanceInput != null ? manualBalanceInput : suggestedBalance;
  const openBalanceEditor = () => {
    setManualBalanceInput(null); setEditingBalance(true);
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("sl-balance-row")?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
  };
  const closeBalanceEditor = () => { setEditingBalance(false); setManualBalanceInput(null); };
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
  const growth = set ? payGrowthOf(d, m) : null;
  return (
    <MobileTile id="sl-balance" title="Your balance"
      // From the menu: once the menu has closed and handed focus back, so
      // the pop-out keeps it.
      menu={[set && { icon: Wrench, label: "Update your balance", onClick: () => setTimeout(openBalanceEditor, 200) }, ...menu]}>
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
    </MobileTile>
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
function WhatIfs({ d, m, sl, set, menu, whatIf, toggleWhatIf, subscriber, planRun, showPlan, curve, chartWrapRef }) {
  const plans = set && !sl.belowThreshold;
  if (!plans && !curve) return null;
  return (
    <MobileTile id="sl-whatifs" title="What ifs" subtitle="Calculators, worked out on your figures" menu={menu}>
      {plans && (
        <ScenarioModelling expanded={whatIf === "plans"} onToggle={() => toggleWhatIf("plans")} d={d} m={m} sl={sl} set={set} open={subscriber} run={planRun} onPlanSaved={showPlan}/>
      )}
      {curve && (
        <>
          <TileRow onClick={() => toggleWhatIf("return")} expanded={whatIf === "return"}>
            {withIcon(ChartLine, <RowText label="Overpaying vs your pension" note="What each £1 overpaid returns, against the same £1 in your pension"/>)}
          </TileRow>
          {whatIf === "return" && <Nested><ReturnChart sl={sl} curve={curve} chartWrapRef={chartWrapRef}/></Nested>}
        </>
      )}
    </MobileTile>
  );
}

// Salary growth as its row in Your balance shows it: the rate, and the salary it
// comes to in ten years; or, with pay set year by year, the average rate
// that comes to (the same figures PayGrowth works with).
function payGrowthOf(d, m) {
  const salary = m.salary || 0;
  const path = payPathOf(d, +d.salary || 0, m.taxYear);
  if (path) return { path: true, pct: Math.round((Math.pow(path.factor(10), 0.1) - 1) * 1000) / 10, inTen: Math.round(salary * path.factor(10) / 100) * 100 };
  const exact = salaryGrowthOf(d) * 100;
  return { path: false, pct: Math.round(exact * 10) / 10, inTen: salary > 0 ? Math.round(salary * Math.pow(1 + exact / 100, 10) / 100) * 100 : 0 };
}

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
  const inTen = p => Math.round(salary * Math.pow(1 + p / 100, 10) / 100) * 100;
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
  const taxYear = sl.writeOffTaxYear - sl.writeOffYr;
  const figure = sl.willClear ? `Cleared by April ${taxYear + sl.clearYr}` : `Written off April ${sl.writeOffTaxYear}`;
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
      <div style={{fontFamily:SERIF,fontSize:"28px",color:G,fontWeight:700,lineHeight:1.15}}>{figure}</div>
      <div style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,marginTop:"4px"}}>
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
function PostgradLoan({ pg, sl, menu }) {
  return (
    <MobileTile title="Postgraduate loan" menu={menu}>
      <TileRow first><ClearOrWriteOff sl={pg}/></TileRow>
      <LoanStats sl={pg} balanceLabel="Current balance" balance={pg.balancePath[0]?.bal ?? 0}/>
      <TileRow>
        <p style={{...ROW.note,marginTop:0}}>
          Repaid at the same time as your main loan: 6% of pay over {fmt(SL_REPAYMENT_THRESHOLDS.postgrad)}, on top of 9% over {fmt(sl.threshold)}. Together, about {fmt(sl.annualRep + pg.annualRep)} a year comes off your pay now.
        </p>
      </TileRow>
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
  const stat = (label, value) => (
    <div>
      <div style={{fontSize:"9.5px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{label}</div>
      <div style={{fontFamily:SERIF,fontSize:"19px",color:G,fontWeight:700,marginTop:"2px"}}>{value}</div>
    </div>
  );
  return (
    <div>
      <PillSlider compact label="Lump sum repayment" value={overpayAmt} onChange={setOverpayAmt} options={[{ value:0, label:"None" }, ...options.map(a => ({ value:a, label: a === full ? "All" : fmtK(a) }))]}/>
      {/* Whether it's spare: against cash above the emergency buffer. */}
      {overpayAmt > 0 && (m.expensesUnknown
        ? <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.45,margin:"6px 0 0"}}>Add your monthly spending in Cash & savings to check you could spare this.</p>
        : overpayAmt > (m.surplusCash || 0) && (
          <div style={{display:"flex",gap:"6px",alignItems:"flex-start",fontSize:"11.5px",lineHeight:1.45,color:TEXT,marginTop:"6px"}}>
            <CircleAlert size={13} color={CRITICAL} style={{flexShrink:0,marginTop:"1px"}}/>
            {(m.surplusCash || 0) > 0
              ? `More than the ${fmt(Math.round(m.surplusCash))} you have above your ${m.bufferMonths}-month cash buffer.`
              : `You have no cash above your ${m.bufferMonths}-month buffer, so this would come from it.`}
          </div>
        ))}
      {!scenario && tip && (
        <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>Under {k(tip)} it mostly shrinks what's written off. From {k(tip)} it clears before write-off.</p>
      )}
      {scenario && (
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginTop:"12px"}}>
            {stat(scenario.clearYr === 0 ? "Cleared" : scenario.clearYr ? "Clears in" : "Written off", scenario.clearYr === 0 ? "Today" : scenario.clearYr ? `${scenario.clearYr} yrs` : fmt(scenario.writeOffBal))}
            {stat(saved >= 0 ? "Saves in all" : "Costs more", fmt(Math.abs(saved)))}
            {stat("You'd pay in all", fmt(scenario.totalPaid))}
          </div>
          <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>
            Against {base.clearYr ? `clearing in ${base.clearYr} yrs` : `${fmt(base.writeOffBal)} written off`} and {fmt(base.totalPaid)} paid in all, as it is.{saved < 0 && !scenario.clearYr ? " It would mostly shrink what's written off." : ""}
            {!base.clearYr && scenario.clearYr > 0 && (() => {
              const diff = scenario.paidToday - base.paidToday;
              return ` In today's money, counting what the ${k(overpayAmt)} would earn in savings at ${sl.cashRate}%, it costs ${k(Math.abs(diff))} ${diff < 0 ? "less" : "more"}.`;
            })()}
            {!base.clearYr && !scenario.clearYr && tip ? ` From ${k(tip)} it clears before write-off instead.` : ""}
          </p>
          {worthOverpaying && (m.surplusCash || 0) > 0 && (
            <a href="https://www.gov.uk/sign-in-to-manage-your-student-loan-balance" target="_blank" rel="noopener noreferrer" style={{
              marginTop:"12px",width:"100%",background:G,color:WHITE,borderRadius:"100px",padding:"12px",fontSize:"13.5px",fontWeight:600,
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

// Until Cash & savings and Pension are answered, the answer here is only
// part of it: whether the money's spare, and whether paying the loan off
// beats saving or the pension, depend on them. The way in to each (behind
// the paywall for anyone whose free answer was this one).
// Before their savings are in: the Opportunity tile, its answer blurred (a
// stand-in figure, not theirs) under the ask for them, which goes to Cash &
// savings' short route (moduleGuide.js briefQuestions) and back.
function LockedOpportunity({ d }) {
  const navigate = useNavigate();
  // Each detail: a link until it's added, then a tick.
  // On the tile's dark fill: light text, and dark glass for the panel.
  const row = { width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", background:"none", border:"none", borderTop:"1px solid rgba(255,255,255,0.12)", padding:"11px 0", fontFamily:"inherit" };
  const step = (done, to, label) => done ? (
    <div style={row}>
      <span style={{fontSize:"14px",fontWeight:700,color:OPPORTUNITY_TILE_BODY}}>{label}</span>
      <Check size={17} color={OPPORTUNITY_TILE_BODY} strokeWidth={3}/>
    </div>
  ) : (
    <button type="button" onClick={() => navigate(to)} style={{...row,cursor:"pointer"}}>
      <span style={{fontSize:"14px",fontWeight:700,color:OPPORTUNITY_TILE_FIGURE}}>Add {label}</span>
      <ChevronRight size={17} color={OPPORTUNITY_TILE_FIGURE}/>
    </button>
  );
  const line = w => <div style={{height:"9px",width:w,borderRadius:"5px",background:OPPORTUNITY_TILE_BODY,opacity:0.35,marginTop:"8px"}}/>;
  return (
    <div style={{background:OPPORTUNITY_TILE_BG,border:OPPORTUNITY_TILE_BORDER,boxShadow:OPPORTUNITY_TILE_SHADOW,borderRadius:OPPORTUNITY_TILE_RADIUS,padding:"20px",marginBottom:"16px"}}>
      <div style={{fontSize:"11px",fontWeight:800,color:OPPORTUNITY_TILE_LABEL,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"10px"}}>Opportunity</div>
      <div style={{position:"relative"}}>
        <div aria-hidden="true" style={{position:"absolute",inset:0,overflow:"hidden",filter:"blur(4px)",userSelect:"none",pointerEvents:"none"}}>
          <div style={{fontFamily:SERIF,fontSize:"58px",color:OPPORTUNITY_TILE_FIGURE,fontWeight:700,lineHeight:1}}>£0,000</div>
          {line("70%")}{line("100%")}{line("90%")}{line("95%")}{line("60%")}
        </div>
        <div style={{position:"relative",marginTop:"4px",background:"rgba(255,255,255,0.08)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.14)",boxShadow:"0 1px 12px rgba(0,0,0,0.12)",borderRadius:"12px",padding:"14px 16px 4px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"7px",fontSize:"13px",fontWeight:700,color:OPPORTUNITY_TILE_FIGURE}}><Clock size={14} color={OPPORTUNITY_TILE_FIGURE}/>Is paying it off early worth it?</div>
          <p style={{fontSize:"12.5px",color:OPPORTUNITY_TILE_BODY,lineHeight:1.5,margin:"4px 0 10px"}}>
            A few more details show the full trade-offs of paying off early.
          </p>
          {step(loanSavingsIn(d), "/app/module/cash?from=studentLoan", "Cash & savings")}
          {hasEmployerMatch(d) && step(loanPensionChecked(d), "/app/module/pension?from=studentLoan", "Pension")}
        </div>
      </div>
    </div>
  );
}

// The verdict when paying it off early doesn't come out ahead: still the
// Opportunity tile, so the answer sits where it was asked for. `onSeeWhy`:
// to the Overpaying tile, which weighs it against saving.
function NoGain({ sl, onSeeWhy }) {
  const why = !sl.willClear
    ? `It's expected to be written off in April ${sl.writeOffTaxYear}, so overpaying would mostly shrink what's written off, not what you pay.`
    : `Your savings at ${sl.cashRate}% earn ${sl.effectiveBenefit < 0 ? "more than" : "the same as"} the loan's ${sl.lifeRatePct}% average rate.`;
  return <OpportunityTile figures={[{ value: "No gain", label: "from paying it off early, on your figures" }]} note={why}
    action={onSeeWhy ? { label: "See why", onClick: onSeeWhy } : undefined}/>;
}

// Whether the money to pay it off is spare: how the cash buffer, this year's
// ISA allowance and the employer's pension match stand. As they are, not an
// order to do things in.
function SpareCheck({ d, m, sl, amount, menu }) {
  const navigate = useNavigate();
  // Each point leads with its topic, in bold, for anyone scanning.
  const items = [];
  if (m.expenses > 0) {
    items.push((m.surplusCash || 0) >= amount
      ? { topic: "Cash runway", ok: true, text: "Good", long: `Paying it off would still leave ${m.bufferMonths} months of spending in cash, so your cash runway isn't affected.` }
      : { topic: "Cash runway", ok: false, text: `Leaves under ${m.bufferMonths} months' cash`, long: `Paying it off would leave ${fmt(Math.max(0, Math.round(m.emergencyFund - amount)))} in cash, under ${m.bufferMonths} months of spending (${fmt(Math.round(m.emergencyBuffer))}), cutting your cash runway.` });
  } else items.push({ topic: "Cash runway", ok: null, text: "Not checked yet", long: "Your spending isn't in yet, so whether paying it off would cut your cash runway can't be checked (Cash & savings)." });
  if (loanIsaIn(d)) {
    items.push(m.isaHeadroom > 0
      ? { topic: "ISA allowance", ok: false, text: `${k(m.isaHeadroom)} remaining`, long: `${k(m.isaHeadroom)} of this year's ISA allowance is unused. Growth in an ISA is tax-free, and the allowance is use it or lose it on 5 April; the loan isn't.` }
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
  if (caveat) items.push({ topic: "Pension growth", ok: false, text: `${sl.pensionGrowthPct}% a year, not guaranteed; locked until 57`, long: caveat });
  // A row each, as Pension's alert rows: the icon in line with the topic,
  // what it shows under it; a row with more to add leads to Pension.
  const icon = it => it.ok === true
    ? <Check size={18} color={SUCCESS} strokeWidth={3} role="img" aria-label="Fine" style={{flexShrink:0}}/>
    : <CircleAlert size={18} color={it.ok === "critical" ? CRITICAL : it.ok === false ? GOLD_TEXT : MUT} role="img" aria-label={it.ok === "critical" ? "Critical" : it.ok === false ? "Worth a look" : "Not known"} style={{flexShrink:0}}/>;
  return (
    <MobileTile title="Is the money spare?" subtitle={`Paying it off uses ${k(amount)}`} menu={menu}>
      {/* Short lines on a phone; the full point on a desktop, where there's room. */}
      <style>{`.spare-long { display: none; } @media (min-width: 1000px) { .spare-short { display: none; } .spare-long { display: inline; } }`}</style>
      {items.map(it => (
        <TileRow key={it.topic} align={!it.add} onClick={it.add ? () => navigate(loanPensionChecked(d) ? "/app/module/pension" : "/app/module/pension?from=studentLoan") : undefined}>
          <div style={{...ROW.label,fontWeight:600,display:"flex",alignItems:"center",gap:"8px"}}>{icon(it)}{it.topic}</div>
          <div style={{...ROW.note,marginLeft:"26px"}}>
            <span className="spare-short">{it.text}</span><span className="spare-long">{it.long}</span>
          </div>
        </TileRow>
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

// The overpaying tile: whether overpaying beats saving or the pension, and
// by how much: the answer, then the rates behind it, a row each.
function OverpayingTile({ sl, worthOverpaying, m, surplusCash, menu }) {
  if (!sl.willClear) return null;
  const headline = worthOverpaying
    ? `${fmt(sl.overpayTotalBenefit)} ahead in all: the loan's ${sl.lifeRatePct}% beats ${sl.beatsPension ? "savings and your pension" : `the best savings rate (${sl.cashRate}%)`}.`
    : sl.effectiveBenefit === 0
      ? `The highest savings rate (${sl.cashRate}%) matches your loan's ${sl.lifeRatePct}% average rate, so overpaying doesn't come out ahead.`
      : `The highest savings rate (${sl.cashRate}%) beats your loan's ${sl.lifeRatePct}% average rate.`;
  const savingsColor = sl.effectiveBenefit > 0 ? SUCCESS : sl.effectiveBenefit === 0 ? MUT : CRITICAL;
  // Which comes out ahead, and by how much: words, so not a serif figure.
  const verdictText = { fontFamily:"inherit", fontSize:"14px", fontWeight:700 };
  return (
    <MobileTile id="sl-overpaying" title="Overpaying" subtitle={<span style={{fontSize:"13px",fontWeight:600,color:TEXT}}>{headline}</span>} menu={menu}>
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
      <TileRow><RowText inline label="Outstanding balance" note={`at ${sl.slRatePct}%`} figure={fmt(m.loanBal)}/></TileRow>
      <TileRow>
        {surplusCash > 0
          ? <RowText inline label="Spare cash above your buffer" figure={fmt(surplusCash)}/>
          : <p style={ROW.text}>You don't currently hold cash above your emergency buffer; the comparison still applies to any spare cash you build up.</p>}
      </TileRow>
      <TileRow>
        <RowText inline label="Loan vs savings" note={`${sl.lifeRatePct}% vs ${sl.cashRate}%`} figureStyle={{...verdictText,color:savingsColor}}
          figure={sl.effectiveBenefit > 0 ? `Repay +${sl.effectiveBenefit}%` : sl.effectiveBenefit === 0 ? "Level" : `Savings +${Math.abs(sl.effectiveBenefit)}%`}/>
      </TileRow>
      <TileRow>
        <RowText inline label="Loan vs pension" note={`${sl.lifeRatePct}% vs ${sl.pensionGrowthPct}%`} figureStyle={{...verdictText,color:sl.beatsPension ? SUCCESS : GOLD_TEXT}}
          figure={sl.pensionGap > 0 ? `Repay +${sl.pensionGap}%` : sl.pensionGap === 0 ? "Level" : `Pension +${Math.abs(sl.pensionGap)}%`}/>
      </TileRow>
      <TileRow>
        <p style={{...ROW.note,marginTop:0}}>
          The loan's {sl.lifeRatePct}% is its average rate over its life. Pension growth is assumed, not guaranteed; repaying is. Tax relief isn't part of the pension comparison: overpaying clears the loan sooner, and the money that frees up gets the same relief when it goes into your pension then.
        </p>
      </TileRow>
    </MobileTile>
  );
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

// Overpaying isn't worth it, so money that might have gone on the loan can
// do more elsewhere: the same £100 a month in a pension, an ISA or savings,
// with what each would grow to and how easily it can be reached
// (src/lib/crossModule.js loanAlternatives). Each opens its module; the user
// chooses, so they're listed by £ with their trade-offs, not ranked as advice.
const ALTERNATIVES = {
  pension:     { title: "Pension", note: tr => `Tax relief at ${Math.round(tr * 100)}% adds to every payment. Can't be touched until 57.` },
  investments: { title: "Stocks and Shares ISA", note: () => "Growth is tax-free and you can take it out any time. Can fall as well as rise." },
  cash:        { title: "Savings at the highest rate", note: () => "Safe, and there whenever you need it." },
};
function WhereItCouldGo({ m, locked, menu }) {
  const navigate = useNavigate();
  const { monthly, years, paidIn, options } = loanAlternatives(m);
  return (
    <MobileTile title="Where it could go instead" subtitle={`£${monthly} a month for ${years} years (${fmt(paidIn)} in all) could grow to:`} menu={menu}>
      <div style={{position:"relative"}}>
        <div aria-hidden={locked || undefined} inert={locked ? "" : undefined} style={locked ? {filter:"blur(6px)",userSelect:"none",pointerEvents:"none"} : undefined}>
          {options.map(o => (
            <TileRow key={o.key} onClick={() => navigate(`/app/module/${o.key}`)}>
              <RowText label={ALTERNATIVES[o.key].title} note={ALTERNATIVES[o.key].note(m.tr || 0)} figure={fmt(o.total)}/>
            </TileRow>
          ))}
          <TileRow><div style={{...ROW.note,marginTop:0}}>Investments growing {GROWTH_NOMINAL_PCT}% a year and savings at today's best rate. Not including anything an employer adds to a pension.</div></TileRow>
        </div>
        {locked && (
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"8px",textAlign:"center",padding:"0 28px 0 12px"}}>
            <span style={{width:"40px",height:"40px",borderRadius:"50%",background:WHITE,border:"1.5px solid rgba(22,47,36,0.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><Lock size={18} color={G}/></span>
            <span style={{fontSize:"12.5px",fontWeight:600,color:G,lineHeight:1.45,maxWidth:"240px"}}>Opens with your savings and pension match, or a subscription</span>
          </div>
        )}
      </div>
    </MobileTile>
  );
}
