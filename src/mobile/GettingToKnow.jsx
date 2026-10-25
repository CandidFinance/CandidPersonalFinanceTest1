import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, X } from "lucide-react";
import { G, MUT, TEXT, SERIF, WHITE, SUCCESS, RADIUS_CARD } from "../design-tokens.js";
import { validEmailShape } from "../lib/emailCheck.js";
import { estimateItems } from "../lib/quickStart.js";
import { ProgressLine } from "./onboarding/OnboardingShell.jsx";
import Burst from "./Burst.jsx";
import { tap } from "./haptics.js";

// Home's "Getting to know Candid": four things the app can do, each ticked
// once it's been done, so the first (an area checked, which everyone
// arriving from the questions has) starts it part-way. Each item says what
// is, never what to do; a row not yet ticked opens the place it's done.
// New ticks animate once (`d.checklistSeen`). With all four, an "All set"
// moment, once, then gone for good (`d.checklistDone`); the X hides it too
// (`d.checklistDismissed`).

// The modules still answered from quick-start bands.
const estimated = d => Object.keys(d.quickEstimates || {}).filter(k => estimateItems(d, k).length);

const ITEMS = [
  { id: "first", label: "First area checked", done: ({ answered }) => answered >= 1, to: "/app/modules" },
  { id: "exact", label: "Exact figures in", done: ({ d }) => !estimated(d).length, to: d => `/app/inputs?open=${estimated(d)[0] || "cash"}` },
  { id: "email", label: "Email alerts on", done: ({ d }) => !!d.alertsOptIn && validEmailShape(d.email || ""), to: "/app/inputs?open=email" },
  { id: "second", label: "A second area checked", done: ({ answered }) => answered >= 2, to: "/app/modules" },
];

// `answered`: how many areas have an answer (doneModules).
export default function GettingToKnow({ d, set, answered }) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const items = ITEMS.map(i => ({ ...i, on: !!i.done({ d, answered }) }));
  const count = items.filter(i => i.on).length;
  const all = count === items.length;
  // What was already seen ticked when Home opened; the rest animate in.
  const [seen] = useState(() => d.checklistSeen || []);
  const fresh = items.filter(i => i.on && !seen.includes(i.id)).map(i => i.id);
  const recorded = useRef(false);

  useEffect(() => {
    if (recorded.current || !fresh.length) return;
    recorded.current = true;
    fresh.forEach(item => posthog.capture("checklist_item_done", { item }));
    const t = setTimeout(() => tap(), 450);
    set("checklistSeen", items.filter(i => i.on).map(i => i.id));
    if (all) set("checklistDone", true);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Shown while there's something left, or once more for the "All set" moment.
  const celebrating = all && fresh.length > 0;
  if (d.checklistDismissed || (d.checklistDone && !celebrating) || (all && !celebrating)) return null;

  const dismiss = () => { set("checklistDismissed", true); posthog.capture("checklist_dismissed", { done: count }); };

  return (
    <div style={{ position: "relative", background: WHITE, border: "1px solid rgba(22,47,36,0.08)", borderRadius: RADIUS_CARD, boxShadow: "0 2px 10px rgba(22,47,36,0.05)", padding: "16px 18px 8px", marginBottom: "16px" }}>
      {celebrating && <Burst/>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <h2 style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 700, color: G, margin: 0, lineHeight: 1.25 }}>{celebrating ? "All set" : "Getting to know Candid"}</h2>
        <button type="button" aria-label="Hide" onClick={dismiss} style={{ background: "none", border: "none", padding: "4px", color: MUT, cursor: "pointer", display: "flex" }}><X size={18}/></button>
      </div>
      <ProgressLine position={count} total={items.length} style={{ margin: "12px 0 6px" }}/>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item, n) => {
          const isNew = fresh.includes(item.id) && !reduce;
          const row = (
            <>
              <span aria-hidden="true" style={{ width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0, border: item.on ? "none" : "1.5px solid rgba(22,47,36,0.25)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                {item.on && (
                  <motion.span initial={isNew ? { scale: 0 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.3 + n * 0.12 }}
                    style={{ position: "absolute", inset: 0, borderRadius: "50%", background: SUCCESS, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Check size={13} color={WHITE} strokeWidth={3}/>
                  </motion.span>
                )}
              </span>
              <span style={{ flex: 1, fontSize: "14.5px", fontWeight: 600, color: TEXT }}>{item.label}</span>
              {!item.on && <ChevronRight size={16} color={MUT} aria-hidden="true"/>}
            </>
          );
          const rowStyle = { display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", width: "100%", textAlign: "left", background: "none", border: "none", fontFamily: "inherit" };
          return (
            <li key={item.id} style={{ borderTop: n ? "1px solid rgba(22,47,36,0.06)" : "none" }}>
              {item.on
                ? <div style={rowStyle}>{row}<span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>, done</span></div>
                : <button type="button" onClick={() => navigate(typeof item.to === "function" ? item.to(d) : item.to)} style={{ ...rowStyle, cursor: "pointer" }}>{row}</button>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
