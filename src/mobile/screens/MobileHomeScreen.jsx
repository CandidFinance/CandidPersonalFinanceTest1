import { useState, useEffect } from "react";
import { useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Check, Lock } from "lucide-react";
import { isLocked } from "../../lib/unlock.js";
import ScoreDonut from "../ScoreDonut.jsx";
import { HERO_TILE_BG, scoreBand, G, GOLD, WHITE, MUT, TEXT, SERIF, SUCCESS, RADIUS_CARD } from "../../design-tokens.js";
import { getModuleBreakdown, calcCandidScore } from "../../lib/moduleStatus.js";
import { fmt } from "../../lib/format.js";
import { mobileGreeting } from "../copy.js";
import MobileStartHome from "./MobileStartHome.jsx";
import { unfinishedPicks, scoreUnlocked, notStarted, doneModules, scoredInView, worthALookShown } from "../../lib/appEntry.js";
import { moduleEstimate } from "../../lib/crossModule.js";
import { whatToDoFirst, scoreHeadline, onTrackModules } from "../../lib/priorities.js";
import ModuleStartRow from "../ModuleStartRow.jsx";
import WorthALookTile from "../WorthALookTile.jsx";
import PayCheckCard from "./PayCheckCard.jsx";
import GainedFromChanges from "../GainedFromChanges.jsx";
import GettingToKnow from "../GettingToKnow.jsx";
import SinceLastVisit from "../SinceLastVisit.jsx";
import OutsideEvent from "../OutsideEvent.jsx";
import NewBadge, { rateUpdatesLabel } from "../NewBadge.jsx";
import { useCashNews } from "../visitNews.js";
import { readinessMissing } from "../../lib/propertyReadiness.js";

// Mobile Home screen — matches the "Claude Design" mockup's Overview tab
// (score progress bar, Opportunity pill, expandable Net Worth card, Biggest
// Win card), rebuilt against real app data instead of the mockup's sample
// numbers. Score labels/colors reuse scoreBand (design-tokens.js) rather
// than the mockup's own wording, so the score reads identically everywhere in the app. Icons
// stay lucide-react (CLAUDE.md rule 2) rather than the mockup's hand-drawn
// SVGs.

// The score last shown on Home this session. Home unmounts whenever you open
// a module, so this is what lets it animate from the old score to the new one
// when you come back after reviewing a module. Not persisted: a fresh page
// load just shows the score with no animation.
let lastShownScore = null;

