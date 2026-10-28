import { useState, useRef, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronUp, ChevronDown, TriangleAlert, Check } from "lucide-react";
import { G, MUT, SERIF, SANS, WHITE, CRITICAL, WARNING, SUCCESS, PROGRESS_GREEN, HERO_TILE_BG, HERO_TILE_BG_RED, HERO_TILE_BG_AMBER, HERO_TILE_BG_GREEN, OPPORTUNITY_TILE_BG, OPPORTUNITY_TILE_BORDER, OPPORTUNITY_TILE_SHADOW, OPPORTUNITY_TILE_LABEL, OPPORTUNITY_TILE_FIGURE, OPPORTUNITY_TILE_BODY, OPPORTUNITY_TILE_RADIUS, OPPORTUNITY_TILE_SHEEN } from "../design-tokens.js";

// Cards stacked one in front of another, like a wallet: Home's hero
// (HomeHero.jsx) and Progress's figures. The front card wears the
// Opportunity tiles' dark oil slick; the ones behind are light, each PEEK px
// higher than the one in front, with its top line (label and amount)
// showing, so nothing is hidden. Swiping up, the down arrow, or tapping a
// card behind turns the front card away on its Y axis and sends it back;
// the next card (or the one tapped) comes forward, and after the last the
// first comes round again. Swiping down or the up arrow goes back one.
// No wheel turning on desktop: it would catch the page's own scroll.
//
// Only the two cards behind the front one show their top line; any further
// back are slim edges (up to MAX_SLIVERS), so a long stack (Modules) stays
// the height of a short one, and the third place changes as you go through.
//
// Each card: { key, label, badge (a node after the label), amount,
// amountSans (the top line's amount is words, not a figure), warn ("red" or
// "amber": behind, the card wears that wash with a warning icon after its
// label), done (on track: a green wash behind, and a tick after the label,
// dark green behind and mid green in front), body: t => content in theme t }.
// `light`: every card plain white, the front one too (the £100k tax trap's
// other options, inside a tile of their own). `controls`: a node at the right
// end of the arrows' row (Modules' filter), the arrows staying centred.
const PEEK = 44;      // px of each card behind showing above the one in front
const SLIM = 7;       // px of each slim edge, past the second card behind
const MAX_SLIVERS = 3;
const TURN = 700;     // ms
const SHRINK = 0.045; // scale lost per place back
const SLIVER_SHRINK = 0.03;
// Where a card `slot` places back sits, and its scale.
const rise = (slot, peek) => slot <= 2 ? slot * peek : 2 * peek + Math.min(slot - 2, MAX_SLIVERS) * SLIM;
const scaleAt = slot => slot <= 2 ? 1 - slot * SHRINK : 1 - 2 * SHRINK - Math.min(slot - 2, MAX_SLIVERS) * SLIVER_SHRINK;
const CSS = `
.card-stack { --hero-fig: 52px; }
@media (min-width: 1000px) { .card-stack { --hero-fig: 72px; } }
.card-stack-card { position: relative; overflow: hidden; transition: border-color 0.35s ease, box-shadow 0.35s ease; }
.card-stack-card > :not(.card-stack-dark) { position: relative; z-index: 1; }
.card-stack-card * { transition: color 0.35s ease, border-color 0.35s ease, background-color 0.35s ease, stroke 0.35s ease; }
/* The dark fill is a layer that fades in and out (a gradient can't fade
   into another), so a card changes from light to dark smoothly. */
.card-stack-dark { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; background: ${OPPORTUNITY_TILE_BG}; transition: opacity 0.35s ease; }
.card-stack-dark::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 260%; pointer-events: none;
  background: linear-gradient(112deg, transparent 32%, rgba(255,255,255,${OPPORTUNITY_TILE_SHEEN}) 46%, transparent 60%);
  will-change: transform; animation: card-stack-sheen 7s ease-in-out infinite; }
.card-stack-dark:not(.on)::after { animation-play-state: paused; }
@keyframes card-stack-sheen { 0% { transform: translateX(-75%); } 55%, 100% { transform: translateX(25%); } }
@media (prefers-reduced-motion: reduce) { .card-stack-dark::after { animation: none; transform: translateX(-30%); } }
`;

