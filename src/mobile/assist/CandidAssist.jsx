import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { Sparkles, ChevronDown, ChevronLeft, ArrowUpRight, Check } from "lucide-react";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, SANS } from "../../design-tokens.js";
import { fmt } from "../../lib/format.js";
import { assistItems, assistHasNews, cashPlan, applyCashMove, accountName, MIN_ASSIST_GAIN } from "../../lib/assist.js";
import { ISA_ALLOWANCE, PSA_BY_BAND } from "../../lib/tax.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import { itemisedNonCashIsa } from "../../lib/isa.js";

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
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || []; } catch { return []; } };
const writeSeen = list => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(list.slice(-20))); } catch {} };
const WIDE = 640;

const pct = n => `${(+n).toFixed(2)}%`;
const fromName = f => f.name ? `${f.name} (${pct(f.ratePct)})` : f.index == null ? `your savings (${pct(f.ratePct)} on average)` : `your account paying ${pct(f.ratePct)}`;
const ratesDate = opts => {
  const dates = opts.map(o => o.updatedAt).filter(Boolean).map(s => new Date(s));
  return dates.length ? new Date(Math.min(...dates)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
};

const sectionLabel = { fontSize: "10.5px", fontWeight: 700, color: MUT, letterSpacing: "0.08em", textTransform: "uppercase" };
const primaryButton = disabled => ({ width: "100%", padding: "14px", borderRadius: "100px", border: "none", background: disabled ? "rgba(22,47,36,0.2)" : G, color: WHITE, fontSize: "15px", fontWeight: 700, fontFamily: SANS, cursor: disabled ? "default" : "pointer" });
const textButton = { background: "none", border: "none", padding: "10px", color: G, fontSize: "14px", fontWeight: 700, fontFamily: SANS, cursor: "pointer" };
const card = { background: WHITE, border: "1px solid rgba(22,47,36,0.12)", borderRadius: "14px" };

function Mark({ on, round = false }) {
  return (
    <span style={{ width: "20px", height: "20px", borderRadius: round ? "50%" : "6px", flexShrink: 0, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
      border: on ? "none" : "1.5px solid rgba(22,47,36,0.3)", background: on ? G : WHITE, color: WHITE }}>
      {on && <Check size={13} strokeWidth={3}/>}
    </span>
  );
}

// One section's providers: tap to pick, tap again to unpick.
function OptionList({ options, picked, onPick }) {
  return options.map(o => {
    const on = picked?.id === o.id;
    return (
      <button key={o.id} type="button" onClick={() => onPick(on ? null : o.id)} aria-pressed={on}
        style={{ ...card, display: "flex", alignItems: "flex-start", gap: "12px", width: "100%", textAlign: "left", padding: "13px 14px", marginBottom: "8px", cursor: "pointer", fontFamily: SANS,
          borderColor: on ? G : "rgba(22,47,36,0.12)", boxShadow: on ? `0 0 0 1px ${G}` : "none" }}>
        <span style={{ marginTop: "1px" }}><Mark on={on} round/></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: "14.5px", fontWeight: 700, color: TEXT }}>{accountName(o)}</span>
          <span style={{ display: "block", fontSize: "12.5px", color: MUT, marginTop: "2px", lineHeight: 1.45 }}>
            {pct(o.ratePct)} · would take {fmt(o.amount)}{o.cap != null ? ` (pays this on up to ${fmt(o.cap)})` : ""}
          </span>
        </span>
        <span style={{ fontFamily: SERIF, fontSize: "15px", fontWeight: 700, color: G, whiteSpace: "nowrap" }}>+{fmt(o.gain)}</span>
      </button>
    );
  });
}

