import { useState, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft } from "lucide-react";
import { G, MUT, TEXT, SERIF, WHITE } from "../../CandidApp.jsx";
import { capField } from "../../lib/onboarding.js";
import { neededAtStart, visibleQuestions } from "../../lib/propertyGuide.js";
import PillMoneyInput from "../PillMoneyInput.jsx";

// A step's guided first pass: one question per screen under the step's
// result card (`result`), which fills in as the answers go in. Questions and
// the rules for which are asked are in src/lib/propertyGuide.js. Choices
// answer and move on in one tap; £ and % answers have a Continue button
// (the keyboard's Go/Enter does the same). Each answer is saved as it's
// given, to the same input the step's own fields use. `onDone(how, at)` runs
// on finishing ("finished") or leaving early ("skipped", at a question id).
//
// Questions move up and out as the next rises from below, back the other
// way on Back: about 30px with a fade, not the full screen, so it stays
// quick by the tenth question. Just a fade with reduced motion on.

const SHIFT_PX = 30;

export default function GuidedFlow({ questions, d, m, set, regionalRows, result, onDone }) {
  const ctx = { d, m, regionalRows };
  // Which questions with `ifMissing` to ask is decided once, at the start.
  const [needed] = useState(() => neededAtStart(questions, ctx));
  const visible = visibleQuestions(questions, ctx, needed);
  const [history, setHistory] = useState(() => [visible[0]?.id]);
  const [direction, setDirection] = useState(1);
  const [answered, setAnswered] = useState(() => new Set());
  const reduceMotion = useReducedMotion();
  const topRef = useRef(null);

  const currentId = history[history.length - 1];
  const q = visible.find(x => x.id === currentId) || visible[0];
  const position = visible.findIndex(x => x.id === q.id) + 1;

  // Back to the result card if it has scrolled away, so each answer is seen
  // landing in it.
  const showResult = () => {
    if (topRef.current && topRef.current.getBoundingClientRect().top < 0) window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  // `patch` is the answer just given: set() lands on the next render, so the
  // next question is chosen as if it already had.
  const next = patch => {
    setAnswered(a => new Set(a).add(q.id));
    const after = visibleQuestions(questions, { ...ctx, d: { ...d, ...patch } }, needed);
    const following = after[after.findIndex(x => x.id === q.id) + 1];
    if (!following) { onDone("finished"); return; }
    setDirection(1);
    setHistory(h => [...h, following.id]);
    showResult();
  };
  const back = () => {
    setDirection(-1);
    setHistory(h => h.slice(0, -1));
  };
  const write = (field, value) => set(field, value);

  const choose = value => { write(q.field, value); next({ [q.field]: value }); };
  const notSure = q.notSure ? q.notSure(ctx) : null;
  const takeNotSure = () => {
    if (notSure.value !== undefined) write(q.field, notSure.value);
    next(notSure.value !== undefined ? { [q.field]: notSure.value } : {});
  };

  const raw = d[q.field];
  const hasAnswer = raw !== "" && raw != null && !isNaN(+raw);
  const note = q.note ? q.note(ctx) : null;
  const shift = reduceMotion ? 0 : SHIFT_PX;
  const variants = {
    enter: dir => ({ opacity: 0, y: dir * shift }),
    center: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
    exit: dir => ({ opacity: 0, y: -dir * shift, transition: { duration: 0.15, ease: "easeIn" } }),
  };
  const textLink = { background:"none", border:"none", padding:"6px 0", color:G, fontSize:"13px", fontWeight:700, fontFamily:"inherit", cursor:"pointer" };
  const primary = {
    width:"100%", background:G, color:WHITE, border:"none", borderRadius:"100px", padding:"13px",
    fontSize:"14px", fontWeight:700, fontFamily:"inherit", cursor:"pointer",
  };

  return (
    <div ref={topRef}>
      {result}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"22px"}}>
        <span style={{fontSize:"11.5px",fontWeight:600,color:MUT}}>{position} of {visible.length}</span>
        <button type="button" onClick={() => onDone("skipped", q.id)} style={{...textLink,fontSize:"12.5px"}}>Skip to the full view</button>
      </div>

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div key={q.id} custom={direction} variants={variants} initial="enter" animate="center" exit="exit" style={{marginTop:"10px"}}>
          {q.lead && (
            <div style={{fontSize:"10.5px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"8px"}}>{q.lead}</div>
          )}
          <h2 style={{fontFamily:SERIF,fontSize:"21px",fontWeight:700,color:TEXT,lineHeight:1.3,margin:0}}>{q.ask(ctx)}</h2>
          <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,margin:"8px 0 18px"}}>{q.why(ctx)}</p>

          {q.kind === "choice" ? (
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {q.options(ctx).map(o => {
                const selected = answered.has(q.id) && d[q.field] === o.value;
                return (
                  <button key={o.value} type="button" onClick={() => choose(o.value)} style={{
                    display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px", textAlign:"left",
                    background:selected ? "rgba(22,47,36,0.06)" : WHITE, border:`1.5px solid ${selected ? G : "rgba(22,47,36,0.15)"}`,
                    borderRadius:"14px", padding:"13px 16px", fontSize:"14.5px", fontWeight:600, color:TEXT, fontFamily:"inherit", cursor:"pointer",
                  }}>
                    {o.label}
                    {selected && <Check size={16} color={G}/>}
                  </button>
                );
              })}
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); if (hasAnswer || !q.required) next({}); }}>
              <PillMoneyInput label={q.label} unit={q.kind === "percent" ? "%" : "£"}
                value={hasAnswer ? +raw : (q.prefill ? q.prefill(ctx) : null)}
                onChange={v => write(q.field, q.cap ? capField(q.cap, v ?? "") : (v ?? ""))}/>
              {note && <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>{note}</p>}
              <button type="submit" disabled={q.required && !hasAnswer} style={{
                ...primary, marginTop:"16px",
                background:q.required && !hasAnswer ? "rgba(22,47,36,0.2)" : G, cursor:q.required && !hasAnswer ? "not-allowed" : "pointer",
              }}>Continue</button>
            </form>
          )}

          {notSure && (
            <div style={{textAlign:"center",marginTop:"10px"}}>
              <button type="button" onClick={takeNotSure} style={textLink}>{notSure.label}</button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {history.length > 1 && (
        <button type="button" onClick={back} style={{...textLink,color:MUT,display:"inline-flex",alignItems:"center",gap:"2px",marginTop:"14px"}}>
          <ChevronLeft size={15}/>Back
        </button>
      )}
    </div>
  );
}
