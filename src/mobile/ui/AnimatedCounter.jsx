// A number whose digits roll like a wheel to each new value, for figures that
// count (a £ total going up as answers come in, a score). Each digit is its
// own column, so only the places that change move.
//
// Usage: <AnimatedCounter value={12450} prefix="£" style={{ fontFamily: SERIF }} />
// It takes the font, size and colour of its parent; screen readers get the
// plain number.
//
// Ported from Rare UI's animated-counter (TypeScript + Tailwind) to plain JS,
// inline styles and framer-motion. React 18: Digit and Mark forward refs, which
// AnimatePresence's popLayout needs to measure a leaving column.
// Rare UI, https://rareui.com
// Copyright (c) 2026 Swami Malode. MIT + Commons Clause License Condition v1.0
// + Attribution: use is allowed as part of an application; the components may
// not be sold, sublicensed or redistributed themselves; Rare UI is credited
// with a visible link (Account > Legal documents), and this notice must stay.
import { forwardRef, memo, useEffect, useMemo, useRef, useState } from "react";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { SR_ONLY } from "../../design-tokens.js";

const FACES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
// The trailing 0 makes the wrap from 9 back to 0 land on an identical face.
const WHEEL = [...FACES, 0];

// The air around each face is what the mask fades through, so a resting digit
// stays solid.
const LINE = 1.5;
// Eased rather than a straight ramp: a linear fade of the same width reads as a
// hard edge.
const FADE = `linear-gradient(to bottom,
  rgba(0,0,0,0) 0%,
  rgba(0,0,0,0.06) 5.5%,
  rgba(0,0,0,0.5) 11%,
  rgba(0,0,0,0.94) 16.5%,
  #000 22%,
  #000 78%,
  rgba(0,0,0,0.94) 83.5%,
  rgba(0,0,0,0.5) 89%,
  rgba(0,0,0,0.06) 94.5%,
  rgba(0,0,0,0) 100%)`;

const EASE = [0.22, 1, 0.36, 1];
const BOUNCE = 0.18;
const LEAVE = { duration: 0.18, ease: EASE };
const INSTANT = { duration: 0 };

const spring = (duration) => ({ type: "spring", visualDuration: duration, bounce: BOUNCE });

const MAX_DECIMALS = 15;
const MAX_PAD = 24;
const MIN_DURATION = 0.01;
const MAX_DURATION = 60;

const mod = (n, m) => ((n % m) + m) % m;
const clamp = (n, low, high) => Math.min(high, Math.max(low, Number.isFinite(n) ? n : low));
const isDigit = (char) => char >= "0" && char <= "9";

// Built once, so React skips reconciling 21 spans per digit on every change.
const SIZER = FACES.map((face) => (
  <span key={face} aria-hidden="true" style={{ visibility: "hidden", gridArea: "1 / 1" }}>{face}</span>
));

const STACK = WHEEL.map((face, index) => (
  <span key={index} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: `${LINE}em` }}>{face}</span>
));

const EVERY_THREE = /\B(?=(\d{3})+(?!\d))/g;

function group(whole, separator) {
  return separator ? whole.replace(EVERY_THREE, separator) : whole;
}

function measure(value, decimals, padStart, duration) {
  // NaN would make the previous-value comparison true forever.
  const amount = Number.isFinite(value) ? value : 0;
  const places = clamp(Math.trunc(decimals), 0, MAX_DECIMALS);
  const pad = clamp(Math.trunc(padStart), 1, MAX_PAD);
  // Past MAX_SAFE_INTEGER the digits are noise, and past 1e21 String() turns
  // exponential.
  const scaled = Math.min(Number.MAX_SAFE_INTEGER, Math.round(Math.abs(amount) * 10 ** places));
  return {
    amount,
    scaled,
    places,
    pace: clamp(duration, MIN_DURATION, MAX_DURATION),
    width: Math.max(String(scaled).length, places + pad),
  };
}

function format({ scaled, places, width }, separator, decimalSeparator) {
  const raw = String(scaled).padStart(width, "0");
  const whole = group(raw.slice(0, raw.length - places) || "0", separator);
  return places ? `${whole}${decimalSeparator}${raw.slice(raw.length - places)}` : whole;
}

// Keyed by distance from the right, so gaining a place moves columns rather
// than remounting them.
function toCells(chars, width) {
  const cells = [];
  let seen = 0;
  // Only digits advance the place, so a multi-character separator would repeat
  // a key.
  let run = 0;
  for (const char of chars) {
    if (isDigit(char)) {
      run = 0;
      cells.push({ kind: "digit", key: width - seen++, digit: Number(char) });
    } else {
      cells.push({ kind: "mark", key: `mark-${width - seen}-${run++}`, char });
    }
  }
  return cells;
}

