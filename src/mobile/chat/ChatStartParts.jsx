import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { G, WHITE, MUT, TEXT, SERIF, SANS, SUCCESS } from "../../design-tokens.js";
import { fmt } from "../../lib/format.js";
import { CHAT_AREAS, suggestedFor, tileLabel } from "../../lib/chatStart.js";
import { askFor } from "../../lib/quickStart.js";
import { moduleMeta } from "../ModuleStartRow.jsx";

// The Chat tab's way in (useChatStart): the areas to pick, a module
// question's replies, and the list of module answers. Replies sit on the
// right, as the user's side of the conversation. Rounded rectangles, the
// words centred both ways, so a one-word tile beside a two-line one stays
// level. A tile picked, or a button that goes on, is filled; the one
// offered first only has a heavier edge.

const chip = (on, suggested = false) => ({
  display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1px",
  minHeight: "42px", boxSizing: "border-box",
  background: on ? G : WHITE, color: on ? WHITE : G,
  border: `1.5px solid ${on || suggested ? G : "rgba(22,47,36,0.22)"}`, boxShadow: suggested && !on ? `inset 0 0 0 1px ${G}` : "none",
  borderRadius: "12px", padding: "8px 14px", fontSize: "14px", fontWeight: 600, fontFamily: SANS, cursor: "pointer", textAlign: "center", lineHeight: 1.3,
});
const wrap = { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "8px" };
const col = { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px", marginTop: "14px" };
const why = { fontSize: "12.5px", color: MUT, textAlign: "right", maxWidth: "88%", lineHeight: 1.4 };

// The areas, as many as they like ("Just exploring" on its own), then Done.
export function AreaPicker({ onDone }) {
  const [on, setOn] = useState([]);
  const toggle = c => setOn(list => list.includes(c.value) ? list.filter(v => v !== c.value)
    : c.exclusive ? [c.value] : [...list.filter(v => !CHAT_AREAS.find(x => x.value === v)?.exclusive), c.value]);
  return (
    <div role="group" aria-label="Areas to look at" style={col}>
      <div style={wrap}>
        {CHAT_AREAS.map(c => (
          <button key={c.value} type="button" aria-pressed={on.includes(c.value)} onClick={() => toggle(c)} style={chip(on.includes(c.value))}>{c.label}</button>
        ))}
      </div>
      <button type="button" disabled={!on.length} onClick={() => onDone(on)}
        style={{ ...chip(true), padding: "10px 22px", fontWeight: 700, opacity: on.length ? 1 : 0.35, cursor: on.length ? "pointer" : "default" }}>
        Done
      </button>
    </div>
  );
}

// One of a module's quick-start questions (its text is Candid's message
// above): tiles, the one offered first with a heavier edge, with why it's
// asked under them; or a percentage on a slider.
export function ChatQuestion({ setup, qid, ctx, onAnswer }) {
  const q = setup.questions[qid];
  if (q.kind === "slider") return <SliderReply q={q} ctx={ctx} onAnswer={onAnswer}/>;
  const suggested = suggestedFor(q, ctx);
  const why_ = typeof q.why === "function" ? q.why(ctx) : q.why;
  return (
    <div role="group" aria-label={askFor(q, ctx)} style={col}>
      <div style={wrap}>
        {q.options(ctx).map(o => (
          <button key={o.value} type="button" onClick={() => onAnswer(o.value)} style={chip(false, o.value === suggested)}>
            {tileLabel(o.label)}
            {o.sub && <span style={{ fontSize: "11.5px", fontWeight: 500, opacity: 0.75 }}>{o.sub}</span>}
          </button>
        ))}
      </div>
      {why_ && <span style={why}>{why_}</span>}
    </div>
  );
}

function SliderReply({ q, ctx, onAnswer }) {
  const [value, setValue] = useState(() => q.start(ctx));
  const clamp = v => Math.min(q.max, Math.max(q.min, v));
  const live = q.live?.(ctx, value);
  const why_ = typeof q.why === "function" ? q.why(ctx) : q.why;
  const step = { width: "40px", height: "40px", borderRadius: "50%", border: "1.5px solid rgba(22,47,36,0.18)", background: WHITE, color: G, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 };
  return (
    <div style={{ ...col, alignItems: "stretch", alignSelf: "flex-end", width: "88%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: "10px" }}>
        {live && <span style={{ fontSize: "12.5px", color: MUT }}>{live}</span>}
        <span aria-live="polite" style={{ fontFamily: SERIF, fontSize: "34px", fontWeight: 700, color: G, lineHeight: 1 }}>{value}%</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button type="button" aria-label="Less" onClick={() => setValue(v => clamp(v - 1))} style={step}><Minus size={18}/></button>
        <input type="range" min={q.min} max={q.max} step={1} value={value} aria-label={askFor(q, ctx)}
          onChange={e => setValue(+e.target.value)} style={{ flex: 1, accentColor: G, height: "28px", cursor: "pointer" }}/>
        <button type="button" aria-label="More" onClick={() => setValue(v => clamp(v + 1))} style={step}><Plus size={18}/></button>
      </div>
      <div style={wrap}>
        <button type="button" onClick={() => onAnswer("unsure")} style={chip(false)}>Not sure</button>
        <button type="button" onClick={() => onAnswer(String(value))} style={chip(true)}>{value}%, continue</button>
      </div>
      {why_ && <span style={{ ...why, alignSelf: "flex-end" }}>{why_}</span>}
    </div>
  );
}

// Module answers, one row each: the module's icon, its title, its £ a
// year in serif (or "On track", with a green dot), and the line its card
// shows, with what's estimated under it. Each row opens its module. Rows
// come in one after another when fresh.
export function ModuleRows({ rows, build, onOpen }) {
  return (
    <div style={{ alignSelf: "flex-start", width: "92%", boxSizing: "border-box", background: WHITE, border: "1px solid rgba(22,47,36,0.1)", borderRadius: "16px", padding: "0 12px", fontFamily: SANS }}>
      {rows.map((r, i) => {
        const mm = moduleMeta(r.key);
        return (
          <button key={r.key} type="button" onClick={() => onOpen(r.key)} className={build ? "chat-in" : undefined}
            style={{ ...(build && { "--i": i }), display: "flex", alignItems: "flex-start", gap: "11px", width: "100%", textAlign: "left", background: "none", border: "none", borderTop: i ? "1px solid rgba(22,47,36,0.08)" : "none", padding: "9px 0", cursor: "pointer", fontFamily: "inherit" }}>
            {mm?.icon && <mm.icon size={18} color={G} strokeWidth={1.8} aria-hidden="true" style={{ flexShrink: 0, marginTop: "1px" }}/>}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: TEXT, lineHeight: "20px" }}>{r.title}</span>
                {r.amount != null
                  ? <span style={{ fontSize: "14px", color: G, whiteSpace: "nowrap" }}><span style={{ fontFamily: SERIF, fontSize: "15px", fontWeight: 700, fontVariantNumeric: "tabular-nums lining-nums" }}>{fmt(r.amount)}</span>{r.lumpSum ? "" : <span style={{ fontWeight: 400 }}>/yr</span>}</span>
                  : r.onTrack && <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: SUCCESS, whiteSpace: "nowrap" }}><span aria-hidden="true" style={{ width: "8px", height: "8px", borderRadius: "50%", background: SUCCESS }}/>On track</span>}
              </span>
              {r.line && !r.onTrack && <span style={{ display: "block", fontSize: "12.5px", color: MUT, lineHeight: 1.4, marginTop: "1px" }}>{r.line}</span>}
              {r.note && <span style={{ display: "block", fontSize: "12px", color: MUT, lineHeight: 1.4, marginTop: "4px" }}>{r.note}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
