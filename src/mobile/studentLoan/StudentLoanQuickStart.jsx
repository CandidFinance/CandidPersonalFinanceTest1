import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { G, MUT, TEXT, SERIF, SANS, WHITE } from "../../design-tokens.js";
import { PLAN_CHOICES, PLAN_HELPER_CHOICES, SALARY_BANDS, BALANCE_BANDS, finishBands, helperChoicePlan, quickQuestions, quickPatch } from "../../lib/studentLoanQuick.js";

// Student loan's first visit: what's at stake, then a question per screen,
// each answered in one tap from a band (src/lib/studentLoanQuick.js). The
// last answer writes the figures (`onPatch`) and hands over to the usual
// answer: `onDone("finished")` once they've landed in `d`, so the answer is
// chosen from them; `onDone("skipped", questionId)` to leave early.
// Each question's PostHog events match GuidedFlow's ("questions_started",
// "question_answered"), with flow "quick".

const TRACK = { flow: "quick", module: "studentLoan" };
// Long enough to see the pill change colour before the next question.
const ADVANCE_MS = 380;

const QUESTIONS = {
  plan:    { ask: "Which student loan plan are you on?", why: "Your Student Loans Company account shows it.", options: () => PLAN_CHOICES },
  helper:  { ask: "When did your course start?", why: "That decides your plan, by GOV.UK's rules.", options: () => PLAN_HELPER_CHOICES },
  salary:  { ask: "Roughly what do you earn a year, before tax?", why: "Repayments are a share of your pay over a threshold.", options: () => SALARY_BANDS },
  balance: { ask: "Roughly how much do you still owe?", why: "Your Student Loans Company account shows it. A band is fine.", options: () => BALANCE_BANDS },
  finish:  { ask: "When did you finish your course?", why: "Whatever's left is written off a set number of years after.", options: plan => finishBands(plan) },
};

