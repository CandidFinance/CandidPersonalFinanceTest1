import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, Minus, Plus } from "lucide-react";
import { G, MUT, TEXT, SERIF, SANS, WHITE } from "../design-tokens.js";
import { questionOrder, askFor } from "../lib/quickStart.js";

// A module's quick start (src/lib/quickStart.js): what's at stake (the
// setup's intro, when `intro`), then a question per screen, each answered
// with one tap on a tile. The last answer writes the figures (`onPatch`) and
// hands over: `onDone("finished")` once they've landed in `d`, so the answer
// is worked out from them; `onDone("skipped", questionId)` to leave early.
// `kicker` names the module above the questions when there's no intro (the
// detailed view from another module). PostHog events match GuidedFlow's
// ("questions_started", "question_answered"), with `flow`.

// Long enough to see the tile change colour before the next question.
const ADVANCE_MS = 380;

export default function QuickStart({ setup, d, m, onPatch, onDone, intro = true, kicker = null, flow = "quick" }) {
  const reduceMotion = useReducedMotion();
  const track = { flow, module: setup.module };
  const [started, setStarted] = useState(!(intro && setup.intro));
  const [answers, setAnswers] = useState({});
  const [history, setHistory] = useState([]);
  const [picked, setPicked] = useState(null);
  const [direction, setDirection] = useState(1);
  // When the figures were written (quickAt): done once d has them.
  const [written, setWritten] = useState(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => { if (written && d.quickAt?.[setup.module] === written) doneRef.current("finished"); }, [written, d.quickAt, setup.module]);

  const order = questionOrder(setup, { d, m, a: answers });
  const current = history[history.length - 1] ?? order[0];
  const position = order.indexOf(current) + 1;

  const finish = all => {
    const stamp = Date.now();
    onPatch({ ...setup.patch(d, m, all), quickAt: { ...(d.quickAt || {}), [setup.module]: stamp } });
    setWritten(stamp);
  };
  const begin = () => {
    posthog.capture("questions_started", { ...track, question: order[0] ?? null, of: order.length });
    if (!order.length) { finish({}); return; }
    setStarted(true);
    setHistory([order[0]]);
  };
  // No intro: straight into the first question.
  useEffect(() => {
    if (started) begin();
    else posthog.capture("intro_shown", track);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // `delay`: time to see a tapped tile change colour; none after a slider's
  // Continue.
  const choose = (value, delay = reduceMotion ? 120 : ADVANCE_MS) => {
    if (picked) return;
    setPicked(value);
    const all = { ...answers, [current]: value };
    posthog.capture("question_answered", { ...track, question: current, position, of: order.length });
    setTimeout(() => {
      setAnswers(all);
      setPicked(null);
      const nextOrder = questionOrder(setup, { d, m, a: all });
      const next = nextOrder[nextOrder.indexOf(current) + 1];
      if (!next) { finish(all); return; }
      setDirection(1);
      setHistory(h => [...h, next]);
    }, delay);
  };
  const back = () => {
    setDirection(-1);
    if (history.length > 1) setHistory(h => h.slice(0, -1));
    else if (intro && setup.intro) { setStarted(false); setHistory([]); }
    else onDone("skipped", current);
  };

  const shift = reduceMotion ? 0 : 36;
  const screen = { minHeight: "calc(100dvh - 150px)", display: "flex", flexDirection: "column", boxSizing: "border-box", padding: "8px 0 24px" };
  const link = { background: "none", border: "none", padding: "6px 0", color: G, fontSize: "14px", fontWeight: 700, fontFamily: SANS, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "2px" };

  if (!started) return <Intro intro={setup.intro} onBegin={begin} screen={screen}/>;
  if (!current) return null;

  const q = setup.questions[current];
  const ctx = { d, m, a: answers };
  return (
    <div style={screen}>
      {kicker && <div style={{ fontSize: "13px", fontWeight: 700, color: MUT, marginBottom: "6px" }}>{kicker}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
        <button type="button" onClick={back} style={link}><ChevronLeft size={18}/>Back</button>
        <span style={{ fontSize: "13px", color: MUT, fontWeight: 600 }}>{position} of {order.length}</span>
      </div>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div key={current} custom={direction}
          initial={{ opacity: 0, x: direction * shift }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -direction * shift }}
          transition={{ duration: reduceMotion ? 0.1 : 0.22, ease: "easeOut" }}
          style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <h1 style={{ fontFamily: SERIF, fontSize: "clamp(28px, 7.5vw, 36px)", fontWeight: 700, color: G, lineHeight: 1.15, margin: 0 }}>{askFor(q, ctx)}</h1>
          <p style={{ fontSize: "15px", color: MUT, lineHeight: 1.5, margin: "10px 0 24px" }}>{q.why}</p>
          {q.kind === "slider"
            ? <SliderAnswer q={q} ctx={ctx} label={askFor(q, ctx)} onAnswer={value => choose(value, 0)}/>
            : (
              <div role="radiogroup" aria-label={askFor(q, ctx)} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {q.options(ctx).map((o, i, all) => (
                  <Tile key={o.value} option={o} compact={all.length > 6} on={picked === o.value} dim={!!picked && picked !== o.value} onPick={() => choose(o.value)} reduceMotion={reduceMotion}/>
                ))}
              </div>
            )}
        </motion.div>
      </AnimatePresence>
      <div style={{ textAlign: "center", marginTop: "22px" }}>
        <button type="button" onClick={() => onDone("skipped", current)} style={{ ...link, fontSize: "13px", color: MUT, fontWeight: 600 }}>Skip to the full view</button>
      </div>
    </div>
  );
}

// A percentage on a slider: the figure large, what it comes to in £ under
// it as it moves (`q.live`), steps either side, then Continue; "Not sure"
// answers "unsure".
function SliderAnswer({ q, ctx, label, onAnswer }) {
  const [value, setValue] = useState(() => q.start(ctx));
  const clamp = v => Math.min(q.max, Math.max(q.min, v));
  const live = q.live?.(ctx, value);
  const step = { width: "48px", height: "48px", borderRadius: "50%", border: "1.5px solid rgba(22,47,36,0.18)", background: WHITE, color: G, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "8px" }}>
      <div aria-live="polite" style={{ fontFamily: SERIF, fontSize: "clamp(72px, 22vw, 96px)", fontWeight: 700, color: G, lineHeight: 1 }}>{value}%</div>
      <div style={{ fontSize: "16px", color: MUT, minHeight: "24px", margin: "10px 0 22px", textAlign: "center" }}>{live}</div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%" }}>
        <button type="button" aria-label="Less" onClick={() => setValue(v => clamp(v - 1))} style={step}><Minus size={20}/></button>
        <input type="range" min={q.min} max={q.max} step={1} value={value} aria-label={label}
          onChange={e => setValue(+e.target.value)}
          style={{ flex: 1, accentColor: G, height: "32px", cursor: "pointer" }}/>
        <button type="button" aria-label="More" onClick={() => setValue(v => clamp(v + 1))} style={step}><Plus size={20}/></button>
      </div>
      <button type="button" onClick={() => onAnswer(String(value))} style={{ width: "100%", marginTop: "26px", background: G, color: WHITE, border: "none", borderRadius: "100px", padding: "17px", fontSize: "17px", fontWeight: 700, fontFamily: SANS, cursor: "pointer" }}>Continue</button>
      <button type="button" onClick={() => onAnswer("unsure")} style={{ background: "none", border: "none", padding: "12px", color: G, fontSize: "15px", fontWeight: 700, fontFamily: SANS, cursor: "pointer" }}>Not sure</button>
    </div>
  );
}

