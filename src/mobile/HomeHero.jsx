import { useState, useEffect } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronRight, Check } from "lucide-react";
import { DARK } from "./CardStack.jsx";
import ScoreDonut from "./ScoreDonut.jsx";
import AccountButton from "./Account.jsx";
import PremiumButton from "./Premium.jsx";
import { CREAM_SOFT, CREAM_FAINT } from "./ScreenBand.jsx";
import { fmt } from "../lib/format.js";
import { G, GOLD, TEXT, MUT, SERIF, SANS, WHITE, CREAM, ROW_TILE, TILE_KICKER } from "../design-tokens.js";

// Home's parts, on the dark band and cream sheet the other tabs have
// (ScreenBand.jsx; the screens draw those).
//  - HomeTopBar: Account and Candid Premium's crown on the left (no wordmark:
//    users know they're in the app), Edit inputs on the right.
//  - HomeHero, printed on the band: Left on the table or Saved, whichever is
//    larger, and the score. Once anything's been saved, a bar splits what's
//    been found into saved and still left.
//  - HomeAreas, first on the sheet: the opportunities by £, largest first,
//    each ticked once reviewed. No numbers, so the list doesn't read as an
//    order to follow (src/lib/priorities.js only ranks by £).
// The Cash row carries no rate badge: the Modules tab's is that state's one
// indicator (CLAUDE.md rule 4).

// The caption over a figure on the band, as BandViewCaption has it.
export const BAND_LABEL = { fontSize:"11px", fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:CREAM_SOFT };

export function HomeTopBar({ d, onEditInputs }) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",margin:"-10px 0 20px"}}>
      <span style={{display:"inline-flex",alignItems:"center",gap:"8px"}}>
        <AccountButton/>
        <PremiumButton d={d}/>
      </span>
      <button type="button" className="tap44" onClick={onEditInputs} style={{background:"none",border:`1.5px solid ${CREAM_FAINT}`,borderRadius:"100px",padding:"6px 14px",cursor:"pointer",color:CREAM,fontSize:"13px",fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap"}}>
        Edit inputs
      </button>
    </div>
  );
}

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

