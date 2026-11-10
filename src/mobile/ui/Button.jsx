// The app's one button. Every pill-shaped action uses this, so a button looks,
// presses and disables the same way on every screen.
//
// variant: "primary"   filled, the main action (one per view)
//          "secondary" white with an edge, the choice beside a primary
//          "text"      no fill, a quieter way out ("Not now", "Skip")
//          "blue"      shorthand for primary in the blue tone
// tone:    "green" (default), "blue" (CTA_BLUE: the paywall and invites
//          only), "danger" (deleting something for good)
// Every button is 37px with 13px words (Harvey, 10 Nov 2026: 44px felt too
// tall), with a 44px tap area. (`size` is still accepted and ignored.)
// loading: true while the action runs; `loadingLabel` replaces the words
//          ("Saving…") and the button can't be pressed again.
// icon:    a lucide icon component, drawn before the words.
//
// buttonStyle(...) gives the same look for an <a> that must stay a link.
import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { G, WHITE, CTA_BLUE, ERROR_TEXT, SANS, RADIUS, CONTROL_HEIGHT, BUTTON_HEIGHT, DISABLED_OPACITY, PRESS_SCALE } from "../../design-tokens.js";
import { tap } from "../haptics.js";

const TONES = { green: G, blue: CTA_BLUE, danger: ERROR_TEXT };

const SIZE = { height: BUTTON_HEIGHT, fontSize: "13px", padding: "8px 16px", icon: 15 };

function look(variant, tone) {
  const c = TONES[variant === "blue" ? "blue" : tone] || G;
  if (variant === "secondary") return { background: WHITE, color: c, border: `1.5px solid ${c}` };
  if (variant === "text") return { background: "none", color: c, border: "none" };
  return { background: c, color: WHITE, border: "none" };
}

export function buttonStyle({ variant = "primary", tone = "green", fullWidth = false, disabled = false } = {}) {
  const text = variant === "text";
  return {
    ...look(variant, tone),
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
    width: fullWidth ? "100%" : undefined,
    // 37px for one line; a long label on a narrow phone wraps and the pill
    // grows rather than spilling out. A text button has no pill to see, so it
    // keeps the full tap height.
    minHeight: text ? CONTROL_HEIGHT.default : SIZE.height,
    padding: text ? "0 4px" : SIZE.padding,
    boxSizing: "border-box",
    borderRadius: RADIUS.pill,
    fontFamily: SANS, fontSize: SIZE.fontSize, fontWeight: 700, lineHeight: 1.2,
    textAlign: "center", textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? DISABLED_OPACITY : 1,
  };
}

export const Button = forwardRef(function Button({
  variant = "primary", tone = "green", size: _size, fullWidth = false, disabled = false, loading = false, loadingLabel,
  icon: Icon, haptic = variant === "primary" || variant === "blue", type = "button", onClick, className, style, children, ...rest
}, ref) {
  const reduced = useReducedMotion() ?? false;
  const off = disabled || loading;
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={off}
      aria-busy={loading || undefined}
      onClick={(e) => { if (haptic) tap(); onClick?.(e); }}
      whileTap={off || reduced ? undefined : { scale: PRESS_SCALE }}
      transition={{ duration: 0.12 }}
      // tap44: a 44px tap area round the 37px pill.
      className={["tap44", className].filter(Boolean).join(" ")}
      // Loading isn't the disabled look: the button stays solid while it works.
      style={{ ...buttonStyle({ variant, tone, fullWidth, disabled }), cursor: off ? (loading ? "progress" : "not-allowed") : "pointer", ...style }}
      {...rest}
    >
      {Icon && <Icon size={SIZE.icon} strokeWidth={2.2} aria-hidden="true" style={{ flexShrink: 0 }} />}
      {loading && loadingLabel ? loadingLabel : children}
    </motion.button>
  );
});

export default Button;