function useWheel(from, digit, dir, duration, reduced) {
  const pos = useMotionValue(from);
  const goal = useRef(from);

  // Read rather than depended on: a reversal alone must not restart every
  // column.
  const heading = useRef(dir);
  useEffect(() => { heading.current = dir; }, [dir]);

  useEffect(() => {
    if (reduced) {
      goal.current = digit;
      pos.set(digit);
      return undefined;
    }
    // Re-aim only when the face changed, or a reversal sends the wheel the long
    // way round.
    if (mod(goal.current, 10) !== digit) {
      // Aim from where the wheel is, so a moving value never queues up a
      // backlog of turns.
      const at = pos.get();
      goal.current = heading.current < 0 ? at - mod(at - digit, 10) : at + mod(digit - at, 10);
    }
    const roll = animate(pos, goal.current, spring(duration));
    return () => roll.stop();
  }, [digit, duration, reduced, pos]);

  return useTransform(pos, (p) => `${(-mod(p, 10) * 100) / WHEEL.length}%`);
}

const shifts = ({ reduced, dep, shift }) => ({ layout: !reduced, layoutDependency: dep, transition: shift });

const fades = (reduced) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: reduced ? INSTANT : LEAVE },
});

function Fixed({ children, reduced, dep, shift }) {
  return <motion.span {...shifts({ reduced, dep, shift })} style={{ display: "inline-block" }}>{children}</motion.span>;
}

const Mark = forwardRef(function Mark({ char, reduced, dep, shift }, ref) {
  return (
    <motion.span ref={ref} data-slot="animated-counter-mark" {...shifts({ reduced, dep, shift })} {...fades(reduced)} style={{ display: "inline-block" }}>
      {char}
    </motion.span>
  );
});

const Digit = memo(forwardRef(function Digit({ digit, from, dir, duration, reduced, dep, shift }, ref) {
  const y = useWheel(from, digit, dir, duration, reduced);
  return (
    <motion.span
      ref={ref}
      data-slot="animated-counter-digit"
      {...shifts({ reduced, dep, shift })}
      {...fades(reduced)}
      style={{ position: "relative", display: "inline-grid", overflow: "hidden", height: `${LINE}em`, lineHeight: LINE, maskImage: FADE, WebkitMaskImage: FADE }}
    >
      {/* Widest-face width, for fonts with no tabular figures. */}
      {SIZER}
      <motion.span style={{ y, position: "absolute", left: 0, right: 0, top: 0 }}>{STACK}</motion.span>
    </motion.span>
  );
}));

export function AnimatedCounter({
  value,
  decimals = 0,
  duration = 0.6,
  padStart = 1,
  separator = ",",
  decimalSeparator = ".",
  prefix,
  suffix,
  style,
  ...props
}) {
  const reduced = useReducedMotion() ?? false;

  const shape = measure(value, decimals, padStart, duration);
  const chars = format(shape, separator, decimalSeparator);
  const cells = toCells(chars, shape.width);
  const negative = shape.amount < 0 && shape.scaled > 0;

  const [previous, setPrevious] = useState(shape.amount);
  const [dir, setDir] = useState(1);
  if (previous !== shape.amount) {
    setDir(shape.amount >= previous ? 1 : -1);
    setPrevious(shape.amount);
  }

  // Faces at mount; a place that appears later starts from 0 and rolls in.
  const [seed] = useState(() => {
    const faces = {};
    for (const cell of cells) if (cell.kind === "digit") faces[cell.key] = cell.digit;
    return faces;
  });

  const shift = useMemo(() => (reduced ? INSTANT : spring(shape.pace)), [reduced, shape.pace]);
  const slot = { reduced, dep: chars.length, shift };

  return (
    <span data-slot="animated-counter" style={{ display: "inline-flex", alignItems: "center", fontVariantNumeric: "tabular-nums", ...style }} {...props}>
      {prefix != null && <Fixed {...slot}>{prefix}</Fixed>}

      <span style={SR_ONLY}>
        {negative ? "-" : ""}
        {typeof prefix === "string" ? prefix : ""}
        {chars}
        {typeof suffix === "string" ? suffix : ""}
      </span>

      <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", userSelect: "none" }}>
        {negative && <Fixed {...slot}>-</Fixed>}
        <AnimatePresence mode="popLayout" initial={false}>
          {cells.map((cell) =>
            cell.kind === "digit" ? (
              <Digit key={cell.key} {...slot} digit={cell.digit} from={seed[cell.key] ?? 0} dir={dir} duration={shape.pace} />
            ) : (
              <Mark key={cell.key} {...slot} char={cell.char} />
            ),
          )}
        </AnimatePresence>
      </span>

      {suffix != null && <Fixed {...slot}>{suffix}</Fixed>}
    </span>
  );
}

export default AnimatedCounter;