// The score shows once every module picked at the entry is answered
// (scoreUnlocked), or for a user with an old report; until then, the modules
// to start with (MobileStartHome). Everything here is worked out by the
// code: no AI report (docs/score-without-ai-plan.md). No goals question and
// no net worth here: Goals and Forecast hold those.
export default function MobileHomeScreen({ insights, d, m, statuses, completedModules, onStartModule, set, savingsRates = null, approvedEvents = null }) {
  const navigate = useNavigate();
  // The score tile opens in place to show what to do first.
  const [scoreOpen, setScoreOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  // Best rates moved for them since the last visit: a red badge on the Cash
  // row (and on the list while it's closed) until they open Cash.
  const news = useCashNews();
  const cashBadge = news && !news.opened ? news.count : 0;

  // Computed live from `statuses` (see calcCandidScore) rather than read from
  // insights.score — reacts instantly and for free to any change in `d`, from
  // the full "Edit inputs" wizard or a per-recommendation quick-update alike.
  // The count-up/gain-badge animation below still fires correctly: it just
  // reacts to `score` changing, whatever the reason.
  const score = calcCandidScore(statuses);

  // The ring fills from empty to the score the first time Home shows it in a
  // session. After that, a gain counts up from the previous score, the ring
  // turning gold while it fills, with a "+N pts" badge. No animation for
  // reduced motion. Hooks sit above the early return.
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

  if (!showing) return <MobileStartHome d={d} m={m} set={set} onStartModule={onStartModule}/>;

  // Modules picked at the entry but not answered yet (someone with an old
  // report who has since picked more): kept on home, each dropping off once
  // answered.
  const stillToDo = unfinishedPicks(d, propertyDone);
  // Modules they didn't pick and haven't started, each with a rough £ from
  // what they've answered so far, largest first (by £, not an order to
  // follow): what draws someone on from the one module they came for.
  const worthALook = notStarted(d, propertyDone)
    .filter(k => k !== "property" && !stillToDo.includes(k))
    .map(k => ({ key: k, estimate: moduleEstimate(k, d, m) }))
    .sort((a, b) => (b.estimate?.high ?? -1) - (a.estimate?.high ?? -1));
  // "What to do first", the line under the score and what's on track, all
  // from the code (src/lib/priorities.js).
  const priorities = whatToDoFirst(d, m, statuses);
  const report = { headline: scoreHeadline(priorities), priorities, onTrack: onTrackModules(d, m, statuses) };

  const { color: scoreColor, label: scoreLabel } = scoreBand(score);
  // The opportunities by size, each marked once its module has been reviewed.
  const plan = priorities.map(p => ({ ...p, done: (completedModules || []).includes(p.key) }));
  const stepsDone = plan.filter(p => p.done).length;
  const { totalOpp } = getModuleBreakdown(d, m, statuses, null, "amount");
  // How much of the picture the score covers: a high score from one module
  // answered mustn't read as everything being fine.
  // The £100k tax trap counts only for someone near or over £100,000.
  const scored = scoredInView(d);
  const checked = doneModules(d, propertyDone).filter(k => scored.includes(k)).length;
  const unchecked = scored.length - checked;

  return (
    <div>
      <h1 style={{fontFamily:SERIF,fontSize:"22px",color:G,fontWeight:700,marginBottom:"16px",lineHeight:1.2}}>
        {mobileGreeting(d)}
      </h1>

      {/* What the app can do, ticked off as it's done (Phase 6). */}
      <GettingToKnow d={d} set={set} answered={doneModules(d, propertyDone).length}/>

      {/* A Bank Rate decision or a Budget, coming up or just announced. */}
      <OutsideEvent d={d} m={m} approved={approvedEvents}/>

      {/* What's changed since they were last here, when anything has. */}
      <SinceLastVisit d={d} m={m} rows={savingsRates} onOpenCash={() => onStartModule("cash")}/>

      {/* The hero: the score, in a pale iridescent wash (HERO_TILE_BG) that
          only it and "Gains" wear, so they read as the
          headlines.
          The ring in the score's band colour, the opportunity, and the
          opportunities by size opening in place. Nothing says where to start:
          that would be advice (src/lib/priorities.js only ranks by £). */}
      <div style={{background:HERO_TILE_BG,border:"1px solid rgba(22,47,36,0.08)",borderRadius:RADIUS_CARD,padding:"20px 18px 16px",boxShadow:"0 4px 18px rgba(22,47,36,0.07)"}}>
        {/* The £ at stake leads (what people care about); the score's ring
            beside it shows how far along they are. */}
        <div style={{display:"flex",alignItems:"flex-start",gap:"16px"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Left on the table/yr</div>
            <div style={{fontFamily:SERIF,fontSize:"var(--hero-figure, 38px)",fontWeight:700,color:G,lineHeight:1.1,marginTop:"6px"}}>{fmt(totalOpp)}</div>
            <p style={{fontSize:"13px",color:MUT,lineHeight:1.45,margin:"6px 0 0"}}>
              {totalOpp > 0 ? "Your money left on the table each year, across what you've answered."
                : unchecked > 0 ? `Nothing left on the table in what you've checked so far. ${unchecked} more ${unchecked === 1 ? "area" : "areas"} to check below.`
                : "Nothing left on the table in what you've answered."}
            </p>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
            <ScoreDonut value={shownScore} color={gain > 0 ? GOLD : scoreColor} size={92} stroke={8} track="rgba(22,47,36,0.08)"/>
            <div style={{fontSize:"10px",fontWeight:600,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:"8px"}}>Candid score</div>
            <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"2px"}}>
              <span style={{fontSize:"12.5px",fontWeight:700,color:TEXT}}>{scoreLabel}</span>
              {gain > 0 && (
                <span style={{fontSize:"11px",fontWeight:700,color:"#8a6a24",background:"rgba(196,150,58,0.18)",borderRadius:"100px",padding:"2px 8px",animation:"badgeFadeUp 2.6s ease forwards",whiteSpace:"nowrap"}}>+{gain}</span>
              )}
            </div>
          </div>
        </div>

        {/* The opportunities, largest first, and how many have been reviewed. */}
        <button type="button" onClick={() => setScoreOpen(o => !o)}
          style={{marginTop:"16px",width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"none",border:"none",borderTop:"1px solid rgba(22,47,36,0.08)",padding:"12px 0 0",color:TEXT,fontFamily:"inherit",cursor:"pointer"}}>
          <span style={{fontSize:"13.5px",fontWeight:700}}>
            {plan.length > 0 ? <>Money left on the table <span style={{fontWeight:500,color:MUT}}>· {stepsDone} of {plan.length} reviewed</span></> : "Your modules"}
          </span>
          <span style={{display:"flex",alignItems:"center",gap:"8px"}}>
            {!scoreOpen && cashBadge > 0 && <NewBadge inline count={cashBadge} label={rateUpdatesLabel(cashBadge)}/>}
            <ChevronDown size={16} color={MUT} style={{transform:scoreOpen?"rotate(180deg)":"none",transition:"transform 0.2s"}}/>
          </span>
        </button>
        {scoreOpen && (
          <div style={{marginTop:"4px"}}>
            {plan.length > 0 ? (
              <div style={{display:"flex",flexDirection:"column"}}>
                {plan.map((p, i) => (
                  <button key={p.key} type="button" onClick={() => navigate(`/app/module/${p.key}`)}
                    style={{display:"flex",alignItems:"flex-start",gap:"12px",textAlign:"left",background:"none",border:"none",borderTop:i ? "1px solid rgba(22,47,36,0.06)" : "none",padding:"10px 0",cursor:"pointer",fontFamily:"inherit",width:"100%"}}>
                    {/* Reviewed: a tick. Not yet: an empty ring. No numbers,
                        so the list doesn't read as an order to follow. */}
                    <span style={{width:"20px",height:"20px",borderRadius:"50%",border:p.done ? "none" : "1.5px solid rgba(22,47,36,0.25)",background:p.done ? G : "transparent",color:WHITE,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"1px",boxSizing:"border-box"}}>
                      {p.done && <Check size={12} strokeWidth={3}/>}
                    </span>
                    <span style={{flex:1,minWidth:0}}>
                      <span style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"14px",fontWeight:700,color:TEXT}}>
                        {p.title}
                        {p.key === "cash" && cashBadge > 0 && <NewBadge inline count={cashBadge} label={rateUpdatesLabel(cashBadge)}/>}
                      </span>
                      {isLocked(d, p.key)
                        ? <span style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"12.5px",color:MUT,lineHeight:1.5,marginTop:"2px"}}><Lock size={12}/>{fmt(p.amount)}{p.amountIsLumpSum ? " by 18" : " a year"}. Unlock to see how</span>
                        : p.line && <span style={{display:"block",fontSize:"12.5px",color:MUT,lineHeight:1.5,marginTop:"2px"}}>{p.line}</span>}
                    </span>
                    <ChevronRight size={15} color={MUT} style={{flexShrink:0,marginTop:"3px"}}/>
                  </button>
                ))}
              </div>
            ) : (
              <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,margin:"4px 0 0"}}>{report.headline}</p>
            )}
            {report.onTrack.length > 0 && (
              <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>
                <span style={{fontWeight:700,color:TEXT}}>On track:</span> {report.onTrack.join(", ")}.
              </p>
            )}
            <button type="button" onClick={() => navigate("/app/modules")}
              style={{marginTop:"12px",background:"none",border:"none",padding:0,fontSize:"13px",fontWeight:700,color:G,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:"2px"}}>
              All modules<ChevronRight size={14}/>
            </button>
          </div>
        )}
      </div>

      {/* What the changes the user says they've made are worth, and the pot
          they've added up to (GainedFromChanges.jsx). */}
      <GainedFromChanges d={d} options={plan.filter(p => p.amount > 0)} atStake={totalOpp}
        onOpen={key => navigate(key ? `/app/module/${key}` : "/app/modules")}/>

      {/* A new tax year: is their pay still the same? */}
      {d.payCheckDue && +d.salary > 0 && <PayCheckCard d={d} set={set}/>}

      {stillToDo.length > 0 && (
        <div style={{marginTop:"22px"}}>
          <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Still to do</div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px",marginTop:"10px"}}>
            {stillToDo.map(key => <ModuleStartRow key={key} moduleKey={key} d={d} estimate={moduleEstimate(key, d, m)} onOpen={onStartModule}/>)}
          </div>
        </div>
      )}

      {/* Dismissed with its X or a swipe, until a module it didn't hold
          appears (appEntry.js worthALookShown). */}
      {worthALook.length > 0 && worthALookShown(d, worthALook.map(w => w.key)) && (
        <WorthALookTile items={worthALook} d={d} onOpen={onStartModule} onSeeAll={() => navigate("/app/modules")}
          onDismiss={() => set("worthALookDismissed", worthALook.map(w => w.key))}/>
      )}

    </div>
  );
}
