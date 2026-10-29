import { CREAM, WHITE, MUT, G, SANS } from "../design-tokens.js";
import { IMPACTS, STATUSES, VERDICTS } from "../lib/weekly.js";

// An email's subject, intro and news items, each with its "For you" impact
// (src/lib/weekly.js IMPACTS), on /admin/alerts: the Sunday email
// (WeeklyEditor) and outside events' emails (EventEditor). `issue` is
// { subject, intro, items }; `onChange` takes a function of it.

export const button = primary => ({ padding: "8px 14px", borderRadius: "8px", border: primary ? "none" : "1.5px solid rgba(22,47,36,0.2)", background: primary ? G : WHITE, color: primary ? WHITE : G, fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: SANS });
export const input = { padding: "9px 12px", border: "1.5px solid rgba(22,47,36,0.18)", borderRadius: "8px", fontSize: "14px", fontFamily: SANS, boxSizing: "border-box", width: "100%" };
export const label = { fontSize: "12px", fontWeight: 700, color: MUT, display: "block", margin: "10px 0 4px" };
const NEW_ITEM = { title: "", status: "news", body: "", source: "", url: "", impact: null };

export default function IssueFields({ issue, onChange, subjectHint }) {
  const setItem = (i, patch) => onChange(v => ({ ...v, items: v.items.map((it, j) => j === i ? { ...it, ...patch } : it) }));
  return (
    <>
      <label style={label}>Subject{subjectHint ? ` (${subjectHint})` : ""}</label>
      <input value={issue.subject} onChange={e => onChange(v => ({ ...v, subject: e.target.value }))} style={input}/>
      <label style={label}>Intro (a line or two)</label>
      <textarea value={issue.intro} onChange={e => onChange(v => ({ ...v, intro: e.target.value }))} rows={2} style={input}/>

      {issue.items.map((it, i) => {
        const impact = it.impact && IMPACTS[it.impact.kind];
        return (
          <div key={i} style={{ background: CREAM, borderRadius: "10px", padding: "12px", marginTop: "12px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input value={it.title} onChange={e => setItem(i, { title: e.target.value })} placeholder="Title" style={{ ...input, fontWeight: 700 }}/>
              <select value={it.status} onChange={e => setItem(i, { status: e.target.value })} style={{ ...input, width: "auto" }}>
                {Object.entries(STATUSES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <select value={it.verdict || ""} onChange={e => setItem(i, { verdict: e.target.value || undefined })} title="Shown in place of the status" style={{ ...input, width: "auto" }}>
                <option value="">No verdict</option>
                {Object.entries(VERDICTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <textarea value={it.body} onChange={e => setItem(i, { body: e.target.value })} rows={3} placeholder="What's happening, in two or three sentences" style={{ ...input, marginTop: "8px" }}/>
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <input value={it.source} onChange={e => setItem(i, { source: e.target.value })} placeholder="Source (e.g. GOV.UK, FT)" style={input}/>
              <input value={it.url} onChange={e => setItem(i, { url: e.target.value })} placeholder="https://..." style={input}/>
            </div>
            <label style={label}>For you (worked out on each subscriber's figures)</label>
            <select value={it.impact?.kind || ""} onChange={e => setItem(i, { impact: e.target.value ? { kind: e.target.value } : null })} style={input}>
              <option value="">None</option>
              {Object.entries(IMPACTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {impact?.fields.map(f => (
              <input key={f.key} value={it.impact[f.key] || ""} onChange={e => setItem(i, { impact: { ...it.impact, [f.key]: e.target.value } })} placeholder={f.label} style={{ ...input, marginTop: "6px" }}/>
            ))}
            <button type="button" style={{ ...button(false), marginTop: "8px" }} onClick={() => onChange(v => ({ ...v, items: v.items.filter((_, j) => j !== i) }))}>Remove</button>
          </div>
        );
      })}
      <button type="button" style={{ ...button(false), marginTop: "12px" }} onClick={() => onChange(v => ({ ...v, items: [...v.items, NEW_ITEM] }))}>Add an item</button>
    </>
  );
}
