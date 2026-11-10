// A list of things to tick off. Ticking one fills its ring, draws the tick,
// strikes the label through, gives the row a small flick, then moves it to
// the bottom with the other finished rows. Unticking runs the same way back.
//
// Usage: <TaskList defaultTasks={[{ id: "isa", label: "Open an ISA" }]} />
//        or controlled: <TaskList tasks={tasks} onTasksChange={setTasks} />
// TaskItem is exported too, for one row on its own.
//
// Ported from Rare UI's task-list (TypeScript + Tailwind) to plain JS, inline
// styles, framer-motion and Candid's palette (PROGRESS_GREEN fill, G text).
// Rare UI, https://rareui.com
// Copyright (c) 2026 Swami Malode. MIT + Commons Clause License Condition v1.0
// + Attribution: use is allowed as part of an application; the components may
// not be sold, sublicensed or redistributed themselves; Rare UI is credited
// with a visible link (Account > Legal documents), and this notice must stay.
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { G, MUT, PROGRESS_GREEN, SR_ONLY, WHITE } from "../../design-tokens.js";

const EASE_OUT = [0.22, 1, 0.36, 1];
const EASE_IN_OUT = [0.65, 0, 0.35, 1];

const POP_SCALE = [1, 1.08, 1];
const FLICK = [0, 8, -2, 0];
const FLICK_TIMES = [0, 0.35, 0.7, 1];

const FILL = { duration: 0.24, ease: EASE_OUT };
const POP = { duration: 0.34, ease: EASE_OUT, times: [0, 0.4, 1] };
const TICK = { duration: 0.22, ease: EASE_OUT, delay: 0.06 };
const STRIKE = { duration: 0.38, ease: EASE_IN_OUT };
const NUDGE = { duration: 0.3, ease: EASE_OUT, times: FLICK_TIMES };
const REORDER = { type: "spring", stiffness: 320, damping: 30 };
const INSTANT = { duration: 0 };

// Dashes divide the circumference, so the ring closes without a seam.
const RING_R = 11;
const RING_DASH = `1 ${(2 * Math.PI * RING_R) / 13 - 1}`;
const RING = "rgba(22,47,36,0.28)";

// The strike rides on the text itself, so a label that wraps gets a line per
// row.
const STRIKE_STYLE = {
  backgroundImage: "linear-gradient(currentColor, currentColor)",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "0 52%",
  boxDecorationBreak: "clone",
  WebkitBoxDecorationBreak: "clone",
};

// The check is one line box tall at every size, so it sits on the first line.
const SIZES = {
  sm: { gap: "10px", radius: "12px", pad: "8px 12px", check: 20, font: "13px", lh: "20px", line: "1.5px", list: "6px" },
  md: { gap: "12px", radius: "14px", pad: "10px 14px", check: 24, font: "15px", lh: "24px", line: "2px", list: "8px" },
  lg: { gap: "14px", radius: "16px", pad: "12px 16px", check: 28, font: "17px", lh: "28px", line: "2.5px", list: "10px" },
};

const CARD_SHADOW = "0 1px 2px rgba(22,47,36,0.04), 0 3px 10px rgba(22,47,36,0.06)";

// Ticking runs tick to strike to nudge; unticking runs the same road backwards.
const FILLED = ["tick", "strike", "nudge", "settled", "unstrike"];
const STRUCK = ["strike", "nudge", "settled"];

function useTiming() {
  const reduced = useReducedMotion() ?? false;
  return (transition) => (reduced ? INSTANT : transition);
}

