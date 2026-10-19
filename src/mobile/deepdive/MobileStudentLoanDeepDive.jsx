import { useState } from "react";
import { useElementWidth } from "../useElementWidth.js";
import { useNavigate } from "react-router-dom";
import { loanAlternatives } from "../../lib/crossModule.js";
import { ExternalLink, Wrench, ChevronRight, Check, CircleAlert } from "lucide-react";
import { calcStudentLoanScenario, calcOverpaymentScenarios, describeLoanVsPension, pgScenario, loanCostComparison, SL_REPAYMENT_THRESHOLDS } from "../../lib/studentLoan.js";
import { moduleAnswered } from "../../lib/appEntry.js";
import { overpaymentSources } from "../../lib/loanBalance.js";
import { premiumBondsRow } from "../../lib/savingsRates.js";
import { PAY_GROWTH_OPTIONS } from "../../lib/moduleGuide.js";
import { calcLoanMarginalReturnCurve } from "../../lib/forecast.js";
import { fmt, fmtK } from "../../lib/format.js";
import { PillSlider } from "../PillSlider.jsx";
import MobileWinTile from "../MobileWinTile.jsx";
import PillMoneyInput from "../PillMoneyInput.jsx";
import { ExploreToggle } from "../ModuleScreenParts.jsx";
import { OPPORTUNITY_TILE_BORDER, OPPORTUNITY_TILE_SHADOW, G, GOLD, WHITE, MUT, TEXT, SERIF, OPPORTUNITY_TILE_BG, OPPORTUNITY_TILE_LABEL, OPPORTUNITY_TILE_FIGURE, OPPORTUNITY_TILE_BODY, CDARK, CRITICAL, SUCCESS } from "../../design-tokens.js";

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
// moduleKey==="studentLoan" — CandidApp.jsx): the opportunity strip, the loan-
// trajectory summary, the "does overpaying beat cash" walkthrough (Win tile —
// unnumbered, since there's only ever one Win here), a separate overpayment-
// scenario tile (amount slider instead of desktop's fixed £5k/£10k/£20k
// cards), and a separate "return per £1 overpaid" chart tile with a
// like-for-like repay-vs-pension verdict. calcStudentLoanScenario/
// calcOverpaymentScenarios/calcLoanMarginalReturnCurve are the same single
// source of truth desktop and computeModuleStatuses use, so the numbers
// can't drift between mobile and desktop.
// Leads with the answer and the comparison behind it; the overpayment model
// and the return chart sit under "Explore what-ifs", closed at first.
export default function MobileStudentLoanDeepDive({ d, m, set, savingsRates, onRecordLoanOverpayment }) {
  const [exploreOpen, setExploreOpen] = useState(false); // before the chart's measuring effect, which waits for it
  const [editingBalance, setEditingBalance] = useState(false);
  // null = still following the overpayment slider automatically; a number
  // once the user types their own value into the editor, which then stops
  // tracking further slider movement (their explicit edit wins).
  const [manualBalanceInput, setManualBalanceInput] = useState(null);
  // The chart sits under "Explore what-ifs": measured once that's open.
  const [chartWrapRef, chartWidth] = useElementWidth(300, [exploreOpen]);
  const [balanceChartRef, balanceChartWidth] = useElementWidth(300);
  // Default overpayment slider position: the largest round amount the user's
  // spare cash could actually cover, falling back to the smallest option.
  // Computed from `m` alone (no `sl`/guard dependency) so this hook can stay
  // unconditional, alongside the ones above.
  // The lump sum being modelled (LumpSum, under the chart): none until one's
  // picked, so the chart starts as it is.
  const [overpayAmt, setOverpayAmt] = useState(0);

  // The write-off assumption's editor (below); hooks stay above the return.
  const [editingStart, setEditingStart] = useState(false);
  const [startInput, setStartInput] = useState(null);

  if (d.studentLoan === "none" || m.loanBal <= 0) {
    return <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.6}}>No student loan on record.</p>;
  }

  const sl = calcStudentLoanScenario(d, m);
  const pg = pgScenario(d, m);
  const worthOverpaying = sl.worthOverpaying;
  const surplusCash = m.surplusCash || 0;
  const curve = calcLoanMarginalReturnCurve(d, m, sl, chartWidth);

  const overpayOptions = buildOverpayOptions(m.loanBal);
  const { scenarios, baseProjection } = calcOverpaymentScenarios(m, sl, [overpayAmt]);
  const selectedScenario = scenarios[0];
  const cost = loanCostComparison(m, sl);




  return (
    <div>
      {worthOverpaying && (
        <>
          <div style={{background:OPPORTUNITY_TILE_BG,border:OPPORTUNITY_TILE_BORDER,boxShadow:OPPORTUNITY_TILE_SHADOW,borderRadius:"14px",padding:"16px 18px",marginBottom:"12px"}}>
            <div style={{fontSize:"10px",fontWeight:800,color:OPPORTUNITY_TILE_LABEL,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Opportunity</div>
            <div style={{fontFamily:SERIF,fontSize:"32px",color:OPPORTUNITY_TILE_FIGURE,fontWeight:700,lineHeight:1.1}}>{fmt(sl.overpayTotalBenefit)}</div>
            <div style={{fontSize:"12px",color:OPPORTUNITY_TILE_LABEL,marginTop:"4px",fontWeight:600}}>Ahead by paying it off now, about {fmt(sl.overpayAnnualBenefit)} a year</div>
            <div style={{fontSize:"12.5px",color:OPPORTUNITY_TILE_BODY,lineHeight:1.55,marginTop:"10px"}}>
              You'll clear it in about {sl.clearYr === 1 ? "a year" : `${sl.clearYr} years`} either way. Paying the {fmt(cost.balance)} off now avoids about {fmt(sl.interestAvoided)} of interest. Kept in savings at {sl.cashRate}% instead, the same money would earn about {fmt(sl.savingsForgone)} over that time.
            </div>
          </div>
          <SpareCheck d={d} m={m} amount={cost.balance}/>
        </>
      )}

      <LoanTrajectory d={d} m={m} savingsRates={savingsRates} ageKnown={+d.age > 0} setOverpayAmt={setOverpayAmt} overpayOptions={overpayOptions} selectedScenario={selectedScenario} baseProjection={baseProjection} worthOverpaying={worthOverpaying} onRecordLoanOverpayment={onRecordLoanOverpayment} editingBalance={editingBalance} setManualBalanceInput={setManualBalanceInput} sl={sl} set={set} editingStart={editingStart} setEditingStart={setEditingStart} setStartInput={setStartInput} overpayAmt={overpayAmt} manualBalanceInput={manualBalanceInput} setEditingBalance={setEditingBalance} startInput={startInput} balanceChartRef={balanceChartRef} balanceChartWidth={balanceChartWidth}/>

      {!sl.belowThreshold && <CostComparison sl={sl} cost={cost}/>}

      {pg && <PostgradLoan pg={pg} sl={sl}/>}

      {!worthOverpaying && !sl.belowThreshold && <WhereItCouldGo m={m}/>}

      <OverpayingTile sl={sl} worthOverpaying={worthOverpaying} m={m} surplusCash={surplusCash}/>

      {curve && (
        <ExploreToggle open={exploreOpen} onToggle={() => setExploreOpen(o => !o)} hint="overpaying, and loan vs pension"/>
      )}

      <ExploreWhatIfs exploreOpen={exploreOpen} sl={sl} overpayOptions={overpayOptions} selectedScenario={selectedScenario} worthOverpaying={worthOverpaying} baseProjection={baseProjection} overpayAmt={overpayAmt} setOverpayAmt={setOverpayAmt} surplusCash={surplusCash} curve={curve} chartWrapRef={chartWrapRef} m={m}/>
    </div>
  );
}

// Your loan trajectory: when the balance starts falling, and the balance
// year by year to when it clears or is written off.
function LoanTrajectory({ d, m, savingsRates, ageKnown, setOverpayAmt, overpayOptions, selectedScenario, baseProjection, worthOverpaying, onRecordLoanOverpayment, editingBalance, setManualBalanceInput, sl, set, editingStart, setEditingStart, setStartInput, overpayAmt, manualBalanceInput, setEditingBalance, startInput, balanceChartRef, balanceChartWidth }) {
  const stats = [
    { label:"Interest rate", value:`${sl.slRatePct}%` },
    { label:"Annual interest", value:`${fmt(sl.annualInterest)}/yr` },
    { label:"Annual repayments", value:`${fmt(sl.annualRep)}/yr` },
    { label: sl.clearYr ? "Clears in" : "Written off after", value: sl.clearYr ? `${sl.clearYr} yrs` : `${sl.writeOffYr} yrs` },
    // What they'd pay over the loan's life, and what's left to write off.
    { label:"You'd repay in all", value: fmt(sl.totalRepaidProjected) },
    ...(sl.willClear ? [] : [{ label:"Written off", value: fmt(sl.writeOffBal) }]),
  ];
  // Suggests the balance after paying the currently-selected slider amount,
  // rather than a blank/current-balance starting point — if the user came
  // here having just modelled an overpayment above, that's almost certainly
  // the figure they're about to confirm. Stays live-synced to the slider
  // (recomputed every render, not snapshotted on open) until the user types
  // their own value, and re-syncs the next time the editor is opened fresh.
  const suggestedBalance = Math.max(0, Math.round(m.loanBal) - (overpayAmt || 0));
  const balanceInput = manualBalanceInput != null ? manualBalanceInput : suggestedBalance;
  // Updating the balance: the new figure, then, if it's lower, where the
  // difference came from (loanBalance.js takeFromSources: the lowest rate
  // first). Its yearly interest saving, at the loan's rate, counts towards
  // "Gained from your changes" on Home.
  const [step, setStep] = useState(1);
  const [picks, setPicks] = useState([]);
  const pbRate = premiumBondsRow(savingsRates)?.rate_aer != null ? +premiumBondsRow(savingsRates).rate_aer : null;
  const sources = overpaymentSources(d, pbRate);
  const openBalanceEditor = () => { setManualBalanceInput(null); setStep(1); setPicks([]); setEditingBalance(true); };
  const closeBalanceEditor = () => { setEditingBalance(false); setManualBalanceInput(null); setStep(1); setPicks([]); };
  const cashDelta = Math.max(0, Math.round(m.loanBal) - balanceInput);
  const saveBalanceEdit = () => {
    if (onRecordLoanOverpayment) onRecordLoanOverpayment(Math.max(0, balanceInput), { sources: picks, pbRate, perYear: cashDelta * sl.lifeRatePct / 100 });
    closeBalanceEditor();
  };
  const togglePick = key => setPicks(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);
  // When repayments started decides when the loan is written off. Estimated
  // from age unless the user says (studentLoan.js slFirstDueYear).
  const startValue = startInput ?? sl.firstDueYear;
  const saveStart = () => {
    if (set && startValue >= 1990 && startValue <= new Date().getFullYear() + 10) set("slFirstDueYear", String(Math.round(startValue)));
    setEditingStart(false); setStartInput(null);
  };
  const resetStart = () => { if (set) set("slFirstDueYear", ""); setEditingStart(false); setStartInput(null); };
  return (
    <>
      <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
        <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"12px"}}>Your loan trajectory</div>

        <TurningPoint sl={sl}/>
        <div ref={balanceChartRef} style={{width:"100%",marginBottom:"14px"}}>
          <BalanceChart sl={sl} width={balanceChartWidth} alt={selectedScenario?.path} altLabel={overpayAmt > 0 ? `With ${fmt(overpayAmt)} paid now` : null}/>
        </div>
        {overpayOptions.length > 0 && !sl.belowThreshold && (
          <LumpSum m={m} overpayAmt={overpayAmt} setOverpayAmt={setOverpayAmt} options={overpayOptions} scenario={selectedScenario} base={baseProjection} worthOverpaying={worthOverpaying}/>
        )}

        <div style={{marginBottom:"12px"}}>
          <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{m.loanBalEstimated ? "Current balance (estimated)" : d.loanBalanceAsOf ? `Current balance (estimated, updated ${new Date(d.loanBalanceAsOf).toLocaleDateString("en-GB", { day: "numeric", month: "short" })})` : "Current balance"}</div>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"2px"}}>
            <div style={{fontFamily:SERIF,fontSize:"20px",color:G,fontWeight:700}}>{fmt(m.loanBal)}</div>
            {onRecordLoanOverpayment && (
              <button onClick={openBalanceEditor} aria-label="Update your loan balance" style={{background:"rgba(22,47,36,0.06)",border:"none",borderRadius:"50%",width:"26px",height:"26px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                <Wrench size={12} color={MUT}/>
              </button>
            )}
          </div>
        </div>

        {editingBalance && (
          <div style={{background:CDARK,borderRadius:"10px",padding:"12px 14px",marginBottom:"12px"}}>
            <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"8px"}}>Update your balance</div>
            {step === 1 ? (
              <>
                <PillMoneyInput label="New balance" value={balanceInput} onChange={setManualBalanceInput}/>
                <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginTop:"10px",marginBottom:0}}>
                  Your online student loan account shows it. From here, Candid adds the interest and takes off your repayment each payday.
                </p>
              </>
            ) : (
              <>
                <div style={{fontSize:"13.5px",fontWeight:700,color:TEXT,lineHeight:1.4}}>Where did the {fmt(cashDelta)} come from?</div>
                <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"4px 0 10px"}}>Pick any. It comes off the lowest-rate one first, so it isn't counted twice.</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
                  {sources.map(s => {
                    const on = picks.includes(s.key);
                    return (
                      <button key={s.key} type="button" onClick={() => togglePick(s.key)} aria-pressed={on} style={{
                        background:on ? G : WHITE, color:on ? WHITE : TEXT, border:`1.5px solid ${on ? G : "rgba(22,47,36,0.18)"}`, borderRadius:"100px",
                        padding:"8px 14px", fontSize:"13px", fontWeight:600, fontFamily:"inherit", cursor:"pointer",
                      }}>
                        {s.label}{s.key !== "other" ? ` · ${fmt(s.amount)}` : ""}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <div style={{display:"flex",gap:"8px",marginTop:"12px"}}>
              <button onClick={step === 2 ? () => setStep(1) : closeBalanceEditor} style={{flex:1,background:"transparent",border:"1.3px solid rgba(22,47,36,0.2)",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,color:G,cursor:"pointer"}}>{step === 2 ? "Back" : "Cancel"}</button>
              {step === 1 && cashDelta > 0
                ? <button onClick={() => setStep(2)} style={{flex:1,background:G,border:"none",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,color:WHITE,cursor:"pointer"}}>Next</button>
                : <button onClick={saveBalanceEdit} disabled={step === 2 && !picks.length} style={{flex:1,background:step === 2 && !picks.length ? "rgba(22,47,36,0.25)" : G,border:"none",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,color:WHITE,cursor:step === 2 && !picks.length ? "not-allowed" : "pointer"}}>Save</button>}
            </div>
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
          {stats.map((s,i) => (
            <div key={i}>
              <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{s.label}</div>
              <div style={{fontFamily:SERIF,fontSize:"17px",color:G,fontWeight:700,marginTop:"2px"}}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Pay growth decides most whether it's cleared: changeable here,
            and every figure above moves with it. */}
        {set && (
          <div style={{marginBottom:"14px"}}>
            <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase",marginBottom:"6px"}}>Your pay over the next ten years</div>
            <PillSlider value={d.salaryTrajectory || "stable"} onChange={v => set("salaryTrajectory", v)}
              options={PAY_GROWTH_OPTIONS.map(o => ({ value: o.value, label: { stable:"With prices", moderate:"Steady rises", high:"Fast" }[o.value] }))}/>
            <div style={{fontSize:"11.5px",color:MUT,marginTop:"6px",lineHeight:1.45}}>{PAY_GROWTH_OPTIONS.find(o => o.value === (d.salaryTrajectory || "stable"))?.label}, then with prices.</div>
          </div>
        )}

        <p style={{fontSize:"12px",color:MUT,lineHeight:1.55,margin:"0 0 12px"}}>
          Written off in April {sl.writeOffTaxYear}. {sl.firstDueEstimated
            ? (ageKnown ? `We've assumed repayments started in April ${sl.firstDueYear}, the April after you turned 22.` : `We've assumed repayments started in April ${sl.firstDueYear}. Tell us when they did:`)
            : `Repayments started in April ${sl.firstDueYear}, as you told us.`}{" "}
          {set && !editingStart && (
            <button type="button" onClick={() => setEditingStart(true)} style={{background:"none",border:"none",padding:0,color:G,fontWeight:600,fontSize:"12px",cursor:"pointer",textDecoration:"underline"}}>Change</button>
          )}
        </p>
        {editingStart && (
          <div style={{background:CDARK,borderRadius:"10px",padding:"12px 14px",marginBottom:"12px"}}>
            <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"8px"}}>When repayments started</div>
            <PillMoneyInput label="April of" unit="" value={startValue} onChange={v => setStartInput(v ?? null)}/>
            <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginTop:"10px",marginBottom:0}}>
              Usually the April after you left your course. Your payslips or your online student loan account will show it.
            </p>
            <div style={{display:"flex",gap:"8px",marginTop:"12px"}}>
              {!sl.firstDueEstimated
                ? <button onClick={resetStart} style={{flex:1,background:"transparent",border:"1.3px solid rgba(22,47,36,0.2)",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,color:G,cursor:"pointer"}}>Use the estimate</button>
                : <button onClick={() => { setEditingStart(false); setStartInput(null); }} style={{flex:1,background:"transparent",border:"1.3px solid rgba(22,47,36,0.2)",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,color:G,cursor:"pointer"}}>Cancel</button>}
              <button onClick={saveStart} style={{flex:1,background:G,border:"none",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,color:WHITE,cursor:"pointer"}}>Save</button>
            </div>
          </div>
        )}
        <p style={{fontSize:"13px",color:MUT,lineHeight:1.6,margin:0}}>
          {sl.belowThreshold
            ? `Your salary is below the repayment threshold, so no deductions yet. Interest still accrues at ${sl.slRatePct}% (~${fmt(sl.annualInterest)}/yr).`
            : !sl.willClear
              ? "Projected to be written off before you'd clear it — overpaying mostly reduces the write-off, not your repayments."
              : sl.effectiveBenefit <= 0
                ? `On track to clear in ~${sl.clearYr} years. The best savings rate (${sl.cashRate}%) ${sl.effectiveBenefit < 0 ? "beats" : "matches"} your loan's average rate over its life (${sl.lifeRatePct}%), so overpaying doesn't come out ahead.`
                : !sl.beatsPension
                  ? `On track to clear in ~${sl.clearYr} years. Your pension is assumed to grow ${sl.pensionGrowthPct}% a year, faster than your loan's ${sl.lifeRatePct}% a year on average over its life — so it beats overpaying here.`
                  : `On track to clear in ~${sl.clearYr} years. Its ${sl.lifeRatePct}% a year beats both the best savings rate and your pension's assumed growth, so paying it off comes out ahead (above).`}
        </p>
      </div>
    </>
  );
}

