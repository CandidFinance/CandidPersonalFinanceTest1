import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Bell, Info, Pencil, Receipt } from "lucide-react";
import { retirementAgeFor } from "../../lib/metrics.js";
import { fmt } from "../../lib/format.js";
import { getModuleProducts } from "../moduleProducts.js";
import MobileTile, { TileRow, RowText, ROW, TilePopover, anchor } from "../MobileTile.jsx";
import MobileProductListTile from "../MobileProductListTile.jsx";
import GoToProviderButton from "../GoToProviderButton.jsx";
import PillMoneyInput from "../PillMoneyInput.jsx";
import InfoButton from "../InfoButton.jsx";
import { buildReminderSubject } from "../reminders.js";
import { useReminder, ReminderPills } from "../MobileReminderAction.jsx";
import { firstName } from "../copy.js";
import { G, WHITE, CRITICAL, SUCCESS } from "../../design-tokens.js";
import OpportunityTile from "./OpportunityTile.jsx";
import { GROWTH_NOMINAL_PCT } from "../../lib/growth.js";

// Trimmed mobile version of desktop's Investments deep dive (ModuleDeepDive,
// moduleKey==="investments" — CandidApp.jsx). Three tiles (MobileTile, rows
// on the tile, actions in its menu): this year's tax-free gains, the ISA
// allowance, and the ISA providers. Both wins keep desktop's numbers.
// Explanations pop out from a ? beside their row (TilePopover). Drops the
// ISA compound-growth line chart for this v1: inline charts need a
// mobile-specific redesign, not a direct port.
// Leads with the answer: the tax-free profit figure only when there's profit
// to talk about, otherwise the ISA allowance first.
export default function MobileInvestmentsDeepDive({ d, m, statuses, onRecordCrystallisedGain, onEditInputs }) {
  // The ? open beside a row: "bnb" | "isa" | "move" | null.
  const [openInfo, setOpenInfo] = useState(null);
  const toggleInfo = k => setOpenInfo(o => (o === k ? null : k));
  // Each tile's explanation, from its menu.
  const [notes, setNotes] = useState({});
  const toggleNote = k => setNotes(n => ({ ...n, [k]: !n[k] }));
  const [loggingGain, setLoggingGain] = useState(false);
  const [amountSoldInput, setAmountSoldInput] = useState(null);
  const [gainInput, setGainInput] = useState(null);

  const openGainLogger = () => { setAmountSoldInput(null); setGainInput(null); setLoggingGain(true); };
  const closeGainLogger = () => setLoggingGain(false);
  const saveGainLog = () => {
    if (onRecordCrystallisedGain) onRecordCrystallisedGain(Math.max(0, +amountSoldInput || 0), Math.max(0, +gainInput || 0));
    closeGainLogger();
  };

  const totalOpp = statuses.investments?.amount || 0;
  const unwrappedVal = +d.unwrappedValue || 0;
  const surplusSources = [];
  if (m.surplusCash > 5000) surplusSources.push(`${fmt(m.surplusCash)} of surplus cash above your ${m.bufferMonths}-month emergency fund`);
  if (unwrappedVal > 0) surplusSources.push(`${fmt(unwrappedVal)} of unwrapped investments`);
  const showMoveMsg = m.isaHeadroom > 0 && surplusSources.length > 0;

  const retirementAge = retirementAgeFor(d);
  const currentAge = +d.age || 30;
  const growthYears = Math.max(1, retirementAge - currentAge);
  const isaProjectedValue = m.isaHeadroom * Math.pow(1 + GROWTH_NOMINAL_PCT / 100, growthYears);

  const totalGains = +d.unrealisedGains || 0;
  const cgtRatePct = Math.round(m.cgtRate * 100);
  // Single source of truth for every £ figure this tile shows — crystallisable
  // (m, from metrics.js) is "what fits under this year's remaining allowance";
  // everything else here is derived from that one number, so the rows can
  // never disagree with each other the way the old cgtSaving-vs-ad-hoc-
  // taxIfWait split did.
  const taxableSurplus = Math.max(0, totalGains - m.crystallisable);
  const instantSellTax = Math.round(taxableSurplus * m.cgtRate);
  // How many tax years it'd take to shield the whole gain: this year's
  // (already-reduced) allowance first, then a fresh £3,000 each year after —
  // not `remainingCgtAllowance` repeated, since only THIS year is capped by
  // gains already realised.
  const spreadYears = (() => {
    const years = [];
    let remaining = totalGains;
    const first = Math.min(remaining, m.remainingCgtAllowance);
    if (first > 0) { years.push(first); remaining -= first; }
    while (remaining > 0.5) {
      const slice = Math.min(remaining, 3000);
      years.push(slice);
      remaining -= slice;
    }
    return years;
  })();
  const spreadTimingLabel = spreadYears
    .map((amt, i) => i === 0 ? `${fmt(Math.round(amt))} today` : i === 1 ? `${fmt(Math.round(amt))} after April 5` : `${fmt(Math.round(amt))} in tax year ${i+1}`)
    .join(", ");
  const products = getModuleProducts("investments", d, m);
  const showGains = m.crystallisable > 0 || totalGains > 0;
  const hasOpportunity = m.isaHeadroom > 0 || m.crystallisable > 0;

  const gainsReminder = useReminder({
    id: "investments-crystallise-gains",
    title: buildReminderSubject(fmt(m.crystallisable), "Crystallise capital gains"),
    // Informational, not directive — states the figures and points to
    // your platform/adviser for the "how", rather than instructing a
    // specific trade (avoids reading as financial advice).
    description: `${firstName(d) ? firstName(d)+", y" : "Y"}ou have ${fmt(m.remainingCgtAllowance)} of your £3,000 CGT allowance left this year, against ~${fmt(totalGains)} of unrealised gain.${instantSellTax > 0 ? ` Selling it all today would cost ${fmt(instantSellTax)} in tax — spreading it over ${spreadYears.length} tax years (${spreadTimingLabel}) avoids that entirely.` : ` Crystallising ${fmt(m.crystallisable)} of it now costs £0 in tax.`}\n\nTo use this year's allowance, this needs actioning before 5 April. Your platform, or a financial adviser, can say how it works for your holdings.`,
  });
  const isaReminder = useReminder({
    id: "investments-isa-allowance",
    title: buildReminderSubject(fmt(m.isaHeadroom), "Unused ISA allowance"),
    description: `${firstName(d) ? firstName(d)+", y" : "Y"}ou have ${fmt(m.isaHeadroom)} of your ISA allowance unused this tax year. Money invested in it grows free of tax, permanently.\n\nUnused allowance doesn't carry over: to capture it, this needs actioning before 5 April, when a fresh £20,000 opens.`,
  });

  const editItem = onEditInputs && { icon: Pencil, label: "Edit my figures", onClick: onEditInputs };
  const howItem = (k, label = "How this is worked out") => ({ icon: Info, label: notes[k] ? "Hide the explanation" : label, onClick: () => toggleNote(k) });
  // Once set, the pills in the tile say so; the menu has nothing more to do.
  const remindItem = r => !r.isSet && { icon: Bell, label: "Remind me", onClick: r.setReminder };
  // A ? beside a row's label, kept within the row's line height.
  const info = k => <span style={{display:"inline-flex",margin:"-4px 0"}}><InfoButton onClick={() => toggleInfo(k)} open={openInfo === k}/></span>;
  const pill = { flex:1, borderRadius:"100px", padding:"10px", fontSize:"13px", fontWeight:600, fontFamily:"inherit", cursor:"pointer" };
  const isaTitle = `Invested, by age ${retirementAge}`;

  return (
    <div>
      {hasOpportunity && (
        // The same lead figure as the answer step by step: tax-free profit
        // when there is some, otherwise the unused ISA allowance.
        totalOpp > 0 ? (
          <OpportunityTile figures={[{ value: fmt(totalOpp), label: "Capital gains tax you could avoid this year" }]}
            chips={[m.isaHeadroom > 0 && `${fmt(m.isaHeadroom)} of ISA allowance unused`]}/>
        ) : (
          <OpportunityTile figures={[{ value: fmt(m.isaHeadroom), label: "Of this year's ISA allowance unused" }]}
            chips={["Growth inside it is tax-free"]} note="Not a guaranteed gain."/>
        )
      )}

      {showGains && (
        <MobileTile id="inv-gains" title="Tax-free gains this year"
          // From the menu: once the menu has closed and handed focus back, so
          // the pop-out keeps it.
          menu={[
            m.crystallisable > 0 && remindItem(gainsReminder),
            m.crystallisable > 0 && onRecordCrystallisedGain && { icon: Receipt, label: "Record what you sold", onClick: () => setTimeout(openGainLogger, 200) },
            m.crystallisable > 0 && howItem("gains"),
            editItem,
          ]}>
          {m.crystallisable > 0 ? (
            <>
              <TileRow first align>
                <RowText label="Tax-free allowance left" note="Of £3,000 this tax year. What's unused is gone on 5 April." figure={fmt(m.remainingCgtAllowance)}/>
              </TileRow>
              <TileRow align><RowText inline label="Profit so far" figure={fmt(totalGains)}/></TileRow>
              <TileRow align><RowText inline label="Profit above the allowance" figure={fmt(taxableSurplus)}/></TileRow>
              <TileRow align>
                <RowText inline label="Tax if you sold it all today" note={`at ${cgtRatePct}%`} figure={fmt(instantSellTax)} figureStyle={instantSellTax > 0 ? {color:CRITICAL} : undefined}/>
              </TileRow>
              {instantSellTax > 0 ? (
                <TileRow align>
                  <RowText label={`Tax if spread over ${spreadYears.length} tax years`} note={spreadTimingLabel} figure={fmt(0)} figureStyle={{color:SUCCESS}}/>
                </TileRow>
              ) : (
                <TileRow align><p style={ROW.text}>Fully shielded by this year's allowance: no tax due either way.</p></TileRow>
              )}
              <TileRow align style={anchor}>
                <RowText inline label="Buying back in" note="the 30-day rule" tool={info("bnb")}/>
                <AnimatePresence>
                  {openInfo === "bnb" && (
                    <TilePopover key="bnb" title="Buying back in" onClose={() => setOpenInfo(null)}>
                      <p style={{...ROW.text,margin:0}}>
                        HMRC's "30-day rule" cancels the gain if you repurchase the same shares within 30 days. Buying back inside an ISA or pension sidesteps this — outside a wrapper, wait 30 days or buy a similarly-exposed fund instead.
                      </p>
                    </TilePopover>
                  )}
                </AnimatePresence>
              </TileRow>
              {notes.gains && (
                <TileRow align>
                  <p style={ROW.text}>Your profit outside an ISA or pension, less what's left of this year's £3,000 allowance. The spread uses this year's allowance first, then a fresh £3,000 each tax year after.</p>
                </TileRow>
              )}
              {onRecordCrystallisedGain && (
                <TileRow align style={anchor}>
                  <button type="button" onClick={loggingGain ? closeGainLogger : openGainLogger} aria-haspopup="dialog" aria-expanded={loggingGain}
                    style={{font:"inherit",...ROW.action,background:"none",border:"none",padding:0,cursor:"pointer"}}>
                    <Receipt size={18} aria-hidden="true"/>I've sold some: update my figures
                  </button>
                  <AnimatePresence>
                    {loggingGain && (
                      <TilePopover key="sold" title="Record what you sold" onClose={closeGainLogger}>
                        <div style={{display:"grid",gap:"8px"}}>
                          <PillMoneyInput label="Amount sold" value={amountSoldInput} onChange={setAmountSoldInput}/>
                          <PillMoneyInput label="Gain crystallised" value={gainInput} onChange={setGainInput}/>
                        </div>
                        <p style={{...ROW.note,marginTop:"10px"}}>
                          We'll move this from your investments into cash, and count the gain against this year's CGT allowance.
                        </p>
                        <div style={{display:"flex",gap:"8px",marginTop:"12px"}}>
                          <button type="button" onClick={closeGainLogger} style={{...pill,background:"transparent",border:"1.3px solid rgba(22,47,36,0.2)",color:G}}>Cancel</button>
                          <button type="button" onClick={saveGainLog} style={{...pill,background:G,border:"none",color:WHITE}}>Save</button>
                        </div>
                      </TilePopover>
                    )}
                  </AnimatePresence>
                </TileRow>
              )}
              <TileRow align><GoToProviderButton storageKey="candid_gia_provider_pref" defaultLabel="Go to my platform"/></TileRow>
              <TileRow align><ReminderPills reminder={gainsReminder}/></TileRow>
            </>
          ) : (
            <TileRow first align>
              <p style={ROW.text}>
                {m.remainingCgtAllowance === 0
                  ? "You've used your full £3,000 tax-free gains allowance this tax year — further profit outside an ISA or pension will be taxed at your marginal rate."
                  : "No profit recorded outside an ISA or pension this year — nothing to take tax-free. If that changes, come back before April 5th to use your £3,000 allowance."}
              </p>
            </TileRow>
          )}
        </MobileTile>
      )}

      <MobileTile id="inv-isa" title="Your ISA allowance" menu={[m.isaHeadroom > 0 && remindItem(isaReminder), editItem]}>
        {m.isaHeadroom > 0 ? (
          <>
            <TileRow first align>
              <RowText label="Left this tax year" note="Of £20,000. What's unused doesn't carry over: a fresh £20,000 opens on 6 April." figure={fmt(m.isaHeadroom)}/>
            </TileRow>
            <TileRow align style={anchor}>
              <RowText label={isaTitle} tool={info("isa")} note="Tax-free. Shares can fall as well as rise." figure={`~${fmt(Math.round(isaProjectedValue))}`}/>
              <AnimatePresence>
                {openInfo === "isa" && (
                  <TilePopover key="isa" title={isaTitle} onClose={() => setOpenInfo(null)}>
                    <p style={{...ROW.text,margin:0}}>
                      Over long periods shares have tended to grow faster than cash, though they can fall. Inside an ISA, that growth is free of tax for good.
                    </p>
                    <p style={{...ROW.note,marginTop:"8px"}}>
                      Illustrative only — assumes {GROWTH_NOMINAL_PCT}% p.a. nominal growth (not guaranteed) and investing at age {currentAge}, retiring at {retirementAge}. Real returns could be lower or negative.
                    </p>
                  </TilePopover>
                )}
              </AnimatePresence>
            </TileRow>
            {showMoveMsg && (
              <TileRow align style={anchor}>
                <RowText label="Money that could use it" tool={info("move")} note={surplusSources.join(" and ")}/>
                <AnimatePresence>
                  {openInfo === "move" && (
                    <TilePopover key="move" title="Money that could use it" onClose={() => setOpenInfo(null)}>
                      <p style={{...ROW.text,margin:0}}>
                        Many people use a Stocks and Shares ISA for money they won't need for five years or more, because over long periods shares have tended to grow faster than cash. They also carry the most risk: they can fall in value, sometimes for years. A Cash ISA uses the same allowance without that risk. Moving investments you already hold into an ISA means selling them first ("Bed and ISA"), which can create a taxable gain.
                      </p>
                    </TilePopover>
                  )}
                </AnimatePresence>
              </TileRow>
            )}
            <TileRow align><GoToProviderButton storageKey="candid_isa_provider_pref" defaultLabel="To my ISA"/></TileRow>
            <TileRow align><ReminderPills reminder={isaReminder}/></TileRow>
          </>
        ) : (
          <TileRow first align>
            <p style={ROW.text}>Nothing left to shelter this tax year — check back after April 6th for a fresh £20,000 allowance.</p>
          </TileRow>
        )}
      </MobileTile>

      {/* Places to look, not steps: a row per provider. */}
      {products.products?.length > 0 && (
        <MobileTile id="inv-providers" title="Stocks and Shares ISA providers" subtitle="Yearly charges, listed alphabetically" menu={[howItem("providers", "About this list"), editItem]}>
          <MobileProductListTile embedded flush noun="providers" products={products.products}/>
          {notes.providers && products.disclaimer && (
            <TileRow><p style={{...ROW.note,marginTop:0}}>{products.disclaimer}</p></TileRow>
          )}
        </MobileTile>
      )}
    </div>
  );
}
