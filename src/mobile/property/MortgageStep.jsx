import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import EmptyResultCard from "./EmptyResultCard.jsx";
import ExpandChevron, { CARD_PADDING_WITH_CHEVRON } from "./ExpandChevron.jsx";
import { G, MUT, TEXT, SERIF, SC, WHITE } from "../../CandidApp.jsx";
import { borrowingInputs, calcBorrowingCheck } from "../../lib/borrowing.js";
import { mortgageInputs, mortgageSummary, FIXED_PERIOD_OPTIONS, STRESS_REMORTGAGE_UPLIFT } from "../../lib/mortgage.js";
import { fmt } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import InfoButton from "../InfoButton.jsx";
import PillCell from "./PillCell.jsx";
import PillSelect from "./PillSelect.jsx";
import StickySummaryBar, { SummaryLabel, SummaryFigure } from "./StickySummaryBar.jsx";
import AssumptionsHeading from "./AssumptionsHeading.jsx";
import { ExplainLink } from "../ModuleScreenParts.jsx";
import useWhyInfo from "./useWhyInfo.jsx";

// Property step 2: the repayment mortgage on the loan from step 1 (logic in
// src/lib/mortgage.js). Only reachable once step 1 is complete.

const FIXED_OPTIONS = FIXED_PERIOD_OPTIONS.map(y => ({ value:String(y), label:`${y} years` }));
const pctText = n => `${Math.round(n * 100) / 100}%`;
const COLUMN_MIN = "140px";

// The monthly repayment over the term: flat for the fixed period, then
// three lines from the first remortgage, for rates 1.5 points higher, the
// same, or 1.5 points lower by then. Each scenario keeps that rate for every
// later remortgage, so its payment stays flat (mortgageSchedule). The
// figures sit in a right-hand gutter, nudged apart so they never overlap.
// Measured in real pixels so the viewBox matches the rendered width 1:1
// (same approach as NetCostChart in RentVsBuyStep).
function RepaymentPath({ payment, fixedYears, termYears, outcomes }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || 320);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const colour = { stress: SC.critical, moderate: TEXT, lower: SC.ok };
  const H = 112, PT = 14, PB = 14, GUTTER = 66, LABEL_GAP = 30;
  const plotW = Math.max(60, width - GUTTER);
  const vals = [payment, ...outcomes.map(o => o.monthlyPayment)];
  const hi = Math.max(...vals), lo = Math.min(...vals);
  const span = Math.max(hi - lo, hi * 0.1);
  const top = hi + span * 0.08, bottom = lo - span * 0.08;
  const y = v => PT + (1 - (v - bottom) / (top - bottom)) * (H - PT - PB);
  const fx = (fixedYears / termYears) * plotW;
  // Label positions, highest payment first, pushed down until 30px apart.
  const labels = [...outcomes].sort((a, b) => b.monthlyPayment - a.monthlyPayment).map(o => ({ ...o, top: y(o.monthlyPayment) }));
  labels.forEach((l, i) => { if (i > 0) l.top = Math.max(l.top, labels[i - 1].top + LABEL_GAP); });
  const axis = { position:"absolute", top:0, fontSize:"10.5px", color:MUT, whiteSpace:"nowrap" };
  return (
    <div ref={wrapRef} style={{marginTop:"14px"}}>
      <div style={{fontSize:"11.5px",color:MUT,marginBottom:"4px"}}>If rates have moved when you remortgage</div>
      <div style={{position:"relative",height:`${Math.max(H, labels.at(-1).top + 22)}px`}}>
        <svg width={plotW} height={H} viewBox={`0 0 ${plotW} ${H}`} style={{display:"block",overflow:"visible"}}>
          <line x1={fx} x2={fx} y1={4} y2={H - 4} stroke="rgba(22,47,36,0.2)" strokeWidth="1" strokeDasharray="3 3"/>
          {outcomes.map(o => (
            <path key={o.scenario} d={`M${fx},${y(payment)} L${fx + 8},${y(o.monthlyPayment)} L${plotW},${y(o.monthlyPayment)}`}
              fill="none" stroke={colour[o.scenario]} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          ))}
          <path d={`M0,${y(payment)} L${fx},${y(payment)}`} fill="none" stroke={G} strokeWidth="3" strokeLinecap="round"/>
        </svg>
        {labels.map(l => (
          <div key={l.scenario} style={{position:"absolute",left:`${plotW + 8}px`,top:`${l.top - 9}px`,lineHeight:1.15}}>
            <div style={{fontSize:"13px",fontWeight:700,color:colour[l.scenario]}}>{fmt(l.monthlyPayment)}</div>
            <div style={{fontSize:"10.5px",color:MUT}}>at {pctText(l.ratePct)}</div>
          </div>
        ))}
      </div>
      <div style={{position:"relative",height:"14px",width:`${plotW}px`,marginTop:"2px"}}>
        {/* The remortgage year always shows; "Now" only if there's room
            before it. */}
        {fx > 60 && <span style={{...axis,left:0}}>Now</span>}
        <span style={{...axis,left:`${Math.max(fx, 20)}px`,transform:"translateX(-50%)"}}>Year {fixedYears + 1}</span>
        {plotW - fx > 70 && <span style={{...axis,right:0}}>Year {termYears}</span>}
      </div>
    </div>
  );
}

