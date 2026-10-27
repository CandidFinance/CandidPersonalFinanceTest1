import { useState, useRef, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, ChevronUp, ChevronDown, Check, Lock } from "lucide-react";
import ScoreDonut from "./ScoreDonut.jsx";
import NewBadge, { rateUpdatesLabel } from "./NewBadge.jsx";
import { isLocked } from "../lib/unlock.js";
import { fmt } from "../lib/format.js";
import { G, GOLD, PROGRESS_GREEN, MUT, TEXT, SERIF, SANS, WHITE, HERO_TILE_BG, OPPORTUNITY_TILE_BG, OPPORTUNITY_TILE_BORDER, OPPORTUNITY_TILE_SHADOW, OPPORTUNITY_TILE_LABEL, OPPORTUNITY_TILE_FIGURE, OPPORTUNITY_TILE_BODY, OPPORTUNITY_TILE_RADIUS, OPPORTUNITY_TILE_SHEEN } from "../design-tokens.js";

// Home's hero: two cards stacked one in front of the other, like a wallet.
// The front card wears the Opportunity tiles' dark oil slick; the one behind
// is light, with its top line (label and amount) showing above the front, so
// nothing is hidden. Swiping up or down on the stack, the arrows, or tapping
// the card behind turns the front card away on its Y axis and sends it back.
//  1. Left on the table and Saved in one tile: whichever is larger leads, a
//     bar splits what's been found into saved and still left, and the score.
//  2. Areas to explore: the opportunities by £, largest first, each ticked
//     once reviewed. No numbers, so the list doesn't read as an order to
//     follow (src/lib/priorities.js only ranks by £).
// No wheel turning on desktop: it would catch the page's own scroll.
const PEEK = 44;      // px of the card behind showing above the front
const TURN = 700;     // ms
const CSS = `
.home-hero { --hero-fig: 52px; }
@media (min-width: 1000px) { .home-hero { --hero-fig: 72px; } }
.home-hero-card { position: relative; overflow: hidden; transition: border-color 0.35s ease, box-shadow 0.35s ease; }
.home-hero-card > :not(.home-hero-dark) { position: relative; z-index: 1; }
.home-hero-card * { transition: color 0.35s ease, border-color 0.35s ease, background-color 0.35s ease, stroke 0.35s ease; }
/* The dark fill is a layer that fades in and out (a gradient can't fade
   into another), so a card changes from light to dark smoothly. */
.home-hero-dark { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; background: ${OPPORTUNITY_TILE_BG}; transition: opacity 0.35s ease; }
.home-hero-dark::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 260%; pointer-events: none;
  background: linear-gradient(112deg, transparent 32%, rgba(255,255,255,${OPPORTUNITY_TILE_SHEEN}) 46%, transparent 60%);
  will-change: transform; animation: home-hero-sheen 7s ease-in-out infinite; }
.home-hero-dark:not(.on)::after { animation-play-state: paused; }
@keyframes home-hero-sheen { 0% { transform: translateX(-75%); } 55%, 100% { transform: translateX(25%); } }
@media (prefers-reduced-motion: reduce) { .home-hero-dark::after { animation: none; transform: translateX(-30%); } }
`;

// The two colour schemes a card can wear: dark in front, light behind.
const DARK = { bg: OPPORTUNITY_TILE_BG, border: OPPORTUNITY_TILE_BORDER, shadow: OPPORTUNITY_TILE_SHADOW, label: OPPORTUNITY_TILE_LABEL, figure: OPPORTUNITY_TILE_FIGURE, body: OPPORTUNITY_TILE_BODY, rule: "rgba(255,255,255,0.12)", track: "rgba(255,255,255,0.12)" };
const LIGHT = { bg: HERO_TILE_BG, border: "1px solid rgba(22,47,36,0.10)", shadow: "0 4px 18px rgba(22,47,36,0.08)", label: MUT, figure: G, body: MUT, rule: "rgba(22,47,36,0.08)", track: "rgba(22,47,36,0.08)" };

