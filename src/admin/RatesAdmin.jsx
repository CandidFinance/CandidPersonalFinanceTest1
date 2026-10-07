import { useState } from "react";
import { NavBar, G, CREAM, WHITE, MUT, TEXT, SERIF, SANS } from "../CandidApp.jsx";

// Internal review page for the weekly savings rate feed (api/rates.js).
// Same password as the feedback admin, and like it, nothing is remembered
// across reloads. Shows the changes waiting for a person (new products, big
// rate moves, products gone from a page) with the sentence Claude quoted
// from the page, the sources and how their last check went, and what's live.

const CHANGE_LABEL = { new: "New product", rate_change: "Big rate change", missing: "No longer on the page" };
const STATUS_COLOR = { ok: "#2d6b4a", unchanged: "#2d6b4a", no_rates: "#b9661a", no_content: "#b9661a", fetch_failed: "#b3261e", extract_failed: "#b3261e", error: "#b3261e" };

const cell = { padding: "8px 10px", borderBottom: "1px solid rgba(22,47,36,0.1)", fontSize: "13px", color: TEXT, verticalAlign: "top", textAlign: "left" };
const head = { ...cell, fontWeight: 700, color: G, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `2px solid ${G}`, whiteSpace: "nowrap" };
const button = (primary) => ({ padding: "6px 12px", borderRadius: "8px", border: primary ? "none" : "1.5px solid rgba(22,47,36,0.2)", background: primary ? G : WHITE, color: primary ? WHITE : G, fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: SANS });
const section = { fontFamily: SERIF, fontSize: "19px", fontWeight: 700, color: G, margin: "28px 0 10px" };
const fmtDate = s => s ? new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never";

