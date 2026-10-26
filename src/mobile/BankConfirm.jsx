import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { G, WHITE, TEXT, MUT, SERIF, SUCCESS } from "../design-tokens.js";
import { pendingBank, bankPatch, gainedSoFar } from "../lib/moduleStatus.js";
import { fmt } from "../lib/format.js";
import Burst from "./Burst.jsx";
import CountUpFigure from "./CountUpFigure.jsx";
import { tap } from "./haptics.js";

// Asked when a module's own answers have changed and its £ at stake has
// fallen: did the user make the change (banked), or correct a figure (not
// banked)? Nothing counts as banked until they say (moduleStatus.js).
// "I made the change" swaps the box for a moment saying what was recorded,
// with Undo, which fades after a few seconds; "Just correcting" closes it
// quietly. `compact` for the Modules tab's tiles (no sparks).
const SHOWN_MS = 5000;

export default function BankConfirm({ d, set, moduleKey, title, amount, compact = false }) {
  const reduce = useReducedMotion();
  // { amount, before }: what was banked and this module's baseline to put
  // back.
  const [saved, setSaved] = useState(null);
  const savedRef = useRef(null);
  savedRef.current = saved;

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), SHOWN_MS);
    return () => clearTimeout(t);
  }, [saved]);

  const pending = pendingBank(d, moduleKey, amount);
  const answer = made => {
    const before = d.moduleBaselines?.[moduleKey];
    set("moduleBaselines", bankPatch(d, moduleKey, amount, made));
    posthog.capture(made ? "bank_confirmed" : "bank_correction", { module: moduleKey, amount: pending });
    if (made) { setSaved({ amount: pending, before }); tap(15); }
  };
  // Still clickable as it fades, so a second tap finds nothing to undo.
  const undo = () => {
    const was = savedRef.current;
    if (!was) return;
    set("moduleBaselines", { ...d.moduleBaselines, [moduleKey]: was.before });
    posthog.capture("bank_undone", { module: moduleKey, amount: was.amount });
    setSaved(null);
  };

  const box = {background:"rgba(45,107,74,0.07)",border:"1px solid rgba(45,107,74,0.2)",borderRadius:"12px",padding:compact ? "10px 12px" : "14px 16px",margin:compact ? "0 18px 14px" : "0 0 16px"};
  const button = primary => ({
    background: primary ? G : WHITE, color: primary ? WHITE : G, border: `1.5px solid ${G}`, borderRadius: "100px",
    padding: compact ? "7px 12px" : "9px 14px", fontSize: compact ? "12.5px" : "13px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
  });
  const link = { background: "none", border: "none", padding: 0, color: G, fontSize: compact ? "12px" : "13px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", textDecoration: "underline" };

  return (
    <AnimatePresence initial={false}>
      {saved ? (
        <motion.div key="saved" role="status" onClick={e => e.stopPropagation()}
          initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }}
          style={{ ...box, position: "relative", display: "flex", alignItems: "center", gap: compact ? "10px" : "12px" }}>
          {!compact && <Burst/>}
          <motion.div initial={reduce ? false : { scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}
            style={{ width: compact ? "28px" : "36px", height: compact ? "28px" : "36px", borderRadius: "50%", background: SUCCESS, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Check size={compact ? 16 : 20} strokeWidth={3}/>
          </motion.div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: SERIF, fontSize: compact ? "17px" : "20px", fontWeight: 700, color: G, lineHeight: 1.25 }}>
              <CountUpFigure text={`+${fmt(saved.amount)} a year saved`} run={!compact}/>
            </div>
            <div style={{ fontSize: compact ? "12px" : "13px", color: MUT, lineHeight: 1.5, marginTop: "2px" }}>
              {fmt(gainedSoFar(d).perYear)} a year saved in all.{" "}
              <button type="button" onClick={undo} style={link}>Undo</button>
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={() => setSaved(null)}
            style={{ alignSelf: "flex-start", background: "none", border: "none", padding: "2px", margin: "-2px -4px 0 0", cursor: "pointer", color: MUT, display: "flex" }}>
            <X size={16}/>
          </button>
        </motion.div>
      ) : pending ? (
        <motion.div key="ask" onClick={e => e.stopPropagation()} exit={{ opacity: 0, transition: { duration: 0.15 } }} style={box}>
          <div style={{fontSize:compact ? "13px" : "14px",fontWeight:700,color:TEXT,lineHeight:1.4}}>{title} is down {fmt(pending)} a year</div>
          <p style={{fontSize:compact ? "12px" : "13px",color:MUT,lineHeight:1.5,margin:"3px 0 10px"}}>Did you make a change, or correct a figure? Only changes you've made count as saved.</p>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            <button type="button" onClick={() => answer(true)} style={button(true)}>I made the change</button>
            <button type="button" onClick={() => answer(false)} style={button(false)}>Just correcting</button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
