import { useState, useEffect } from "react";
import posthog from "posthog-js";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CircleAlert, Check, LoaderCircle, Sparkles } from "lucide-react";
import { G, MUT, TEXT, SERIF, WHITE, SUCCESS, CRITICAL, WARNING, OPPORTUNITY_TILE_BG, OPPORTUNITY_TILE_BORDER } from "../../design-tokens.js";
import { MODULE_META } from "../../lib/moduleStatus.js";
import { ShellTopRow, PrimaryButton, SkipLink } from "../onboarding/OnboardingShell.jsx";

// A module's answer in three steps (src/lib/moduleReveal.js): the answer,
// why, and what the user could do, one at a time with the same movement as
// the questions before it, ending on the module's full screen ("See
// everything"). `onDone(how, step)`: how is "finished" or "skipped".
// `header={false}` drops its own module header, for a screen that already has
// one (Property, under its step tabs).

const SHIFT_PX = 30;
// The working screen's pace: a line every LINE_MS, each spinning for SPIN_MS
// before its tick, so it can be read, then a pause before the answer (about
// 5.5s for four lines). With reduced motion, every line shows ticked at once,
// for long enough to read.
const LINE_MS = 1300, SPIN_MS = 1000, HOLD_MS = 600, STILL_MS = 3000;

