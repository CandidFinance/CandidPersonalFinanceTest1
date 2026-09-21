import { useState, useRef, useEffect } from "react";
import { ExternalLink, Wrench } from "lucide-react";
import { calcStudentLoanScenario, calcOverpaymentScenarios } from "../../lib/studentLoan.js";
import { calcLoanMarginalReturnCurve } from "../../lib/forecast.js";
import { fmt, fmtK } from "../../lib/format.js";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, PillSlider, OPPORTUNITY_TILE_BG } from "../../CandidApp.jsx";
import MobileWinTile from "../MobileWinTile.jsx";
import PillMoneyInput from "../PillMoneyInput.jsx";

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

// Candid Score bands mirror ScoreRing's own thresholds (CandidApp.jsx) — kept
// local rather than exported/shared since this is presentation copy, not a
// financial figure other screens need to agree on.
function scoreTier(score) {
  if (typeof score !== "number") return null;
  if (score >= 86) return "strong";
  if (score >= 66) return "solid";
  if (score >= 41) return "developing";
  return "early";
}

// Personalised verdict for the marginal-return chart — how the loan's return
// compares to the pension's, and (when there's a genuine crossover point) how
// hard to lean into repaying based on how sorted the rest of the user's
// finances are (their Candid Score) — the better covered their other bases,
// the more reasonable it is to prioritise debt reduction with spare cash.
function buildRepaymentVerdict({ pensionReturn, crossAmt, data, score }) {
  const lastRatio = data[data.length - 1]?.ratio ?? 1;
  if (crossAmt === null && data[0].ratio < pensionReturn) {
    return `Your pension return (${pensionReturn.toFixed(2)}×) beats this loan's return at every level — every £1 works harder in your pension than paid toward this loan.`;
  }
  if (crossAmt === null && lastRatio > pensionReturn) {
    return `This loan's return beats your ${pensionReturn.toFixed(2)}× pension return at every level modelled — worth clearing before maximising pension contributions.`;
  }
  if (crossAmt !== null) {
    const base = `Overpaying has a weaker return than your pension (${pensionReturn.toFixed(2)}×) beyond about ${fmtK(crossAmt)} — but up to that point, repaying still beats your pension return.`;
    const tier = scoreTier(score);
    if (tier === "strong" || tier === "solid") {
      return `${base} With the rest of your finances in good shape, repaying up to ${fmtK(crossAmt)} is a reasonable use of spare cash if reducing debt matters to you.`;
    }
    if (tier === "developing" || tier === "early") {
      return `${base} With other priorities still to sort first, it's worth tackling those before directing spare cash here.`;
    }
    return base;
  }
  return null;
}

