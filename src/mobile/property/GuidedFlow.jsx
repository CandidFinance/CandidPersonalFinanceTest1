import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft } from "lucide-react";
import { G, MUT, TEXT, SERIF, WHITE, CDARK, PILL_HEIGHT } from "../../CandidApp.jsx";
import { capField } from "../../lib/onboarding.js";
import { neededAtStart, visibleQuestions } from "../../lib/propertyGuide.js";
import PillMoneyInput, { pillFieldStyle } from "../PillMoneyInput.jsx";

// A step's guided first pass: one question per screen under the step's
// result card, which fills in as the answers go in. The card is `result`
// when given; Mortgage and Rent vs buy instead show this in place of their
// inputs, under their own card. Questions and
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

// `onAnswered(id)` runs as each question is answered, so the screen can
// reveal a result card it's holding back (STEP_GUIDES.holdResultUntil).
// `skipLabel` is the link for leaving early; null for a flow that can't be
// skipped (the app's entry questions).
//
// Besides "choice", "money", "percent" and "years", the app's entry uses
// "multi" (several answers, then Continue; an `exclusive` option clears the
// rest) and "text" (a typed answer such as a name). "info" tells the user
// something worked out from their answers (e.g. their student loan plan),
// with just Continue.
// `showProgress` hides "1 of N" for a single question asked on its own (the
// confidence check). `animateFirst` has the first question rise in too, for
// a flow arrived at from another page of questions (the entry, after the
// confidence check), so the movement carries on across the page change.
// A "custom" question (e.g. the list of savings accounts) is drawn by
// `renderers[q.render]({ d, set })`, with q.answered(ctx) saying whether
// Continue can be pressed.
export default function GuidedFlow({ questions, d, m, set, regionalRows, result, onDone, onAnswered, skipLabel = "Skip to the full view", showProgress = true, animateFirst = false, renderers = {} }) {
  const ctx = { d, m, regionalRows };
  // Which questions with `ifMissing` to ask is decided once, at the start.
  const [needed] = useState(() => neededAtStart(questions, ctx));
  const visible = visibleQuestions(questions, ctx, needed);
  const [history, setHistory] = useState(() => [visible[0]?.id]);
  const [direction, setDirection] = useState(1);
  const [answered, setAnswered] = useState(() => new Set());
  const reduceMotion = useReducedMotion();

  const textLink = { background:"none", border:"none", padding:"6px 0", color:G, fontSize:"13px", fontWeight:700, fontFamily:"inherit", cursor:"pointer" };
  const primary = {
    width:"100%", background:G, color:WHITE, border:"none", borderRadius:"100px", padding:"13px",
    fontSize:"14px", fontWeight:700, fontFamily:"inherit", cursor:"pointer",
  };

  const currentId = history[history.length - 1];
  const q = visible.find(x => x.id === currentId) || visible[0];
  const position = visible.findIndex(x => x.id === q.id) + 1;

  // Back up to the result card if the page has scrolled (e.g. down the
  // region list), so each answer is seen landing in it.
  const showResult = () => {
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  // `patch` is the answer just given: set() lands on the next render, so the
  // next question is chosen as if it already had.
  const next = patch => {
    setAnswered(a => new Set(a).add(q.id));
    onAnswered?.(q.id);
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
  // The question's own field, plus any others its answer sets (`also`).
  // Returns everything written, so the next question can be chosen as if it
  // had all landed.
  const write = (field, value) => {
    const patch = { [field]: value, ...(q.also ? q.also(value, ctx) : {}) };
    Object.entries(patch).forEach(([k, v]) => set(k, v));
    return patch;
  };

  const choose = value => next(write(q.field, value));
  const notSure = q.notSure ? q.notSure(ctx) : null;
  const takeNotSure = () => next(notSure.value !== undefined ? write(q.field, notSure.value) : {});
  const picked = Array.isArray(d[q.field]) ? d[q.field] : [];
  const toggle = o => {
    const on = picked.includes(o.value);
    const exclusive = q.options(ctx).filter(x => x.exclusive).map(x => x.value);
    write(q.field, on ? picked.filter(v => v !== o.value)
      : o.exclusive ? [o.value]
      : [...picked.filter(v => !exclusive.includes(v)), o.value]);
  };

  const raw = d[q.field];
  const hasAnswer = q.kind === "multi" ? picked.length > 0
    : q.kind === "text" ? typeof raw === "string" && raw.trim() !== ""
    : q.kind === "custom" ? (q.answered ? q.answered(ctx) : true)
    : q.kind === "info" ? true
    : raw !== "" && raw != null && !isNaN(+raw);
  const continueButton = (
    <button type="submit" disabled={q.required && !hasAnswer} style={{
      ...primary, marginTop:"16px",
      background:q.required && !hasAnswer ? "rgba(22,47,36,0.2)" : G, cursor:q.required && !hasAnswer ? "not-allowed" : "pointer",
    }}>Continue</button>
  );
  const submit = e => { e.preventDefault(); if (hasAnswer || !q.required) next({}); };
  const note = q.note ? q.note(ctx) : null;
  const shift = reduceMotion ? 0 : SHIFT_PX;
  const variants = {
    enter: dir => ({ opacity: 0, y: dir * shift }),
    center: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
    exit: dir => ({ opacity: 0, y: -dir * shift, transition: { duration: 0.15, ease: "easeIn" } }),
  };
  const answerButton = selected => ({
    display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px", textAlign:"left", width:"100%",
    background:selected ? "rgba(22,47,36,0.06)" : WHITE, border:`1.5px solid ${selected ? G : "rgba(22,47,36,0.15)"}`,
    borderRadius:"14px", padding:"13px 16px", fontSize:"14.5px", fontWeight:600, color:TEXT, fontFamily:"inherit", cursor:"pointer",
  });

  return (
    <div>
      {result}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:result ? "22px" : 0}}>
        <span style={{fontSize:"11.5px",fontWeight:600,color:MUT}}>{showProgress ? `${position} of ${visible.length}` : ""}</span>
        {skipLabel && <button type="button" onClick={() => onDone("skipped", q.id)} style={{...textLink,fontSize:"12.5px"}}>{skipLabel}</button>}
      </div>

      <AnimatePresence mode="wait" custom={direction} initial={animateFirst}>
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
                  <button key={o.value} type="button" onClick={() => choose(o.value)} style={answerButton(selected)}>
                    {o.label}
                    {selected && <Check size={16} color={G}/>}
                  </button>
                );
              })}
              {note && <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"2px 0 0"}}>{note}</p>}
            </div>
          ) : q.kind === "multi" ? (
            <form onSubmit={submit}>
              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                {q.options(ctx).map(o => {
                  const selected = picked.includes(o.value);
                  return (
                    <button key={o.value} type="button" aria-pressed={selected} onClick={() => toggle(o)} style={answerButton(selected)}>
                      {o.label}
                      {selected && <Check size={16} color={G}/>}
                    </button>
                  );
                })}
                {note && <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"2px 0 0"}}>{note}</p>}
              </div>
              {continueButton}
            </form>
          ) : q.kind === "info" ? (
            <form onSubmit={submit}>
              {note && <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:0}}>{note}</p>}
              {continueButton}
            </form>
          ) : q.kind === "custom" ? (
            <form onSubmit={submit}>
              {renderers[q.render]?.({ d, set })}
              {note && <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>{note}</p>}
              {continueButton}
            </form>
          ) : q.kind === "text" ? (
            <form onSubmit={submit}>
              <label style={{background:CDARK,borderRadius:"100px",padding:"0 16px",height:PILL_HEIGHT,boxSizing:"border-box",display:"flex",flexDirection:"column",justifyContent:"center",cursor:"text"}}>
                <span style={{fontSize:"9.5px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase"}}>{q.label}</span>
                <input type="text" autoFocus autoComplete="given-name" value={raw || ""} onChange={e => write(q.field, e.target.value)}
                  style={{border:"none",background:"none",color:TEXT,outline:"none",padding:0,...pillFieldStyle("100%")}}/>
              </label>
              {continueButton}
            </form>
          ) : (
            <form onSubmit={submit}>
              <PillMoneyInput label={q.label} unit={{ percent:"%", years:"" }[q.kind] ?? "£"}
                value={hasAnswer ? +raw : (q.prefill ? q.prefill(ctx) : null)}
                onChange={v => write(q.field, q.cap ? capField(q.cap, v ?? "") : (v ?? ""))}/>
              {note && <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>{note}</p>}
              {continueButton}
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
