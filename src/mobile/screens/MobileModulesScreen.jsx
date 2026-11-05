import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Users, ChevronRight, Lock, Star, Sprout, Sunset, PieChart, KeyRound, ScrollText, Globe } from "lucide-react";
import { FrontCard, StillCard } from "../CardStack.jsx";
import { TilePopover } from "../MobileTile.jsx";
import { G, GOLD, MUT, TEXT, SERIF, SANS, SR_ONLY, SUCCESS, CRITICAL, WARNING_TEXT, MODULE_ACCENTS, MODULE_ACCENT_MUTED, MODULE_SOON_TILE } from "../../design-tokens.js";
import { ScreenBand, ScreenSheet, SCREEN_TITLE } from "../ScreenBand.jsx";
import { getModuleBreakdown, reviewedDone } from "../../lib/moduleStatus.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import { statusLabel, ELSEWHERE } from "../statusLabel.js";
import { notStarted, dormantModules, moduleOrder, isNewModule } from "../../lib/appEntry.js";
import { moduleMeta } from "../ModuleStartRow.jsx";
import BankConfirm from "../BankConfirm.jsx";
import NewBadge, { rateUpdatesLabel } from "../NewBadge.jsx";
import { useCashNews } from "../visitNews.js";
import { moduleEstimate } from "../../lib/crossModule.js";
import { isLocked } from "../../lib/unlock.js";
import { readinessMissing } from "../../lib/propertyReadiness.js";

// Mobile Modules screen. A coloured band at the top with the page's title
// and one card: what's at stake a year across the live modules, and what's
// been saved with a bar splitting the two, as on Home. Below, on the page's
// cream, how many are live, not started and need action in a small line,
// then every module as a tile: its title, an arrow, its icon on a square of
// its own colour, and its £ at stake (or where it stands). Tapping a tile
// opens the module. Last, muted, the modules coming soon: tapping one pops
// open what it will cover. Mark as reviewed lives in each module
// (MobileModuleDeepDive).

// The band and sheet: ScreenBand.jsx. The tiles: two across on a phone,
// three from a tablet up.
const CSS = `
/* Every row as tall as the tallest, so the tiles line up whatever's in them. */
.modules-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 12px; }
@media (min-width: 640px) { .modules-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.modules-tile { transition: transform 0.15s ease, box-shadow 0.2s ease; }
@media (hover: hover) { button.modules-tile:hover { box-shadow: 0 6px 18px rgba(22,47,36,0.10); } }
button.modules-tile:active { transform: scale(0.98); }
@media (prefers-reduced-motion: reduce) { .modules-tile { transition: none; } button.modules-tile:active { transform: none; } }
`;

// A big figure on a card: £ in the serif, with its unit after in sans.
function Figure({ t, value, unit }) {
  return (
    <div style={{fontFamily:SERIF,fontSize:"var(--hero-fig)",fontWeight:700,color:t.figure,lineHeight:1.05,letterSpacing:"-0.01em",marginTop:"8px"}}>
      {value}{unit && <span style={{fontFamily:SANS,fontSize:"0.32em",fontWeight:600,marginLeft:"5px",letterSpacing:0}}>{unit}</span>}
    </div>
  );
}

