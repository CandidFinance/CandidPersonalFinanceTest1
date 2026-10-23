import { useState, useRef, useEffect } from "react";
import posthog from "posthog-js";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { G, MUT, TEXT, WHITE, CDARK, PILL_HEIGHT } from "../../design-tokens.js";
import { ShellTopRow, QuestionHeading, AnswerGroup, AnswerTile, PrimaryButton, SkipLink, tileLayout } from "../onboarding/OnboardingShell.jsx";
import { capField } from "../../lib/onboarding.js";
import { neededAtStart, visibleQuestions, countSettled } from "../../lib/propertyGuide.js";
import PillMoneyInput, { pillFieldStyle } from "../PillMoneyInput.jsx";
import YearPicker, { yearInRange } from "../YearPicker.jsx";
import WheelPicker from "../WheelPicker.jsx";

// A question's lowest allowed answer: a number, or worked out from the answers.
const minFor = (q, ctx) => typeof q.min === "function" ? q.min(ctx) : q.min;

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
// `track` ({ flow, module, ... }) records the walk-through in PostHog:
// "questions_started" once, then "question_answered" for each answer, with
// the question's id and position, so drop-off can be seen question by
// question. Named `question` and `position`, not `at` or `step`: PostHog has
// those typed as numbers from other events, which hides text ids.
// `showProgress` hides "1 of N" for a single question asked on its own (the
// confidence check). `animateFirst` has the first question rise in too, for
// a flow arrived at from another page of questions (the entry, after the
// confidence check), so the movement carries on across the page change.
// A "custom" question or follow-up (e.g. the list of savings accounts) is
// drawn by `renderers[render]({ d, set })`, with answered(ctx) saying
// whether Continue can be pressed.
export default function GuidedFlow({ questions, d, m, set, regionalRows, result, onDone, onAnswered, track = null, skipLabel = "Skip to the full view", showProgress = true, animateFirst = false, renderers = {} }) {
  const ctx = { d, m, regionalRows };
  // Which questions with `ifMissing` to ask is decided once, at the start.
  const [needed] = useState(() => neededAtStart(questions, ctx));
  const visible = visibleQuestions(questions, ctx, needed);
  const [history, setHistory] = useState(() => [visible[0]?.id]);
  const [direction, setDirection] = useState(1);
  const [answered, setAnswered] = useState(() => new Set());
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (track && visible.length) posthog.capture("questions_started", { ...track, question: visible[0].id, of: visible.length });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const textLink = { background:"none", border:"none", padding:"6px 0", color:G, fontSize:"13px", fontWeight:700, fontFamily:"inherit", cursor:"pointer" };

  const currentId = history[history.length - 1];
  const q = visible.find(x => x.id === currentId) || visible[0];
  const position = visible.findIndex(x => x.id === q.id) + 1;

  // Keeps the new question in view once it has replaced the last one (run
  // when the old one has finished leaving, then after two frames so the new
  // one has been laid out). If it's all on screen already, nothing moves. If
  // the top of the page and the whole question fit on screen together, back
  // to the top, so the answer is seen landing in the result card. Otherwise
  // the screen starts at the question: on a phone, going to the top would put
  // it under the fold. The fixed tab bar ([data-tab-bar]) covers the bottom.
  const areaRef = useRef(null);
  const keepQuestionInView = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = areaRef.current;
    if (!el) return;
    const covered = document.querySelector("[data-tab-bar]")?.getBoundingClientRect().height || 0;
    const visibleBottom = window.innerHeight - covered;
    const rect = el.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom <= visibleBottom) return;
    const behavior = reduceMotion ? "auto" : "smooth";
    const top = rect.top + window.scrollY;
    if (top + rect.height <= visibleBottom) window.scrollTo({ top: 0, behavior });
    else window.scrollTo({ top: Math.max(0, top - 12), behavior });
  }));

  // `patch` is the answer just given: set() lands on the next render, so the
  // next question is chosen as if it already had.
  const next = patch => {
    setAnswered(a => new Set(a).add(q.id));
    if (track) posthog.capture("question_answered", { ...track, question: q.id, position, of: visible.length });
    // Follow-ups asked once: remembered with the question's own field.
    const onceFields = (q.follow || []).filter(f => f.once && (!f.showIf || f.showIf(ctx))).map(f => f.field)
      .filter(f => !(d.askedFields || []).includes(f));
    if (onceFields.length) {
      const askedFields = [...new Set([...(patch?.askedFields || d.askedFields || []), ...onceFields])];
      set("askedFields", askedFields);
      patch = { ...patch, askedFields };
    }
    onAnswered?.(q.id);
    // An ask-once question (one with `ifMissing`): its field is remembered
    // as asked, answered or not, so no other module asks it again.
    if (q.ifMissing && q.field && !(d.askedFields || []).includes(q.field)) {
      const askedFields = [...(patch?.askedFields || d.askedFields || []), q.field];
      set("askedFields", askedFields);
      patch = { ...patch, askedFields };
    }
    // An answer that rules out everything after it (Kids & family's "No"):
    // done.
    if (q.endIf && q.endIf(patch?.[q.field], ctx)) { onDone("finished"); return; }
    const after = visibleQuestions(questions, { ...ctx, d: { ...d, ...patch } }, needed);
    const following = after[after.findIndex(x => x.id === q.id) + 1];
    if (!following) { onDone("finished"); return; }
    setDirection(1);
    setHistory(h => [...h, following.id]);
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
  // Follow-ups (`q.follow`): questions shown below this one, on the same
  // screen, once it's answered and each one's showIf holds. Answering one
  // doesn't move on; Continue does, once every required one is answered. A
  // follow-up marked `once` is remembered as asked, like an ask-once
  // question. A follow-up's `label` is its question, a string or worked
  // out from the answers.
  const follows = (q.follow || []).filter(f => !f.showIf || f.showIf(ctx));
  const followsFor = patch => (q.follow || []).filter(f => !f.showIf || f.showIf({ ...ctx, d: { ...d, ...patch } }));
  // A choice with follow-ups: picked on this screen (so "Not sure", an empty
  // value, counts), and straight on when the pick has none to ask.
  const [chosen, setChosen] = useState(() => new Set());
  const [followPicked, setFollowPicked] = useState(() => new Set());
  const pick = value => {
    const patch = write(q.field, value);
    if (!followsFor(patch).length) { next(patch); return; }
    setChosen(c => new Set(c).add(q.id));
  };
  const writeFollow = (f, value) => {
    const v = f.cap ? capField(f.cap, value ?? "") : value;
    const patch = { [f.field]: v, ...(f.also ? f.also(v, ctx) : {}) };
    Object.entries(patch).forEach(([k, val]) => set(k, val));
  };
  const followAnswered = f => {
    if (f.kind === "custom") return f.answered ? f.answered(ctx) : true;
    const v = d[f.field];
    return v !== "" && v != null && (f.kind === "choice" || !isNaN(+v)) && (!f.yearRange || yearInRange(v, f.yearRange(ctx)));
  };
  // A year outside its range (`yearRange`) holds Continue back, even unasked-for.
  const followWrong = f => { const v = d[f.field]; return !!f.yearRange && v !== "" && v != null && !yearInRange(v, f.yearRange(ctx)); };
  // One "not sure" answer or several (Property's price: the most they could
  // afford, or the local average).
  const notSure = [q.notSure ? q.notSure(ctx) : null].flat().filter(Boolean);
  const takeNotSure = o => next(o.value !== undefined ? write(q.field, o.value) : {});
  const picked = Array.isArray(d[q.field]) ? d[q.field] : [];
  // Picking an `exclusive` option ("None of these") is the whole answer, so
  // it moves on as a single choice does, unless it opens follow-ups.
  const toggle = o => {
    const on = picked.includes(o.value);
    const exclusive = q.options(ctx).filter(x => x.exclusive).map(x => x.value);
    const patch = write(q.field, on ? picked.filter(v => v !== o.value)
      : o.exclusive ? [o.value]
      : [...picked.filter(v => !exclusive.includes(v)), o.value]);
    if (o.exclusive && !on && !followsFor(patch).length) next(patch);
  };

  const raw = d[q.field];
  const hasAnswer = q.kind === "multi" ? picked.length > 0
    : q.kind === "text" ? typeof raw === "string" && raw.trim() !== ""
    : q.kind === "custom" ? (q.answered ? q.answered(ctx) : true)
    : q.kind === "info" ? true
    : q.yearRange ? yearInRange(raw, q.yearRange(ctx))
    : raw !== "" && raw != null && !isNaN(+raw) && (minFor(q, ctx) == null || +raw >= minFor(q, ctx));
  // With follow-ups showing, every required one has to be answered too.
  const mainReady = q.follow && q.kind === "choice" ? chosen.has(q.id) || (raw !== "" && raw != null) : (hasAnswer || !q.required);
  const followsReady = (hasAnswer || (q.follow && q.kind === "choice" && mainReady)) ? follows.every(f => (!f.required || followAnswered(f)) && !followWrong(f)) : true;
  const canGo = mainReady && followsReady;
  const continueButton = <PrimaryButton type="submit" disabled={!canGo} style={{marginTop:"18px"}}>Continue</PrimaryButton>;
  const submit = e => { e.preventDefault(); if (canGo) next({}); };
  // Shown once the question above them has an answer.
  const showFollows = q.follow && (q.kind === "choice" ? mainReady : hasAnswer);
  const followBlock = showFollows && follows.length > 0 && (
    <div style={{display:"flex",flexDirection:"column",gap:"16px",marginTop:"18px"}}>
      {follows.map(f => (
        <div key={f.field}>
          <div style={{fontSize:"13.5px",fontWeight:700,color:TEXT,marginBottom:"8px"}}>{typeof f.label === "function" ? f.label(ctx) : f.label}</div>
          {f.kind === "choice" ? (
            // `columns`: in a grid, for more answers than fit in a row.
            <div style={f.columns ? {display:"grid",gridTemplateColumns:`repeat(${f.columns}, 1fr)`,gap:"8px"} : {display:"flex",flexWrap:"wrap",gap:"8px"}}>
              {f.options(ctx).map(o => {
                // An empty answer ("Not sure") shows as picked only once it's
                // been tapped, not because the field starts empty.
                const on = d[f.field] === o.value && (o.value !== "" || followPicked.has(f.field));
                return (
                  <button key={o.value} type="button" aria-pressed={on} onClick={() => { setFollowPicked(s => new Set(s).add(f.field)); writeFollow(f, o.value); }} style={{
                    flex:o.sub || f.columns ? "1 1 0" : "0 0 auto", minWidth:o.sub || f.columns ? 0 : undefined, background:on ? G : WHITE, color:on ? WHITE : TEXT,
                    border:`1.5px solid ${on ? G : "rgba(22,47,36,0.15)"}`, borderRadius:o.sub ? "14px" : "100px", padding:o.sub ? "9px 6px" : "9px 15px",
                    fontFamily:"inherit", cursor:"pointer", lineHeight:1.2, textAlign:"center",
                  }}>
                    <span style={{display:"block",fontSize:"13.5px",fontWeight:600}}>{o.label}</span>
                    {o.sub && <span style={{display:"block",fontSize:"11px",fontWeight:500,opacity:0.75,marginTop:"2px"}}>{o.sub}</span>}
                  </button>
                );
              })}
            </div>
          ) : f.kind === "custom" ? (
            renderers[f.render]?.({ d, set })
          ) : f.yearRange ? (
            <YearPicker range={f.yearRange(ctx)} value={d[f.field] ?? ""} onChange={v => writeFollow(f, v)} label={f.inputLabel || f.label}/>
          ) : (
            // `prefill`: a worked-out figure shown until they type their own.
            <PillMoneyInput label={f.inputLabel || ""} unit={{ percent:"%", years:"" }[f.kind] ?? "£"}
              value={followAnswered(f) ? +d[f.field] : (f.prefill ? f.prefill(ctx) : null)} onChange={v => writeFollow(f, v ?? "")}/>
          )}
          {f.note && <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"6px 0 0"}}>{f.note(ctx)}</p>}
        </div>
      ))}
    </div>
  );
  // Below a question's minimum (age 18), its own line replaces the note.
  const belowMin = minFor(q, ctx) != null && raw !== "" && raw != null && !isNaN(+raw) && +raw < minFor(q, ctx);
  const note = belowMin && q.minNote ? q.minNote(ctx) : q.note ? q.note(ctx) : null;
  const shift = reduceMotion ? 0 : SHIFT_PX;
  const variants = {
    enter: dir => ({ opacity: 0, y: dir * shift }),
    center: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
    exit: dir => ({ opacity: 0, y: -dir * shift, transition: { duration: 0.15, ease: "easeIn" } }),
  };
  // The question's answers, and whether they sit two to a row.
  const opts = q.options ? q.options(ctx) : [];
  const layout = q.columns ? "grid" : tileLayout(opts);
  const noteLine = note && <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"10px 0 0"}}>{note}</p>;

  return (
    <div>
      {result}

      {/* The question area: Back, the progress line and the question itself. */}
      <div ref={areaRef}>
      {/* "x of y" only once the total can't change with answers still to come. */}
      <ShellTopRow onBack={history.length > 1 ? back : null}
        position={showProgress && countSettled(questions, ctx, needed, q.id) ? position : null} total={visible.length}
        style={{marginTop:result ? "22px" : 0}}/>

      <AnimatePresence mode="wait" custom={direction} initial={animateFirst} onExitComplete={keepQuestionInView}>
        <motion.div key={q.id} custom={direction} variants={variants} initial="enter" animate="center" exit="exit" style={{marginTop:"12px"}}>
          <QuestionHeading lead={q.lead} ask={q.ask(ctx)} why={q.why(ctx)} compact={!!result}/>

          {q.kind === "choice" && q.follow ? (
            <form onSubmit={submit}>
              <AnswerGroup layout={layout} label={q.ask(ctx)}>
                {opts.map(o => (
                  <AnswerTile key={o.value} label={o.label} sub={o.sub} layout={layout}
                    on={mainReady && raw === o.value} onPick={() => pick(o.value)}/>
                ))}
              </AnswerGroup>
              {noteLine}
              {followBlock}
              {continueButton}
            </form>
          ) : q.kind === "choice" && q.wheel ? (
            // `wheel`: a long list (the months) on the tombola wheel, then
            // Continue; q.wheel is its first row, for no answer yet.
            <form onSubmit={submit}>
              <WheelPicker label={q.ask(ctx)} items={[{ value:"", label:q.wheel }, ...q.options(ctx)]} value={raw ?? ""} onChange={v => write(q.field, v)}/>
              {note && <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>{note}</p>}
              {continueButton}
            </form>
          ) : q.kind === "choice" ? (
            // `columns`: short answers in a grid across the width.
            <div>
              <AnswerGroup layout={layout} columns={q.columns || 2} label={q.ask(ctx)}>
                {opts.map(o => (
                  <AnswerTile key={o.value} label={o.label} sub={o.sub} layout={layout}
                    on={answered.has(q.id) && d[q.field] === o.value} onPick={() => choose(o.value)}/>
                ))}
              </AnswerGroup>
              {noteLine}
            </div>
          ) : q.kind === "multi" ? (
            <form onSubmit={submit}>
              <AnswerGroup layout={layout} label={q.ask(ctx)} multi>
                {opts.map(o => (
                  <AnswerTile key={o.value} label={o.label} sub={o.sub} layout={layout} multi check
                    on={picked.includes(o.value)} onPick={() => toggle(o)}/>
                ))}
              </AnswerGroup>
              {noteLine}
              {followBlock}
              {continueButton}
            </form>
          ) : q.kind === "info" ? (
            <form onSubmit={submit}>
              {/* An info step's optional list: { what, where } items, each a
                  tile, every tile the height of the tallest (1fr rows). */}
              {q.list && (
                <div style={{display:"grid",gridAutoRows:"1fr",gap:"10px",marginBottom:"14px"}}>
                  {q.list(ctx).map(item => (
                    <div key={item.what} style={{background:WHITE,border:"1px solid rgba(22,47,36,0.1)",borderRadius:"14px",padding:"16px 18px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
                      <div style={{fontSize:"17px",fontWeight:700,color:TEXT,lineHeight:1.3}}>{item.what}</div>
                      {item.where && <div style={{fontSize:"13px",color:MUT,lineHeight:1.45,marginTop:"4px"}}>{item.where}</div>}
                    </div>
                  ))}
                </div>
              )}
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
              {q.yearRange ? <YearPicker label={q.label} range={q.yearRange(ctx)} value={raw ?? ""} onChange={v => write(q.field, v)} blankLabel={q.required ? "Pick a year" : "Not sure"}/> : (
                <PillMoneyInput label={q.label} unit={{ percent:"%", years:"" }[q.kind] ?? "£"}
                  value={hasAnswer ? +raw : (q.prefill ? q.prefill(ctx) : null)}
                  onChange={v => write(q.field, q.cap ? capField(q.cap, v ?? "") : (v ?? ""))}/>
              )}
              {note && <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>{note}</p>}
              {followBlock}
              {continueButton}
            </form>
          )}

          {notSure.length > 0 && (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"10px",marginTop:"10px"}}>
              {notSure.map(o => <button key={o.label} type="button" onClick={() => takeNotSure(o)} style={textLink}>{o.label}</button>)}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      </div>

      {skipLabel && <SkipLink label={skipLabel} onClick={() => onDone("skipped", q.id)}/>}
    </div>
  );
}
