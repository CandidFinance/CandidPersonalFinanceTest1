import { useState, useEffect } from "react";
import { G, CREAM, WHITE, MUT, TEXT, SERIF, SANS, SUCCESS, ERROR_TEXT } from "../design-tokens.js";
import { IMPACTS, STATUSES, nextSunday, cleanIssue } from "../lib/weekly.js";

// The Sunday email's issue for a week (src/lib/weekly.js), on
// /admin/alerts: written here or pasted in as a draft, saved, previewed
// for every subscriber, then approved. Only an approved issue goes out, at
// the 04:00 UTC run that Sunday (before 6am UK time); saving it again needs approving again.
// `call(body, label)` is the page's own request to /api/alerts; `onPreview`
// shows what would go out on that Sunday, draft included.

const button = primary => ({ padding: "8px 14px", borderRadius: "8px", border: primary ? "none" : "1.5px solid rgba(22,47,36,0.2)", background: primary ? G : WHITE, color: primary ? WHITE : G, fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: SANS });
const input = { padding: "9px 12px", border: "1.5px solid rgba(22,47,36,0.18)", borderRadius: "8px", fontSize: "14px", fontFamily: SANS, boxSizing: "border-box", width: "100%" };
const label = { fontSize: "12px", fontWeight: 700, color: MUT, display: "block", margin: "10px 0 4px" };
const EMPTY = { subject: "", intro: "", items: [] };
const NEW_ITEM = { title: "", status: "news", body: "", source: "", url: "", impact: null };

export default function WeeklyEditor({ call, busy, onPreview }) {
  const [week, setWeek] = useState(nextSunday());
  const [issue, setIssue] = useState(EMPTY);
  const [saved, setSaved] = useState(null);
  const [paste, setPaste] = useState("");
  const [pasteError, setPasteError] = useState("");

  const load = async () => {
    const json = await call({ action: "weekly-load", week }, "weekly");
    if (json) { setSaved(json.issue); setIssue(json.issue ? cleanIssue(json.issue) : EMPTY); }
  };
  useEffect(() => { load(); }, [week]);

  const save = async () => { const json = await call({ action: "weekly-save", week, issue: cleanIssue(issue) }, "weekly"); if (json) setSaved(json.issue); };
  const approve = async approved => { const json = await call({ action: "weekly-approve", week, approved }, "weekly"); if (json) setSaved(json.issue); };
  const fromPaste = () => {
    try { setIssue(cleanIssue(JSON.parse(paste))); setPaste(""); setPasteError(""); }
    catch { setPasteError("That isn't a draft Candid can read. Paste the whole block, from { to }."); }
  };
  const setItem = (i, patch) => setIssue(v => ({ ...v, items: v.items.map((it, j) => j === i ? { ...it, ...patch } : it) }));
  const unsaved = JSON.stringify(cleanIssue(issue)) !== JSON.stringify(saved ? cleanIssue(saved) : EMPTY);
  const approved = !!saved?.approved_at && !unsaved;

  return (
    <section style={{ background: WHITE, borderRadius: "12px", padding: "18px", border: "1px solid rgba(22,47,36,0.08)", marginTop: "18px" }}>
      <div style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 700, color: G }}>Sunday email</div>
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginTop: "10px" }}>
        <label style={{ fontSize: "13px", color: MUT }}>For Sunday</label>
        <input type="date" value={week} onChange={e => setWeek(e.target.value)} style={{ ...input, width: "auto" }}/>
        <span style={{ fontSize: "13px", fontWeight: 700, color: approved ? SUCCESS : MUT }}>
          {approved ? "Approved: goes out before 6am UK time that Sunday" : saved ? (unsaved ? "Changes not saved" : "Draft: not approved, so it won't go out") : "Nothing saved for this week"}
        </span>
      </div>

      <label style={label}>Paste a draft</label>
      <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={3} placeholder='{ "subject": "...", "intro": "...", "items": [...] }' style={{ ...input, fontFamily: "monospace", fontSize: "12px" }}/>
      <button type="button" style={{ ...button(false), marginTop: "6px" }} disabled={!paste.trim()} onClick={fromPaste}>Fill the form from it</button>
      {pasteError && <div style={{ color: ERROR_TEXT, fontSize: "13px", marginTop: "6px" }}>{pasteError}</div>}

      <label style={label}>Subject (left blank: "This week: " and the first item's title)</label>
      <input value={issue.subject} onChange={e => setIssue(v => ({ ...v, subject: e.target.value }))} style={input}/>
      <label style={label}>Intro (a line or two)</label>
      <textarea value={issue.intro} onChange={e => setIssue(v => ({ ...v, intro: e.target.value }))} rows={2} style={input}/>

      {issue.items.map((it, i) => {
        const impact = it.impact && IMPACTS[it.impact.kind];
        return (
          <div key={i} style={{ background: CREAM, borderRadius: "10px", padding: "12px", marginTop: "12px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input value={it.title} onChange={e => setItem(i, { title: e.target.value })} placeholder="Title" style={{ ...input, fontWeight: 700 }}/>
              <select value={it.status} onChange={e => setItem(i, { status: e.target.value })} style={{ ...input, width: "auto" }}>
                {Object.entries(STATUSES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
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
            <button type="button" style={{ ...button(false), marginTop: "8px" }} onClick={() => setIssue(v => ({ ...v, items: v.items.filter((_, j) => j !== i) }))}>Remove</button>
          </div>
        );
      })}
      <button type="button" style={{ ...button(false), marginTop: "12px" }} onClick={() => setIssue(v => ({ ...v, items: [...v.items, NEW_ITEM] }))}>Add an item</button>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(22,47,36,0.08)" }}>
        <button type="button" style={button(true)} disabled={!!busy || !unsaved} onClick={save}>{busy === "weekly" ? "Saving..." : "Save draft"}</button>
        <button type="button" style={button(false)} disabled={!!busy || !saved || unsaved} onClick={() => onPreview(week)}>Preview for every subscriber</button>
        {approved
          ? <button type="button" style={button(false)} disabled={!!busy} onClick={() => approve(false)}>Withdraw approval</button>
          : <button type="button" style={{ ...button(true), background: SUCCESS }} disabled={!!busy || !saved || unsaved} onClick={() => approve(true)}>Approve for {week}</button>}
      </div>
      <p style={{ fontSize: "12.5px", color: TEXT, lineHeight: 1.5, margin: "10px 0 0" }}>
        Each subscriber's email starts with their own week (rates against their accounts, ISA allowance left, dates coming up), then these items. Check the preview before approving.
      </p>
    </section>
  );
}
