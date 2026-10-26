import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft } from "lucide-react";
import { G, MUT, TEXT, SERIF, SANS, WHITE, PROGRESS_GREEN, LABEL_CAPS } from "../../design-tokens.js";

// The pieces every question flow shares (QuickStart, GuidedFlow, the answer
// reveal), so they all look alike: Back and the page dots across the top, the
// question large in the serif, answers as tiles that fill green when picked,
// one full-width green button, and the way out ("Skip ...") centred at the
// bottom. The motion between questions stays with each flow.

// 44px tall, however small the text, so it's easy to tap.
const link = { background: "none", border: "none", padding: "6px 0", minHeight: "44px", color: G, fontSize: "14px", fontWeight: 700, fontFamily: SANS, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "2px" };

// A whole screen of questions: at least the phone's height less the header
// and tab bar, so the Skip link sits at the bottom.
export const shellScreen = { minHeight: "calc(100dvh - 150px)", display: "flex", flexDirection: "column", boxSizing: "border-box", padding: "8px 0 24px" };

// How far through, as a thin green line: no "x of y", the line says it.
// Screen readers still get the count. `from`: the position it grows from
// when it first shows (a card that's new for each step).
export function ProgressLine({ position, total, from = null, style }) {
  const reduceMotion = useReducedMotion();
  const share = n => `${Math.max(0, Math.min(1, n / total)) * 100}%`;
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={position} aria-label={`${position} of ${total}`}
      style={{ height: "6px", borderRadius: "100px", background: "rgba(22,47,36,0.10)", overflow: "hidden", ...style }}>
      <motion.div initial={from == null ? false : { width: share(from) }} animate={{ width: share(position) }} transition={{ duration: reduceMotion ? 0 : 0.6, ease: [0.4, 0, 0.2, 1] }}
        style={{ height: "100%", borderRadius: "100px", background: PROGRESS_GREEN }}/>
    </div>
  );
}

// Which page of a flow, as a row of dots: the current one stretches into a
// green pill, and as the page changes the pill shrinks back and the next dot
// stretches, so it slides along. Screen readers get the count. `from`: the
// page it slides from when it first shows (a card that's new for each step).
const DOT = 6, PILL = 22;
export function PageDots({ position, total, from = null, style }) {
  const reduceMotion = useReducedMotion();
  const look = active => ({ width: active ? PILL : DOT, backgroundColor: active ? PROGRESS_GREEN : "rgba(22,47,36,0.18)" });
  return (
    <div role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={position} aria-label={`${position} of ${total}`}
      style={{ display: "flex", alignItems: "center", gap: "6px", ...style }}>
      {Array.from({ length: total }, (_, i) => (
        <motion.span key={i} initial={from == null ? false : look(i + 1 === from)} animate={look(i + 1 === position)}
          transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.4, 0, 0.2, 1] }}
          style={{ display: "block", height: DOT, borderRadius: "100px", flexShrink: 0 }}/>
      ))}
    </div>
  );
}

// Back on the left, the page dots centred; either left out when not given.
export function ShellTopRow({ onBack, position, total, style }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "16px", minHeight: "32px", ...style }}>
      {onBack ? <button type="button" onClick={onBack} style={{ ...link, justifySelf: "start" }}><ChevronLeft size={18}/>Back</button> : <span/>}
      {position != null && total ? <PageDots position={position} total={total}/> : <span/>}
      <span/>
    </div>
  );
}

