import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import posthog from "posthog-js";
import { X, Landmark } from "lucide-react";
import { outsideEvent, withApproved, EVENTS } from "../lib/outsideEvents.js";
import { reportStorageFailure } from "../lib/storage.js";
import { closingTile } from "./SinceLastVisit.jsx";
import { G, GOLD, CREAM, RADIUS_CARD, SERIF } from "../design-tokens.js";

// Home's outside event (src/lib/outsideEvents.js): a Bank Rate decision or
// a Budget, coming up or just announced, and what it means for their
// figures. Deep green with a gold kicker, so it reads as news from outside,
// apart from the blue "Since your last visit" about their own figures.
// Closed for good with its X, a phase at a time (candid_events_closed), so
// closing "coming up" still brings the announcement. `approved`: what was
// announced, from the approved event emails (CandidApp, api/events.js).
const KEY = "candid_events_closed";
let reported = null;

function readClosed() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch (e) { reportStorageFailure("read_events_closed", e); return []; }
}

// Local preview only: /app/home?demoEvent=cut|hold|budget|soon shows a
// made-up event dated today.
function demoEvents() {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const kind = new URLSearchParams(window.location.search).get("demoEvent");
  if (!kind) return null;
  const iso = t => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  const inDays = n => iso(new Date(Date.now() + n * 86400000));
  const today = inDays(0), later = inDays(42);
  if (kind === "budget") return [{ id: "demo-budget", kind: "budget", date: today, changes: [
    { label: "ISA", text: "the £20,000 allowance stays the same next tax year." },
    { label: "Your cash", text: (d, m) => `the Personal Savings Allowance is unchanged, so the tax on the interest on your ${m.cash > 0 ? "savings" : "cash"} stays as it is.` },
  ] }];
  if (kind === "soon") return [{ id: "demo-soon", kind: "bankRate", date: inDays(3), from: 3.75 }];
  return [{ id: "demo-boe", kind: "bankRate", date: today, from: 3.75, to: kind === "hold" ? 3.75 : 3.5 }, { id: "demo-next", kind: "bankRate", date: later }];
}

export default function OutsideEvent({ d, m, approved = null }) {
  const [closed, setClosed] = useState(readClosed);
  const [hidden, setHidden] = useState(false);
  const reduceMotion = useReducedMotion();
  const event = useMemo(() => outsideEvent(d, m, { events: demoEvents() || withApproved(EVENTS, approved), closed }), [d, m, approved, closed]);
  useEffect(() => {
    if (!event || reported === event.key) return;
    reported = event.key;
    posthog.capture("outside_event_shown", { event: event.key });
  }, [event]);
  if (!event) return null;
  const close = () => {
    const next = [...closed, event.key];
    try { localStorage.setItem(KEY, JSON.stringify(next)); }
    catch (e) { reportStorageFailure("save_events_closed", e); }
    setHidden(true);
    posthog.capture("outside_event_closed", { event: event.key });
  };

  return (
    <AnimatePresence initial={false} onExitComplete={() => { setClosed(readClosed()); setHidden(false); }}>
      {!hidden && (
        <motion.div key={event.key} exit={closingTile(reduceMotion)} style={{marginBottom:"16px",transformOrigin:"top center"}}>
          <div style={{background:G,borderRadius:RADIUS_CARD,boxShadow:"0 6px 20px rgba(22,47,36,0.22)",padding:"14px 14px 16px 16px",color:CREAM}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <span style={{width:"30px",height:"30px",borderRadius:"50%",background:"rgba(196,150,58,0.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Landmark size={15} color={GOLD} aria-hidden="true"/>
              </span>
              <span style={{flex:1,minWidth:0,fontSize:"11px",fontWeight:700,color:GOLD,letterSpacing:"0.09em",textTransform:"uppercase"}}>{event.kicker}</span>
              <button type="button" onClick={close} aria-label="Close"
                style={{display:"flex",alignItems:"center",justifyContent:"center",width:"28px",height:"28px",flexShrink:0,borderRadius:"50%",border:"none",background:"rgba(250,247,240,0.12)",color:CREAM,cursor:"pointer",padding:0}}>
                <X size={16} aria-hidden="true"/>
              </button>
            </div>
            <div style={{fontFamily:SERIF,fontSize:"19px",fontWeight:700,lineHeight:1.25,marginTop:"10px"}}>{event.title}</div>
            {event.text && <p style={{fontSize:"13px",lineHeight:1.5,margin:"6px 0 0",color:"rgba(250,247,240,0.82)"}}>{event.text}</p>}
            {event.lines.length > 0 && (
              <ul style={{listStyle:"none",margin:"10px 0 0",padding:"10px 0 0",borderTop:"1px solid rgba(250,247,240,0.14)",display:"flex",flexDirection:"column",gap:"8px"}}>
                {event.lines.map((l, i) => (
                  <li key={i} style={{fontSize:"13px",lineHeight:1.5,color:"rgba(250,247,240,0.88)"}}>
                    <b style={{fontWeight:700,color:CREAM}}>{l.label}</b>: {l.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
