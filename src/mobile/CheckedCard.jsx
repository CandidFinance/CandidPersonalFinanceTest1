import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { G, TEXT, SERIF, SANS, WHITE, SUCCESS } from "../design-tokens.js";
import { MODULE_META } from "../lib/moduleStatus.js";
import Burst from "./Burst.jsx";
import { tap } from "./haptics.js";

// The moment a module's first answer is done: sparks, a tick, "Your
// pension, checked", so it ends on what's been done. Says what happened,
// never what to do. The Cash tour's last stop (CashTour.jsx) uses the card
// itself; every other module shows it over its page after its answer
// (CandidApp), once, on the way in.

const NAMES = { cash: "Your cash", pension: "Your pension", studentLoan: "Your student loan", investments: "Your investments", kids: "Your childcare", taxTrap: "Your £100k tax trap", personalLoan: "Your borrowing", rentVsBuy: "Rent or buy" };
const LINES = { cash: "Worked out on your own figures. When rates change, the figures on this page change with them." };
const DEFAULT_LINE = "Worked out on your own figures. When the rules or rates change, so does your answer.";

export const checkedTitle = moduleKey => `${NAMES[moduleKey] || MODULE_META.find(mm => mm.key === moduleKey)?.title || "Your answer"}, checked`;

// The card alone, for a dialog that's already open.
export function CheckedCardBody({ moduleKey, onDone, buttonRef }) {
  const reduce = useReducedMotion();
  useEffect(() => { tap(15); }, []);
  return (
    <div style={{ position: "relative", textAlign: "center", background: WHITE, border: "1.5px solid rgba(22,47,36,0.12)", borderRadius: "18px", padding: "24px 18px 18px", boxShadow: "0 10px 30px rgba(22,47,36,0.25)", fontFamily: SANS }}>
      <Burst/>
      <motion.div initial={reduce ? false : { scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.1 }}
        style={{ width: "48px", height: "48px", borderRadius: "50%", background: SUCCESS, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
        <Check size={26} strokeWidth={3}/>
      </motion.div>
      <h2 id="checked-title" style={{ fontFamily: SERIF, fontSize: "24px", fontWeight: 700, color: G, margin: 0, lineHeight: 1.2 }}>{checkedTitle(moduleKey)}</h2>
      <p style={{ fontSize: "14.5px", color: TEXT, lineHeight: 1.55, margin: "8px 0 16px" }}>{LINES[moduleKey] || DEFAULT_LINE}</p>
      <button ref={buttonRef} type="button" onClick={onDone}
        style={{ width: "100%", background: G, color: WHITE, border: "none", borderRadius: "100px", padding: "14px", fontSize: "14.5px", fontWeight: 700, fontFamily: SANS, cursor: "pointer" }}>Done</button>
    </div>
  );
}

// Over the page, centred on a dimmed screen; Done or Escape closes it.
// `onDone`: Done does that instead (on to Home for the app's tour).
export default function CheckedCard({ moduleKey, onClose, onDone = onClose }) {
  const reduce = useReducedMotion();
  const buttonRef = useRef(null);
  useEffect(() => {
    posthog.capture("checked_card_shown", { module: moduleKey });
    buttonRef.current?.focus({ preventScroll: true });
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="checked-title"
      style={{ position: "fixed", inset: 0, zIndex: 4700, background: "rgba(22,47,36,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} style={{ width: "100%", maxWidth: "548px" }}>
        <CheckedCardBody moduleKey={moduleKey} onDone={onDone} buttonRef={buttonRef}/>
      </motion.div>
    </div>
  );
}
