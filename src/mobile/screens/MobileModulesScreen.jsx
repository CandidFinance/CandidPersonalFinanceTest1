import { useState, useEffect } from "react";
import { childcareSupport } from "../../lib/childcare.js";
import { Users, ChevronRight, Lock } from "lucide-react";
import CardStack, { DARK, StillCard, arrow } from "../CardStack.jsx";
import AlertBox from "../AlertBox.jsx";
import { PROGRESS_GREEN, G, GOLD, WHITE, MUT, TEXT, SERIF, SANS, RADIUS_CARD } from "../../design-tokens.js";
import { getModuleBreakdown, MODULE_META, reviewedDone } from "../../lib/moduleStatus.js";
import { calcStudentLoanScenario } from "../../lib/studentLoan.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import { statusLabel, statusLine, ELSEWHERE } from "../statusLabel.js";
import { notStarted, dormantModules, MODULE_PITCH } from "../../lib/appEntry.js";
import { taxTrap, thisTaxYear } from "../../lib/taxTrap.js";
import ModuleStartRow from "../ModuleStartRow.jsx";
import FilterMenu from "../FilterMenu.jsx";
import BankConfirm from "../BankConfirm.jsx";
import NewBadge, { rateUpdatesLabel } from "../NewBadge.jsx";
import { useCashNews } from "../visitNews.js";
import { moduleEstimate } from "../../lib/crossModule.js";
import { isLocked } from "../../lib/unlock.js";
import { readinessMissing } from "../../lib/propertyReadiness.js";

// Mobile Modules screen. The modules they've started sit in a wallet stack
// (CardStack.jsx, as on Home and Progress): a summary card in front (£ at
// stake, saved, and how many are live, not started and need action), then
// one card per live module, largest £ first, on-track ones with a tick.
// Below: Still to explore (joins the wallet once answered), Not applicable,
// and Coming soon. Mark as reviewed lives in each module (MobileModuleDeepDive).

