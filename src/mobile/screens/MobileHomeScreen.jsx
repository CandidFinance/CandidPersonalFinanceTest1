import { useState, useEffect } from "react";
import { useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import ScoreDonut from "../ScoreDonut.jsx";
import { scoreBand, G, GOLD, CDARK, WHITE, MUT, TEXT, SERIF, SC, RADIUS_CARD } from "../../CandidApp.jsx";
import { getModuleBreakdown, calcCandidScore } from "../../lib/moduleStatus.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import { mobileGreeting } from "../copy.js";
import MobileStartHome from "./MobileStartHome.jsx";
import { unfinishedPicks, scoreUnlocked } from "../../lib/appEntry.js";
import { whatToDoFirst, scoreHeadline, onTrackModules } from "../../lib/priorities.js";
import ModuleStartRow from "../ModuleStartRow.jsx";
import GoalsCard from "./GoalsCard.jsx";
import { readinessMissing } from "../../lib/propertyReadiness.js";

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

// The score shows once every module picked at the entry is answered
// (scoreUnlocked), or for a user with an old report; until then, the modules
// to start with (MobileStartHome). Everything here is worked out by the
// code: no AI report (score-without-ai-plan.md). `onGoalsDone(how, goals)`
// records the goals card being answered or dismissed.
export default function MobileHomeScreen({ insights, d, m, statuses, completedModules, onStartModule, onGoalsDone, set }) {
  const navigate = useNavigate();
  // The score tile opens in place to show what to do first.
  const [scoreOpen, setScoreOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const [netWorthOpen, setNetWorthOpen] = useState(false);

  // Computed live from `statuses` (see calcCandidScore) rather than read from
  // insights.score — reacts instantly and for free to any change in `d`, from
  // the full "Edit inputs" wizard or a per-recommendation quick-update alike.
  // The count-up/gain-badge animation below still fires correctly: it just
  // reacts to `score` changing, whatever the reason.
  const score = calcCandidScore(statuses);

  // The ring fills from empty to the score the first time Home shows it in a
  // session. After that, a gain counts up from the previous score, the ring
  // turning gold while it fills, with a "+N pts" badge (as desktop's ring
  // did). No animation for reduced motion. Hooks sit above the early return.
  const [shownScore, setShownScore] = useState(() =>
    reduceMotion ? score : lastShownScore === null ? 0 : lastShownScore < score ? lastShownScore : score);
  const [gain, setGain] = useState(0);
  const propertyDone = readinessMissing(d, m).length === 0;
  const showing = !!insights || scoreUnlocked(d, propertyDone);
  useEffect(() => {
    if (!showing) return;
    const from = shownScore;
    const prev = lastShownScore;
    lastShownScore = score;
    // No change, a fall, or reduced motion: just show it. The first showing
    // this session fills from empty, without a gain badge.
    if (reduceMotion || from >= score) { setShownScore(score); return; }
    if (prev !== null) setGain(score - from);
    const start = performance.now(), duration = prev === null ? 1100 : 900;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShownScore(Math.round(from + (score - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const timer = setTimeout(() => setGain(0), 2600);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [score, showing]);

  if (!showing) return <MobileStartHome d={d} m={m} onStartModule={onStartModule}/>;

  // Modules picked at the entry but not answered yet (someone with an old
  // report who has since picked more): kept on home, each dropping off once
  // answered.
  const stillToDo = unfinishedPicks(d, propertyDone);
  // "What to do first", the line under the score and what's on track, all
  // from the code (src/lib/priorities.js).
  const priorities = whatToDoFirst(d, m, statuses);
  const report = { headline: scoreHeadline(priorities), priorities, onTrack: onTrackModules(d, m, statuses) };

  const { color: scoreColor, label: scoreLabel } = scoreBand(score);
  const { modulesWithRec, totalOpp } = getModuleBreakdown(d, m, statuses, null, "amount");
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

      {/* The score: a ring that fills to it, in the score's band colour, and
          the biggest win. Tap to open what to do first in place (Candid's own
          plan, src/lib/priorities.js); each step opens its module. */}
      <div onClick={() => setScoreOpen(o => !o)} style={{background:WHITE,border:"1px solid rgba(22,47,36,0.08)",borderRadius:RADIUS_CARD,padding:"18px",boxShadow:"0 2px 10px rgba(22,47,36,0.05)",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Candid Score</span>
          <ChevronDown size={14} color={MUT} style={{transform:scoreOpen?"rotate(180deg)":"none",transition:"transform 0.2s"}}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"16px",marginTop:"12px"}}>
          <ScoreDonut value={shownScore} color={gain > 0 ? GOLD : scoreColor}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
              <span style={{fontSize:"16px",fontWeight:700,color:TEXT}}>{scoreLabel}</span>
              {gain > 0 && (
                <span style={{fontSize:"12px",fontWeight:700,color:"#8a6a24",background:"rgba(196,150,58,0.18)",borderRadius:"100px",padding:"3px 10px",animation:"badgeFadeUp 2.6s ease forwards",whiteSpace:"nowrap"}}>+{gain} pts</span>
              )}
            </div>
            <p style={{fontSize:"13px",color:MUT,margin:"4px 0 0",lineHeight:1.5}}>{report.headline}</p>
          </div>
        </div>

        {scoreOpen && (
          <div onClick={e => e.stopPropagation()} style={{marginTop:"16px",paddingTop:"14px",borderTop:"1px solid rgba(22,47,36,0.08)",cursor:"default"}}>
            {report.priorities.length > 0 && (<>
              <div style={{fontSize:"10.5px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase"}}>What to do first</div>
              <div style={{display:"flex",flexDirection:"column",marginTop:"6px"}}>
                {report.priorities.map((p, i) => (
                  <button key={p.key} type="button" onClick={() => navigate(`/app/module/${p.key}`)}
                    style={{display:"flex",alignItems:"flex-start",gap:"12px",textAlign:"left",background:"none",border:"none",borderTop:i ? "1px solid rgba(22,47,36,0.06)" : "none",padding:"10px 0",cursor:"pointer",fontFamily:"inherit",width:"100%"}}>
                    <span style={{width:"22px",height:"22px",borderRadius:"50%",background:CDARK,color:G,fontSize:"12px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"1px"}}>{i + 1}</span>
                    <span style={{flex:1,minWidth:0}}>
                      <span style={{display:"block",fontSize:"14px",fontWeight:700,color:TEXT}}>
                        {p.title}
                      </span>
                      {p.line && <span style={{display:"block",fontSize:"12.5px",color:MUT,lineHeight:1.5,marginTop:"2px"}}>{p.line}</span>}
                    </span>
                    <ChevronRight size={15} color={MUT} style={{flexShrink:0,marginTop:"3px"}}/>
                  </button>
                ))}
              </div>
            </>)}
            {report.onTrack.length > 0 && (
              <div style={{marginTop:report.priorities.length ? "10px" : 0}}>
                <div style={{fontSize:"10.5px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase"}}>On track</div>
                <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"6px 0 0"}}>{report.onTrack.join(", ")}.</p>
              </div>
            )}
            <button type="button" onClick={() => navigate("/app/modules")}
              style={{marginTop:"14px",background:"none",border:"none",padding:0,fontSize:"13px",fontWeight:700,color:G,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:"2px"}}>
              Review all modules<ChevronRight size={14}/>
            </button>
          </div>
        )}
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

      {/* Asked once, after the score appears; never blocks anything. */}
      {!d.goalsAsked && <GoalsCard d={d} set={set} onDone={onGoalsDone}/>}

      {stillToDo.length > 0 && (
        <div style={{marginTop:"22px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Still to do</div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px",marginTop:"10px"}}>
            {stillToDo.map(key => <ModuleStartRow key={key} moduleKey={key} onOpen={onStartModule}/>)}
          </div>
        </div>
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
