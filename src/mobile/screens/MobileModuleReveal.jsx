import { useState, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { G, MUT, TEXT, SERIF, WHITE } from "../../CandidApp.jsx";
import { MODULE_META } from "../../lib/moduleStatus.js";

// A module's answer in three steps (src/lib/moduleReveal.js): the answer,
// why, and what the user could do, one at a time with the same movement as
// the questions before it, ending on the module's full screen ("See
// everything"). `onDone(how, step)`: how is "finished" or "skipped".

const SHIFT_PX = 30;

export default function MobileModuleReveal({ moduleKey, steps, onDone }) {
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
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"20px"}}>
        <div style={{width:"42px",height:"42px",borderRadius:"11px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {meta?.icon && <meta.icon size={18} color={G}/>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <h1 style={{fontFamily:SERIF,fontSize:"20px",color:TEXT,fontWeight:700,margin:0,lineHeight:1.2}}>{meta?.title || moduleKey}</h1>
          <div style={{fontSize:"12.5px",color:MUT,marginTop:"3px"}}>Your answer, step by step</div>
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:"11.5px",fontWeight:600,color:MUT}}>{index + 1} of {steps.length}</span>
        <button type="button" onClick={() => onDone("skipped", index + 1)} style={textLink}>Skip to everything</button>
      </div>

      {/* The step itself sits in a card, like the result card it replaces. */}
      <AnimatePresence mode="wait" custom={direction} initial={true}>
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
      </AnimatePresence>

      <button type="button" onClick={() => last ? onDone("finished", steps.length) : go(1)} style={{
        width:"100%", marginTop:"18px", background:G, color:WHITE, border:"none", borderRadius:"100px", padding:"13px",
        fontSize:"14px", fontWeight:700, fontFamily:"inherit", cursor:"pointer",
      }}>
        {last ? "See everything" : "Next"}
      </button>
      {index > 0 && (
        <button type="button" onClick={() => go(-1)} style={{...textLink,color:MUT,display:"inline-flex",alignItems:"center",gap:"2px",marginTop:"14px",fontSize:"13px"}}>
          <ChevronLeft size={15}/>Back
        </button>
      )}
    </div>
  );
}
