import { useNavigate } from "react-router-dom";
import posthog from "posthog-js";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { WHITE, SANS, CTA_BLUE } from "../design-tokens.js";
import { reportStorageFailure } from "../lib/storage.js";

export { CTA_BLUE };

// Where a visitor lands on entering the app: someone with a saved report, or
// who has been through the app's entry, goes straight back in; everyone
// else starts the entry. Always the
// mobile-native app (/app/...), regardless of viewport.
export function appEntryPath() {
  try {
    const savedInputs = localStorage.getItem('candid_inputs');
    const hasSavedInsights = !!localStorage.getItem('candid_insights');
    if (savedInputs && (hasSavedInsights || JSON.parse(savedInputs).appEntered)) return "/app/home";
  } catch (e) { reportStorageFailure("read_inputs_for_entry", e); }
  return "/app/start";
}

// The CTA's label, shared with the site header so every "start" button reads
// the same. It says what you get, not "Beta" (testers didn't read the old
// "Beta - Optimise my money" as the way into the product). "Could save"
// matches the landing page's framing: money lost that Candid helps save.
export const CTA_LABEL = "See what I could save";

// The Statement design's button corners (design/landing/statement-lab.html).
export const CTA_RADIUS = "12px";

// Main marketing CTA: one click straight into the app, no sign-up. `source`
// tags which section of the site it was clicked from in analytics. `size`
// "large" is the hero's version: bigger, so it is unmistakably the thing to
// press.
export default function StartCheckButton({ source, size = "regular" }) {
  const large = size === "large";
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();

  function start() {
    posthog.capture("start_check_clicked", { source });
    navigate(appEntryPath());
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <motion.button
      type="button" onClick={start}
      whileHover={reduceMotion ? undefined : { scale: 1.03 }}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px",
        background: CTA_BLUE, border: "none", borderRadius: CTA_RADIUS,
        padding: large ? "20px 36px" : "16px 30px",
        fontSize: large ? "18px" : "15px", fontWeight: 700, color: WHITE, fontFamily: SANS, cursor: "pointer",
      }}
    >
      {CTA_LABEL}
      <ArrowRight size={large ? 20 : 17} strokeWidth={2.5} />
    </motion.button>
  );
}
