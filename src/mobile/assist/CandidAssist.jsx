import { useEffect, useMemo } from "react";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { Sparkles, ChevronDown, ChevronLeft, ArrowUpRight, Check } from "lucide-react";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, SANS } from "../../design-tokens.js";
import { fmt } from "../../lib/format.js";
import { assistItems, assistHasNews, cashMove, applyCashMove, MIN_ASSIST_GAIN } from "../../lib/assist.js";
import { ISA_ALLOWANCE } from "../../lib/tax.js";

// Candid Assist: a button above the tab bar that opens a panel walking the
// user through acting on what Candid has found. v1 covers cash that could
// earn more. The user chooses what to move; Assist gives the amounts, the
// accounts, the links, and updates Candid afterwards. It never moves money.
//
// The panel covers most of the screen but not all, and minimises (the
// handle, the chevron, a swipe down, or a tap on the page behind) without
// losing its place, so the user can check the main screen and come back.
// Once there's nothing to raise, the button goes quiet: smaller and muted,
// still there to open.
//
// `state` lives in CandidApp, which stays mounted across screens, so the
// panel keeps its place as the user moves around the app.

const SEEN_KEY = "candid_assist_seen";
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || []; } catch { return []; } };
const writeSeen = list => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(list.slice(-20))); } catch {} };

