import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { G, GOLD, GOLD_TEXT, TEXT, MUT, SANS, CARD, TILE_KICKER } from "../design-tokens.js";

// Coming up on Home: the next dates that touch their money (src/lib/comingUp.js)
// on a timeline. The month leads (it's what places the date), the day under
// it; a line ties the dates together. Minimised (`min`, kept in d.comingUpMin),
// the same dates move onto one shallow horizontal line across the tile with
// nothing else on it, so there's always a sign that something's coming; a tap
// opens it again.
const TILE_HEAD = TILE_KICKER;
const DOT = 11;
const LINE = "rgba(22,47,36,0.15)";

const Dot = ({ i, k }) => (
  <motion.span layoutId={`cu-dot-${k}`} layout="position" aria-hidden="true"
    style={{display:"block",width:`${DOT}px`,height:`${DOT}px`,borderRadius:"50%",boxSizing:"border-box",background:i === 0 ? GOLD : "#fff",border:i === 0 ? "none" : `2px solid ${G}`,flexShrink:0}}/>
);

export default function ComingUp({ items, min, onMinimise }) {
  const reduceMotion = useReducedMotion();
  if (!items.length) return null;
  const transition = { duration: reduceMotion ? 0 : 0.38, ease: [0.2, 0, 0, 1] };
  const fade = { initial:{ opacity:0 }, animate:{ opacity:1, transition:{ ...transition, delay: reduceMotion ? 0 : 0.12 } }, exit:{ opacity:0, transition:{ duration: reduceMotion ? 0 : 0.1 } } };

  return (
    <LayoutGroup>
      <motion.section layout transition={transition} aria-label="Coming up" style={{...CARD,paddingLeft:"16px",overflow:"hidden"}}>
        {min ? (
          <motion.button layout="position" type="button" onClick={() => onMinimise(false)} aria-expanded="false"
            aria-label={`Coming up: ${items.map(c => `${c.title}, ${c.day} ${c.mon}`).join("; ")}. Open`}
            style={{display:"block",width:"100%",background:"none",border:"none",padding:"13px 16px 13px 0",cursor:"pointer",font:"inherit",position:"relative"}}>
            {/* One shallow row: the line runs the tile's width behind the
                dates, each date on a patch of the tile's white so the line
                stops either side of it. No dots: the dates are the marks. */}
            <motion.span {...fade} aria-hidden="true" style={{position:"absolute",top:"50%",left:0,right:"16px",height:"2px",marginTop:"-1px",background:LINE}}/>
            <span style={{display:"grid",gridTemplateColumns:`repeat(${items.length}, 1fr)`,position:"relative"}}>
              {items.map((c, i) => (
                <span key={c.key} style={{display:"flex",justifyContent:"center"}}>
                  <span style={{display:"inline-flex",alignItems:"baseline",gap:"5px",background:"#fff",padding:"0 10px"}}>
                    <motion.span layoutId={`cu-mon-${c.key}`} layout="position" style={{fontFamily:SANS,fontSize:"16px",fontWeight:700,color:G,lineHeight:1.2}}>{c.mon}</motion.span>
                    <motion.span layoutId={`cu-day-${c.key}`} layout="position" style={{fontSize:"13px",fontWeight:600,color:MUT}}>{c.day}</motion.span>
                  </span>
                </span>
              ))}
            </span>
          </motion.button>
        ) : (
          <>
            <motion.div layout="position" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",padding:"16px 6px 8px 0"}}>
              <motion.h2 {...fade} style={TILE_HEAD}>Coming up</motion.h2>
              <button type="button" onClick={() => onMinimise(true)} aria-label="Minimise Coming up" aria-expanded="true"
                style={{display:"flex",alignItems:"center",justifyContent:"center",width:"44px",height:"44px",margin:"-10px 0",background:"none",border:"none",padding:0,color:GOLD_TEXT,cursor:"pointer"}}>
                <ChevronUp size={22} strokeWidth={2.5} aria-hidden="true"/>
              </button>
            </motion.div>
            <div style={{padding:"2px 16px 14px 0"}}>
              {items.map((c, i) => {
                const last = i === items.length - 1;
                return (
                  <div key={c.key} style={{display:"flex",gap:"12px",alignItems:"stretch"}}>
                    <div style={{width:"38px",flexShrink:0,paddingTop:"1px",textAlign:"center"}}>
                      <motion.div layoutId={`cu-mon-${c.key}`} layout="position" style={{fontFamily:SANS,fontSize:"16px",fontWeight:700,color:G,lineHeight:1.1}}>{c.mon}</motion.div>
                      <motion.div layoutId={`cu-day-${c.key}`} layout="position" style={{fontSize:"12.5px",fontWeight:600,color:MUT,marginTop:"2px"}}>{c.day}</motion.div>
                    </div>
                    <div style={{width:`${DOT}px`,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",paddingTop:"6px"}}>
                      <Dot i={i} k={c.key}/>
                      {!last && <motion.span {...fade} aria-hidden="true" style={{flex:1,width:"2px",background:LINE,marginTop:"3px",marginBottom:"-6px"}}/>}
                    </div>
                    <motion.div {...fade} style={{flex:1,minWidth:0,paddingBottom:last ? 0 : "20px"}}>
                     <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:"14.5px",fontWeight:600,color:TEXT,lineHeight:1.35}}>{c.title}</div>
                        <div style={{fontSize:"12.5px",color:MUT,lineHeight:1.4,marginTop:"2px"}}>{c.sub}</div>
                      </div>
                      {/* Sized and placed as Areas to explore's £ (HomeHero.jsx): 18px,
                          centred on the row, its last digit in line with theirs.
                          Their "/yr" and chevron sit after the digits (18px padding
                          + 15px chevron + 10px gap, less this tile's 16px), so the
                          same "/yr", unseen, holds the space here. */}
                      {c.amount && <div style={{marginRight:"27px",fontFamily:SANS,fontSize:"18px",fontWeight:700,color:G,whiteSpace:"nowrap",lineHeight:1.2}}>{c.amount}<span aria-hidden="true" style={{visibility:"hidden",fontSize:"12px",fontWeight:600}}>/yr</span></div>}
                     </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </motion.section>
    </LayoutGroup>
  );
}