// A Postgraduate loan alongside the main one (studentLoan.js pgScenario):
// repaid at the same time, with its own interest and write-off date.
function PostgradLoan({ pg, sl }) {
  const stats = [
    { label:"Current balance", value: fmt(pg.balancePath[0]?.bal ?? 0) },
    { label:"Interest rate", value:`${pg.slRatePct}%` },
    { label:"Annual repayments", value:`${fmt(pg.annualRep)}/yr` },
    { label: pg.clearYr ? "Clears in" : "Written off after", value: pg.clearYr ? `${pg.clearYr} yrs` : `${pg.writeOffYr} yrs` },
    { label:"You'd repay in all", value: fmt(pg.totalRepaidProjected) },
    ...(pg.willClear ? [] : [{ label:"Written off", value: fmt(pg.writeOffBal) }]),
  ];
  return (
    <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
      <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"12px"}}>Your Postgraduate loan</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
        {stats.map(s => (
          <div key={s.label}>
            <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{s.label}</div>
            <div style={{fontFamily:SERIF,fontSize:"17px",color:G,fontWeight:700,marginTop:"2px"}}>{s.value}</div>
          </div>
        ))}
      </div>
      <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.55,margin:0}}>
        Repaid at the same time as your main loan: 6% of pay over {fmt(SL_REPAYMENT_THRESHOLDS.postgrad)}, on top of 9% over {fmt(sl.threshold)}. Together, about {fmt(sl.annualRep + pg.annualRep)} a year comes off your pay now. Written off in April {pg.writeOffTaxYear}.
      </p>
    </div>
  );
}

