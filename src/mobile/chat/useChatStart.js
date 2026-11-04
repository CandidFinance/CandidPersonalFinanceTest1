import { useCallback, useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { entryGoals } from "../../lib/appEntry.js";
import { computeModuleStatuses } from "../../lib/moduleStatus.js";
import { isLocked } from "../../lib/unlock.js";
import { matchTopic } from "../../lib/chatTopics.js";
import {
  CHAT_QUICK, CHAT_AREAS, CHAT_EXACT, titleOf, listOf, areasPicked, picksParts, moduleIntro, nextQuestion, questionParts,
  answerLabel, resultParts, nextReplies, askReplies, elseReplies, parseFigure, periodOf, tileFor, bandFor, chatPatch, lastWord, pickReplies,
} from "../../lib/chatStart.js";

// The Chat tab's way in (chatStart.js): the areas to pick, which first, a
// module's questions one reply at a time, its answer, and what's next. It
// talks through useQAChat's `say` and `setReplies`, so its messages build
// and pace like every other answer.
//
// A module's last answer writes its figures (the quick start's patch) and
// marks it answered (answerModule, as its own walk-through does); the
// answer is shown once both have landed in `d`, so it's worked out from
// them.
export function useChatStart({ d, m, marketRates, set, answerModule, say, setReplies, voice }) {
  // The latest of everything, for callbacks made once: answerModule closes
  // over the app's `d` of the render it came from.
  const live = useRef(null);
  live.current = { d, m, set, answerModule };
  // The module being asked: { key, a (answers so far), exact (figures
  // typed, by question), since (answers since a figure was last typed or
  // the reminder given), banded (of those, ones that took a figure and got
  // a band), qid }.
  const [run, setRun] = useState(null);
  const [landing, setLanding] = useState(null); // { key, stamp }

  const statusesOf = (dd, mm) => computeModuleStatuses(dd, mm, marketRates);
  const lockedIn = dd => key => isLocked(dd, key);

  // Into a module: its intro and first question, or the button into its
  // own walk-through. Parts only; the caller says them.
  const enter = useCallback(key => {
    const { d: dd, m: mm } = live.current;
    const setup = CHAT_QUICK[key];
    const parts = moduleIntro(dd, mm, key, voice);
    if (!setup) { setRun(null); return { parts, replies: nextReplies(dd, key) }; }
    const qid = nextQuestion(setup, dd, mm, {});
    if (!qid) { finish(key, {}, {}); return { parts, replies: null }; }
    posthog.capture("questions_started", { flow: "chat", module: key, question: qid });
    setRun({ key, a: {}, exact: {}, since: 0, banded: 0, qid });
    return { parts, replies: { kind: "question" } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (key, a, exact) => {
    const { d: dd, m: mm, set: write, answerModule: answered } = live.current;
    const stamp = Date.now();
    // Nothing asked (every answer in already): its estimates stay as they are.
    const answers = Object.keys(a).length ? chatPatch(CHAT_QUICK[key], dd, mm, a, exact) : {};
    const patch = { ...answers, quickAt: { ...(dd.quickAt || {}), [key]: stamp } };
    Object.entries(patch).forEach(([k, v]) => write(k, v));
    answered(key, Object.keys(a).pop() ?? null);
    setRun(null);
    setReplies(null);
    setLanding({ key, stamp });
  };

  // Once the figures are in: the answer, worked out from them.
  useEffect(() => {
    if (!landing || d.quickAt?.[landing.key] !== landing.stamp || !(d.selectedModules || []).includes(landing.key)) return;
    setLanding(null);
    say(null, resultParts(d, m, statusesOf(d, m), landing.key, lockedIn(d), voice), { think: true });
    setReplies(nextReplies(d, landing.key));
  }, [landing, d, m]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickAreas = useCallback(values => {
    const { d: dd, set: write } = live.current;
    const { interests, modules } = areasPicked(values);
    posthog.capture("chat_areas_picked", { areas: values });
    write("interests", interests);
    if (!(dd.financialGoals || []).length) write("financialGoals", entryGoals(interests));
    const label = listOf(values.map(v => CHAT_AREAS.find(c => c.value === v)?.label || v));
    if (!modules.length) {
      say(label, [{ text: "Then ask me anything below, or try one of these." }]);
      setReplies(askReplies(dd));
      return;
    }
    const lines = picksParts(dd, modules, voice);
    if (modules.length > 1) {
      say(label, lines);
      setReplies(pickReplies(modules));
      return;
    }
    const into = enter(modules[0]);
    say(label, [...lines, { divider: titleOf(modules[0]) }, ...into.parts]);
    setReplies(into.replies);
  }, [enter, say, setReplies]);

  // A reply that belongs to this layer: "go:<module>", "else" or "ask".
  // Returns false for anything else (a Q&A topic).
  const route = useCallback((label, id) => {
    const { d: dd } = live.current;
    if (id.startsWith("go:")) {
      const key = id.slice(3);
      posthog.capture("chat_module_picked", { module: key });
      const into = enter(key);
      // A new module starts a new section; what came before fades back.
      say(label, into.parts, { divider: titleOf(key) });
      setReplies(into.replies);
      return true;
    }
    if (id === "else") {
      say(label, [{ text: "Which would you like to look at?" }]);
      setReplies(elseReplies(dd));
      return true;
    }
    if (id === "ask") {
      setRun(null);
      say(label, [{ text: "Ask me anything below, or try one of these." }]);
      setReplies(askReplies(dd));
      return true;
    }
    return false;
  }, [enter, say, setReplies]);

  // An answer to the module question on screen: a tile's value, or a
  // figure typed in the message box (`typed`: its band, the figure and
  // the words as typed).
  const answer = useCallback((value, typed = null) => {
    if (!run) return;
    const { d: dd, m: mm } = live.current;
    const setup = CHAT_QUICK[run.key];
    const q = setup.questions[run.qid];
    const label = typed ? typed.text : answerLabel(q, { d: dd, m: mm, a: run.a, direct: true }, value);
    const a = { ...run.a, [run.qid]: value };
    const exact = typed ? { ...run.exact, [run.qid]: typed.n } : run.exact;
    let since = typed ? 0 : run.since + 1;
    let banded = typed ? 0 : run.banded + (CHAT_EXACT[run.qid] ? 1 : 0);
    // Never the figure itself.
    posthog.capture("question_answered", { flow: "chat", module: run.key, question: run.qid, typed: !!typed });
    const next = nextQuestion(setup, dd, mm, a, run.qid);
    if (!next) { say(label, [{ text: lastWord(run.qid, value, voice) }], { think: false }); finish(run.key, a, exact); return; }
    // Two answers or more without a typed figure, one of them a band where
    // a figure could have been typed, and another such question next: a
    // reminder that real figures can go in the chat.
    const nudge = !!CHAT_EXACT[next] && banded >= 1 && since >= 2;
    if (nudge) since = banded = 0;
    say(label, questionParts(setup, next, dd, mm, a, { prev: run.qid, voice, nudge }), { think: false });
    setRun({ ...run, a, exact, since, banded, qid: next });
  }, [run, say]); // eslint-disable-line react-hooks/exhaustive-deps

  // Words typed while a module question is on screen: a tile's words
  // ("yes") answer it; so does a figure, where it takes one (too small, or
  // a month where it's a year, and Candid asks again). A question ("…?", or
  // words the Q&A knows) goes to the Q&A (false). Anything else, Candid asks again rather than
  // dropping the answers so far.
  const typed = useCallback(text => {
    if (!run) return false;
    const { d: dd, m: mm } = live.current;
    const q = CHAT_QUICK[run.key].questions[run.qid];
    const ctx = { d: dd, m: mm, a: run.a, direct: true };
    const tile = tileFor(q, ctx, text);
    if (tile) { answer(tile); return true; }
    const spec = CHAT_EXACT[run.qid];
    const n = spec ? parseFigure(text) : null;
    const again = line => { say(text, [{ text: line }], { think: false }); return true; };
    if (n == null) {
      if (/\?\s*$/.test(text) || matchTopic(text) !== "fallback") return false;
      return again(spec ? `I didn't catch a figure there. Type it like ${spec.example}, or tap the closest band.` : "Sorry, I didn't catch that. Tap whichever fits best.");
    }
    const per = periodOf(text);
    if (spec.per && per && per !== spec.per) return again(`I'm after the ${spec.per === "year" ? "yearly" : "monthly"} figure for your ${spec.noun}. Type it like ${spec.example}, or tap the closest band.`);
    if (n < spec.min) return again(`That looks low for your ${spec.noun}. Type it in full, like ${spec.example}, or tap the closest band.`);
    answer(bandFor(q, ctx, n), { n, text });
    return true;
  }, [run, say, answer]);

  // A typed question mid-way leaves the module's questions.
  const leave = useCallback(() => setRun(null), []);

  // What the message box suggests while a question takes a figure.
  const hint = run && CHAT_EXACT[run.qid] ? `Type your exact ${CHAT_EXACT[run.qid].noun}` : null;

  return { run, pickAreas, route, answer, typed, hint, leave };
}
