import { useCallback, useEffect, useRef, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import posthog from "posthog-js";
import { ArrowUp } from "lucide-react";
import { G, WHITE, TEXT, MUT, SANS, CREAM, FIELD_BORDER } from "../../design-tokens.js";
import { TOPICS, WINDFALL, matchTopic, wantsLead, answerParts, topicFigures, MODULE_SUB, boldRuns } from "../../lib/chatTopics.js";
import { computeModuleStatuses } from "../../lib/moduleStatus.js";
import { opening, titleOf, askReplies, CHAT_QUICK } from "../../lib/chatStart.js";
import { makeVoice } from "../../lib/chatVoice.js";
import { Bubble, Dots, DotsKeyframes, Thinking, SheenKeyframes, ModuleButton, AskNext } from "./ChatParts.jsx";
import ChatVisual from "./ChatVisuals.jsx";
import { AreaPicker, ChatQuestion, ModuleRows } from "./ChatStartParts.jsx";
import { useChatStart } from "./useChatStart.js";

// The Chat tab's questions and answers (chatTopics.js): the user asks, by a
// starter, an Ask next follow-up or by typing; Candid answers in a few short
// bubbles, one visual and a button into the module. "I've got a lump sum"
// opens the windfall conversation instead (MobileChatScreen). It opens on
// the way in (chatStart.js, useChatStart): what they've checked, or the
// areas to pick and each module's questions in the conversation.
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
const STACK_SPRING = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 }; // as the bubbles' own (ChatParts)
let seq = 0;
const key = () => `qa${++seq}`;

const wordCount = text => String(text).trim().split(/\s+/).filter(Boolean).length;
// How long a shown message takes to build.
const buildMs = msg => (msg.text ? wordCount(msg.text) * WORD_MS + 400 : msg.visual || msg.rows ? VISUAL_BUILD_MS : msg.divider ? 200 : MODULE_MS);

