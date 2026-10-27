import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { calcCashOptimisation } from "../../lib/cash.js";
import { cashOpportunity, accountName, assistItems } from "../../lib/assist.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import { isLocked } from "../../lib/unlock.js";
import { topRate } from "../../lib/savingsRates.js";
import { getModuleProducts } from "../moduleProducts.js";
import MobileWinTile from "../MobileWinTile.jsx";
import MobileProductListTile from "../MobileProductListTile.jsx";
import InfoButton from "../InfoButton.jsx";
import { rateUpdatesLabel } from "../NewBadge.jsx";
import { useCashNews, markCashOpened, markCashSeen } from "../visitNews.js";
import { mobileIsaSubheading, mobilePsaSubheading, firstName } from "../copy.js";
import { buildReminderSubject } from "../reminders.js";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, SUCCESS, CDARK, CRITICAL } from "../../design-tokens.js";
import OpportunityTile from "./OpportunityTile.jsx";

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
        <div style={{...rowStyle,padding:0}}><span>{fmt(l.amount)} at {l.ratePct.toFixed(2)}%</span><span style={{fontWeight:700,color:SUCCESS}}>{fmt(l.interest)}/yr</span></div>
        <div style={{fontSize:"11.5px",color:MUT,lineHeight:1.45}}>
          {name}{l.cap != null && ` · up to ${fmt(l.cap)}`}{l.fscsLimited && " · the most FSCS protects with one bank"}{l.extra != null && anchorRate != null && ` · ${fmt(l.extra)}/yr more than at ${anchorRate.toFixed(2)}%`}
        </div>
      </div>
    );
  });
}

