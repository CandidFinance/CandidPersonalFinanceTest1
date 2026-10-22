import { useState, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, CircleAlert } from "lucide-react";
import { G, MUT, TEXT, SERIF, WHITE, SUCCESS, CRITICAL, WARNING } from "../../design-tokens.js";
import { MODULE_META } from "../../lib/moduleStatus.js";

// A module's answer in three steps (src/lib/moduleReveal.js): the answer,
// why, and what the user could do, one at a time with the same movement as
// the questions before it, ending on the module's full screen ("See
// everything"). `onDone(how, step)`: how is "finished" or "skipped".
// `header={false}` drops its own module header, for a screen that already has
// one (Property, under its step tabs).

const SHIFT_PX = 30;

// `limits` (moduleLimits.js): what the answer doesn't include yet, under
// its last step.
// `footer`: shown under the last step's button (inviting friends, where the
// answer has just been seen).
// `large`: each step across the full width with no card or label, its
// `rows` as very large figures (Student loan, for now).
// `lastAction` ({ label, onClick }): the last step's main button instead of
// "See everything", which becomes a link under it (Student loan's detailed
// view). `doneLabel`: what that link, or the last button, says.
export default function MobileModuleReveal({ moduleKey, steps, onDone, header = true, limits = null, footer = null, large = false, lastAction = null, doneLabel = "See everything" }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);
  const meta = MODULE_META.find(mm => mm.key === moduleKey);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const reduceMotion = useReducedMotion();
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

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:"11.5px",fontWeight:600,color:MUT}}>{index + 1} of {steps.length}</span>
        <button type="button" onClick={() => onDone("skipped", index + 1)} style={textLink}>Skip to everything</button>
      </div>

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
            <div style={{fontFamily:SERIF,fontSize:"34px",fontWeight:700,color:TEXT,lineHeight:1.15,marginTop:"10px"}}>{step.figure}</div>
          )}
          <p style={{fontFamily:step.figure ? "inherit" : SERIF,fontSize:step.figure ? "15px" : "19px",fontWeight:step.figure ? 600 : 700,color:TEXT,lineHeight:1.4,margin:step.figure ? "4px 0 0" : "10px 0 0"}}>
            {step.title}
          </p>
          {step.body && <p style={{fontSize:"13px",color:MUT,lineHeight:1.55,margin:"10px 0 0"}}>{step.body}</p>}
        </motion.div>
        )}
      </AnimatePresence>
      {last && limits && <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"12px 2px 0"}}>{limits}</p>}

      <button type="button" onClick={() => last ? (lastAction ? lastAction.onClick() : onDone("finished", steps.length)) : go(1)} style={{
        width:"100%", marginTop:"18px", background:G, color:WHITE, border:"none", borderRadius:"100px", padding:"13px",
        fontSize:"14px", fontWeight:700, fontFamily:"inherit", cursor:"pointer",
      }}>
        {last ? (lastAction ? lastAction.label : doneLabel) : "Next"}
      </button>
      {last && lastAction && (
        <div style={{textAlign:"center",marginTop:"8px"}}>
          <button type="button" onClick={() => onDone("finished", steps.length)} style={{...textLink,fontSize:"13.5px"}}>{doneLabel}</button>
        </div>
      )}
      {last && footer}
      {index > 0 && (
        <button type="button" onClick={() => go(-1)} style={{...textLink,color:MUT,display:"inline-flex",alignItems:"center",gap:"2px",marginTop:"14px",fontSize:"13px"}}>
          <ChevronLeft size={15}/>Back
        </button>
      )}
    </div>
  );
}

// One step in the large layout: its rows as big figures, a line above each
// and a note below; a step without rows as a large statement.
const TONE = { repay: SUCCESS, cost: CRITICAL };
const SIZE = { xl: "clamp(56px, 17vw, 78px)", l: "clamp(40px, 12vw, 54px)", m: "clamp(28px, 8vw, 36px)" };
function LargeStep({ step }) {
  const rows = step.rows || (step.figure ? [{ figure: step.figure, size: "xl", note: step.title }] : null);
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
      {step.body && <p style={{fontSize:"16px",color:MUT,lineHeight:1.5,margin:"20px 0 0",whiteSpace:"pre-line"}}>{step.body}</p>}
      {step.aside && (
        <div style={{display:"flex",alignItems:"flex-start",gap:"10px",margin:"20px 0 0",padding:"2px 0 2px 12px",borderLeft:`3px solid ${G}`,fontSize:"15px",color:TEXT,lineHeight:1.45}}>
          <CircleAlert size={18} color={G} style={{flexShrink:0,marginTop:"1px"}} aria-hidden="true"/>{step.aside}
        </div>
      )}
    </div>
  );
}