// The question, and why it's asked. `compact`: smaller, for questions under
// a result card, so the answers still show without scrolling; an h2 there,
// under the page's own h1. `focusOnMount`: focus moves to the question when
// it replaces the last one, so a keyboard or screen reader carries on from
// the new question rather than the top of the page.
export function QuestionHeading({ ask, why, lead, compact = false, focusOnMount = false }) {
  const H = compact ? "h2" : "h1";
  const ref = useRef(null);
  useEffect(() => { if (focusOnMount) ref.current?.focus({ preventScroll: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {lead && <div style={{ ...LABEL_CAPS, marginBottom: "8px" }}>{lead}</div>}
      <H ref={ref} tabIndex={focusOnMount ? -1 : undefined} style={{ fontFamily: SERIF, fontSize: compact ? "clamp(22px, 6vw, 26px)" : "clamp(28px, 7.5vw, 36px)", fontWeight: 700, color: G, lineHeight: 1.15, margin: 0 }}>{ask}</H>
      {why && <p style={{ fontSize: compact ? "14px" : "15px", color: MUT, lineHeight: 1.5, margin: compact ? "8px 0 18px" : "10px 0 24px" }}>{why}</p>}
    </>
  );
}

// Two to a row when every answer is short, one per row otherwise.
const SHORT_LABEL = 22;
export const tileLayout = options =>
  options.length <= 6 && options.every(o => String(o.label).length <= SHORT_LABEL) ? "grid" : "row";

// The answers' container. `layout` from tileLayout, or "grid" to force it;
// `columns` for a grid other than two across. "wrap": three to a row, every
// tile the same size, a short last row centred.
export function AnswerGroup({ layout, label, multi = false, columns = 2, children }) {
  return (
    <div role={multi ? "group" : "radiogroup"} aria-label={label} className={layout === "wrap" ? "tiles-wrap" : undefined}
      style={layout === "grid" ? { display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: "10px" }
        : layout === "wrap" ? { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px" }
        : { display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Larger tiles on a desktop screen; the phone sizes are the fallbacks. */}
      {layout === "wrap" && <style>{`@media (min-width: 1000px) { .tiles-wrap { --tile-font: 20px; --tile-height: 104px; } }`}</style>}
      {children}
    </div>
  );
}

// One answer. "grid": a near-square tile; `compact` shorter, for more than
// six answers. "row": full width, text on the left. Fills green when picked;
// `dim` fades the others while the screen moves on. `check` (several answers
// at once) adds a tick to the picked ones. `suggested`: the answer offered
// first, outlined in green until one is picked. `tint`/`ink`: its own fill
// and text once picked, in place of green and white.
export function AnswerTile({ label, sub, on, dim = false, onPick, layout = "grid", compact = false, multi = false, check = false, suggested = false, tint = null, ink = null }) {
  const reduceMotion = useReducedMotion();
  const wrap = layout === "wrap";
  const grid = layout === "grid" || wrap;
  const fill = tint || G;
  return (
    <motion.button type="button" role={multi ? undefined : "radio"} aria-checked={multi ? undefined : on} aria-pressed={multi ? on : undefined} onClick={onPick}
      animate={{ backgroundColor: on ? fill : WHITE, color: on ? (ink || WHITE) : suggested ? G : TEXT, borderColor: on ? fill : suggested ? G : "rgba(22,47,36,0.16)", boxShadow: suggested && !on ? `inset 0 0 0 1px ${G}` : "inset 0 0 0 0px rgba(0,0,0,0)", opacity: dim ? 0.55 : 1, scale: on && !multi && !reduceMotion ? [1, 0.96, 1] : 1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{
        ...(wrap ? { flex: "0 0 calc((100% - 20px) / 3)", height: "var(--tile-height, 84px)", position: "relative" } : { minHeight: grid ? (compact ? "70px" : "92px") : "60px" }),
        borderRadius: "20px", border: "1.5px solid",
        padding: wrap ? "10px 8px" : grid ? "14px 12px" : "14px 18px", fontFamily: SANS, fontSize: wrap ? "var(--tile-font, 15.5px)" : grid ? "18px" : "17px", fontWeight: 700, lineHeight: 1.2,
        textAlign: grid ? "center" : "left", cursor: "pointer", width: "100%",
        display: "flex", flexDirection: grid ? "column" : "row", alignItems: "center", justifyContent: grid ? "center" : "space-between", gap: grid ? "4px" : "10px",
      }}>
      <span style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={wrap ? { whiteSpace: "pre-line" } : undefined}>{label}</span>
        {sub && <span style={{ fontSize: "13px", fontWeight: 500, opacity: 0.75 }}>{sub}</span>}
      </span>
      {check && on && <Check size={wrap ? 14 : 18} style={wrap ? { position: "absolute", top: "8px", right: "8px" } : { flexShrink: 0 }}/>}
    </motion.button>
  );
}

// The main button's look, shared by every full-width button in the entry,
// unlock and sign-in screens. `size`: "large" in the question flows,
// "regular" elsewhere (Start home, the unlock, the paywall, the sign-in
// gate). `outline`: the second choice beside a filled one, the same height.
export function primaryButtonStyle({ size = "large", outline = false, disabled = false } = {}) {
  const pad = size === "large" ? 17 : 15;
  return {
    width: "100%", background: outline ? WHITE : G, color: outline ? G : WHITE, border: outline ? `1.5px solid ${G}` : "none",
    borderRadius: "100px", padding: `${outline ? pad - 1.5 : pad}px`, fontSize: size === "large" ? "17px" : "15.5px", fontWeight: 700, fontFamily: SANS,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.35 : 1,
  };
}

// The one main button: full width, green, a pill.
export function PrimaryButton({ children, disabled = false, type = "button", onClick, size, outline, style }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...primaryButtonStyle({ size, outline, disabled }), ...style }}>{children}</button>
  );
}

// The way out, centred under the question.
export function SkipLink({ label, onClick, style }) {
  return (
    <div style={{ textAlign: "center", marginTop: "22px", ...style }}>
      <button type="button" onClick={onClick} style={{ ...link, fontSize: "13px", color: MUT, fontWeight: 600 }}>{label}</button>
    </div>
  );
}

// A quieter link under the main button ("Not sure").
export function TextLink({ children, onClick }) {
  return <button type="button" onClick={onClick} style={{ ...link, fontSize: "15px", padding: "12px" }}>{children}</button>;
}
