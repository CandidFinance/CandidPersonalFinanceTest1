// On/off. Only for a setting that is either on or off (an email reminder, a
// what-if being applied). A choice between two named options is a
// Segmented, not a switch.
//
// <Switch checked={on} onChange={setOn} label="Salary sacrifice" />
//   the switch alone; `label` is read out, and shown beside it if `showLabel`.
// <SwitchRow label="Weekly email" sub="Sundays" checked={on} onChange={setOn} />
//   a full-width row in a list: words at the left, the switch at the right;
//   the whole row is the button.
import { G, MUT, TEXT, WHITE, PROGRESS_GREEN, SHADOW, DISABLED_OPACITY } from "../../design-tokens.js";

const TRACK_OFF = "rgba(22,47,36,0.2)";

// The drawn switch, 44x26 with a 20px knob. aria-hidden: the button around
// it carries the role.
export function SwitchTrack({ checked, dim = false }) {
  return (
    <span aria-hidden="true" style={{ position: "relative", display: "inline-block", width: "44px", height: "26px", borderRadius: "13px", flexShrink: 0, background: checked ? PROGRESS_GREEN : TRACK_OFF, transition: "background 0.25s", opacity: dim ? DISABLED_OPACITY : 1 }}>
      <span style={{ position: "absolute", top: "3px", left: checked ? "21px" : "3px", width: "20px", height: "20px", borderRadius: "50%", background: WHITE, boxShadow: SHADOW.knob, transition: "left 0.25s cubic-bezier(0.4,0,0.2,1)" }} />
    </span>
  );
}

export function Switch({ checked, onChange, label, showLabel = false, disabled = false, style, ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={showLabel ? undefined : label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      style={{ display: "inline-flex", alignItems: "center", gap: "10px", minHeight: "44px", padding: 0, border: "none", background: "none", fontFamily: "inherit", fontSize: "13px", fontWeight: 700, color: checked ? G : MUT, cursor: disabled ? "not-allowed" : "pointer", ...style }}
      {...rest}
    >
      {showLabel && <span>{label}</span>}
      <SwitchTrack checked={!!checked} dim={disabled} />
    </button>
  );
}

export function SwitchRow({ label, sub, checked, onChange, busy = false, style, ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      disabled={busy}
      onClick={() => onChange?.(!checked)}
      style={{ display: "flex", alignItems: "center", gap: "14px", width: "100%", minHeight: "56px", padding: "10px 16px", boxSizing: "border-box", border: "none", background: "none", fontFamily: "inherit", fontSize: "12px", fontWeight: 600, color: TEXT, textAlign: "left", cursor: busy ? "default" : "pointer", ...style }}
      {...rest}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block" }}>{label}</span>
        {sub && <span style={{ display: "block", fontSize: "12px", fontWeight: 400, color: MUT, marginTop: "2px", lineHeight: 1.45 }}>{sub}</span>}
      </span>
      <SwitchTrack checked={!!checked} dim={busy} />
    </button>
  );
}

export default Switch;
