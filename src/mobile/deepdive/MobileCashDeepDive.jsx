import { useState, useEffect, useMemo } from "react";
import { Bell, Info, Pencil, EyeOff, ChevronRight, SlidersHorizontal } from "lucide-react";
import { calcCashOptimisation } from "../../lib/cash.js";
import { cashOpportunity, accountName, assistItems, cashSources, savingsTax } from "../../lib/assist.js";
import { fmt } from "../../lib/format.js";
import { premiumOpen } from "../../lib/unlock.js";
import { topRate } from "../../lib/savingsRates.js";
import { getModuleProducts } from "../moduleProducts.js";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import MobileTile, { TileRow, RowText, ROW, TilePopover, priorityTag } from "../MobileTile.jsx";
import MobileProductListTile from "../MobileProductListTile.jsx";
import NewBadge, { rateUpdatesLabel } from "../NewBadge.jsx";
import { useCashNews, markCashOpened, markCashSeen } from "../visitNews.js";
import { mobileIsaSubheading, mobilePsaSubheading, firstName } from "../copy.js";
import { buildReminderSubject } from "../reminders.js";
import { useReminder, ReminderPills } from "../MobileReminderAction.jsx";
import { MUT, TEXT, SUCCESS, CRITICAL, NOTICE_LABEL, TILE_FIGURE, TILE_LABEL_SIZE, CREAM, SERIF, SANS, RADIUS_PILL, ALERT_ON_DARK, WARN_ON_DARK, NEON_GREEN, STRIPE_ON_LIGHT } from "../../design-tokens.js";
import { CREAM_SOFT } from "../ScreenBand.jsx";
import { Button } from "../ui";

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
        <div style={{...rowStyle,padding:0}}><span>{fmt(l.amount)} at {l.ratePct.toFixed(2)}%</span><span style={{...TILE_FIGURE,color:SUCCESS}}>{fmt(l.interest)}/yr</span></div>
        <div style={{fontSize:"12px",color:MUT,lineHeight:1.5}}>
          {name}{l.cap != null && ` · up to ${fmt(l.cap)}`}{l.fscsLimited && " · the most FSCS protects with one bank"}{l.extra != null && anchorRate != null && ` · ${fmt(l.extra)}/yr more than at ${anchorRate.toFixed(2)}%`}
        </div>
      </div>
    );
  });
}

// The page's figures, shared by its band (CashBand) and its tiles.
function useCashFigures(d, m, savingsRates, onOpenAssist) {
  const isaRatePct = topRate(savingsRates, true)?.rate_aer ?? null;
  const nonIsaRatePct = topRate(savingsRates, false)?.rate_aer ?? null;
  const calc = calcCashOptimisation(m, isaRatePct, nonIsaRatePct, savingsRates);
  const products = getModuleProducts("cash", d, m, savingsRates);
  // With the rates loaded, the same after-tax figure and choices as Candid
  // Assist and Home (cashOpportunity); before then, the waterfall's estimate.
  const opp = cashOpportunity(d, m, savingsRates);
  const gain = opp ? opp.gain : calc.optimisationGain;
  // Candid Assist is a premium feature, with a cash item to open only above
  // its threshold and not snoozed. "See options" goes there when it can, or
  // else to the provider lists on this page, which are free.
  const assistCash = useMemo(() => premiumOpen(d) && assistItems(d, m, savingsRates).some(i => i.id === "cash"), [d, m, savingsRates]);
  const assistHasCash = !!onOpenAssist && gain > 50 && assistCash;
  const hasIsaList = !!products.products?.length, hasSavingsList = !!products.nonIsaProducts?.length;
  const scrollTo = id => () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const seeOptions = assistHasCash ? () => onOpenAssist("cash") : hasIsaList ? scrollTo("cash-isas") : hasSavingsList ? scrollTo("cash-savings") : null;
  return { calc, products, opp, gain, hasIsaList, hasSavingsList, seeOptions };
}