// Full mobile version of desktop's Student Loan deep dive (ModuleDeepDive,
// moduleKey==="studentLoan" — CandidApp.jsx): the opportunity strip, the loan-
// trajectory summary, the "does overpaying beat cash" walkthrough (Win tile —
// unnumbered, since there's only ever one Win here), a separate overpayment-
// scenario tile (amount slider instead of desktop's fixed £5k/£10k/£20k
// cards), and a separate "marginal return per £1 overpaid" chart tile with a
// personalised repay-vs-pension verdict. calcStudentLoanScenario/
// calcOverpaymentScenarios/calcLoanMarginalReturnCurve are the same single
// source of truth desktop and computeModuleStatuses use, so the numbers
// can't drift between mobile and desktop.
export default function MobileStudentLoanDeepDive({ d, m, insights, onRecordLoanOverpayment }) {
  const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT, padding:"5px 0" };
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
  }, []);
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

  if (d.studentLoan === "none" || m.loanBal <= 0) {
    return <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.6}}>No student loan on record.</p>;
  }

  const sl = calcStudentLoanScenario(d, m);
  const worthOverpaying = sl.willClear && sl.effectiveBenefit > 0;
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

  return (
    <div>
      {worthOverpaying && (
        <div style={{background:OPPORTUNITY_TILE_BG,borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
          <div style={{fontSize:"10px",fontWeight:800,color:"#8a6a24",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Opportunity</div>
          <div style={{fontFamily:SERIF,fontSize:"32px",color:TEXT,fontWeight:700,lineHeight:1.1}}>{fmt(sl.overpayAnnualBenefit)}/yr</div>
          <div style={{fontSize:"12px",color:"#8a6a24",marginTop:"4px",fontWeight:600}}>Effective benefit from overpaying vs cash</div>
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
        <p style={{fontSize:"13px",color:MUT,lineHeight:1.6,margin:0}}>
          {sl.belowThreshold
            ? `Your salary is below the repayment threshold, so no deductions yet. Interest still accrues at ${sl.slRatePct}% (~${fmt(sl.annualInterest)}/yr).`
            : !sl.willClear
              ? "Projected to be written off before you'd clear it — overpaying mostly reduces the write-off, not your repayments."
              : sl.effectiveBenefit <= 0
                ? `On track to clear in ~${sl.clearYr} years. Your savings rate (${sl.cashRate}%) beats your loan rate (${sl.slRatePct}%) — saving beats overpaying here.`
                : "See the win below for what overpaying could save you."}
        </p>
      </div>

      {sl.willClear && (
        <MobileWinTile
          title={sl.balanceGrowing ? "Your loan balance is growing" : worthOverpaying ? "Overpay your student loan" : "What overpaying would do"}
          headline={sl.balanceGrowing
            ? `Growing by ${fmt(sl.netAnnualChange)}/yr — overpaying could still save ${fmt(sl.overpayAnnualBenefit)}/yr`
            : worthOverpaying
              ? `${fmt(sl.overpayAnnualBenefit)}/yr effective benefit vs cash`
              : `Your ${sl.cashRate}% savings rate beats your ${sl.slRatePct}% loan rate`}
          tagLabel={worthOverpaying ? "Today" : "Not optimal"} tagColor={worthOverpaying ? GOLD : "#c0392b"}>
          {sl.balanceGrowing && (
            <div style={{background:"rgba(192,57,43,0.05)",border:"1.5px solid rgba(192,57,43,0.22)",borderRadius:"10px",padding:"12px 14px",marginBottom:"10px"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:"#c0392b",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"6px"}}>Effective 9% income surcharge</div>
              <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.6,margin:0}}>
                Your balance grows because repayments haven't caught up with interest yet. At {fmt(sl.inflectionSalary)} salary, repayments would exactly match interest — above that, your balance starts shrinking.
              </p>
            </div>
          )}
          <div style={rowStyle}><span>Step 1 — Outstanding balance at {sl.slRatePct}%</span><span style={{fontWeight:700,color:G}}>{fmt(m.loanBal)}</span></div>
          {surplusCash > 0 ? (
            <div style={rowStyle}><span>Step 2 — Spare cash above your buffer</span><span style={{fontWeight:700,color:G}}>{fmt(surplusCash)}</span></div>
          ) : (
            <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"6px 0"}}>Step 2 — You don't currently hold cash above your emergency buffer; the comparison still applies to any spare cash you build up.</p>
          )}
          <div style={{...rowStyle,fontWeight:700,color:worthOverpaying?"#2d6b4a":"#c0392b"}}>
            <span>Step 3 — {sl.slRatePct}% loan vs {sl.cashRate}% cash</span>
            <span>{worthOverpaying ? `Repay wins by ${sl.effectiveBenefit}%` : `Cash wins by ${Math.abs(sl.effectiveBenefit)}%`}</span>
          </div>
        </MobileWinTile>
      )}

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
            {selectedScenario.crossesInflection && <span style={{color:"#2d6b4a",fontWeight:600}}> This reaches the inflection point — your balance starts shrinking from here.</span>}
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
        const { pensionReturn, data, VW, VH, PL, PR, PT, PB, sx, sy, path, crossAmt, crossX, crossY, yTicks, xTicks } = curve;
        const verdict = buildRepaymentVerdict({ pensionReturn, crossAmt, data, score: insights?.score });
        return (
          <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px"}}>
            <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"12px"}}>Return per £1 overpaid vs your pension</div>

            {verdict && (
              <div style={{borderLeft:`4px solid ${GOLD}`,background:"rgba(196,150,58,0.07)",borderRadius:"0 8px 8px 0",padding:"12px 14px",marginBottom:"14px"}}>
                <p style={{fontSize:"13px",color:TEXT,lineHeight:1.6,margin:0,fontWeight:500}}>{verdict}</p>
              </div>
            )}

            <div ref={chartWrapRef} style={{width:"100%"}}>
              <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`} style={{display:"block"}}>
                {yTicks.map(r => (
                  <g key={r}>
                    <line x1={PL} x2={VW-PR} y1={sy(r)} y2={sy(r)} stroke="rgba(22,47,36,0.08)" strokeWidth="1"/>
                    <text x={PL-6} y={sy(r)+3} fontSize="9" fontWeight="700" fill={MUT} textAnchor="end">{r.toFixed(2)}×</text>
                  </g>
                ))}
                <line x1={PL} x2={VW-PR} y1={sy(pensionReturn)} y2={sy(pensionReturn)} stroke={GOLD} strokeWidth="1.6" strokeDasharray="5,3"/>
                <path d={path} fill="none" stroke={G} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                {crossX !== null && (
                  <>
                    <line x1={crossX} x2={crossX} y1={PT} y2={VH-PB} stroke={GOLD} strokeWidth="1" strokeDasharray="4,3" opacity="0.5"/>
                    <circle cx={crossX} cy={crossY} r="4" fill={GOLD}/>
                  </>
                )}
                <line x1={PL} x2={VW-PR} y1={VH-PB} y2={VH-PB} stroke="rgba(22,47,36,0.25)" strokeWidth="1.3"/>
                {xTicks.map((amt,i) => (
                  <text key={i} x={sx(amt)} y={VH-PB+13} fontSize="9" fontWeight="700" fill={MUT} textAnchor={i===0?"start":i===xTicks.length-1?"end":"middle"}>{fmtK(amt)}</text>
                ))}
                <line x1={PL} x2={PL} y1={PT} y2={VH-PB} stroke="rgba(22,47,36,0.25)" strokeWidth="1.3"/>
              </svg>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"8px"}}>
              <span style={{width:"14px",height:"2px",background:GOLD,display:"inline-block"}}/>
              <span style={{fontSize:"11px",color:MUT}}>Your pension return — {pensionReturn.toFixed(2)}×</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
