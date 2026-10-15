import { useState } from "react";
import { NavBar } from "../NavBar.jsx";
import { G, CREAM, WHITE, MUT, TEXT, SERIF, SANS, ERROR_TEXT } from "../design-tokens.js";

// ── Internal feedback admin (password-gated server-side, see api/feedback.js) ─
// No persistence of the password across reloads by design — this shows real
// users' free-text opinions, so the convenience of "stay logged in" isn't
// worth it for a page opened rarely by one person.
export default function FeedbackAdmin() {
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", { headers: { "x-admin-password": password } });
      if (res.status === 401) { setError("Wrong password"); setLoading(false); return; }
      if (res.status === 429) { setError("Too many attempts — try again shortly"); setLoading(false); return; }
      if (!res.ok) { setError("Something went wrong fetching feedback"); setLoading(false); return; }
      const data = await res.json();
      setRows(data.rows);
    } catch (e) {
      setError("Network error");
    }
    setLoading(false);
  }

  const cellStyle = { padding: "10px 14px", borderBottom: "1px solid rgba(22,47,36,0.1)", fontSize: "13px", color: TEXT, verticalAlign: "top", textAlign: "left" };
  const headStyle = { ...cellStyle, fontWeight: 700, color: G, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `2px solid ${G}`, whiteSpace: "nowrap" };

  if (!rows) {
    return (
      <div style={{ minHeight: "100vh", background: CREAM, display: "flex", flexDirection: "column" }}>
        <NavBar center="Feedback admin"/>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, padding: "24px" }}>
          <form onSubmit={handleSubmit} style={{ background: WHITE, borderRadius: "12px", padding: "32px", width: "100%", maxWidth: "340px", boxShadow: "0 8px 32px rgba(22,47,36,0.1)" }}>
            <div style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 700, color: G, marginBottom: "18px" }}>Feedback admin</div>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(22,47,36,0.18)", borderRadius: "8px", fontSize: "14px", fontFamily: SANS, marginBottom: "12px" }}
            />
            <button type="submit" disabled={loading || !password} style={{ width: "100%", padding: "11px", background: (loading || !password) ? "rgba(22,47,36,0.25)" : G, border: "none", borderRadius: "8px", color: WHITE, fontSize: "14px", fontWeight: 600, cursor: (loading || !password) ? "not-allowed" : "pointer", fontFamily: SANS }}>
              {loading ? "Checking…" : "View feedback"}
            </button>
            {error && <div style={{ color: ERROR_TEXT, fontSize: "13px", marginTop: "10px" }}>{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", flexDirection: "column" }}>
      <NavBar center="Feedback admin"/>
      <div style={{ fontFamily: SANS, padding: "32px 24px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ fontFamily: SERIF, fontSize: "22px", fontWeight: 700, color: G, marginBottom: "4px" }}>Feedback ({rows.length})</div>
          <div style={{ fontSize: "12px", color: MUT, marginBottom: "20px" }}>Most recent first</div>
          {rows.length === 0 ? (
            <div style={{ color: MUT, fontSize: "14px" }}>No feedback submitted yet.</div>
          ) : (
            <div style={{ overflowX: "auto", background: WHITE, borderRadius: "10px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={headStyle}>When</th>
                    <th style={headStyle}>Session</th>
                    <th style={headStyle}>Confidence</th>
                    <th style={headStyle}>Q1: Knew something new?</th>
                    <th style={{ ...headStyle, minWidth: "220px" }}>Q2: Most useful thing</th>
                    <th style={{ ...headStyle, minWidth: "220px" }}>Q3: Would change anything?</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td style={cellStyle}>{new Date(r.created_at).toLocaleString("en-GB")}</td>
                      <td style={{ ...cellStyle, fontFamily: "monospace", fontSize: "11px", color: MUT }}>{r.session_id || "—"}</td>
                      <td style={cellStyle}>{r.confidence_score ?? "—"}</td>
                      <td style={cellStyle}>{r.post_feedback_knew_something || "—"}</td>
                      <td style={{ ...cellStyle, whiteSpace: "pre-wrap" }}>{r.post_feedback_useful_text || "—"}</td>
                      <td style={{ ...cellStyle, whiteSpace: "pre-wrap" }}>
                        {r.post_feedback_would_change || "—"}
                        {r.post_feedback_change_details ? ` — ${r.post_feedback_change_details}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
