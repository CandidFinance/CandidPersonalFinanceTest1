import { useCallback, useEffect, useRef, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import posthog from "posthog-js";
import { ArrowUp } from "lucide-react";
import { G, WHITE, TEXT, SANS, CREAM, FIELD_BORDER } from "../../design-tokens.js";
import { TOPICS, WINDFALL, greeting, starters, matchTopic, wantsLead, answerParts, topicFigures, moduleTitle, MODULE_SUB, boldRuns } from "../../lib/chatTopics.js";
import { Bubble, Dots, DotsKeyframes, Thinking, SheenKeyframes, ModuleButton, AskNext } from "./ChatParts.jsx";
import ChatVisual from "./ChatVisuals.jsx";

// The Chat tab's questions and answers (chatTopics.js): the user asks, by a
// starter, an Ask next follow-up or by typing; Candid answers in a few short
// bubbles, one visual and a button into the module. "I've got a lump sum"
// opens the windfall conversation instead (MobileChatScreen).
//
// The conversation's state lives in useQAChat, held by MobileChatScreen, so
// it survives a visit to the lump-sum conversation and back. Opening the tab
// types out the hello; each answer starts after a few seconds of
// "Thinking", then builds: text word by word, one message flowing into the
// next, and visuals row by row after a moment of typing dots. So it reads
// as worked out, not pasted.

const OPEN_MS = 600;
const THINK_MS = 2000;
const THINK_JITTER_MS = 600;
const AFTER_USER_MS = 700;
const FLOW_MS = 300;          // between one built part and the next
const DOTS_MS = 1000;         // typing dots before a visual
const WORD_MS = 55;           // between words as text builds
const VISUAL_BUILD_MS = 1500; // a visual opening and its rows coming in
const MODULE_MS = 700;
const FRESH_MS = 4000;        // older messages show built (back from the lump sum)
let seq = 0;
const key = () => `qa${++seq}`;

const wordCount = text => String(text).trim().split(/\s+/).filter(Boolean).length;
// How long a shown message takes to build.
const buildMs = msg => (msg.text ? wordCount(msg.text) * WORD_MS + 400 : msg.visual ? VISUAL_BUILD_MS : MODULE_MS);

export function useQAChat(d, m, onWindfall) {
  const [msgs, setMsgs] = useState([]);
  const [queue, setQueue] = useState(() => greeting(d).map(text => ({ text })));
  const [typing, setTyping] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [next, setNext] = useState(null); // null: the starters
  const last = useRef(null);
  const shown = useRef(msgs);
  shown.current = msgs;

  // One part at a time, with time to read the one before. Runs when the
  // queue changes: a new answer, or the part before it shown.
  useEffect(() => {
    if (!queue.length) return;
    const prev = shown.current[shown.current.length - 1];
    const part = queue[0];
    // The part before finishes building first. Text then flows straight on;
    // a visual gets the typing dots while it's "built".
    const built = !prev || prev.from === "user" ? 0 : buildMs(prev);
    const wait = part.think ? THINK_MS + Math.round(Math.random() * THINK_JITTER_MS)
      : !prev ? OPEN_MS
      : prev.from === "user" ? AFTER_USER_MS
      : part.visual ? DOTS_MS
      : FLOW_MS;
    setThinking(!!part.think);
    setTyping(false);
    const dots = setTimeout(() => setTyping(!part.think && !!part.visual), built);
    const t = setTimeout(() => {
      setThinking(false);
      setTyping(false);
      setMsgs(list => [...list, { key: key(), from: "candid", at: Date.now(), ...part }]);
      setQueue(q => q.slice(1));
    }, built + wait);
    return () => { clearTimeout(dots); clearTimeout(t); };
  }, [queue]);

  const ask = useCallback((label, id, via) => {
    if (id === WINDFALL) {
      posthog.capture("chat_question", { topic: WINDFALL, via, matched: true });
      onWindfall();
      return;
    }
    const plain = id === "plain";
    const topicId = plain ? last.current : id;
    const topic = TOPICS[topicId] || TOPICS.fallback;
    const parts = plain && topic.plain ? [{ text: topic.plain }]
      : answerParts(topicId, topicFigures(d, m), { lead: via === "typed" && wantsLead(label) });
    if (!plain) last.current = topicId;
    // Never the typed words: people type their pay and family into chats.
    posthog.capture("chat_question", { topic: plain ? "plain" : topicId, via, matched: topicId !== "fallback" });
    setMsgs(list => [...list, { key: key(), from: "user", text: label }]);
    setQueue(parts.map((p, i) => (i ? p : { ...p, think: true })));
    setNext([...topic.next, ...(!plain && topic.plain ? [["In plain English", "plain"]] : [])]);
  }, [d, m, onWindfall]);

  // Busy until the last part has built too, so Ask next waits for it.
  const [building, setBuilding] = useState(false);
  const lastMsg = msgs[msgs.length - 1];
  useEffect(() => {
    if (!lastMsg || lastMsg.from === "user" || !lastMsg.at) return;
    setBuilding(true);
    const t = setTimeout(() => setBuilding(false), buildMs(lastMsg));
    return () => clearTimeout(t);
  }, [lastMsg]);

  return { msgs, typing, thinking, busy: typing || thinking || building || queue.length > 0, next: next || starters(d), ask, lastTopic: () => last.current };
}

// Builds word by word when fresh; shown whole otherwise.
function Text({ text, build }) {
  let n = 0;
  return boldRuns(text).map((r, i) => {
    const words = build
      ? r.text.split(/(\s+)/).map((w, j) => (/^\s+$/.test(w) || !w ? w
        : <span key={j} className="chat-word" style={{animationDelay:`${n++ * WORD_MS}ms`}}>{w}</span>))
      : r.text;
    return r.bold ? <b key={i}>{words}</b> : <span key={i}>{words}</span>;
  });
}

export default function QAChat({ chat, d, m, onGoTo }) {
  const { msgs, typing, thinking, busy, next, ask, lastTopic } = chat;
  const [draft, setDraft] = useState("");
  const bottom = useRef(null);
  const asked = msgs.some(msg => msg.from === "user");
  useEffect(() => { if (asked) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, typing, thinking, busy, asked]);

  const send = e => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    ask(text, matchTopic(text), "typed");
    setDraft("");
  };
  const open = moduleKey => {
    posthog.capture("chat_module_opened", { topic: lastTopic(), module: moduleKey });
    onGoTo(moduleKey);
  };
  const rise = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } };
  // A visual opens from the top; its rows and bars then come in (ChatVisuals).
  const unfold = { initial: { opacity: 0, clipPath: "inset(0 0 100% 0)" }, animate: { opacity: 1, clipPath: "inset(0 0 0% 0)" }, transition: { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] } };
  const fresh = msg => !!msg.at && Date.now() - msg.at < FRESH_MS;

  return (
    <MotionConfig reducedMotion="user">
      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
        {msgs.map(msg => {
          if (msg.from === "user") return <Bubble key={msg.key} from="user">{msg.text}</Bubble>;
          if (msg.visual) return <motion.div key={msg.key} {...(fresh(msg) ? unfold : {})} style={{display:"flex",margin:"6px 0"}}><ChatVisual id={msg.visual} d={d} m={m} build={fresh(msg)}/></motion.div>;
          if (msg.module) return (
            <motion.div key={msg.key} {...(fresh(msg) ? rise : {})} style={{display:"flex",marginTop:"4px"}}>
              <ModuleButton title={moduleTitle(msg.module)} sub={MODULE_SUB[msg.module]} onClick={() => open(msg.module)}/>
            </motion.div>
          );
          return <Bubble key={msg.key} from="candid"><Text text={msg.text} build={fresh(msg)}/></Bubble>;
        })}
        {thinking && <Bubble from="candid" typing><Thinking/></Bubble>}
        {typing && <Bubble from="candid" typing><Dots/></Bubble>}
      </div>

      {!busy && next.length > 0 && (
        <motion.div {...rise}>
          <AskNext items={next} label={asked ? "Ask next" : "Try asking"} onAsk={(text, id) => ask(text, id, asked ? "next" : "starter")}/>
        </motion.div>
      )}
      {/* Clear of the pinned message box and the tab bar below it. */}
      <div ref={bottom} style={{scrollMarginBottom:"calc(150px + env(safe-area-inset-bottom, 0px))"}}/>

      <form onSubmit={send}
        style={{position:"sticky",bottom:"calc(76px + env(safe-area-inset-bottom, 0px))",marginTop:"16px",paddingTop:"10px",display:"flex",gap:"8px",alignItems:"center",background:`linear-gradient(180deg, rgba(250,247,240,0) 0%, ${CREAM} 30%)`}}>
        <label htmlFor="chat-ask" style={{position:"absolute",width:1,height:1,overflow:"hidden",clip:"rect(0 0 0 0)"}}>Ask a question</label>
        <input id="chat-ask" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Ask about your money" autoComplete="off" enterKeyHint="send"
          style={{flex:1,minWidth:0,height:"46px",borderRadius:"100px",border:`1px solid ${FIELD_BORDER}`,background:WHITE,padding:"0 18px",fontSize:"16px",fontFamily:SANS,color:TEXT,boxSizing:"border-box"}}/>
        <button type="submit" aria-label="Send" disabled={busy || !draft.trim()}
          style={{width:"46px",height:"46px",flex:"none",borderRadius:"50%",border:"none",background:G,color:WHITE,display:"grid",placeItems:"center",cursor:busy || !draft.trim() ? "default" : "pointer",opacity:busy || !draft.trim() ? 0.35 : 1}}>
          <ArrowUp size={20} aria-hidden="true"/>
        </button>
      </form>
      <DotsKeyframes/>
      <SheenKeyframes/>
    </MotionConfig>
  );
}
