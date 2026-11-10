// A drop-down pill. A native <select> underneath, so phones show their own
// picker. Same height, fill and field states as PillMoneyInput, so a £ field
// and a drop-down sit level in a row.
//
// With a `label`: a small caption on top, the choice below (as PillMoneyInput).
// Without one: a single line, the visible text a span with a transparent 16px
// <select> laid over it (iOS Safari zooms on any select under 16px).
// `short` on an option is shown in the pill when space is tight; the picker
// always lists the full labels.
// `state` (fieldState.js): "actual", "estimate" or "empty", as on Edit inputs.
// size: "default" (PILL_HEIGHT, 44px unless a screen sets --pill-height) or
// "compact" (37px).
import { ChevronDown } from "lucide-react";
import { MUT, TEXT, CDARK, FONT_SIZE, PILL_HEIGHT, RADIUS, CONTROL_HEIGHT } from "../../design-tokens.js";
import { pillFieldStyle } from "../PillMoneyInput.jsx";
import { stateFill, stateBorder, EMPTY_TEXT } from "../fieldState.js";

export function Select({ label, value, onChange, options, placeholder = "Choose", ariaLabel, state = null, size = "default", style }) {
  const chosen = options.find((o) => o.value === value);
  const pill = {
    flex: 1, minWidth: 0, position: "relative", boxSizing: "border-box", display: "flex", cursor: "pointer",
    background: stateFill(state, CDARK), border: stateBorder(state), borderRadius: RADIUS.pill,
    height: size === "compact" ? CONTROL_HEIGHT.compact : PILL_HEIGHT, ...style,
  };
  const empty = state === "empty" && !chosen;
  const chevron = <ChevronDown size={16} color={MUT} aria-hidden="true" style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />;
  const choices = (
    <>
      <option value="" disabled>{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </>
  );

  if (!label) {
    return (
      <label className="pill-field" style={{ ...pill, alignItems: "center", padding: "0 30px 0 14px" }}>
        <span style={{ fontSize: FONT_SIZE.BODY, fontWeight: 600, color: chosen ? TEXT : empty ? EMPTY_TEXT : MUT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {chosen ? (chosen.short || chosen.label) : placeholder}
        </span>
        {chevron}
        <select value={value || ""} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel || placeholder}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, fontSize: "16px", cursor: "pointer" }}>
          {choices}
        </select>
      </label>
    );
  }

  return (
    <label className="pill-field" style={{ ...pill, flexDirection: "column", justifyContent: "center", padding: "0 16px" }}>
      <span style={{ fontSize: "9.5px", fontWeight: 600, color: MUT, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)}
        style={{ appearance: "none", WebkitAppearance: "none", border: "none", background: "none", color: value ? TEXT : empty ? EMPTY_TEXT : MUT, padding: "0 24px 0 0", margin: 0, outline: "none", cursor: "pointer", ...pillFieldStyle("100%") }}>
        {choices}
      </select>
      {chevron}
    </label>
  );
}

export default Select;