// Modules not built yet, so the roadmap shows: a muted tile each, after the
// rest, whose tap pops open what it will cover. Neutral: what it will look
// at, not what to do.
const COMING_SOON = [
  { key:"households",  title:"Households",  icon:Users,      description:"Two people, one plan. Marriage or a civil partnership changes the picture, from shared allowances to how you hold savings and investments." },
  { key:"eis",         title:"EIS/SEIS",    icon:Sprout,     description:"Shares in early-stage companies: the income tax relief on them (30% under EIS, 50% under SEIS), and how gains and losses on them are taxed." },
  { key:"retirement",  title:"Retirement",  icon:Sunset,     description:"When you could stop work, and the income you'd have: your pensions, the State Pension and your savings together, and the tax on drawing them." },
  { key:"rsus",        title:"RSUs",        icon:PieChart,   description:"Shares from your employer: the income tax and National Insurance when they vest, and Capital Gains Tax on any rise once you hold them." },
  { key:"mortgages",   title:"Mortgages",   icon:KeyRound,   description:"Your rate, term and balance: what a remortgage or paying extra each month would change over the life of the loan." },
  { key:"inheritance", title:"Inheritance", icon:ScrollText, description:"Inheritance Tax on what you'd leave: the nil-rate bands, gifts and how they're counted, and unused pensions, which count from April 2027." },
  { key:"offshore",    title:"Offshore",    icon:Globe,      description:"Money, property or income held outside the UK: how it's taxed here, and what has to be reported." },
];
const SOON_BY_KEY = Object.fromEntries(COMING_SOON.map(s => [s.key, s]));
// Its pop-open card, centred on the screen rather than hung off a half-width
// tile.
const POP = { position:"fixed", inset:0, margin:"auto", height:"fit-content", width:"min(340px, calc(100vw - 40px))", transformOrigin:"center", padding:"18px 20px 20px" };
// A tile's foot: one line, cut short with … rather than wrapping.
const FOOT = { display:"block", fontSize:"13px", lineHeight:1.3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" };

export default function MobileModulesScreen({ d, m, set, statuses, insights, completedModules, onOpenModule, onOpenProperty }) {
  // Best rates moved for them since the last visit: a red badge on the Cash
  // tile until they open Cash (visitNews.js).
  const news = useCashNews();
  const cashBadge = news && !news.opened ? news.count : 0;
  const { moduleList, totalOpp, totalBanked } = getModuleBreakdown(d, m, statuses, insights, "amount");
  // Counted from the modules' own status labels, so "N needing action"
  // always tallies with the modules reading "Action needed" (reviewed with
  // under £50 left reads on track: reviewedDone).
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
  // On track (moduleStatus.js isOnTrack), or reviewed with under £50 left
  // (reviewedDone).
  const isOptimised = mm => mm.onTrack || reviewedDone(mm, completedModules.includes(mm.key));

  // The tiles: every module offered, picks first, then any not open to them
  // yet, then those coming soon. A fixed order (not by £), so a module is
  // always where they last found it.
  const keys = [...moduleOrder(d), ...dormant, ...COMING_SOON.map(s => s.key)];
  // The coming-soon tile popped open, if any.
  const [soon, setSoon] = useState(null);
  const liveByKey = Object.fromEntries(moduleList.map(mm => [mm.key, mm]));
  // Each tile's state. Live: answers logged (and Property's questions done),
  // its icon in colour. The rest go grey: not explored, not applicable
  // (answered, but nothing in it applies), not open yet, or not built yet.
  const stateOf = key => SOON_BY_KEY[key] ? "soon"
    : dormant.includes(key) ? "dormant"
    : liveByKey[key] || (key === "property" && propertyDone) ? "live"
    : statuses[key]?.notApplicable ? "na"
    : "unexplored";

  // The foot of a tile, one line and one indicator at most: the £ at stake
  // a year (in amber or red for the £100k tax trap's warning; ~ before an
  // estimate), or where it stands in words. `sr`: the status, for a screen
  // reader, where only colour or the ~ says it.
  const tileValue = (key, state) => {
    if (state === "soon") return { note: "Coming soon" };
    if (state === "dormant") return { note: "Not open yet" };
    if (state === "na") return { note: "Not applicable" };
    if (state === "unexplored") {
      const e = key === "property" ? null : moduleEstimate(key, d, m);
      if (!e) return { note: "Not started" };
      return { figure: e.low === e.high ? `~${fmtCompact(e.high)}` : `~${fmtCompact(e.low)}–${fmtCompact(e.high)}`, unit: "/yr", muted: true, sr: "estimate" };
    }
    if (key === "property") return { note: "Ready" };
    const mm = liveByKey[key];
    if (isLocked(d, key)) return { note: "Ready to unlock" };
    const onTrack = isOptimised(mm);
    const warn = !onTrack ? mm.warn : null;
    const color = warn === "red" ? CRITICAL : warn ? WARNING_TEXT : null;
    const sr = warn ? statusLabel(mm) : null;
    // Where its figure is counted in another module, that leads; then on
    // track (reviewed with under £50 left included, so the tile tallies
    // with "needing action" above), before any £ left.
    if (mm.elsewhere) return { note: ELSEWHERE[mm.elsewhere].figure };
    if (onTrack) return { note: "On track", noteColor: SUCCESS };
    if (mm.amount > 0) return { figure: fmt(mm.amount), unit: mm.amountIsLumpSum ? "by 18" : "/yr", color, sr };
    if (mm.lead) return { figure: mm.lead.value, unit: mm.lead.unit, color, sr };
    return { note: statusLabel(mm) };
  };

  // The hero: at stake leads; a bar splits what's been found into saved
  // and still at stake, as on Home.
  const found = totalBanked + totalOpp;
  const hero = live > 0
    ? <FrontCard label="At stake" body={t => (
        <>
          <Figure t={t} value={fmt(totalOpp)} unit="a year"/>
          {totalBanked > 0 && (
            <div style={{marginTop:"18px"}}>
              <div style={{display:"flex",alignItems:"baseline",gap:"6px"}}>
                <span style={{fontFamily:SERIF,fontSize:"30px",fontWeight:700,lineHeight:1,color:t.figure}}>{fmt(totalBanked)}</span>
                <span style={{fontSize:"13px",fontWeight:600,color:t.figure}}>a year saved</span>
              </div>
              <div aria-hidden="true" style={{height:"8px",borderRadius:"4px",display:"flex",overflow:"hidden",background:t.track,marginTop:"10px"}}>
                <div style={{width:`${totalBanked / found * 100}%`,background:GOLD}}/>
              </div>
            </div>
          )}
        </>
      )}/>
    // Before any module's answered: the card greyed, its figure blank.
    : <StillCard label="At stake" body={t => (
        <>
          <div style={{fontFamily:SERIF,fontSize:"var(--hero-fig)",fontWeight:700,color:MUT,opacity:0.5,lineHeight:1,marginTop:"8px"}}>£–</div>
          <p style={{fontSize:"13px",color:t.body,lineHeight:1.45,margin:"8px 0 0"}}>What's at stake shows here once a module is answered.</p>
        </>
      )}/>;

  return (
    <div>
      <style>{CSS}</style>
      <ScreenBand>
        <h1 style={{...SCREEN_TITLE,color:G}}>Modules</h1>
        <section aria-label="At stake" data-tour="modules-cards">{hero}</section>
      </ScreenBand>

      <ScreenSheet>
        {/* "Did you make the change?" prompts. */}
        {set && moduleList.map(mm => <BankConfirm key={mm.key} d={d} set={set} moduleKey={mm.key} title={mm.title} amount={mm.amount}/>)}
        {/* The counts in a line, kept small so the figures lead. None before
            any module's answered: they'd all be 0 bar Not started, which the
            grey tiles already show. */}
        {live > 0 && (
          <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,margin:"0 2px 12px"}}>
            {[[live, "live"], [toExplore, "not started"], [needActionCount, "needing action"]].map(([n, l], i) => (
              <span key={l}>{i ? ", " : ""}<b style={{fontWeight:700,color:TEXT}}>{n}</b> {l}</span>
            ))}
          </p>
        )}

        {/* Every module as a tile: tapping one opens it. */}
        <section aria-label="Your modules" className="modules-grid">
          {keys.map(key => {
            const state = stateOf(key);
            const mm = SOON_BY_KEY[key] || moduleMeta(key);
            const muted = state !== "live";
            // Coming soon: flat grey with the icon on white, apart from the
            // pale white of one not started or not open yet.
            const isSoon = state === "soon";
            const accent = isSoon ? { bg: MODULE_SOON_TILE.chip, fg: MODULE_SOON_TILE.fg } : muted ? MODULE_ACCENT_MUTED : MODULE_ACCENTS[key] || MODULE_ACCENT_MUTED;
            const v = tileValue(key, state);
            const Tag = state === "dormant" ? "div" : "button";
            return (
              <Tag key={key} className="modules-tile" {...(Tag === "button" && { type: "button", onClick: () => state === "soon" ? setSoon(key) : openRow(key), ...(state === "soon" && { "aria-haspopup": "dialog" }) })}
                style={{display:"flex",flexDirection:"column",alignItems:"stretch",minHeight:"148px",padding:"14px 14px 14px 16px",textAlign:"left",fontFamily:"inherit",cursor:Tag === "button" ? "pointer" : "default",boxSizing:"border-box",
                  borderRadius:"20px",background:isSoon ? MODULE_SOON_TILE.bg : muted ? "rgba(255,255,255,0.6)" : "#fff",border:isSoon ? "1px solid transparent" : "1px solid rgba(22,47,36,0.07)",boxShadow:muted ? "none" : "0 1px 3px rgba(22,47,36,0.05)"}}>
                <span style={{display:"flex",alignItems:"flex-start",gap:"6px"}}>
                  <span style={{flex:1,minWidth:0,fontSize:"15px",fontWeight:700,lineHeight:1.25,color:muted ? MUT : TEXT}}>{mm.title}</span>
                  {key === "cash" && state === "live" && cashBadge > 0 && <NewBadge inline count={cashBadge} label={rateUpdatesLabel(cashBadge)}/>}
                  {state === "dormant"
                    ? <Lock size={15} color={MUT} style={{flexShrink:0,marginTop:"2px"}} aria-hidden="true"/>
                    : <ChevronRight size={18} strokeWidth={2.2} color={muted ? MUT : G} style={{flexShrink:0,marginRight:"-4px"}} aria-hidden="true"/>}
                </span>
                <span style={{position:"relative",alignSelf:"flex-start",display:"grid",placeItems:"center",width:"64px",height:"64px",borderRadius:"18px",background:accent.bg,marginTop:"12px"}}>
                  <mm.icon size={32} strokeWidth={1.9} color={accent.fg} aria-hidden="true"/>
                  {isNewModule(key) && (
                    <span role="img" aria-label="New" style={{position:"absolute",top:"-4px",right:"-4px",display:"flex"}}>
                      <Star size={13} color={GOLD} fill={GOLD} strokeWidth={2}/>
                    </span>
                  )}
                </span>
                {/* The figure in the tile's own sans, as "On track" (a tile's
                    £ is a status here, not a headline: the serif's for the
                    hero card). */}
                <span style={{marginTop:"auto",paddingTop:"12px"}}>
                  {v.figure && (
                    <span style={{...FOOT,fontWeight:700,color:v.color || (v.muted ? MUT : G)}}>
                      {v.figure}{v.unit.startsWith("/") ? "" : " "}{v.unit}
                    </span>
                  )}
                  {v.note && <span style={{...FOOT,fontWeight:v.noteColor ? 700 : 500,color:v.noteColor || MUT}}>{v.note}</span>}
                  {v.sr && <span style={SR_ONLY}>, {v.sr}</span>}
                </span>
              </Tag>
            );
          })}
        </section>

        {/* A coming-soon tile's pop-open card: what the module will cover. */}
        <AnimatePresence>
          {soon && (
            <TilePopover key={soon} title={SOON_BY_KEY[soon].title} onClose={() => setSoon(null)} style={POP}>
              <div style={{fontSize:"11px",fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:MUT,margin:"-2px 0 8px"}}>Coming soon</div>
              <p style={{fontSize:"14px",color:TEXT,lineHeight:1.5,margin:0}}>{SOON_BY_KEY[soon].description}</p>
            </TilePopover>
          )}
        </AnimatePresence>
      </ScreenSheet>
    </div>
  );
}
