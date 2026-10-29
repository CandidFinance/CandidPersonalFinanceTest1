import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import posthog from "posthog-js";
import { G, MUT, TEXT, SERIF, SANS, WHITE } from "../../design-tokens.js";
import { getConsent } from "../../lib/consent.js";
import { PageDots } from "./OnboardingShell.jsx";
import TourOverlay, { targetOf } from "./TourOverlay.jsx";

// The app's tour, once, the first time Home opens: Home, Progress and
// Modules, a stop or two on each, lighting up one part of the page (marked
// `data-tour="..."`) with a card beside it. Between screens it acts out a tap
// on the tab and the page changes under it. Describes what's on each screen;
// never says what to do with it. A stop whose part isn't on the page is left
// out. `d.appTourDone` as soon as it starts, so it's never shown twice, even
// if left part-way; the parent keeps it on screen until `onClose`.

const PATH = { home: "/app/home", progress: "/app/progress", modules: "/app/modules" };

const STOPS = [
  { id: "welcome", screen: "home", target: null, title: "A quick look round",
    body: "Three screens hold everything: Home, Progress and Modules. This takes about 30 seconds." },
  { id: "score", screen: "home", target: "home-score", title: "Your Candid score",
    body: scoreShowing => scoreShowing
      ? "What's left on the table each year, and what you've saved so far. Tap the card to turn it over."
      : "Your score appears once the modules you picked are answered." },
  { id: "next", screen: "home", target: "home-modules", title: "Modules to explore",
    body: "Areas you haven't looked at yet. Each takes a few minutes." },
  { id: "progress", screen: "progress", target: "progress-cards", title: "Your progress",
    body: "Net worth, goals for this tax year and your tax shield. Swipe for the next card." },
  { id: "goals", screen: "progress", target: "progress-goals", title: "Goals",
    body: "Goals you set yourself, and one from each module once it's answered." },
  { id: "modules", screen: "modules", target: "modules-cards", title: "Every module",
    body: "Each module in one place, with what it's worth a year and where it stands." },
  { id: "assist", screen: "modules", target: "assist", round: true, title: "Ask a question",
    body: "Ask about your figures at any time. It's on every page." },
  { id: "done", screen: "modules", target: null, title: "That's the tour",
    body: "Everything here updates as you answer more modules." },
];

const MOVE = 450;   // the light gliding to the tab
const TAP = 300;    // the tap itself
const WAIT = 1500;  // longest wait for the new page's part

