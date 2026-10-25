// A short buzz on a moment worth feeling: a check ticking, a figure landing.
// Android only (iOS Safari has no web vibration), and never for anyone who
// has asked for less motion.
export function tap(ms = 10) {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate(ms);
  } catch { /* not allowed here */ }
}