// A lump sum paid today, modelled on the chart above as its second line:
// when it would clear, and what it saves (or costs) in all against letting
// it run. Paying on the Student Loans Company's site, where it comes out
// ahead and there's cash to spare.
function LumpSum({ m, overpayAmt, setOverpayAmt, options, scenario, base, worthOverpaying }) {
  const full = Math.round(m.loanBal);
  const saved = scenario ? base.totalPaid - scenario.totalPaid : 0;
  const stat = (label, value) => (
    <div>
      <div style={{fontSize:"9.5px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{label}</div>
      <div style={{fontFamily:SERIF,fontSize:"19px",color:G,fontWeight:700,marginTop:"2px"}}>{value}</div>
    </div>
  );
  return (
    <div style={{marginBottom:"14px"}}>
      <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase",marginBottom:"6px"}}>What if you paid a lump sum now?</div>
      <PillSlider value={overpayAmt} onChange={setOverpayAmt} options={[{ value:0, label:"None" }, ...options.map(a => ({ value:a, label: a === full ? "All" : fmtK(a) }))]}/>
      {scenario && (
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginTop:"12px"}}>
            {stat(scenario.clearYr === 0 ? "Cleared" : scenario.clearYr ? "Clears in" : "Written off", scenario.clearYr === 0 ? "Today" : scenario.clearYr ? `${scenario.clearYr} yrs` : fmt(scenario.writeOffBal))}
            {stat(saved >= 0 ? "Saves in all" : "Costs more", fmt(Math.abs(saved)))}
            {stat("You'd pay in all", fmt(scenario.totalPaid))}
          </div>
          <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>
            Against {base.clearYr ? `clearing in ${base.clearYr} yrs` : `${fmt(base.writeOffBal)} written off`} and {fmt(base.totalPaid)} paid in all, as it is.{saved < 0 ? " It would mostly shrink what's written off." : ""}
          </p>
          {worthOverpaying && (m.surplusCash || 0) > 0 && (
            <a href="https://www.gov.uk/sign-in-to-manage-your-student-loan-balance" target="_blank" rel="noopener noreferrer" style={{
              marginTop:"12px",width:"100%",background:G,color:WHITE,borderRadius:"100px",padding:"12px",fontSize:"13.5px",fontWeight:600,
              display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",textDecoration:"none",boxSizing:"border-box",
            }}>
              Overpay on the Student Loans Company site <ExternalLink size={14}/>
            </a>
          )}
        </>
      )}
    </div>
  );
}

