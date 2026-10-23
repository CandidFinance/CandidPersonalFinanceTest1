import { useEffect, useMemo, useRef, useState } from "react";
import { reportStorageFailure } from "../../lib/storage.js";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { Sparkles, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, SANS, OPPORTUNITY_TILE_BG, OPPORTUNITY_TILE_BORDER } from "../../design-tokens.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import { isLocked } from "../../lib/unlock.js";
import { assistItems, assistHasNews, itemsForPage, cashPlan, applyCashMove, accountName, MIN_ASSIST_GAIN, PB_MAX } from "../../lib/assist.js";
import { ISA_ALLOWANCE, PSA_BY_BAND } from "../../lib/tax.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import AgentPanel, { agentAvailable } from "./AgentPanel.jsx";
import { itemisedNonCashIsa } from "../../lib/isa.js";
import { FSCS_DEPOSIT_LIMIT } from "../../lib/cashAllocation.js";
import { pct, bondsIn, fromName, ratesDate, sectionLabel, primaryButton, textButton, card, Mark, OptionList, openStep, ProviderLinks, SecondChoice, AccountFlow, itemTitle, itemDetail, Elsewhere } from "./AssistParts.jsx";

// Candid Assist: a button above the tab bar that opens a panel walking the
// user through acting on what Candid has found. v1 covers cash that could
// earn more. Cash ISAs and savings accounts are separate sections, each a
// choice of providers sorted by rate with none picked in advance (some
// people keep their ISA allowance for investing, and Assist mustn't read as
// pushing an account). Once the user picks, Assist gives the amount, exactly
// which of their accounts it comes from, the link, and updates Candid
// afterwards. It never moves money.
//
// The panel sizes to its content, up to most of the screen, and minimises
// (the handle, the chevron, a swipe down, or a tap on the page behind)
// without losing its place. On a wide screen it floats as a card instead of
// rising from the bottom edge. With nothing to raise, the button goes quiet:
// smaller and muted, still there to open.
//
// `state` lives in CandidApp, which stays mounted across screens, so the
// panel keeps its place as the user moves around the app.

const SEEN_KEY = "candid_assist_seen";
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || []; } catch (e) { reportStorageFailure("read_assist_seen", e); return []; } };
const writeSeen = list => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(list.slice(-20))); } catch (e) { reportStorageFailure("save_assist_seen", e); } };
const WIDE = 640;

