import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import posthog from "posthog-js";
import { guessMoney } from "../../../lib/guesses.js";
import { LOOK, Stage, useStageFit } from "./EntryParts.jsx";

// A guess from the entry beside the figure Candid has just worked out: the
// guess first, then the figure counts up. `items` from pendingComparisons
// (src/lib/guesses.js), one screen each. `estimated`: the figure rests on the
// quick start's bands, so it's labelled "about". Then `onDone` and the
// module's answer.

const G = "#162f24", RED = "#b3261e", WORSE_FLUSH = "#FBE3DD";
const HOLD_MS = 900, COUNT_MS = 1500;
const CONFETTI = ["#c4963a", "#1f5f44", "#c4963a", "#4f3aa8", "#1d4c96", "#9a3a24"];
const COIN_LEFT = [6, 64, 32, 78, 15, 50, 70, 24];

// Each piece of confetti flies its own way, so each has its own keyframes.
const BURST_CSS = (() => {
  const css = [];
  for (let i = 0; i < 26; i++) {
    const a = (-165 + i * 6) * Math.PI / 180, r = 120 + ((i * 37) % 120), x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r), rot = (i % 2 ? 1 : -1) * (240 + i * 14);
    css.push(`.ce .c${i}{animation:ce-c${i} ${(1.5 + (i % 5) * 0.12).toFixed(2)}s cubic-bezier(.15,.7,.4,1) ${((i % 4) * 0.03).toFixed(2)}s both}@keyframes ce-c${i}{0%{opacity:1;transform:translate(0,0) scale(.5)}35%{opacity:1;transform:translate(${x}px,${y}px) rotate(${Math.round(rot / 2)}deg)}100%{opacity:0;transform:translate(${Math.round(x * 1.15)}px,${y + 210}px) rotate(${rot}deg)}}`);
  }
  COIN_LEFT.forEach((_, i) => css.push(`.ce .k${i}{animation:ce-coin${i % 2} 1.15s cubic-bezier(.5,0,.9,.6) ${(i * 0.11).toFixed(2)}s both}`));
  return `@media (prefers-reduced-motion:no-preference){${css.join("")}}`;
})();

function Comparison({ item, look, estimated, cta, onNext }) {
  const still = useReducedMotion();
  const [landed, setLanded] = useState(false);
  const fig = useRef(null), bar = useRef(null);
  const { value, bars, tone } = item;
  const colour = tone === "worse" ? RED : tone === "better" ? look.ink : G;

  useEffect(() => {
    let raf = 0;
    const land = () => { setLanded(true); posthog.capture("guess_compared", { question: item.id, tone }); };
    if (still) { land(); return undefined; }
    const hold = setTimeout(() => {
      const t0 = performance.now();
      const tick = now => {
        const t = Math.min(1, (now - t0) / COUNT_MS), p = 1 - Math.pow(1 - t, 3);
        if (t >= 1) return land();
        if (fig.current) fig.current.textContent = guessMoney(value * p, value);
        if (bar.current) bar.current.style.height = `${bars.figure * p}px`;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, HOLD_MS);
    return () => { clearTimeout(hold); cancelAnimationFrame(raf); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bg = landed && tone === "worse" ? WORSE_FLUSH : landed && tone === "better" ? look.flush : look.bg;
  return (
    <div className="scr" style={{ background: bg, transition: "background .4s ease" }}>
      <div className={`pad${landed && tone === "worse" && !still ? " shake" : ""}`}>
        <div style={{ height: 18, flexShrink: 0 }}/>
        <span className="pill" style={{ color: look.ink }}>{look.name}</span>
        {/* Asked a while ago, so it's said again: all this screen's figures answer it. */}
        <p style={{ margin: "12px 0 10px", fontSize: 16, lineHeight: 1.35, fontWeight: 600, color: "#3d4a43", flexShrink: 0 }}>{item.ask}</p>
        <h1 aria-live="polite" key={landed ? "after" : "before"} className={landed ? "headIn" : undefined} style={{ fontSize: 34, minHeight: 74 }}>
          {landed ? item.head : `You guessed ${item.band}.`}
        </h1>
        <div className="grow"/>
        <div className="cols" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
          <div className="col">
            <div className="gfig">{item.band}</div>
            <div className="bar" style={{ height: bars.guess, background: "rgba(22,47,36,.2)" }}/>
            <div className="cap">You guessed</div>
          </div>
          <div className="col">
            {landed && tone === "worse" && !still && <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{COIN_LEFT.map((l, i) => <span key={i} className={`coin k${i}`} style={{ left: `${l}%` }}>£</span>)}</div>}
            {landed && tone === "better" && !still && (
              <div aria-hidden="true" style={{ position: "absolute", left: "50%", bottom: bars.figure + 60, width: 0, height: 0, pointerEvents: "none" }}>
                {Array.from({ length: 26 }, (_, i) => <span key={i} className={`conf c${i}`} style={{ left: 0, top: 0, width: i % 3 ? 8 : 6, height: i % 3 ? 12 : 6, borderRadius: i % 3 ? 2 : 6, background: CONFETTI[i % 6] }}/>)}
              </div>
            )}
            {estimated && <div className="about">about</div>}
            <div ref={fig} className={`afig${landed && !still ? (tone === "worse" ? " thud" : tone === "better" ? " cheer" : "") : ""}`} style={{ color: colour }}>{guessMoney(landed ? value : 0, value)}</div>
            <div ref={bar} className="bar" style={{ height: landed ? bars.figure : 0, background: colour }}/>
            <div className="cap">Your figure</div>
          </div>
        </div>
        <div style={{ height: 16, flexShrink: 0 }}/>
        <button type="button" className="cta" onClick={onNext}>{cta}</button>
      </div>
    </div>
  );
}

export default function GuessCompare({ moduleKey, items, estimated, onDone }) {
  const fit = useStageFit();
  const [i, setI] = useState(0);
  const last = i === items.length - 1;
  return (
    <Stage fit={fit}>
      <style>{BURST_CSS}</style>
      <Comparison key={items[i].id} item={items[i]} look={LOOK[moduleKey]} estimated={estimated}
        cta={last ? "See how it's worked out →" : "Next →"}
        onNext={() => { if (last) onDone(); else setI(i + 1); }}/>
    </Stage>
  );
}