// What the loan costs: left to clear (or be written off) by itself,
// against paying it off today (studentLoan.js loanCostComparison).
function CostComparison({ sl, cost }) {
  const row = { display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:"12px", padding:"12px 0", borderBottom:"1px solid rgba(22,47,36,0.08)" };
  const big = { fontFamily:SERIF, fontSize:"18px", color:G, fontWeight:700, whiteSpace:"nowrap" };
  return (
    <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
      <div style={{fontSize:"13px",fontWeight:600,color:G}}>What it costs you</div>
      <div style={row}>
        <div>
          <div style={{fontSize:"13.5px",fontWeight:600,color:TEXT}}>Left as it is</div>
          <div style={{fontSize:"12px",color:MUT,lineHeight:1.45,marginTop:"2px"}}>
            {sl.willClear
              ? `${fmt(cost.balance)} owed + ${fmt(cost.interest)} interest, over ${cost.years === 1 ? "a year" : `${cost.years} years`}: about ${fmt(cost.interestPerYear)} of interest a year.`
              : `Repaid over ${cost.years} years, then ${fmt(cost.writtenOff)} written off in April ${sl.writeOffTaxYear}.`}
          </div>
        </div>
        <div style={big}>{fmt(cost.total)}</div>
      </div>
      <div style={{...row,borderBottom:"none"}}>
        <div>
          <div style={{fontSize:"13.5px",fontWeight:600,color:TEXT}}>Paid off today</div>
          <div style={{fontSize:"12px",color:MUT,lineHeight:1.45,marginTop:"2px"}}>No more interest.</div>
        </div>
        <div style={big}>{fmt(cost.balance)}</div>
      </div>
      <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,margin:"4px 0 0"}}>
        {cost.payNowSaves >= 0
          ? `Paying it off today costs ${fmt(cost.payNowSaves)} less in all, before what the money could earn elsewhere meanwhile.`
          : `Paying it off today would cost ${fmt(-cost.payNowSaves)} more than you'd ever repay.`}
      </p>
    </div>
  );
}