// `footer`: shown under the last step (the email offer, inviting friends,
// where the answer has just been seen).
// `large`: each step across the full width with no card or label, its
// `rows` as very large figures (Student loan, for now).
// `lastAction` ({ label, onClick }): the last step's main button instead of
// "See everything", which becomes a link under it (Student loan's detailed
// view). `doneLabel`: what that link, or the last button, says.
// `checks` (workingChecks.js): the rules run on the user's figures, checked
// off one by one before the first step, which then follows by itself. Only
// on the way in from the questions, not when the answer is replayed.
export default function MobileModuleReveal({ moduleKey, steps, onDone, header = true, footer = null, large = false, lastAction = null, doneLabel = "See everything", checks = null }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);
  const meta = MODULE_META.find(mm => mm.key === moduleKey);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const reduceMotion = useReducedMotion();
  const [working, setWorking] = useState(() => !!checks?.length);
  // How many lines are showing, and how many of those are ticked.
  const [shown, setShown] = useState(0);
  const [ticked, setTicked] = useState(0);
  useEffect(() => {
    if (!working) return;
    posthog.capture("working_shown", { module: moduleKey, checks: checks.length });
    const n = checks.length;
    const timers = reduceMotion
      ? [setTimeout(() => { setShown(n); setTicked(n); }, 0), setTimeout(() => setWorking(false), STILL_MS)]
      : [...checks.flatMap((_, i) => [setTimeout(() => setShown(i + 1), i * LINE_MS), setTimeout(() => setTicked(i + 1), i * LINE_MS + SPIN_MS)]),
         setTimeout(() => setWorking(false), (n - 1) * LINE_MS + SPIN_MS + HOLD_MS)];
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const step = steps[index];
  const last = index === steps.length - 1;
  const shift = reduceMotion ? 0 : SHIFT_PX;
  const variants = {
    enter: dir => ({ opacity: 0, y: dir * shift }),
    center: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
    exit: dir => ({ opacity: 0, y: -dir * shift, transition: { duration: 0.15, ease: "easeIn" } }),
  };
  const go = dir => { setDirection(dir); setIndex(i => i + dir); };
  const textLink = { background:"none", border:"none", padding:"6px 0", color:G, fontSize:"12.5px", fontWeight:700, fontFamily:"inherit", cursor:"pointer" };
  // The main button, and on the last step the link under it. In the card
  // layout the last step's sit inside its card, with what the user could do.
  const actions = (
    <>
      <PrimaryButton onClick={() => last ? (lastAction ? lastAction.onClick() : onDone("finished", steps.length)) : go(1)} style={{marginTop:"18px"}}>
        {last ? (lastAction ? lastAction.label : doneLabel) : "Next"}
      </PrimaryButton>
      {last && lastAction && (
        <div style={{textAlign:"center",marginTop:"8px"}}>
          <button type="button" onClick={() => onDone("finished", steps.length)} style={{...textLink,fontSize:"13.5px"}}>{doneLabel}</button>
        </div>
      )}
    </>
  );
  const actionsInCard = last && !large;

  return (
    <div>
      {header && <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"20px"}}>
        <div style={{width:"42px",height:"42px",borderRadius:"11px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {meta?.icon && <meta.icon size={18} color={G}/>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <h1 style={{fontFamily:SERIF,fontSize:"20px",color:TEXT,fontWeight:700,margin:0,lineHeight:1.2}}>{meta?.title || moduleKey}</h1>
          <div style={{fontSize:"12.5px",color:MUT,marginTop:"3px"}}>{large ? "Your answer, step by step" : "Your position, step by step"}</div>
        </div>
      </div>}

      {working ? <Working checks={checks} shown={shown} ticked={ticked} reduceMotion={reduceMotion}/> : <>
      <ShellTopRow onBack={index > 0 ? () => go(-1) : null} position={index + 1} total={steps.length}/>

      {/* The step itself sits in a card, like the result card it replaces. */}
      <AnimatePresence mode="wait" custom={direction} initial={true}>
        {large ? (
          <motion.div key={index} custom={direction} variants={variants} initial="enter" animate="center" exit="exit" style={{marginTop:"22px"}}>
            <LargeStep step={step}/>
          </motion.div>
        ) : (
        <motion.div key={index} custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
          style={{marginTop:"10px",background:WHITE,borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",padding:"22px 20px"}}>
          <div style={{fontSize:"10.5px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase"}}>{step.label}</div>
          {step.figure && (
            <div style={{fontFamily:SERIF,fontSize:"34px",fontWeight:700,color:step.tone === "cost" ? CRITICAL : TEXT,lineHeight:1.15,marginTop:"10px"}}>{step.figure}</div>
          )}
          <div style={{display:"flex",alignItems:"center",gap:"12px",marginTop:step.figure ? "4px" : "10px"}}>
            {/* Candid Assist's icon, as on its button at the bottom right. */}
            {step.icon === "assist" && (
              <span aria-hidden="true" style={{width:"44px",height:"44px",borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:OPPORTUNITY_TILE_BG,border:OPPORTUNITY_TILE_BORDER,boxShadow:"0 3px 10px rgba(22,47,36,0.14)"}}>
                <Sparkles size={20} color={G}/>
              </span>
            )}
            <p style={{fontFamily:step.figure ? "inherit" : SERIF,fontSize:step.figure ? "15px" : "19px",fontWeight:step.figure ? 600 : 700,color:TEXT,lineHeight:1.4,margin:0}}>
              {step.title}
            </p>
          </div>
          {step.body && <p style={{fontSize:"13px",color:MUT,lineHeight:1.55,margin:"10px 0 0"}}>{step.body}</p>}
          {actionsInCard && actions}
        </motion.div>
        )}
      </AnimatePresence>

      {!actionsInCard && actions}
      {last && footer}
      {!last && <SkipLink label="Skip to everything" onClick={() => onDone("skipped", index + 1)}/>}
      </>}
    </div>
  );
}

// The working screen: one line at a time, spinning while it's checked
// ("Checking X against Y..."), then ticked, before the next comes in.
function Working({ checks, shown, ticked, reduceMotion }) {
  return (
    <div style={{marginTop:"22px"}}>
      <p style={{fontFamily:SERIF,fontSize:"clamp(24px, 7vw, 30px)",fontWeight:700,color:G,lineHeight:1.2,margin:0}}>Checking your figures</p>
      <ul aria-live="polite" style={{listStyle:"none",margin:"22px 0 0",padding:0,display:"flex",flexDirection:"column",gap:"18px"}}>
        {checks.slice(0, shown).map((c, i) => {
          const done = i < ticked;
          return (
            <motion.li key={c} initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}
              style={{display:"flex",alignItems:"flex-start",gap:"12px",fontSize:"16px",fontWeight:600,color:done ? TEXT : MUT,lineHeight:1.4,transition:"color 0.25s"}}>
              <span aria-hidden="true" style={{width:"24px",height:"24px",borderRadius:"50%",flexShrink:0,marginTop:"-1px",display:"flex",alignItems:"center",justifyContent:"center",background:done ? SUCCESS : "transparent",transition:"background 0.25s"}}>
                {done ? <Check size={15} color={WHITE} strokeWidth={3}/> : (
                  <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }} style={{display:"flex"}}>
                    <LoaderCircle size={22} color={G} strokeWidth={2.25}/>
                  </motion.span>
                )}
              </span>
              {done ? c : c + "\u2026"}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

// One step in the large layout: its rows as big figures, a line above each
// and a note below; a step without rows as a large statement.
const TONE = { repay: SUCCESS, cost: CRITICAL };
const SIZE = { xl: "clamp(56px, 17vw, 78px)", l: "clamp(40px, 12vw, 54px)", m: "clamp(28px, 8vw, 36px)" };
function LargeStep({ step }) {
  const rows = step.rows || (step.figure ? [{ figure: step.figure, size: "xl", note: step.title, tone: step.tone }] : null);
  return (
    <div>
      {rows ? rows.map((r, i) => (
        <div key={i} style={{marginTop: i ? "30px" : 0}}>
          {r.lead && <div style={{fontSize:"19px",fontWeight:600,color:TEXT,lineHeight:1.3}}>{r.lead}</div>}
          <div style={{fontFamily:SERIF,fontSize:SIZE[r.size] || SIZE.l,fontWeight:700,color:TONE[r.tone] || G,lineHeight:1.05,margin:"6px 0 6px",letterSpacing:"-0.01em"}}>
            {r.prefix && <span style={{fontFamily:"inherit",fontSize:"0.45em",fontWeight:600,color:MUT,marginRight:"8px"}}>{r.prefix}</span>}
            {r.figure}
          </div>
          {r.note && <div style={{fontSize:"16px",color:MUT,lineHeight:1.45}}>{r.note}</div>}
          {r.alert && (
            <div style={{display:"flex",alignItems:"flex-start",gap:"6px",fontSize:"14px",color:TEXT,lineHeight:1.4,marginTop:"8px"}}>
              <CircleAlert size={16} color={WARNING} style={{flexShrink:0,marginTop:"1px"}} aria-hidden="true"/>{r.alert}
            </div>
          )}
        </div>
      )) : (
        <p style={{fontFamily:SERIF,fontSize:"clamp(26px, 7.5vw, 32px)",fontWeight:700,color:G,lineHeight:1.2,margin:0}}>{step.title}</p>
      )}
      {step.checks && (
        <ul style={{listStyle:"none",margin:"22px 0 0",padding:0,display:"flex",flexDirection:"column",gap:"14px"}}>
          {step.checks.map(c => (
            <li key={c} style={{display:"flex",alignItems:"center",gap:"12px",fontSize:"18px",fontWeight:600,color:TEXT,lineHeight:1.3}}>
              <span aria-hidden="true" style={{width:"26px",height:"26px",borderRadius:"50%",background:SUCCESS,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Check size={16} color={WHITE} strokeWidth={3}/></span>
              {c}
            </li>
          ))}
        </ul>
      )}
      {step.checks && step.checksNote && <p style={{fontSize:"15px",color:MUT,lineHeight:1.5,margin:"20px 0 0"}}>{step.checksNote}</p>}
      {step.body && !step.checks && <p style={{fontSize:"16px",color:MUT,lineHeight:1.5,margin:"20px 0 0",whiteSpace:"pre-line"}}>{step.body}</p>}
      {step.aside && (
        <div style={{display:"flex",alignItems:"flex-start",gap:"10px",margin:"20px 0 0",padding:"2px 0 2px 12px",borderLeft:`3px solid ${G}`,fontSize:"15px",color:TEXT,lineHeight:1.45}}>
          <CircleAlert size={18} color={G} style={{flexShrink:0,marginTop:"1px"}} aria-hidden="true"/>{step.aside}
        </div>
      )}
    </div>
  );
}