// `page`: the module the user is on (null on Home, Modules and Forecast).
// On a module page Assist deals with that module only, and lists anything
// for other pages under Elsewhere; `onGoTo` takes the user to a module.
export default function CandidAssist({ d, m, set, savingsRates, state, setState, page = null, moduleLabels = {}, onGoTo }) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const scrollRef = useRef(null);
  // Each step opens at its top, not where the last one was scrolled to.
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [state.step]);
  // Set once a Cash ISA or savings account is tapped, so a list it opens
  // scrolls into view then, and not when the panel reopens on old picks.
  const tapped = useRef(false);
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= WIDE);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= WIDE);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Nothing about a module whose answer is still locked (src/lib/unlock.js).
  const allItems = useMemo(() => assistItems(d, m, savingsRates).filter(i => !isLocked(d, i.module)), [d, m, savingsRates]);
  const { here: items, elsewhere } = itemsForPage(allItems, page);
  const pageLabel = page ? moduleLabels[page] || page : null;
  // With one thing to show, Assist opens on it; with more, on a list of them.
  const item = items.find(i => i.id === state.itemId) || (items.length === 1 ? items[0] : null);
  // The dot is for anything new anywhere, so nothing is missed by being on
  // another page; the button's fill is for this page.
  const news = assistHasNews(allItems, readSeen());
  const quiet = items.length === 0;
  const goTo = i => { onGoTo(i.module); update({ open: true, itemId: i.id, step: "overview" }); };
  const skipIsa = d.assistSkipIsa === true;
  const skipPb = d.assistSkipPb === true;
  const plan = useMemo(() => cashPlan(d, m, savingsRates, { skipIsa, skipPb, isaChoice: state.isaChoice, isaChoice2: state.isaChoice2, savingsChoice: state.savingsChoice, savingsChoice2: state.savingsChoice2, pbChoice: state.pbChoice }),
    [d, m, savingsRates, skipIsa, skipPb, state.isaChoice, state.isaChoice2, state.savingsChoice, state.savingsChoice2, state.pbChoice]);
  // From April 2027 under-65s have a separate, smaller limit for cash.
  const isaWord = plan && plan.isaLimit < ISA_ALLOWANCE ? "Cash ISA" : "ISA";

  // Opening Assist counts as having seen what's in it, here and elsewhere.
  useEffect(() => {
    if (state.open && allItems.length) writeSeen([...new Set([...readSeen(), ...allItems.map(i => i.signature)])]);
  }, [state.open, allItems]);

  const update = patch => setState(s => ({ ...s, ...patch }));
  const minimise = () => update({ open: false });
  const picks = plan ? plan.picks : [];
  const done = picks.filter(p => state.done[p.id]);
  const backToList = items.length > 1 && (
    <button type="button" style={{ ...textButton, padding: "0 0 10px", display: "inline-flex", alignItems: "center", gap: "2px" }} onClick={() => update({ itemId: null, step: "overview" })}><ChevronLeft size={16}/>Everything to look at</button>
  );
  const otherIsaItemised = itemisedNonCashIsa(d) > 0;
  const otherIsaUnknown = !otherIsaItemised && !d.hasOtherIsaThisYear;

  // ── Steps ────────────────────────────────────────────────────────────────
  let body;
  if (state.step === "finished") {
    body = (
      <div>
        <div style={{ fontFamily: SERIF, fontSize: "26px", fontWeight: 700, color: G, lineHeight: 1.2 }}>Your figures are updated.</div>
        <p style={{ fontSize: "14px", color: TEXT, lineHeight: 1.6, marginTop: "10px" }}>
          Candid now has your cash where you've moved it, so your score and opportunities reflect it.
          Assist will flag anything new, such as a rate change on these accounts.
        </p>
        <div style={{ marginTop: "22px" }}><button type="button" style={primaryButton(false)} onClick={() => update({ open: false, itemId: null, step: "overview" })}>Close</button></div>
      </div>
    );
  } else if (items.length > 1 && !item) {
    // More than one thing: a list, accounts that need a look first.
    body = (
      <div>
        <div style={{ fontFamily: SERIF, fontSize: "24px", fontWeight: 700, color: G, lineHeight: 1.25 }}>{items.length} things to look at{pageLabel ? ` in ${pageLabel}` : ""}</div>
        <div style={{ marginTop: "14px" }}>
          {items.map(i => (
            <button key={i.id} type="button" onClick={() => update({ itemId: i.id, step: "overview" })}
              style={{ ...card, display: "flex", alignItems: "center", gap: "12px", width: "100%", textAlign: "left", padding: "14px 16px", marginBottom: "10px", cursor: "pointer", fontFamily: SANS }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                {!page && <span style={{ display: "block", fontSize: "11px", fontWeight: 700, color: MUT, letterSpacing: "0.04em" }}>{moduleLabels[i.module] || i.module}</span>}
                <span style={{ display: "block", fontSize: "14.5px", fontWeight: 700, color: TEXT }}>{itemTitle(i)}</span>
                <span style={{ display: "block", fontSize: "12.5px", color: MUT, marginTop: "2px" }}>{itemDetail(i)}</span>
              </span>
              <ChevronRight size={16} color={MUT}/>
            </button>
          ))}
        </div>
      </div>
    );
  } else if (item && item.id !== "cash") {
    body = <AccountFlow item={item} state={state} update={update} d={d} set={set} backToList={backToList}/>;
  } else if (!item || !plan) {
    // Nothing on this page. On Cash (or an overview page) the cash reasons
    // why; on another module page, just that, with anything elsewhere below.
    const cashHere = !page || page === "cash";
    const snoozed = cashHere && d.assistSnoozed?.cash && plan && plan.upTo >= MIN_ASSIST_GAIN;
    body = (
      <div>
        <div style={{ fontFamily: SERIF, fontSize: "24px", fontWeight: 700, color: G, lineHeight: 1.25 }}>
          {page && !cashHere ? `Nothing to do on ${pageLabel} right now.` : "Nothing needs doing right now."}
        </div>
        {cashHere && (
          <p style={{ fontSize: "14px", color: TEXT, lineHeight: 1.6, marginTop: "10px" }}>
            {!(m.cash > 0) ? "Add your cash savings and Assist will show what they could earn in the best easy-access accounts."
              : snoozed ? "You said not now to the current figures. Assist will flag them again when the rates behind them change."
              : `Your cash is within ${fmt(MIN_ASSIST_GAIN)} a year of the best easy-access rates Candid tracks.`}
          </p>
        )}
        {snoozed && <button type="button" style={{ ...textButton, padding: "12px 0 0" }} onClick={() => set("assistSnoozed", { ...(d.assistSnoozed || {}), cash: null })}>Show them anyway</button>}
        {cashHere && !(m.cash > 0) && page !== "cash" && <button type="button" style={{ ...textButton, padding: "12px 0 0" }} onClick={() => { minimise(); onGoTo("cash"); }}>Go to Cash & savings</button>}
        <Elsewhere items={elsewhere} labels={moduleLabels} onGo={goTo}/>
        <p style={{ fontSize: "12.5px", color: MUT, lineHeight: 1.55, marginTop: "22px" }}>
          Assist checks your figures against the live rates each time you open Candid, and shows a gold dot when there's something new.
        </p>
      </div>
    );
  } else if (state.step === "how") {
    body = (
      <div>
        <button type="button" style={{ ...textButton, padding: "0 0 10px", display: "inline-flex", alignItems: "center", gap: "2px" }} onClick={() => update({ step: "overview" })}><ChevronLeft size={16}/>Back</button>
        <div style={{ fontFamily: SERIF, fontSize: "24px", fontWeight: 700, color: G, lineHeight: 1.25 }}>Moving your cash</div>
        <p style={{ fontSize: "13.5px", color: MUT, lineHeight: 1.55, margin: "6px 0 16px" }}>Tick each one once it's done. You can minimise this and come back at any point.</p>
        {picks.map(p => (
          <div key={p.id} style={{ ...card, padding: "14px 16px", marginBottom: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px" }}>
              <span style={{ fontSize: "15px", fontWeight: 700, color: TEXT }}>{accountName(p)}</span>
              <span style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 700, color: G, whiteSpace: "nowrap" }}>{fmt(p.amount)}</span>
            </div>
            <div style={{ fontSize: "12.5px", color: MUT, marginTop: "2px" }}>{p.pb ? `Premium Bonds, prize fund rate ${pct(p.ratePct)} (an average)` : `${p.isa ? "Cash ISA" : "Savings account"} at ${pct(p.ratePct)}`}</div>
            <div style={{ fontSize: "13.5px", color: TEXT, fontWeight: 600, marginTop: "12px" }}>Move {fmt(p.amount)} from:</div>
            <ul style={{ margin: "4px 0 10px", paddingLeft: "18px", fontSize: "13.5px", color: TEXT, lineHeight: 1.6 }}>
              {p.from.map((f, i) => {
                const whole = f.taxFree ? plan.bonds : plan.sources.find(s => s.index === f.index)?.amount ?? 0;
                return <li key={i}>{fromName(f)}: {fmt(f.amount)}{f.amount < whole - 0.5 ? ` (of ${fmt(whole)})` : ""}</li>;
              })}
            </ul>
            <ul style={{ margin: "0 0 12px", paddingLeft: "18px", fontSize: "13px", color: MUT, lineHeight: 1.6 }}>
              <li>{openStep(p)} Then move the money in.</li>
              {p.pb && <li>New bonds join the prize draw after a full calendar month. Prizes are tax-free, and can be paid to your bank or put back into bonds.</li>}
              {bondsIn(p) > 0 && <li>Cash in {fmt(bondsIn(p))} of Premium Bonds on NS&I's website or app first. The money usually reaches your bank in a few working days.</li>}
              {!p.pb && p.cap != null && <li>Only the first {fmt(p.cap)} earns {pct(p.ratePct)}.</li>}
              {p.fscsLimited && <li>FSCS protects up to {fmt(FSCS_DEPOSIT_LIMIT)} with each bank, counting anything you already hold there.</li>}
              {p.isa && <li>This uses {fmt(p.amount)} of your {fmt(plan.isaLimit)} {isaWord} allowance for this tax year.</li>}
              {p.isa && +d.isaPrevCash > 0 && <li>Moving money that's already in a Cash ISA as well? Ask {p.provider} to transfer it in. Withdrawing it yourself loses its tax-free status.</li>}
            </ul>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
              <ProviderLinks o={p}/>
              <button type="button" onClick={() => update({ done: { ...state.done, [p.id]: !state.done[p.id] } })}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "none", border: "none", padding: "4px 0", fontSize: "13.5px", fontWeight: 600, color: TEXT, fontFamily: SANS, cursor: "pointer" }}>
                <Mark on={!!state.done[p.id]}/>I've done this
              </button>
            </div>
            {agentAvailable(p) && <AgentPanel o={p} onOpened={() => setState(s => ({ ...s, done: { ...s.done, [p.id]: true } }))}/>}
          </div>
        ))}
        <div style={{ marginTop: "8px" }}>
          <button type="button" disabled={!done.length} style={primaryButton(!done.length)} onClick={() => update({ step: "update" })}>Update my figures in Candid</button>
        </div>
      </div>
    );
  } else if (state.step === "update") {
    const patch = applyCashMove(d, m, plan, done);
    const isaMoved = done.filter(p => p.isa);
    body = (
      <div>
        <button type="button" style={{ ...textButton, padding: "0 0 10px", display: "inline-flex", alignItems: "center", gap: "2px" }} onClick={() => update({ step: "how" })}><ChevronLeft size={16}/>Back</button>
        <div style={{ fontFamily: SERIF, fontSize: "24px", fontWeight: 700, color: G, lineHeight: 1.25 }}>Update Candid to match?</div>
        <p style={{ fontSize: "13.5px", color: MUT, lineHeight: 1.55, margin: "6px 0 16px" }}>Your cash in Candid becomes:</p>
        <div style={{ ...card, padding: "6px 16px" }}>
          {done.filter(p => p.pb).map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "10px 0", borderBottom: "1px solid rgba(22,47,36,0.07)", fontSize: "13.5px", color: TEXT }}>
              <span>NS&I Premium Bonds <span style={{ color: MUT }}>(added to your holding)</span></span><span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(p.amount)}</span>
            </div>
          ))}
          {isaMoved.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "10px 0", borderBottom: "1px solid rgba(22,47,36,0.07)", fontSize: "13.5px", color: TEXT }}>
              <span>{accountName(p)} <span style={{ color: MUT }}>(Cash ISA, counted in this year's allowance)</span></span><span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(p.amount)}</span>
            </div>
          ))}
          {patch.cashTiers.filter(t => +t.amount > 0).map((t, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "10px 0", borderBottom: "1px solid rgba(22,47,36,0.07)", fontSize: "13.5px", color: TEXT }}>
              <span>{t.name || "Savings"} <span style={{ color: MUT }}>at {pct(t.rate)}</span></span><span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(+t.amount)}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "22px" }}>
          <button type="button" style={primaryButton(false)} onClick={() => {
            Object.entries(patch).forEach(([k, v]) => set(k, v));
            update({ step: "finished", itemId: null, isaChoice: null, isaChoice2: null, savingsChoice: null, savingsChoice2: null, pbChoice: null, done: {} });
          }}>Update my figures</button>
        </div>
      </div>
    );
  } else {
    const asOf = ratesDate([...plan.isa.options, ...plan.savings.options]);
    const psa = PSA_BY_BAND[m.taxBandLabel];
    body = (
      <div>
        {backToList}
        <div style={sectionLabel}>Your cash</div>
        <div style={{ fontFamily: SERIF, fontSize: "32px", fontWeight: 700, color: G, lineHeight: 1.15, marginTop: "4px" }}>
          {picks.length ? `+${fmt(plan.chosenGain)} a year` : `Up to +${fmt(plan.upTo)} a year`}
        </div>
        <p style={{ fontSize: "14px", color: TEXT, lineHeight: 1.6, marginTop: "8px" }}>
          Your {fmtCompact(plan.cash)} earns ~{fmtCompact(plan.currentKept)}/yr after tax. The options below would earn more.
        </p>
        {item.isaNote && !skipIsa && <p style={{ fontSize: "13px", color: "#8a6a24", background: "rgba(196,150,58,0.12)", borderRadius: "10px", padding: "9px 12px", marginTop: "10px" }}>{item.isaNote}</p>}

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", marginTop: "22px" }}>
          <span style={{ fontSize: "16px", fontWeight: 700, color: TEXT }}>Cash ISA</span>
          {plan.isaLeft > 0 && (
            <button type="button" style={{ ...textButton, padding: 0, fontSize: "12.5px" }} onClick={() => { set("assistSkipIsa", !skipIsa); update({ isaChoice: null, isaChoice2: null }); }}>
              {skipIsa ? "Use it for cash" : "Keep it for investing"}
            </button>
          )}
        </div>
        {skipIsa ? (
          <p style={{ fontSize: "12.5px", color: MUT, margin: "4px 0 0", lineHeight: 1.5 }}>Kept for investing.</p>
        ) : plan.isaLeft <= 0 ? (
          <p style={{ fontSize: "12.5px", color: MUT, margin: "4px 0 0", lineHeight: 1.5 }}>Your {isaWord} allowance for this tax year is used. It resets on 6 April.</p>
        ) : (
          <>
            <p style={{ fontSize: "12.5px", color: MUT, margin: "4px 0 10px", lineHeight: 1.5 }}>
              {fmtCompact(plan.isaLeft)}/{fmtCompact(plan.isaLimit)} {isaWord} allowance remaining. Interest is tax-free.
            </p>
            {otherIsaUnknown && (
              <div style={{ ...card, padding: "12px 14px", marginBottom: "10px", background: "rgba(196,150,58,0.07)", borderColor: "rgba(196,150,58,0.3)" }}>
                <div style={{ fontSize: "13px", color: TEXT, lineHeight: 1.5 }}>Paid into a stocks and shares or Lifetime ISA since 6 April? It uses the same allowance.</div>
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <button type="button" style={{ ...textButton, padding: "6px 14px", border: "1px solid rgba(22,47,36,0.2)", borderRadius: "100px", fontSize: "13px" }} onClick={() => set("hasOtherIsaThisYear", "no")}>No</button>
                  <button type="button" style={{ ...textButton, padding: "6px 14px", border: "1px solid rgba(22,47,36,0.2)", borderRadius: "100px", fontSize: "13px" }} onClick={() => set("hasOtherIsaThisYear", "yes")}>Yes</button>
                </div>
              </div>
            )}
            {!otherIsaItemised && d.hasOtherIsaThisYear === "yes" && (
              <div style={{ marginBottom: "10px" }}>
                <PillMoneyInput label="Paid into other ISAs since 6 April" value={d.isaThisYearOtherTypes || null} onChange={v => set("isaThisYearOtherTypes", v == null ? "" : String(Math.min(ISA_ALLOWANCE, v)))}/>
              </div>
            )}
            {plan.isa.options.length
              ? <OptionList options={plan.isa.options} picked={plan.isa.pick} onPick={id => { tapped.current = true; update({ isaChoice: id, isaChoice2: null }); }}/>
              : <p style={{ fontSize: "12.5px", color: MUT }}>No easy-access Cash ISA Candid tracks beats what your savings earn now.</p>}
            <SecondChoice section={plan.isa} autoScroll={tapped.current} onPick={id => update({ isaChoice2: id })}/>
          </>
        )}

        <div style={{ fontSize: "16px", fontWeight: 700, color: TEXT, marginTop: "22px" }}>Savings account</div>
        <p style={{ fontSize: "12.5px", color: MUT, margin: "4px 0 10px", lineHeight: 1.5 }}>
          {psa ? `Annual interest above ${fmt(psa)} is taxed.` : "Interest is taxed at your income tax rate."}
          {!skipIsa && plan.isa.options.length ? " Amounts allow for the Cash ISA taking its share first." : ""}
          {plan.pb.options.length ? " Where Premium Bonds would pay more after tax, an account's amount stops at your allowance." : ""}
        </p>
        {plan.savings.options.length
          ? <OptionList options={plan.savings.options} picked={plan.savings.pick} onPick={id => { tapped.current = true; update({ savingsChoice: id, savingsChoice2: null }); }}/>
          : <p style={{ fontSize: "12.5px", color: MUT }}>No easy-access savings account Candid tracks beats what your savings earn now.</p>}
        <SecondChoice section={plan.savings} autoScroll={tapped.current} onPick={id => update({ savingsChoice2: id })}/>

        {(plan.pb.options.length > 0 || (skipPb && plan.pb.rate != null)) && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", marginTop: "22px" }}>
              <span style={{ fontSize: "16px", fontWeight: 700, color: TEXT }}>Premium Bonds</span>
              <button type="button" style={{ ...textButton, padding: 0, fontSize: "12.5px" }} onClick={() => { set("assistSkipPb", !skipPb); update({ pbChoice: null }); }}>
                {skipPb ? "Include them" : "Not for me"}
              </button>
            </div>
            {skipPb ? (
              <p style={{ fontSize: "12.5px", color: MUT, margin: "4px 0 0", lineHeight: 1.5 }}>Leaving Premium Bonds out.</p>
            ) : (
              <>
                <p style={{ fontSize: "12.5px", color: MUT, margin: "4px 0 10px", lineHeight: 1.5 }}>
                  Prizes are tax-free, so beyond your allowance they can pay more than a savings account keeps after tax.
                  NS&I's prize fund rate is {pct(plan.pb.rate)}: an average, not a guaranteed return. Smaller holdings often win less than the average, and some months nothing.
                  You can hold up to {fmt(PB_MAX)}{plan.bonds > 0 ? ` (you have ${fmt(plan.bonds)})` : ""}, and every pound is backed by HM Treasury.
                </p>
                <OptionList options={plan.pb.options} picked={plan.pb.pick} onPick={id => update({ pbChoice: id })}/>
              </>
            )}
          </>
        )}

        <p style={{ fontSize: "11.5px", color: MUT, lineHeight: 1.55, margin: "10px 0 18px" }}>
          These are figures, not a recommendation: what you move, if anything, is your choice. Sorted by rate. Easy-access accounts only{asOf ? `, rates as of ${asOf}` : ""}. Bonus rates can end after a set time; check each account's terms.
          {plan.bonds > 0 ? ` Your ${fmt(plan.bonds)} already in Premium Bonds stays where it is.` : ""}
        </p>
        <button type="button" disabled={!picks.length} style={primaryButton(!picks.length)} onClick={() => update({ step: "how" })}>Show me how</button>
        <div style={{ textAlign: "center", marginTop: "6px" }}>
          <button type="button" style={textButton} onClick={() => { set("assistSnoozed", { ...(d.assistSnoozed || {}), cash: item.signature }); minimise(); }}>Not now</button>
        </div>
      </div>
    );
  }

  // ── Button and panel ─────────────────────────────────────────────────────
  const size = quiet ? 42 : 54;
  const panelPosition = wide
    ? { left: 0, right: 0, bottom: "24px", margin: "0 auto", width: "calc(100% - 48px)", maxWidth: "520px", maxHeight: "calc(100vh - 96px)", borderRadius: "22px" }
    : { left: 0, right: 0, bottom: 0, margin: "0 auto", maxWidth: "580px", maxHeight: "88vh", borderRadius: "22px 22px 0 0" };
  return (
    <>
      {!state.open && (
        <button type="button" data-tour="assist" onClick={() => update({ open: true, ...(state.step === "finished" && items.length ? { step: "overview" } : {}) })}
          aria-label={`Open Candid Assist${news ? ", something new" : ""}`}
          style={{
            position: "fixed", zIndex: 4500, bottom: "calc(84px + env(safe-area-inset-bottom, 0px))", right: "max(16px, calc((100vw - 580px) / 2 + 16px))",
            width: `${size}px`, height: `${size}px`, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            // Active: the Opportunity tiles' wash (Home's hero), with more
            // lift than a tile so it reads as floating over the page.
            background: quiet ? WHITE : OPPORTUNITY_TILE_BG, border: quiet ? "1px solid rgba(22,47,36,0.14)" : OPPORTUNITY_TILE_BORDER,
            boxShadow: quiet ? "0 2px 8px rgba(22,47,36,0.08)" : "0 6px 18px rgba(22,47,36,0.18)", opacity: quiet ? 0.85 : 1,
            transition: "width 0.2s, height 0.2s",
          }}>
          <Sparkles size={quiet ? 18 : 22} color={quiet ? MUT : G}/>
          {news && <span style={{ position: "absolute", top: "2px", right: "2px", width: "12px", height: "12px", borderRadius: "50%", background: GOLD, border: `2px solid ${WHITE}` }}/>}
        </button>
      )}
      <AnimatePresence>
        {state.open && (
          <>
            <motion.div key="assist-backdrop" onClick={minimise} aria-hidden="true"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }}
              style={{ position: "fixed", inset: 0, zIndex: 4900, background: "rgba(22,47,36,0.28)" }}/>
            <motion.div key="assist-panel" role="dialog" aria-label="Candid Assist"
              drag="y" dragListener={false} dragControls={dragControls} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.7 }}
              onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 600) minimise(); }}
              initial={wide ? { y: 24, opacity: 0 } : { y: "100%" }} animate={wide ? { y: 0, opacity: 1 } : { y: 0 }} exit={wide ? { y: 24, opacity: 0 } : { y: "100%" }}
              transition={reduceMotion ? { duration: 0 } : wide ? { duration: 0.2 } : { type: "spring", damping: 32, stiffness: 320 }}
              style={{ position: "fixed", zIndex: 5000, ...panelPosition, background: "#FBFAF6",
                boxShadow: "0 -10px 40px rgba(22,47,36,0.18)", display: "flex", flexDirection: "column", fontFamily: SANS }}>
              <div onPointerDown={e => dragControls.start(e)} style={{ touchAction: "none", padding: "8px 20px 10px", cursor: "grab", flexShrink: 0, borderBottom: "1px solid rgba(22,47,36,0.07)" }}>
                <button type="button" onClick={minimise} aria-label="Minimise Candid Assist"
                  style={{ display: "block", margin: "0 auto 8px", width: "44px", height: "5px", borderRadius: "3px", background: "rgba(22,47,36,0.2)", border: "none", padding: 0, cursor: "pointer" }}/>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: 700, color: G }}>
                    <Sparkles size={17} color={GOLD}/>Candid Assist
                  </span>
                  <button type="button" onClick={minimise} aria-label="Minimise"
                    style={{ background: "rgba(22,47,36,0.06)", border: "none", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <ChevronDown size={18} color={G}/>
                  </button>
                </div>
              </div>
              <div ref={scrollRef} style={{ overflowY: "auto", padding: wide ? "18px 22px 22px" : "18px 20px calc(24px + env(safe-area-inset-bottom, 0px))" }}>
                {body}
                {items.length > 0 && state.step === "overview" && <Elsewhere items={elsewhere} labels={moduleLabels} onGo={goTo}/>}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
