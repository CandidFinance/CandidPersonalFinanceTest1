import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import posthog from "posthog-js";
import { G, MUT, TEXT, SERIF, SANS, WHITE } from "../../design-tokens.js";
import { EMERGENCY_MONTHS_OPTIONS, EMERGENCY_MONTHS_HINT } from "../../lib/metrics.js";
import { validEmailShape } from "../../lib/emailCheck.js";
import { PillSlider } from "../PillSlider.jsx";
import SaveFiguresOffer from "../SaveFiguresOffer.jsx";

// The Cash page's tour, once, the first time the page opens unlocked: five
// stops, each lighting up one part of the page (marked `data-tour="..."`)
// with a card beside it, then the estimates behind the answer, then the
// email. In place of the page's GuidanceIntro (the page's footer still
// says it's guidance). Describes what's on the page; never says what to do with it.
// A stop whose part isn't on the page (no Opportunity tile with nothing at
// stake, say) is left out. `d.cashTourDone` once it's finished or skipped.

const STOPS = [
  { id: "figure", target: "figure", title: "What you're losing",
    body: "The interest your savings lose each year to below-top rates, after tax. Worked out on your answers and today's top rates." },
  { id: "fund", target: "fund", title: "Your emergency fund",
    body: "Your savings against your target, in pounds and in months of your costs. The same target is on the Progress tab." },
  { id: "working", target: "working", title: "How it's worked out",
    body: "This tile opens to the figure step by step: what your savings earn now, and what the same money earns across today's top accounts, after tax. \"Explain this\", by the page's title, replays your answer." },
  { id: "assist", target: "assist", round: true, title: "Candid Assist",
    body: "Lists the accounts paying more than yours, what each would earn on your savings, and how moving works. It's on every page." },
  { id: "loop", target: null, title: "When you make a change",
    body: "Update your figures after moving money and Candid asks whether you made the change or corrected a figure. Changes you confirm count as Saved on the Modules tab, and your figures and Candid score update with them." },
];

const DIM = "rgba(22,47,36,0.55)";
const GAP = 10;   // between the lit part and its card
const TOP = 72;   // where a part is scrolled to, clear of the header
const tabBar = () => document.querySelector("[data-tab-bar]")?.getBoundingClientRect().height || 0;
const targetOf = id => document.querySelector(`[data-tour="${id}"]`);