export default function StudentLoanQuickStart({ d, onDone, onPatch }) {
  const reduceMotion = useReducedMotion();
  const [asked] = useState(() => quickQuestions(d));
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [history, setHistory] = useState([]);
  const [picked, setPicked] = useState(null);
  const [direction, setDirection] = useState(1);
  // When the figures were written (slEstimate.at): done once d has them.
  const [written, setWritten] = useState(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => { posthog.capture("intro_shown", TRACK); }, []);
  useEffect(() => { if (written && d.slEstimate?.at === written) doneRef.current("finished"); }, [written, d.slEstimate]);

  // The questions still to come, given the answers so far: "Not sure" of
  // the plan adds the start-date question after it.
  const order = asked.flatMap(id => id === "plan" && answers.plan === "unsure" ? ["plan", "helper"] : [id]);
  const current = history[history.length - 1] ?? order[0];
  const position = order.indexOf(current) + 1;
  const plan = answers.plan === "unsure" ? helperChoicePlan(answers.helper) : answers.plan || d.studentLoan;

  const begin = () => {
    posthog.capture("questions_started", { ...TRACK, question: order[0], of: order.length });
    if (!order.length) { finish({}); return; }
    setStarted(true);
    setHistory([order[0]]);
  };
  const finish = all => {
    const patch = quickPatch(d, all);
    patch.slEstimate = { ...patch.slEstimate, at: Date.now() };
    onPatch(patch);
    setWritten(patch.slEstimate.at);
  };
  const choose = value => {
    if (picked) return;
    setPicked(value);
    const all = { ...answers, [current]: value };
    posthog.capture("question_answered", { ...TRACK, question: current, position, of: order.length });
    setTimeout(() => {
      setAnswers(all);
      setPicked(null);
      const nextOrder = asked.flatMap(id => id === "plan" && all.plan === "unsure" ? ["plan", "helper"] : [id]);
      const next = nextOrder[nextOrder.indexOf(current) + 1];
      if (!next) { finish(all); return; }
      setDirection(1);
      setHistory(h => [...h, next]);
    }, reduceMotion ? 120 : ADVANCE_MS);
  };
  const back = () => {
    setDirection(-1);
    if (history.length > 1) setHistory(h => h.slice(0, -1));
    else { setStarted(false); setHistory([]); }
  };

  const shift = reduceMotion ? 0 : 36;
  const screen = { minHeight: "calc(100dvh - 150px)", display: "flex", flexDirection: "column", boxSizing: "border-box", padding: "8px 0 24px" };
  const link = { background: "none", border: "none", padding: "6px 0", color: G, fontSize: "14px", fontWeight: 700, fontFamily: SANS, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "2px" };

  if (!started) return <Intro count={order.length} onBegin={begin} screen={screen}/>;

  const q = QUESTIONS[current];
  return (
    <div style={screen}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
        <button type="button" onClick={back} style={link}><ChevronLeft size={18}/>Back</button>
        <span style={{ fontSize: "13px", color: MUT, fontWeight: 600 }}>{position} of {order.length}</span>
      </div>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div key={current} custom={direction}
          initial={{ opacity: 0, x: direction * shift }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -direction * shift }}
          transition={{ duration: reduceMotion ? 0.1 : 0.22, ease: "easeOut" }}
          style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <h1 style={{ fontFamily: SERIF, fontSize: "clamp(28px, 7.5vw, 36px)", fontWeight: 700, color: G, lineHeight: 1.15, margin: 0 }}>{q.ask}</h1>
          <p style={{ fontSize: "15px", color: MUT, lineHeight: 1.5, margin: "10px 0 24px" }}>{q.why}</p>
          <div role="radiogroup" aria-label={q.ask} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {q.options(plan).map(o => (
              <Pill key={o.value} option={o} on={picked === o.value} dim={!!picked && picked !== o.value} onPick={() => choose(o.value)} reduceMotion={reduceMotion}/>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
      <div style={{ textAlign: "center", marginTop: "22px" }}>
        <button type="button" onClick={() => onDone("skipped", current)} style={{ ...link, fontSize: "13px", color: MUT, fontWeight: 600 }}>Skip to the full view</button>
      </div>
    </div>
  );
}

// One answer: a near-square tile, two to a row, that fills green when
// tapped.
function Pill({ option, on, dim, onPick, reduceMotion }) {
  return (
    <motion.button type="button" role="radio" aria-checked={on} onClick={onPick}
      animate={{ backgroundColor: on ? G : WHITE, color: on ? WHITE : TEXT, borderColor: on ? G : "rgba(22,47,36,0.16)", opacity: dim ? 0.55 : 1, scale: on && !reduceMotion ? [1, 0.96, 1] : 1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{ minHeight: "92px", borderRadius: "20px", border: "1.5px solid", padding: "14px 12px", fontFamily: SANS, fontSize: "18px", fontWeight: 650, lineHeight: 1.2, textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px" }}>
      <span>{option.label}</span>
      {option.sub && <span style={{ fontSize: "13px", fontWeight: 500, opacity: 0.75 }}>{option.sub}</span>}
    </motion.button>
  );
}

// Before any questions: the topic, why it matters, the question it answers.
function Intro({ count, onBegin, screen }) {
  return (
    <div style={screen}>
      <h1 style={{ fontFamily: SERIF, fontSize: "clamp(44px, 13vw, 60px)", fontWeight: 700, color: G, lineHeight: 1.02, margin: "12px 0 0" }}>Student loan</h1>
      <p style={{ fontFamily: SERIF, fontSize: "clamp(22px, 6vw, 27px)", fontWeight: 500, color: TEXT, lineHeight: 1.25, margin: "16px 0 0" }}>
        After a home, it's likely the biggest thing you'll ever buy.
      </p>
      <div style={{ marginTop: "auto", paddingTop: "32px" }}>
        <p style={{ fontSize: "19px", fontWeight: 600, color: TEXT, lineHeight: 1.35, margin: "0 0 18px" }}>Is paying it off early worth it for you?</p>
        <button type="button" onClick={onBegin} style={{ width: "100%", background: G, color: WHITE, border: "none", borderRadius: "100px", padding: "18px", fontSize: "17px", fontWeight: 700, fontFamily: SANS, cursor: "pointer" }}>
          {count ? "Let's begin" : "See it"}
        </button>
      </div>
    </div>
  );
}
