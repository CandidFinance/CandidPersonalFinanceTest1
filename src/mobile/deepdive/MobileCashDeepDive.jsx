import { useState } from "react";
import { calcCashOptimisation } from "../../lib/cash.js";
import { cashOpportunity, accountName } from "../../lib/assist.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, topRate, getModuleProducts, OPPORTUNITY_TILE_BG, OPPORTUNITY_TILE_LABEL, OPPORTUNITY_TILE_FIGURE, OPPORTUNITY_TILE_BODY } from "../../CandidApp.jsx";
import MobileWinTile from "../MobileWinTile.jsx";
import MobileProductListTile from "../MobileProductListTile.jsx";
import InfoButton from "../InfoButton.jsx";
import { mobileIsaSubheading, mobilePsaSubheading, firstName } from "../copy.js";
import { buildReminderSubject } from "../reminders.js";
import { ExplainLink } from "../ModuleScreenParts.jsx";
import { OPPORTUNITY_TILE_BORDER, OPPORTUNITY_TILE_SHADOW } from "../../design-tokens.js";

// Trimmed mobile version of desktop's Cash deep dive (ModuleDeepDive,
// moduleKey==="cash" — CandidApp.jsx). Keeps the opportunity strip, the
// emergency-fund win, a condensed 3-step ISA→PSA→Premium Bonds optimise-cash
// walkthrough, the cash-runway indicator, and (now wired in) the live
// best-Cash-ISA provider list, sharing topRate/getModuleProducts/savingsRates
// with desktop so the rates and links can't drift. Deliberately still drops
// desktop's account-by-account allocation list, the Step 4 GIA growth
// illustration, and the "other cash-like options" section — v1 scope per the
// mobile deep-dive plan.
// The accounts a step's money is spread across (allocateCash): each with its
// amount, rate and interest, and for a capped account how much more it earns
// than leaving that money in the best uncapped one.
function AccountLines({ lines, rowStyle }) {
  const anchorRate = lines.find(l => l.cap == null)?.ratePct;
  return lines.map((l, i) => {
    const name = l.product && !l.provider.toLowerCase().includes(l.product.toLowerCase()) ? `${l.provider} · ${l.product}` : l.provider;
    return (
      <div key={i} style={{padding:"4px 0"}}>
        <div style={{...rowStyle,padding:0}}><span>{fmt(l.amount)} at {l.ratePct.toFixed(2)}%</span><span style={{fontWeight:700,color:"#2d6b4a"}}>{fmt(l.interest)}/yr</span></div>
        <div style={{fontSize:"11.5px",color:MUT,lineHeight:1.45}}>
          {name}{l.cap != null && ` · up to ${fmt(l.cap)}`}{l.fscsLimited && " · the most FSCS protects with one bank"}{l.extra != null && anchorRate != null && ` · ${fmt(l.extra)}/yr more than at ${anchorRate.toFixed(2)}%`}
        </div>
      </div>
    );
  });
}

