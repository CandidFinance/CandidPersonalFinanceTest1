// A typed field: email, a name, a code. (A £ or % amount is PillMoneyInput.)
// The label sits above, a hint and an error below; the error is announced
// and tied to the field. The text is typed at 16px so iOS doesn't zoom, and
// shown at body size like every other pill's answer.
//
// <TextField label="Email" type="email" autoComplete="email" value={email}
//   onChange={setEmail} error={err} hint="We send a code, no password." />
//
// size: "default" 44px, "compact" 37px.
import { forwardRef, useId } from "react";
import { pillFieldStyle } from "../PillMoneyInput.jsx";
import { WHITE, TEXT, MUT, FIELD_BORDER, ERROR_TEXT, RADIUS, CONTROL_HEIGHT, DISABLED_OPACITY, SR_ONLY } from "../../design-tokens.js";

export const TextField = forwardRef(function TextField({
  label, hideLabel = false, value, onChange, type = "text", hint, error, size = "default", disabled = false, style, inputStyle, id, ...rest
}, ref) {
  const autoId = useId();
  const fieldId = id || `tf-${autoId}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", opacity: disabled ? DISABLED_OPACITY : 1, ...style }}>
      {label && (
        <label htmlFor={fieldId} style={hideLabel
          ? SR_ONLY
          : { fontSize: "12px", fontWeight: 700, color: TEXT, lineHeight: 1.35 }}>
          {label}
        </label>
      )}
      {/* The pill is drawn by this wrapper (its focus ring is .pill-field's);
          the input inside is 16px scaled to body size, as in PillMoneyInput. */}
      <div className="pill-field" style={{
        display: "flex", alignItems: "center", boxSizing: "border-box", overflow: "hidden",
        height: size === "compact" ? CONTROL_HEIGHT.compact : CONTROL_HEIGHT.default,
        padding: "0 16px", borderRadius: RADIUS.pill, background: WHITE,
        border: `1.5px solid ${error ? ERROR_TEXT : FIELD_BORDER}`,
      }}>
        <input
          ref={ref}
          id={fieldId}
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value, e)}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
          style={{ border: "none", background: "none", outline: "none", padding: 0, margin: 0, color: TEXT, ...pillFieldStyle("100%"), ...inputStyle }}
          {...rest}
        />
      </div>
      {error && <p id={errorId} role="alert" style={{ margin: 0, fontSize: "12px", lineHeight: 1.45, color: ERROR_TEXT }}>{error}</p>}
      {hint && <p id={hintId} style={{ margin: 0, fontSize: "12px", lineHeight: 1.45, color: MUT }}>{hint}</p>}
    </div>
  );
});

export default TextField;
