import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ScoreDetailSheet, scoreBand, G, GOLD, CDARK, WHITE, MUT, TEXT, SERIF, SC, RADIUS_CARD } from "../../CandidApp.jsx";
import { getModuleBreakdown, calcCandidScore } from "../../lib/moduleStatus.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import { mobileGreeting } from "../copy.js";
import MobileStartHome from "./MobileStartHome.jsx";

// Mobile Home screen — matches the "Claude Design" mockup's Overview tab
// (score progress bar, Opportunity pill, expandable Net Worth card, Biggest
// Win card), rebuilt against real app data instead of the mockup's sample
// numbers. Score labels/colors reuse scoreBand (CandidApp.jsx) — the same
// bands as desktop's ScoreRing/ScoreDetailSheet — rather than the mockup's
// own wording, so the score reads identically everywhere in the app. Icons
// stay lucide-react (CLAUDE.md rule 2) rather than the mockup's hand-drawn
// SVGs.

// Flat asset/liability list for the expandable Net Worth card — a simpler
// grouping than desktop's (ISA/unwrapped combined into one "Investments"
// line) to match the mockup's information density.
function netWorthBreakdown(d, m) {
  const isaPrev = (+d.isaPrevCash||0) + (+d.isaPrevSS||0) + (+d.isaPrevLISA||0) + (+d.isaPrevOther||0) || (+d.isaPreviousBalance||0);
  const assets = [
    { label: "Cash & savings", value: m.cash + m.bonds },
    { label: "Investments", value: m.isaUsedThisYear + isaPrev + (+d.unwrappedValue||0) },
    { label: "Pension", value: (+d.potValue||0) + (+d.potValue2||0) },
    { label: "Property equity", value: m.propertyEquity || 0 },
  ].filter(a => a.value > 0);
  const liabilities = [
    { label: "Student loan", value: m.loanBal || 0 },
    { label: "Mortgage", value: d.hasMortgage === "yes" ? (+d.mortgageBalance||0) : 0 },
    { label: "Personal loan", value: d.hasPersonalLoan === "yes" ? (+d.personalLoanBalance||0) : 0 },
  ].filter(l => l.value > 0);
  return { assets, liabilities };
}

// The score last shown on Home this session. Home unmounts whenever you open
// a module, so this is what lets it animate from the old score to the new one
// when you come back after reviewing a module. Not persisted: a fresh page
// load just shows the score with no animation.
let lastShownScore = null;

