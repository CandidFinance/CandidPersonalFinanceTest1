import { useState, useEffect } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronRight, Check, Lock } from "lucide-react";
import CardStack, { DARK } from "./CardStack.jsx";
import ScoreDonut from "./ScoreDonut.jsx";
import { isLocked } from "../lib/unlock.js";
import { fmt } from "../lib/format.js";
import { G, GOLD, TEXT, SERIF, SANS, WHITE, OPPORTUNITY_TILE_FIGURE } from "../design-tokens.js";

// Home's hero: two cards in a wallet stack (CardStack.jsx, which draws and
// turns them; Progress has the same stack). The front card wears a soft
// dark oil slick; the one behind shows its top line above it.
//  1. Left on the table and Saved in one tile: whichever is larger leads, a
//     bar splits what's been found into saved and still left, and the score.
//  2. Areas to explore: the opportunities by £, largest first, each ticked
//     once reviewed. No numbers, so the list doesn't read as an order to
//     follow (src/lib/priorities.js only ranks by £).
// The Cash row carries no rate badge: the Modules tab's is that state's one
// indicator (CLAUDE.md rule 4).

// The score last shown on Home this session. Home unmounts whenever you open
// a module, so this is what lets it animate from the old score to the new one
// when you come back after reviewing a module. Not persisted: a fresh page
// load just shows the score with no animation.
let lastShownScore = null;

// The ring fills from empty to the score the first time Home shows it in a
// session. After that, a gain counts up from the previous score, the ring
// turning gold while it fills, with a "+N" badge. No animation for reduced
// motion. Kept here, not in the screen, so each frame redraws only the hero.
function useScoreCountUp(score) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(() =>
    reduceMotion ? score : lastShownScore === null ? 0 : lastShownScore < score ? lastShownScore : score);
  const [gain, setGain] = useState(0);
  useEffect(() => {
    const from = shown;
    const prev = lastShownScore;
    lastShownScore = score;
    // No change, a fall, or reduced motion: just show it. The first showing
    // this session fills from empty, without a gain badge.
    if (reduceMotion || from >= score) { setShown(score); return; }
    if (prev !== null) setGain(score - from);
    const start = performance.now(), duration = prev === null ? 1100 : 900;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (score - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const timer = setTimeout(() => setGain(0), 2600);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [score]); // eslint-disable-line react-hooks/exhaustive-deps
  return [shown, gain];
}

export default function HomeHero({ d, totalOpp, saved, score, scoreColor, scoreLabel, plan, stepsDone, headline, onTrack, unchecked, onOpen }) {
  const [scoreShown, gain] = useScoreCountUp(score);
  // The lead figure isn't repeated under the bar, nor the bar's figure in the
  // line under the lead: one indicator each (CLAUDE.md rule 4).
  const leadSaved = saved > totalOpp;
  const found = saved + totalOpp;
  const lead = leadSaved
    ? { label: "Saved", value: fmt(saved),
        sub: totalOpp > 0 ? "From the changes you've made, each year." : "Nothing left on the table in what you've answered." }
    : { label: "Left on the table", value: fmt(totalOpp),
        sub: totalOpp > 0 ? "Your money left on the table each year, across what you've answered."
          : unchecked > 0 ? `Nothing left on the table in what you've checked so far. ${unchecked} more ${unchecked === 1 ? "area" : "areas"} to check below.`
          : "Nothing left on the table in what you've answered." };

  const cards = [
    { key: "summary", label: lead.label, amount: `${lead.value}/yr`, body: t => (
      <>
        <div style={{display:"flex",alignItems:"flex-start",gap:"14px"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:SERIF,fontSize:"var(--hero-fig)",fontWeight:700,color:t.figure,lineHeight:1,letterSpacing:"-0.01em",marginTop:"8px"}}>
              {lead.value} <span style={{fontFamily:SANS,fontSize:"0.32em",fontWeight:600,letterSpacing:0,whiteSpace:"nowrap"}}>a year</span>
            </div>
            <p style={{fontSize:"13px",color:t.body,lineHeight:1.45,margin:"8px 0 0"}}>{lead.sub}</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
            <ScoreDonut value={scoreShown} color={gain > 0 ? GOLD : scoreColor} size={76} stroke={7} onDark={t === DARK} track={t.track}/>
            <div style={{fontSize:"11.5px",fontWeight:600,color:t.label,marginTop:"6px"}}>Candid score</div>
            <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"1px"}}>
              <span style={{fontSize:"12px",fontWeight:700,color:t.figure}}>{scoreLabel}</span>
              {gain > 0 && <span style={{fontSize:"11px",fontWeight:700,color:t.figure,background:"rgba(196,150,58,0.35)",borderRadius:"100px",padding:"2px 8px",animation:"badgeFadeUp 2.6s ease forwards",whiteSpace:"nowrap"}}>+{gain}</span>}
            </div>
          </div>
        </div>
        {/* What's been found so far: saved in gold, still left as the
            track, plain. */}
        {found > 0 && (
          <div style={{marginTop:"16px"}}>
            <div style={{height:"8px",borderRadius:"4px",display:"flex",overflow:"hidden",background:t.track}}>
              <div style={{width:`${saved / found * 100}%`,background:GOLD}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",gap:"10px",marginTop:"10px"}}>
              {/* Only the figure that isn't leading, under its end of the bar. */}
              {[["Saved", saved, !leadSaved], ["Still left", totalOpp, leadSaved]].map(([l, v, shown], i) => shown && (
                <div key={l} style={{display:"flex",flexDirection:"column",gap:"2px",textAlign:i ? "right" : "left",marginLeft:i ? "auto" : 0}}>
                  <span style={{fontSize:"12px",fontWeight:600,color:t.label}}>{l}</span>
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
            style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",textAlign:"left",background:"none",border:"none",borderTop:i ? `1px solid ${t.rule}` : "none",padding:"9px 0",minHeight:"44px",cursor:"pointer",fontFamily:"inherit"}}>
            {/* Reviewed: a tick. Not yet: an empty ring. */}
            <span style={{width:"18px",height:"18px",borderRadius:"50%",border:p.done ? "none" : `1.5px solid ${t === DARK ? "rgba(246,234,208,0.4)" : "rgba(22,47,36,0.25)"}`,background:p.done ? (t === DARK ? OPPORTUNITY_TILE_FIGURE : G) : "transparent",color:t === DARK ? G : WHITE,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxSizing:"border-box"}}>
              {p.done && <Check size={11} strokeWidth={3}/>}
            </span>
            <span style={{flex:1,minWidth:0}}>
              <span style={{display:"block",fontSize:"14px",fontWeight:700,color:t === DARK ? OPPORTUNITY_TILE_FIGURE : TEXT}}>{p.title}</span>
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
          style={{marginTop:"2px",background:"none",border:"none",padding:"12px 0",fontSize:"13px",fontWeight:700,color:t.figure,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:"2px"}}>
          All modules<ChevronRight size={14}/>
        </button>
      </div>
    ) },
  ];

  return (
    <section aria-label="Your figures" data-tour="home-score" style={{marginBottom:"22px"}}>
      <CardStack cards={cards} turnLabels={["Show the other card", "Show the other card"]}/>
    </section>
  );
}
