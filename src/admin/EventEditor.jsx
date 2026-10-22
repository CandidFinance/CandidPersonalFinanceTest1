import { useState, useEffect } from "react";
import { G, WHITE, MUT, TEXT, SERIF, SUCCESS, ERROR_TEXT, CREAM } from "../design-tokens.js";
import { cleanEventDraft, eventName, EVENT_EMAIL_DAYS } from "../lib/eventEmails.js";
import IssueFields, { button, input, label } from "./IssueFields.jsx";

// Outside events' emails (src/lib/eventEmails.js), on /admin/alerts: a Bank
// Rate decision or a Budget. Claude drafts each on its day (api/events.js,
// around 3pm UK time) and emails a flag; here it's checked, edited,
// previewed for every subscriber and approved. Approved within
// EVENT_EMAIL_DAYS of the event, it goes at the next 04:00 UTC run, and
// what was announced shows in the app. `call(body, label, url)` is the
// page's own request; `onPreview(date)` shows what would go out that day.

const EMPTY = { outcome: null, subject: "", intro: "", items: [] };
const when = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const stamp = t => new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export default function EventEditor({ call, busy, onPreview }) {
  const [events, setEvents] = useState([]);
  const [rows, setRows] = useState([]);
  const [id, setId] = useState(null);
  const [draft, setDraft] = useState(EMPTY);
  const [claude, setClaude] = useState(null);

  const take = json => {
    if (!json) return;
    setEvents(json.events || []); setRows(json.rows || []);
    setClaude(json.draftError ? { error: json.draftError, note: json.draftNote } : null);
    return json;
  };
  const api = (body, tag) => call(body, tag, "/api/events").then(take);
  useEffect(() => {
    api({ action: "events-load" }, "events").then(json => {
      // The next event, or the latest within the last few days.
      const today = new Date().toISOString().slice(0, 10);
      const list = json?.events || [];
      setId((list.find(e => e.date >= today) || list[list.length - 1])?.id || null);
    });
  }, []);

  const event = events.find(e => e.id === id);
  const saved = rows.find(r => r.event_id === id) || null;
  useEffect(() => { setDraft(saved ? cleanEventDraft(saved) : EMPTY); }, [id, saved?.updated_at]);
  if (!events.length) return null;

  const unsaved = JSON.stringify(cleanEventDraft(draft)) !== JSON.stringify(saved ? cleanEventDraft(saved) : EMPTY);
  const approved = !!saved?.approved_at && !unsaved;
  const bankRate = event?.kind === "bankRate";
  const status = approved ? `Approved ${stamp(saved.approved_at)}: goes at the next daily run, before 6am UK time, and shows in the app`
    : saved ? (unsaved ? "Changes not saved" : `${saved.drafted_by === "claude" ? `Claude's draft, ${stamp(saved.drafted_at)}` : "Draft"}: not approved, so it won't go out`)
    : "Nothing drafted yet. Claude drafts it on the day, around 3pm UK time, and emails you when it's ready";

  return (
    <section style={{ background: WHITE, borderRadius: "12px", padding: "18px", border: "1px solid rgba(22,47,36,0.08)", marginTop: "18px" }}>
      <div style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 700, color: G }}>Bank Rate and Budget emails</div>
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginTop: "10px" }}>
        <select value={id || ""} onChange={e => setId(e.target.value)} style={{ ...input, width: "auto" }}>
          {events.map(e => <option key={e.id} value={e.id}>{eventName(e)} · {when(e.date)}</option>)}
        </select>
        <span style={{ fontSize: "13px", fontWeight: 700, color: approved ? SUCCESS : MUT }}>{status}</span>
      </div>

      {claude && <div style={{ color: ERROR_TEXT, fontSize: "13px", marginTop: "10px" }}>Claude couldn't draft it: {claude.error}{claude.note ? ` Its note: ${claude.note}` : ""}</div>}
      {saved?.note && (
        <div style={{ background: CREAM, borderRadius: "10px", padding: "10px 12px", marginTop: "12px", fontSize: "13px", color: TEXT, lineHeight: 1.5 }}>
          <b>Claude's note</b> (not sent): {saved.note}
        </div>
      )}

      {bankRate && (<>
        <label style={label}>New Bank Rate, % (was {event.from != null ? `${event.from}%` : "not set"}; the app shows the change on each person's cash)</label>
        <input value={draft.outcome?.to ?? ""} inputMode="decimal" onChange={e => setDraft(v => ({ ...v, outcome: { to: e.target.value } }))} style={{ ...input, width: "140px" }}/>
      </>)}
      <IssueFields issue={draft} onChange={setDraft} subjectHint="left blank: the first item's title"/>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(22,47,36,0.08)" }}>
        <button type="button" style={button(true)} disabled={!!busy || !unsaved} onClick={() => api({ action: "event-save", id, draft: cleanEventDraft(draft) }, "event")}>{busy === "event" ? "Saving..." : "Save draft"}</button>
        <button type="button" style={button(false)} disabled={!!busy}
          onClick={() => (!saved || window.confirm("Ask Claude for a new draft? It replaces this one and takes a minute or two.")) && api({ action: "event-draft", id }, "event-draft")}>
          {busy === "event-draft" ? "Claude is drafting..." : saved ? "Ask Claude to draft again" : "Ask Claude to draft it now"}
        </button>
        <button type="button" style={button(false)} disabled={!!busy || !saved || unsaved} onClick={() => onPreview(event.date)}>Preview for every subscriber</button>
        {approved
          ? <button type="button" style={button(false)} disabled={!!busy} onClick={() => api({ action: "event-approve", id, approved: false }, "event")}>Withdraw approval</button>
          : <button type="button" style={{ ...button(true), background: SUCCESS }} disabled={!!busy || !saved || unsaved} onClick={() => api({ action: "event-approve", id, approved: true }, "event")}>Approve</button>}
      </div>
      <p style={{ fontSize: "12.5px", color: TEXT, lineHeight: 1.5, margin: "10px 0 0" }}>
        Subscribers only, once each. Approved within {EVENT_EMAIL_DAYS} days of the {event ? eventName(event) : "event"}, it goes at the next daily run; after that it doesn't go. Each item with a "For you" adds a line on that subscriber's own figures: check the preview before approving.
      </p>
    </section>
  );
}
