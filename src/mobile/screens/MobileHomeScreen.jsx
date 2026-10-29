import { useState, useEffect } from "react";
import { useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { scoreBand, G, MUT, SERIF } from "../../design-tokens.js";
import { getModuleBreakdown, calcCandidScore, gainedSoFar } from "../../lib/moduleStatus.js";
import { fmt } from "../../lib/format.js";
import { mobileGreeting } from "../copy.js";
import MobileStartHome from "./MobileStartHome.jsx";
import { unfinishedPicks, scoreUnlocked, notStarted, doneModules, scoredInView, worthALookShown } from "../../lib/appEntry.js";
import { moduleEstimate } from "../../lib/crossModule.js";
import { whatToDoFirst, scoreHeadline, onTrackModules } from "../../lib/priorities.js";
import ModuleStartRow from "../ModuleStartRow.jsx";
import WorthALookTile from "../WorthALookTile.jsx";
import PayCheckCard from "./PayCheckCard.jsx";
import { PaydayCheckCard } from "../PaydayCheck.jsx";
import { hasAccess } from "../../lib/entitlement.js";
import { trapInView, paydayCheckDue } from "../../lib/taxTrap.js";
import HomeHero from "../HomeHero.jsx";
import GettingToKnow from "../GettingToKnow.jsx";
import SinceLastVisit from "../SinceLastVisit.jsx";
import OutsideEvent from "../OutsideEvent.jsx";
import YourYears from "../../components/dashboard/YourYears.jsx";
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

      {/* The hero (HomeHero.jsx): Left on the table and Saved in one card,
          and the areas to explore on a second card behind it. */}
      <HomeHero d={d} totalOpp={totalOpp} saved={gainedSoFar(d).perYear} scoreShown={shownScore} scoreColor={scoreColor} scoreLabel={scoreLabel} gain={gain}
        plan={plan} stepsDone={stepsDone} headline={report.headline} onTrack={report.onTrack} cashBadge={cashBadge} unchecked={unchecked}
        onOpen={key => navigate(key ? `/app/module/${key}` : "/app/modules")}/>

      {/* Each tax year's saved and still open, once anything's been saved
          (YourYears.jsx). */}
      <YourYears d={d}/>

      {/* What the app can do, ticked off as it's done (Phase 6). */}
      <GettingToKnow d={d} set={set} answered={doneModules(d, propertyDone).length}/>

      {/* A Bank Rate decision or a Budget, coming up or just announced. */}
      <OutsideEvent d={d} m={m} approved={approvedEvents}/>

      {/* What's changed since they were last here, when anything has. */}
      <SinceLastVisit d={d} m={m} rows={savingsRates} onOpenCash={() => onStartModule("cash")}/>

      {/* A new tax year: is their pay still the same? */}
      {d.payCheckDue && +d.salary > 0 && <PayCheckCard d={d} set={set}/>}

      {/* Payday, for a subscriber near or over £100k: their pay to date. */}
      {!d.payCheckDue && hasAccess() && d.employmentStatus === "employed" && trapInView(d, m.adjustedNetIncome) && paydayCheckDue(d) && <PaydayCheckCard d={d} m={m} set={set}/>}

      {stillToDo.length > 0 && (
        <div data-tour="home-modules" style={{marginTop:"22px"}}>
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
