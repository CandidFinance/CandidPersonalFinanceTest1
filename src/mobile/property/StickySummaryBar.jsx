import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WHITE, MUT, SERIF } from "../../CandidApp.jsx";

// The bar's small caption and its headline figure. Styles are built at
// render time: this file is in the circular import with CandidApp.jsx, so
// its tokens can't be relied on while the module first evaluates.
export function SummaryLabel({ children }) {
  return <span style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase"}}>{children}</span>;
}
export function SummaryFigure({ color, children }) {
  return <span style={{fontFamily:SERIF,fontSize:"17px",fontWeight:700,lineHeight:1.2,color}}>{children}</span>;
}

// A slim bar fixed to the top of the screen, there only while a step's main
// result (`watchRef`) is scrolled up out of view, so editing the inputs
// below it still shows the answer moving. Tapping it scrolls back to the
// full result. Used by each Property step that leads with its result.
export default function StickySummaryBar({ watchRef, label, children }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = watchRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, [watchRef]);

  return (
    <AnimatePresence>
      {show && (
        <motion.button type="button" onClick={() => watchRef.current?.scrollIntoView({ behavior:"smooth", block:"start" })}
          initial={{y:"-100%"}} animate={{y:0}} exit={{y:"-100%"}} transition={{duration:0.2}}
          aria-label={label}
          style={{position:"fixed",top:0,left:0,right:0,zIndex:3000,background:WHITE,border:"none",borderBottom:"1px solid rgba(22,47,36,0.1)",boxShadow:"0 4px 12px rgba(22,47,36,0.08)",paddingTop:"env(safe-area-inset-top, 0px)",fontFamily:"inherit",cursor:"pointer",textAlign:"left"}}>
          <div style={{maxWidth:"580px",margin:"0 auto",padding:"10px 20px",display:"flex",alignItems:"baseline",gap:"10px",boxSizing:"border-box"}}>
            {children}
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
