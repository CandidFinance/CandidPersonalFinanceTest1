import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { tap } from "./haptics.js";

// A ready-made figure ("£1,234 a year", "12 months") whose first number
// counts up from nothing, once, with a buzz as it lands; the rest of the text
// stays put. `run={false}`, reduced motion, or no number: just the text.
// Adapted from the landing page's CountUpStat.
const AMOUNT = /(£?)(\d[\d,]*(?:\.\d+)?)/;

export default function CountUpFigure({ text, run = true }) {
  const reduceMotion = useReducedMotion();
  const match = typeof text === "string" ? text.match(AMOUNT) : null;
  const target = match ? parseFloat(match[2].replace(/,/g, "")) : 0;
  const decimals = match?.[2].split(".")[1]?.length || 0;
  // A year ("in 2041") stays as it is: counting up to it means nothing.
  const year = match && !match[1] && /^(19|20)\d\d$/.test(match[2]);
  const live = run && !reduceMotion && target > 0 && !year;
  const [value, setValue] = useState(live ? 0 : target);

  useEffect(() => {
    if (!live) return;
    const controls = animate(0, target, { duration: 0.9, ease: [0.2, 0.7, 0.3, 1], onUpdate: setValue, onComplete: () => tap(15) });
    return () => controls.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!live) return text;
  const shown = value.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <>
      {/* The whole figure for screen readers; the count is for the eye. */}
      <span aria-hidden="true" style={{ fontVariantNumeric: "tabular-nums" }}>{text.slice(0, match.index)}{match[1]}{shown}{text.slice(match.index + match[0].length)}</span>
      <span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>{text}</span>
    </>
  );
}
