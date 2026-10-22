import { useEffect, useRef, useState } from "react";
import { reportStorageFailure } from "../../lib/storage.js";
import { invitedHere } from "../../lib/referral.js";
import { motion, MotionConfig } from "framer-motion";
import { Check, ChevronLeft } from "lucide-react";
import { NavBar } from "../../NavBar.jsx";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, SANS, CREAM } from "../../design-tokens.js";
import { ENTRY_QUESTIONS, CATCH_UP_QUESTIONS, toHandFor, entryChat, readingMs, CHAT_VARIANTS, firstPick, MODULE_NAMES } from "../../lib/appEntry.js";
import GuidedFlow from "../property/GuidedFlow.jsx";
import { Bubble, Dots, DotsKeyframes, Replies, ReplyButton } from "../chat/ChatParts.jsx";

// The app's entry (/app/start), in three parts: the questions (name, how
// confident they feel, what they'd like help with), then what's good to
// have to hand, marked as the questions being done, then how Candid works,
// as messages from Candid with replies to tap. Spec:
// docs/onboarding-guided-questions.md.
// `catchUp`: for someone who came in on a module link and skipped this
// (appEntry.js needsCatchUp): the same entry, its questions owning up to
// that, ending on `doneLabel` (where they were heading) rather than their
// first module.
export default function MobileEntryScreen({ d, m, set, onDone, catchUp = false, doneLabel = null }) {
  const [part, setPart] = useState("questions");
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [part]);

  // The confidence answer also goes to localStorage, where the user's row
  // reads it from (confidence_score).
  const save = (field, value) => {
    set(field, value);
    if (field === "confidence") { try { localStorage.setItem("candid_confidence_score", String(value)); } catch (e) { reportStorageFailure("save_confidence", e); } }
  };

  // The chat fills the screen like a messaging app: the page itself doesn't
  // scroll, the conversation does.
  if (part === "chat") return (
    <div style={{height:"100dvh",background:CREAM,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <NavBar light center="How Candid works"/>
      <HowCandidWorks d={d} onDone={onDone} doneLabel={doneLabel}/>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:CREAM,display:"flex",flexDirection:"column"}}>
      <NavBar light center="Getting started"/>
      <div style={{flex:1,maxWidth:"580px",margin:"0 auto",padding:"24px 20px",width:"100%",boxSizing:"border-box"}}>
        {/* Arrived on a friend's invite link (src/lib/referral.js). */}
        {part === "questions" && invitedHere() && (
          <div style={{fontSize:"13px",fontWeight:600,color:G,lineHeight:1.45,marginBottom:"14px"}}>A friend invited you: your second module is unlocked for free.</div>
        )}
        {part === "questions" && (
          <GuidedFlow questions={catchUp ? CATCH_UP_QUESTIONS : ENTRY_QUESTIONS} d={d} m={m} set={save} skipLabel={null} animateFirst track={{ flow: catchUp ? "catch_up" : "entry" }} onDone={() => setPart("toHand")}/>
        )}
        {part === "toHand" && <ToHand d={d} onBack={() => setPart("questions")} onContinue={() => setPart("chat")}/>}
      </div>
    </div>
  );
}

// Set apart from the questions without leaving the page's look: a tick and
// "questions done" above, and the list as soft tinted tiles, not the white
// outlined answer buttons the questions use.
function ToHand({ d, onBack, onContinue }) {
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
        <span style={{width:"22px",height:"22px",borderRadius:"50%",background:G,display:"inline-flex",alignItems:"center",justifyContent:"center"}}><Check size={13} color={WHITE} strokeWidth={3}/></span>
        <span style={{fontSize:"12.5px",fontWeight:700,color:G}}>That's the questions done</span>
      </div>
      <h2 style={{fontFamily:SERIF,fontSize:"21px",fontWeight:700,color:TEXT,lineHeight:1.3,margin:"18px 0 0"}}>Good to have to hand</h2>
      <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,margin:"8px 0 18px"}}>For when you open your modules. Rough figures are fine, and you can skip anything you don't know.</p>
      <div style={{display:"grid",gridAutoRows:"1fr",gap:"10px"}}>
        {toHandFor(d.interests).map(item => (
          <div key={item.what} style={{background:"rgba(22,47,36,0.05)",borderLeft:`3px solid ${GOLD}`,borderRadius:"10px",padding:"14px 16px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
            <div style={{fontSize:"17px",fontWeight:700,color:TEXT,lineHeight:1.3}}>{item.what}</div>
            {item.where && <div style={{fontSize:"13px",color:MUT,lineHeight:1.45,marginTop:"4px"}}>{item.where}</div>}
          </div>
        ))}
      </div>
      <button type="button" onClick={onContinue} style={{width:"100%",marginTop:"22px",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"13px",fontSize:"14px",fontWeight:700,fontFamily:SANS,cursor:"pointer"}}>Continue</button>
      <button type="button" onClick={onBack} style={{background:"none",border:"none",color:MUT,fontSize:"13px",fontWeight:700,fontFamily:SANS,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"2px",marginTop:"14px",padding:"6px 0"}}>
        <ChevronLeft size={15}/>Back
      </button>
    </div>
  );
}

