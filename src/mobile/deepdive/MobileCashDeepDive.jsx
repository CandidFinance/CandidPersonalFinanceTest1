import { useState, useEffect, useMemo } from "react";
import { Bell, BellRing, Info, Pencil, EyeOff } from "lucide-react";
import { calcCashOptimisation } from "../../lib/cash.js";
import { cashOpportunity, accountName, assistItems } from "../../lib/assist.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import { isLocked } from "../../lib/unlock.js";
import { topRate } from "../../lib/savingsRates.js";
import { getModuleProducts } from "../moduleProducts.js";
import MobileTile, { TileRow } from "../MobileTile.jsx";
import MobileProductListTile from "../MobileProductListTile.jsx";
import NewBadge, { rateUpdatesLabel } from "../NewBadge.jsx";
import { useCashNews, markCashOpened, markCashSeen } from "../visitNews.js";
import { mobileIsaSubheading, mobilePsaSubheading, firstName } from "../copy.js";
import { buildReminderSubject } from "../reminders.js";
import { useReminder } from "../MobileReminderAction.jsx";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, SUCCESS, CRITICAL, NOTICE_LABEL } from "../../design-tokens.js";
import OpportunityTile from "./OpportunityTile.jsx";

// Trimmed mobile version of desktop's Cash deep dive (ModuleDeepDive,
// moduleKey==="cash" — CandidApp.jsx). Three tiles (MobileTile, rows on the
// tile, actions in its menu): the emergency fund, the savings rates, and the
// live best-rate provider lists, sharing topRate/getModuleProducts/savingsRates
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

