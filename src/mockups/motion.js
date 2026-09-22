// Shared motion helpers for the /new mock-up. Three themes drive every
// animation here, per the brief:
//   - continual upward growth — everything that enters rises; nothing drops
//     in or slides in sideways-only.
//   - slow and steady — long, gentle deceleration, no snap or bounce.
//   - creating simplicity from complexity — a row of tiles starts fanned
//     outward and slightly rotated (scattered) and pulls together into its
//     tidy final line as it settles.

export const EASE_STEADY = [0.22, 1, 0.36, 1];

// A single element's scroll entrance — headings, one-off blocks.
export function riseIn(reduceMotion, { delay = 0, duration = 0.65, y = 30 } = {}) {
  if (reduceMotion) return { initial: false };
  return {
    initial: { opacity: 0, y },
    whileInView: { opacity: 1, y: 0, transition: { duration, ease: EASE_STEADY, delay } },
    viewport: { once: true, margin: "-80px" },
  };
}

// One tile at position `i` of `n` in a row — starts fanned outward from the
// row's centre (further tiles start further out and rotated more) and lower
// down, then pulls together and rises into its resting place. Each tile
// lags the last by `stagger` seconds, so the row visibly converges rather
// than appearing all at once.
export function pullTogether(i, n, reduceMotion, { stagger = 0.12, duration = 0.75, spreadPx = 46, riseYPx = 54 } = {}) {
  if (reduceMotion) return { initial: false };
  const center = (n - 1) / 2;
  const spread = n > 1 ? i - center : 0;
  return {
    initial: { opacity: 0, x: spread * spreadPx, y: riseYPx, rotate: spread * -5 },
    whileInView: { opacity: 1, x: 0, y: 0, rotate: 0, transition: { duration, ease: EASE_STEADY, delay: i * stagger } },
    viewport: { once: true, margin: "-60px" },
  };
}

// Hero cascade — plays once on mount (not scroll-linked, it's above the
// fold), each child rising in slightly after the last.
export const heroStagger = { hidden: {}, visible: { transition: { staggerChildren: 0.16, delayChildren: 0.05 } } };
export const heroItem = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_STEADY } },
};