// One answer: a near-square tile, two to a row, that fills green when
// tapped. `compact`: shorter, for a question with more than six answers, so
// they fit on a phone's screen.
function Tile({ option, compact, on, dim, onPick, reduceMotion }) {
  return (
    <motion.button type="button" role="radio" aria-checked={on} onClick={onPick}
      animate={{ backgroundColor: on ? G : WHITE, color: on ? WHITE : TEXT, borderColor: on ? G : "rgba(22,47,36,0.16)", opacity: dim ? 0.55 : 1, scale: on && !reduceMotion ? [1, 0.96, 1] : 1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{ minHeight: compact ? "70px" : "92px", borderRadius: "20px", border: "1.5px solid", padding: "14px 12px", fontFamily: SANS, fontSize: "18px", fontWeight: 650, lineHeight: 1.2, textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px" }}>
      <span>{option.label}</span>
      {option.sub && <span style={{ fontSize: "13px", fontWeight: 500, opacity: 0.75 }}>{option.sub}</span>}
    </motion.button>
  );
}

// Before any questions: the topic, why it matters, the question it answers.
function Intro({ intro, onBegin, screen }) {
  return (
    <div style={screen}>
      <h1 style={{ fontFamily: SERIF, fontSize: "clamp(44px, 13vw, 60px)", fontWeight: 700, color: G, lineHeight: 1.02, margin: "12px 0 0" }}>{intro.title}</h1>
      <p style={{ fontFamily: SERIF, fontSize: "clamp(22px, 6vw, 27px)", fontWeight: 500, color: TEXT, lineHeight: 1.25, margin: "16px 0 0" }}>{intro.subtitle}</p>
      <div style={{ marginTop: "auto", paddingTop: "32px" }}>
        <p style={{ fontSize: "19px", fontWeight: 600, color: TEXT, lineHeight: 1.35, margin: "0 0 18px" }}>{intro.question}</p>
        <button type="button" onClick={onBegin} style={{ width: "100%", background: G, color: WHITE, border: "none", borderRadius: "100px", padding: "18px", fontSize: "17px", fontWeight: 700, fontFamily: SANS, cursor: "pointer" }}>
          Let's begin
        </button>
      </div>
    </div>
  );
}