// Candid's messages arrive one at a time. Before each, the typing dots show
// for as long as the message above takes to read (readingMs), so a new one
// never lands while the last is still being read. Newest at the bottom;
// older ones move up and fade out under the bar, as in a messaging app.
// The user's replies are buttons; a tapped reply is sent as their message.
//
// Motion, as in WhatsApp or iMessage: the typing bubble becomes the message
// (the same bubble, grown to fit), so nothing lands and is then pushed up;
// a new bubble rises from the bottom with a slight scale and fade; the rest
// glide up to make room (framer-motion layout animations).
function HowCandidWorks({ d, onDone, doneLabel = null }) {
  const [variant] = useState(() => ({
    opener: Math.floor(Math.random() * CHAT_VARIANTS.openers),
    checkIn: Math.floor(Math.random() * CHAT_VARIANTS.checkIns),
  }));
  const chat = entryChat(d, variant);
  const [sent, setSent] = useState([]);
  const [queue, setQueue] = useState(chat.intro);
  const [replies, setReplies] = useState(null);
  const [typing, setTyping] = useState(false);
  const after = useRef("understood");

  useEffect(() => {
    const last = sent[sent.length - 1];
    if (!queue.length) {
      if (!after.current) return;
      const next = after.current;
      // The replies show as soon as the last message lands.
      after.current = null;
      setReplies(next);
      return;
    }
    const wait = !last || last.from === "user" ? 1200 : readingMs(last.text);
    const start = setTimeout(() => setTyping(true), 250);
    const t = setTimeout(() => {
      setTyping(false);
      setSent(s => [...s, { from:"candid", text:queue[0] }]);
      setQueue(q => q.slice(1));
    }, wait);
    return () => { clearTimeout(start); clearTimeout(t); };
  }, [queue]);

  const reply = (option, then, next) => {
    setReplies(null);
    setSent(s => [...s, { from:"user", text:option.label }]);
    after.current = next;
    setQueue(then);
  };

  // The typing bubble takes the key of the message it becomes.
  const rows = sent.map((msg, i) => ({ ...msg, key: i }));
  if (typing) rows.push({ from: "candid", typing: true, key: sent.length });

  const fade = "linear-gradient(to bottom, transparent 0, #000 64px)";
  const rise = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] } };
  return (
    <MotionConfig reducedMotion="user">
      {/* column-reverse keeps the scroll pinned to the newest message, so
          nothing needs scrolling as messages arrive; scroll up for older. */}
      <motion.div layoutScroll style={{flex:1,minHeight:0,overflowY:"auto",display:"flex",flexDirection:"column-reverse",WebkitMaskImage:fade,maskImage:fade}}>
        <div style={{maxWidth:"580px",width:"100%",margin:"0 auto",padding:"64px 20px 12px",boxSizing:"border-box",display:"flex",flexDirection:"column",gap:"8px"}}>
          {rows.map(row => <Bubble key={row.key} from={row.from} typing={row.typing}>{row.typing ? <Dots/> : row.text}</Bubble>)}
        </div>
      </motion.div>
      <div style={{maxWidth:"580px",width:"100%",margin:"0 auto",padding:"8px 20px",paddingBottom:"calc(16px + env(safe-area-inset-bottom, 0px))",boxSizing:"border-box",minHeight:"74px"}}>
        {replies === "understood" && (
          <motion.div key="understood" {...rise}><Replies>{chat.understood.map(o => <ReplyButton key={o.value} onClick={() => reply(o, o.value === "no" ? [...chat.plainer, ...chat.how] : chat.how, "ready")}>{o.label}</ReplyButton>)}</Replies></motion.div>
        )}
        {replies === "ready" && <motion.div key="ready" {...rise}><Replies><ReplyButton onClick={() => reply(chat.ready, [chat.last], "enter")}>{chat.ready.label}</ReplyButton></Replies></motion.div>}
        {replies === "enter" && (
          <motion.div key="enter" {...rise}>
            <button type="button" onClick={onDone} style={{width:"100%",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"14px",fontSize:"14.5px",fontWeight:700,fontFamily:SANS,cursor:"pointer"}}>
              {doneLabel || (firstPick(d) ? `Start with ${MODULE_NAMES[firstPick(d)]}` : "Explore my modules")}
            </button>
          </motion.div>
        )}
      </div>
      <DotsKeyframes/>
    </MotionConfig>
  );
}