// The page's top, on the dark band (ScreenBand, in MobileModuleDeepDive):
// "Cash · Opportunity" with the module's status in glass beside it (in
// ALERT_ON_DARK when it needs action) and the spanner to the inputs, then
// the yearly loss to low rates, large, and "Explain this" (the answer step
// by step). The title and figure stay as the sheet comes up
// (`data-band-keep`). `data-tour="figure"`: lit up by the Cash tour
// (CashTour.jsx).
const GLASS_PILL = { display:"inline-flex", alignItems:"center", padding:"4px 10px", borderRadius:RADIUS_PILL, background:"rgba(255,255,255,0.10)", backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)", border:"1px solid rgba(255,255,255,0.16)", fontSize:"11px", fontWeight:700, whiteSpace:"nowrap" };
export function CashBand({ d, m, savingsRates, onOpenAssist, status, statusTone = null, onShowReveal, onEditInputs }) {
  const { calc, opp, gain } = useCashFigures(d, m, savingsRates, onOpenAssist);
  const shown = gain > 50 ? gain : 0;
  // The tour's first stop only when there's a loss to show (CashTour.jsx
  // leaves it out otherwise).
  return (
    <section aria-label="Cash opportunity" data-tour={shown > 0 ? "figure" : undefined}>
      <div style={{display:"flex",alignItems:"center",gap:"10px",minHeight:"28px"}}>
        <div data-band-keep="title" style={{fontSize:"11px",fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:CREAM_SOFT,whiteSpace:"nowrap"}}>Cash · Opportunity</div>
        {status && <span style={{...GLASS_PILL,color:statusTone === "alert" ? ALERT_ON_DARK : statusTone === "warn" ? WARN_ON_DARK : CREAM}}>{status}</span>}
        {onEditInputs && (
          <button type="button" onClick={onEditInputs} aria-label="Edit your finances" className="tap44" style={{marginLeft:"auto",background:"none",border:"none",padding:"4px",marginRight:"-4px",cursor:"pointer",color:CREAM,display:"flex"}}>
            <SlidersHorizontal size={20} strokeWidth={2.2} aria-hidden="true"/>
          </button>
        )}
      </div>
      <div data-band-keep="figure" style={{fontFamily:SERIF,fontSize:"var(--hero-fig)",fontWeight:700,color:CREAM,lineHeight:1.05,letterSpacing:"-0.01em",marginTop:"8px"}}>
        {fmt(shown)}<span style={{fontFamily:SANS,fontSize:"0.32em",fontWeight:600,marginLeft:"5px",letterSpacing:0}}>a year</span>
      </div>
      <div style={{fontSize:"13px",color:CREAM_SOFT,lineHeight:1.45,marginTop:"6px"}}>
        {shown > 0 ? (opp ? "Lost to low rates, after tax" : "Lost to low rates")
          : calc.totalPot > 0 ? "Your savings are already on good rates."
          : "Add your savings in your details to see what they could earn."}
      </div>
      {onShowReveal && (
        <Button variant="secondary" onClick={onShowReveal} style={{marginTop:"16px",border:"none",paddingRight:"12px"}}>
          Explain this<ChevronRight size={17} strokeWidth={2.5} aria-hidden="true" style={{marginLeft:"-4px"}}/>
        </Button>
      )}
    </section>
  );
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
  const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:TILE_LABEL_SIZE, color:TEXT, padding:"5px 0" };
  const { calc, products, opp, gain, hasIsaList, hasSavingsList, seeOptions } = useCashFigures(d, m, savingsRates, onOpenAssist);
  const {
    psaLimit, isaRateDisplay, nonIsaRateDisplay, PB_RATE,
    currentGrossTotal, trPct, currentTaxCost,
    totalPot, step1Isa, step1IsaInterest, step2Savings, step2SavingsInterest, step2CurrentInterest, step2Delta,
    step3Pb, step3PbInterest,
    optimisedTotal, keptAmount, currentInterestOnKeptAmount, optimisationGain, todayBlendedRate,
    isaLines, savingsLines,
  } = calc;
  const optimalBlendedRatePct = keptAmount > 0 ? (optimisedTotal / keptAmount) * 100 : 0;
  const reminder = useReminder({
    id: "cash-move-surplus",
    title: buildReminderSubject(`${fmt(gain)}/yr`, "Higher rates for your savings"),
    // Informational, not directive — states the figures and points to
    // the rate tiles/provider to do the "how", rather than instructing
    // a specific transfer, avoiding reading as financial advice.
    description: opp
      ? `${firstName(d) ? firstName(d)+", h" : "H"}ere's your reminder to look at your savings rates. The highest-rate options in Candid today are worth up to ${fmt(gain)}/yr more after tax than where it sits.\n\nThe options are on your Cash page. Most accounts open online in a few minutes.`
      : `${firstName(d) ? firstName(d)+", h" : "H"}ere's your reminder to look at your savings rates. Filling your ISA at ${isaRateDisplay} first, then your Personal Savings Allowance at ${nonIsaRateDisplay}, is worth up to ${fmt(optimisationGain)}/yr more than where it sits today.\n\nThe current highest rates are in Candid; any move is made directly with the provider - most accounts open online in a few minutes.`,
  });

  const showEmergencyWin = m.emergencyShortfall > 0;
  const monthsToCloseGap = m.monthlySurplus > 0 ? Math.ceil(m.emergencyShortfall / m.monthlySurplus) : null;

  const runwayTarget = m.emergencyBuffer;
  const runwayCurrent = m.totalLiquid;
  const runwayPctRaw = runwayTarget > 0 ? (runwayCurrent / runwayTarget) * 100 : 0;
  // A few words on where the fund stands, after "£x of £y".
  const runwayNote = runwayTarget <= 0 ? null
    : runwayPctRaw >= 150 ? "Well past your target"
    : runwayPctRaw >= 100 ? "Target reached"
    : runwayPctRaw >= 80 ? "Nearly there"
    : runwayPctRaw >= 33 ? "Part way there"
    : "A way to go";
  // One chunk per month of the target, each filled as far as the savings
  // reach (0 to 1). None without a target (no spending entered), as empty
  // chunks would read as no savings.
  const runwayChunks = Array.from({ length: runwayTarget > 0 ? m.bufferMonths || 0 : 0 }, (_, i) =>
    Math.max(0, Math.min(1, (runwayPctRaw / 100) * m.bufferMonths - i)));
  // A fund at its target can be hidden; it comes back, and can be hidden
  // again, once savings fall below the target (`emergencyCardDismissed`).
  const funded = runwayTarget > 0 && runwayPctRaw >= 100;
  const fundHidden = funded && !!d.emergencyCardDismissed;
  const belowTarget = runwayTarget > 0 && runwayPctRaw < 100;
  useEffect(() => { if (belowTarget && d.emergencyCardDismissed && set) set("emergencyCardDismissed", false); }, [belowTarget, d.emergencyCardDismissed]);
  // Minimised to the chunks alone (d.emergencyFundMin), with the timing of
  // Home's Coming up (ComingUp.jsx).
  const reduceMotion = useReducedMotion();
  const canMinimise = !!set && runwayChunks.length > 0;
  const fundMin = canMinimise && !!d.emergencyFundMin;
  const fundMove = { duration: reduceMotion ? 0 : 0.38, ease: [0.2, 0, 0, 1] };
  // The tile's white, title text and rows fade in only when it's opened from
  // minimised, not each time the page opens.
  const [fundToggled, setFundToggled] = useState(false);
  const fundAnimate = fundToggled && !reduceMotion;
  const fundFade = fundAnimate ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { ...fundMove, delay: 0.12 } } } : {};
  const setFundMin = v => { setFundToggled(true); set("emergencyFundMin", v); };
  // A tap anywhere on the tile but its controls, menu, pop-out and their
  // backdrops (aria-hidden) minimises it.
  const onFundTap = e => { if (!e.target.closest("button, a, [role=menu], [role=dialog], [aria-hidden=true]")) setFundMin(true); };
  const fundBar = runwayChunks.length > 0 && (
    <div role="img" aria-label={`${m.runwayMonths.toFixed(1)} of ${m.bufferMonths} months of spending covered`}
      style={{display:"flex",gap:"4px",marginTop:fundMin ? 0 : "2px"}}>
      {runwayChunks.map((f, i) => (
        <motion.div key={i} layoutId={`ef-chunk-${i}`} transition={fundMove}
          style={{flex:1,height:"14px",borderRadius:"4px",overflow:"hidden",background:STRIPE_ON_LIGHT}}>
          {f > 0 && <div style={{width:`${f * 100}%`,height:"100%",background:NEON_GREEN}}/>}
        </motion.div>
      ))}
    </div>
  );

  const editItem = onEditInputs && { icon: Pencil, label: "Edit my figures", onClick: onEditInputs };
  const howItem = (k, label = "How this is worked out") => ({ icon: Info, label: notes[k] ? "Hide the explanation" : label, onClick: () => toggleNote(k) });
  // A tile's explanation as a bubble from its "more" button (TilePopover),
  // over the page rather than opening the tile downwards.
  const howPop = (k, title, body) => (
    <AnimatePresence>
      {notes[k] && body && (
        <TilePopover key={k} title={title} onClose={() => setNotes(n => ({ ...n, [k]: false }))} style={{top:"44px"}}>
          <p style={{...ROW.text,margin:0}}>{body}</p>
        </TilePopover>
      )}
    </AnimatePresence>
  );
  // The Savings tile in three parts: where the money sits now, the accounts
  // that would earn more (the opportunity), and the two together, the money
  // left where it is plus what moves. `key` matches an option's `from` index
  // ("pb" for Premium Bonds held), so what moves comes off its account.
  const heldNow = opp ? [
    ...cashSources(d, m).map(s => ({ key: s.index, name: s.name || (s.index == null ? "Your cash" : `Account ${s.index + 1}`), amount: s.amount, ratePct: s.ratePct })),
    m.bonds > 0 && { key: "pb", name: "Premium Bonds", amount: +m.bonds, ratePct: opp.bondsPrize / m.bonds * 100 },
  ].filter(Boolean) : [];
  const moved = opp ? opp.lines.flatMap(l => l.option.from || []) : [];
  // The provider alone, as in the lists below: a product's full name
  // ("… Easy Access Autumn Account (Issue 2)") is too long for a line.
  const optionName = o => o.pb ? "Premium Bonds" : (o.provider || accountName(o));
  // Premium Bonds bought and those still held are one holding: one row, at
  // their average rate. ISA interest and prizes are tax-free; the rest is
  // taxed above the tax-free allowance (savingsTax), shown as its own line.
  const optimal = [];
  if (opp) {
    const rows = [
      ...opp.lines.map(l => ({ name: optionName(l.option), amount: l.option.amount, ratePct: l.option.ratePct, taxFree: !!(l.option.isa || l.option.pb) })),
      ...heldNow.map(h => ({ ...h, taxFree: h.key === "pb", amount: h.amount - moved.filter(f => f.index === h.key).reduce((t, f) => t + f.amount, 0) })).filter(h => h.amount >= 1),
    ];
    for (const r of rows) {
      const same = r.name === "Premium Bonds" && optimal.find(x => x.name === "Premium Bonds");
      if (!same) { optimal.push({ ...r }); continue; }
      const interest = same.amount * same.ratePct + r.amount * r.ratePct;
      same.amount += r.amount;
      same.ratePct = interest / same.amount;
    }
  }
  const optimalGross = optimal.reduce((t, x) => t + x.amount * x.ratePct / 100, 0);
  const optimalTaxable = optimal.filter(x => !x.taxFree).reduce((t, x) => t + x.amount * x.ratePct / 100, 0);
  const optimalTax = optimalTaxable - savingsTax(m).kept(optimalTaxable);
  const money = v => <span style={{whiteSpace:"nowrap"}}>{v}</span>;
  const header = (label, figure, color = TEXT) => <RowText label={<span style={{fontWeight:700}}>{label}</span>} figure={money(figure)} figureStyle={{color}} figureOnLabel/>;
  const subLine = (key, left, value) => (
    <div key={key} style={{...ROW.note,display:"flex",justifyContent:"space-between",gap:"12px"}}>
      <span>{left}</span>{value != null && money(value)}
    </div>
  );
  const line = x => `${x.name} · ${fmt(x.amount)} at ${x.ratePct.toFixed(2)}%`;

  return (
    <div>

      {/* The emergency fund, above the other tiles: one chunk per month of
          the target, then £ held of the target. A tap on the tile minimises
          it to the chunks alone on the page (d.emergencyFundMin), as Home's
          Coming up does: the chunks move into place and the rest fades. A
          tap on them opens it again. `data-tour`: lit up by the Cash tour
          (CashTour.jsx), as are the tiles either side. */}
      {!fundHidden && (
        <LayoutGroup>
          {fundMin && runwayChunks.length > 0 ? (
            // No data-tour: the Cash tour skips its fund stop (which talks
            // about the £ figures) while the tile's minimised.
            <button type="button" onClick={() => setFundMin(false)} aria-expanded="false"
              aria-label={`Emergency fund: ${fmt(runwayCurrent)}${runwayTarget > 0 ? ` of ${fmt(runwayTarget)}` : ""}${runwayNote ? `, ${runwayNote.toLowerCase()}` : ""}. Open`}
              // Side padding as in the open tile (16px and its 1px edge), so
              // the chunks keep the same width and line up with the tiles' text.
              style={{display:"block",width:"100%",background:"none",border:"none",padding:"6px 17px 18px",cursor:"pointer"}}>
              {fundBar}
            </button>
          ) : (
            <MobileTile data-tour="fund" title="Emergency fund"
              onClick={canMinimise ? onFundTap : undefined}
              // Opened from minimised, the tile's white and edge fade in
              // (ef-card-in, below) around the chunks as they move into place.
              style={{cursor:canMinimise ? "pointer" : undefined,animation:fundAnimate ? "ef-card-in 0.38s cubic-bezier(0.2,0,0,1) 0.12s both" : undefined}}
              menu={[
                howItem("fund", "How the target is worked out"),
                editItem,
                funded && set && { icon: EyeOff, label: "Hide this tile", onClick: () => set("emergencyCardDismissed", true) },
              ]}>
              {fundAnimate && <style>{"@keyframes ef-card-in{from{background-color:transparent;border-color:transparent}}"}</style>}
              <TileRow first>
                {/* The chunks as a button too, so the tile can be minimised
                    from the keyboard. */}
                {canMinimise ? (
                  <button type="button" onClick={() => setFundMin(true)} aria-expanded="true" aria-label="Minimise Emergency fund"
                    style={{display:"block",width:"100%",background:"none",border:"none",padding:0,cursor:"pointer"}}>
                    {fundBar}
                  </button>
                ) : fundBar}
                <motion.div {...fundFade} style={{fontSize:TILE_LABEL_SIZE,color:MUT,lineHeight:1.45,marginTop:runwayChunks.length > 0 ? "8px" : 0}}>
                  <span style={{color:TEXT,fontWeight:600}}>{fmt(runwayCurrent)}</span>
                  {runwayTarget > 0 && <> of {fmt(runwayTarget)}</>}
                  {runwayNote && <> · {runwayNote}</>}
                </motion.div>
              </TileRow>
              {showEmergencyWin && (
                <TileRow>
                  <motion.div {...fundFade}>
                    <RowText label="Gap to your target" figure={fmt(m.emergencyShortfall)}
                      tool={priorityTag}
                      note={monthsToCloseGap > 0 && `~${monthsToCloseGap} month${monthsToCloseGap === 1 ? "" : "s"} of spare ${m.monthlySurplus < 1000 ? fmt(Math.round(m.monthlySurplus)) : `£${(m.monthlySurplus / 1000).toFixed(1).replace(/\.0$/, "")}k`}/mo closes it`}/>
                  </motion.div>
                </TileRow>
              )}
              {howPop("fund", "How the target is worked out", m.bufferMonths > 0
                ? `The target is ${m.bufferMonths} months of your spending, at ${fmt(Math.round(m.emergencyBuffer / m.bufferMonths))} a month. Your savings cover ${m.runwayMonths.toFixed(1)} months.`
                : `You hold ${fmt(m.totalLiquid)} against a ${fmt(m.emergencyBuffer)} target.`)}
            </MobileTile>
          )}
        </LayoutGroup>
      )}

      <MobileTile data-tour="working" title="Savings this year"
        badge={news ? <NewBadge count={news.count} label={rateUpdatesLabel(news.count)}/> : null}
        menu={[
          // Once set, the row in the tile says so; the menu has nothing more to do.
          gain > 50 && !reminder.isSet && { icon: Bell, label: "Remind me", onClick: reminder.setReminder },
          totalPot > 0 && howItem("savings"),
          editItem,
        ]}>
        {totalPot > 0 && opp ? (
          <>
            {gain <= 50 && <TileRow first><span style={ROW.label}>Your savings are already on good rates.</span></TileRow>}
            <TileRow first={gain > 50}>
              {header("What you earn now", fmt(opp.currentKept + opp.bondsPrize))}
              {heldNow.length > 0 && subLine("now", heldNow.map(h => h.name).join(" + "))}
            </TileRow>
            {gain > 50 && (
              <>
                {/* The whole row leads on, as "See options" does: no chevron,
                    so its figures line up with the rows either side. */}
                <TileRow onClick={seeOptions || undefined} chevron={false}>
                  {header("What you're missing", `+${fmt(gain)}`, SUCCESS)}
                  {opp.lines.map(l => subLine(l.section, line({ name: optionName(l.option), amount: l.option.amount, ratePct: l.option.ratePct }), `+${fmt(l.option.gain)}`))}
                </TileRow>
                <TileRow>
                  {header("Optimal earnings", fmt(optimalGross - optimalTax))}
                  {optimal.map((x, i) => subLine(i, line(x), fmt(x.amount * x.ratePct / 100)))}
                  {optimalTax >= 1 && subLine("tax", "Tax", `-${fmt(optimalTax)}`)}
                </TileRow>
              </>
            )}
            {gain > 50 && (
              <TileRow><ReminderPills reminder={reminder} action={seeOptions && { label: "Show me how", onClick: seeOptions }}/></TileRow>
            )}
            {howPop("savings", "How this is worked out", "The highest-earning option in each, worked out together so no money is counted twice. The lists below show the other providers in each.")}
          </>
        ) : totalPot > 0 ? (
          <>
            <TileRow first>
              <div style={rowStyle}><span>Interest you earn now, before tax</span><span style={TILE_FIGURE}>{fmt(currentGrossTotal)}/yr</span></div>
              {m.cash > 0 && currentTaxCost > 0 && (
                <div style={{...rowStyle,color:CRITICAL}}><span>Tax due at {trPct}%</span><span style={TILE_FIGURE}>{fmt(currentTaxCost)}</span></div>
              )}
            </TileRow>
            {step1Isa > 0 && (
              <TileRow>
                <div style={{...NOTICE_LABEL,marginBottom:"2px"}}>In a Cash ISA, where interest is never taxed</div>
                {isaLines.length > 0 ? <AccountLines lines={isaLines} rowStyle={rowStyle}/> : (
                  <div style={rowStyle}><span>{fmt(step1Isa)} at {isaRateDisplay} (highest rate)</span><span style={{...TILE_FIGURE,color:SUCCESS}}>{fmt(step1IsaInterest)}/yr</span></div>
                )}
                {notes.savings && (
                  <p style={{...ROW.note,marginTop:"6px"}}>{fmt(step1Isa)} is your remaining ISA allowance this tax year. {isaLines.length > 1
                    ? `Spread across the highest-rate easy-access Cash ISAs, each up to its limit, it earns ${isaRateDisplay} on average.`
                    : `${isaRateDisplay} is the top easy-access Cash ISA rate today.`}</p>
                )}
              </TileRow>
            )}
            {step2Savings > 0 && (
              <TileRow>
                <div style={{...NOTICE_LABEL,marginBottom:"2px"}}>Then savings, up to your tax-free interest allowance</div>
                <div style={rowStyle}><span>{fmt(step2Savings)} at your current rate</span><span style={TILE_FIGURE}>{fmt(step2CurrentInterest)}/yr</span></div>
                {savingsLines.length > 0 ? <AccountLines lines={savingsLines} rowStyle={rowStyle}/> : (
                  <div style={rowStyle}><span>{fmt(step2Savings)} at {nonIsaRateDisplay} (highest rate)</span><span style={TILE_FIGURE}>{fmt(step2SavingsInterest)}/yr</span></div>
                )}
                <div style={{...rowStyle,fontWeight:700,color:step2Delta>0?SUCCESS:TEXT}}><span>Extra from switching</span><span style={TILE_FIGURE}>{step2Delta>0?"+":""}{fmt(Math.max(0,step2Delta))}/yr</span></div>
                {notes.savings && (
                  <p style={{...ROW.note,marginTop:"6px"}}>£{psaLimit.toLocaleString("en-GB")}/yr is your Personal Savings Allowance (PSA) — savings interest that's tax-free outside an ISA, based on your tax band. You're already earning {fmt(step2CurrentInterest)}/yr on this money at your current rate; moving it to today's highest non-ISA rate ({nonIsaRateDisplay}) is worth an extra {fmt(Math.max(0,step2Delta))}/yr on top — not {fmt(step2SavingsInterest)}/yr from scratch.</p>
                )}
              </TileRow>
            )}
            {step3Pb > 0 && (
              <TileRow>
                <div style={{...NOTICE_LABEL,marginBottom:"2px"}}>Then Premium Bonds (tax-free average)</div>
                <div style={rowStyle}><span>{fmt(step3Pb)} at ~{(PB_RATE*100).toFixed(2)}%</span><span style={{...TILE_FIGURE,color:SUCCESS}}>{fmt(step3PbInterest)}/yr</span></div>
              </TileRow>
            )}
            <TileRow>
              <div style={{...NOTICE_LABEL,marginBottom:"4px"}}>Where your savings could sit ({fmt(keptAmount)} kept as cash)</div>
              <div style={rowStyle}><span>{fmt(keptAmount)} @ {(todayBlendedRate*100).toFixed(2)}% — your average rate today</span><span style={TILE_FIGURE}>{fmt(currentInterestOnKeptAmount)}/yr</span></div>
              <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginTop:"-2px",marginBottom:"8px"}}>= {m.savingsRate}% on your cash + {(PB_RATE*100).toFixed(1)}% on Premium Bonds, blended</p>
              <div style={rowStyle}><span>{fmt(keptAmount)} @ {optimalBlendedRatePct.toFixed(2)}% — the best average rate</span><span style={TILE_FIGURE}>{fmt(optimisedTotal)}/yr</span></div>
              <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginTop:"-2px",marginBottom:"8px"}}>= {isaRateDisplay} ISA + {nonIsaRateDisplay} savings + {(PB_RATE*100).toFixed(1)}% Premium Bonds, blended</p>
              <div style={{...rowStyle,fontWeight:700,color:optimisationGain>0?SUCCESS:TEXT}}>
                <span>{optimisationGain>0?"You can earn":"Difference"}</span><span style={TILE_FIGURE}>{optimisationGain>0?"+":""}{fmt(optimisationGain)}/yr</span>
              </div>
            </TileRow>
          </>
        ) : (
          <TileRow first>
            <p style={{...ROW.text,color:MUT}}>Add your cash savings and any Premium Bonds in your details to see where they could earn more.</p>
          </TileRow>
        )}
      </MobileTile>

      {/* The provider lists, one tile each and unnumbered: places to look,
          not steps. The Savings tile's "What you're missing" row leads here. */}
      {[
        hasIsaList && { id: "cash-isas", title: "Cash ISAs", sub: mobileIsaSubheading(m), list: products.products },
        hasSavingsList && { id: "cash-savings", title: "Savings accounts", sub: mobilePsaSubheading(), list: products.nonIsaProducts },
      ].filter(Boolean).map(t => (
        <MobileTile key={t.id} id={t.id} title={t.title} subtitle={t.sub} menu={[products.disclaimer && howItem(t.id, "About these rates"), editItem]}>
          <MobileProductListTile embedded flush figureOnName products={t.list}/>
          {howPop(t.id, "About these rates", products.disclaimer)}
        </MobileTile>
      ))}
    </div>
  );
}
