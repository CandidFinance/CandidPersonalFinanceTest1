// A bin that asks before it deletes: tap it and the lid lifts while a tick
// and a cross slide out beside it. The tick confirms (the bin becomes a tick
// for a moment), the cross or Escape keeps the item. For removing a linked
// account, a custom goal, a saved row.
//
// Usage: <DeleteButton label="Remove Monzo" onConfirm={() => remove(id)} />
//
// Ported from Rare UI's delete-button (TypeScript + Tailwind) to plain JS,
// inline styles, framer-motion and Candid's palette (cream surfaces, CRITICAL
// for the confirm).
// Rare UI, https://rareui.com
// Copyright (c) 2026 Swami Malode. MIT + Commons Clause License Condition v1.0
// + Attribution: use is allowed as part of an application; the components may
// not be sold, sublicensed or redistributed themselves; Rare UI is credited
// with a visible link (Account > Legal documents), and this notice must stay.
import { useEffect, useRef, useState } from "react";
import { animate, AnimatePresence, motion, useMotionTemplate, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { CDARK, CRITICAL, G, MUT, SR_ONLY, WHITE } from "../../design-tokens.js";

const HINGE = "3px 6px";
const LID_OPEN = -35;
const WALL_TOP = 6;
const WALL_TOP_OPEN = 13.5;
const WALL_BASE = 20;

const TILE = 44;
const PANEL = 84;
const HOLD = { deleted: 1400, kept: 600 };

const EASE = [0.32, 0.72, 0, 1];
const EASE_LID = [0.34, 1.1, 0.64, 1];

const WIDTH = { duration: 0.62, ease: EASE };
const LID = { duration: 0.6, ease: EASE_LID };
const WALL = { duration: 0.56, ease: EASE };
const IN = { duration: 0.44, ease: EASE, delay: 0.14 };
const OUT = { duration: 0.3, ease: EASE };
const TAP = { duration: 0.2, ease: EASE };
const SWAP = { duration: 0.22, ease: EASE };
const SETTLE = { duration: 0.45, ease: EASE };
const PRESS = { type: "spring", stiffness: 520, damping: 18, mass: 0.5 };
const INSTANT = { duration: 0 };

const SURFACE = CDARK;
const RECESS = "#e3dccd"; // a step darker than CDARK: the tray the two choices sit in
const LIFT = "0 0.5px 1px rgba(22,47,36,0.05), 0 1px 3px rgba(22,47,36,0.08), inset 0 0.5px 0 rgba(255,255,255,0.9)";
const RADIUS = "14px";

const ICON = { viewBox: "0 0 24 24", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

const panelMotion = {
  hidden: { opacity: 0, x: -6, transition: OUT },
  shown: { opacity: 1, x: 0, transition: { ...IN, staggerChildren: 0.07 } },
};

const circleMotion = {
  hidden: { opacity: 0, scale: 0.9, transition: OUT },
  shown: { opacity: 1, scale: 1, transition: IN },
};

function Circle({ label, onClick, children }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.div style={{ display: "flex" }} variants={reduced ? undefined : circleMotion}>
      <motion.button
        type="button"
        className="tap44"
        aria-label={label}
        onClick={onClick}
        whileTap={reduced ? undefined : { scale: 0.84 }}
        transition={PRESS}
        style={{ display: "grid", placeItems: "center", width: "28px", height: "28px", borderRadius: "50%", border: "none", padding: 0, cursor: "pointer", background: WHITE, color: MUT, boxShadow: LIFT }}
      >
        <svg {...ICON} width="14" height="14" stroke="currentColor" strokeWidth="3.5">{children}</svg>
      </motion.button>
    </motion.div>
  );
}

export function DeleteButton({ label = "Delete", onConfirm, onCancel, style, ...props }) {
  const reduced = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | deleted | kept
  const trigger = useRef(null);
  const timing = (transition) => (reduced ? INSTANT : transition);

  const top = useMotionValue(WALL_TOP);
  const wall = useTransform(top, (y) => WALL_BASE - y);
  const bin = useMotionTemplate`M19 ${top}v${wall}a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V${top}`;
  const settle = useMotionValue(1);

  useEffect(() => {
    const walls = animate(top, open ? WALL_TOP_OPEN : WALL_TOP, reduced ? INSTANT : WALL);
    return () => walls.stop();
  }, [open, reduced, top]);

  useEffect(() => {
    if (status === "idle") return undefined;
    const nudge = status === "kept" && !reduced ? animate(settle, [1, 0.86, 1], SETTLE) : null;
    const done = setTimeout(() => setStatus("idle"), HOLD[status]);
    return () => {
      nudge?.stop();
      clearTimeout(done);
    };
  }, [status, reduced, settle]);

  const resolve = (next) => {
    setOpen(false);
    setStatus(next);
    trigger.current?.focus();
    (next === "deleted" ? onConfirm : onCancel)?.();
  };

  return (
    <motion.div
      data-slot="delete-button"
      data-state={open ? "open" : "closed"}
      data-status={status}
      initial={false}
      animate={{ width: open ? TILE + PANEL : TILE }}
      transition={timing(WIDTH)}
      onKeyDown={(event) => { if (event.key === "Escape" && open) resolve("kept"); }}
      style={{ position: "relative", height: `${TILE}px`, borderRadius: RADIUS, background: SURFACE, color: G, ...style }}
      {...props}
    >
      <motion.button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => {
          if (open) return resolve("kept");
          setStatus("idle");
          setOpen(true);
          return undefined;
        }}
        whileTap={reduced ? undefined : { scale: 0.94 }}
        transition={TAP}
        style={{ position: "relative", zIndex: 1, display: "grid", placeItems: "center", width: `${TILE}px`, height: `${TILE}px`, borderRadius: RADIUS, border: "none", background: "transparent", color: "inherit", padding: 0, cursor: "pointer" }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {status === "deleted" ? (
            <motion.svg key="done" {...ICON} width="20" height="20" stroke={CRITICAL} strokeWidth="2.5"
              initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={timing(SWAP)}>
              <motion.path d="M4 12.5 9.5 18 20 7"
                initial={reduced ? undefined : { pathLength: 0 }} animate={reduced ? undefined : { pathLength: 1 }} transition={SETTLE} />
            </motion.svg>
          ) : (
            <motion.svg key="bin" {...ICON} width="20" height="20" stroke="currentColor" strokeWidth="2"
              style={{ overflow: "visible", scale: settle }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={timing(SWAP)}>
              <motion.path d={bin} />
              <motion.g style={{ transformBox: "view-box", transformOrigin: HINGE }} animate={{ rotate: open ? LID_OPEN : 0 }} transition={timing(LID)}>
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </motion.g>
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>

      <span role="status" aria-live="polite" style={SR_ONLY}>
        {status === "deleted" ? "Deleted" : status === "kept" ? "Kept" : ""}
      </span>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            variants={reduced ? undefined : panelMotion}
            initial="hidden"
            animate="shown"
            exit="hidden"
            style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: `${PANEL}px`, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", borderRadius: RADIUS, background: RECESS }}
          >
            <span aria-hidden="true" style={{ position: "absolute", left: "-5px", top: "50%", transform: "translateY(-50%)", zIndex: 2, width: "6px", height: "10px", clipPath: "polygon(100% 0, 0 50%, 100% 100%)", background: RECESS }} />
            <Circle label="Confirm delete" onClick={() => resolve("deleted")}>
              <path d="M4 12.5 9.5 18 20 7" stroke={CRITICAL} />
            </Circle>
            <Circle label="Cancel" onClick={() => resolve("kept")}>
              <path d="M6 6 18 18M18 6 6 18" />
            </Circle>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default DeleteButton;
