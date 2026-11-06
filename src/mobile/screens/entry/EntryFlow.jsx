import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, Plus } from "lucide-react";
import posthog from "posthog-js";
import { invitedHere } from "../../../lib/referral.js";
import { signedIn } from "../../../lib/entitlement.js";
import { GUESS_ORDER, entryPatch, guessQuestions, moduleGuess } from "../../../lib/guesses.js";
import { HERO_SIZE } from "./art.js";
import { LOOK, Monogram, Segs, Stage, greyArt, pop, tileArt, useStageFit } from "./EntryParts.jsx";

// The app's entry (/app/start) for new visitors: what worries them, their
// goals, what brought them here, then up to three guesses at figures Candid
// goes on to work out (src/lib/guesses.js). Nothing is saved until the end:
// `onEntered` records the entry, then `onDone(moduleKey)` opens the module,
// after a moment naming it. Back and forward by swiping, to pages reached.

const WORRIES = ["Saving enough", "Retirement", "Debt", "Tax", "Buying a home", "Rising costs", "Kids", "My pension", "Where I stand"];
const RETIRE = { bg: "#FCE5D3", ink: "#8f5226" };
const CREAM = "#faf7f0", MUTED_BG = "#EEEDE9", MUTED_INK = "#5e5e5e", G = "#162f24";
const GOAL_TILES = [
  { label: "Buy a home", art: tileArt("property"), grey: greyArt("property"), look: LOOK.property },
  { label: "Retire early", art: tileArt("retirement"), grey: greyArt("retirement"), look: RETIRE },
  { label: "Safety net", art: "/onboarding/goal-safety.svg", grey: "/onboarding/grey-safety.svg", look: LOOK.cash },
  { label: "Clear my loan", art: tileArt("student-loan"), grey: greyArt("student-loan"), look: LOOK.studentLoan },
  { label: "See the world", art: "/onboarding/goal-travel.svg", grey: "/onboarding/grey-travel.svg", look: LOOK.pension },
  { label: "Get married", art: "/onboarding/goal-rings.svg", grey: "/onboarding/grey-rings.svg", look: LOOK.property },
  { label: "Start a family", art: tileArt("kids-family"), grey: greyArt("kids-family"), look: LOOK.kids },
  { label: "Grow my money", art: tileArt("investments"), grey: greyArt("investments"), look: LOOK.investments },
];
const BAND_GRADIENT = "linear-gradient(160deg,#D9EADF 0%,#E9EEDB 50%,#F5E6C8 100%)";
const FIRST_LINE_GOALS = "So, it looks like you know where you want to get to with your money. That's great.";
const FIRST_LINE_NOSY = "So, you're just having a nose around. Fair enough.";
const SECOND_LINE = ["To keep you on your toes, let's see how much you ", "*ACTUALLY", " know about what your money is ", "*REALLY", " up to."];

const TYPE_START_MS = 350, TYPE_MS = 24, TYPE_PAUSE_MS = 170, INTRO_HOLD_MS = 2500, BAND_HOLD_MS = 640;
const HANDOFF_MS = 1400, HANDOFF_STILL_MS = 900;
const SWIPE_START = 10, SWIPE_MIN = 50, CARD_SWIPE_MIN = 24;

function Back({ onClick }) {
  return <button type="button" className="back" onClick={onClick} aria-label="Back"><ChevronLeft size={20} strokeWidth={2.4} color={G}/></button>;
}

function Tile({ label, art, grey, look, on, onTap }) {
  return (
    <button type="button" className={`tile nudge${on ? " on" : ""}`} aria-pressed={on} style={{ background: on ? look.bg : MUTED_BG, color: on ? look.ink : MUTED_INK }}
      onClick={e => { pop(e.currentTarget); onTap(); }}>
      <span className="pic"><img src={grey} alt=""/><img className="tint" src={art} alt=""/></span>
      <span>{label}</span>
    </button>
  );
}