// Whether the money to pay it off is spare: how the cash buffer, this year's
// ISA allowance and the employer's pension match stand. As they are, not an
// order to do things in.
function SpareCheck({ d, m, amount }) {
  const items = [];
  if (m.expenses > 0) {
    items.push((m.surplusCash || 0) >= amount
      ? { ok: true, text: `You'd still have ${m.bufferMonths} months of spending in cash.` }
      : { ok: false, text: `It would leave ${fmt(Math.max(0, Math.round(m.emergencyFund - amount)))} in cash, under ${m.bufferMonths} months of spending (${fmt(Math.round(m.emergencyBuffer))}).` });
  } else items.push({ ok: null, text: "Your spending isn't in yet, so your cash buffer can't be checked (Cash & savings)." });
  if (moduleAnswered("cash", d) || moduleAnswered("investments", d)) {
    items.push(m.isaHeadroom > 0
      ? { ok: false, text: `${fmt(Math.round(m.isaHeadroom))} of this year's ISA allowance is unused. It's lost on 5 April; the loan isn't.` }
      : { ok: true, text: "This year's ISA allowance is used." });
  }
  if (d.hasPension === "yes" && d.employmentStatus === "employed") {
    items.push(m.missedMatch > 0
      ? { ok: false, text: `${fmt(Math.round(m.missedMatch))} a year of your employer's pension match is unclaimed.` }
      : { ok: true, text: "You get your employer's full pension match." });
  }
  return (
    <div style={{padding:"4px 2px 0",marginBottom:"16px"}}>
      <div style={{fontSize:"13px",fontWeight:700,color:G}}>Is the money spare?</div>
      <div style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"2px 0 8px"}}>Paying it off would use {fmt(amount)}. How the rest stands:</div>
      {items.map(it => (
        <div key={it.text} style={{display:"flex",gap:"8px",alignItems:"flex-start",fontSize:"13px",color:TEXT,lineHeight:1.45,padding:"4px 0"}}>
          {it.ok ? <Check size={15} color={SUCCESS} strokeWidth={3} style={{flexShrink:0,marginTop:"2px"}}/> : <CircleAlert size={15} color={it.ok === false ? GOLD : MUT} style={{flexShrink:0,marginTop:"2px"}}/>}
          <span>{it.text}</span>
        </div>
      ))}
    </div>
  );
}

