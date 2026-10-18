import { useEffect, useMemo, useRef, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import posthog from "posthog-js";
import { G, WHITE, MUT, TEXT, SERIF, SANS, RADIUS_CARD } from "../../design-tokens.js";
import { fmt } from "../../lib/format.js";
import { readingMs } from "../../lib/appEntry.js";
import { windfallOptions, sourceNote, roomFor, describeSplit, settlementLines, settlementGross, SETTLEMENT_PARTS, WINDFALL_SOURCES, WINDFALL_EARMARKS, WINDFALL_WHEN } from "../../lib/windfall.js";
import { Bubble, Dots, DotsKeyframes, Replies, ReplyButton } from "../chat/ChatParts.jsx";
import PillMoneyInput from "../PillMoneyInput.jsx";

// "I've got a lump sum: what do I do with it?" as a conversation, in the
// Chat tab. Candid asks a few things (how much, here yet or coming, where
// it's from, what it's for; for redundancy, the settlement's parts and pay
// this tax year before leaving, since they're taxed differently), then
// sets out every place it could go with
// what each is worth (src/lib/windfall.js), most added per £ first. The user
// splits it themselves; Candid says what their split does. Guidance, not
// advice: nothing is pre-filled or put first as what to do.
//
// The answers and split are kept in the user's inputs (`windfall`), so the
// conversation picks up where they left it.

const TYPING_MS = 1100;

export default function WindfallChat({ d, m, set, marketRates }) {
  const saved = d.windfall || null;
  const [w, setW] = useState(() => saved || {});
  const [split, setSplit] = useState(() => saved?.split || {});
  const [sent, setSent] = useState([]);
  const [queue, setQueue] = useState([]);
  const [typing, setTyping] = useState(false);
  const [prompt, setPrompt] = useState(null);
  const next = useRef(null);
  const [amountInput, setAmountInput] = useState(null);
  const [partsInput, setPartsInput] = useState({});
  const [salaryInput, setSalaryInput] = useState(null);
  const name = (d.name || "").trim();

  const plan = useMemo(() => (w.amount > 0 && w.source && w.earmark ? windfallOptions(d, m, w, marketRates) : null), [d, m, w, marketRates]);
  const placed = Object.values(split).reduce((t, v) => t + (+v || 0), 0);

  // Kept with the tax year it's for, so a settlement only counts towards
  // that year's tax band (metrics earnedEarlierThisYear).
  const keep = (answers, nextSplit = split) => set("windfall", { ...answers, taxYear: m.taxYear, split: nextSplit });

  // Candid's messages, one at a time, each after the last has had time to
  // be read; then whatever the user answers next.
  const say = (lines, then) => {
    setPrompt(null);
    next.current = then;
    setQueue(q => [...q, ...lines.filter(Boolean)]);
  };
  useEffect(() => {
    if (!queue.length) {
      if (next.current) { setPrompt(next.current); next.current = null; }
      return;
    }
    const last = sent[sent.length - 1];
    const wait = !last || last.from === "user" ? TYPING_MS : readingMs(last.text);
    const start = setTimeout(() => setTyping(true), 200);
    const t = setTimeout(() => {
      setTyping(false);
      setSent(s => [...s, { from: "candid", text: queue[0] }]);
      setQueue(q => q.slice(1));
    }, wait);
    return () => { clearTimeout(start); clearTimeout(t); };
  }, [queue]);
  const answer = text => setSent(s => [...s, { from: "user", text }]);

  // Opening: where they left off, or the start. Once, even when React runs
  // effects twice in development.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (saved?.split && saved.amount > 0 && saved.earmark) {
      say([`Welcome back${name ? `, ${name}` : ""}. Here's where you'd got to with your ${fmt(saved.parts ? windfallOptions(d, m, saved, marketRates).amount : saved.amount)}.`], "results");
    } else {
      say([
        `Got some money coming in, or just landed some${name ? `, ${name}` : ""}?`,
        "Tell me a bit about it, and I'll set out where it could go and what each option is worth to you.",
        "Then where it goes is up to you.",
      ], "start");
    }
    posthog.capture("windfall_opened", { returning: !!saved?.split });
  }, []);

  // Keep the newest message in view.
  const bottom = useRef(null);
  useEffect(() => { if (prompt !== "results") bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [sent.length, typing, prompt]);

  const choose = (field, option, then) => {
    const answers = { ...w, [field]: option.value };
    setW(answers);
    answer(option.label);
    then(answers);
  };
  const toResults = answers => {
    keep(answers, {});
    setSplit({});
    posthog.capture("windfall_options_shown", { amount: answers.amount, source: answers.source, earmark: answers.earmark, when: answers.when || null });
    say(["Right, I've run that against your numbers.",
      `Here's where your ${answers.parts ? `${fmt(windfallOptions(d, m, answers, marketRates).amount)} after tax` : fmt(answers.amount)} could go, the most added for each pound first. Put as much or as little in each as you like.`], "results");
  };
  // Pay before leaving known: what the settlement comes to after tax, then on.
  const settled = (earnedBefore, said) => {
    const answers = { ...w, earnedBefore };
    setW(answers);
    set("earnedThisTaxYear", String(earnedBefore));
    answer(said);
    say([...settlementLines(answers, m), "Is any of it already meant for something?"], "earmark");
  };
  const startAgain = () => {
    setW({}); setSplit({}); setAmountInput(null); setPartsInput({}); setSalaryInput(null); set("windfall", null);
    answer("Start again");
    say(["Sure. How much is it?"], "amount");
  };

  const setPlaced = (key, value) => {
    const next = { ...split, [key]: Math.max(0, Math.round(+value || 0)) };
    if (!next[key]) delete next[key];
    setSplit(next);
    keep(w, next);
  };
  const finish = () => {
    answer("That's my split");
    posthog.capture("windfall_split_made", { amount: w.amount, placed, keys: Object.keys(split).join(",") });
    say([describeSplit(split, plan), "It's your call. Come back and change it any time."], "done");
  };

  const rows = sent.map((msg, i) => ({ ...msg, key: i }));
  if (typing) rows.push({ from: "candid", typing: true, key: sent.length });
  // The options open as soon as Candid's introduction to them lands; once
  // the split's made they fold away, so what it does reads as the next
  // messages. Scrolled to as they open.
  const optionsRef = useRef(null);
  useEffect(() => { if (prompt === "results") optionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [prompt]);
  const rise = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] } };

  return (
    <MotionConfig reducedMotion="user">
      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
        {rows.map(row => <Bubble key={row.key} from={row.from} typing={row.typing}>{row.typing ? <Dots/> : row.text}</Bubble>)}
      </div>

      <div style={{marginTop:"14px"}}>
        {prompt === "start" && <motion.div {...rise}><Replies><ReplyButton onClick={() => { answer("Let's do it"); say(["How much is it?"], "amount"); }}>Let's do it</ReplyButton></Replies></motion.div>}

        {prompt === "amount" && (
          <motion.div {...rise} style={{display:"flex",gap:"8px",alignItems:"center"}}>
            <PillMoneyInput label="Amount" value={amountInput} onChange={setAmountInput}/>
            <ReplyButton disabled={!(amountInput > 0)} onClick={() => {
              const answers = { ...w, amount: Math.round(amountInput) };
              setW(answers); answer(fmt(answers.amount)); setAmountInput(null);
              say(["Is it in your account already, or still on its way?"], "arrived");
            }}>Next</ReplyButton>
          </motion.div>
        )}

        {prompt === "arrived" && (
          <motion.div {...rise}><Replies>
            {[{ value: true, label: "It's arrived" }, { value: false, label: "It's on its way" }].map(o => (
              <ReplyButton key={o.label} onClick={() => choose("arrived", o, () => say(["Where's it from?"], "source"))}>{o.label}</ReplyButton>
            ))}
          </Replies></motion.div>
        )}

        {prompt === "source" && (
          <motion.div {...rise}><Replies>
            {WINDFALL_SOURCES.map(o => (
              <ReplyButton key={o.value} onClick={() => choose("source", o, answers => o.value === "redundancy"
                ? say(["A settlement is usually made of parts, and they're taxed differently.", "Roughly how much is each? Your settlement agreement lists them. Leave out any that don't apply."], "parts")
                : say([sourceNote(answers, d), "Is any of it already meant for something?"], "earmark"))}>{o.label}</ReplyButton>
            ))}
          </Replies></motion.div>
        )}

        {prompt === "parts" && (
          <motion.div {...rise} style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {SETTLEMENT_PARTS.map(part => (
              <PillMoneyInput key={part.key} label={part.label} value={partsInput[part.key] || null} onChange={v => setPartsInput(x => ({ ...x, [part.key]: v || 0 }))}/>
            ))}
            <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"2px 4px 0"}}>Amounts before tax. A thank-you payment counts with redundancy pay unless your contract promised it.</p>
            <Replies><ReplyButton disabled={!(settlementGross(partsInput) > 0)} onClick={() => {
              const parts = Object.fromEntries(SETTLEMENT_PARTS.map(p => [p.key, Math.round(+partsInput[p.key] || 0)]).filter(([, v]) => v > 0));
              const answers = { ...w, parts, amount: settlementGross(parts) };
              setW(answers);
              answer(SETTLEMENT_PARTS.filter(p => parts[p.key]).map(p => `${p.label.replace(/ \(PILON\)| and any thank-you/, "")} ${fmt(parts[p.key])}`).join(", "));
              // Pay before leaving: already told Candid, or asked now
              // (starting from the estimate from their last salary).
              const told = d.earnedThisTaxYear !== "" && d.earnedThisTaxYear != null;
              if (told) {
                const withPay = { ...answers, earnedBefore: +d.earnedThisTaxYear };
                setW(withPay);
                say([`Going on the ${fmt(+d.earnedThisTaxYear)} you told me you'd earned this tax year before leaving.`, ...settlementLines(withPay, m), "Is any of it already meant for something?"], "earmark");
              } else {
                if (m.earnedEarlierThisYear > 0) setAmountInput(m.earnedEarlierThisYear);
                say(["And what had you earned this tax year before leaving, before tax? Your last payslip shows it as pay to date."], "earned");
              }
            }}>Next</ReplyButton></Replies>
          </motion.div>
        )}

        {prompt === "earned" && (
          <motion.div {...rise} style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
              <PillMoneyInput label="Earned this tax year" value={amountInput} onChange={setAmountInput}/>
              <ReplyButton disabled={amountInput == null} onClick={() => settled(Math.round(+amountInput || 0), fmt(Math.round(+amountInput || 0)))}>Next</ReplyButton>
            </div>
            <Replies><ReplyButton onClick={() => { answer("Not sure"); say(["No problem. What was your salary, before tax?"], "salary"); }}>Not sure</ReplyButton></Replies>
          </motion.div>
        )}

        {prompt === "salary" && (
          <motion.div {...rise} style={{display:"flex",gap:"8px",alignItems:"center"}}>
            <PillMoneyInput label="Salary a year" value={salaryInput} onChange={setSalaryInput}/>
            <ReplyButton disabled={!(salaryInput > 0)} onClick={() => { answer(fmt(Math.round(salaryInput))); say(["And which was your last month of pay?"], "lastMonth"); }}>Next</ReplyButton>
          </motion.div>
        )}

        {prompt === "lastMonth" && (
          <motion.div {...rise}><Replies>
            {monthsSoFar().map((label, i) => (
              <ReplyButton key={label} onClick={() => settled(Math.round(salaryInput * (i + 1) / 12), label)}>{label}</ReplyButton>
            ))}
          </Replies></motion.div>
        )}

        {prompt === "earmark" && (
          <motion.div {...rise}><Replies>
            {WINDFALL_EARMARKS.map(o => (
              <ReplyButton key={o.value} onClick={() => choose("earmark", o, answers => {
                if (o.value === "home" || o.value === "purchase") say([`When might you need it for ${o.value === "home" ? "your home" : "that"}?`], "when");
                else toResults({ ...answers, when: null });
              })}>{o.label}</ReplyButton>
            ))}
          </Replies></motion.div>
        )}

        {prompt === "when" && (
          <motion.div {...rise}><Replies>
            {WINDFALL_WHEN.map(o => <ReplyButton key={o.value} onClick={() => choose("when", o, toResults)}>{o.label}</ReplyButton>)}
          </Replies></motion.div>
        )}

        {prompt === "results" && plan && (
          <motion.div {...rise} ref={optionsRef} style={{scrollMarginTop:"12px"}}>
            <Options plan={plan} split={split} setPlaced={setPlaced}/>
            <div style={{position:"sticky",bottom:"calc(76px + env(safe-area-inset-bottom, 0px))",marginTop:"14px",background:G,color:WHITE,borderRadius:RADIUS_CARD,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",boxShadow:"0 6px 18px rgba(22,47,36,0.18)"}}>
              <div>
                <div style={{fontFamily:SERIF,fontSize:"20px",fontWeight:700}}>{fmt(placed)} <span style={{fontFamily:SANS,fontSize:"13px",fontWeight:500,opacity:0.8}}>of {fmt(plan.amount)} placed</span></div>
              </div>
              <button type="button" disabled={!placed} onClick={finish} style={{background:WHITE,color:G,border:"none",borderRadius:"100px",padding:"10px 16px",fontSize:"14px",fontWeight:700,fontFamily:SANS,cursor:placed ? "pointer" : "default",opacity:placed ? 1 : 0.5}}>That's my split</button>
            </div>
            <div style={{marginTop:"14px"}}><Replies><ReplyButton onClick={startAgain}>Start again</ReplyButton></Replies></div>
          </motion.div>
        )}

        {prompt === "done" && (
          <motion.div {...rise}><Replies>
            <ReplyButton onClick={() => { answer("Change my split"); setPrompt("results"); }}>Change my split</ReplyButton>
            <ReplyButton onClick={startAgain}>Start again</ReplyButton>
          </Replies></motion.div>
        )}
        <div ref={bottom}/>
      </div>
      <DotsKeyframes/>
    </MotionConfig>
  );
}

