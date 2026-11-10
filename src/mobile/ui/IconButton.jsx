// A round button holding one icon: close, back, more, next. `label` is
// required, since it's all a screen reader has.
//
// size:    34 (a sheet's back and close) or 28 (inside a tile; it keeps a
//          44px tap area through the global .tap44 class).
// variant: "white" (on cream or a tinted header), "plain" (no fill, on
//          white), "tint" (a pale wash of `color`, e.g. the paywall's blue).
import { forwardRef } from "react";
import { G, WHITE, DISABLED_OPACITY } from "../../design-tokens.js";

const ICON_PX = { 34: 18, 28: 15 };

export const IconButton = forwardRef(function IconButton({ icon: Icon, label, size = 34, variant = "white", color = G, disabled = false, onClick, style, className, ...rest }, ref) {
  const bg = variant === "white" ? WHITE : variant === "tint" ? `${color}1a` : "transparent";
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[size < 44 ? "tap44" : null, className].filter(Boolean).join(" ") || undefined}
      style={{
        width: `${size}px`, height: `${size}px`, flexShrink: 0, borderRadius: "50%", border: "none", padding: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: bg, color, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? DISABLED_OPACITY : 1,
        ...style,
      }}
      {...rest}
    >
      <Icon size={ICON_PX[size] || Math.round(size * 0.5)} aria-hidden="true" />
    </button>
  );
});

export default IconButton;