function TaskCheck({ filled, size, accent, onDrawn }) {
  const timing = useTiming();
  const px = SIZES[size].check;
  return (
    <motion.svg viewBox="0 0 24 24" aria-hidden="true" width={px} height={px} style={{ flexShrink: 0, color: RING }}
      initial={false} animate={{ scale: filled ? POP_SCALE : 1 }} transition={filled ? timing(POP) : INSTANT}>
      <motion.circle cx="12" cy="12" r={RING_R} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={RING_DASH}
        initial={false} animate={{ opacity: filled ? 0 : 1 }} transition={timing(FILL)} />
      <motion.circle cx="12" cy="12" r="12" fill={accent} style={{ transformBox: "view-box", transformOrigin: "12px 12px" }}
        initial={false} animate={{ scale: filled ? 1 : 0 }} transition={timing(FILL)} />
      <motion.path d="M7.4 12.4 10.6 15.5 16.6 8.9" fill="none" stroke={WHITE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        initial={false} animate={{ pathLength: filled ? 1 : 0, opacity: filled ? 1 : 0 }} transition={timing(TICK)} onAnimationComplete={onDrawn} />
    </motion.svg>
  );
}

function TaskLabel({ label, struck, size, onStruck }) {
  const timing = useTiming();
  const { font, lh, line } = SIZES[size];
  return (
    <span style={{ minWidth: 0, flex: 1 }}>
      <motion.span
        style={{ ...STRIKE_STYLE, fontSize: font, lineHeight: lh, fontWeight: 500, letterSpacing: "-0.01em", color: struck ? MUT : G, transition: "color 300ms" }}
        initial={false}
        animate={{ backgroundSize: `${struck ? 100 : 0}% ${line}` }}
        transition={timing(STRIKE)}
        onAnimationComplete={onStruck}
      >
        {label}
      </motion.span>
    </span>
  );
}

export function TaskItem({ label, checked, defaultChecked = false, size = "sm", accent = PROGRESS_GREEN, onCheckedChange, onSettled, onReverted, onClick, style, ...props }) {
  const timing = useTiming();
  const [own, setOwn] = useState(defaultChecked);
  const done = checked ?? own;

  const [stage, setStage] = useState(done ? "settled" : "idle");
  const [was, setWas] = useState(done);

  // Turn around in the same render the tick flips, so the row never paints
  // stale.
  if (was !== done) {
    setWas(done);
    setStage(done ? "tick" : "unstrike");
  }

  const onDrawn = () => {
    if (stage === "tick") setStage("strike");
    if (stage === "untick") {
      setStage("idle");
      onReverted?.();
    }
  };

  const onStruck = () => {
    if (stage === "strike") setStage("nudge");
    if (stage === "unstrike") setStage("untick");
  };

  const onFlicked = () => {
    if (stage !== "nudge") return;
    setStage("settled");
    onSettled?.();
  };

  const s = SIZES[size];
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={done}
      data-slot="task-item"
      data-state={done ? "checked" : "unchecked"}
      onClick={(event) => {
        onClick?.(event);
        if (checked === undefined) setOwn(!done);
        onCheckedChange?.(!done);
      }}
      animate={{ x: stage === "nudge" ? FLICK : 0 }}
      transition={stage === "nudge" ? timing(NUDGE) : INSTANT}
      onAnimationComplete={onFlicked}
      style={{ display: "flex", alignItems: "flex-start", gap: s.gap, width: "fit-content", maxWidth: "100%", padding: s.pad, borderRadius: s.radius, border: "none", background: WHITE, boxShadow: CARD_SHADOW, textAlign: "left", cursor: "pointer", fontFamily: "inherit", ...style }}
      {...props}
    >
      <TaskCheck filled={FILLED.includes(stage)} size={size} accent={accent} onDrawn={onDrawn} />
      <TaskLabel label={label} struck={STRUCK.includes(stage)} size={size} onStruck={onStruck} />
    </motion.button>
  );
}

export function TaskList({ tasks, defaultTasks = [], size = "sm", accent, onTasksChange, style, ...props }) {
  const timing = useTiming();
  const [own, setOwn] = useState(defaultTasks);
  const current = tasks ?? own;

  const [parked, setParked] = useState(() => (tasks ?? defaultTasks).filter((task) => task.done).map((task) => task.id));
  const [announcement, setAnnouncement] = useState("");

  const toggle = (task, done) => {
    const next = current.map((item) => (item.id === task.id ? { ...item, done } : item));
    if (tasks === undefined) setOwn(next);
    onTasksChange?.(next);
    setAnnouncement(`${task.label} ${done ? "completed" : "reopened"}`);
  };

  // A parked row that is no longer done, or gone, was changed from outside.
  const finished = parked.map((id) => current.find((task) => task.id === id)).filter((task) => task?.done === true);
  const open = current.filter((task) => !finished.includes(task));

  return (
    <ul data-slot="task-list" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SIZES[size].list, width: "fit-content", maxWidth: "100%", listStyle: "none", margin: 0, padding: 0, ...style }} {...props}>
      {[...open, ...finished].map((task) => (
        <motion.li key={task.id} layout transition={timing(REORDER)} style={{ maxWidth: "100%" }}>
          <TaskItem
            label={task.label}
            checked={!!task.done}
            size={size}
            accent={accent}
            onCheckedChange={(done) => toggle(task, done)}
            onSettled={() => setParked((ids) => (ids.includes(task.id) ? ids : [...ids, task.id]))}
            onReverted={() => setParked((ids) => ids.filter((id) => id !== task.id))}
          />
        </motion.li>
      ))}
      <li role="status" aria-live="polite" style={SR_ONLY}>{announcement}</li>
    </ul>
  );
}

export default TaskList;
