// Confetti for a milestone (a module finished, a goal reached). Two ways in:
//   fireConfetti(fromElement?)  - a burst from an element (or the screen's
//                                 middle), drawn on a full-screen canvas.
//   <Confetti ref={r} manualstart /> then r.current.fire() - a burst inside
//                                 a canvas you place yourself.
// Both use Candid's palette and draw nothing when the phone asks for reduced
// motion.
//
// Ported from Magic UI's confetti (MIT, https://magicui.design) to plain JS;
// the ConfettiButton became fireConfetti so any button can use it.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import confetti from "canvas-confetti";
import { G, GOLD, PROGRESS_GREEN, CDARK, GAIN_ON_DARK } from "../../design-tokens.js";

export const CONFETTI_COLORS = [G, GOLD, PROGRESS_GREEN, GAIN_ON_DARK, CDARK];

const BASE = { colors: CONFETTI_COLORS, disableForReducedMotion: true, particleCount: 90, spread: 70, startVelocity: 38, ticks: 220, scalar: 0.9 };

export function fireConfetti(fromElement, options = {}) {
  let origin = { x: 0.5, y: 0.55 };
  if (fromElement && typeof fromElement.getBoundingClientRect === "function") {
    const r = fromElement.getBoundingClientRect();
    origin = { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight };
  }
  try {
    // Above the app's sheets (Account and Premium sit at 4600).
    return confetti({ zIndex: 9999, ...BASE, ...options, origin });
  } catch (error) {
    if (import.meta.env.DEV) console.warn("[Candid] Confetti error:", error);
    return undefined;
  }
}

export const Confetti = forwardRef(function Confetti({ options, globalOptions = { resize: true, useWorker: true }, manualstart = false, children, ...rest }, ref) {
  const canvasNodeRef = useRef(null);
  const instanceRef = useRef(null);
  const optionsRef = useRef(options);
  const globalOptionsRef = useRef(globalOptions);

  useEffect(() => { optionsRef.current = options; }, [options]);
  useEffect(() => { globalOptionsRef.current = globalOptions; }, [globalOptions]);

  useEffect(() => {
    if (canvasNodeRef.current && !instanceRef.current) {
      instanceRef.current = confetti.create(canvasNodeRef.current, { resize: true, useWorker: true, ...globalOptionsRef.current });
    }
    return () => {
      instanceRef.current?.reset();
      instanceRef.current = null;
    };
  }, []);

  const fire = useCallback(async (opts = {}) => {
    try {
      await instanceRef.current?.({ ...BASE, ...optionsRef.current, ...opts });
    } catch (error) {
      if (import.meta.env.DEV) console.warn("[Candid] Confetti error:", error);
    }
  }, []);

  const api = useMemo(() => ({ fire }), [fire]);
  useImperativeHandle(ref, () => api, [api]);

  useEffect(() => {
    if (!manualstart) void fire();
  }, [manualstart, fire]);

  return (
    <>
      <canvas ref={canvasNodeRef} aria-hidden="true" {...rest} />
      {children}
    </>
  );
});

export default Confetti;