// The colour schemes a card can wear: dark in front, light behind, or
// behind and warning, red or amber.
export const DARK = { bg: OPPORTUNITY_TILE_BG, border: OPPORTUNITY_TILE_BORDER, shadow: OPPORTUNITY_TILE_SHADOW, label: OPPORTUNITY_TILE_LABEL, figure: OPPORTUNITY_TILE_FIGURE, body: OPPORTUNITY_TILE_BODY, rule: "rgba(255,255,255,0.12)", track: "rgba(255,255,255,0.12)" };
export const LIGHT = { bg: HERO_TILE_BG, border: "1px solid rgba(22,47,36,0.10)", shadow: "0 4px 18px rgba(22,47,36,0.08)", label: MUT, figure: G, body: MUT, rule: "rgba(22,47,36,0.08)", track: "rgba(22,47,36,0.08)" };
const WARN = {
  red: { ...LIGHT, bg: HERO_TILE_BG_RED, border: "1px solid rgba(192,57,43,0.30)", shadow: "0 4px 18px rgba(192,57,43,0.12)", label: "#a8392c", figure: "#8e2a1f", body: "#8a5a52", icon: CRITICAL },
  amber: { ...LIGHT, bg: HERO_TILE_BG_AMBER, border: "1px solid rgba(217,130,43,0.38)", shadow: "0 4px 18px rgba(217,130,43,0.12)", label: "#a35a14", figure: "#864a0f", body: "#8a6a4f", icon: WARNING },
};
// A `light` stack's cards: plain white.
const PLAIN = { ...LIGHT, bg: WHITE };
const DONE = { ...LIGHT, bg: HERO_TILE_BG_GREEN, border: "1px solid rgba(47,148,97,0.45)", shadow: "0 4px 18px rgba(47,148,97,0.10)", figure: SUCCESS };