// `rateCost`: Cash's rate loss, for the email ask. `estimates`: the phrases
// the answer is estimated from (quickStart.js estimateItems), each an exact
// figure to give. `onExactFigures` opens Edit inputs at Cash; `onEmail(email,
// name)` records the email as the reveal's ask does.
export default function CashTour({ d, m, set, rateCost, estimates, onExactFigures, onEmail }) {
  const reduce = useReducedMotion();
  const [steps, setSteps] = useState(null);
  const [at, setAt] = useState(0);
  const [rect, setRect] = useState(null);
  const [cardHeight, setCardHeight] = useState(0);
  const cardRef = useRef(null);
  const nextRef = useRef(null);
  const ended = useRef(false);

  // Once the page has laid out: the stops it has room for, then the
  // estimates and the email where they apply.
  useEffect(() => {
    const t = setTimeout(() => {
      const stops = STOPS.filter(s => !s.target || targetOf(s.target));
      setSteps([
        ...stops.map((s, i) => ({ ...s, position: i + 1, of: stops.length })),
        ...(estimates.length ? [{ id: "exact" }] : []),
        ...(!validEmailShape(d.email) ? [{ id: "email" }] : []),
      ]);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  const step = steps?.[at] || null;

  const end = (how, extra = {}) => {
    if (ended.current) return;
    ended.current = true;
    set("cashTourDone", true);
    posthog.capture(how === "skipped" ? "tour_skipped" : "tour_finished", { tour: "cash", at: step?.id, ...extra });
  };
  const next = () => (at + 1 < steps.length ? setAt(at + 1) : end("finished", { via: "end" }));

  // Into view, then measured; measured again as the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!step) return;
    posthog.capture("tour_step", { tour: "cash", step: step.id, position: at + 1 });
    const el = step.target ? targetOf(step.target) : null;
    // Gone since the tour began (the rates moved the figure, say): on.
    if (step.target && !el) { next(); return; }
    if (!el) { setRect(null); return; }
    const measure = () => setRect(el.getBoundingClientRect());
    const r = el.getBoundingClientRect();
    const fixed = getComputedStyle(el).position === "fixed";
    if (!fixed && (r.top < TOP || r.bottom > window.innerHeight - tabBar() - 200)) {
      window.scrollTo({ top: Math.max(0, r.top + window.scrollY - TOP), behavior: reduce ? "auto" : "smooth" });
    }
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    // The part itself changing size (a new target on the fund stop).
    const resized = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    resized?.observe(el);
    return () => { window.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); resized?.disconnect(); };
  }, [step]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.getBoundingClientRect().height);
  }, [step, rect]);
  useLayoutEffect(() => { nextRef.current?.focus({ preventScroll: true }); }, [step]);

  useEffect(() => {
    if (!step) return;
    const onKey = e => { if (e.key === "Escape") end("skipped"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  if (!step) return null;

  // Below the lit part where the card fits, above it where it fits there,
  // otherwise at the foot of the screen (a short screen); centred with
  // nothing lit.
  const room = window.innerHeight - tabBar();
  const below = rect && rect.bottom + GAP + cardHeight <= room;
  const above = rect && rect.top - GAP - cardHeight >= 12;
  const cardPlace = !rect ? { top: "50%", transform: "translateY(-50%)" }
    : below ? { top: `${rect.bottom + GAP}px` }
    : above ? { bottom: `${window.innerHeight - rect.top + GAP}px` }
    : { bottom: "12px" };

  const card = { background: WHITE, borderRadius: "18px", padding: "18px 18px 14px", boxShadow: "0 10px 30px rgba(22,47,36,0.25)", fontFamily: SANS };
  const quiet = { background: "none", border: "none", padding: "8px 0", color: MUT, fontSize: "13px", fontWeight: 600, fontFamily: SANS, cursor: "pointer" };
  const main = { background: G, color: WHITE, border: "none", borderRadius: "100px", padding: "11px 22px", fontSize: "14.5px", fontWeight: 700, fontFamily: SANS, cursor: "pointer" };

  let content;
  if (step.id === "exact") {
    content = (
      <div style={card}>
        <h2 id="tour-title" style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 700, color: G, margin: 0, lineHeight: 1.25 }}>Your answer uses estimates</h2>
        <p style={{ fontSize: "14.5px", color: TEXT, lineHeight: 1.55, margin: "8px 0 0" }}>{estimates.join(", ")}.</p>
        <p style={{ fontSize: "14.5px", color: TEXT, lineHeight: 1.55, margin: "6px 0 14px" }}>Your exact figures make it precise: {estimates.length} more {estimates.length === 1 ? "question" : "questions"}.</p>
        <button ref={nextRef} type="button" style={{ ...main, width: "100%", padding: "14px" }} onClick={() => { end("finished", { via: "exact_figures" }); onExactFigures(); }}>Use your exact figures</button>
        <div style={{ textAlign: "center", marginTop: "4px" }}><button type="button" style={quiet} onClick={next}>Not now</button></div>
      </div>
    );
  } else if (step.id === "email") {
    content = (
      <div>
        <SaveFiguresOffer d={d} moduleKey="cash" rateCost={rateCost} source="tour" style={{ marginTop: 0, boxShadow: "0 10px 30px rgba(22,47,36,0.25)" }}
          onEmail={(email, name) => { onEmail(email, name); end("finished", { via: "email" }); }}>
          <div style={{ textAlign: "center", marginTop: "2px" }}><button ref={nextRef} type="button" style={quiet} onClick={() => end("finished", { via: "email_declined" })}>Not now</button></div>
        </SaveFiguresOffer>
      </div>
    );
  } else {
    content = (
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px" }}>
          <h2 id="tour-title" style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 700, color: G, margin: 0, lineHeight: 1.25 }}>{step.title}</h2>
          <span style={{ fontSize: "13px", color: MUT, fontWeight: 600, whiteSpace: "nowrap" }}>{step.position} of {step.of}</span>
        </div>
        <p style={{ fontSize: "14.5px", color: TEXT, lineHeight: 1.55, margin: "8px 0 0" }}>{step.body}</p>
        {step.id === "fund" && (
          <div style={{ marginTop: "12px" }}>
            <PillSlider compact value={String(m.bufferMonths)} options={EMERGENCY_MONTHS_OPTIONS} onChange={v => {
              set("emergencyMonths", v);
              posthog.capture("progress_target_saved", { row: "emergency", months: +v, from: "tour" });
            }}/>
            <p style={{ fontSize: "12.5px", color: MUT, lineHeight: 1.5, margin: "6px 0 0" }}>{EMERGENCY_MONTHS_HINT[String(m.bufferMonths)]}.</p>
          </div>
        )}
        {step.id === "loop" && (
          // What the question looks like when it comes; not a working control.
          <div aria-hidden="true" style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <span style={{ background: G, color: WHITE, borderRadius: "100px", padding: "7px 12px", fontSize: "12.5px", fontWeight: 700 }}>I made the change</span>
            <span style={{ border: `1.5px solid ${G}`, color: G, borderRadius: "100px", padding: "6px 12px", fontSize: "12.5px", fontWeight: 700 }}>Just correcting</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px" }}>
          <button type="button" style={quiet} onClick={() => end("skipped")}>Skip tour</button>
          <button ref={nextRef} type="button" style={main} onClick={next}>Next</button>
        </div>
      </div>
    );
  }

  return (
    // Over the page, the tab bar and Assist's button; the page can't be
    // tapped while it's open.
    <div role="dialog" aria-modal="true" aria-labelledby={step.id === "email" ? undefined : "tour-title"} aria-label={step.id === "email" ? "Email" : undefined}
      onClick={e => e.stopPropagation()}
      style={{ position: "fixed", inset: 0, zIndex: 4700, background: rect ? "transparent" : DIM }}>
      {rect && (
        <div aria-hidden="true" style={{ position: "fixed", top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12,
          borderRadius: step.round ? "50%" : "18px", boxShadow: `0 0 0 9999px ${DIM}`, pointerEvents: "none", transition: reduce ? "none" : "top 0.25s, left 0.25s, width 0.25s, height 0.25s" }}/>
      )}
      <div ref={cardRef} style={{ position: "fixed", left: "16px", right: "16px", maxWidth: "548px", margin: "0 auto", maxHeight: "calc(100dvh - 24px)", overflowY: "auto", ...cardPlace }}>
        <motion.div key={step.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {content}
        </motion.div>
      </div>
    </div>
  );
}
