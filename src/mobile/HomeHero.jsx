import { ChevronRight, Check, Lock } from "lucide-react";
import CardStack, { DARK } from "./CardStack.jsx";
import ScoreDonut from "./ScoreDonut.jsx";
import NewBadge, { rateUpdatesLabel } from "./NewBadge.jsx";
import { isLocked } from "../lib/unlock.js";
import { fmt } from "../lib/format.js";
import { G, GOLD, PROGRESS_GREEN, TEXT, SERIF, SANS, WHITE, OPPORTUNITY_TILE_FIGURE } from "../design-tokens.js";

// Home's hero: two cards in a wallet stack (CardStack.jsx, which draws and
// turns them; Progress has the same stack). The front card wears the dark
// oil slick; the one behind shows its top line above it.
//  1. Left on the table and Saved in one tile: whichever is larger leads, a
//     bar splits what's been found into saved and still left, and the score.
//  2. Areas to explore: the opportunities by £, largest first, each ticked
//     once reviewed. No numbers, so the list doesn't read as an order to
//     follow (src/lib/priorities.js only ranks by £).

export default function HomeHero({ d, totalOpp, saved, scoreShown, scoreColor, scoreLabel, gain, plan, stepsDone, headline, onTrack, cashBadge, unchecked, onOpen }) {
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

  return (
    <section aria-label="Your figures" style={{marginBottom:"22px"}}>
      <CardStack cards={cards} turnLabels={["Show the other card", "Show the other card"]}/>
    </section>
  );
}
