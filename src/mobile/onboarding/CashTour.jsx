import { useEffect, useLayoutEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { G, MUT, TEXT, SERIF, SANS, WHITE } from "../../design-tokens.js";
import { EMERGENCY_MONTHS_OPTIONS, EMERGENCY_MONTHS_HINT } from "../../lib/metrics.js";
import { validEmailShape } from "../../lib/emailCheck.js";
import { PillSlider } from "../PillSlider.jsx";
import SaveFiguresOffer from "../SaveFiguresOffer.jsx";
import { CheckedCardBody } from "../CheckedCard.jsx";
import { PageDots } from "./OnboardingShell.jsx";
import TourOverlay, { targetOf } from "./TourOverlay.jsx";

// The Cash page's tour, once, the first time the page opens unlocked: five
// stops, each lighting up one part of the page (marked `data-tour="..."`)
// with a card beside it, then the estimates behind the answer, then the
// email, then a closing card, so it ends on what's been done rather than
// on an ask. In place of the page's GuidanceIntro (the page's footer still
// says it's guidance). Describes what's on the page; never says what to do with it.
// A stop whose part isn't on the page (no Opportunity tile with nothing at
// stake, say) is left out. `d.cashTourDone` as soon as it starts, so it's
// never shown twice, even if left part-way; the parent keeps it on screen
// until `onClose`.

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

// `rateCost`: Cash's rate loss, for the email ask. `estimates`: the phrases
// the answer is estimated from (quickStart.js estimateItems), each an exact
// figure to give. `onExactFigures` opens Edit inputs at Cash; `onEmail(email,
// name)` records the email as the reveal's ask does. `onStart` once it's
// begun, `onClose` once it's off the screen. `onDone`: the closing card's
// Done, after closing (on to Home for the app's tour).
export default function CashTour({ d, m, set, rateCost, estimates, onExactFigures, onEmail, onStart, onClose, onDone }) {
  const [steps, setSteps] = useState(null);
  const [at, setAt] = useState(0);
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
        { id: "done" },
      ]);
      set("cashTourDone", true);
      onStart?.();
    }, 400);
    return () => clearTimeout(t);
  }, []);

  // Left mid-way (another page): counted as skipped, and off the screen for good.
  const leftAt = useRef(null);
  useEffect(() => () => {
    if (!ended.current) { ended.current = true; posthog.capture("tour_skipped", { tour: "cash", at: leftAt.current, via: "left" }); }
    onClose?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const step = steps?.[at] || null;
  leftAt.current = step?.id;

  // `record` once, however it ends; `close` takes the tour off the page.
  const record = (how, extra = {}) => {
    if (ended.current) return;
    ended.current = true;
    posthog.capture(how === "skipped" ? "tour_skipped" : "tour_finished", { tour: "cash", at: step?.id, ...extra });
  };
  const close = () => onClose?.();
  const end = (how, extra) => { record(how, extra); close(); };
  // Finished: on to the closing card.
  const finish = extra => { record("finished", extra); setAt(steps.length - 1); };
  const next = () => (steps[at + 1]?.id === "done" ? finish({ via: "end" }) : setAt(at + 1));

  useLayoutEffect(() => {
    if (!step) return;
    posthog.capture("tour_step", { tour: "cash", step: step.id, position: at + 1 });
    if (step.id === "done") posthog.capture("tour_done_shown", { tour: "cash" });
  }, [step]);
  useLayoutEffect(() => { nextRef.current?.focus({ preventScroll: true }); }, [step]);

  if (!step) return null;

  const frame = { background: WHITE, border: "1.5px solid rgba(22,47,36,0.12)", borderRadius: "18px", boxShadow: "0 10px 30px rgba(22,47,36,0.25)" };
  const card = { ...frame, padding: "18px 18px 14px", fontFamily: SANS };
  const quiet = { background: "none", border: "none", padding: "8px 0", minHeight: "44px", color: MUT, fontSize: "13px", fontWeight: 600, fontFamily: SANS, cursor: "pointer" };
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
        <SaveFiguresOffer d={d} moduleKey="cash" rateCost={rateCost} source="tour" style={{ ...frame, marginTop: 0 }}
          onEmail={(email, name) => { onEmail(email, name); finish({ via: "email" }); }}>
          <div style={{ textAlign: "center", marginTop: "2px" }}><button ref={nextRef} type="button" style={quiet} onClick={() => finish({ via: "email_declined" })}>Not now</button></div>
        </SaveFiguresOffer>
      </div>
    );
  } else if (step.id === "done") {
    content = <CheckedCardBody moduleKey="cash" onDone={() => { close(); onDone?.(); }} buttonRef={nextRef}/>;
  } else {
    content = (
      <div style={card}>
        <PageDots position={step.position} total={step.of} from={step.position - 1} style={{ marginBottom: "14px" }}/>
        <h2 id="tour-title" style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 700, color: G, margin: 0, lineHeight: 1.25 }}>{step.title}</h2>
        <p style={{ fontSize: "14.5px", color: TEXT, lineHeight: 1.55, margin: "8px 0 0" }}>{step.body}</p>
        {step.id === "fund" && (
          <div style={{ marginTop: "12px" }}>
            <PillSlider compact label="Emergency fund target" value={String(m.bufferMonths)} options={EMERGENCY_MONTHS_OPTIONS} onChange={v => {
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
    <TourOverlay target={step.target || null} round={step.round} stepKey={step.id} onMissing={next}
      onEscape={() => (step.id === "done" ? close() : end("skipped"))}
      labelledBy={step.id === "email" ? undefined : step.id === "done" ? "checked-title" : "tour-title"} label={step.id === "email" ? "Email" : undefined}>
      {content}
    </TourOverlay>
  );
}