export default function RatesAdmin() {
  const [password, setPassword] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [lastRun, setLastRun] = useState(null);
  const [newSource, setNewSource] = useState({ providerName: "", url: "" });

  async function call(method, body, label) {
    setBusy(label || "load");
    setError("");
    try {
      const res = await fetch("/api/rates", {
        method,
        headers: { "x-admin-password": password, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) setError("Wrong password");
      else if (!res.ok) setError(json.error || `Something went wrong (${res.status})`);
      else {
        setData(json);
        if (json.results) setLastRun(json.results);
        return true;
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setBusy("");
    }
    return false;
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: CREAM, display: "flex", flexDirection: "column" }}>
        <NavBar center="Rates admin"/>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, padding: "24px" }}>
          <form onSubmit={e => { e.preventDefault(); call("GET"); }} style={{ background: WHITE, borderRadius: "12px", padding: "32px", width: "100%", maxWidth: "340px", boxShadow: "0 8px 32px rgba(22,47,36,0.1)" }}>
            <div style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 700, color: G, marginBottom: "18px" }}>Rates admin</div>
            <input type="password" autoFocus value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(22,47,36,0.18)", borderRadius: "8px", fontSize: "14px", fontFamily: SANS, marginBottom: "12px", boxSizing: "border-box" }}/>
            <button type="submit" disabled={!!busy || !password} style={{ ...button(true), width: "100%", padding: "11px", fontSize: "14px", opacity: (busy || !password) ? 0.4 : 1 }}>
              {busy ? "Checking..." : "Open"}
            </button>
            {error && <div style={{ color: "#b3261e", fontSize: "13px", marginTop: "10px" }}>{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  const { sources, reviews, rates } = data;
  return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", flexDirection: "column" }}>
      <NavBar center="Rates admin"/>
      <div style={{ fontFamily: SANS, padding: "24px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <button type="button" style={button(true)} disabled={!!busy} onClick={() => call("POST", { action: "run" }, "run")}>
            {busy === "run" ? "Checking pages..." : "Check the 6 oldest pages now"}
          </button>
          <span style={{ fontSize: "12px", color: MUT }}>The daily job checks any page not read for 6 days, so each is read about once a week.</span>
        </div>
        {error && <div style={{ color: "#b3261e", fontSize: "13px", marginTop: "10px" }}>{error}</div>}
        {lastRun && (
          <div style={{ marginTop: "12px", fontSize: "12.5px", color: TEXT, background: WHITE, borderRadius: "8px", padding: "10px 12px" }}>
            {lastRun.length === 0 ? "Nothing to check." : lastRun.map((r, i) => (
              <div key={i}><b>{r.source}</b>: <span style={{ color: STATUS_COLOR[r.status] || TEXT }}>{r.status}</span>
                {r.published != null && ` · ${r.published} confirmed, ${r.reviews} to review, ${r.rejected} thrown out`}{r.error && ` · ${r.error}`}</div>
            ))}
          </div>
        )}

        <div style={section}>Waiting for review ({reviews.length})</div>
        {reviews.length === 0 ? <div style={{ color: MUT, fontSize: "14px" }}>Nothing waiting.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", background: WHITE }}>
              <thead><tr>{["Provider", "Change", "Product", "Rate", "From the page", ""].map(h => <th key={h} style={head}>{h}</th>)}</tr></thead>
              <tbody>
                {reviews.map(r => (
                  <tr key={r.id}>
                    <td style={cell}><a href={r.rate_sources?.url} target="_blank" rel="noopener noreferrer" style={{ color: G }}>{r.rate_sources?.provider_name}</a></td>
                    <td style={cell}>{CHANGE_LABEL[r.change_type]}</td>
                    <td style={cell}>{r.product_name}<div style={{ color: MUT, fontSize: "12px" }}>{r.proposed?.account_type}</div></td>
                    <td style={{ ...cell, whiteSpace: "nowrap" }}>{r.current_rate != null ? `${r.current_rate}%` : "-"} {"->"} {r.proposed ? `${r.proposed.rate_aer}%` : "gone"}</td>
                    <td style={{ ...cell, maxWidth: "380px", color: MUT, fontStyle: "italic" }}>{r.proposed?.evidence ? `"${r.proposed.evidence}"` : ""}</td>
                    <td style={{ ...cell, whiteSpace: "nowrap" }}>
                      <button type="button" style={button(true)} disabled={!!busy} onClick={() => call("POST", { action: "approve", id: r.id }, r.id)}>Approve</button>{" "}
                      <button type="button" style={button(false)} disabled={!!busy} onClick={() => call("POST", { action: "reject", id: r.id }, r.id)}>Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={section}>Live rates ({rates.length})</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", background: WHITE }}>
            <thead><tr>{["Provider", "Product", "Type", "AER", "Last confirmed"].map(h => <th key={h} style={head}>{h}</th>)}</tr></thead>
            <tbody>
              {rates.map(r => (
                <tr key={r.id}>
                  <td style={cell}>{r.provider_name}</td>
                  <td style={cell}>{r.product_name || "-"}</td>
                  <td style={cell}>{r.account_type}</td>
                  <td style={cell}>{r.rate_aer}%</td>
                  <td style={cell}>{fmtDate(r.checked_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={section}>Sources ({sources.length})</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", background: WHITE }}>
            <thead><tr>{["Provider", "Page", "Last checked", "Result", "Products", ""].map(h => <th key={h} style={head}>{h}</th>)}</tr></thead>
            <tbody>
              {sources.map(s => (
                <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                  <td style={cell}>{s.provider_name}</td>
                  <td style={{ ...cell, maxWidth: "320px", wordBreak: "break-all" }}><a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: G }}>{s.url}</a></td>
                  <td style={{ ...cell, whiteSpace: "nowrap" }}>{fmtDate(s.last_fetched_at)}</td>
                  <td style={cell}><span style={{ color: STATUS_COLOR[s.last_status] || MUT, fontWeight: 600 }}>{s.last_status || "-"}</span>{s.last_error && <div style={{ color: MUT, fontSize: "12px" }}>{s.last_error}</div>}</td>
                  <td style={cell}>{s.last_product_count ?? "-"}</td>
                  <td style={{ ...cell, whiteSpace: "nowrap" }}>
                    <button type="button" style={button(false)} disabled={!!busy} onClick={() => call("POST", { action: "run", sourceIds: [s.id] }, "run")}>Check</button>{" "}
                    <button type="button" style={button(false)} disabled={!!busy} onClick={() => call("POST", { action: "toggle_source", id: s.id }, s.id)}>{s.active ? "Pause" : "Resume"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form onSubmit={async e => { e.preventDefault(); if (await call("POST", { action: "add_source", ...newSource }, "add")) setNewSource({ providerName: "", url: "" }); }}
          style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          <input value={newSource.providerName} onChange={e => setNewSource(s => ({ ...s, providerName: e.target.value }))} placeholder="Provider name"
            style={{ padding: "8px 10px", border: "1.5px solid rgba(22,47,36,0.18)", borderRadius: "8px", fontSize: "13px", fontFamily: SANS }}/>
          <input value={newSource.url} onChange={e => setNewSource(s => ({ ...s, url: e.target.value }))} placeholder="https://... product page"
            style={{ flex: 1, minWidth: "240px", padding: "8px 10px", border: "1.5px solid rgba(22,47,36,0.18)", borderRadius: "8px", fontSize: "13px", fontFamily: SANS }}/>
          <button type="submit" style={button(true)} disabled={!!busy || !newSource.providerName || !newSource.url}>Add source</button>
        </form>
      </div>
    </div>
  );
}