export default function CandidAssist({ d, m, set, savingsRates, state, setState, onOpenCash }) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const scrollRef = useRef(null);
  // Each step opens at its top, not where the last one was scrolled to.
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [state.step]);
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= WIDE);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= WIDE);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const items = useMemo(() => assistItems(d, m, savingsRates), [d, m, savingsRates]);
  const item = items[0] || null;
  const news = assistHasNews(items, readSeen());
  const quiet = items.length === 0;
  const skipIsa = d.assistSkipIsa === true;
  const plan = useMemo(() => cashPlan(d, m, savingsRates, { skipIsa, isaChoice: state.isaChoice, savingsChoice: state.savingsChoice }),
    [d, m, savingsRates, skipIsa, state.isaChoice, state.savingsChoice]);

  // Opening Assist counts as having seen what's in it.
  useEffect(() => {
    if (state.open && items.length) writeSeen([...new Set([...readSeen(), ...items.map(i => i.signature)])]);
  }, [state.open, items]);

  const update = patch => setState(s => ({ ...s, ...patch }));
  const minimise = () => update({ open: false });
  const picks = plan ? [plan.isa.pick, plan.savings.pick].filter(Boolean) : [];
  const done = picks.filter(p => state.done[p.id]);
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
        <div style={{ marginTop: "22px" }}><button type="button" style={primaryButton(false)} onClick={() => update({ open: false, step: "overview" })}>Close</button></div>
      </div>
    );
  } else if (!item || !plan) {
    const snoozed = d.assistSnoozed?.cash && plan && plan.upTo >= MIN_ASSIST_GAIN;
    body = (
      <div>
        <div style={{ fontFamily: SERIF, fontSize: "24px", fontWeight: 700, color: G, lineHeight: 1.25 }}>Nothing needs doing right now.</div>
        <p style={{ fontSize: "14px", color: TEXT, lineHeight: 1.6, marginTop: "10px" }}>
          {!(m.cash > 0) ? "Add your cash savings and Assist will show what they could earn in the best easy-access accounts."
            : snoozed ? "You said not now to the current figures. Assist will flag them again when the rates behind them change."
            : `Your cash is within ${fmt(MIN_ASSIST_GAIN)} a year of the best easy-access rates Candid tracks.`}
        </p>
        {snoozed && <button type="button" style={{ ...textButton, padding: "12px 0 0" }} onClick={() => set("assistSnoozed", { ...(d.assistSnoozed || {}), cash: null })}>Show them anyway</button>}
        {!(m.cash > 0) && <button type="button" style={{ ...textButton, padding: "12px 0 0" }} onClick={() => { minimise(); onOpenCash(); }}>Go to Cash & savings</button>}
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
            <div style={{ fontSize: "12.5px", color: MUT, marginTop: "2px" }}>{p.isa ? "Cash ISA" : "Savings account"} at {pct(p.ratePct)}</div>
            <div style={{ fontSize: "13.5px", color: TEXT, fontWeight: 600, marginTop: "12px" }}>Move {fmt(p.amount)} from:</div>
            <ul style={{ margin: "4px 0 10px", paddingLeft: "18px", fontSize: "13.5px", color: TEXT, lineHeight: 1.6 }}>
              {p.from.map((f, i) => {
                const whole = plan.sources.find(s => s.index === f.index)?.amount ?? 0;
                return <li key={i}>{fromName(f)}: {fmt(f.amount)}{f.amount < whole - 0.5 ? ` (of ${fmt(whole)})` : ""}</li>;
              })}
            </ul>
            <ul style={{ margin: "0 0 12px", paddingLeft: "18px", fontSize: "13px", color: MUT, lineHeight: 1.6 }}>
              <li>Open the account on {p.provider}'s website or app first, then move the money in.</li>
              {p.cap != null && <li>Only the first {fmt(p.cap)} earns {pct(p.ratePct)}.</li>}
              {p.isa && <li>This uses {fmt(p.amount)} of your {fmt(ISA_ALLOWANCE)} ISA allowance for this tax year.</li>}
              {p.isa && +d.isaPrevCash > 0 && <li>Moving money that's already in a Cash ISA as well? Ask {p.provider} to transfer it in. Withdrawing it yourself loses its tax-free status.</li>}
            </ul>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
              {p.url && (
                <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13.5px", fontWeight: 700, color: G, textDecoration: "none" }}>
                  Open {p.provider}<ArrowUpRight size={14}/>
                </a>
              )}
              <button type="button" onClick={() => update({ done: { ...state.done, [p.id]: !state.done[p.id] } })}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "none", border: "none", padding: "4px 0", fontSize: "13.5px", fontWeight: 600, color: TEXT, fontFamily: SANS, cursor: "pointer" }}>
                <Mark on={!!state.done[p.id]}/>I've done this
              </button>
            </div>
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
            update({ step: "finished", isaChoice: null, savingsChoice: null, done: {} });
          }}>Update my figures</button>
        </div>
      </div>
    );
  } else {
    const asOf = ratesDate([...plan.isa.options, ...plan.savings.options]);
    const psa = PSA_BY_BAND[m.taxBandLabel];
    body = (
      <div>
        <div style={sectionLabel}>Your cash</div>
        <div style={{ fontFamily: SERIF, fontSize: "32px", fontWeight: 700, color: G, lineHeight: 1.15, marginTop: "4px" }}>
          {picks.length ? `+${fmt(plan.chosenGain)} a year` : `Up to +${fmt(plan.upTo)} a year`}
        </div>
        <p style={{ fontSize: "14px", color: TEXT, lineHeight: 1.6, marginTop: "8px" }}>
          Your {fmt(plan.cash)} in savings earns about {fmt(plan.currentInterest)} a year. Pick a Cash ISA, a savings account, or both, to see what moving would earn.
        </p>
        {item.isaNote && !skipIsa && <p style={{ fontSize: "13px", color: "#8a6a24", background: "rgba(196,150,58,0.12)", borderRadius: "10px", padding: "9px 12px", marginTop: "10px" }}>{item.isaNote}</p>}

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", marginTop: "22px" }}>
          <span style={{ fontSize: "16px", fontWeight: 700, color: TEXT }}>Cash ISA</span>
          {plan.isaLeft > 0 && (
            <button type="button" style={{ ...textButton, padding: 0, fontSize: "12.5px" }} onClick={() => { set("assistSkipIsa", !skipIsa); update({ isaChoice: null }); }}>
              {skipIsa ? "Use it for cash" : "Keep it for investing"}
            </button>
          )}
        </div>
        {skipIsa ? (
          <p style={{ fontSize: "12.5px", color: MUT, margin: "4px 0 0", lineHeight: 1.5 }}>Keeping your ISA allowance free for investing, so it isn't used here.</p>
        ) : plan.isaLeft <= 0 ? (
          <p style={{ fontSize: "12.5px", color: MUT, margin: "4px 0 0", lineHeight: 1.5 }}>Your ISA allowance for this tax year is used. It resets on 6 April.</p>
        ) : (
          <>
            <p style={{ fontSize: "12.5px", color: MUT, margin: "4px 0 10px", lineHeight: 1.5 }}>
              Interest is tax-free. {fmt(plan.isaLeft)} of your {fmt(ISA_ALLOWANCE)} allowance is left this tax year.
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
              ? <OptionList options={plan.isa.options} picked={plan.isa.pick} onPick={id => update({ isaChoice: id })}/>
              : <p style={{ fontSize: "12.5px", color: MUT }}>No easy-access Cash ISA Candid tracks beats what your savings earn now.</p>}
          </>
        )}

        <div style={{ fontSize: "16px", fontWeight: 700, color: TEXT, marginTop: "22px" }}>Savings account</div>
        <p style={{ fontSize: "12.5px", color: MUT, margin: "4px 0 10px", lineHeight: 1.5 }}>
          {psa ? `Interest over ${fmt(psa)} a year (your Personal Savings Allowance) is taxed.` : "Interest is taxed at your income tax rate."}
          {!skipIsa && plan.isa.options.length ? " Amounts allow for the Cash ISA taking its share first." : ""}
        </p>
        {plan.savings.options.length
          ? <OptionList options={plan.savings.options} picked={plan.savings.pick} onPick={id => update({ savingsChoice: id })}/>
          : <p style={{ fontSize: "12.5px", color: MUT }}>No easy-access savings account Candid tracks beats what your savings earn now.</p>}

        <p style={{ fontSize: "11.5px", color: MUT, lineHeight: 1.55, margin: "10px 0 18px" }}>
          These are figures, not a recommendation: what you move, if anything, is your choice. Sorted by rate. Easy-access accounts only{asOf ? `, rates as of ${asOf}` : ""}. Bonus rates can end after a set time; check each account's terms.
          {plan.bonds > 0 ? ` Your ${fmt(plan.bonds)} in Premium Bonds isn't included: their prizes are tax-free, so they compare differently.` : ""}
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
        <button type="button" onClick={() => update({ open: true, ...(state.step === "finished" && items.length ? { step: "overview" } : {}) })}
          aria-label={`Open Candid Assist${news ? ", something new" : ""}`}
          style={{
            position: "fixed", zIndex: 4500, bottom: "calc(84px + env(safe-area-inset-bottom, 0px))", right: "max(16px, calc((100vw - 580px) / 2 + 16px))",
            width: `${size}px`, height: `${size}px`, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            background: quiet ? WHITE : G, border: quiet ? "1px solid rgba(22,47,36,0.14)" : "none",
            boxShadow: quiet ? "0 2px 8px rgba(22,47,36,0.08)" : "0 6px 18px rgba(22,47,36,0.25)", opacity: quiet ? 0.85 : 1,
            transition: "width 0.2s, height 0.2s, background 0.2s",
          }}>
          <Sparkles size={quiet ? 18 : 22} color={quiet ? MUT : GOLD}/>
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
              <div ref={scrollRef} style={{ overflowY: "auto", padding: wide ? "18px 22px 22px" : "18px 20px calc(24px + env(safe-area-inset-bottom, 0px))" }}>{body}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