export default function MobileHomeScreen({ insights, d, m, statuses, completedModules, onStartModule }) {
  const navigate = useNavigate();
  const [scoreDetailOpen, setScoreDetailOpen] = useState(false);
  const [netWorthOpen, setNetWorthOpen] = useState(false);

  // Computed live from `statuses` (see calcCandidScore) rather than read from
  // insights.score — reacts instantly and for free to any change in `d`, from
  // the full "Edit inputs" wizard or a per-recommendation quick-update alike.
  // The count-up/gain-badge animation below still fires correctly: it just
  // reacts to `score` changing, whatever the reason.
  const score = calcCandidScore(statuses);

  // Score-gain animation (mirrors desktop's gold delta arc + "+N pts"): the
  // number counts up from the previous score, the bar turns gold while it
  // fills, and a "+N pts" badge floats up. Hooks sit above the early return.
  const [shownScore, setShownScore] = useState(() => (lastShownScore !== null && lastShownScore < score) ? lastShownScore : score);
  const [gain, setGain] = useState(0);
  const hasInsights = !!insights;
  useEffect(() => {
    if (!hasInsights) return;
    const from = shownScore;
    const prev = lastShownScore;
    lastShownScore = score;
    // First time Home is shown this session (prev === null), or the score
    // didn't go up: just show it, no animation.
    if (prev === null || from >= score) { setShownScore(score); return; }
    setGain(score - from);
    const start = performance.now(), duration = 900;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setShownScore(Math.round(from + (score - from) * t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const timer = setTimeout(() => setGain(0), 2600);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [score, hasInsights]);

  // No report yet (a user who came in through the two-question entry): the
  // modules to start with instead of the score.
  if (!insights) return <MobileStartHome d={d} m={m} onStartModule={onStartModule}/>;

  const { color: scoreColor, label: scoreLabel } = scoreBand(score);
  const { modulesWithRec, totalOpp } = getModuleBreakdown(d, m, statuses, insights, "amount");
  const topWin = modulesWithRec[0] || null;
  // "Reviewed" tracks engagement with the report, not your actual financial
  // position — its own line, never folded into the score above.
  const reviewableModules = modulesWithRec.length;
  const reviewedModuleCount = modulesWithRec.filter(mm => (completedModules||[]).includes(mm.key)).length;
  const { assets, liabilities } = netWorthBreakdown(d, m);
  const netWorthPositive = m.netWorth >= 0;
  const topWinColor = topWin ? (SC[topWin.status] || MUT) : MUT;

  return (
    <div>
      <h1 style={{fontFamily:SERIF,fontSize:"22px",color:G,fontWeight:700,marginBottom:"20px",lineHeight:1.2}}>
        {mobileGreeting(d)}
      </h1>

      {/* Score — tap opens the full breakdown sheet. */}
      <div onClick={() => setScoreDetailOpen(true)} style={{cursor:"pointer",marginBottom:"4px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Candid Score</span>
          <span style={{fontSize:"14px",color:MUT}}>›</span>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",gap:"8px",marginTop:"6px"}}>
          <span style={{fontFamily:SERIF,fontWeight:700,fontSize:"48px",lineHeight:1,color:scoreColor}}>{shownScore}</span>
          <span style={{fontSize:"14px",color:MUT,marginBottom:"7px"}}>/100 · {scoreLabel}</span>
          {gain > 0 && (
            <span style={{fontSize:"12px",fontWeight:700,color:"#8a6a24",background:"rgba(196,150,58,0.18)",borderRadius:"100px",padding:"3px 10px",marginBottom:"8px",animation:"badgeFadeUp 2.6s ease forwards",whiteSpace:"nowrap"}}>+{gain} pts</span>
          )}
        </div>
        {insights.headline && (
          <p style={{fontSize:"13px",color:MUT,marginTop:"6px",lineHeight:1.5}}>{insights.headline}</p>
        )}
        {/* Solid fill, coloured by scoreBand — five flat bands (red through
            Candid green) rather than a continuous gradient, so the colour
            reads as "which zone am I in" at a glance. Gold flash while a
            gain is animating in, same as before, settling to the real band
            colour once the count-up finishes. */}
        <div style={{height:"6px",borderRadius:"100px",background:CDARK,marginTop:"12px",overflow:"hidden"}}>
          <div style={{height:"100%",borderRadius:"100px",background:gain > 0 ? GOLD : scoreColor,width:`${Math.min(100,shownScore)}%`,transition:"background 1.2s ease"}}/>
        </div>
      </div>
      {/* Separate bar, deliberately not blended into the score above — this
          tracks how much of the report you've read, not your finances, so it
          gets its own colour (brand green, not the score's red-to-green
          spectrum or its gold gain-flash) rather than reading as another
          score indicator. */}
      {reviewableModules > 0 && (
        <div onClick={() => navigate("/app/modules")} style={{display:"flex",alignItems:"center",gap:"10px",marginTop:"14px",cursor:"pointer"}}>
          <div style={{flex:1,height:"5px",borderRadius:"100px",background:CDARK,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:"100px",background:G,width:`${Math.round((reviewedModuleCount/reviewableModules)*100)}%`,transition:"width 0.4s ease"}}/>
          </div>
          <span style={{fontSize:"11px",color:MUT,whiteSpace:"nowrap"}}>{reviewedModuleCount} of {reviewableModules} reviewed</span>
        </div>
      )}
      {scoreDetailOpen && (
        // isMobile=false here on purpose: that flag switches ScoreDetailSheet
        // into a bottom-sheet pinned to the very bottom of the *browser*
        // viewport (full width, vertically flush to the bottom) — correct for
        // an actual narrow-phone-width desktop visitor, but on this mobile
        // app route (viewed at any window width, including a full desktop
        // browser) it rendered detached from the app's own centred content
        // column instead of appearing over the Candid Score tile. The
        // centred-modal mode is the closer match here.
        <ScoreDetailSheet insights={insights} displayScore={score} isMobile={false}
          onClose={() => setScoreDetailOpen(false)}
          onReviewModules={() => { setScoreDetailOpen(false); navigate("/app/modules"); }}/>
      )}

      {/* Opportunity — taps through to the full module ranking. Same card,
          header row and 30px serif figure as the Net worth tile below, so the
          Home tiles read as one set (not the module pages' dark
          OPPORTUNITY_TILE_* panel, which competed with the score here). */}
      {totalOpp > 0 && (
        <div onClick={() => navigate("/app/modules")} style={{marginTop:"14px",background:WHITE,border:"1px solid rgba(22,47,36,0.08)",borderRadius:RADIUS_CARD,padding:"18px",boxShadow:"0 2px 10px rgba(22,47,36,0.05)",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Opportunity</span>
            <ChevronRight size={14} color={MUT}/>
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:"4px",marginTop:"6px"}}>
            <span style={{fontFamily:SERIF,fontWeight:700,fontSize:"30px",color:TEXT}}>{fmtCompact(totalOpp)}</span>
            <span style={{fontSize:"14px",color:MUT}}>/yr</span>
          </div>
        </div>
      )}

      {/* Net worth — a tile; tap anywhere on it to expand the assets/liabilities
          breakdown in place (same white card treatment as "Your biggest win"). */}
      <div onClick={() => setNetWorthOpen(v => !v)} style={{marginTop:"20px",background:WHITE,border:"1px solid rgba(22,47,36,0.08)",borderRadius:RADIUS_CARD,padding:"18px",boxShadow:"0 2px 10px rgba(22,47,36,0.05)",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Net worth</span>
          <ChevronDown size={14} color={MUT} style={{transform:netWorthOpen?"rotate(180deg)":"none",transition:"transform 0.2s"}}/>
        </div>
        <div style={{display:"flex",alignItems:"baseline",gap:"8px",marginTop:"6px"}}>
          <span style={{fontFamily:SERIF,fontWeight:700,fontSize:"30px",color:netWorthPositive?TEXT:"#c0392b"}}>{fmt(Math.abs(m.netWorth))}</span>
        </div>
        <div style={{display:"flex",gap:"20px",marginTop:"10px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
            <span style={{width:"7px",height:"7px",borderRadius:"50%",background:"#2d6b4a",display:"inline-block"}}/>
            <span style={{fontSize:"12.5px",color:MUT}}>Assets <b style={{color:TEXT}}>{fmt(m.totalAssets)}</b></span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
            <span style={{width:"7px",height:"7px",borderRadius:"50%",background:"#c0392b",display:"inline-block"}}/>
            <span style={{fontSize:"12.5px",color:MUT}}>Liabilities <b style={{color:TEXT}}>{fmt(m.totalLiabilities)}</b></span>
          </div>
        </div>
        {netWorthOpen && (assets.length > 0 || liabilities.length > 0) && (
          <div style={{marginTop:"16px",paddingTop:"14px",borderTop:`1px solid rgba(22,47,36,0.08)`,display:"flex",flexDirection:"column",gap:"10px"}}>
            {assets.length > 0 && (
              <div style={{fontSize:"10.5px",fontWeight:700,color:"#2d6b4a",letterSpacing:"0.08em",textTransform:"uppercase"}}>Assets</div>
            )}
            {assets.map((a,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:"13px",color:TEXT}}>{a.label}</span>
                <span style={{fontSize:"13px",fontWeight:600,color:TEXT}}>{fmt(a.value)}</span>
              </div>
            ))}
            {liabilities.length > 0 && (
              <div style={{fontSize:"10.5px",fontWeight:700,color:"#c0392b",letterSpacing:"0.08em",textTransform:"uppercase",marginTop:"6px"}}>Liabilities</div>
            )}
            {liabilities.map((l,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:"13px",color:TEXT}}>{l.label}</span>
                <span style={{fontSize:"13px",fontWeight:600,color:TEXT}}>{fmt(l.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Biggest win — an interactive card (CLAUDE.md rule 3: reserve card
          wrapping for discrete, actionable components), like the Net worth tile. */}
      {topWin && (
        <div style={{marginTop:"20px"}}>
          <div style={{background:WHITE,border:"1px solid rgba(22,47,36,0.08)",borderRadius:RADIUS_CARD,padding:"18px",boxShadow:"0 2px 10px rgba(22,47,36,0.05)"}}>
            {/* Title sits inside the card, as the Opportunity/Net worth tiles' header rows do. */}
            <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Your biggest win</div>
            <div style={{display:"flex",alignItems:"center",gap:"10px",marginTop:"12px"}}>
              <div style={{width:"34px",height:"34px",borderRadius:"9px",background:`${topWinColor}1f`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {topWin.icon && <topWin.icon size={16} color={topWinColor}/>}
              </div>
              <div style={{fontSize:"15px",fontWeight:600,color:TEXT,lineHeight:1.3}}>{topWin.title}</div>
            </div>
            {/* Same figure treatment as the Opportunity/Net worth tiles above. */}
            <div style={{display:"flex",alignItems:"baseline",gap:"4px",marginTop:"12px"}}>
              <span style={{fontFamily:SERIF,fontWeight:700,fontSize:"30px",color:TEXT}}>{fmtCompact(topWin.amount)}</span>
              <span style={{fontSize:"14px",color:MUT}}>{topWin.amountIsLumpSum ? "by 18" : "/yr"}</span>
            </div>
            <p style={{fontSize:"13px",color:MUT,marginTop:"4px",lineHeight:1.5}}>{topWin.summary}</p>
            <button onClick={() => navigate(`/app/module/${topWin.key}`)} style={{marginTop:"14px",width:"100%",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"12px",fontSize:"14px",fontWeight:600,cursor:"pointer"}}>
              Review in {topWin.title}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