const pct = n => `${(+n).toFixed(2)}%`;
const lineName = l => l.product && !l.provider.toLowerCase().includes(l.product.toLowerCase()) ? `${l.provider} ${l.product}` : l.provider;
const ratesDate = lines => {
  const dates = lines.map(l => l.updatedAt).filter(Boolean).map(s => new Date(s));
  if (!dates.length) return null;
  return new Date(Math.min(...dates)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

const sectionLabel = { fontSize: "10.5px", fontWeight: 700, color: MUT, letterSpacing: "0.08em", textTransform: "uppercase" };
const primaryButton = disabled => ({ width: "100%", padding: "14px", borderRadius: "100px", border: "none", background: disabled ? "rgba(22,47,36,0.2)" : G, color: WHITE, fontSize: "15px", fontWeight: 700, fontFamily: SANS, cursor: disabled ? "default" : "pointer" });
const textButton = { background: "none", border: "none", padding: "10px", color: G, fontSize: "14px", fontWeight: 700, fontFamily: SANS, cursor: "pointer" };

function Tick({ on }) {
  return (
    <span style={{ width: "20px", height: "20px", borderRadius: "6px", flexShrink: 0, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
      border: on ? "none" : "1.5px solid rgba(22,47,36,0.3)", background: on ? G : WHITE, color: WHITE }}>
      {on && <Check size={13} strokeWidth={3}/>}
    </span>
  );
}

export default function CandidAssist({ d, m, set, savingsRates, state, setState, onOpenCash }) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const items = useMemo(() => assistItems(d, m, savingsRates), [d, m, savingsRates]);
  const item = items[0] || null;
  const news = assistHasNews(items, readSeen());
  const quiet = items.length === 0;

  // Opening Assist counts as having seen what's in it.
  useEffect(() => {
    if (state.open && items.length) writeSeen([...new Set([...readSeen(), ...items.map(i => i.signature)])]);
  }, [state.open, items]);

  const update = patch => setState(s => ({ ...s, ...patch }));
  const minimise = () => update({ open: false });
  const lines = item?.move.lines || [];
  const isTicked = l => state.ticked[l.id] !== false;
  const ticked = lines.filter(isTicked);
  const done = ticked.filter(l => state.done[l.id]);
  const tickedGain = ticked.reduce((s, l) => s + l.gain, 0);

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
  } else if (!item) {
    const move = cashMove(m, savingsRates);
    const snoozed = d.assistSnoozed?.cash && move && move.gain >= MIN_ASSIST_GAIN;
    body = (
      <div>
        <div style={{ fontFamily: SERIF, fontSize: "24px", fontWeight: 700, color: G, lineHeight: 1.25 }}>Nothing needs doing right now.</div>
        <p style={{ fontSize: "14px", color: TEXT, lineHeight: 1.6, marginTop: "10px" }}>
          {!(m.cash > 0) ? "Add your cash savings and Assist will show what they could earn across the best easy-access accounts."
            : snoozed ? "You said not now to the current figures. Assist will flag them again when the rates behind them change."
            : `Your cash is within ${fmt(MIN_ASSIST_GAIN)} a year of the best easy-access rates Candid tracks.`}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "18px", alignItems: "flex-start" }}>
          {snoozed && <button type="button" style={{ ...textButton, padding: "6px 0" }} onClick={() => set("assistSnoozed", { ...(d.assistSnoozed || {}), cash: null })}>Show them anyway</button>}
          {!(m.cash > 0) && <button type="button" style={{ ...textButton, padding: "6px 0" }} onClick={() => { minimise(); onOpenCash(); }}>Go to Cash & savings</button>}
        </div>
        <p style={{ fontSize: "12.5px", color: MUT, lineHeight: 1.55, marginTop: "26px" }}>
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
        {ticked.map(l => (
          <div key={l.id} style={{ background: WHITE, border: "1px solid rgba(22,47,36,0.12)", borderRadius: "14px", padding: "14px 16px", marginBottom: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px" }}>
              <span style={{ fontSize: "15px", fontWeight: 700, color: TEXT }}>{lineName(l)}</span>
              <span style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 700, color: G, whiteSpace: "nowrap" }}>{fmt(l.amount)}</span>
            </div>
            <ul style={{ margin: "10px 0 12px", paddingLeft: "18px", fontSize: "13.5px", color: TEXT, lineHeight: 1.6 }}>
              <li>Open the account on {l.provider}'s website or app.</li>
              <li>Move {fmt(l.amount)} into it from your current savings.</li>
              {l.cap != null && <li>Only the first {fmt(l.cap)} earns {pct(l.ratePct)}.</li>}
              {l.isa && <li>This uses {fmt(l.amount)} of your {fmt(ISA_ALLOWANCE)} ISA allowance for this tax year.</li>}
              {l.isa && <li>Moving money that's already in an ISA? Ask {l.provider} to transfer it in. Withdrawing it yourself loses its tax-free status.</li>}
            </ul>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
              {l.url && (
                <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13.5px", fontWeight: 700, color: G, textDecoration: "none" }}>
                  Open {l.provider}<ArrowUpRight size={14}/>
                </a>
              )}
              <button type="button" onClick={() => update({ done: { ...state.done, [l.id]: !state.done[l.id] } })}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "none", border: "none", padding: "4px 0", fontSize: "13.5px", fontWeight: 600, color: TEXT, fontFamily: SANS, cursor: "pointer" }}>
                <Tick on={!!state.done[l.id]}/>I've done this
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
    const patch = applyCashMove(d, m, done);
    const isaMoved = done.filter(l => l.isa);
    body = (
      <div>
        <button type="button" style={{ ...textButton, padding: "0 0 10px", display: "inline-flex", alignItems: "center", gap: "2px" }} onClick={() => update({ step: "how" })}><ChevronLeft size={16}/>Back</button>
        <div style={{ fontFamily: SERIF, fontSize: "24px", fontWeight: 700, color: G, lineHeight: 1.25 }}>Update Candid to match?</div>
        <p style={{ fontSize: "13.5px", color: MUT, lineHeight: 1.55, margin: "6px 0 16px" }}>Your cash in Candid becomes:</p>
        <div style={{ background: WHITE, border: "1px solid rgba(22,47,36,0.12)", borderRadius: "14px", padding: "6px 16px" }}>
          {isaMoved.map(l => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "10px 0", borderBottom: "1px solid rgba(22,47,36,0.07)", fontSize: "13.5px", color: TEXT }}>
              <span>{lineName(l)} <span style={{ color: MUT }}>(ISA, counted in this year's allowance)</span></span><span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(l.amount)}</span>
            </div>
          ))}
          {patch.cashTiers.filter(t => +t.amount > 0).map((t, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "10px 0", borderBottom: "1px solid rgba(22,47,36,0.07)", fontSize: "13.5px", color: TEXT }}>
              <span>Savings at {pct(t.rate)}</span><span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(+t.amount)}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "22px" }}>
          <button type="button" style={primaryButton(false)} onClick={() => {
            Object.entries(patch).forEach(([k, v]) => set(k, v));
            update({ step: "finished", ticked: {}, done: {} });
          }}>Update my figures</button>
        </div>
      </div>
    );
  } else {
    const asOf = ratesDate(lines);
    body = (
      <div>
        <div style={sectionLabel}>Your cash</div>
        <div style={{ fontFamily: SERIF, fontSize: "34px", fontWeight: 700, color: G, lineHeight: 1.15, marginTop: "4px" }}>+{fmt(tickedGain)} a year</div>
        <p style={{ fontSize: "14px", color: TEXT, lineHeight: 1.6, marginTop: "8px" }}>
          Your {fmt(item.move.cash)} earns {pct(item.move.currentRatePct)}, about {fmt(item.move.currentInterest)} a year.
          Moved into the accounts below, it could earn about {fmt(item.move.currentInterest + tickedGain)}.
        </p>
        {item.isaNote && <p style={{ fontSize: "13px", color: "#8a6a24", background: "rgba(196,150,58,0.12)", borderRadius: "10px", padding: "9px 12px", marginTop: "10px" }}>{item.isaNote}</p>}

        <div style={{ ...sectionLabel, marginTop: "22px" }}>The accounts</div>
        <p style={{ fontSize: "12.5px", color: MUT, margin: "4px 0 10px" }}>Untick any you'd rather not use.</p>
        {lines.map(l => (
          <button key={l.id} type="button" onClick={() => update({ ticked: { ...state.ticked, [l.id]: !isTicked(l) } })}
            style={{ display: "flex", alignItems: "flex-start", gap: "12px", width: "100%", textAlign: "left", background: WHITE, border: `1px solid ${isTicked(l) ? "rgba(22,47,36,0.18)" : "rgba(22,47,36,0.08)"}`, borderRadius: "14px", padding: "13px 14px", marginBottom: "10px", cursor: "pointer", fontFamily: SANS, opacity: isTicked(l) ? 1 : 0.6 }}>
            <span style={{ marginTop: "1px" }}><Tick on={isTicked(l)}/></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "14.5px", fontWeight: 700, color: TEXT }}>{lineName(l)}</span>
              <span style={{ display: "block", fontSize: "12.5px", color: MUT, marginTop: "2px", lineHeight: 1.45 }}>
                {fmt(l.amount)} at {pct(l.ratePct)}{l.isa ? " · ISA" : ""}{l.cap != null ? ` · this rate on up to ${fmt(l.cap)}` : ""}
              </span>
            </span>
            <span style={{ fontFamily: SERIF, fontSize: "15px", fontWeight: 700, color: G, whiteSpace: "nowrap" }}>+{fmt(l.gain)}</span>
          </button>
        ))}
        <p style={{ fontSize: "11.5px", color: MUT, lineHeight: 1.55, margin: "4px 0 18px" }}>
          These are figures, not a recommendation: what you move, if anything, is your choice. Easy-access accounts only{asOf ? `, rates as of ${asOf}` : ""}. Bonus rates can end after a set time; check each account's terms.
        </p>
        <button type="button" disabled={!ticked.length} style={primaryButton(!ticked.length)} onClick={() => update({ step: "how" })}>Show me how</button>
        <div style={{ textAlign: "center", marginTop: "6px" }}>
          <button type="button" style={textButton} onClick={() => { set("assistSnoozed", { ...(d.assistSnoozed || {}), cash: item.signature }); minimise(); }}>Not now</button>
        </div>
      </div>
    );
  }

  // ── Button and panel ─────────────────────────────────────────────────────
  const size = quiet ? 42 : 54;
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
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", damping: 32, stiffness: 320 }}
              style={{
                position: "fixed", zIndex: 5000, left: 0, right: 0, bottom: 0, margin: "0 auto", maxWidth: "580px",
                height: "88vh", maxHeight: "calc(100% - 56px)", background: "#FBFAF6", borderRadius: "22px 22px 0 0",
                boxShadow: "0 -10px 40px rgba(22,47,36,0.18)", display: "flex", flexDirection: "column", fontFamily: SANS,
              }}>
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
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px calc(24px + env(safe-area-inset-bottom, 0px))" }}>{body}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
