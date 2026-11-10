// Chip: a small pill you tap. With `pressed` it's a toggle (a filter, a
// quick pick, "Include bonus"); without, a small action. 32px tall with a
// 44px tap area.
// Tag: a small label that isn't tapped (a status: "On track", "New",
// "Estimate"). Caps on a pale wash of its own colour.
//
// <Chip pressed={on} onClick={() => setOn(!on)}>Include bonus</Chip>
// <Tag color={SUCCESS}>On track</Tag>
import { G, WHITE, CDARK, MUT_ON_CDARK, RADIUS, DISABLED_OPACITY } from "../../design-tokens.js";

export function Chip({ pressed, onClick, disabled = false, icon: Icon, children, style, ...rest }) {
  const toggle = pressed !== undefined;
  const on = !!pressed;
  return (
    <button
      type="button"
      aria-pressed={toggle ? on : undefined}
      disabled={disabled}
      onClick={onClick}
      className="tap44"
      style={{
        display: "inline-flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 12px", boxSizing: "border-box",
        borderRadius: RADIUS.pill, border: "none", fontFamily: "inherit", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap",
        background: on ? G : toggle ? CDARK : WHITE, color: on ? WHITE : toggle ? MUT_ON_CDARK : G,
        boxShadow: toggle ? "none" : "inset 0 0 0 1px rgba(22,47,36,0.15)",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? DISABLED_OPACITY : 1,
        transition: "background 150ms ease, color 150ms ease",
        ...style,
      }}
      {...rest}
    >
      {Icon && <Icon size={14} strokeWidth={2.2} aria-hidden="true" />}
      {children}
    </button>
  );
}

// `color` is a 6-digit hex; the wash is the same colour at about 9%.
export function Tag({ color = G, children, style, ...rest }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: RADIUS.pill,
        fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1.3, whiteSpace: "nowrap",
        color, background: `${color}18`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}

export default Chip;
