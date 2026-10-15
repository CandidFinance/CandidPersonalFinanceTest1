import { useEffect, useState } from "react";
import { Bot, Hand, Square } from "lucide-react";
import { G, WHITE, MUT, TEXT, SANS, ERROR_TEXT } from "../../design-tokens.js";
import ProfileTile from "./ProfileTile.jsx";

// "Let Claude start it": hands a picked account to the local account-opening
// agent (scripts/assist-agent/agent.js), which fills in the application in
// a browser window on this computer. Here the user approves what it types,
// answers in tiles here anything their profile doesn't cover (before a run,
// the profile's missing fields; during one, the form's own questions), does
// their own part when it's their turn, and hands back. Dev builds only:
// the agent runs on the user's own machine, and is a prototype.
// `onOpened()` ticks the pick as done once the agent reads a confirmation.

const AGENT = "http://127.0.0.1:5287";
const get = path => fetch(AGENT + path).then(r => r.json());
const post = (path, body) => fetch(AGENT + path, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(r => r.json());

export const agentAvailable = o => import.meta.env.DEV && !!o.url && !o.appOnly && !o.pb;

export default function AgentPanel({ o, onOpened }) {
  const [status, setStatus] = useState(null);
  const [problem, setProblem] = useState(null);
  const [missing, setMissing] = useState([]);
  const active = status && ["starting", "working", "approve", "ask", "your_turn"].includes(status.state);
  const idle = !status || status.state === "idle";
  // A run for another account, still going (started from another tile, or
  // before Assist was closed): shown with a Stop, never a second start.
  const elsewhere = active && status.provider !== o.provider;

  // Picks up a run already under way, so closing and reopening Assist (or a
  // refresh) doesn't lose it.
  const attach = () => get("/status").then(s => { if (["starting", "working", "approve", "ask", "your_turn"].includes(s.state) || s.provider === o.provider) setStatus(s); }).catch(() => {});
  useEffect(() => { attach(); }, []);

  // The profile fields still empty, asked for before a run starts.
  useEffect(() => { if (idle) get("/profile").then(r => setMissing(r.missing || [])).catch(() => {}); }, [idle]);
  const saveField = (key, value) => post("/profile", { [key]: value }).then(r => setMissing(r.missing || [])).catch(() => setProblem("Couldn't save that. Is the agent running?"));

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      fetch(AGENT + "/status").then(r => r.json()).then(s => {
        setStatus(s);
        if (s.state === "done" && s.result?.opened) onOpened();
      }).catch(() => setProblem("Lost touch with the agent. Is it still running?"));
    }, 1500);
    return () => clearInterval(t);
  }, [active]);

  const act = path => post(path).then(setStatus).catch(() => setProblem("Couldn't reach the agent."));
  const start = () => {
    setProblem(null);
    // Cash moves are from the user's existing savings, so that's the source
    // of funds the application is given.
    post("/start", { url: o.url, provider: o.provider, product: o.product, amount: o.amount, isa: !!o.isa, sourceOfFunds: "Savings" })
      .then(s => s.error === "already running" ? attach() : s.error ? setProblem(s.error) : setStatus(s))
      .catch(() => setProblem("The agent isn't running. It starts with npm run dev."));
  };

  const small = { fontSize: "12.5px", color: MUT, lineHeight: 1.5 };
  const button = (bg, fg = WHITE) => ({ background: bg, color: fg, border: "none", borderRadius: "100px", padding: "9px 14px", fontSize: "13px", fontWeight: 700, fontFamily: SANS, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" });
  const quiet = { background: "none", border: "none", padding: "9px 4px", fontSize: "13px", fontWeight: 700, color: G, fontFamily: SANS, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" };
  const box = { marginTop: "12px", padding: "12px 14px", borderRadius: "12px", background: "rgba(22,47,36,0.04)" };

  if (elsewhere) return (
    <div style={box}>
      <div style={{ fontSize: "13.5px", color: TEXT, lineHeight: 1.5 }}>Claude is still on {status.provider}'s application. Stop it to start this one.</div>
      <button type="button" onClick={() => act("/stop")} style={{ ...quiet, color: MUT }}><Square size={12}/>Stop it</button>
      {problem && <p style={{ ...small, color: ERROR_TEXT, margin: "6px 0 0" }}>{problem}</p>}
    </div>
  );

  if (idle) return (
    <div style={box}>
      {missing.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "13.5px", fontWeight: 700, color: TEXT }}>Missing from your profile</div>
          <p style={{ ...small, margin: "2px 0 0" }}>Applications usually ask for these. Anything left empty, Claude asks you here when the form gets to it.</p>
          {missing.map(f => <ProfileTile key={f.key} label={f.label} hint={f.hint} kind={f.kind} options={f.options} onAnswer={v => saveField(f.key, v)}/>)}
        </div>
      )}
      <button type="button" onClick={start} style={button(G)}><Bot size={15}/>Let Claude start it</button>
      <p style={{ ...small, margin: "8px 0 0" }}>Opens {o.provider}'s site in a browser window on this computer and fills in the application from your profile. You approve what it types, and do the ID checks, declarations and paying in yourself.</p>
      {problem && <p style={{ ...small, color: ERROR_TEXT, margin: "6px 0 0" }}>{problem}</p>}
    </div>
  );

  const last = (status.log || []).filter(l => l.kind !== "handoff" && l.kind !== "ask").slice(-3);
  return (
    <div style={box}>
      {status.state === "approve" && status.pending && (
        <div>
          <div style={{ fontSize: "13.5px", fontWeight: 700, color: TEXT }}>Claude wants to:</div>
          <ul style={{ margin: "6px 0 10px", paddingLeft: "18px", fontSize: "13px", color: TEXT, lineHeight: 1.6 }}>
            {status.pending.actions.map((a, i) => (
              <li key={i}>{a.kind === "type" ? <>Type <b>{a.value}</b> into {a.field}</> : a.kind === "pick" ? <>Pick <b>{a.value}</b> in {a.field}</> : a.kind === "tick" ? <>Tick <b>{a.field}</b> ({a.value})</> : <>Choose <b>{a.field}</b> ({a.value})</>}</li>
            ))}
          </ul>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
            <button type="button" onClick={() => act("/approve")} style={button(G)}>Approve</button>
            <button type="button" onClick={() => act("/allow-all")} style={quiet}>Approve the rest of this application</button>
            <button type="button" onClick={() => act("/decline")} style={quiet}>Don't</button>
          </div>
        </div>
      )}

      {status.state === "ask" && status.question && (
        <div>
          <div style={{ fontSize: "13.5px", fontWeight: 700, color: TEXT }}>Claude needs an answer from you</div>
          <ProfileTile key={status.question.id} label={status.question.question} field={status.question.field} kind={status.question.kind} options={status.question.options}
            remember={!!status.question.profileKey} action="Enter it"
            disclosure={status.question.kind === "bank" ? "Used once, to fill in this form. Candid never saves your sort code or account number, not in your profile or anywhere else, and Claude never sees it." : null} onAnswer={(value, remember) => post("/answer", { value, remember }).then(setStatus).catch(() => setProblem("Couldn't reach the agent."))}/>
        </div>
      )}

      {status.state === "your_turn" && status.handoff && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13.5px", fontWeight: 700, color: TEXT }}><Hand size={15} color={G}/>Your turn</div>
          <p style={{ ...small, color: TEXT, margin: "4px 0 6px" }}>{status.handoff.reason}</p>
          <ul style={{ margin: "0 0 10px", paddingLeft: "18px", fontSize: "13px", color: TEXT, lineHeight: 1.6 }}>
            {status.handoff.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
          <button type="button" onClick={() => act("/handback")} style={button(G)}>Hand back to Claude</button>
        </div>
      )}

      {["starting", "working"].includes(status.state) && (
        <div style={{ fontSize: "13.5px", fontWeight: 700, color: TEXT }}>Claude is filling in {status.provider}'s application</div>
      )}

      {status.state === "done" && (
        <div style={{ fontSize: "13.5px", color: TEXT, lineHeight: 1.5 }}>
          <b>{status.result?.opened ? "Account opened." : "Claude stopped."}</b> {status.result?.summary}
          {status.result?.opened && <div style={small}>Ticked below. Pay the money in from your bank's app.</div>}
        </div>
      )}
      {["stopped", "error"].includes(status.state) && (
        <div style={{ fontSize: "13.5px", color: TEXT }}>{status.state === "error" ? status.error : "Stopped."} <button type="button" onClick={start} style={quiet}>Start again</button></div>
      )}

      {active && last.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: "18px", ...small }}>
          {last.map((l, i) => <li key={i}>{l.text}</li>)}
        </ul>
      )}
      {active && <button type="button" onClick={() => act("/stop")} style={{ ...quiet, color: MUT }}><Square size={12}/>Stop</button>}
      {problem && <p style={{ ...small, color: ERROR_TEXT, margin: "6px 0 0" }}>{problem}</p>}
    </div>
  );
}