// The turning point: the year repayments overtake the interest, so the
// balance starts falling rather than just growing more slowly.
function TurningPoint({ sl }) {
  const [figure, note] = sl.balanceFallingNow
    ? ["Falling now", "Your repayments already outpace the interest."]
    : sl.turningTaxYear
      ? [`April ${sl.turningTaxYear}`, "Until then it keeps growing, even with repayments coming off your pay."]
      : ["Not before write-off", "On these figures, repayments never overtake the interest."];
  return (
    <div style={{marginBottom:"10px"}}>
      <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{sl.balanceFallingNow ? "Your balance" : "Your balance starts falling"}</div>
      <div style={{fontFamily:SERIF,fontSize:"28px",color:G,fontWeight:700,lineHeight:1.15,marginTop:"2px"}}>{figure}</div>
      <div style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginTop:"2px"}}>{note}</div>
    </div>
  );
}

// The balance year by year (sl.balancePath), its peak marked: the peak is
// the turning point, where repayments overtake the interest.
// `alt`: the same, with a lump sum paid today (calcOverpaymentScenarios), as
// a dashed second line.
function BalanceChart({ sl, width, alt = null, altLabel = null }) {
  const path = sl.balancePath || [];
  if (path.length < 2) return null;
  const VW = width, VH = 160, PL = 36, PR = 8, PT = 24, PB = 20;
  const lastYr = path[path.length - 1].yr;
  // The y-axis spans the balance's own range, not £0 up, so a hump of a few
  // thousand on a £40k loan is visible; the labelled gridlines keep the scale
  // honest. A loan that clears runs to £0, so its axis starts there anyway.
  const lo = Math.min(...path.map(p => p.bal), ...(alt || []).map(p => p.bal)), hi = sl.peakBal;
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
  return (
    <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`} style={{display:"block"}} role="img"
      aria-label={`Loan balance from ${fmt(path[0].bal)} today${showPeak ? `, peaking at ${fmt(peak.bal)}` : ""}, to ${end.bal > 0 ? `${fmt(end.bal)} written off` : "cleared"} in ${startYear + lastYr}`}>
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
      {altLabel && (
        <g>
          <line x1={PL} x2={PL + 16} y1={8} y2={8} stroke={GOLD} strokeWidth="2.2" strokeDasharray="5 4"/>
          <text x={PL + 20} y={11} fontSize="9.5" fontWeight="700" fill={G}>{altLabel}</text>
        </g>
      )}
      <text x={PL} y={VH-4} fontSize="9" fontWeight="700" fill={MUT} textAnchor="start">{startYear}</text>
      <text x={VW-PR} y={VH-4} fontSize="9" fontWeight="700" fill={MUT} textAnchor="end">{startYear + lastYr}</text>
    </svg>
  );
}

// The overpaying tile: whether overpaying beats saving or the pension, and
// by how much a year.
function OverpayingTile({ sl, worthOverpaying, m, surplusCash }) {
  const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT, padding:"5px 0" };
  return (
    <>
      {sl.willClear && (
        <MobileWinTile
          title={worthOverpaying ? "Overpaying your student loan" : "Is overpaying worth it?"}
          headline={worthOverpaying
            ? `${fmt(sl.overpayTotalBenefit)} ahead in all: the loan's ${sl.lifeRatePct}% beats savings and your pension`
            : sl.effectiveBenefit < 0
              ? `The highest savings rate (${sl.cashRate}%) beats your loan's ${sl.lifeRatePct}% average rate`
              : sl.effectiveBenefit === 0
                ? `The highest savings rate (${sl.cashRate}%) matches your loan's ${sl.lifeRatePct}% average rate, so overpaying doesn't come out ahead`
              : `Your pension's ${sl.pensionGrowthPct}% assumed growth beats your loan's ${sl.lifeRatePct}% average rate`}
          tagLabel={worthOverpaying ? "Today" : "No gain"} tagColor={worthOverpaying ? GOLD : MUT}>
          {sl.balanceGrowing && (
            <div style={{background:"rgba(192,57,43,0.05)",border:"1.5px solid rgba(192,57,43,0.22)",borderRadius:"10px",padding:"12px 14px",marginBottom:"10px"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:CRITICAL,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"6px"}}>Why your balance is growing</div>
              <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.6,margin:0}}>
                Repayments (9% of what you earn over the threshold) haven't caught up with the interest yet. {sl.turningTaxYear
                  ? `With your pay rising as expected, they overtake it from April ${sl.turningTaxYear}, and your balance starts falling.`
                  : "On these figures they don't overtake it before the loan is written off."}
              </p>
            </div>
          )}
          <div style={rowStyle}><span>Step 1 — Outstanding balance at {sl.slRatePct}%</span><span style={{fontWeight:700,color:G}}>{fmt(m.loanBal)}</span></div>
          {surplusCash > 0 ? (
            <div style={rowStyle}><span>Step 2 — Spare cash above your buffer</span><span style={{fontWeight:700,color:G}}>{fmt(surplusCash)}</span></div>
          ) : (
            <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"6px 0"}}>Step 2 — You don't currently hold cash above your emergency buffer; the comparison still applies to any spare cash you build up.</p>
          )}
          <div style={{...rowStyle,fontWeight:700,color:sl.effectiveBenefit > 0 ? SUCCESS : sl.effectiveBenefit === 0 ? MUT : CRITICAL}}>
            <span>Step 3 — {sl.lifeRatePct}% loan (average over its life) vs {sl.cashRate}% highest savings</span>
            <span>{sl.effectiveBenefit > 0 ? `Repay wins by ${sl.effectiveBenefit}%` : sl.effectiveBenefit === 0 ? "Level" : `Savings win by ${Math.abs(sl.effectiveBenefit)}%`}</span>
          </div>
          <div style={{...rowStyle,fontWeight:700,color:sl.beatsPension?SUCCESS:CRITICAL}}>
            <span>Step 4 — {sl.lifeRatePct}% loan (average over its life) vs {sl.pensionGrowthPct}% assumed pension growth</span>
            <span>{sl.pensionGap > 0 ? `Repay wins by ${sl.pensionGap}%` : sl.pensionGap === 0 ? "Level — repaying is guaranteed" : `Pension wins by ${Math.abs(sl.pensionGap)}%`}</span>
          </div>
          <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"6px 0 0"}}>
            Tax relief isn't part of step 4: overpaying clears the loan sooner, and the money that frees up gets the same relief when it goes into your pension then.
          </p>
        </MobileWinTile>
      )}
    </>
  );
}

