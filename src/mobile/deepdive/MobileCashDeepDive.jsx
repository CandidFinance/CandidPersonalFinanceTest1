import { useState } from "react";
import { calcCashOptimisation } from "../../lib/cash.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import { G, GOLD, WHITE, MUT, TEXT, SERIF } from "../../CandidApp.jsx";
import MobileWinTile from "../MobileWinTile.jsx";

// Trimmed mobile version of desktop's Cash deep dive (ModuleDeepDive,
// moduleKey==="cash" — CandidApp.jsx). Keeps the opportunity strip, the
// emergency-fund win, a condensed 3-step ISA→PSA→Premium Bonds optimise-cash
// walkthrough, and the cash-runway indicator. Deliberately drops desktop's
// account-by-account allocation list, the Step 4 GIA growth illustration,
// live product-rate cards, and the "other cash-like options" section — v1
// scope per the mobile deep-dive plan; isaRatePct/nonIsaRatePct are omitted
// (calcCashOptimisation's built-in ~4.9%/4.5% fallbacks apply, the same
// defaults the app already shows before live market rates load — so "best
// rate" here is illustrative, not yet a live comparison, until savingsRates
// is wired into the mobile route).
export default function MobileCashDeepDive({ m }) {
  const [openInfo, setOpenInfo] = useState(null); // "step1" | "step2" | null
  const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT, padding:"5px 0" };
  const stepLabelRow = { display:"flex", alignItems:"center", gap:"6px", marginTop:"8px", marginBottom:"2px" };
  const stepLabel = { fontSize:"10px", fontWeight:700, color:GOLD, letterSpacing:"0.05em", textTransform:"uppercase" };
  const infoBtn = { background:"#a8a89c", color:WHITE, border:"none", borderRadius:"50%", width:"15px", height:"15px", fontSize:"10px", fontWeight:700, lineHeight:"15px", textAlign:"center", padding:0, cursor:"pointer", flexShrink:0 };
  const stepCaption = { fontSize:"11.5px", color:MUT, lineHeight:1.5, marginTop:"6px", background:"#ede7db", borderRadius:"8px", padding:"8px 10px" };
  const {
    psaLimit, isaRateDisplay, nonIsaRateDisplay,
    currentGrossTotal, trPct, currentTaxCost,
    totalPot, step1Isa, step1IsaInterest, step2Savings, step2SavingsInterest,
    step3Pb, step3PbInterest,
    optimisedTotal, keptAmount, currentInterestOnKeptAmount, optimisationGain, todayBlendedRate,
  } = calcCashOptimisation(m, null, null);
  const optimalBlendedRatePct = keptAmount > 0 ? (optimisedTotal / keptAmount) * 100 : 0;

  const showEmergencyWin = m.emergencyShortfall > 0;
  const monthsToCloseGap = m.monthlySurplus > 0 ? Math.ceil(m.emergencyShortfall / m.monthlySurplus) : null;
  let winCounter = 0;
  const emergencyWinNumber = showEmergencyWin ? ++winCounter : null;
  const optimiseWinNumber = ++winCounter;

  const opportunityCols = [];
  if (showEmergencyWin) opportunityCols.push({ label:"Emergency fund shortfall", value: fmtCompact(m.emergencyShortfall) });
  if (optimisationGain > 50) opportunityCols.push({ label:"Tax-efficiency gain available", value: `${fmtCompact(optimisationGain)}/yr` });

  const runwayTarget = m.emergencyBuffer;
  const runwayCurrent = m.totalLiquid;
  const runwayPctRaw = runwayTarget > 0 ? (runwayCurrent / runwayTarget) * 100 : 0;
  const runwayTierColor = runwayPctRaw >= 100 ? "#2d6b4a" : runwayPctRaw >= 33 ? GOLD : "#c0392b";
  const runwayLabel = runwayPctRaw >= 150 ? "More than sufficient" : runwayPctRaw >= 100 ? "Sufficient" : runwayPctRaw >= 33 ? "Borderline" : "Insufficient";
  const runwayMarkerPct = runwayTarget > 0 ? Math.min(100, (runwayPctRaw / 200) * 100) : 0;

  return (
    <div>
      {opportunityCols.length > 0 && (
        <div style={{background:"rgba(196,150,58,0.12)",borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
          <div style={{fontSize:"10px",fontWeight:800,color:"#8a6a24",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Opportunity</div>
          <div style={{display:"flex",gap:"24px",flexWrap:"wrap"}}>
            {opportunityCols.map((c,i) => (
              <div key={i}>
                <div style={{fontFamily:SERIF,fontSize:"32px",color:TEXT,fontWeight:700,lineHeight:1.1}}>{c.value}</div>
                <div style={{fontSize:"12px",color:"#8a6a24",marginTop:"4px",fontWeight:600}}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showEmergencyWin && (
        <MobileWinTile number={emergencyWinNumber} title="Build your emergency fund"
          headline={`${fmt(m.emergencyShortfall)} more needed to reach your ${m.bufferMonths}-month target`}
          tagLabel="Priority" tagColor="#c0392b">
          <p style={{fontSize:"13.5px",color:TEXT,lineHeight:1.6,marginBottom:monthsToCloseGap?"10px":0}}>
            You hold {fmt(m.totalLiquid)} against a {fmt(m.emergencyBuffer)} target — a {fmt(m.emergencyShortfall)} gap. Sort this before any tax optimisation below.
          </p>
          {monthsToCloseGap && (
            <div style={{background:"rgba(196,150,58,0.08)",border:"1px solid rgba(196,150,58,0.28)",borderRadius:"10px",padding:"10px 12px",fontSize:"12.5px",color:TEXT,lineHeight:1.5}}>
              At your surplus of ~{fmt(Math.round(m.monthlySurplus))}/mo, putting it all aside closes this gap in ~{monthsToCloseGap} month{monthsToCloseGap===1?"":"s"}.
            </div>
          )}
        </MobileWinTile>
      )}

      <MobileWinTile number={optimiseWinNumber} title="Optimise your cash"
        headline={totalPot<=0 ? "Add your cash details to see this" : optimisationGain>50 ? `You can earn ${fmt(optimisationGain)}/yr more, tax-efficiently` : "Your cash is already well-placed for tax."}
        tagLabel="Today">
        {totalPot > 0 ? (
          <div>
            <div style={rowStyle}><span>Gross interest today</span><span style={{fontWeight:600}}>{fmt(currentGrossTotal)}/yr</span></div>
            {m.cash > 0 && currentTaxCost > 0 && (
              <div style={{...rowStyle,color:"#c0392b"}}><span>Tax due at {trPct}%</span><span>{fmt(currentTaxCost)}</span></div>
            )}
            <div style={{height:"1px",background:"rgba(22,47,36,0.1)",margin:"8px 0"}}/>

            {step1Isa > 0 && (
              <div>
                <div style={stepLabelRow}>
                  <span style={stepLabel}>Step 1 — Fill your ISA</span>
                  <button onClick={() => setOpenInfo(o => o==="step1"?null:"step1")} style={infoBtn}>?</button>
                </div>
                <div style={rowStyle}><span>{fmt(step1Isa)} at {isaRateDisplay} (best rate)</span><span style={{fontWeight:700,color:"#2d6b4a"}}>{fmt(step1IsaInterest)}/yr</span></div>
                {openInfo === "step1" && (
                  <p style={stepCaption}>{fmt(step1Isa)} is your remaining ISA allowance this tax year. {isaRateDisplay} is the top easy-access Cash ISA rate today.</p>
                )}
              </div>
            )}
            {step2Savings > 0 && (
              <div>
                <div style={stepLabelRow}>
                  <span style={stepLabel}>Step 2 — Fill your Personal Savings Allowance</span>
                  <button onClick={() => setOpenInfo(o => o==="step2"?null:"step2")} style={infoBtn}>?</button>
                </div>
                <div style={rowStyle}><span>{fmt(step2Savings)} at {nonIsaRateDisplay}</span><span style={{fontWeight:700,color:"#2d6b4a"}}>{fmt(step2SavingsInterest)}/yr</span></div>
                {openInfo === "step2" && (
                  <p style={stepCaption}>£{psaLimit.toLocaleString("en-GB")}/yr is your Personal Savings Allowance (PSA) — savings interest that's tax-free outside an ISA, based on your tax band.</p>
                )}
              </div>
            )}
            {step3Pb > 0 && (
              <div>
                <div style={stepLabel}>Step 3 — Premium Bonds (tax-free avg.)</div>
                <div style={rowStyle}><span>{fmt(step3Pb)} at ~4.4%</span><span style={{fontWeight:700,color:"#2d6b4a"}}>{fmt(step3PbInterest)}/yr</span></div>
              </div>
            )}

            <div style={{height:"1px",background:"rgba(22,47,36,0.1)",margin:"10px 0"}}/>
            <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:"4px"}}>
              Optimal cash allocation (on {fmt(keptAmount)} kept as cash)
            </div>
            <div style={rowStyle}><span>{fmt(keptAmount)} @ {(todayBlendedRate*100).toFixed(2)}% — today's blended rate</span><span>{fmt(currentInterestOnKeptAmount)}/yr</span></div>
            <div style={rowStyle}><span>{fmt(keptAmount)} @ {optimalBlendedRatePct.toFixed(2)}% — optimal blended rate</span><span>{fmt(optimisedTotal)}/yr</span></div>
            <div style={{...rowStyle,fontWeight:700,color:optimisationGain>0?"#2d6b4a":TEXT}}>
              <span>{optimisationGain>0?"You can earn":"Difference"}</span><span>{optimisationGain>0?"+":""}{fmt(optimisationGain)}/yr</span>
            </div>
          </div>
        ) : (
          <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.6}}>Add your cash savings and any Premium Bonds in your onboarding details to see a personalised allocation.</p>
        )}
      </MobileWinTile>

      <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px",flexWrap:"wrap",gap:"6px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
            <span style={{width:"8px",height:"8px",borderRadius:"50%",background:runwayTierColor,display:"inline-block"}}/>
            <span style={{fontSize:"13px",fontWeight:600,color:G}}>Cash runway — {runwayLabel}</span>
          </div>
          <span style={{fontSize:"12.5px",color:MUT}}>{m.runwayMonths.toFixed(1)} mo</span>
        </div>
        <div style={{position:"relative",width:"100%",height:"12px",borderRadius:"6px",background:`linear-gradient(90deg,#c0392b 0%,${GOLD} 33%,#2d6b4a 60%,#1e4d35 100%)`}}>
          <div style={{position:"absolute",left:`${runwayMarkerPct}%`,top:"-3px",bottom:"-3px",width:"3px",borderRadius:"2px",background:WHITE,boxShadow:"0 0 0 1px rgba(0,0,0,0.3)",transform:"translateX(-1.5px)"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:"5px"}}>
          <span style={{fontSize:"10px",color:MUT}}>0 mo</span>
          <span style={{fontSize:"10px",color:TEXT,fontWeight:600}}>{m.bufferMonths}mo target</span>
          <span style={{fontSize:"10px",color:MUT}}>{m.bufferMonths*2}mo+</span>
        </div>
      </div>
    </div>
  );
}