export default function CardStack({ cards, peek = PEEK, turnLabels = ["Show the previous card", "Show the next card"], light: allLight = false, controls = null }) {
  const reduceMotion = useReducedMotion();
  const n = cards.length;
  // `target`: the card heading to the front, set as a turn starts so the
  // card behind glides forward while the front one turns away. `front`: the
  // card drawn on top and in the dark fill, which changes partway through.
  const [front, setFront] = useState(0);
  const [target, setTarget] = useState(0);
  const [turning, setTurning] = useState(null);
  const startY = useRef(null);
  const swiped = useRef(false);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // To card `next` (by default the one after the front): the front card
  // turns away to its place behind `next`. A tap or swipe mid-turn cuts that
  // turn short: the card that was coming forward turns away instead, so
  // rapid taps run through the cards as fast as they come.
  const turn = (next = (target + 1) % n) => {
    if (next === target) return;
    timers.current.forEach(clearTimeout);
    const leaving = turning !== null ? target : front;
    setTarget(next);
    if (reduceMotion) { setFront(next); setTurning(null); return; }
    setFront(leaving);
    setTurning(leaving);
    timers.current = [setTimeout(() => setFront(next), TURN * 0.45), setTimeout(() => setTurning(null), TURN)];
  };
  const onPointerDown = e => { startY.current = e.clientY; swiped.current = false; };
  const onPointerUp = e => {
    if (startY.current === null) return;
    const dy = e.clientY - startY.current;
    startY.current = null;
    if (Math.abs(dy) > 28) { swiped.current = true; turn(dy < 0 ? (target + 1) % n : (target - 1 + n) % n); }
  };
  // A swipe that ends on a row or on a card behind isn't also a tap.
  const onClickCapture = e => {
    if (!swiped.current) return;
    swiped.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  const ease = [0.4, 0.1, 0.2, 1];
  const back = n - 1;
  return (
    <div className="card-stack">
      <style>{CSS}</style>
      {/* Every card shares one grid cell, so the stack is as tall as the
          tallest card; each one behind sits PEEK px higher. */}
      <div onPointerDown={onPointerDown} onPointerUp={onPointerUp} onClickCapture={onClickCapture}
        style={{display:"grid",paddingTop:`${rise(back, peek)}px`,perspective:"1100px",touchAction:"pan-x"}}>
        {cards.map((c, i) => {
          const isFront = i === front, isTarget = i === target;
          const slot = (i - target + n) % n;
          const edge = slot > 2; // a slim edge: no top line
          const light = WARN[c.warn] ?? (c.done ? DONE : allLight ? PLAIN : LIGHT);
          const t = isFront && !allLight ? DARK : light;
          const animate = turning === i
            ? { y: [0, 0, -rise(slot, peek)], scale: [1, 1, scaleAt(slot)], rotateY: [0, -80, 0], x: ["0%", "-12%", "0%"] }
            : { y: -rise(slot, peek), scale: scaleAt(slot), rotateY: 0, x: "0%" };
          return (
            <motion.div key={c.key} className="card-stack-card"
              initial={false} animate={animate}
              transition={turning === i ? { duration: TURN / 1000, times: [0, 0.45, 1], ease } : { duration: reduceMotion ? 0 : TURN * 0.8 / 1000, ease }}
              onClick={isTarget ? undefined : () => turn(i)} aria-hidden={!isTarget}
              style={{gridArea:"1 / 1",zIndex:isFront ? n + 1 : n - slot,transformOrigin:"50% 0",background:isFront && !allLight ? LIGHT.bg : light.bg,border:t.border,boxShadow:t.shadow,
                borderRadius:OPPORTUNITY_TILE_RADIUS,padding:"16px 20px 18px",cursor:isTarget ? "default" : "pointer",display:"flex",flexDirection:"column"}}>
              {!allLight && <div className={`card-stack-dark${isFront ? " on" : ""}`} aria-hidden="true" style={{opacity:isFront ? 1 : 0,transition:"opacity 0.385s ease"}}/>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:"10px",minHeight:"18px"}}>
                <span style={{display:"inline-flex",alignItems:"center",gap:"6px",fontSize:"11px",fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:t.label,opacity:edge ? 0 : 1,transition:"opacity 0.3s, color 0.35s"}}>
                  {c.label}
                  {c.done && (
                    <span role="img" aria-label="On track" style={{width:"15px",height:"15px",borderRadius:"50%",background:isFront ? PROGRESS_GREEN : G,color:WHITE,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <Check size={9} strokeWidth={3.5}/>
                    </span>
                  )}
                  {c.badge}
                  {/* Behind, a warning card's icon; in front, its body says it. */}
                  {c.warn && <TriangleAlert size={13} strokeWidth={2.4} color={WARN[c.warn].icon} aria-hidden="true" style={{opacity:isTarget ? 0 : 1,transition:"opacity 0.3s"}}/>}
                </span>
                {/* The top line's amount: only for a card behind, as the
                    front card shows it in full. */}
                <span style={{fontFamily:c.amountSans ? SANS : SERIF,fontSize:c.amountSans ? "13px" : "16px",fontWeight:700,color:t.figure,whiteSpace:"nowrap",opacity:isTarget || edge ? 0 : 1,transition:"opacity 0.3s, color 0.35s"}}>{c.amount}</span>
              </div>
              {/* Behind, only the top line shows: the body fades out so
                  nothing pokes into that line. It stays while a card turns
                  away, and fades in as one comes forward. */}
              {/* Hidden, it's also out of reach: no taps or tabbing onto rows
                  you can't see (visibility goes once the fade is done). */}
              <div style={{opacity:isTarget || isFront ? 1 : 0,visibility:isTarget || isFront ? "visible" : "hidden",
                transition:isTarget || isFront ? "opacity 0.3s" : "opacity 0.3s, visibility 0s linear 0.3s"}}>{c.body(t)}</div>
            </motion.div>
          );
        })}
      </div>
      <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center",gap:"12px",marginTop:"10px"}}>
        <button type="button" onClick={() => turn((target - 1 + n) % n)} aria-label={turnLabels[0]} style={arrow}><ChevronUp size={15} color={G}/></button>
        <div style={{display:"flex",gap:"6px"}} aria-hidden="true">
          {cards.map((c, i) => <span key={c.key} style={{width:"7px",height:"7px",borderRadius:"50%",background:i === target ? G : "rgba(22,47,36,0.2)",transform:i === target ? "scale(1.2)" : "none",transition:"background 0.2s, transform 0.2s"}}/>)}
        </div>
        <button type="button" onClick={() => turn()} aria-label={turnLabels[1]} style={arrow}><ChevronDown size={15} color={G}/></button>
        {controls && <div style={{position:"absolute",right:0,top:0}}>{controls}</div>}
      </div>
    </div>
  );
}

// One card on its own, in the stack's light colours: what a stack will hold
// before there's anything to fill it (Home before the score, Modules before
// a module is answered). Nothing to turn, so no arrows. `label`: its top
// line. `body`: t => content in theme t, as a stack's card.
export function StillCard({ label, body, ...rest }) {
  return (
    <div className="card-stack" {...rest}>
      <style>{CSS}</style>
      <div style={{background:LIGHT.bg,border:LIGHT.border,boxShadow:LIGHT.shadow,borderRadius:OPPORTUNITY_TILE_RADIUS,padding:"16px 20px 18px"}}>
        <div style={{fontSize:"11px",fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:LIGHT.label,minHeight:"18px"}}>{label}</div>
        {body(LIGHT)}
      </div>
    </div>
  );
}

export const arrow = { width:"30px", height:"30px", borderRadius:"50%", border:"1px solid rgba(22,47,36,0.15)", background:WHITE, display:"grid", placeItems:"center", cursor:"pointer", padding:0 };