// Under "Explore what-ifs": modelling a lump sum overpayment, and the
// return on each pound overpaid against putting it in the pension.
function ExploreWhatIfs({ exploreOpen, sl, overpayOptions, selectedScenario, worthOverpaying, baseProjection, overpayAmt, setOverpayAmt, surplusCash, curve, chartWrapRef, m }) {
  return (
    <>
      {exploreOpen && (<>
      {curve && (() => {
        const { VW, VH, PL, PR, PT, PB, sx, sy, path, pensionPath, yTicks, xTicks } = curve;
        return (
          <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px"}}>
            <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"12px"}}>Return per £1 overpaid vs your pension</div>

            <div style={{borderLeft:`4px solid ${GOLD}`,background:"rgba(196,150,58,0.07)",borderRadius:"0 8px 8px 0",padding:"12px 14px",marginBottom:"14px"}}>
              <p style={{fontSize:"13px",color:TEXT,lineHeight:1.6,margin:0,fontWeight:500}}>{describeLoanVsPension(sl)}</p>
            </div>

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
                <span style={{fontSize:"11px",color:MUT}}>Your pension over the same years — {sl.pensionGrowthPct}% a year</span>
              </span>
            </div>
            <p style={{fontSize:"11px",color:MUT,lineHeight:1.5,marginTop:"6px",marginBottom:0}}>Tax relief isn't included: you'd get it whether you pay in now or once the loan clears.</p>
          </div>
        );
      })()}
      </>)}
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
function WhereItCouldGo({ m }) {
  const navigate = useNavigate();
  const { monthly, years, paidIn, options } = loanAlternatives(m);
  return (
    <div style={{background:WHITE,border:"1px solid rgba(22,47,36,0.1)",borderRadius:"14px",padding:"16px 18px",margin:"0 0 16px"}}>
      <div style={{fontSize:"10px",fontWeight:800,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase"}}>Where that money could go instead</div>
      <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"6px 0 4px"}}>£{monthly} a month for {years} years ({fmt(paidIn)} in all) could grow to:</p>
      {options.map((o, i) => (
        <button key={o.key} type="button" onClick={() => navigate(`/app/module/${o.key}`)}
          style={{width:"100%",textAlign:"left",fontFamily:"inherit",cursor:"pointer",background:"none",border:"none",borderTop:i ? "1px solid rgba(22,47,36,0.08)" : "none",padding:"12px 0",display:"flex",alignItems:"center",gap:"12px"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:"10px"}}>
              <span style={{fontSize:"14px",fontWeight:700,color:TEXT}}>{ALTERNATIVES[o.key].title}</span>
              <span style={{fontFamily:SERIF,fontSize:"19px",fontWeight:700,color:G}}>{fmt(o.total)}</span>
            </div>
            <div style={{fontSize:"12.5px",color:MUT,lineHeight:1.45,marginTop:"2px"}}>{ALTERNATIVES[o.key].note(m.tr || 0)}</div>
          </div>
          <ChevronRight size={16} color={MUT} style={{flexShrink:0}}/>
        </button>
      ))}
      <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"4px 0 0"}}>Investments growing 6% a year and savings at today's best rate. Not including anything an employer adds to a pension.</p>
    </div>
  );
}
