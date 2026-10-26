// "Mark as reviewed": one pace for the celebration wherever it's tapped
// (Modules list, module page). The button warms gold, two coins rise and
// fade, and "Reviewed" fades in part-way through, unhurried. Keyframes
// (coinFloat, btnGoldTint, reviewedIn) are in MobileLayout.jsx.
export const REVIEW_COIN_S = 1.8;          // each coin's rise
export const REVIEW_COIN_STAGGER_S = 0.3;  // second coin after the first
export const REVIEW_TINT_S = 1.4;          // the button's gold warmth
export const REVIEW_SWAP_MS = 700;         // when the label turns to "Reviewed"
export const REVIEW_CELEBRATE_MS = (REVIEW_COIN_S + REVIEW_COIN_STAGGER_S) * 1000;