// The words appear a letter at a time. A tap shows them all; a second moves
// on; otherwise it fades into the first question by itself.
function Intro({ hasGoals, onBack, onLeave }) {
  const box = useRef(null);
  const still = useReducedMotion();
  const tapped = useRef(() => {});
  useEffect(() => {
    const chars = [...box.current.querySelectorAll("i")];
    let n = 0, finished = false, timer = 0;
    const show = c => { c.classList.add("on"); if (c.parentElement.tagName === "B") c.parentElement.classList.add("on"); };
    const finish = () => { if (finished) return; finished = true; clearTimeout(timer); chars.forEach(show); timer = setTimeout(onLeave, INTRO_HOLD_MS); };
    const step = () => {
      if (n >= chars.length) return finish();
      const c = chars[n++];
      show(c);
      timer = setTimeout(step, /[.,]/.test(c.textContent) ? TYPE_PAUSE_MS : TYPE_MS);
    };
    tapped.current = () => { if (finished) { clearTimeout(timer); onLeave(); } else finish(); };
    if (still) finish(); else timer = setTimeout(step, TYPE_START_MS);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const typed = text => [...text].map((c, i) => <i key={i}>{c}</i>);
  const first = hasGoals ? FIRST_LINE_GOALS : FIRST_LINE_NOSY;
  const said = `${first} ${SECOND_LINE.join("").replace(/\*/g, "")}`;
  return (
    <div className="pad" onClick={e => { if (!e.target.closest("button")) tapped.current(); }}>
      <Segs at={4} rest="rgba(22,47,36,.12)"/>
      <Back onClick={onBack}/>
      <div className="grow"/>
      <div className="tw" ref={box} role="status" aria-label={said}>
        <span aria-hidden="true">{typed(first)}</span>
        <div style={{ height: 22 }}/>
        <span aria-hidden="true">{SECOND_LINE.map((part, i) => part.startsWith("*") ? <b key={i}>{typed(part.slice(1))}</b> : <span key={i}>{typed(part)}</span>)}</span>
      </div>
      <div className="grow" style={{ flexGrow: 1.4 }}/>
    </div>
  );
}

function GuessScreen({ q, number, onBack, onBand, onSkip }) {
  const look = LOOK[q.module];
  const [picked, setPicked] = useState(null);
  const [w, h] = HERO_SIZE[look.hero];
  const parts = q.ask.split("tax-free");
  return (
    <>
      <div style={{ position: "relative", padding: "22px 22px 0", display: "flex", flexDirection: "column", flexGrow: 1, minHeight: 0 }}>
        <Monogram keys={[q.module]}/>
        <div className="above grow">
          <Segs at={4} ink={look.ink} rest="rgba(255,255,255,.75)"/>
          <div className="qrow">
            <Back onClick={onBack}/>
            <span className="qno" style={{ color: look.ink }}>Q{number}</span>
          </div>
          <div className="enter" style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <h1 style={{ fontSize: 42, lineHeight: 1.04 }}>{parts.length > 1 ? <>{parts[0]}<span style={{ whiteSpace: "nowrap" }}>tax-free</span>{parts[1]}</> : q.ask}</h1>
          </div>
          <div className="hero"><img src={`/onboarding/hero-${look.hero}.svg`} alt="" style={{ width: w, height: h }}/></div>
        </div>
      </div>
      <div style={{ background: look.ink, padding: "20px 22px 22px", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div className="bands">
          {q.bands.map((b, x) => (
            <button key={b.label} type="button" disabled={picked !== null} aria-pressed={picked === x}
              className={`band nudge${picked === null ? " rise" : picked === x ? " on pop" : " sink"}`}
              style={{ color: look.ink, animationDelay: picked === null ? `${0.08 + x * 0.07}s` : "0s", cursor: "pointer" }}
              onClick={() => { setPicked(x); onBand(b.label); }}>{b.label}</button>
          ))}
        </div>
        <div style={{ height: 6 }}/>
        <div style={{ display: "flex" }}>
          <button type="button" className="link" style={{ color: "#fff" }} disabled={picked !== null} onClick={onSkip}>No idea</button>
          {q.na && <button type="button" className="link" style={{ color: "#fff" }} disabled={picked !== null} onClick={onSkip}>Doesn't apply</button>}
        </div>
      </div>
    </>
  );
}

export default function EntryFlow({ set, onEntered, onDone, onExit }) {
  const fit = useStageFit();
  const still = useReducedMotion();
  const [worries, setWorries] = useState([]);
  const [goals, setGoals] = useState([]);
  const [other, setOther] = useState(false);
  const [nosy, setNosy] = useState(false);
  const [mods, setMods] = useState([]);
  const [exploring, setExploring] = useState(false);
  const [answers, setAnswers] = useState({});
  // Also held here: the last answer moves straight on to saving, ahead of a render.
  const latestAnswers = useRef({});
  const answer = (id, label) => {
    const next = { ...latestAnswers.current };
    if (label) next[id] = label; else delete next[id];
    latestAnswers.current = next;
    setAnswers(next);
  };
  const [introSeen, setIntroSeen] = useState(false);
  const [card, setCard] = useState(0);
  const [nav, setNav] = useState({ stack: [{ n: "worries" }], ahead: [], dir: 0 });
  const [opening, setOpening] = useState(null);

  const picks = GUESS_ORDER.filter(k => mods.includes(k));
  const questions = guessQuestions(picks);
  const here = nav.stack[nav.stack.length - 1];
  const hereKey = `${here.n}${here.i ?? ""}`;

  // The swipe handlers and timers read the latest of these.
  const live = useRef(null);
  live.current = { nav, here, hereKey, card, picks, questions, opening };
  const dragged = useRef(null);
  const swallow = useRef(false);

  const go = (n, i) => setNav(v => {
    const top = v.ahead[v.ahead.length - 1];
    return { stack: [...v.stack, { n, i }], ahead: top && top.n === n && top.i === i ? v.ahead.slice(0, -1) : [], dir: 1 };
  });
  const back = () => setNav(v => v.stack.length > 1 ? { stack: v.stack.slice(0, -1), ahead: [...v.ahead, v.stack[v.stack.length - 1]], dir: -1 } : v);
  const forward = () => setNav(v => v.ahead.length ? { stack: [...v.stack, v.ahead[v.ahead.length - 1]], ahead: v.ahead.slice(0, -1), dir: 1 } : v);

  // The comparison loads ahead of time, so it isn't blank when it's due.
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); import("./GuessCompare.jsx").catch(() => {}); }, []);
  useEffect(() => { posthog.capture("entry_step", { step: here.n, question: here.i ?? null }); }, [hereKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Saved in one go, then the hand-off once it has landed in `d`.
  const finish = key => {
    if (live.current.opening) return;
    const patch = entryPatch({ worries, goals, other, nosy, picks, exploring, answers: latestAnswers.current });
    Object.entries(patch).forEach(([k, v]) => set(k, v));
    setOpening({ key });
  };
  useEffect(() => {
    if (!opening) return;
    onEntered();
    const t = setTimeout(() => onDone(opening.key), still ? HANDOFF_STILL_MS : HANDOFF_MS);
    return () => clearTimeout(t);
  }, [opening]); // eslint-disable-line react-hooks/exhaustive-deps

  const afterGuesses = () => {
    if (picks.length > 1) go("first");
    else finish(picks[0]);
  };
  const afterMods = () => {
    if (!questions.length) return finish(undefined);
    if (introSeen) go("guess", 0); else go("intro");
  };
  const nextGuess = i => { if (i + 1 < questions.length) go("guess", i + 1); else afterGuesses(); };
  const leaveIntro = () => {
    if (live.current.here.n !== "intro") return;
    setIntroSeen(true);
    setNav(v => ({ stack: [...v.stack.slice(0, -1), { n: "guess", i: 0 }], ahead: [], dir: "fade" }));
  };

  // Swipes: back on every page, forward to pages reached. The first-module
  // cards keep their own swipes until they reach an end.
  useEffect(() => {
    let sw = null;
    const down = e => {
      if (live.current.opening) return;
      if (!e.target.closest?.(".ce")) return;
      sw = { x: e.clientX, y: e.clientY, moved: false, inCards: !!e.target.closest(".cards") };
    };
    const cardsTake = (s, dx) => {
      const { card: c, picks: p } = live.current;
      return s.inCards && ((dx < 0 && c < p.length - 1) || (dx > 0 && c > 0));
    };
    const move = e => {
      if (!sw) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
      if (!sw.moved && Math.abs(dx) > SWIPE_START && Math.abs(dx) > Math.abs(dy)) sw.moved = true;
      if (!sw.moved || cardsTake(sw, dx) || !dragged.current) return;
      const { nav: v } = live.current;
      const can = dx > 0 ? v.stack.length > 1 : v.ahead.length > 0;
      dragged.current.style.transition = "none";
      dragged.current.style.transform = `translateX(${dx * (can ? 0.6 : 0.14)}px)`;
    };
    const up = e => {
      if (!sw) return;
      const s = sw; sw = null;
      if (!s.moved) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      swallow.current = true;
      setTimeout(() => { swallow.current = false; }, 350);
      if (cardsTake(s, dx)) {
        if (Math.abs(dx) > CARD_SWIPE_MIN) setCard(c => c + (dx < 0 ? 1 : -1));
        return;
      }
      const { nav: v } = live.current;
      const far = Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.3;
      if (far && dx > 0 && v.stack.length > 1) return back();
      if (far && dx < 0 && v.ahead.length) return forward();
      if (dragged.current) { dragged.current.style.transition = "transform .25s ease"; dragged.current.style.transform = ""; }
    };
    // Taken over by the system: not a swipe, so it only puts the page back.
    const cancel = () => {
      sw = null;
      if (dragged.current) { dragged.current.style.transition = "transform .25s ease"; dragged.current.style.transform = ""; }
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, []);

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  const screens = {
    worries: () => ({
      bg: RETIRE.bg,
      body: (
        <div className="pad">
          <Segs at={1} ink={RETIRE.ink} rest="rgba(255,255,255,.75)"/>
          <Back onClick={onExit}/>
          <h1 style={{ fontSize: 40 }}>Money is daunting, what worries you?</h1>
          <div style={{ height: 26, flexShrink: 0 }}/>
          <div className="chips">
            {WORRIES.map(w => {
              const on = worries.includes(w);
              const Icon = on ? Check : Plus;
              return (
                <button key={w} type="button" className={`chip nudge${on ? " on" : ""}`} aria-pressed={on} onClick={e => { pop(e.currentTarget); toggle(worries, setWorries, w); }}>
                  <Icon size={16} strokeWidth={2.4} color={G} aria-hidden="true"/><span>{w}</span>
                </button>
              );
            })}
          </div>
          <div className="grow"/>
          {/* Arrived on a friend's invite link (src/lib/referral.js). */}
          {invitedHere() && <p className="invited">A friend invited you: your second module is unlocked for free.</p>}
          <button type="button" className="cta" onClick={() => go("goals")}>Continue →</button>
          {/* Back on a new device: their account brings their answers. */}
          {!signedIn() && <p className="signin">Already have an account? <a href="/app/signin" onClick={() => posthog.capture("entry_sign_in_clicked")}>Sign in</a></p>}
        </div>
      ),
    }),
    goals: () => ({
      bg: CREAM,
      body: (
        <div className="pad" style={{ paddingBottom: 20 }}>
          <Segs at={2}/>
          <Back onClick={back}/>
          <h1 style={{ fontSize: 34 }}>What are your money goals?</h1>
          <div style={{ height: 14, flexShrink: 0 }}/>
          <div className="tiles small">
            {GOAL_TILES.map(t => <Tile key={t.label} {...t} on={goals.includes(t.label)} onTap={() => { toggle(goals, setGoals, t.label); setNosy(false); }}/>)}
          </div>
          <div className="extras">
            <button type="button" className={`xpill nudge${other ? " on" : ""}`} aria-pressed={other} onClick={e => { pop(e.currentTarget); setOther(!other); setNosy(false); }}>Other</button>
            <button type="button" className={`xpill nudge${nosy ? " on" : ""}`} aria-pressed={nosy} onClick={e => { pop(e.currentTarget); if (!nosy) { setOther(false); setGoals([]); } setNosy(!nosy); }}>None, just nosying around</button>
          </div>
          <div className="grow"/>
          <button type="button" className="cta" onClick={() => go("mods")}>Continue →</button>
        </div>
      ),
    }),
    mods: () => ({
      bg: CREAM,
      body: (
        <div className="pad" style={{ paddingBottom: 20 }}>
          <Segs at={3}/>
          <Back onClick={back}/>
          <h1 style={{ fontSize: 32 }}>What brought you to Candid?</h1>
          <div style={{ height: 12, flexShrink: 0 }}/>
          <div className="tiles">
            {GUESS_ORDER.map(k => (
              <Tile key={k} label={LOOK[k].name} art={tileArt(LOOK[k].file)} grey={greyArt(LOOK[k].file)} look={LOOK[k]} on={mods.includes(k)}
                onTap={() => { toggle(mods, setMods, k); setExploring(false); setCard(0); setNav(v => ({ ...v, ahead: [] })); }}/>
            ))}
            <Tile label="Just exploring" art={tileArt("retirement")} grey={greyArt("retirement")} look={RETIRE} on={exploring}
              onTap={() => { setExploring(!exploring); setMods([]); setCard(0); setNav(v => ({ ...v, ahead: [] })); }}/>
          </div>
          <div className="grow"/>
          <div style={{ height: 8, flexShrink: 0 }}/>
          <button type="button" className="cta" disabled={!mods.length && !exploring} onClick={afterMods}>Continue →</button>
        </div>
      ),
    }),
    intro: () => ({
      bg: BAND_GRADIENT,
      body: <Intro hasGoals={goals.length > 0 || other} onBack={back} onLeave={leaveIntro}/>,
    }),
    guess: () => {
      const q = questions[here.i];
      if (!q) return { bg: CREAM, body: null };
      return {
        bg: LOOK[q.module].bg,
        body: (
          <GuessScreen q={q} number={here.i + 1} onBack={back}
            onBand={label => {
              const at = live.current.hereKey;
              answer(q.id, label);
              posthog.capture("guess_answered", { module: q.module, question: q.id });
              setTimeout(() => { if (live.current.hereKey === at) nextGuess(here.i); }, BAND_HOLD_MS);
            }}
            onSkip={() => {
              answer(q.id, null);
              nextGuess(here.i);
            }}/>
        ),
      };
    },
    first: () => {
      const cardW = fit.w - 88, at = Math.min(card, picks.length - 1), look = LOOK[picks[at]];
      return {
        bg: CREAM,
        body: (
          <>
            <Monogram keys={picks}/>
            <div className="above" style={{ padding: "22px 22px 0", flexShrink: 0 }}>
              <Segs at={4}/>
              <Back onClick={back}/>
              <h1 style={{ fontSize: 38 }}>Where shall we begin?</h1>
            </div>
            <div style={{ height: 18, flexShrink: 0 }}/>
            <div className="deal grow cards" style={{ position: "relative" }}>
              <div className="track" style={{ transform: `translateX(${44 - at * (cardW + 14)}px)` }}>
                {picks.map((k, x) => {
                  const g = moduleGuess(k, answers);
                  return (
                    <button key={k} type="button" className="mcard" aria-pressed={x === at} style={{ width: cardW, transform: `scale(${x === at ? 1 : 0.92})`, opacity: x === at ? 1 : 0.75 }}
                      onClick={() => setCard(x)}>
                      <img src={tileArt(LOOK[k].file)} alt="" draggable="false"/>
                      <span className="mname">{LOOK[k].short}</span>
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: LOOK[k].ink }}>{g ? `You guessed ${g}` : "No guess yet"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="above" style={{ padding: "16px 22px 24px", flexShrink: 0 }}>
              <div className="pdots">{picks.map((k, x) => <i key={k} style={{ width: x === at ? 22 : 7, background: x === at ? look.ink : "rgba(22,47,36,.22)" }}/>)}</div>
              <button type="button" className="cta" onClick={() => finish(picks[at])}>Open {look.short} →</button>
            </div>
          </>
        ),
      };
    },
  };

  const openKey = opening && (opening.key || "cash");
  const view = opening
    ? {
        bg: CREAM,
        body: (
          <div className="pad" style={{ alignItems: "center", justifyContent: "center", textAlign: "center", gap: 14 }}>
            <div role="status" style={{ display: "contents" }}>
              <img src={tileArt(LOOK[openKey].file)} alt="" style={{ width: 150, height: "auto" }}/>
              <div style={{ fontSize: 14, color: MUTED_INK, fontWeight: 600 }}>Opening</div>
              <div className="mname" style={{ marginTop: -8 }}>{LOOK[openKey].short}</div>
            </div>
          </div>
        ),
      }
    : screens[here.n]();
  const key = opening ? "opening" : hereKey;
  const dir = opening ? 1 : nav.dir;
  const fade = dir === "fade";
  const slide = still || fade ? 0 : dir < 0 ? -26 : dir > 0 ? 26 : 0;

  return (
    <Stage fit={fit} onDragStart={e => e.preventDefault()}
      onClickCapture={e => { if (swallow.current) { e.stopPropagation(); e.preventDefault(); } }}>
      <AnimatePresence initial={false}>
        <motion.div key={key} className="scr" style={{ background: view.bg }}
          initial={{ opacity: still ? 1 : 0, x: slide }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: still ? 0 : fade ? 0.6 : 0.3, ease: "easeOut" }}
          exit={{ opacity: 0.999, transition: { duration: still ? 0 : fade ? 0.64 : 0.32 } }}>
          <div className="drag" ref={el => { if (el) dragged.current = el; }}>{view.body}</div>
        </motion.div>
      </AnimatePresence>
    </Stage>
  );
}