export default function HomeHero({ totalOpp, saved, score, scoreColor, unchecked }) {
  const [scoreShown, gain] = useScoreCountUp(score);
  // The lead figure isn't repeated under the bar, nor the bar's figure in the
  // line under the lead: one indicator each (CLAUDE.md rule 4).
  const leadSaved = saved > totalOpp;
  const found = saved + totalOpp;
  const lead = leadSaved
    ? { label: "Saved", value: fmt(saved),
        sub: totalOpp > 0 ? "From the changes you've made, each year." : "Nothing left on the table in what you've answered." }
    : { label: "Left on the table", value: fmt(totalOpp),
        sub: totalOpp > 0 ? "Opportunity from topics covered."
          : unchecked > 0 ? `Nothing left on the table in what you've checked so far. ${unchecked} more ${unchecked === 1 ? "area" : "areas"} to check below.`
          : "Nothing left on the table in what you've answered." };

  return (
    <section aria-label="Your figures" data-tour="home-score">
      <div style={{display:"flex",alignItems:"flex-start",gap:"14px"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={BAND_LABEL}>{lead.label}</div>
          <div style={{fontFamily:SERIF,fontSize:"var(--hero-fig)",fontWeight:700,color:CREAM,lineHeight:1.05,letterSpacing:"-0.01em",marginTop:"8px"}}>
            {lead.value} <span style={{fontFamily:SANS,fontSize:"0.32em",fontWeight:600,letterSpacing:0,whiteSpace:"nowrap"}}>a year</span>
          </div>
          <p style={{fontSize:"13px",color:CREAM_SOFT,lineHeight:1.45,margin:"8px 0 0"}}>{lead.sub}</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
          <ScoreDonut value={scoreShown} color={gain > 0 ? GOLD : scoreColor} size={76} stroke={7} onDark/>
          <div style={{fontSize:"11.5px",fontWeight:600,color:CREAM_SOFT,marginTop:"6px"}}>Candid score</div>
          {gain > 0 && <span style={{fontSize:"11px",fontWeight:700,color:CREAM,background:"rgba(196,150,58,0.35)",borderRadius:"100px",padding:"2px 8px",marginTop:"4px",animation:"badgeFadeUp 2.6s ease forwards",whiteSpace:"nowrap"}}>+{gain}</span>}
        </div>
      </div>
      {/* What's been found so far, once anything's been saved (as Modules):
          saved in gold, still left as the track, plain. */}
      {saved > 0 && (
        <div style={{marginTop:"18px"}}>
          <div aria-hidden="true" style={{height:"8px",borderRadius:"4px",display:"flex",overflow:"hidden",background:DARK.track}}>
            <div style={{width:`${saved / found * 100}%`,background:GOLD}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",gap:"10px",marginTop:"10px"}}>
            {/* Only the figure that isn't leading, under its end of the bar. */}
            {[["Saved", saved, !leadSaved], ["Still left", totalOpp, leadSaved && totalOpp > 0]].map(([l, v, shown], i) => shown && (
              <div key={l} style={{display:"flex",flexDirection:"column",gap:"2px",textAlign:i ? "right" : "left",marginLeft:i ? "auto" : 0}}>
                <span style={{fontSize:"12px",fontWeight:600,color:CREAM_SOFT}}>{l}</span>
                <span style={{fontFamily:SERIF,fontSize:"22px",fontWeight:700,color:CREAM}}>{fmt(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function HomeAreas({ plan, stepsDone, headline, onTrack, onOpen }) {
  return (
    <section aria-label="Areas to explore" style={ROW_TILE}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px"}}>
        <h2 style={TILE_KICKER}>Areas to explore</h2>
        {plan.length > 0 && <span style={{fontSize:"12.5px",fontWeight:600,color:MUT,whiteSpace:"nowrap"}}>{stepsDone} of {plan.length} reviewed</span>}
      </div>
      <div style={{marginTop:"6px"}}>
        {plan.length > 0 ? plan.map((p, i) => (
          <button key={p.key} type="button" onClick={() => onOpen(p.key)}
            style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",textAlign:"left",background:"none",border:"none",borderTop:i ? "1px solid rgba(22,47,36,0.08)" : "none",padding:"10px 0",minHeight:"52px",cursor:"pointer",fontFamily:"inherit"}}>
            {/* Reviewed: a tick. Not yet: an empty ring. */}
            <span style={{width:"18px",height:"18px",borderRadius:"50%",border:p.done ? "none" : "1.5px solid rgba(22,47,36,0.25)",background:p.done ? G : "transparent",color:WHITE,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxSizing:"border-box"}}>
              {p.done && <Check size={11} strokeWidth={3}/>}
            </span>
            <span style={{flex:1,minWidth:0,fontSize:"14px",fontWeight:600,color:TEXT}}>{p.title}</span>
            <span style={{whiteSpace:"nowrap",fontFamily:SERIF,fontSize:"18px",fontWeight:700,color:G}}>
              {fmt(p.amount)}<span style={{fontFamily:SANS,fontSize:"12px",fontWeight:600,color:MUT}}>{p.amountIsLumpSum ? " by 18" : "/yr"}</span>
            </span>
            <ChevronRight size={15} color={MUT} style={{flexShrink:0}} aria-hidden="true"/>
          </button>
        )) : <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,margin:"4px 0 0"}}>{headline}</p>}
        {onTrack.length > 0 && (
          <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"6px 0 0"}}>
            <span style={{fontWeight:700,color:G}}>On track:</span> {onTrack.join(", ")}.
          </p>
        )}
        <button type="button" onClick={() => onOpen(null)}
          style={{marginTop:"2px",background:"none",border:"none",padding:"12px 0",fontSize:"13px",fontWeight:700,color:G,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:"2px"}}>
          All modules<ChevronRight size={14} aria-hidden="true"/>
        </button>
      </div>
    </section>
  );
}