// `screen`: the tab on show ("home", "progress" or "modules").
// `scoreShowing`: whether Home has the score yet. `onStart` once it's begun,
// `onClose` once it's off the screen. `returnTo`: the module page it was sent
// from (a first answer's Done), where Done or Skip goes back to.
export default function AppTour({ screen, scoreShowing, set, returnTo, onStart, onClose }) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [steps, setSteps] = useState(null);
  const [at, setAt] = useState(0);
  // "show": the step's card. "move" and "tap": on the way to another
  // screen's tab. "wait": the new screen coming in.
  const [phase, setPhase] = useState("show");
  const [toTab, setToTab] = useState(null);
  const nextRef = useRef(null);
  const ended = useRef(false);
  const lastPosition = useRef(null);
  const timers = useRef([]);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  // Once Home has laid out and the cookie notice is answered (it sits over
  // the tab bar): Home's stops it has parts for, and the rest (the other
  // screens' parts are checked as they come in).
  useEffect(() => {
    const t = setInterval(() => {
      if (getConsent() === null) return;
      clearInterval(t);
      setSteps(STOPS.filter(s => s.screen !== "home" || !s.target || targetOf(s.target)));
      set("appTourDone", true);
      onStart?.();
    }, 400);
    return () => clearInterval(t);
  }, []);

  // Left mid-way (a page outside the three): counted as skipped, and off the
  // screen for good. Gone before it began (Assist opened first): nothing.
  const leftAt = useRef(null);
  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    if (!ended.current && leftAt.current) { ended.current = true; posthog.capture("tour_skipped", { tour: "app", at: leftAt.current, via: "left" }); }
    onClose?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const step = steps?.[at] || null;
  leftAt.current = step?.id;

  const record = (how, extra = {}) => {
    if (ended.current) return;
    ended.current = true;
    posthog.capture(how === "skipped" ? "tour_skipped" : "tour_finished", { tour: "app", at: step?.id, ...extra });
  };
  const close = () => onClose?.();
  const toModule = () => { if (returnTo) { navigate(returnTo); window.scrollTo({ top: 0 }); } };
  const end = how => { record(how); close(); toModule(); };

  // To step `i`: on this screen, straight there; on another, the tap on its
  // tab first (forward), or straight to the page (back).
  const goTo = (i, { tap = true, from = "show", list = steps } = {}) => {
    const to = list[i];
    // Once at a time: a second Next mid-move is ignored.
    if (!to || phase !== from) return;
    if (to.id === "done") record("finished", { via: "end" });
    if (to.screen === screen) { setAt(i); setPhase("show"); return; }
    setToTab(to.screen);
    const arrive = () => {
      navigate(PATH[to.screen]);
      window.scrollTo({ top: 0 });
      setAt(i);
      setPhase("wait");
    };
    if (!tap || reduce) { arrive(); return; }
    setPhase("move");
    later(() => setPhase("tap"), MOVE);
    later(arrive, MOVE + TAP);
  };
  const next = () => goTo(at + 1);
  const back = () => goTo(at - 1, { tap: false });

  // The new screen in: its part found (or not: the stop's left out, so the
  // dots don't count it, and on to the next).
  useEffect(() => {
    if (phase !== "wait" || !step || step.screen !== screen) return;
    const started = Date.now();
    let frame = requestAnimationFrame(function look() {
      if (!step.target || targetOf(step.target)) { setPhase("show"); return; }
      if (Date.now() - started > WAIT) {
        const rest = steps.filter((_, j) => j !== at);
        setSteps(rest);
        goTo(at, { tap: false, from: "wait", list: rest });
        return;
      }
      frame = requestAnimationFrame(look);
    });
    return () => cancelAnimationFrame(frame);
  }, [phase, step, screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Moved to another tab some other way (the browser's back): the tour
  // stops, counted as skipped.
  useEffect(() => {
    if (phase === "show" && step && step.screen !== screen) { record("skipped", { via: "navigated" }); close(); }
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const showing = phase === "show" && step;
  useLayoutEffect(() => {
    if (!showing) return;
    posthog.capture("tour_step", { tour: "app", step: step.id, position: at + 1 });
    nextRef.current?.focus({ preventScroll: true });
  }, [showing, step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!step) return null;

  const card = { background: WHITE, border: "1.5px solid rgba(22,47,36,0.12)", borderRadius: "18px", boxShadow: "0 10px 30px rgba(22,47,36,0.25)", padding: "18px 18px 14px", fontFamily: SANS };
  const quiet = { background: "none", border: "none", padding: "8px 0", minHeight: "44px", color: MUT, fontSize: "13px", fontWeight: 600, fontFamily: SANS, cursor: "pointer" };
  const main = { background: G, color: WHITE, border: "none", borderRadius: "100px", padding: "11px 22px", fontSize: "14.5px", fontWeight: 700, fontFamily: SANS, cursor: "pointer" };
  const backButton = { ...main, background: "none", color: G, border: `1.5px solid rgba(22,47,36,0.18)`, padding: "9.5px 18px" };

  const done = step.id === "done";
  // The closing card, by Done or Escape: back to the module it was sent from,
  // or else to Home, where it began.
  const finish = () => { close(); navigate(returnTo || PATH.home); window.scrollTo({ top: 0 }); };
  // The dots count the stops, not the closing card.
  const position = at + 1, total = steps.length - 1;
  const from = lastPosition.current;
  if (showing) lastPosition.current = position;
  const body = typeof step.body === "function" ? step.body(scoreShowing) : step.body;

  // Kept while it moves on (out of sight), so focus stays in the card.
  const content = (
    <div style={card}>
      {!done && <PageDots position={position} total={total} from={from} style={{ marginBottom: "14px" }}/>}
      <h2 id="tour-title" style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 700, color: G, margin: 0, lineHeight: 1.25 }}>{step.title}</h2>
      <p style={{ fontSize: "14.5px", color: TEXT, lineHeight: 1.55, margin: "8px 0 0" }}>{body}</p>
      {done ? (
        <button ref={nextRef} type="button" style={{ ...main, width: "100%", padding: "14px", marginTop: "14px" }} onClick={finish}>Done</button>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px" }}>
          <button type="button" style={quiet} onClick={() => end("skipped")}>Skip tour</button>
          <div style={{ display: "flex", gap: "8px" }}>
            {at > 0 && <button type="button" style={backButton} onClick={back}>Back</button>}
            <button ref={nextRef} type="button" style={main} onClick={next}>Next</button>
          </div>
        </div>
      )}
    </div>
  );

  // On the way between screens the light sits on the tab being tapped.
  const moving = phase !== "show";
  return (
    <TourOverlay target={moving ? (toTab ? `tab-${toTab}` : null) : step.target} round={!moving && step.round}
      stepKey={moving ? `tab-${toTab}` : step.id} press={phase === "tap"} hidden={moving}
      onMissing={() => (moving ? null : goTo(at + 1, { tap: false }))}
      onEscape={() => (done ? finish() : end("skipped"))} labelledBy="tour-title">
      {content}
    </TourOverlay>
  );
}
