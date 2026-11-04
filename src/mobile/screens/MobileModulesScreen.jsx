import { useState, useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { childcareSupport } from "../../lib/childcare.js";
import { Users, ChevronRight, Lock, X, TriangleAlert, Star } from "lucide-react";
import { FrontCard, StillCard } from "../CardStack.jsx";
import AlertBox from "../AlertBox.jsx";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, SANS, RADIUS_CARD, SR_ONLY, HAIRLINE, ROW_TILE, SUCCESS, CRITICAL, WARNING_TEXT, HERO_TILE_BG_GREEN } from "../../design-tokens.js";
import { getModuleBreakdown, MODULE_META, reviewedDone } from "../../lib/moduleStatus.js";
import { calcStudentLoanScenario } from "../../lib/studentLoan.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import { statusLabel, ELSEWHERE } from "../statusLabel.js";
import { notStarted, dormantModules, moduleOrder, isNewModule, MODULE_PITCH, MODULE_EXPLAINER, MODULE_DORMANT_LINE } from "../../lib/appEntry.js";
import { taxTrap, thisTaxYear } from "../../lib/taxTrap.js";
import { ROW_TITLE, ROW_ICON, moduleMeta, estimateText } from "../ModuleStartRow.jsx";
import { kicker } from "../../components/dashboard/ProgressParts.jsx";
import BankConfirm from "../BankConfirm.jsx";
import NewBadge, { rateUpdatesLabel } from "../NewBadge.jsx";
import { useCashNews } from "../visitNews.js";
import { moduleEstimate } from "../../lib/crossModule.js";
import { isLocked } from "../../lib/unlock.js";
import { readinessMissing } from "../../lib/propertyReadiness.js";

// Mobile Modules screen. One card at the top: the summary to start (£ at
// stake, saved, and how many are live, not started and need action), or the
// module picked in the grid of tiles below it (tapping that tile again, or
// the card's close button, goes back). Every card takes the tallest one's
// height, so the tiles never move. A module with answers logged has its tile
// in colour (pale green once on track) and its card with its figures; one
// not yet explored is muted, its card saying what it covers and what it can
// show, with the way in. Then Coming soon. Mark as reviewed lives in each
// module (MobileModuleDeepDive).

// Two label/value insight tiles per module, reusing figures already computed
// elsewhere (mm.amount, m.isaHeadroom, m.missedMatch, m.projectedPot) rather
// than re-deriving anything — calcStudentLoanScenario is the one exception,
// needed for its clear-year projection and already the single source of
// truth for that (shared with computeModuleStatuses).
// `perYear`: the £ a year a row states, so a row that only repeats the
// card's figure is left out. `hero`: the row can lead an on-track card with
// nothing at stake, in place of "On track" in words (the tick says that).
function moduleInsights(mm, d, m) {
  switch (mm.key) {
    case "cash":
      return [{ label: "ISA allowance left", value: fmt(m.isaHeadroom), hero: m.isaHeadroom > 0 }];
    case "investments":
      return [
        { label: "ISA allowance left", value: fmt(m.isaHeadroom), hero: m.isaHeadroom > 0 },
        { label: "Unwrapped investments", value: fmt(+d.unwrappedValue||0) },
      ];
    case "pension":
      return [
        { label: "Employer match gap", value: m.missedMatch > 0 ? `${fmtCompact(m.missedMatch)}/yr` : "None", perYear: m.missedMatch },
        { label: "Projected pot at retirement", value: fmt(m.projectedPot), hero: m.projectedPot > 0 },
      ];
    case "studentLoan": {
      if (d.studentLoan === "none") return [];
      const sl = calcStudentLoanScenario(d, m);
      return [
        { label: "Paying off now", value: sl.overpayAnnualBenefit > 0 ? `${fmtCompact(sl.overpayAnnualBenefit)}/yr` : "Not worth it", perYear: sl.overpayAnnualBenefit },
        { label: "Projected clear year", value: sl.willClear ? String(new Date().getFullYear() + sl.clearYr) : "Written off", hero: sl.willClear },
      ];
    }
    case "kids": {
      const year = thisTaxYear(d, m);
      const cc = childcareSupport(year.d, year.m);
      if (!cc) return [];
      return [
        { label: "Childcare support", value: `${fmtCompact(cc.atStake)}/yr`, perYear: cc.atStake, hero: cc.atStake > 0 },
        { label: "£100,000 limit", value: cc.state === "near" || cc.state === "fine" ? `${fmtCompact(cc.headroom)} under` : cc.state === "lost" ? "Over" : cc.state === "partner" ? "Partner over" : "Not working" },
      ];
    }
    case "taxTrap": {
      const year = thisTaxYear(d, m);
      const t = taxTrap(year.d, year.m);
      if (!t) return [];
      return [
        { label: t.over ? "Marginal tax rate" : "Marginal tax rate past £100k", value: `${Math.round((t.over ? t.rate.rate : t.trapRate) * 1000) / 10}%` },
        { label: "£100k limit", value: t.over ? `${fmtCompact(t.needed)} over` : `${fmtCompact(t.headroom)} under` },
      ];
    }
    default:
      return [];
  }
}

