import { useState, useRef, useEffect } from "react";
import { ExternalLink, Wrench } from "lucide-react";
import { calcStudentLoanScenario, calcOverpaymentScenarios, describeLoanVsPension } from "../../lib/studentLoan.js";
import { calcLoanMarginalReturnCurve } from "../../lib/forecast.js";
import { fmt, fmtK } from "../../lib/format.js";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, PillSlider, OPPORTUNITY_TILE_BG, OPPORTUNITY_TILE_LABEL, OPPORTUNITY_TILE_FIGURE, OPPORTUNITY_TILE_BODY } from "../../CandidApp.jsx";
import MobileWinTile from "../MobileWinTile.jsx";
import PillMoneyInput from "../PillMoneyInput.jsx";
import { ExplainLink, ExploreToggle } from "../ModuleScreenParts.jsx";
import { OPPORTUNITY_TILE_BORDER, OPPORTUNITY_TILE_SHADOW } from "../../design-tokens.js";

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
// `onShowReveal` replays the answer step by step ("Explain this").
export default function MobileStudentLoanDeepDive({ d, m, set, insights, onRecordLoanOverpayment, onShowReveal }) {
  const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT, padding:"5px 0" };
  const [exploreOpen, setExploreOpen] = useState(false); // before the chart's measuring effect, which waits for it
  const [editingBalance, setEditingBalance] = useState(false);
  // null = still following the overpayment slider automatically; a number
  // once the user types their own value into the editor, which then stops
  // tracking further slider movement (their explicit edit wins).
  const [manualBalanceInput, setManualBalanceInput] = useState(null);
  const chartWrapRef = useRef(null);
  // Measured in real CSS pixels so the viewBox always matches the rendered
  // width 1:1 — see mobile Forecast's chart for the same pattern/rationale.
  const [chartWidth, setChartWidth] = useState(300);
  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const update = () => setChartWidth(el.clientWidth || 300);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
    // The chart sits under "Explore what-ifs": measure it once that's open.
  }, [exploreOpen]);
  // Default overpayment slider position: the largest round amount the user's
  // spare cash could actually cover, falling back to the smallest option.
  // Computed from `m` alone (no `sl`/guard dependency) so this hook can stay
  // unconditional, alongside the ones above.
  const [overpayAmt, setOverpayAmt] = useState(() => {
    const options = buildOverpayOptions(m.loanBal);
    if (!options.length) return 0;
    const affordable = options.filter(x => x <= (m.surplusCash||0));
    return affordable.length ? affordable[affordable.length-1] : options[0];
  });

  // The write-off assumption's editor (below); hooks stay above the return.
  const [editingStart, setEditingStart] = useState(false);
  const [startInput, setStartInput] = useState(null);

  if (d.studentLoan === "none" || m.loanBal <= 0) {
    return <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.6}}>No student loan on record.</p>;
  }

  const sl = calcStudentLoanScenario(d, m);
  const worthOverpaying = sl.worthOverpaying;
  const surplusCash = m.surplusCash || 0;
  const curve = calcLoanMarginalReturnCurve(d, m, sl, chartWidth);

  const fullAmt = Math.round(m.loanBal);
  const overpayOptions = buildOverpayOptions(m.loanBal);
  const { scenarios, baseProjection } = calcOverpaymentScenarios(m, sl, [overpayAmt]);
  const selectedScenario = scenarios[0];
  const savedVsBase = selectedScenario ? baseProjection.totalPaid - selectedScenario.totalPaid : 0;

  const stats = [
    { label:"Interest rate", value:`${sl.slRatePct}%` },
    { label:"Annual interest", value:`${fmt(sl.annualInterest)}/yr` },
    { label:"Annual repayments", value:`${fmt(sl.annualRep)}/yr` },
    { label: sl.clearYr ? "Clears in" : "Written off after", value: sl.clearYr ? `${sl.clearYr} yrs` : `${sl.writeOffYr} yrs` },
  ];

  // Suggests the balance after paying the currently-selected slider amount,
  // rather than a blank/current-balance starting point — if the user came
  // here having just modelled an overpayment above, that's almost certainly
  // the figure they're about to confirm. Stays live-synced to the slider
  // (recomputed every render, not snapshotted on open) until the user types
  // their own value, and re-syncs the next time the editor is opened fresh.
  const suggestedBalance = Math.max(0, Math.round(m.loanBal) - (overpayAmt || 0));
  const balanceInput = manualBalanceInput != null ? manualBalanceInput : suggestedBalance;
  const openBalanceEditor = () => { setManualBalanceInput(null); setEditingBalance(true); };
  const closeBalanceEditor = () => { setEditingBalance(false); setManualBalanceInput(null); };
  const saveBalanceEdit = () => {
    if (onRecordLoanOverpayment) onRecordLoanOverpayment(Math.max(0, balanceInput));
    closeBalanceEditor();
  };
  const cashDelta = Math.max(0, Math.round(m.loanBal) - balanceInput);

  // When repayments started decides when the loan is written off. Estimated
  // from age unless the user says (studentLoan.js slFirstDueYear).
  const startValue = startInput ?? sl.firstDueYear;
  const saveStart = () => {
    if (set && startValue >= 1990 && startValue <= new Date().getFullYear() + 10) set("slFirstDueYear", String(Math.round(startValue)));
    setEditingStart(false); setStartInput(null);
  };
  const resetStart = () => { if (set) set("slFirstDueYear", ""); setEditingStart(false); setStartInput(null); };

  return (
    <div>
      {!worthOverpaying && onShowReveal && <div style={{marginBottom:"14px"}}><ExplainLink onClick={onShowReveal}/></div>}
      {worthOverpaying && (
        <div style={{background:OPPORTUNITY_TILE_BG,border:OPPORTUNITY_TILE_BORDER,boxShadow:OPPORTUNITY_TILE_SHADOW,borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",marginBottom:"10px"}}>
            <div style={{fontSize:"10px",fontWeight:800,color:OPPORTUNITY_TILE_LABEL,letterSpacing:"0.08em",textTransform:"uppercase"}}>Opportunity</div>
            <ExplainLink onClick={onShowReveal} color={OPPORTUNITY_TILE_FIGURE}/>
          </div>
          <div style={{fontFamily:SERIF,fontSize:"32px",color:OPPORTUNITY_TILE_FIGURE,fontWeight:700,lineHeight:1.1}}>{fmt(sl.overpayAnnualBenefit)}/yr</div>
          <div style={{fontSize:"12px",color:OPPORTUNITY_TILE_LABEL,marginTop:"4px",fontWeight:600}}>Better off overpaying than saving the money</div>
        </div>
      )}

      <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
        <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"12px"}}>Your loan trajectory</div>

        <div style={{marginBottom:"12px"}}>
          <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>Current balance</div>
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
          <div style={{background:"#ede7db",borderRadius:"10px",padding:"12px 14px",marginBottom:"12px"}}>
            <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"8px"}}>Update your balance</div>
            <PillMoneyInput label="New balance" value={balanceInput} onChange={setManualBalanceInput}/>
            <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginTop:"10px",marginBottom:0}}>
              {cashDelta > 0
                ? `We'll also reduce your recorded cash by ${fmt(cashDelta)} — that's what paid the loan down, so it shouldn't be counted twice.`
                : "This updates your loan balance across the whole app."}
            </p>
            <div style={{display:"flex",gap:"8px",marginTop:"12px"}}>
              <button onClick={closeBalanceEditor} style={{flex:1,background:"transparent",border:"1.3px solid rgba(22,47,36,0.2)",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,color:G,cursor:"pointer"}}>Cancel</button>
              <button onClick={saveBalanceEdit} style={{flex:1,background:G,border:"none",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,color:WHITE,cursor:"pointer"}}>Save</button>
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

        <p style={{fontSize:"12px",color:MUT,lineHeight:1.55,margin:"0 0 12px"}}>
          Written off in April {sl.writeOffTaxYear}. {sl.firstDueEstimated
            ? `We've assumed repayments started in April ${sl.firstDueYear}, the April after you turned 22.`
            : `Repayments started in April ${sl.firstDueYear}, as you told us.`}{" "}
          {set && !editingStart && (
            <button type="button" onClick={() => setEditingStart(true)} style={{background:"none",border:"none",padding:0,color:G,fontWeight:600,fontSize:"12px",cursor:"pointer",textDecoration:"underline"}}>Change</button>
          )}
        </p>
        {editingStart && (
          <div style={{background:"#ede7db",borderRadius:"10px",padding:"12px 14px",marginBottom:"12px"}}>
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
                ? `On track to clear in ~${sl.clearYr} years. The best savings rate (${sl.cashRate}%) beats your loan rate (${sl.slRatePct}%) — saving beats overpaying here.`
                : !sl.beatsPension
                  ? `On track to clear in ~${sl.clearYr} years. Your pension is assumed to grow ${sl.pensionGrowthPct}% a year, faster than your loan's ${sl.slRatePct}% — so it beats overpaying here.`
                  : "See the win below for what overpaying could save you."}
        </p>
      </div>

      {sl.willClear && (
        <MobileWinTile
          title={sl.balanceGrowing ? "Your loan balance is growing" : worthOverpaying ? "Overpay your student loan" : "What overpaying would do"}
          headline={worthOverpaying
            ? (sl.balanceGrowing
                ? `Growing by ${fmt(sl.netAnnualChange)}/yr — overpaying could still save ${fmt(sl.overpayAnnualBenefit)}/yr`
                : `${fmt(sl.overpayAnnualBenefit)}/yr better off than saving at the best rate`)
            : sl.effectiveBenefit <= 0
              ? `The best savings rate (${sl.cashRate}%) beats your ${sl.slRatePct}% loan rate`
              : `Your pension's ${sl.pensionGrowthPct}% assumed growth beats your ${sl.slRatePct}% loan rate`}
          tagLabel={worthOverpaying ? "Today" : "Not optimal"} tagColor={worthOverpaying ? GOLD : "#c0392b"}>
          {sl.balanceGrowing && (
            <div style={{background:"rgba(192,57,43,0.05)",border:"1.5px solid rgba(192,57,43,0.22)",borderRadius:"10px",padding:"12px 14px",marginBottom:"10px"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:"#c0392b",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"6px"}}>Why your balance is growing</div>
              <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.6,margin:0}}>
                Repayments (9% of what you earn over the threshold) haven't caught up with the interest yet. At a {fmt(sl.inflectionSalary)} salary they'd match it, and above that your balance starts falling.
              </p>
            </div>
          )}
          <div style={rowStyle}><span>Step 1 — Outstanding balance at {sl.slRatePct}%</span><span style={{fontWeight:700,color:G}}>{fmt(m.loanBal)}</span></div>
          {surplusCash > 0 ? (
            <div style={rowStyle}><span>Step 2 — Spare cash above your buffer</span><span style={{fontWeight:700,color:G}}>{fmt(surplusCash)}</span></div>
          ) : (
            <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"6px 0"}}>Step 2 — You don't currently hold cash above your emergency buffer; the comparison still applies to any spare cash you build up.</p>
          )}
          <div style={{...rowStyle,fontWeight:700,color:sl.effectiveBenefit > 0?"#2d6b4a":"#c0392b"}}>
            <span>Step 3 — {sl.slRatePct}% loan vs {sl.cashRate}% best savings</span>
            <span>{sl.effectiveBenefit > 0 ? `Repay wins by ${sl.effectiveBenefit}%` : `Savings win by ${Math.abs(sl.effectiveBenefit)}%`}</span>
          </div>
          <div style={{...rowStyle,fontWeight:700,color:sl.beatsPension?"#2d6b4a":"#c0392b"}}>
            <span>Step 4 — {sl.slRatePct}% loan vs {sl.pensionGrowthPct}% pension growth</span>
            <span>{sl.pensionGap > 0 ? `Repay wins by ${sl.pensionGap}%` : sl.pensionGap === 0 ? "Level — repaying is guaranteed" : `Pension wins by ${Math.abs(sl.pensionGap)}%`}</span>
          </div>
          <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"6px 0 0"}}>
            Tax relief isn't part of step 4: overpaying clears the loan sooner, and the money that frees up gets the same relief when it goes into your pension then.
          </p>
        </MobileWinTile>
      )}

      {(sl.willClear && overpayOptions.length > 0 && selectedScenario || curve) && (
        <ExploreToggle open={exploreOpen} onToggle={() => setExploreOpen(o => !o)} hint="overpaying, and loan vs pension"/>
      )}

      {exploreOpen && (<>
      {sl.willClear && overpayOptions.length > 0 && selectedScenario && (
        <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
          <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"14px"}}>Model a lump sum overpayment</div>
          {!worthOverpaying && (
            <p style={{fontSize:"12px",color:MUT,lineHeight:1.6,marginTop:"-8px",marginBottom:"14px"}}>Not recommended given your rates, but for reference:</p>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"4px",textAlign:"center"}}>
            <div>
              <div style={{fontSize:"9.5px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>Saved</div>
              <div style={{fontFamily:SERIF,fontSize:"27px",color:savedVsBase>0?"#2d6b4a":G,fontWeight:700,marginTop:"4px",lineHeight:1.15}}>{fmt(Math.max(0,savedVsBase))}</div>
            </div>
            <div>
              <div style={{fontSize:"9.5px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{selectedScenario.clearYr ? "Clears in" : "Written off"}</div>
              <div style={{fontFamily:SERIF,fontSize:"27px",color:G,fontWeight:700,marginTop:"4px",lineHeight:1.15}}>{selectedScenario.clearYr ? `${selectedScenario.clearYr} yrs` : fmt(selectedScenario.writeOffBal)}</div>
            </div>
            <div>
              <div style={{fontSize:"9.5px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>Total repaid</div>
              <div style={{fontFamily:SERIF,fontSize:"27px",color:G,fontWeight:700,marginTop:"4px",lineHeight:1.15}}>{fmt(selectedScenario.totalPaid)}</div>
            </div>
          </div>
          <p style={{fontSize:"11px",color:MUT,lineHeight:1.5,marginTop:"12px",marginBottom:"14px"}}>
            vs {baseProjection.clearYr ? `clearing in ${baseProjection.clearYr} yrs` : `${fmt(baseProjection.writeOffBal)} written off`} and {fmt(baseProjection.totalPaid)} repaid with no overpayment.
            {selectedScenario.crossesInflection && <span style={{color:"#2d6b4a",fontWeight:600}}> From here your balance starts falling.</span>}
          </p>
          <PillSlider value={overpayAmt} onChange={setOverpayAmt} options={overpayOptions.map(amt => ({ value:amt, label: amt===fullAmt ? "Full" : fmtK(amt) }))}/>

          {worthOverpaying && surplusCash > 0 && (
            <>
              <a href="https://www.gov.uk/sign-in-to-manage-your-student-loan-balance" target="_blank" rel="noopener noreferrer" style={{
                marginTop:"16px",width:"100%",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"13px",
                fontSize:"14px",fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                gap:"7px",textDecoration:"none",boxSizing:"border-box",
              }}>
                Make an overpayment via SLC <ExternalLink size={14}/>
              </a>
              <p style={{fontSize:"11px",color:MUT,lineHeight:1.5,marginTop:"8px",marginBottom:0,textAlign:"center"}}>Opens gov.uk in a new tab to sign in and manage your loan.</p>
            </>
          )}
        </div>
      )}

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
    </div>
  );
}