export default function MobileCashDeepDive({ d, m, savingsRates, set, onOpenAssist, onEditInputs }) {
  // Each tile's "How this is worked out" note, from its menu.
  const [notes, setNotes] = useState({});
  const toggleNote = k => setNotes(n => ({ ...n, [k]: !n[k] }));
  // Best rates moved for them since the last visit (visitNews.js): opening
  // Cash clears the badges outside it; the savings tile keeps its own for
  // this visit, cleared on leaving.
  const news = useCashNews();
  useEffect(() => { if (news && !news.opened) markCashOpened(); }, [news]);
  useEffect(() => () => markCashSeen(), []);
  const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT, padding:"5px 0" };
  // A row: its label and note on the left, its figure on the right.
  const line = { display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:"12px" };
  const rowLabel = { fontSize:"14px", color:TEXT, lineHeight:1.4 };
  const rowNote = { fontSize:"12px", color:MUT, lineHeight:1.45, marginTop:"2px" };
  const rowFigure = { fontFamily:SERIF, fontSize:"17px", fontWeight:700, color:G, whiteSpace:"nowrap" };
  const noteText = { fontSize:"13px", color:TEXT, lineHeight:1.55, margin:0 };
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
  // "See options" opens Candid Assist on the cash item, so it shows only while
  // Assist has one to open (not below its threshold, snoozed or locked), and
  // the tile itself shows a loss.
  const assistCash = useMemo(() => !isLocked(d, "cash") && assistItems(d, m, savingsRates).some(i => i.id === "cash"), [d, m, savingsRates]);
  const assistHasCash = !!onOpenAssist && gain > 50 && assistCash;
  const optimalBlendedRatePct = keptAmount > 0 ? (optimisedTotal / keptAmount) * 100 : 0;
  const reminder = useReminder({
    id: "cash-move-surplus",
    title: buildReminderSubject(`${fmt(gain)}/yr`, "Higher rates for your savings"),
    // Informational, not directive — states the figures and points to
    // the rate tiles/provider to do the "how", rather than instructing
    // a specific transfer, avoiding reading as financial advice.
    description: opp
      ? `${firstName(d) ? firstName(d)+", h" : "H"}ere's your reminder to look at your savings rates. The highest-rate options in Candid today are worth up to ${fmt(gain)}/yr more after tax than where it sits.\n\nCandid Assist lays out the options and how to move. Most accounts open online in a few minutes.`
      : `${firstName(d) ? firstName(d)+", h" : "H"}ere's your reminder to look at your savings rates. Filling your ISA at ${isaRateDisplay} first, then your Personal Savings Allowance at ${nonIsaRateDisplay}, is worth up to ${fmt(optimisationGain)}/yr more than where it sits today.\n\nThe current highest rates are in Candid; any move is made directly with the provider - most accounts open online in a few minutes.`,
  });

  const showEmergencyWin = m.emergencyShortfall > 0;
  const monthsToCloseGap = m.monthlySurplus > 0 ? Math.ceil(m.emergencyShortfall / m.monthlySurplus) : null;
  const hasIsaList = !!products.products?.length, hasSavingsList = !!products.nonIsaProducts?.length;

  // The Opportunity tile is the yearly loss alone; the emergency fund, a gap
  // closed once rather than lost each year, is shown as progress in its own
  // tile below.
  const opportunityCols = [];
  if (gain > 50) opportunityCols.push({ label: opp ? "Lost to low rates, after tax" : "Lost to low rates", value: `${fmtCompact(gain)}/yr` });

  const runwayTarget = m.emergencyBuffer;
  const runwayCurrent = m.totalLiquid;
  const runwayPctRaw = runwayTarget > 0 ? (runwayCurrent / runwayTarget) * 100 : 0;
  const runwayLabel = runwayPctRaw >= 150 ? "More than sufficient" : runwayPctRaw >= 100 ? "Sufficient" : runwayPctRaw >= 33 ? "Borderline" : "Insufficient";
  const runwayMarkerPct = runwayTarget > 0 ? Math.min(100, (runwayPctRaw / 200) * 100) : 0;
  // A fund at its target can be hidden; it comes back, and can be hidden
  // again, once savings fall below the target (`emergencyCardDismissed`).
  const funded = runwayTarget > 0 && runwayPctRaw >= 100;
  const fundHidden = funded && !!d.emergencyCardDismissed;
  const belowTarget = runwayTarget > 0 && runwayPctRaw < 100;
  useEffect(() => { if (belowTarget && d.emergencyCardDismissed && set) set("emergencyCardDismissed", false); }, [belowTarget, d.emergencyCardDismissed]);

  // A Savings row's way on: its provider list on this page, or Candid Assist
  // for Premium Bonds (no list here). Null leaves the row plain.
  const scrollTo = id => () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const rowTarget = section =>
    section === "Cash ISA" && hasIsaList ? scrollTo("cash-isas")
    : section === "Savings account" && hasSavingsList ? scrollTo("cash-savings")
    : assistHasCash ? () => onOpenAssist("cash") : undefined;
  const editItem = onEditInputs && { icon: Pencil, label: "Edit my figures", onClick: onEditInputs };
  const howItem = (k, label = "How this is worked out") => ({ icon: Info, label: notes[k] ? "Hide the explanation" : label, onClick: () => toggleNote(k) });

  return (
    <div>
      {opportunityCols.length > 0 && (
        <OpportunityTile tour="figure" figures={opportunityCols}
          action={assistHasCash ? { label: "See options", onClick: () => onOpenAssist("cash") } : null}/>
      )}

      {/* The emergency fund, above the other tiles: £ held of the target,
          and months of spending covered. `data-tour`: lit up by the Cash
          tour (CashTour.jsx), as are the tiles either side. */}
      {!fundHidden && (
        <MobileTile data-tour="fund" title="Emergency fund"
          menu={[
            howItem("fund", "How the target is worked out"),
            editItem,
            funded && set && { icon: EyeOff, label: "Hide this tile", onClick: () => set("emergencyCardDismissed", true) },
          ]}>
          <TileRow first>
            <div style={{fontSize:"12.5px",fontWeight:600,color:G}}>{runwayLabel}</div>
            <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:"10px",flexWrap:"wrap",margin:"4px 0 10px"}}>
              <div style={{fontFamily:SERIF,fontWeight:700,color:TEXT,lineHeight:1.15}}>
                <span style={{fontSize:"26px"}}>{fmt(runwayCurrent)}</span>
                {runwayTarget > 0 && <span style={{fontSize:"17px",color:MUT}}> of {fmt(runwayTarget)}</span>}
              </div>
              <span style={{fontSize:"12.5px",color:MUT}}>{m.runwayMonths.toFixed(1)} of {m.bufferMonths} months</span>
            </div>
            <div style={{position:"relative",width:"100%",height:"12px",borderRadius:"6px",background:`linear-gradient(90deg,${CRITICAL} 0%,${GOLD} 33%,${SUCCESS} 60%,#1e4d35 100%)`}}>
              <div style={{position:"absolute",left:`${runwayMarkerPct}%`,top:"-3px",bottom:"-3px",width:"3px",borderRadius:"2px",background:WHITE,boxShadow:"0 0 0 1px rgba(0,0,0,0.3)",transform:"translateX(-1.5px)"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:"5px"}}>
              <span style={{fontSize:"11px",color:MUT}}>0 mo</span>
              <span style={{fontSize:"11px",color:TEXT,fontWeight:600}}>{m.bufferMonths}mo target</span>
              <span style={{fontSize:"11px",color:MUT}}>{m.bufferMonths*2}mo+</span>
            </div>
          </TileRow>
          {showEmergencyWin && (
            <TileRow>
              <div style={line}>
                <span style={{...rowLabel,display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
                  Gap to your target
                  <span style={{fontSize:"11px",fontWeight:700,color:CRITICAL,background:`${CRITICAL}18`,padding:"2px 8px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase"}}>Priority</span>
                </span>
                <span style={rowFigure}>{fmt(m.emergencyShortfall)}</span>
              </div>
              {monthsToCloseGap > 0 && <div style={rowNote}>Your spare {fmt(Math.round(m.monthlySurplus))} a month would close it in about {monthsToCloseGap} month{monthsToCloseGap===1?"":"s"}</div>}
            </TileRow>
          )}
          {notes.fund && (
            <TileRow>
              <p style={noteText}>
                {m.bufferMonths > 0
                  ? `The target is ${m.bufferMonths} months of your spending, at ${fmt(Math.round(m.emergencyBuffer / m.bufferMonths))} a month.`
                  : `You hold ${fmt(m.totalLiquid)} against a ${fmt(m.emergencyBuffer)} target.`}
              </p>
            </TileRow>
          )}
        </MobileTile>
      )}

      <MobileTile data-tour="working" title="Savings"
        badge={news ? <NewBadge count={news.count} label={rateUpdatesLabel(news.count)}/> : null}
        menu={[
          // Once set, the row in the tile says so; the menu has nothing more to do.
          gain > 50 && !reminder.isSet && { icon: Bell, label: "Remind me", onClick: reminder.setReminder },
          totalPot > 0 && howItem("savings"),
          editItem,
        ]}>
        {totalPot > 0 && opp ? (
          <>
            {gain <= 50 && <TileRow first align><span style={rowLabel}>Your savings are already on good rates.</span></TileRow>}
            <TileRow first={gain > 50} align>
              <div style={line}><span style={rowLabel}>What your savings earn now, after tax</span><span style={rowFigure}>{fmt(opp.currentKept + opp.bondsPrize)}/yr</span></div>
              {opp.bondsPrize > 0 && <div style={rowNote}>Including about {fmt(opp.bondsPrize)} in Premium Bond prizes, at the average rate</div>}
            </TileRow>
            {opp.lines.map(l => {
              const o = l.option;
              const fromBonds = (o.from || []).filter(f => f.taxFree).reduce((t, f) => t + f.amount, 0);
              return (
                <TileRow key={l.section} onClick={rowTarget(l.section)} align>
                  <div style={line}>
                    <span style={rowLabel}>{fmt(o.amount)} in {accountName(o)} at {o.ratePct.toFixed(2)}%{o.pb ? " (an average)" : ""}</span>
                    <span style={{...rowFigure,color:SUCCESS}}>+{fmt(o.gain)}/yr</span>
                  </div>
                  <div style={rowNote}>{l.section}{fromBonds > 0 && `, ${fmt(fromBonds)} of it from your Premium Bonds`}</div>
                </TileRow>
              );
            })}
            <TileRow align>
              <div style={line}><span style={{...rowLabel,fontWeight:700}}>Together, after tax</span><span style={{...rowFigure,color:SUCCESS}}>{fmt(opp.currentKept + opp.bondsPrize + opp.gain)}/yr</span></div>
            </TileRow>
            {gain > 50 && (
              <TileRow onClick={reminder.isSet ? undefined : reminder.setReminder} align>
                <span style={{display:"flex",alignItems:"center",gap:"10px",fontSize:"14px",fontWeight:600,color:G}}>
                  {reminder.isSet ? <BellRing size={18} aria-hidden="true"/> : <Bell size={18} aria-hidden="true"/>}
                  {reminder.isSet ? `Reminder set for ${reminder.dateLabel}` : `Remind me on ${reminder.dateLabel}`}
                </span>
              </TileRow>
            )}
            {notes.savings && (
              <TileRow>
                <p style={noteText}>The highest-earning option in each, worked out together so no money is counted twice. Candid Assist, bottom right, lists the other providers in each and how to move.</p>
              </TileRow>
            )}
          </>
        ) : totalPot > 0 ? (
          <>
            <TileRow first>
              <div style={rowStyle}><span>Interest you earn now, before tax</span><span style={{fontWeight:600}}>{fmt(currentGrossTotal)}/yr</span></div>
              {m.cash > 0 && currentTaxCost > 0 && (
                <div style={{...rowStyle,color:CRITICAL}}><span>Tax due at {trPct}%</span><span>{fmt(currentTaxCost)}</span></div>
              )}
            </TileRow>
            {step1Isa > 0 && (
              <TileRow>
                <div style={{...NOTICE_LABEL,marginBottom:"2px"}}>In a Cash ISA, where interest is never taxed</div>
                {isaLines.length > 0 ? <AccountLines lines={isaLines} rowStyle={rowStyle}/> : (
                  <div style={rowStyle}><span>{fmt(step1Isa)} at {isaRateDisplay} (highest rate)</span><span style={{fontWeight:700,color:SUCCESS}}>{fmt(step1IsaInterest)}/yr</span></div>
                )}
                {notes.savings && (
                  <p style={{...rowNote,marginTop:"6px"}}>{fmt(step1Isa)} is your remaining ISA allowance this tax year. {isaLines.length > 1
                    ? `Spread across the highest-rate easy-access Cash ISAs, each up to its limit, it earns ${isaRateDisplay} on average.`
                    : `${isaRateDisplay} is the top easy-access Cash ISA rate today.`}</p>
                )}
              </TileRow>
            )}
            {step2Savings > 0 && (
              <TileRow>
                <div style={{...NOTICE_LABEL,marginBottom:"2px"}}>Then savings, up to your tax-free interest allowance</div>
                <div style={rowStyle}><span>{fmt(step2Savings)} at your current rate</span><span>{fmt(step2CurrentInterest)}/yr</span></div>
                {savingsLines.length > 0 ? <AccountLines lines={savingsLines} rowStyle={rowStyle}/> : (
                  <div style={rowStyle}><span>{fmt(step2Savings)} at {nonIsaRateDisplay} (highest rate)</span><span style={{fontWeight:600}}>{fmt(step2SavingsInterest)}/yr</span></div>
                )}
                <div style={{...rowStyle,fontWeight:700,color:step2Delta>0?SUCCESS:TEXT}}><span>Extra from switching</span><span>{step2Delta>0?"+":""}{fmt(Math.max(0,step2Delta))}/yr</span></div>
                {notes.savings && (
                  <p style={{...rowNote,marginTop:"6px"}}>£{psaLimit.toLocaleString("en-GB")}/yr is your Personal Savings Allowance (PSA) — savings interest that's tax-free outside an ISA, based on your tax band. You're already earning {fmt(step2CurrentInterest)}/yr on this money at your current rate; moving it to today's highest non-ISA rate ({nonIsaRateDisplay}) is worth an extra {fmt(Math.max(0,step2Delta))}/yr on top — not {fmt(step2SavingsInterest)}/yr from scratch.</p>
                )}
              </TileRow>
            )}
            {step3Pb > 0 && (
              <TileRow>
                <div style={{...NOTICE_LABEL,marginBottom:"2px"}}>Then Premium Bonds (tax-free average)</div>
                <div style={rowStyle}><span>{fmt(step3Pb)} at ~{(PB_RATE*100).toFixed(2)}%</span><span style={{fontWeight:700,color:SUCCESS}}>{fmt(step3PbInterest)}/yr</span></div>
              </TileRow>
            )}
            <TileRow>
              <div style={{...NOTICE_LABEL,marginBottom:"4px"}}>Where your savings could sit ({fmt(keptAmount)} kept as cash)</div>
              <div style={rowStyle}><span>{fmt(keptAmount)} @ {(todayBlendedRate*100).toFixed(2)}% — your average rate today</span><span>{fmt(currentInterestOnKeptAmount)}/yr</span></div>
              <p style={{fontSize:"11.5px",color:MUT,marginTop:"-2px",marginBottom:"8px"}}>= {m.savingsRate}% on your cash + {(PB_RATE*100).toFixed(1)}% on Premium Bonds, blended</p>
              <div style={rowStyle}><span>{fmt(keptAmount)} @ {optimalBlendedRatePct.toFixed(2)}% — the best average rate</span><span>{fmt(optimisedTotal)}/yr</span></div>
              <p style={{fontSize:"11.5px",color:MUT,marginTop:"-2px",marginBottom:"8px"}}>= {isaRateDisplay} ISA + {nonIsaRateDisplay} savings + {(PB_RATE*100).toFixed(1)}% Premium Bonds, blended</p>
              <div style={{...rowStyle,fontWeight:700,color:optimisationGain>0?SUCCESS:TEXT}}>
                <span>{optimisationGain>0?"You can earn":"Difference"}</span><span>{optimisationGain>0?"+":""}{fmt(optimisationGain)}/yr</span>
              </div>
            </TileRow>
          </>
        ) : (
          <TileRow first>
            <p style={{...noteText,color:MUT}}>Add your cash savings and any Premium Bonds in your details to see where they could earn more.</p>
          </TileRow>
        )}
      </MobileTile>

      {/* The provider lists, one tile each and unnumbered: places to look,
          not steps. A Savings row leads to its list (rowTarget). */}
      {[
        hasIsaList && { id: "cash-isas", title: "Cash ISAs", sub: mobileIsaSubheading(m), list: products.products },
        hasSavingsList && { id: "cash-savings", title: "Savings accounts", sub: mobilePsaSubheading(), list: products.nonIsaProducts },
      ].filter(Boolean).map(t => (
        <MobileTile key={t.id} id={t.id} title={t.title} subtitle={t.sub} menu={[howItem(t.id, "About these rates"), editItem]}>
          <MobileProductListTile embedded flush products={t.list}/>
          {notes[t.id] && products.disclaimer && (
            <TileRow><p style={{...rowNote,marginTop:0}}>{products.disclaimer}</p></TileRow>
          )}
        </MobileTile>
      ))}
    </div>
  );
}
