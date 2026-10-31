import { useState, useEffect } from "react";
import { childcareSupport } from "../../lib/childcare.js";
import { Users, ChevronRight, Lock } from "lucide-react";
import CardStack, { DARK, StillCard, arrow } from "../CardStack.jsx";
import AlertBox from "../AlertBox.jsx";
import { PROGRESS_GREEN, G, GOLD, WHITE, MUT, TEXT, SERIF, SANS, RADIUS_CARD, SR_ONLY, HAIRLINE, SECTION_TITLE, ROW_TILE } from "../../design-tokens.js";
import { getModuleBreakdown, MODULE_META, reviewedDone } from "../../lib/moduleStatus.js";
import { calcStudentLoanScenario } from "../../lib/studentLoan.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import { statusLabel, statusLine, ELSEWHERE } from "../statusLabel.js";
import { notStarted, dormantModules, MODULE_PITCH } from "../../lib/appEntry.js";
import { taxTrap, thisTaxYear } from "../../lib/taxTrap.js";
import ModuleStartRow, { ROW_TITLE, ROW_ICON } from "../ModuleStartRow.jsx";
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
// The sections under the wallet: each a tile, its Playfair heading inside,
// then hairline rows.
const TILE = { ...ROW_TILE, marginTop:"22px" };
const SECTION = { ...SECTION_TITLE, marginBottom:"8px" };
const ROWS = { display:"flex", flexDirection:"column" };
const ROW = { display:"flex", alignItems:"flex-start", gap:"14px", width:"100%", textAlign:"left", background:"none", border:"none", borderTop:HAIRLINE, padding:"14px 0", fontFamily:"inherit" };
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
      style={{margin:"6px 0 -6px",alignSelf:"flex-start",background:"none",border:"none",padding:"12px 0",fontSize:"13px",fontWeight:700,color:t.figure,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:"2px"}}>
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
        <p style={{fontSize:"13px",color:t.body,lineHeight:1.5,margin:"14px 0 0",paddingTop:"10px",borderTop:`1px solid ${t.rule}`}}>
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
      <h1 style={SR_ONLY}>Modules</h1>
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
      {notApplicable.length > 0 && (
        <section style={TILE}>
          <h2 style={SECTION}>Not applicable</h2>
          <div style={ROWS}>
          {notApplicable.map(mm => (
            <button key={mm.key} type="button" onClick={() => onOpenModule(mm.key)} style={{...ROW,cursor:"pointer"}}>
              <mm.icon {...ROW_ICON} color={MUT}/>
              <span style={{...ROW_TITLE,flex:1,minWidth:0,color:MUT}}>{mm.title}</span>
              <ChevronRight size={16} color={MUT} style={{flexShrink:0,alignSelf:"center"}}/>
            </button>
          ))}
          </div>
        </section>
      )}

      {/* Modules with no answers yet, picks first, each opening its
          walk-through; then any not open to them yet. */}
      {toExplore > 0 && (
        <section style={TILE}>
          <h2 style={SECTION}>Still to explore</h2>
          <div style={ROWS}>
            {waiting.map(key => <ModuleStartRow key={key} moduleKey={key} d={d} estimate={key === "property" ? null : moduleEstimate(key, d, m)} onOpen={openRow}/>)}
            {dormant.map(key => <ModuleStartRow key={key} moduleKey={key} d={d} dormant onOpen={onOpenModule}/>)}
          </div>
        </section>
      )}

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
