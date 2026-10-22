import { useState, useEffect } from "react";
import { G, WHITE, MUT, TEXT, SERIF, SUCCESS, ERROR_TEXT } from "../design-tokens.js";
import { nextSunday, cleanIssue } from "../lib/weekly.js";
import IssueFields, { button, input, label } from "./IssueFields.jsx";

// The Sunday email's issue for a week (src/lib/weekly.js), on
// /admin/alerts: written here or pasted in as a draft, saved, previewed
// for every subscriber, then approved. Only an approved issue goes out, at
// the 04:00 UTC run that Sunday (before 6am UK time); saving it again needs approving again.
// `call(body, label)` is the page's own request to /api/alerts; `onPreview`
// shows what would go out on that Sunday, draft included.

const EMPTY = { subject: "", intro: "", items: [] };

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

      <IssueFields issue={issue} onChange={setIssue} subjectHint={`left blank: "This week: " and the first item's title`}/>

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