// `onShowReveal` replays the answer step by step ("Explain this", in the
// opportunity tile, or at the top when there's none).
export default function MobileCashDeepDive({ d, m, savingsRates, onShowReveal }) {
  const [openInfo, setOpenInfo] = useState(null); // "step1" | "step2" | null
  const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT, padding:"5px 0" };
  const stepLabelRow = { display:"flex", alignItems:"center", gap:"6px", marginTop:"8px", marginBottom:"2px" };
  const stepLabel = { fontSize:"10px", fontWeight:700, color:GOLD, letterSpacing:"0.05em", textTransform:"uppercase" };
  const stepCaption = { fontSize:"11.5px", color:MUT, lineHeight:1.5, marginTop:"6px", background:"#ede7db", borderRadius:"8px", padding:"8px 10px" };
  const isaRatePct = topRate(savingsRates, true)?.rate_aer ?? null;
  const nonIsaRatePct = topRate(savingsRates, false)?.rate_aer ?? null;
  const {
    psaLimit, isaRateDisplay, nonIsaRateDisplay, PB_RATE,
    currentGrossTotal, trPct, currentTaxCost,
    totalPot, step1Isa, step1IsaInterest, step2Savings, step2SavingsInterest, step2CurrentInterest, step2Delta,
    step3Pb, step3PbInterest,
    optimisedTotal, keptAmount, currentInterestOnKeptAmount, optimisationGain, todayBlendedRate,
    isaLines, savingsLines,
  } = calcCashOptimisation(m, isaRatePct, nonIsaRatePct, savingsRates);
  const products = getModuleProducts("cash", d, m, savingsRates);
  // With the rates loaded, the same after-tax figure and choices as Candid
  // Assist and Home (cashOpportunity); before then, the waterfall's estimate.
  const opp = cashOpportunity(d, m, savingsRates);
  const gain = opp ? opp.gain : optimisationGain;
  const optimalBlendedRatePct = keptAmount > 0 ? (optimisedTotal / keptAmount) * 100 : 0;

  const showEmergencyWin = m.emergencyShortfall > 0;
  const monthsToCloseGap = m.monthlySurplus > 0 ? Math.ceil(m.emergencyShortfall / m.monthlySurplus) : null;
  let winCounter = 0;
  const emergencyWinNumber = showEmergencyWin ? ++winCounter : null;
  const optimiseWinNumber = ++winCounter;

  const opportunityCols = [];
  if (showEmergencyWin) opportunityCols.push({ label:"Short of your emergency fund", value: fmtCompact(m.emergencyShortfall) });
  if (gain > 50) opportunityCols.push({ label: opp ? "More your savings could earn, after tax" : "More your savings could earn", value: `${fmtCompact(gain)}/yr` });

  const runwayTarget = m.emergencyBuffer;
  const runwayCurrent = m.totalLiquid;
  const runwayPctRaw = runwayTarget > 0 ? (runwayCurrent / runwayTarget) * 100 : 0;
  const runwayTierColor = runwayPctRaw >= 100 ? "#2d6b4a" : runwayPctRaw >= 33 ? GOLD : "#c0392b";
  const runwayLabel = runwayPctRaw >= 150 ? "More than sufficient" : runwayPctRaw >= 100 ? "Sufficient" : runwayPctRaw >= 33 ? "Borderline" : "Insufficient";
  const runwayMarkerPct = runwayTarget > 0 ? Math.min(100, (runwayPctRaw / 200) * 100) : 0;

  return (
    <div>
      {opportunityCols.length === 0 && onShowReveal && <div style={{marginBottom:"14px"}}><ExplainLink onClick={onShowReveal}/></div>}
      {opportunityCols.length > 0 && (
        <div style={{background:OPPORTUNITY_TILE_BG,border:OPPORTUNITY_TILE_BORDER,boxShadow:OPPORTUNITY_TILE_SHADOW,borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",marginBottom:"10px"}}>
            <div style={{fontSize:"10px",fontWeight:800,color:OPPORTUNITY_TILE_LABEL,letterSpacing:"0.08em",textTransform:"uppercase"}}>Opportunity</div>
            <ExplainLink onClick={onShowReveal} color={OPPORTUNITY_TILE_FIGURE}/>
          </div>
          <div style={{display:"flex",gap:"24px",flexWrap:"wrap"}}>
            {opportunityCols.map((c,i) => (
              <div key={i}>
                <div style={{fontFamily:SERIF,fontSize:"32px",color:OPPORTUNITY_TILE_FIGURE,fontWeight:700,lineHeight:1.1}}>{c.value}</div>
                <div style={{fontSize:"12px",color:OPPORTUNITY_TILE_LABEL,marginTop:"4px",fontWeight:600}}>{c.label}</div>
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

      <MobileWinTile number={optimiseWinNumber} title="Earn more on your savings"
        headline={totalPot<=0 ? "Add your cash details to see this" : gain>50 ? `Your savings could earn ${fmt(gain)}/yr more${opp ? ", after tax" : ""}` : "Your savings are already on good rates."}
        tagLabel="Today"
        reminder={gain > 50 ? {
          id: "cash-move-surplus",
          title: buildReminderSubject(`${fmt(gain)}/yr`, "Move surplus cash to a better rate"),
          // Informational, not directive — states the figures and points to
          // the rate tiles/provider to do the "how", rather than instructing
          // a specific transfer, avoiding reading as financial advice.
          description: opp
            ? `${firstName(d) ? firstName(d)+", m" : "M"}ove your surplus cash to a better rate when you get a moment. The best options in Candid today are worth up to ${fmt(gain)}/yr more after tax than where it sits.\n\nCandid Assist lays out the options and how to move. Most accounts open online in a few minutes.`
            : `${firstName(d) ? firstName(d)+", m" : "M"}ove your surplus cash to a better rate when you get a moment. Filling your ISA at ${isaRateDisplay} first, then your Personal Savings Allowance at ${nonIsaRateDisplay}, is worth up to ${fmt(optimisationGain)}/yr more than where it sits today.\n\nCheck the current best rates in Candid and move the cash directly with the provider - most accounts open online in a few minutes.`,
        } : null}>
        {totalPot > 0 && opp ? (
          <div>
            <div style={rowStyle}><span>What your savings earn now, after tax</span><span style={{fontWeight:600}}>{fmt(opp.currentKept)}/yr</span></div>
            <div style={{height:"1px",background:"rgba(22,47,36,0.1)",margin:"8px 0"}}/>
            {opp.lines.map(l => {
              const o = l.option;
              const fromBonds = (o.from || []).filter(f => f.taxFree).reduce((t, f) => t + f.amount, 0);
              return (
                <div key={l.section} style={{marginTop:"6px"}}>
                  <div style={stepLabel}>{l.section}</div>
                  <div style={rowStyle}>
                    <span>{fmt(o.amount)} in {accountName(o)} at {o.ratePct.toFixed(2)}%{o.pb ? " (an average)" : ""}</span>
                    <span style={{fontWeight:700,color:"#2d6b4a",whiteSpace:"nowrap",paddingLeft:"8px"}}>+{fmt(o.gain)}/yr</span>
                  </div>
                  {fromBonds > 0 && <div style={{fontSize:"11.5px",color:MUT,marginTop:"-3px"}}>{fmt(fromBonds)} of it from your Premium Bonds</div>}
                </div>
              );
            })}
            <div style={{height:"1px",background:"rgba(22,47,36,0.1)",margin:"10px 0"}}/>
            <div style={{...rowStyle,fontWeight:700,color:"#2d6b4a"}}><span>Together, after tax</span><span>+{fmt(opp.gain)}/yr</span></div>
            <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,marginTop:"4px"}}>
              The highest-earning option in each, worked out together so no money is counted twice. Candid Assist, bottom right, lists the other providers in each and how to move.
            </p>
          </div>
        ) : totalPot > 0 ? (
          <div>
            <div style={rowStyle}><span>Interest you earn now, before tax</span><span style={{fontWeight:600}}>{fmt(currentGrossTotal)}/yr</span></div>
            {m.cash > 0 && currentTaxCost > 0 && (
              <div style={{...rowStyle,color:"#c0392b"}}><span>Tax due at {trPct}%</span><span>{fmt(currentTaxCost)}</span></div>
            )}
            <div style={{height:"1px",background:"rgba(22,47,36,0.1)",margin:"8px 0"}}/>

            {step1Isa > 0 && (
              <div>
                <div style={stepLabelRow}>
                  <span style={stepLabel}>Step 1 — Fill your ISA</span>
                  <InfoButton onClick={() => setOpenInfo(o => o==="step1"?null:"step1")} open={openInfo==="step1"}/>
                </div>
                {isaLines.length > 0 ? <AccountLines lines={isaLines} rowStyle={rowStyle}/> : (
                  <div style={rowStyle}><span>{fmt(step1Isa)} at {isaRateDisplay} (best rate)</span><span style={{fontWeight:700,color:"#2d6b4a"}}>{fmt(step1IsaInterest)}/yr</span></div>
                )}
                {openInfo === "step1" && (
                  <p style={stepCaption}>{fmt(step1Isa)} is your remaining ISA allowance this tax year. {isaLines.length > 1
                    ? `Spread across the best easy-access Cash ISAs, each up to its limit, it earns ${isaRateDisplay} on average.`
                    : `${isaRateDisplay} is the top easy-access Cash ISA rate today.`}</p>
                )}
              </div>
            )}
            {step2Savings > 0 && (
              <div>
                <div style={stepLabelRow}>
                  <span style={stepLabel}>Step 2 — Use your tax-free savings interest</span>
                  <InfoButton onClick={() => setOpenInfo(o => o==="step2"?null:"step2")} open={openInfo==="step2"}/>
                </div>
                <div style={rowStyle}><span>{fmt(step2Savings)} at your current rate</span><span>{fmt(step2CurrentInterest)}/yr</span></div>
                {savingsLines.length > 0 ? <AccountLines lines={savingsLines} rowStyle={rowStyle}/> : (
                  <div style={rowStyle}><span>{fmt(step2Savings)} at {nonIsaRateDisplay} (best rate)</span><span style={{fontWeight:600}}>{fmt(step2SavingsInterest)}/yr</span></div>
                )}
                <div style={{...rowStyle,fontWeight:700,color:step2Delta>0?"#2d6b4a":TEXT}}><span>Extra from switching</span><span>{step2Delta>0?"+":""}{fmt(Math.max(0,step2Delta))}/yr</span></div>
                {openInfo === "step2" && (
                  <p style={stepCaption}>£{psaLimit.toLocaleString("en-GB")}/yr is your Personal Savings Allowance (PSA) — savings interest that's tax-free outside an ISA, based on your tax band. You're already earning {fmt(step2CurrentInterest)}/yr on this money at your current rate; moving it to today's best non-ISA rate ({nonIsaRateDisplay}) is worth an extra {fmt(Math.max(0,step2Delta))}/yr on top — not {fmt(step2SavingsInterest)}/yr from scratch.</p>
                )}
              </div>
            )}
            {step3Pb > 0 && (
              <div>
                <div style={stepLabel}>Step 3 — Premium Bonds (tax-free avg.)</div>
                <div style={rowStyle}><span>{fmt(step3Pb)} at ~{(PB_RATE*100).toFixed(2)}%</span><span style={{fontWeight:700,color:"#2d6b4a"}}>{fmt(step3PbInterest)}/yr</span></div>
              </div>
            )}

            <div style={{height:"1px",background:"rgba(22,47,36,0.1)",margin:"10px 0"}}/>
            <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:"4px"}}>
              Where your savings could sit ({fmt(keptAmount)} kept as cash)
            </div>
            <div style={rowStyle}><span>{fmt(keptAmount)} @ {(todayBlendedRate*100).toFixed(2)}% — your average rate today</span><span>{fmt(currentInterestOnKeptAmount)}/yr</span></div>
            <p style={{fontSize:"10.5px",color:MUT,marginTop:"-2px",marginBottom:"8px"}}>= {m.savingsRate}% on your cash + {(PB_RATE*100).toFixed(1)}% on Premium Bonds, blended</p>
            <div style={rowStyle}><span>{fmt(keptAmount)} @ {optimalBlendedRatePct.toFixed(2)}% — the best average rate</span><span>{fmt(optimisedTotal)}/yr</span></div>
            <p style={{fontSize:"10.5px",color:MUT,marginTop:"-2px",marginBottom:"8px"}}>= {isaRateDisplay} ISA + {nonIsaRateDisplay} savings + {(PB_RATE*100).toFixed(1)}% Premium Bonds, blended</p>
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
            <span style={{fontSize:"13px",fontWeight:600,color:G}}>Months of spending covered — {runwayLabel}</span>
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

      <MobileProductListTile heading={products.heading} subheading={mobileIsaSubheading(m)}
        products={products.products} disclaimer={products.disclaimer}/>

      <MobileProductListTile heading={products.nonIsaHeading} subheading={mobilePsaSubheading()}
        products={products.nonIsaProducts} disclaimer={products.disclaimer}/>
    </div>
  );
}
