// Shared motion helpers for the marketing site. Per the brief: continual
// upward growth (everything that enters rises; nothing slides in sideways,
// which once widened phone screens mid-reveal) and slow and steady (long,
// gentle deceleration, no snap or bounce).

export const EASE_STEADY = [0.22, 1, 0.36, 1];

// A single element's scroll entrance — headings, rows, one-off blocks.
export function riseIn(reduceMotion, { delay = 0, duration = 0.65, y = 30 } = {}) {
  if (reduceMotion) return { initial: false };
  return {
    initial: { opacity: 0, y },
    whileInView: { opacity: 1, y: 0, transition: { duration, ease: EASE_STEADY, delay } },
    viewport: { once: true, margin: "-80px" },
  };
}
