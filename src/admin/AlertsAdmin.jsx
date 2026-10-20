import { useState } from "react";
import { NavBar } from "../NavBar.jsx";
import { G, CREAM, WHITE, MUT, TEXT, SERIF, SANS, SUCCESS, ERROR_TEXT } from "../design-tokens.js";
import WeeklyEditor from "./WeeklyEditor.jsx";

// Internal page for Candid's emails (api/alerts.js): what would go out on
// any date, worked out on everyone's figures today, and one of them sent to
// an address of your choosing as a test. Same password as the other admin
// pages; nothing is remembered across reloads. Whether the daily run really
// sends is the VITE_ALERTS_LIVE setting in Vercel, shown at the top. The
// Sunday email's issue for each week is written and approved here too
// (WeeklyEditor).

const button = primary => ({ padding: "8px 14px", borderRadius: "8px", border: primary ? "none" : "1.5px solid rgba(22,47,36,0.2)", background: primary ? G : WHITE, color: primary ? WHITE : G, fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: SANS });
const input = { padding: "9px 12px", border: "1.5px solid rgba(22,47,36,0.18)", borderRadius: "8px", fontSize: "14px", fontFamily: SANS, boxSizing: "border-box" };
const KIND_LABEL = { taxYearEnd: "Before 5 April", bonus: "Bonus", newTaxYear: "New tax year", rates: "Better rate", welcome: "Welcome", weekly: "Sunday email" };

export default function AlertsAdmin() {
  const [password, setPassword] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(null);
  const [testTo, setTestTo] = useState("");
  const [testDone, setTestDone] = useState(null);

  async function call(body, label) {
    setBusy(label); setError("");
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "x-admin-password": password, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) setError("Wrong password");
      else if (!res.ok) setError(json.error || `Something went wrong (${res.status})`);
      else return json;
    } catch (e) {
      setError("Network error");
    } finally {
      setBusy("");
    }
    return null;
  }
  const preview = async (on = date) => { const json = await call({ action: "preview", date: on }, "preview"); if (json) { setData(json); setOpen(null); setTestDone(null); } };
  const sendTest = async index => { const json = await call({ action: "test", date, index, to: testTo }, `test${index}`); if (json) setTestDone(index); };

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: CREAM, display: "flex", flexDirection: "column" }}>
        <NavBar center="Alerts admin"/>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, padding: "24px" }}>
          <form onSubmit={e => { e.preventDefault(); preview(); }} style={{ background: WHITE, borderRadius: "12px", padding: "32px", width: "100%", maxWidth: "340px", boxShadow: "0 8px 32px rgba(22,47,36,0.1)" }}>
            <div style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 700, color: G, marginBottom: "18px" }}>Alerts admin</div>
            <input type="password" autoFocus value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" style={{ ...input, width: "100%", marginBottom: "12px" }}/>
            <button type="submit" disabled={!!busy || !password} style={{ ...button(true), width: "100%", padding: "11px", fontSize: "14px", opacity: (busy || !password) ? 0.4 : 1 }}>
              {busy ? "Checking..." : "Open"}
            </button>
            {error && <div style={{ color: ERROR_TEXT, fontSize: "13px", marginTop: "10px" }}>{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  const counts = data.emails.reduce((t, e) => ({ ...t, [e.kind]: (t[e.kind] || 0) + 1 }), {});
  return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", flexDirection: "column" }}>
      <NavBar center="Alerts admin"/>
      <div style={{ fontFamily: SANS, padding: "24px", maxWidth: "900px", margin: "0 auto", width: "100%", boxSizing: "border-box", color: TEXT }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: data.live ? SUCCESS : MUT }}>
          {data.live ? "Sending is on: the daily run (08:00 UTC) sends these." : "Dry run: nothing is sent. VITE_ALERTS_LIVE=1 in Vercel turns sending on."}
        </div>
        <WeeklyEditor call={call} busy={busy} onPreview={week => { setDate(week); preview(week); }}/>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginTop: "22px" }}>
          <label style={{ fontSize: "13px", color: MUT }}>As if today were</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={input}/>
          <button type="button" style={button(true)} disabled={!!busy} onClick={() => preview()}>{busy === "preview" ? "Working out..." : "Show what would go out"}</button>
        </div>
        <p style={{ fontSize: "13px", color: MUT, lineHeight: 1.5 }}>
          Try 2 March (before 5 April), 10 February (bonus), 12 April (new tax year). Rate alerts can go any day. Figures are everyone's today; what's already been sent is left out.
        </p>
        <div style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 700, color: G, margin: "18px 0 6px" }}>
          {data.due} email{data.due === 1 ? "" : "s"} on {data.date}, from {data.people} {data.people === 1 ? "person" : "people"} who can get them
        </div>
        <div style={{ fontSize: "13px", color: MUT }}>{Object.entries(counts).map(([k, n]) => `${KIND_LABEL[k] || k}: ${n}`).join(" · ") || "Nothing due"}</div>
        {data.notes?.length > 0 && (
          <ul style={{ fontSize: "13px", color: "#b9661a", paddingLeft: "18px" }}>{data.notes.map(n => <li key={n}>{n}</li>)}</ul>
        )}
        {data.emails.length > 0 && (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", margin: "16px 0" }}>
            <label style={{ fontSize: "13px", color: MUT }}>Send tests to</label>
            <input type="email" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="you@example.com" style={{ ...input, minWidth: "240px" }}/>
          </div>
        )}
        {error && <div style={{ color: ERROR_TEXT, fontSize: "13px", margin: "10px 0" }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {data.emails.map((e, i) => (
            <div key={`${e.to}${e.subject}`} style={{ background: WHITE, borderRadius: "10px", padding: "12px 14px", border: "1px solid rgba(22,47,36,0.08)" }}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", width: "100%", cursor: "pointer", fontFamily: SANS }}>
                <div style={{ fontSize: "12px", color: MUT }}>{KIND_LABEL[e.kind] || e.kind} · {e.who} · {e.to}</div>
                <div style={{ fontSize: "14.5px", fontWeight: 700, color: TEXT, marginTop: "2px" }}>{e.subject}</div>
              </button>
              {open === i && (
                <>
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: SANS, fontSize: "13px", lineHeight: 1.55, color: TEXT, background: CREAM, borderRadius: "8px", padding: "12px", margin: "10px 0" }}>{e.text}</pre>
                  <button type="button" style={button(false)} disabled={!!busy || !testTo} onClick={() => sendTest(i)}>
                    {busy === `test${i}` ? "Sending..." : testDone === i ? "Sent to you" : "Send this to me as a test"}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