// Every place it could go, as cards to put money in. The money to live on
// (or the emergency fund) first, apart, since its worth isn't in £; then the
// ranked options; then what's left out and why.
function Options({ plan, split, setPlaced }) {
  const card = { background:WHITE, border:"1px solid rgba(22,47,36,0.1)", borderRadius:RADIUS_CARD, padding:"16px", marginTop:"10px" };
  const muted = { fontSize:"12.5px", color:MUT, lineHeight:1.5, margin:"4px 0 0" };
  const row = (option, figure, per) => {
    const placed = +split[option.key] || 0;
    const room = roomFor(option, split, plan);
    return (
      <div key={option.key} style={card}>
        <div style={{fontSize:"15px",fontWeight:700,color:TEXT}}>{option.title}</div>
        <div style={{marginTop:"6px"}}>
          <span style={{fontFamily:SERIF,fontSize:"22px",fontWeight:700,color:G}}>{figure}</span>
          <span style={{fontSize:"13px",color:MUT,marginLeft:"6px"}}>{per}</span>
        </div>
        {option.detail && <p style={muted}>{option.detail}</p>}
        <p style={muted}>{option.access}</p>
        {option.fit && <p style={{...muted,color:G,fontWeight:600}}>{option.fit}</p>}
        <div style={{display:"flex",gap:"8px",alignItems:"center",marginTop:"12px"}}>
          <PillMoneyInput label={`Put in (up to ${fmt(room)})`} value={placed || null} onChange={v => setPlaced(option.key, Math.min(+v || 0, room))}/>
          {room > placed && <ReplyButton onClick={() => setPlaced(option.key, room)}>{placed ? "Fill" : `Add ${fmt(room)}`}</ReplyButton>}
        </div>
      </div>
    );
  };
  const valueLine = o => {
    const placed = +split[o.key] || 0;
    const on = placed || Math.min(o.cap, plan.amount);
    const v = o.value(on);
    return [`+${fmt(v.figure)}`, `${v.per}, on ${fmt(on)}`];
  };
  return (
    <div>
      {plan.safety && (() => {
        const s = plan.safety, on = +split.emergency || s.cap;
        const months = s.monthsFor(on);
        return row({ ...s, detail: s.line }, `+${months < 10 ? months.toFixed(1) : Math.round(months)} months`, `of spending covered, on ${fmt(on)}`);
      })()}
      {plan.options.map(o => row(o, ...valueLine(o)))}
      {plan.leftOut.length > 0 && (
        <div style={{marginTop:"18px"}}>
          <hr style={{border:"none",borderTop:"1px solid rgba(22,47,36,0.12)",margin:"0 0 12px"}}/>
          <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Left out</div>
          {plan.leftOut.map(l => (
            <div key={l.title} style={{marginTop:"8px"}}>
              <div style={{fontSize:"14px",fontWeight:700,color:TEXT}}>{l.title}</div>
              <p style={muted}>{l.why}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The months of this tax year so far, April first, for "which was your last
// month of pay?".
function monthsSoFar(now = new Date()) {
  const start = new Date(now.getMonth() >= 3 && !(now.getMonth() === 3 && now.getDate() < 6) ? now.getFullYear() : now.getFullYear() - 1, 3, 1);
  const out = [];
  for (const d = new Date(start); d <= now; d.setMonth(d.getMonth() + 1)) out.push(d.toLocaleDateString("en-GB", { month: "long" }));
  return out;
}