// Coming soon: a tile, its heading inside, then hairline rows. The heading and its padding as on Home's and Progress's
// tiles (ProgressParts.jsx Tile): small caps label, top left.
const TILE = { ...ROW_TILE, padding:"16px 14px 4px", marginTop:"22px" };
const SECTION = { ...kicker, marginBottom:"12px" };
const ROWS = { display:"flex", flexDirection:"column" };
const ROW = { display:"flex", alignItems:"flex-start", gap:"14px", width:"100%", textAlign:"left", background:"none", border:"none", borderTop:HAIRLINE, padding:"14px 0", fontFamily:"inherit" };
// The module tiles: two across on a phone, three from a tablet up.
const GRID_CSS = `
.modules-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 22px; }
@media (min-width: 640px) { .modules-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
`;

// A big figure on a card: £ in the serif, with its unit after in sans.
function Figure({ t, value, unit, words = false }) {
  return (
    <div style={{fontFamily:SERIF,fontSize:words ? "34px" : "var(--hero-fig)",fontWeight:700,color:t.figure,lineHeight:1.05,letterSpacing:"-0.01em",marginTop:"8px"}}>
      {value}{unit && <span style={{fontFamily:SANS,fontSize:words ? "15px" : "0.32em",fontWeight:600,marginLeft:"5px",letterSpacing:0}}>{unit}</span>}
    </div>
  );
}

function OpenButton({ t, title, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{margin:"auto 0 -6px",alignSelf:"flex-start",background:"none",border:"none",padding:"18px 0 12px",fontSize:"13px",fontWeight:700,color:t.figure,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:"2px"}}>
      Open {title}<ChevronRight size={14}/>
    </button>
  );
}

// Modules not yet built for anyone (hidden app-wide behind HIDE_MVP_MODULES,
// not just on mobile) — shown here as locked teasers so the roadmap is
// visible, rather than looking like the app only ever covers 4 areas.
// Icons/keys come from the shared MODULE_META; title/description here are
// this teaser's own copy, not MODULE_META's (which is written for the real,
// unlocked module elsewhere). An entry with no MODULE_META counterpart
// (e.g. household) supplies its own `icon`.
// The old "Mortgages" teaser is now the open Property entry above these
// (Property absorbs mortgages).
const LOCKED_MODULES = [
  { key:"household", title:"Household finances", icon:Users, description:"Two people, one plan. Marriage or a civil partnership changes the picture, from shared allowances to how you hold savings and investments." },
];