export function useQAChat(d, m, { onWindfall, set, marketRates, answerModule }) {
  // Candid's phrases (chatVoice.js), from a different place each visit.
  const [voice] = useState(() => makeVoice(Math.floor(Math.random() * 1000)));
  // The way in, worked out once as the tab opens.
  const [start] = useState(() => opening(d, m, computeModuleStatuses(d, m, marketRates), undefined, voice));
  const [msgs, setMsgs] = useState([]);
  const [queue, setQueue] = useState(start.parts);
  const [typing, setTyping] = useState(false);
  const [thinking, setThinking] = useState(false);
  // What's offered under the thread: { kind: "next", items, label },
  // { kind: "areas" }, { kind: "question" } (the module question on
  // screen), or null while Candid works something out.
  const [replies, setReplies] = useState(start.replies);
  const last = useRef(null);
  useEffect(() => { posthog.capture("chat_start_shown", { branch: start.branch }); }, [start]);

  // The user's reply (none when Candid goes on by itself), then Candid's
  // parts, with "Thinking" before the first unless `think` is false.
  // `divider`: a new section starts, named, before the reply.
  const say = useCallback((userText, parts, { think = true, divider = null } = {}) => {
    if (divider) setMsgs(list => [...list, { key: key(), from: "candid", divider }]);
    if (userText) setMsgs(list => [...list, { key: key(), from: "user", text: userText }]);
    setQueue(q => [...q, ...parts.map((p, i) => (i || !think ? p : { ...p, think: true }))]);
  }, []);
  const flow = useChatStart({ d, m, marketRates, set, answerModule, say, setReplies, voice });
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
      : part.visual || part.rows ? DOTS_MS
      : FLOW_MS;
    setThinking(!!part.think);
    setTyping(false);
    const dots = setTimeout(() => setTyping(!part.think && !!(part.visual || part.rows)), built);
    const t = setTimeout(() => {
      setThinking(false);
      setTyping(false);
      setMsgs(list => [...list, { key: key(), from: "candid", at: Date.now(), ...part }]);
      setQueue(q => q.slice(1));
    }, built + wait);
    return () => { clearTimeout(dots); clearTimeout(t); };
  }, [queue]);

  const ask = useCallback((label, id, via) => {
    if (flow.route(label, id)) return;
    flow.leave();
    if (id === WINDFALL) {
      posthog.capture("chat_question", { topic: WINDFALL, via, matched: true });
      // A module question left on screen has nothing to answer on the way back.
      setReplies(r => (r?.kind === "question" ? askReplies(d) : r));
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
    setReplies({ kind: "next", label: "Ask next", items: [...topic.next, ...(!plain && topic.plain ? [["In plain English", "plain"]] : [])] });
  }, [d, m, onWindfall, flow]);

  // Busy until the last part has built too, so Ask next waits for it.
  const [building, setBuilding] = useState(false);
  const lastMsg = msgs[msgs.length - 1];
  useEffect(() => {
    if (!lastMsg || lastMsg.from === "user" || !lastMsg.at) return;
    setBuilding(true);
    const t = setTimeout(() => setBuilding(false), buildMs(lastMsg));
    return () => clearTimeout(t);
  }, [lastMsg]);

  return { msgs, typing, thinking, busy: typing || thinking || building || queue.length > 0, replies, flow, ask, lastTopic: () => last.current };
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
  const { msgs, typing, thinking, busy, replies, flow, ask, lastTopic } = chat;
  const [draft, setDraft] = useState("");
  const asked = msgs.some(msg => msg.from === "user");
  // The page follows the newest message while the reader is at the bottom,
  // so nothing new lands behind the message box; once they scroll up to
  // read back, it stays where they are until they're back at the bottom.
  // Only their own scrolling unpins it: the page's own smooth scroll
  // passes through "not at the bottom" too.
  const thread = useRef(null);
  const pinned = useRef(true);
  useEffect(() => {
    let touched = 0;
    // Within 48px still counts as at the bottom for pinning, but following
    // goes all the way down: a short new message (one line, Ask next) would
    // otherwise stay part-hidden behind the message box.
    const below = () => document.documentElement.scrollHeight - (window.innerHeight + window.scrollY);
    const atBottom = () => below() <= 48;
    // Keys only when they scroll the page, not typing in the message box.
    const touch = e => { if (e.type !== "keydown" || !/^(INPUT|TEXTAREA)$/.test(e.target?.tagName)) touched = Date.now(); };
    const onScroll = () => { if (atBottom()) pinned.current = true; else if (Date.now() - touched < 400) pinned.current = false; };
    const follow = () => { if (pinned.current && below() > 1) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }); };
    const grows = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(follow);
    if (grows && thread.current) grows.observe(thread.current);
    const inputs = ["wheel", "touchmove", "keydown"];
    inputs.forEach(e => window.addEventListener(e, touch, { passive: true }));
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { grows?.disconnect(); inputs.forEach(e => window.removeEventListener(e, touch)); window.removeEventListener("scroll", onScroll); };
  }, []);

  const send = e => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    pinned.current = true;
    if (!flow.typed(text)) ask(text, matchTopic(text), "typed");
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

  // Where the latest section starts: everything before it fades back.
  const cut = msgs.findLastIndex(msg => msg.divider);
  const message = msg => {
    if (msg.divider) return (
      <div role="separator" aria-label={msg.divider} style={{display:"flex",alignItems:"center",gap:"10px",margin:"22px 0 8px"}}>
        <span style={{flex:1,height:"1px",background:"rgba(22,47,36,0.16)"}}/>
        <span style={{fontSize:"12px",fontWeight:700,color:MUT,fontFamily:SANS}}>{msg.divider}</span>
        <span style={{flex:1,height:"1px",background:"rgba(22,47,36,0.16)"}}/>
      </div>
    );
    if (msg.from === "user") return <Bubble from="user">{msg.text}</Bubble>;
    if (msg.visual) return <motion.div {...(fresh(msg) ? unfold : {})} style={{display:"flex",margin:"6px 0"}}><ChatVisual id={msg.visual} d={d} m={m} build={fresh(msg)}/></motion.div>;
    if (msg.rows) return <motion.div {...(fresh(msg) ? unfold : {})} style={{display:"flex",margin:"0 0 4px"}}><ModuleRows rows={msg.rows} build={fresh(msg)} onOpen={open}/></motion.div>;
    if (msg.module) return (
      <motion.div {...(fresh(msg) ? rise : {})} style={{display:"flex",marginTop:"4px"}}>
        <ModuleButton title={titleOf(msg.module)} sub={MODULE_SUB[msg.module]} onClick={() => open(msg.module)}/>
      </motion.div>
    );
    if (msg.note) return <Bubble from="candid"><span style={{display:"block",fontSize:"13px",lineHeight:1.45,color:MUT}}><Text text={msg.text} build={fresh(msg)}/></span></Bubble>;
    return <Bubble from="candid"><Text text={msg.text} build={fresh(msg)}/></Bubble>;
  };

  return (
    <MotionConfig reducedMotion="user">
      {/* The thread fills the screen and sits at its foot, so the message
          box is always just above the tab bar and the conversation builds
          upwards from it: each new message lands at the bottom, nearest
          the box, and pushes the earlier ones up. Its height is the screen
          less the page's top padding and the room kept below the box; the
          negative margin takes back the part of the page's bottom padding
          that the box's own room already covers. From 1000px wide there's
          no tab bar (MobileLayout), so the box sits near the bottom edge. */}
      <style>{`
        .qa-thread { display: flex; flex-direction: column; justify-content: flex-end;
          min-height: calc(100vh - 16px - env(safe-area-inset-top, 0px) - 76px - env(safe-area-inset-bottom, 0px));
          min-height: calc(100dvh - 16px - env(safe-area-inset-top, 0px) - 76px - env(safe-area-inset-bottom, 0px));
          margin-bottom: -44px; }
        .qa-box { bottom: calc(76px + env(safe-area-inset-bottom, 0px)); }
        @media (min-width: 1000px) {
          .qa-thread { min-height: calc(100vh - 110px); min-height: calc(100dvh - 110px); margin-bottom: -32px; }
          .qa-box { bottom: 24px; }
        }
      `}</style>
      <div className="qa-thread" ref={thread}>
        {/* Moves as one when a message is added, so the new one rises in
            at the bottom with the rest, rather than appearing where the
            last one was while that one slides up past it. */}
        <motion.div layout="position" transition={STACK_SPRING} style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          {msgs.map((msg, i) => (
            // Each module is a section, opened by a named rule; the
            // sections before the latest fade back.
            <div key={msg.key} style={{display:"flex",flexDirection:"column",opacity:i < cut ? 0.4 : 1,transition:"opacity 0.8s ease"}}>
              {message(msg)}
            </div>
          ))}
          {thinking && <Bubble from="candid" typing><Thinking/></Bubble>}
          {typing && <Bubble from="candid" typing><Dots/></Bubble>}
        </motion.div>

        {!busy && replies?.kind === "next" && replies.items.length > 0 && (
          <motion.div {...rise}>
            <AskNext items={replies.items} label={replies.label} onAsk={(text, id) => { pinned.current = true; ask(text, id, asked ? "next" : "starter"); }}/>
          </motion.div>
        )}
        {!busy && replies?.kind === "areas" && (
          <motion.div {...rise}>
            <AreaPicker onDone={values => { pinned.current = true; flow.pickAreas(values); }}/>
          </motion.div>
        )}
        {!busy && replies?.kind === "question" && flow.run && (
          <motion.div {...rise} key={flow.run.qid}>
            <ChatQuestion setup={CHAT_QUICK[flow.run.key]} qid={flow.run.qid} ctx={{ d, m, a: flow.run.a, direct: true }}
              onAnswer={value => { pinned.current = true; flow.answer(value); }}/>
          </motion.div>
        )}

        <form onSubmit={send} className="qa-box"
          style={{position:"sticky",marginTop:"16px",paddingTop:"10px",display:"flex",gap:"8px",alignItems:"center",background:`linear-gradient(180deg, rgba(250,247,240,0) 0%, ${CREAM} 30%)`}}>
          <label htmlFor="chat-ask" style={{position:"absolute",width:1,height:1,overflow:"hidden",clip:"rect(0 0 0 0)"}}>Ask a question</label>
          <input id="chat-ask" value={draft} onChange={e => setDraft(e.target.value)} placeholder={flow.hint || "Ask about your money"} autoComplete="off" enterKeyHint="send"
            style={{flex:1,minWidth:0,height:"46px",borderRadius:"100px",border:`1px solid ${FIELD_BORDER}`,background:WHITE,padding:"0 18px",fontSize:"16px",fontFamily:SANS,color:TEXT,boxSizing:"border-box"}}/>
          <button type="submit" aria-label="Send" disabled={busy || !draft.trim()}
            style={{width:"46px",height:"46px",flex:"none",borderRadius:"50%",border:"none",background:G,color:WHITE,display:"grid",placeItems:"center",cursor:busy || !draft.trim() ? "default" : "pointer",opacity:busy || !draft.trim() ? 0.35 : 1}}>
            <ArrowUp size={20} aria-hidden="true"/>
          </button>
        </form>
      </div>
      <DotsKeyframes/>
      <SheenKeyframes/>
    </MotionConfig>
  );
}