// Laid out like step 1: the result first (the repayment, with the rate
// scenarios and totals behind a chevron so the result and the inputs fit on
// one screen), then the inputs that drive it, with a sticky bar keeping the
// repayment in view while they're edited. While its guided walk-through runs,
// `guide` takes the inputs' place, and `holdResult` blurs the card until the
// user's own term and rate are in; `onWalkThrough` reruns it.
export default function MortgageStep({ d, m, set, onContinue, guide, holdResult = false, onWalkThrough, onExplain }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [totalInfoOpen, setTotalInfoOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const resultRef = useRef(null);
  const why = useWhyInfo({ d, m });
  const explainer = { fontSize:"11.5px", color:MUT, lineHeight:1.5, background:"#ede7db", borderRadius:"8px", padding:"8px 10px", margin:0 };
  const figureLabel = { fontSize:"10px", fontWeight:600, color:MUT, letterSpacing:"0.06em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:"6px" };
  const sectionHeading = { fontSize:"10px", fontWeight:700, color:MUT, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"10px" };
  const divider = { border:"none", borderTop:"1px solid rgba(22,47,36,0.1)", margin:"18px 0 14px" };
  const columns = { display:"flex", gap:"10px", flexWrap:"wrap" };

  const loan = calcBorrowingCheck(borrowingInputs(d, m)).loanNeeded;
  const input = mortgageInputs(d, loan);
  const s = mortgageSummary(input);
  const totalCost = loan + s.totalInterest + s.totalFees;
  // The remortgage range, shown in one line while the chart is collapsed.
  const outcomePayments = (s.remortgageOutcomes || []).map(o => o.monthlyPayment);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}}>
        <div style={sectionHeading}>What you'd repay</div>
        {/* "Explain this" replays the answer step by step. */}
        {!holdResult && loan > 0 && <div style={{marginBottom:"10px"}}><ExplainLink onClick={onExplain}/></div>}
      </div>
      {holdResult ? (
        <EmptyResultCard text="Answer the questions below to see what you'd repay."/>
      ) : (
      <motion.div ref={resultRef} initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.4}}
        style={{scrollMarginTop:"16px",background:WHITE,borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",padding:loan === 0 ? "18px" : CARD_PADDING_WITH_CHEVRON}}>
        {loan === 0 ? (
          <p style={{fontSize:"13px",fontWeight:700,color:SC.ok,margin:0}}>No mortgage needed: cash covers the price, stamp duty and fees.</p>
        ) : (
          <>
            <div style={figureLabel}>
              Monthly repayment
              <InfoButton open={infoOpen} onClick={() => setInfoOpen(o => !o)}/>
            </div>
            <div style={{fontFamily:SERIF,fontSize:"30px",fontWeight:700,color:TEXT,lineHeight:1.2}}>{fmt(s.monthlyPayment)}</div>
            <div style={{fontSize:"12.5px",color:MUT,marginTop:"2px"}}>
              {s.remortgageOutcomes ? `For the first ${input.fixedYears} years at ${pctText(input.ratePct)}` : `At ${pctText(input.ratePct)}, fixed for the whole term`}
            </div>
            {infoOpen && (
              <p style={{...explainer,marginTop:"10px"}}>
                Capital and interest, so the loan is paid off over {input.termYears} years.{s.remortgageOutcomes ? ` When each fix ends, Candid assumes you remortgage onto a new ${input.fixedYears}-year deal and pay the fee from cash. From year ${s.firstRemortgageYear}, the repayment depends on whether rates are then ${STRESS_REMORTGAGE_UPLIFT} points higher, the same, or ${STRESS_REMORTGAGE_UPLIFT} points lower.` : ""}
              </p>
            )}
            {s.remortgageOutcomes && !detailsOpen && (
              <div style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,marginTop:"10px"}}>
                From year {s.firstRemortgageYear}: {fmt(Math.min(...outcomePayments))} to {fmt(Math.max(...outcomePayments))} a month, if rates move {STRESS_REMORTGAGE_UPLIFT} points either way.
              </div>
            )}

            {/* The rate scenarios and totals, collapsed by default so the
                result and the inputs below fit on one screen. */}
            {detailsOpen && (<>
            {s.remortgageOutcomes && (
              <RepaymentPath payment={s.monthlyPayment} fixedYears={input.fixedYears} termYears={input.termYears} outcomes={s.remortgageOutcomes}/>
            )}

            <hr style={{border:"none",borderTop:"1px solid rgba(22,47,36,0.1)",margin:"16px 0 12px"}}/>
            <div style={{display:"flex",gap:"12px"}}>
              {[
                { label:"Loan", value:loan },
                { label:"Interest", value:s.totalInterest },
                { label:"Total cost", value:totalCost, info:<InfoButton open={totalInfoOpen} onClick={() => setTotalInfoOpen(o => !o)}/> },
              ].map(c => (
                <div key={c.label} style={{flex:1,minWidth:0}}>
                  <div style={figureLabel}>{c.label}{c.info}</div>
                  <div style={{fontSize:"15px",fontWeight:700,color:TEXT,marginTop:"2px"}}>{fmt(c.value)}</div>
                </div>
              ))}
            </div>
            {totalInfoOpen && (
              <p style={{...explainer,marginTop:"10px"}}>
                The {fmt(loan)} loan plus {fmt(s.totalInterest)} of interest over {input.termYears} years{s.remortgages > 0 ? `, and ${s.remortgages} remortgage ${s.remortgages === 1 ? "fee" : "fees"} of ${fmt(input.remortgageFee)} (${fmt(s.totalFees)})` : ""}.{s.remortgages > 0 ? ` This assumes rates stay at ${pctText(input.ratePct)}; higher or lower rates at each remortgage change the interest.` : ""}
              </p>
            )}
            </>)}
            <ExpandChevron open={detailsOpen} onToggle={() => setDetailsOpen(o => !o)} label="the details"/>
          </>
        )}
      </motion.div>
      )}
      {loan > 0 && !holdResult && (
        <StickySummaryBar watchRef={resultRef} label="Back to what you'd repay">
          <SummaryLabel>Monthly repayment</SummaryLabel>
          <SummaryFigure color={TEXT}>{fmt(s.monthlyPayment)}</SummaryFigure>
        </StickySummaryBar>
      )}

      <hr style={divider}/>
      {guide || (<>
      <AssumptionsHeading text="Set your mortgage assumptions." onWalkThrough={onWalkThrough}/>
      <div style={columns}>
        <PillCell min={COLUMN_MIN} info={why.button("term")}><PillMoneyInput label="Term (years)" unit="" value={input.termYears} onChange={v => set("propertyMortgageTerm", v ?? "")}/></PillCell>
        <PillCell min={COLUMN_MIN} info={why.button("rate")}><PillMoneyInput label="Mortgage rate" unit="%" value={input.ratePct || null} onChange={v => set("propertyMortgageRate", v ?? "")}/></PillCell>
      </div>
      {why.panel("term", "rate")}
      <div style={{...columns,marginTop:"10px"}}>
        <PillCell min={COLUMN_MIN} info={why.button("fixedYears")}><PillSelect label="Fixed for" value={String(input.fixedYears)} onChange={v => set("propertyFixedYears", v)} options={FIXED_OPTIONS}/></PillCell>
        <PillCell min={COLUMN_MIN}><PillMoneyInput label="Remortgage fee" value={input.remortgageFee || null} onChange={v => set("propertyRemortgageFee", v ?? "")}/></PillCell>
      </div>
      {why.panel("fixedYears")}

      {onContinue && (
        <button type="button" onClick={onContinue} style={{
          width:"100%", marginTop:"24px", background:G, color:WHITE, border:"none", borderRadius:"100px",
          padding:"13px", fontSize:"14px", fontWeight:700, fontFamily:"inherit", cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center", gap:"4px",
        }}>
          Continue to rent vs buy<ChevronRight size={16}/>
        </button>
      )}
      </>)}
    </div>
  );
}