// Two label/value insight tiles per module, reusing figures already computed
// elsewhere (mm.amount, m.isaHeadroom, m.missedMatch, m.projectedPot) rather
// than re-deriving anything — calcStudentLoanScenario is the one exception,
// needed for its clear-year projection and already the single source of
// truth for that (shared with computeModuleStatuses).
function moduleInsights(mm, d, m) {
  switch (mm.key) {
    case "cash":
      return [
        { label: "Cash ISA gap", value: mm.amount > 0 ? `${fmtCompact(mm.amount)}/yr more` : "Optimised" },
        { label: "ISA allowance left", value: fmt(m.isaHeadroom) },
      ];
    case "investments":
      return [
        { label: "ISA headroom", value: fmt(m.isaHeadroom) },
        { label: "Unwrapped investments", value: fmt(+d.unwrappedValue||0) },
      ];
    case "pension":
      return [
        { label: "Employer match gap", value: m.missedMatch > 0 ? `${fmtCompact(m.missedMatch)}/yr` : "None" },
        { label: "Projected pot at retirement", value: fmt(m.projectedPot) },
      ];
    case "studentLoan": {
      if (d.studentLoan === "none") return [];
      const sl = calcStudentLoanScenario(d, m);
      return [
        { label: "Paying off now", value: sl.overpayAnnualBenefit > 0 ? `${fmtCompact(sl.overpayAnnualBenefit)}/yr` : "Not worth it" },
        { label: "Projected clear year", value: sl.willClear ? String(new Date().getFullYear() + sl.clearYr) : "Written off" },
      ];
    }
    case "kids": {
      const year = thisTaxYear(d, m);
      const cc = childcareSupport(year.d, year.m);
      if (!cc) return [];
      return [
        { label: "Childcare support", value: `${fmtCompact(cc.atStake)}/yr` },
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

// The tile Still to explore sits in, each module a row inside.
const TILE = { background:WHITE, borderRadius:RADIUS_CARD, boxShadow:"0 2px 10px rgba(22,47,36,0.06)", padding:"16px 14px" };
const TILE_TITLE = { fontSize:"15px", fontWeight:700, color:TEXT, padding:"0 4px" };
const TILE_SUB = { fontSize:"12.5px", color:MUT, marginTop:"2px", padding:"0 4px" };
const SUBHEAD = { fontSize:"10px", fontWeight:700, color:MUT, letterSpacing:"0.08em", textTransform:"uppercase", margin:"18px 4px 10px" };
// Each card behind shows this much of its top line (Home and Progress: 44).
const PEEK = 39;

// A big figure on a card: £ in the serif, with its unit after in sans.
function Figure({ t, value, unit, words = false }) {
  return (
    <div style={{fontFamily:SERIF,fontSize:words ? "34px" : "var(--hero-fig)",fontWeight:700,color:t.figure,lineHeight:1.05,letterSpacing:"-0.01em",marginTop:"8px"}}>
      {value}{unit && <span style={{fontFamily:SANS,fontSize:words ? "15px" : "0.32em",fontWeight:600,marginLeft:"5px",letterSpacing:0}}>{unit}</span>}
    </div>
  );
}

// The wallet's filter (FilterMenu.jsx), beside its arrows once there are
// more than FILTER_FROM module cards. Optimised: the cards with the tick (on
// track, or reviewed with under £50 left). One with nothing in it can't be
// picked.
const FILTER_FROM = 3;
const FILTERS = [["all", "All"], ["reviewed", "Reviewed"], ["optimised", "Optimised"]];
function OpenButton({ t, title, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{marginTop:"12px",alignSelf:"flex-start",background:"none",border:"none",padding:"6px 0",fontSize:"13px",fontWeight:700,color:t.figure,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:"2px"}}>
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
  const notApplicable = MODULE_META.filter(mm => statuses[mm.key]?.notApplicable);
  const live = moduleList.length + (propertyDone ? 1 : 0);
  const toExplore = waiting.length + dormant.length;
  const isReviewed = mm => completedModules.includes(mm.key);
  // On track (moduleStatus.js isOnTrack), or reviewed with under £50 left
  // (reviewedDone): the card gets the tick and the green wash, and it's
  // what the Optimised filter shows.
  const isOptimised = mm => mm.onTrack || reviewedDone(mm, isReviewed(mm));

  // The wallet's cards: a summary in front, then each live module.
  const moduleCard = mm => {
    const reviewed = isReviewed(mm);
    const onTrack = isOptimised(mm);
    const hasRec = mm.amount > 0;
    const locked = isLocked(d, mm.key);
    // On track with something saved: what was saved leads.
    const savedLead = !hasRec && onTrack && mm.banked > 0;
    // `lead`: a figure of its own where there's no £ at stake (the £100k tax
    // trap under £100k: how far from it).
    const lead = !hasRec && !locked ? mm.lead : null;
    const figure = hasRec ? fmt(mm.amount) : lead ? lead.value : savedLead ? fmt(mm.banked) : mm.elsewhere ? ELSEWHERE[mm.elsewhere].figure : statusLabel({ ...mm, onTrack });
    const unit = hasRec ? (mm.amountIsLumpSum ? "by 18" : "a year") : lead ? lead.unit : savedLead ? "a year saved" : null;
    const line = [statusLine({ ...mm, onTrack }), hasRec && mm.banked > 0 && `${fmtCompact(mm.banked)}/yr saved`, reviewed && !onTrack && "Reviewed"].filter(Boolean).join(" · ");
    const ins = locked ? [] : moduleInsights(mm, d, m);
    // Red or amber (the £100k tax trap): the wash and icon behind; in front,
    // the figure in an alert, as Progress's Tax shield has it.
    const warn = !locked && !onTrack ? mm.warn : null;
    const head = (t, words) => (
      <>
        <Figure t={t} value={figure} unit={unit} words={words}/>
        <p style={{fontSize:"13px",color:t.body,lineHeight:1.45,margin:"8px 0 0"}}>{line}</p>
      </>
    );
    return {
      key: mm.key, label: mm.title, done: onTrack, warn,
      badge: mm.key === "cash" && cashBadge > 0 ? <NewBadge inline count={cashBadge} label={rateUpdatesLabel(cashBadge)}/> : null,
      // The top line, seen while the card is behind; the tick says on track.
      amount: hasRec ? `${fmtCompact(mm.amount)}${mm.amountIsLumpSum ? " by 18" : "/yr"}` : lead ? lead.short : savedLead ? `${fmtCompact(mm.banked)}/yr saved`
        : onTrack ? "" : mm.elsewhere ? ELSEWHERE[mm.elsewhere].figure : statusLabel(mm),
      amountSans: !hasRec && !lead,
      body: t => (
        <>
          {warn && mm.alertTitle
            ? <AlertBox tone={warn} t={t} title={mm.alertTitle}>{head(t, false)}</AlertBox>
            : head(t, !hasRec && !savedLead && !lead)}
          {/* A locked answer (src/lib/unlock.js) stays hidden here too. */}
          {locked ? (
            <p style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"13px",color:t.body,lineHeight:1.5,margin:"12px 0 0"}}><Lock size={13}/>Your position is ready. Open it to unlock it.</p>
          ) : ins.length > 0 && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(2, minmax(0, 1fr))",gap:"8px",marginTop:"14px"}}>
              {ins.map(x => (
                <div key={x.label} style={{borderRadius:"10px",padding:"10px 12px",background:t === DARK ? "rgba(255,255,255,0.08)" : "rgba(22,47,36,0.06)"}}>
                  <div style={{fontSize:"10px",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:t.label}}>{x.label}</div>
                  <div style={{fontSize:"14px",fontWeight:700,color:t.figure,marginTop:"4px"}}>{x.value}</div>
                </div>
              ))}
            </div>
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
            <div style={{height:"14px",borderRadius:"7px",display:"flex",overflow:"hidden",background:t.track,marginTop:"10px"}}>
              <div style={{width:`${totalBanked / found * 100}%`,background:`linear-gradient(90deg, ${PROGRESS_GREEN}, ${GOLD})`}}/>
              <div style={{flex:1,background:t === DARK
                ? "repeating-linear-gradient(135deg, rgba(246,234,208,0.28) 0 4px, rgba(246,234,208,0.1) 4px 8px)"
                : "repeating-linear-gradient(135deg, rgba(22,47,36,0.16) 0 4px, rgba(22,47,36,0.05) 4px 8px)"}}/>
            </div>
            <div style={{fontSize:"12px",color:t.body,marginTop:"6px"}}>From changes made so far</div>
          </div>
        )}
        {/* The counts, kept small so the figures above lead. */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3, minmax(0, 1fr))",gap:"8px",marginTop:"14px",paddingTop:"10px",borderTop:`1px solid ${t.rule}`}}>
          {[["Live", live], ["Not started", toExplore], ["Need action", needActionCount]].map(([l, n]) => (
            <div key={l}>
              <div style={{fontFamily:SERIF,fontSize:"19px",fontWeight:700,lineHeight:1,color:t.figure}}>{n}</div>
              <div style={{fontSize:"9.5px",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:"3px",color:t.label}}>{l}</div>
            </div>
          ))}
        </div>
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
  // The filter: the summary stays in front whichever is on; Property (no £,
  // never reviewed or on track) only under All. A filter left with nothing
  // in it (a review undone, say) falls back to All, and stays there.
  const [filter, setFilter] = useState("all");
  const filterCounts = { all: live, reviewed: moduleList.filter(isReviewed).length, optimised: moduleList.filter(isOptimised).length };
  const showFilter = live > FILTER_FROM;
  const active = showFilter && filterCounts[filter] > 0 ? filter : "all";
  useEffect(() => { if (active !== filter) setFilter(active); }, [active, filter]);
  const shown = active === "reviewed" ? moduleList.filter(isReviewed) : active === "optimised" ? moduleList.filter(isOptimised) : moduleList;
  const cards = [summary, ...shown.map(moduleCard), ...(active === "all" && propertyDone ? [propertyCard] : [])];

  return (
    <div>
      {/* Before any module's answered: the summary card greyed, its figure
          blank. No counts: they'd all be 0 bar Not started, which Still to
          explore below already gives. */}
      {live === 0 && (
        <StillCard data-tour="modules-cards" label="Your modules" body={t => (
          <>
            <div style={{fontFamily:SERIF,fontSize:"var(--hero-fig)",fontWeight:700,color:MUT,opacity:0.5,lineHeight:1,marginTop:"8px"}}>£–</div>
            <p style={{fontSize:"13px",color:t.body,lineHeight:1.45,margin:"8px 0 0"}}>What's at stake shows here once a module is answered.</p>
          </>
        )}/>
      )}
      {live > 0 && (
        <section aria-label="Your modules" data-tour="modules-cards">
          {/* Keyed on the cards it holds, so a new set (another filter, or
              a module joining or leaving one) starts at the summary. */}
          <CardStack key={cards.map(c => c.key).join()} cards={cards} peek={PEEK} turnLabels={["Show the previous module", "Show the next module"]}
            controls={showFilter && <FilterMenu label="Filter modules" value={active} defaultValue="all" onChange={setFilter}
              options={FILTERS.map(([key, label]) => ({ key, label, count: filterCounts[key] }))}/>}/>
          {/* "Did you make the change?", under the wallet so a card behind
              never hides it. */}
          {set && (
            <div style={{marginTop:"16px"}}>
              {moduleList.map(mm => <BankConfirm key={mm.key} d={d} set={set} moduleKey={mm.key} title={mm.title} amount={mm.amount}/>)}
            </div>
          )}
        </section>
      )}

      {/* Answered, but nothing in it applies (Kids & family with no
          children and none planned): greyed, and still there to change. */}
      {notApplicable.length > 0 && (<>
        <div style={{...SUBHEAD,marginTop:"18px"}}>Not applicable</div>
        <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          {notApplicable.map(mm => (
            <button key={mm.key} type="button" onClick={() => onOpenModule(mm.key)} style={{display:"flex",alignItems:"center",gap:"12px",width:"100%",textAlign:"left",background:WHITE,border:"1px solid rgba(22,47,36,0.08)",borderRadius:RADIUS_CARD,boxShadow:"0 2px 10px rgba(22,47,36,0.05)",padding:"14px 16px",cursor:"pointer",fontFamily:"inherit"}}>
              <span style={{display:"flex",alignItems:"center",gap:"12px",flex:1,minWidth:0,opacity:0.55}}>
                <span style={{width:"30px",height:"30px",borderRadius:"9px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <mm.icon size={14} color={G}/>
                </span>
                <span style={{flex:1,fontSize:"14.5px",fontWeight:600,color:TEXT}}>{mm.title}</span>
              </span>
              <span style={{fontSize:"12px",color:MUT}}>Not applicable</span>
              <ChevronRight size={16} color={MUT}/>
            </button>
          ))}
        </div>
      </>)}

      {/* Modules with no answers yet, picks first, each opening its
          walk-through; then any not open to them yet. */}
      {toExplore > 0 && (
        <section style={{...TILE,marginTop:"22px"}}>
          <div style={TILE_TITLE}>Still to explore</div>
          <div style={TILE_SUB}>{toExplore} {toExplore === 1 ? "module" : "modules"} not started yet</div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px",marginTop:"14px"}}>
            {waiting.map(key => <ModuleStartRow key={key} moduleKey={key} d={d} estimate={key === "property" ? null : moduleEstimate(key, d, m)} onOpen={openRow}/>)}
            {dormant.map(key => <ModuleStartRow key={key} moduleKey={key} d={d} dormant onOpen={onOpenModule}/>)}
          </div>
        </section>
      )}

      <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:"22px",marginBottom:"10px"}}>Coming soon</div>
      <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
        {LOCKED_MODULES.map(lm => {
          const LockedIcon = lm.icon || MODULE_META.find(mm => mm.key === lm.key)?.icon;
          return (
            <div key={lm.key} style={{background:"rgba(255,255,255,0.55)",borderRadius:"16px",border:"1.5px dashed rgba(22,47,36,0.15)",padding:"18px",display:"flex",alignItems:"flex-start",gap:"14px"}}>
              <div style={{width:"42px",height:"42px",borderRadius:"11px",background:"rgba(22,47,36,0.05)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"2px"}}>
                {LockedIcon && <LockedIcon size={18} color={MUT}/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}}>
                  <div style={{fontSize:"16px",fontWeight:600,color:MUT}}>{lm.title}</div>
                  <div style={{fontSize:"12px",fontWeight:700,color:MUT,flexShrink:0}}>Locked</div>
                </div>
                <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,marginTop:"6px",marginBottom:0}}>{lm.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
