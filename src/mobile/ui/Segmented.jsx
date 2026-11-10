// One choice from two to four named options, side by side on a track: a
// year, a view, "Relief at source / Salary sacrifice". Arrow keys move the
// choice. For an answer to a question in a form, PillSlider (same look, with
// the field states) is still the one to use.
//
// <Segmented ariaLabel="Tax year" value={y} onChange={setY}
//   options={[{ value: "2026", label: "2026/27" }, { value: "2027", label: "2027/28" }]} />
//
// size: "default" 37px, "compact" 32px (inside a tile).
// onDark: on the dark green band, a see-through track and cream text.
import { useRef } from "react";
import { G, WHITE, CDARK, CREAM, MUT_ON_CDARK, RADIUS, CONTROL_HEIGHT } from "../../design-tokens.js";

const HEIGHT = { default: CONTROL_HEIGHT.compact, compact: "32px" };

export function Segmented({ options, value, onChange, ariaLabel, size = "default", onDark = false, fullWidth = true, style }) {
  const buttons = useRef([]);
  const at = options.findIndex((o) => o.value === value);

  const onKeyDown = (e, i) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const next = (i + step + options.length) % options.length;
    onChange(options[next].value);
    buttons.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel}
      style={{ display: fullWidth ? "flex" : "inline-flex", width: fullWidth ? "100%" : undefined, boxSizing: "border-box", padding: "3px", borderRadius: RADIUS.pill, background: onDark ? "rgba(250,247,240,0.12)" : CDARK, ...style }}>
      {options.map((o, i) => {
        const on = i === at;
        return (
          <button key={o.value} ref={(n) => { buttons.current[i] = n; }} type="button" role="radio" aria-checked={on}
            tabIndex={i === Math.max(at, 0) ? 0 : -1}
            onClick={() => onChange(o.value)} onKeyDown={(e) => onKeyDown(e, i)}
            style={{
              flex: fullWidth ? 1 : "0 0 auto", minHeight: `calc(${HEIGHT[size] || HEIGHT.default} - 6px)`, padding: "0 12px",
              borderRadius: RADIUS.pill, border: "none", cursor: "pointer", fontFamily: "inherit",
              fontSize: size === "compact" ? "11.5px" : "12px", fontWeight: 600, whiteSpace: "nowrap",
              background: on ? (onDark ? CREAM : G) : "transparent",
              color: on ? (onDark ? G : WHITE) : (onDark ? "rgba(250,247,240,0.75)" : MUT_ON_CDARK),
              transition: "background 200ms ease, color 200ms ease",
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default Segmented;