export default function MobileModulesScreen({ d, m, set, statuses, insights, completedModules, onOpenModule, onOpenProperty }) {
  // Best rates moved for them since the last visit: a red badge on the Cash
  // card until they open Cash (visitNews.js).
  const news = useCashNews();
  const cashBadge = news && !news.opened ? news.count : 0;
  // Largest £ first (src/lib/priorities.js only ranks by £).
  const { moduleList, totalOpp, totalBanked } = getModuleBreakdown(d, m, statuses, insights, "amount");
  // Counted from the tiles' own labels, so "N need action" always tallies
  // with the tiles reading "Action needed" (reviewed with under £50 left
  // reads on track: reviewedDone).
  const needActionCount = moduleList.filter(mm => !reviewedDone(mm, completedModules.includes(mm.key)) && statusLabel(mm) === "Action needed").length;
  // Property waits with the rest until its questions are done, then joins
  // the live modules (no £ yet: no rent vs buy engine, so not ranked).
  const propertyDone = readinessMissing(d, m).length === 0;
  const waiting = notStarted(d, propertyDone);
  const openRow = key => key === "property" ? onOpenProperty() : onOpenModule(key);
  // Not open to them yet (the £100k tax trap under £90,000): greyed, after
  // the rest, so they know it's there.
  const dormant = dormantModules(d);
  const live = moduleList.length + (propertyDone ? 1 : 0);
  const toExplore = waiting.length + dormant.length;
  const isReviewed = mm => completedModules.includes(mm.key);
  // On track (moduleStatus.js isOnTrack), or reviewed with under £50 left
  // (reviewedDone): its tile gets the tick.
  const isOptimised = mm => mm.onTrack || reviewedDone(mm, isReviewed(mm));

  // The top card: the summary, or a live module's card.
  const moduleCard = mm => {
    const onTrack = isOptimised(mm);
    const hasRec = mm.amount > 0;
    const locked = isLocked(d, mm.key);
    // On track with something saved: what was saved leads.
    const savedLead = !hasRec && onTrack && mm.banked > 0;
    // `lead`: a figure of its own where there's no £ at stake (the £100k tax
    // trap under £100k: how far from it).
    const lead = !hasRec && !locked ? mm.lead : null;
    const all = locked ? [] : moduleInsights(mm, d, m);
    // On track with nothing at stake or saved: its own figure leads, not
    // "On track" in words.
    const hero = onTrack && !hasRec && !savedLead && !lead && !mm.elsewhere ? all.find(x => x.hero) : null;
    // Its rows, less the one leading and any that only repeat the figure.
    const ins = all.filter(x => x !== hero && !(hasRec && x.perYear > 0 && fmtCompact(x.perYear) === fmtCompact(mm.amount)));
    const figure = hasRec ? fmt(mm.amount) : lead ? lead.value : savedLead ? fmt(mm.banked) : hero ? hero.value : mm.elsewhere ? ELSEWHERE[mm.elsewhere].figure : statusLabel({ ...mm, onTrack });
    const unit = hasRec ? (mm.amountIsLumpSum ? "by 18" : "a year") : lead ? lead.unit : savedLead ? "a year saved" : null;
    // Red or amber (the £100k tax trap): the wash and icon behind; in front,
    // the figure in an alert, as Progress's Tax shield has it.
    const warn = !locked && !onTrack ? mm.warn : null;
    // The status shows once (the tick, the alert, or the figure in words),
    // so the line under the figure says what the figure is. Not what's been
    // saved: an allowance back each tax year can show the same £ saved and
    // at stake, which reads as a contradiction; the summary card has it.
    // Under the status in words, only its reason.
    const line = hasRec ? "At stake"
      : lead ? (warn && mm.alertTitle ? null : statusLabel({ ...mm, onTrack }))
      : savedLead ? null
      : hero ? hero.label
      : mm.elsewhere ? statusLabel(mm)
      : mm.reason || null;
    const head = (t, words) => (
      <>
        <Figure t={t} value={figure} unit={unit} words={words}/>
        {line && <p style={{fontSize:"13px",color:t.body,lineHeight:1.45,margin:"8px 0 0"}}>{line}</p>}
      </>
    );
    return {
      key: mm.key, label: mm.title, done: onTrack, warn,
      // The top line, seen while the card is behind; the tick says on track.
      amount: hasRec ? `${fmtCompact(mm.amount)}${mm.amountIsLumpSum ? " by 18" : "/yr"}` : lead ? lead.short : savedLead ? `${fmtCompact(mm.banked)}/yr saved`
        : onTrack ? "" : mm.elsewhere ? ELSEWHERE[mm.elsewhere].figure : statusLabel(mm),
      amountSans: !hasRec && !lead,
      body: t => (
        <>
          {warn && mm.alertTitle
            ? <AlertBox tone={warn} t={t} title={mm.alertTitle}>{head(t, false)}</AlertBox>
            : head(t, !hasRec && !savedLead && !lead && !hero)}
          {/* A locked answer (src/lib/unlock.js) stays hidden here too. */}
          {locked ? (
            <p style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"13px",color:t.body,lineHeight:1.5,margin:"12px 0 0"}}><Lock size={13}/>Your position is ready. Open it to unlock it.</p>
          ) : ins.length > 0 && (
            <dl style={{margin:"12px 0 0"}}>
              {ins.map(x => (
                <div key={x.label} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:"12px",padding:"8px 0",borderTop:`1px solid ${t.rule}`}}>
                  <dt style={{fontSize:"13px",color:t.body}}>{x.label}</dt>
                  <dd style={{margin:0,fontSize:"14px",fontWeight:700,color:t.figure,textAlign:"right"}}>{x.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <OpenButton t={t} title={mm.title} onClick={() => onOpenModule(mm.key)}/>
        </>
      ),
    };
  };
  // At stake leads; a bar splits what's been found into saved and still at
  // stake, as on Home; then the counts.
  const found = totalBanked + totalOpp;
  const summary = {
    key: "summary", label: "Your modules", amount: totalOpp > 0 ? `${fmtCompact(totalOpp)}/yr` : "",
    body: t => (
      <>
        <Figure t={t} value={fmt(totalOpp)} unit="a year"/>
        <p style={{fontSize:"13px",color:t.body,lineHeight:1.45,margin:"8px 0 0"}}>{totalOpp > 0 ? "At stake across your live modules." : "Nothing at stake across your live modules."}</p>
        {totalBanked > 0 && (
          <div style={{marginTop:"18px"}}>
            <div style={{display:"flex",alignItems:"baseline",gap:"6px"}}>
              <span style={{fontFamily:SERIF,fontSize:"30px",fontWeight:700,lineHeight:1,color:t.figure}}>{fmt(totalBanked)}</span>
              <span style={{fontSize:"13px",fontWeight:600,color:t.figure}}>a year saved</span>
            </div>
            <div style={{height:"8px",borderRadius:"4px",display:"flex",overflow:"hidden",background:t.track,marginTop:"10px"}}>
              <div style={{width:`${totalBanked / found * 100}%`,background:GOLD}}/>
            </div>
            <div style={{fontSize:"12px",color:t.body,marginTop:"6px"}}>From changes made so far</div>
          </div>
        )}
        {/* The counts in a line, kept small so the figures above lead. */}
        <p style={{fontSize:"13px",color:t.body,lineHeight:1.5,margin:"auto 0 0",paddingTop:"10px",borderTop:`1px solid ${t.rule}`}}>
          {[[live, "live"], [toExplore, "not started"], [needActionCount, "needing action"]].map(([n, l], i) => (
            <span key={l}>{i ? ", " : ""}<b style={{fontWeight:700,color:t.figure}}>{n}</b> {l}</span>
          ))}
        </p>
      </>
    ),
  };
  // Property: no £ yet (no rent vs buy engine), so it goes after the rest.
  const propertyCard = {
    key: "property", label: "Property", amount: "Ready", amountSans: true,
    body: t => (
      <>
        <p style={{fontSize:"13px",color:t.body,lineHeight:1.5,margin:"10px 0 0"}}>{MODULE_PITCH.property}</p>
        <OpenButton t={t} title="Property" onClick={onOpenProperty}/>
      </>
    ),
  };
  // The grid's tiles: every module offered, picks first, then any not open
  // to them yet. A fixed order (not by £), so a module is always where they
  // last found it.
  const keys = [...moduleOrder(d), ...dormant];
  const liveByKey = Object.fromEntries(moduleList.map(mm => [mm.key, mm]));
  // Each tile's state. Live: answers logged (and Property's questions done),
  // the tile in colour. The rest stay muted: not explored, not applicable
  // (answered, but nothing in it applies), or not open yet.
  const stateOf = key => key === "overview" ? "overview"
    : dormant.includes(key) ? "dormant"
    : liveByKey[key] || (key === "property" && propertyDone) ? "live"
    : statuses[key]?.notApplicable ? "na"
    : "unexplored";

  // The card on top: the overview, or the module whose tile was tapped.
  // Tapping that tile again, or the card's close button, goes back.
  const [selected, setSelected] = useState("overview");
  const sel = keys.includes(selected) ? selected : "overview";
  // A module that drops out of view clears the pick, so it doesn't come
  // back picked if it returns.
  useEffect(() => { if (selected !== sel) setSelected(sel); }, [selected, sel]);
  // On a phone the card can be scrolled out of view by the time a tile
  // further down is tapped: bring it back so they see it change.
  const reduceMotion = useReducedMotion();
  const cardRef = useRef(null);
  const picked = useRef(false);
  useEffect(() => {
    if (!picked.current) return;
    const el = cardRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  }, [sel, reduceMotion]);
  const pick = key => { picked.current = true; setSelected(key === sel ? "overview" : key); };

  const cardFor = (key, on) => {
    const state = stateOf(key);
    if (state === "overview") return live > 0
      ? <FrontCard fill on={on} label="Your modules" body={summary.body}/>
      // Before any module's answered: the summary card greyed, its figure
      // blank. No counts: they'd all be 0 bar Not started, which the muted
      // tiles below already show.
      : <StillCard fill label="Your modules" body={t => (
          <>
            <div style={{fontFamily:SERIF,fontSize:"var(--hero-fig)",fontWeight:700,color:MUT,opacity:0.5,lineHeight:1,marginTop:"8px"}}>£–</div>
            <p style={{fontSize:"13px",color:t.body,lineHeight:1.45,margin:"8px 0 0"}}>What's at stake shows here once a module is answered.</p>
          </>
        )}/>;
    const mm = moduleMeta(key);
    if (state === "live") {
      const c = key === "property" ? propertyCard : moduleCard(liveByKey[key]);
      // The Cash rate news badge stays on its tile only.
      return <FrontCard fill on={on} label={c.label} body={c.body}/>;
    }
    if (state === "dormant") return (
      <StillCard fill label={mm.title} body={t => (
        <p style={{fontSize:"13px",color:t.body,lineHeight:1.5,margin:"10px 0 0"}}>{MODULE_DORMANT_LINE[key]}</p>
      )}/>
    );
    if (state === "na") return (
      <StillCard fill label={mm.title} body={t => (
        <>
          <Figure t={{...t,figure:MUT}} value="Not applicable" words/>
          {statuses[key]?.impactLabel && <p style={{fontSize:"13px",color:t.body,lineHeight:1.45,margin:"8px 0 0"}}>{statuses[key].impactLabel}</p>}
          <OpenButton t={t} title={mm.title} onClick={() => onOpenModule(key)}/>
        </>
      )}/>
    );
    // Not explored yet: the card empty and muted, the way into its
    // walk-through beside the blank figure (below it if there's no room),
    // then what the module looks at and what it can show.
    const estimate = key === "property" ? null : moduleEstimate(key, d, m);
    const ex = MODULE_EXPLAINER[key];
    return (
      <StillCard fill label={mm.title} body={t => (
        <>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"10px 12px",marginTop:"8px"}}>
            <div style={{fontFamily:SERIF,fontSize:estimate ? "34px" : "var(--hero-fig)",fontWeight:700,color:MUT,opacity:estimate ? 0.8 : 0.5,lineHeight:1.05}}>{estimate ? estimateText(estimate) : "£–"}</div>
            <button type="button" onClick={() => openRow(key)} aria-label={`Explore ${mm.title}`}
              style={{display:"inline-flex",alignItems:"center",gap:"4px",background:G,color:WHITE,border:"none",borderRadius:"999px",padding:"11px 16px 11px 18px",fontSize:"14px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
              Explore<ChevronRight size={15}/>
            </button>
          </div>
          {estimate && <p style={{fontSize:"13px",color:t.body,lineHeight:1.45,margin:"8px 0 0"}}>Estimate: {estimate.line.charAt(0).toLowerCase() + estimate.line.slice(1)}</p>}
          {ex && (
            <dl style={{margin:"12px 0 0"}}>
              {[["What it covers", ex.covers], ["What it can show", ex.shows]].map(([l, v]) => (
                <div key={l} style={{padding:"10px 0 0",marginTop:l === "What it covers" ? 0 : "10px",borderTop:`1px solid ${t.rule}`}}>
                  <dt style={{fontSize:"12px",fontWeight:700,color:G}}>{l}</dt>
                  <dd style={{margin:"3px 0 0",fontSize:"13px",color:t.body,lineHeight:1.5}}>{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}/>
    );
  };

  // One indicator a tile at most: the pale green fill (on track, or reviewed
  // with under £50 left, as the old wallet's cards), the warning icon (the
  // £100k tax trap), or the £ at stake.
  const indicator = key => {
    const mm = liveByKey[key];
    if (!mm || isOptimised(mm) || isLocked(d, key)) return null;
    if (mm.warn) return <TriangleAlert size={15} strokeWidth={2.4} color={mm.warn === "red" ? CRITICAL : WARNING_TEXT} role="img" aria-label={statusLabel(mm)}/>;
    if (mm.amount > 0) return <span style={{fontFamily:SERIF,fontSize:"13px",fontWeight:700,color:G,whiteSpace:"nowrap"}}>{fmtCompact(mm.amount)}{mm.amountIsLumpSum ? "" : "/yr"}</span>;
    return null;
  };

  return (
    <div>
      <style>{GRID_CSS}</style>
      <h1 style={SR_ONLY}>Modules</h1>
      <section aria-label="Selected module" data-tour="modules-cards" ref={cardRef} style={{scrollMarginTop:"16px"}}>
        {/* Every card in one grid cell, only the picked one showing, so the
            card is always as tall as the tallest and the tiles below never
            move. A hidden card is out of reach (no tabbing or tapping onto it, even
            while it fades). */}
        <div style={{display:"grid",position:"relative"}}>
          {["overview", ...keys].map(key => {
            const on = key === sel;
            return (
              <div key={key} aria-hidden={!on} style={{gridArea:"1 / 1",zIndex:on ? 1 : 0,pointerEvents:on ? "auto" : "none",opacity:on ? 1 : 0,visibility:on ? "visible" : "hidden",
                transition:reduceMotion ? "none" : on ? "opacity 0.25s ease" : "opacity 0.25s ease, visibility 0s linear 0.25s"}}>
                {cardFor(key, on)}
              </div>
            );
          })}
          {sel !== "overview" && (
            <button type="button" onClick={() => setSelected("overview")} aria-label="Back to the overview" className="tap44"
              style={{position:"absolute",top:"10px",right:"10px",zIndex:2,width:"30px",height:"30px",borderRadius:"50%",border:"none",display:"grid",placeItems:"center",cursor:"pointer",padding:0,
                background:stateOf(sel) === "live" ? "rgba(255,255,255,0.12)" : "rgba(22,47,36,0.07)"}}>
              <X size={16} strokeWidth={2.2} color={stateOf(sel) === "live" ? WHITE : G}/>
            </button>
          )}
        </div>
        {/* "Did you make the change?", whichever card is up, so the tiles
            don't move as one's picked. */}
        {set && (
          <div style={{marginTop:"16px"}}>
            {moduleList.map(mm => <BankConfirm key={mm.key} d={d} set={set} moduleKey={mm.key} title={mm.title} amount={mm.amount}/>)}
          </div>
        )}
      </section>

      {/* Every module as a tile: tapping one shows its card above. */}
      <section aria-label="Modules" className="modules-grid">
        {keys.map(key => {
          const state = stateOf(key);
          const mm = moduleMeta(key);
          const muted = state !== "live";
          const done = state === "live" && liveByKey[key] && isOptimised(liveByKey[key]);
          const on = key === sel;
          return (
            <button key={key} type="button" onClick={() => pick(key)} aria-pressed={on}
              style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"10px",minHeight:"112px",padding:"18px 12px 14px",textAlign:"center",fontFamily:"inherit",cursor:"pointer",
                borderRadius:RADIUS_CARD,background:done ? HERO_TILE_BG_GREEN : muted ? "rgba(22,47,36,0.04)" : WHITE,
                border:`1px solid ${done ? "rgba(47,148,97,0.45)" : muted ? "transparent" : "rgba(22,47,36,0.08)"}`,
                boxShadow:on ? `inset 0 0 0 2px ${G}` : "none",transition:"box-shadow 0.2s, background-color 0.2s"}}>
              <span style={{position:"absolute",top:"10px",right:"10px",display:"inline-flex",alignItems:"center",gap:"6px"}}>
                {key === "cash" && state === "live" && cashBadge > 0 && <NewBadge inline count={cashBadge} label={rateUpdatesLabel(cashBadge)}/>}
                {state === "dormant" ? <Lock size={14} color={MUT} role="img" aria-label="Not open yet"/> : indicator(key)}
              </span>
              <span style={{position:"relative",display:"flex",opacity:muted ? 0.55 : 1}}>
                <mm.icon size={34} strokeWidth={1.5} color={muted ? MUT : done ? SUCCESS : G}/>
                {isNewModule(key) && (
                  <span role="img" aria-label="New" style={{position:"absolute",top:"-5px",right:"-9px",display:"flex"}}>
                    <Star size={10} color={GOLD} fill={GOLD} strokeWidth={2}/>
                  </span>
                )}
              </span>
              <span style={{fontSize:"14px",fontWeight:600,lineHeight:1.3,color:muted ? MUT : TEXT}}>
                {mm.title}{done && <span style={SR_ONLY}>, on track</span>}
              </span>
            </button>
          );
        })}
      </section>

      <section style={TILE}>
      <h2 style={SECTION}>Coming soon</h2>
      <div style={ROWS}>
        {LOCKED_MODULES.map(lm => {
          const LockedIcon = lm.icon || MODULE_META.find(mm => mm.key === lm.key)?.icon;
          return (
            <div key={lm.key} style={ROW}>
              {LockedIcon && <LockedIcon {...ROW_ICON} color={MUT}/>}
              <div style={{flex:1,minWidth:0}}>
                <div style={ROW_TITLE}>{lm.title}</div>
                <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,margin:"4px 0 0"}}>{lm.description}</p>
              </div>
            </div>
          );
        })}
      </div>
      </section>
    </div>
  );
}
