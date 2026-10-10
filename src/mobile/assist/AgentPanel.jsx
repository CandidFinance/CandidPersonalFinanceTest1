import { useEffect, useState } from "react";
import { Bot, Hand, Square } from "lucide-react";
import { G, WHITE, MUT, TEXT, SANS } from "../../design-tokens.js";

// "Let Claude start it": hands a picked account to the local account-opening
// agent (scripts/assist-agent/agent.js), which fills in the application in
// a browser window on this computer. Here the user approves what it types,
// does their own part when it's their turn, and hands back. Dev builds only:
// the agent runs on the user's own machine, and is a prototype.
// `onOpened()` ticks the pick as done once the agent reads a confirmation.

const AGENT = "http://127.0.0.1:5287";
const post = (path, body) => fetch(AGENT + path, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(r => r.json());

export const agentAvailable = o => import.meta.env.DEV && !!o.url && !o.appOnly && !o.pb;

export default function AgentPanel({ o, onOpened }) {
  const [status, setStatus] = useState(null);
  const [problem, setProblem] = useState(null);
  const active = status && ["starting", "working", "approve", "your_turn"].includes(status.state);

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
    post("/start", { url: o.url, provider: o.provider, product: o.product, amount: o.amount, isa: !!o.isa })
      .then(s => s.error ? setProblem(s.error) : setStatus(s))
      .catch(() => setProblem("The agent isn't running. Start it with: npm run assist-agent"));
  };

  const small = { fontSize: "12.5px", color: MUT, lineHeight: 1.5 };
  const button = (bg, fg = WHITE) => ({ background: bg, color: fg, border: bg === "none" ? "none" : "none", borderRadius: "100px", padding: "9px 14px", fontSize: "13px", fontWeight: 700, fontFamily: SANS, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" });
  const quiet = { background: "none", border: "none", padding: "9px 4px", fontSize: "13px", fontWeight: 700, color: G, fontFamily: SANS, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" };
  const box = { marginTop: "12px", padding: "12px 14px", borderRadius: "12px", background: "rgba(22,47,36,0.04)" };

  if (!status || status.state === "idle") return (
    <div style={box}>
      <button type="button" onClick={start} style={button(G)}><Bot size={15}/>Let Claude start it</button>
      <p style={{ ...small, margin: "8px 0 0" }}>Opens {o.provider}'s site in a browser window on this computer and fills in the application from your profile. You approve what it types, and do the ID checks, declarations and paying in yourself.</p>
      {problem && <p style={{ ...small, color: "#b3261e", margin: "6px 0 0" }}>{problem}</p>}
    </div>
  );

  const last = (status.log || []).filter(l => l.kind !== "handoff").slice(-3);
  return (
    <div style={box}>
      {status.state === "approve" && status.pending && (
        <div>
          <div style={{ fontSize: "13.5px", fontWeight: 700, color: TEXT }}>Claude wants to:</div>
          <ul style={{ margin: "6px 0 10px", paddingLeft: "18px", fontSize: "13px", color: TEXT, lineHeight: 1.6 }}>
            {status.pending.actions.map((a, i) => (
              <li key={i}>{a.kind === "type" ? <>Type <b>{a.value}</b> into {a.field}</> : <>Choose <b>{a.field}</b> ({a.value})</>}</li>
            ))}
          </ul>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
            <button type="button" onClick={() => act("/approve")} style={button(G)}>Approve</button>
            <button type="button" onClick={() => act("/allow-all")} style={quiet}>Approve the rest of this application</button>
            <button type="button" onClick={() => act("/decline")} style={quiet}>Don't</button>
          </div>
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
      {problem && <p style={{ ...small, color: "#b3261e", margin: "6px 0 0" }}>{problem}</p>}
    </div>
  );
}
