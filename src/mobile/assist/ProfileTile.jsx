import { useState } from "react";
import { G, WHITE, MUT, TEXT, SANS, CDARK } from "../../design-tokens.js";

// One question for the account-opening agent's profile, answered in Candid:
// a missing profile field before a run, or a question from the form during
// one (scripts/assist-agent). Choices are one tap; text, dates and numbers
// have a box and a button. `onAnswer(value, remember)` sends it on;
// `remember` is shown only when the answer can be saved to the profile.
// Bank details (kind "bank") are never saved: the tile says so, and the box
// isn't remembered by the browser either.

const pill = on => ({ border: `1px solid ${on ? G : CDARK}`, background: on ? G : WHITE, color: on ? WHITE : TEXT, borderRadius: "100px", padding: "8px 13px", fontSize: "13px", fontWeight: 600, fontFamily: SANS, cursor: "pointer" });
const INPUT_TYPE = { date: "date", number: "number", email: "email", tel: "tel" };

export default function ProfileTile({ label, field, hint, kind, options = [], remember: canRemember, disclosure, action = "Save", onAnswer }) {
  const [value, setValue] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const send = v => { if (!String(v).trim() || busy) return; setBusy(true); Promise.resolve(onAnswer(String(v).trim(), canRemember ? remember : false)).finally(() => setBusy(false)); };

  return (
    <div style={{ background: WHITE, border: `1px solid ${CDARK}`, borderRadius: "12px", padding: "12px 14px", marginTop: "8px" }}>
      <div style={{ fontSize: "13.5px", fontWeight: 700, color: TEXT, lineHeight: 1.4 }}>{label}</div>
      {field && field !== label && <div style={{ fontSize: "12px", color: MUT, marginTop: "2px" }}>On the form: {field}</div>}
      {hint && <div style={{ fontSize: "12px", color: MUT, marginTop: "2px" }}>{hint}</div>}

      {kind === "choice" && options.length <= 6 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "9px" }}>
          {options.map(o => <button key={o} type="button" disabled={busy} onClick={() => send(o)} style={pill(false)}>{o}</button>)}
        </div>
      ) : (
        <form onSubmit={e => { e.preventDefault(); send(value); }} style={{ display: "flex", gap: "6px", marginTop: "9px" }}>
          {kind === "choice"
            ? <select value={value} onChange={e => setValue(e.target.value)} style={{ flex: 1, minWidth: 0, padding: "9px 10px", borderRadius: "10px", border: `1px solid ${CDARK}`, fontSize: "14px", fontFamily: SANS, background: WHITE, color: TEXT }}>
                <option value="">Choose…</option>
                {options.map(o => <option key={o}>{o}</option>)}
              </select>
            : <input type={INPUT_TYPE[kind] || "text"} value={value} onChange={e => setValue(e.target.value)} inputMode={kind === "number" ? "decimal" : kind === "bank" ? "numeric" : undefined}
                autoComplete={kind === "bank" ? "off" : undefined}
                style={{ flex: 1, minWidth: 0, padding: "9px 10px", borderRadius: "10px", border: `1px solid ${CDARK}`, fontSize: "14px", fontFamily: SANS, color: TEXT }}/>}
          <button type="submit" disabled={busy || !value.trim()} style={{ ...pill(true), opacity: value.trim() ? 1 : 0.5 }}>{action}</button>
        </form>
      )}

      {disclosure && <p style={{ fontSize: "12px", color: MUT, lineHeight: 1.5, margin: "8px 0 0" }}>{disclosure}</p>}

      {canRemember && (
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: MUT, marginTop: "8px", cursor: "pointer" }}>
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/>
          Save to my profile for next time
        </label>
      )}
    </div>
  );
}