export default function MobileCashDeepDive({ d, m, savingsRates, set, onOpenAssist }) {
  const [openInfo, setOpenInfo] = useState(null); // "step1" | "step2" | null
  // Best rates moved for them since the last visit (visitNews.js): opening
  // Cash clears the badges outside it; the savings tile keeps its own until
  // it's opened.
  const news = useCashNews();
  useEffect(() => { if (news && !news.opened) markCashOpened(); }, [news]);
  const [savingsOpen, setSavingsOpen] = useState(false);
  const openSavings = open => { setSavingsOpen(open); if (open) markCashSeen(); };
  const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT, padding:"5px 0" };
  const stepLabelRow = { display:"flex", alignItems:"center", gap:"6px", marginTop:"8px", marginBottom:"2px" };
  const stepLabel = { fontSize:"10px", fontWeight:700, color:GOLD, letterSpacing:"0.05em", textTransform:"uppercase" };
  const stepCaption = { fontSize:"11.5px", color:MUT, lineHeight:1.5, marginTop:"6px", background:CDARK, borderRadius:"8px", padding:"8px 10px" };
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
  // "Fix now" opens Candid Assist on the cash item, so it shows only while
  // Assist has one to open (not below its threshold, snoozed or locked), and
  // the tile itself shows a loss.
  const assistCash = useMemo(() => !isLocked(d, "cash") && assistItems(d, m, savingsRates).some(i => i.id === "cash"), [d, m, savingsRates]);
  const assistHasCash = !!onOpenAssist && gain > 50 && assistCash;
  const optimalBlendedRatePct = keptAmount > 0 ? (optimisedTotal / keptAmount) * 100 : 0;

  const showEmergencyWin = m.emergencyShortfall > 0;
  const monthsToCloseGap = m.monthlySurplus > 0 ? Math.ceil(m.emergencyShortfall / m.monthlySurplus) : null;
  let winCounter = 0;
  const emergencyWinNumber = showEmergencyWin ? ++winCounter : null;
  const optimiseWinNumber = ++winCounter;
  const hasIsaList = !!products.products?.length, hasSavingsList = !!products.nonIsaProducts?.length;

  // The Opportunity tile is the yearly loss alone; the emergency fund, a gap
  // closed once rather than lost each year, is shown as progress in its own
  // card below.
  const opportunityCols = [];
  if (gain > 50) opportunityCols.push({ label: opp ? "Lost to low rates, after tax" : "Lost to low rates", value: `${fmtCompact(gain)}/yr` });

  const runwayTarget = m.emergencyBuffer;
  const runwayCurrent = m.totalLiquid;
  const runwayPctRaw = runwayTarget > 0 ? (runwayCurrent / runwayTarget) * 100 : 0;
  const runwayTierColor = runwayPctRaw >= 100 ? SUCCESS : runwayPctRaw >= 33 ? GOLD : CRITICAL;
  const runwayLabel = runwayPctRaw >= 150 ? "More than sufficient" : runwayPctRaw >= 100 ? "Sufficient" : runwayPctRaw >= 33 ? "Borderline" : "Insufficient";
  const runwayMarkerPct = runwayTarget > 0 ? Math.min(100, (runwayPctRaw / 200) * 100) : 0;
  // A fund at its target can be closed; it comes back, and can be closed
  // again, once savings fall below the target (`emergencyCardDismissed`).
  const funded = runwayTarget > 0 && runwayPctRaw >= 100;
  const fundHidden = funded && !!d.emergencyCardDismissed;
  const belowTarget = runwayTarget > 0 && runwayPctRaw < 100;
  useEffect(() => { if (belowTarget && d.emergencyCardDismissed && set) set("emergencyCardDismissed", false); }, [belowTarget, d.emergencyCardDismissed]);

  return (
    <div>
      {opportunityCols.length > 0 && (
        <OpportunityTile tour="figure" figures={opportunityCols}/>
      )}

      {/* The emergency fund, above the numbered tiles: £ held of the
          target, and months of spending covered. `data-tour`: lit up by the
          Cash tour (CashTour.jsx), as are the tiles either side. */}
      {!fundHidden && (
      <div data-tour="fund" style={{position:"relative",background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"6px",paddingRight:funded && set ? "26px" : 0}}>
          <span style={{fontSize:"10px",fontWeight:800,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase"}}>Emergency fund</span>
          <span style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"12.5px",fontWeight:600,color:G}}>
            <span style={{width:"8px",height:"8px",borderRadius:"50%",background:runwayTierColor,display:"inline-block"}}/>{runwayLabel}
          </span>
        </div>
        {funded && set && (
          <button type="button" aria-label="Close" onClick={() => set("emergencyCardDismissed", true)}
            style={{position:"absolute",top:"8px",right:"8px",background:"none",border:"none",padding:"6px",color:MUT,cursor:"pointer",display:"flex"}}><X size={18}/></button>
        )}
        <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:"10px",flexWrap:"wrap",margin:"8px 0 10px"}}>
          <div style={{fontFamily:SERIF,fontWeight:700,color:TEXT,lineHeight:1.15}}>
            <span style={{fontSize:"26px"}}>{fmt(runwayCurrent)}</span>
            {runwayTarget > 0 && <span style={{fontSize:"17px",color:MUT}}> of {fmt(runwayTarget)}</span>}
          </div>
          <span style={{fontSize:"12.5px",color:MUT}}>{m.runwayMonths.toFixed(1)} of {m.bufferMonths} mo</span>
        </div>
        <div style={{position:"relative",width:"100%",height:"12px",borderRadius:"6px",background:`linear-gradient(90deg,${CRITICAL} 0%,${GOLD} 33%,${SUCCESS} 60%,#1e4d35 100%)`}}>
          <div style={{position:"absolute",left:`${runwayMarkerPct}%`,top:"-3px",bottom:"-3px",width:"3px",borderRadius:"2px",background:WHITE,boxShadow:"0 0 0 1px rgba(0,0,0,0.3)",transform:"translateX(-1.5px)"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:"5px"}}>
          <span style={{fontSize:"10px",color:MUT}}>0 mo</span>
          <span style={{fontSize:"10px",color:TEXT,fontWeight:600}}>{m.bufferMonths}mo target</span>
          <span style={{fontSize:"10px",color:MUT}}>{m.bufferMonths*2}mo+</span>
        </div>
      </div>
      )}

      {showEmergencyWin && (
        <MobileWinTile number={emergencyWinNumber} title="Build your emergency fund"
          headline={monthsToCloseGap
            ? `Your spare ${fmt(Math.round(m.monthlySurplus))} a month would close the gap in about ${monthsToCloseGap} month${monthsToCloseGap===1?"":"s"}`
            : `A ${fmt(m.emergencyShortfall)} gap to your ${m.bufferMonths}-month target`}
          tagLabel="Priority" tagColor={CRITICAL}>
          <p style={{fontSize:"13.5px",color:TEXT,lineHeight:1.6,margin:0}}>
            You hold {fmt(m.totalLiquid)} against a {fmt(m.emergencyBuffer)} target — a {fmt(m.emergencyShortfall)} gap.
          </p>
        </MobileWinTile>
      )}

      <div data-tour="working">
      <MobileWinTile number={optimiseWinNumber} title="Earn more on your savings"
        headline={totalPot<=0 ? "Add your cash details to see this" : gain>50 ? `Your savings lose ${fmt(gain)}/yr to low rates${opp ? ", after tax" : ""}` : "Your savings are already on good rates."}
        tagLabel="Today" open={savingsOpen} onOpenChange={openSavings}
        badge={news ? { count: news.count, label: rateUpdatesLabel(news.count) } : null}
        action={assistHasCash ? { label: "Fix now", onClick: () => onOpenAssist("cash") } : null}
        reminder={gain > 50 ? {
          id: "cash-move-surplus",
          title: buildReminderSubject(`${fmt(gain)}/yr`, "Higher rates for your savings"),
          // Informational, not directive — states the figures and points to
          // the rate tiles/provider to do the "how", rather than instructing
          // a specific transfer, avoiding reading as financial advice.
          description: opp
            ? `${firstName(d) ? firstName(d)+", h" : "H"}ere's your reminder to look at your savings rates. The highest-rate options in Candid today are worth up to ${fmt(gain)}/yr more after tax than where it sits.\n\nCandid Assist lays out the options and how to move. Most accounts open online in a few minutes.`
            : `${firstName(d) ? firstName(d)+", h" : "H"}ere's your reminder to look at your savings rates. Filling your ISA at ${isaRateDisplay} first, then your Personal Savings Allowance at ${nonIsaRateDisplay}, is worth up to ${fmt(optimisationGain)}/yr more than where it sits today.\n\nThe current highest rates are in Candid; any move is made directly with the provider - most accounts open online in a few minutes.`,
        } : null}>
        {totalPot > 0 && opp ? (
          <div>
            <div style={rowStyle}><span>What your savings earn now, after tax</span><span style={{fontWeight:600}}>{fmt(opp.currentKept + opp.bondsPrize)}/yr</span></div>
            {opp.bondsPrize > 0 && <div style={{fontSize:"11.5px",color:MUT,marginTop:"-3px"}}>Including about {fmt(opp.bondsPrize)} in Premium Bond prizes, at the average rate</div>}
            <div style={{height:"1px",background:"rgba(22,47,36,0.1)",margin:"8px 0"}}/>
            {opp.lines.map(l => {
              const o = l.option;
              const fromBonds = (o.from || []).filter(f => f.taxFree).reduce((t, f) => t + f.amount, 0);
              return (
                <div key={l.section} style={{marginTop:"6px"}}>
                  <div style={stepLabel}>{l.section}</div>
                  <div style={rowStyle}>
                    <span>{fmt(o.amount)} in {accountName(o)} at {o.ratePct.toFixed(2)}%{o.pb ? " (an average)" : ""}</span>
                    <span style={{fontWeight:700,color:SUCCESS,whiteSpace:"nowrap",paddingLeft:"8px"}}>+{fmt(o.gain)}/yr</span>
                  </div>
                  {fromBonds > 0 && <div style={{fontSize:"11.5px",color:MUT,marginTop:"-3px"}}>{fmt(fromBonds)} of it from your Premium Bonds</div>}
                </div>
              );
            })}
            <div style={{height:"1px",background:"rgba(22,47,36,0.1)",margin:"10px 0"}}/>
            <div style={{...rowStyle,fontWeight:700,color:SUCCESS}}><span>Together, after tax</span><span>{fmt(opp.currentKept + opp.bondsPrize + opp.gain)}/yr</span></div>
            <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,marginTop:"4px"}}>
              The highest-earning option in each, worked out together so no money is counted twice. Candid Assist, bottom right, lists the other providers in each and how to move.
            </p>
          </div>
        ) : totalPot > 0 ? (
          <div>
            <div style={rowStyle}><span>Interest you earn now, before tax</span><span style={{fontWeight:600}}>{fmt(currentGrossTotal)}/yr</span></div>
            {m.cash > 0 && currentTaxCost > 0 && (
              <div style={{...rowStyle,color:CRITICAL}}><span>Tax due at {trPct}%</span><span>{fmt(currentTaxCost)}</span></div>
            )}
            <div style={{height:"1px",background:"rgba(22,47,36,0.1)",margin:"8px 0"}}/>

            {step1Isa > 0 && (
              <div>
                <div style={stepLabelRow}>
                  <span style={stepLabel}>In a Cash ISA, where interest is never taxed</span>
                  <InfoButton onClick={() => setOpenInfo(o => o==="step1"?null:"step1")} open={openInfo==="step1"}/>
                </div>
                {isaLines.length > 0 ? <AccountLines lines={isaLines} rowStyle={rowStyle}/> : (
                  <div style={rowStyle}><span>{fmt(step1Isa)} at {isaRateDisplay} (highest rate)</span><span style={{fontWeight:700,color:SUCCESS}}>{fmt(step1IsaInterest)}/yr</span></div>
                )}
                {openInfo === "step1" && (
                  <p style={stepCaption}>{fmt(step1Isa)} is your remaining ISA allowance this tax year. {isaLines.length > 1
                    ? `Spread across the highest-rate easy-access Cash ISAs, each up to its limit, it earns ${isaRateDisplay} on average.`
                    : `${isaRateDisplay} is the top easy-access Cash ISA rate today.`}</p>
                )}
              </div>
            )}
            {step2Savings > 0 && (
              <div>
                <div style={stepLabelRow}>
                  <span style={stepLabel}>Then savings, up to your tax-free interest allowance</span>
                  <InfoButton onClick={() => setOpenInfo(o => o==="step2"?null:"step2")} open={openInfo==="step2"}/>
                </div>
                <div style={rowStyle}><span>{fmt(step2Savings)} at your current rate</span><span>{fmt(step2CurrentInterest)}/yr</span></div>
                {savingsLines.length > 0 ? <AccountLines lines={savingsLines} rowStyle={rowStyle}/> : (
                  <div style={rowStyle}><span>{fmt(step2Savings)} at {nonIsaRateDisplay} (highest rate)</span><span style={{fontWeight:600}}>{fmt(step2SavingsInterest)}/yr</span></div>
                )}
                <div style={{...rowStyle,fontWeight:700,color:step2Delta>0?SUCCESS:TEXT}}><span>Extra from switching</span><span>{step2Delta>0?"+":""}{fmt(Math.max(0,step2Delta))}/yr</span></div>
                {openInfo === "step2" && (
                  <p style={stepCaption}>£{psaLimit.toLocaleString("en-GB")}/yr is your Personal Savings Allowance (PSA) — savings interest that's tax-free outside an ISA, based on your tax band. You're already earning {fmt(step2CurrentInterest)}/yr on this money at your current rate; moving it to today's highest non-ISA rate ({nonIsaRateDisplay}) is worth an extra {fmt(Math.max(0,step2Delta))}/yr on top — not {fmt(step2SavingsInterest)}/yr from scratch.</p>
                )}
              </div>
            )}
            {step3Pb > 0 && (
              <div>
                <div style={stepLabel}>Then Premium Bonds (tax-free avg.)</div>
                <div style={rowStyle}><span>{fmt(step3Pb)} at ~{(PB_RATE*100).toFixed(2)}%</span><span style={{fontWeight:700,color:SUCCESS}}>{fmt(step3PbInterest)}/yr</span></div>
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
            <div style={{...rowStyle,fontWeight:700,color:optimisationGain>0?SUCCESS:TEXT}}>
              <span>{optimisationGain>0?"You can earn":"Difference"}</span><span>{optimisationGain>0?"+":""}{fmt(optimisationGain)}/yr</span>
            </div>
          </div>
        ) : (
          <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.6}}>Add your cash savings and any Premium Bonds in your onboarding details to see a personalised allocation.</p>
        )}
      </MobileWinTile>
      </div>

      {/* The provider lists, together and unnumbered: places to look, not
          steps. */}
      {(hasIsaList || hasSavingsList) && (
        <MobileWinTile provider title="Explore providers" headline="Today's highest rates, Cash ISAs and savings accounts" tagLabel="Providers">
          {hasIsaList && (
            <MobileWinTile title={products.heading} headline={mobileIsaSubheading(m)}>
              <MobileProductListTile embedded products={products.products} disclaimer={products.disclaimer}/>
            </MobileWinTile>
          )}
          {hasSavingsList && (
            <MobileWinTile title={products.nonIsaHeading} headline={mobilePsaSubheading()}>
              <MobileProductListTile embedded products={products.nonIsaProducts} disclaimer={products.disclaimer}/>
            </MobileWinTile>
          )}
        </MobileWinTile>
      )}
    </div>
  );
}
