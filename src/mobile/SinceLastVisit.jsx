import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import posthog from "posthog-js";
import { X, ChevronRight } from "lucide-react";
import { sinceLastVisit } from "../lib/sinceLastVisit.js";
import { lastVisit, sinceClosed, closeSince } from "./visitNews.js";
import { WHITE, TEXT, RADIUS_CARD, CTA_BLUE } from "../design-tokens.js";

// Home's "Since your last visit" (src/lib/sinceLastVisit.js): what's changed
// since they were last here, top of Home, or nothing when nothing has. It
// compares with the last visit's snapshot for the whole session
// (visitNews.js), so the strip stays put as they move around the app,
// until they close it (for the rest of the session). In the CTA blue, so
// it stands out from the green tiles under it as something new.
let reported = false;

// Closing a tile at the top of Home: it fades and lifts a little while the
// space it took closes up, so the tiles under it slide up rather than
// jump. Just a fade for anyone who has asked for less motion.
export const closingTile = reduceMotion => reduceMotion
  ? { opacity: 0, transition: { duration: 0.2 } }
  : { opacity: 0, y: -6, scale: 0.98, height: 0, marginBottom: 0,
      transition: { opacity: { duration: 0.18 }, y: { duration: 0.2 }, scale: { duration: 0.2 },
        height: { duration: 0.32, delay: 0.06, ease: [0.4, 0, 0.2, 1] }, marginBottom: { duration: 0.32, delay: 0.06, ease: [0.4, 0, 0.2, 1] } } };

export default function SinceLastVisit({ d, m, rows, onOpenCash }) {
  const [hidden, setHidden] = useState(sinceClosed);
  const reduceMotion = useReducedMotion();
  const since = useMemo(() => sinceLastVisit(lastVisit(), d, m, rows), [d, m, rows]);
  useEffect(() => {
    if (!since || reported || !rows) return;
    reported = true;
    posthog.capture("since_last_visit_shown", { lines: since.lines.map(l => l.label).join(","), ago: since.ago });
  }, [since, rows]);
  if (!since) return null;
  const close = () => {
    closeSince();
    setHidden(true);
    posthog.capture("since_last_visit_closed");
  };

  return (
    <AnimatePresence initial={false}>
      {!hidden && (
        <motion.div key="since" exit={closingTile(reduceMotion)} style={{marginBottom:"16px",transformOrigin:"top center"}}>
          <div style={{background:"rgba(0,113,227,0.06)",border:`1.5px solid ${CTA_BLUE}`,borderRadius:RADIUS_CARD,boxShadow:"0 4px 16px rgba(0,113,227,0.12)",padding:"14px 14px 16px 18px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <span style={{flex:1,minWidth:0}}>
                <span style={{fontSize:"11px",fontWeight:700,color:CTA_BLUE,letterSpacing:"0.09em",textTransform:"uppercase"}}>Since your last visit</span>
                <span style={{fontSize:"12px",color:CTA_BLUE,opacity:0.8}}> · {since.ago}</span>
              </span>
              <button type="button" onClick={close} aria-label="Close"
                style={{display:"flex",alignItems:"center",justifyContent:"center",width:"28px",height:"28px",flexShrink:0,borderRadius:"50%",border:"none",background:"rgba(0,113,227,0.1)",color:CTA_BLUE,cursor:"pointer",padding:0}}>
                <X size={16} aria-hidden="true"/>
              </button>
            </div>
            <ul style={{listStyle:"none",margin:"10px 0 0",padding:0,display:"flex",flexDirection:"column",gap:"8px"}}>
              {since.lines.map((l, i) => (
                <li key={i} style={{fontSize:"13px",color:TEXT,lineHeight:1.5}}>
                  <b style={{fontWeight:700}}>{l.label}</b>: {l.text}
                </li>
              ))}
            </ul>
            {since.rates && onOpenCash && (
              <button type="button" onClick={() => { posthog.capture("since_last_visit_opened", { to: "cash" }); onOpenCash(); }}
                style={{marginTop:"14px",display:"inline-flex",alignItems:"center",gap:"4px",background:CTA_BLUE,border:"none",borderRadius:"100px",padding:"10px 16px",color:WHITE,fontSize:"13px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
                See your cash
                <ChevronRight size={15} aria-hidden="true"/>
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