export default function HomeHero({ d, totalOpp, saved, scoreShown, scoreColor, scoreLabel, gain, plan, stepsDone, headline, onTrack, cashBadge, unchecked, onOpen }) {
  const reduceMotion = useReducedMotion();
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

  const turn = () => {
    if (turning !== null) return;
    const next = 1 - target;
    setTarget(next);
    if (reduceMotion) { setFront(next); return; }
    setTurning(front);
    timers.current = [setTimeout(() => setFront(next), TURN * 0.45), setTimeout(() => setTurning(null), TURN)];
  };
  const onPointerDown = e => { startY.current = e.clientY; swiped.current = false; };
  const onPointerUp = e => {
    if (startY.current === null) return;
    const dy = e.clientY - startY.current;
    startY.current = null;
    if (Math.abs(dy) > 28) { swiped.current = true; turn(); }
  };
  // A swipe that ends on a row or on the card behind isn't also a tap.
  const onClickCapture = e => {
    if (!swiped.current) return;
    swiped.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  // The figures beneath (the bar's Saved and Still left) aren't repeated in
  // the line under the lead figure: one indicator each (CLAUDE.md rule 4).
  const leadSaved = saved > totalOpp;
  const found = saved + totalOpp;
  const lead = leadSaved
    ? { label: "Saved", value: fmt(saved), unit: "a year",
        sub: totalOpp > 0 ? "From the changes you've made, each year." : "Nothing left on the table in what you've answered." }
    : { label: "Left on the table/yr", value: fmt(totalOpp),
        sub: totalOpp > 0 ? "Your money left on the table each year, across what you've answered."
          : unchecked > 0 ? `Nothing left on the table in what you've checked so far. ${unchecked} more ${unchecked === 1 ? "area" : "areas"} to check below.`
          : "Nothing left on the table in what you've answered." };

  const cards = [
    { key: "summary", label: lead.label, amount: lead.unit ? `${lead.value}/yr` : lead.value, body: t => (
      <>
        <div style={{display:"flex",alignItems:"flex-start",gap:"14px"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:SERIF,fontSize:"var(--hero-fig)",fontWeight:700,color:t.figure,lineHeight:1,letterSpacing:"-0.01em",marginTop:"8px"}}>
              {lead.value}{lead.unit && <span style={{fontFamily:SANS,fontSize:"0.32em",fontWeight:600,marginLeft:"5px",letterSpacing:0}}>{lead.unit}</span>}
            </div>
            <p style={{fontSize:"13px",color:t.body,lineHeight:1.45,margin:"8px 0 0"}}>{lead.sub}</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
            <ScoreDonut value={scoreShown} color={gain > 0 ? GOLD : scoreColor} size={76} stroke={7} onDark={t === DARK} track={t.track}/>
            <div style={{fontSize:"9.5px",fontWeight:700,color:t.label,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:"6px"}}>Candid score</div>
            <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"1px"}}>
              <span style={{fontSize:"12px",fontWeight:700,color:t.figure}}>{scoreLabel}</span>
              {gain > 0 && <span style={{fontSize:"11px",fontWeight:700,color:"#8a6a24",background:"rgba(196,150,58,0.22)",borderRadius:"100px",padding:"2px 8px",animation:"badgeFadeUp 2.6s ease forwards",whiteSpace:"nowrap"}}>+{gain}</span>}
            </div>
          </div>
        </div>
        {/* What's been found so far, split into saved and still left. */}
        {found > 0 && (
          <div style={{marginTop:"16px"}}>
            <div style={{height:"10px",borderRadius:"5px",display:"flex",overflow:"hidden",background:t.track}}>
              <div style={{width:`${saved / found * 100}%`,background:`linear-gradient(90deg, ${PROGRESS_GREEN}, ${GOLD})`}}/>
              <div style={{flex:1,background:t === DARK
                ? "repeating-linear-gradient(135deg, rgba(246,234,208,0.28) 0 4px, rgba(246,234,208,0.1) 4px 8px)"
                : "repeating-linear-gradient(135deg, rgba(22,47,36,0.16) 0 4px, rgba(22,47,36,0.05) 4px 8px)"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",gap:"10px",marginTop:"10px"}}>
              {[["Saved", saved], ["Still left", totalOpp]].map(([l, v], i) => (
                <div key={l} style={{display:"flex",flexDirection:"column",gap:"2px",textAlign:i ? "right" : "left"}}>
                  <span style={{fontSize:"10.5px",fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:t.label}}>{l}</span>
                  <span style={{fontFamily:SERIF,fontSize:"22px",fontWeight:700,color:t.figure}}>{fmt(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    ) },
    { key: "areas", label: "Areas to explore", amount: plan.length ? `${stepsDone} of ${plan.length} reviewed` : "", body: t => (
      <div style={{marginTop:"6px"}}>
        {plan.length > 0 ? plan.map((p, i) => (
          <button key={p.key} type="button" onClick={() => onOpen(p.key)}
            style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",textAlign:"left",background:"none",border:"none",borderTop:i ? `1px solid ${t.rule}` : "none",padding:"9px 0",cursor:"pointer",fontFamily:"inherit"}}>
            {/* Reviewed: a tick. Not yet: an empty ring. */}
            <span style={{width:"18px",height:"18px",borderRadius:"50%",border:p.done ? "none" : `1.5px solid ${t === DARK ? "rgba(246,234,208,0.4)" : "rgba(22,47,36,0.25)"}`,background:p.done ? (t === DARK ? OPPORTUNITY_TILE_FIGURE : G) : "transparent",color:t === DARK ? "#0e2219" : WHITE,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxSizing:"border-box"}}>
              {p.done && <Check size={11} strokeWidth={3}/>}
            </span>
            <span style={{flex:1,minWidth:0}}>
              <span style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"14px",fontWeight:700,color:t === DARK ? OPPORTUNITY_TILE_FIGURE : TEXT}}>
                {p.title}
                {p.key === "cash" && cashBadge > 0 && <NewBadge inline count={cashBadge} label={rateUpdatesLabel(cashBadge)}/>}
              </span>
              {isLocked(d, p.key) && <span style={{display:"block",fontSize:"12px",color:t.body,marginTop:"1px"}}>Unlock to see how</span>}
            </span>
            <span style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"13px",fontWeight:600,color:t.body,whiteSpace:"nowrap"}}>
              {isLocked(d, p.key) && <Lock size={12}/>}{fmt(p.amount)}{p.amountIsLumpSum ? " by 18" : "/yr"}
            </span>
            <ChevronRight size={15} color={t.body} style={{flexShrink:0}}/>
          </button>
        )) : <p style={{fontSize:"13px",color:t.body,lineHeight:1.5,margin:"4px 0 0"}}>{headline}</p>}
        {onTrack.length > 0 && (
          <p style={{fontSize:"12.5px",color:t.body,lineHeight:1.5,margin:"6px 0 0"}}>
            <span style={{fontWeight:700,color:t.figure}}>On track:</span> {onTrack.join(", ")}.
          </p>
        )}
        <button type="button" onClick={() => onOpen(null)}
          style={{marginTop:"10px",background:"none",border:"none",padding:0,fontSize:"13px",fontWeight:700,color:t.figure,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:"2px"}}>
          All modules<ChevronRight size={14}/>
        </button>
      </div>
    ) },
  ];

  const ease = [0.4, 0.1, 0.2, 1];
  return (
    <section aria-label="Your figures" className="home-hero" style={{marginBottom:"22px"}}>
      <style>{CSS}</style>
      {/* Both cards share one grid cell, so the stack is as tall as the
          taller card; the one behind sits PEEK px higher. */}
      <div onPointerDown={onPointerDown} onPointerUp={onPointerUp} onClickCapture={onClickCapture}
        style={{display:"grid",paddingTop:`${PEEK}px`,perspective:"1100px",touchAction:"pan-x"}}>
        {cards.map((c, i) => {
          const isFront = i === front, isTarget = i === target;
          const t = isFront ? DARK : LIGHT;
          const behind = { y: -PEEK, scale: 0.955, rotateY: 0, x: "0%" };
          const ahead = { y: 0, scale: 1, rotateY: 0, x: "0%" };
          const animate = turning === i
            ? { y: [0, 0, -PEEK], scale: [1, 1, 0.955], rotateY: [0, -80, 0], x: ["0%", "-12%", "0%"] }
            : isTarget ? ahead : behind;
          return (
            <motion.div key={c.key} className="home-hero-card"
              initial={false} animate={animate}
              transition={turning === i ? { duration: TURN / 1000, times: [0, 0.45, 1], ease } : { duration: reduceMotion ? 0 : TURN * 0.8 / 1000, ease }}
              onClick={isTarget ? undefined : turn} aria-hidden={!isTarget}
              style={{gridArea:"1 / 1",zIndex:isFront ? 2 : 1,transformOrigin:"50% 0",background:LIGHT.bg,border:t.border,boxShadow:t.shadow,
                borderRadius:OPPORTUNITY_TILE_RADIUS,padding:"16px 20px 18px",cursor:isTarget ? "default" : "pointer",display:"flex",flexDirection:"column"}}>
              <div className={`home-hero-dark${isFront ? " on" : ""}`} aria-hidden="true" style={{opacity:isFront ? 1 : 0,transition:"opacity 0.385s ease"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:"10px",minHeight:"18px"}}>
                <span style={{fontSize:"11px",fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:t.label}}>{c.label}</span>
                {/* The top line's amount: only for the card behind, as the
                    front card shows it in full. */}
                <span style={{fontFamily:SERIF,fontSize:"16px",fontWeight:700,color:t.figure,opacity:isTarget ? 0 : 1,transition:"opacity 0.3s, color 0.35s"}}>{c.amount}</span>
              </div>
              {/* Behind, only the top line shows: the body fades out so
                  nothing (the score ring) pokes into that line. It stays
                  while a card turns away, and fades in as one comes forward. */}
              {/* Hidden, it's also out of reach: no taps or tabbing onto rows
                  you can't see (visibility goes once the fade is done). */}
              <div style={{opacity:isTarget || isFront ? 1 : 0,visibility:isTarget || isFront ? "visible" : "hidden",
                transition:isTarget || isFront ? "opacity 0.3s" : "opacity 0.3s, visibility 0s linear 0.3s"}}>{c.body(t)}</div>
            </motion.div>
          );
        })}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"12px",marginTop:"10px"}}>
        <button type="button" onClick={turn} aria-label="Show the other card" style={arrow}><ChevronUp size={15} color={G}/></button>
        <div style={{display:"flex",gap:"6px"}} aria-hidden="true">
          {cards.map((c, i) => <span key={c.key} style={{width:"7px",height:"7px",borderRadius:"50%",background:i === target ? G : "rgba(22,47,36,0.2)",transform:i === target ? "scale(1.2)" : "none",transition:"background 0.2s, transform 0.2s"}}/>)}
        </div>
        <button type="button" onClick={turn} aria-label="Show the other card" style={arrow}><ChevronDown size={15} color={G}/></button>
      </div>
    </section>
  );
}

const arrow = { width:"30px", height:"30px", borderRadius:"50%", border:"1px solid rgba(22,47,36,0.15)", background:WHITE, display:"grid", placeItems:"center", cursor:"pointer", padding:0 };
