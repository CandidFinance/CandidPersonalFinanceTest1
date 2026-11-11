import { useEffect, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import { ChevronRight } from "lucide-react";
import { buildProgressSnapshot, sortGoals, GOAL_SORTS, poundsInput, withAllowanceGoal, TRAP_EDGE } from "../../lib/progressTracker.js";
import { EMERGENCY_MONTHS_HINT } from "../../lib/metrics.js";
import { capField } from "../../lib/onboarding.js";
import { fmt } from "../../lib/format.js";
import { worthAccounts, worthGroups, worthTimeline, netSeries, changeOver12 } from "../../lib/netWorthView.js";
import { taxYearOf, taxYearShort } from "../../lib/taxYear.js";
import { hasAccess, withFeatureUsed } from "../../lib/entitlement.js";
import { useElementWidth } from "../../mobile/useElementWidth.js";
import { DARK, LIGHT, WARN } from "../../mobile/CardStack.jsx";
import Alert from "../../mobile/AlertBox.jsx";
import FilterMenu from "../../mobile/FilterMenu.jsx";
import PillMoneyInput from "../../mobile/PillMoneyInput.jsx";
import { PillSlider } from "../../mobile/PillSlider.jsx";
import { ScreenBand, ScreenSheet, useBandViews, BandViewCaption, BandReel, SheetGlass } from "../../mobile/ScreenBand.jsx";
import {
  GOLD, WHITE, MUT, TEXT, SERIF, SANS, SR_ONLY, PROGRESS_GREEN, MODULE_CHART_COLOR,
} from "../../design-tokens.js";
import { kicker, BarTile, AllowanceIcon, ProgressBar, ReachedMark, useReachedReveal, lockedBar, Figure, Details, TextButton, EditorCard, helpText } from "./ProgressParts.jsx";
import { AddGoalTile, VaultTile, saveVault, removeVault } from "./GoalVaults.jsx";
import { Dropdown, GroupedList, HeroSummary, TrendChart, ViewDots } from "../../mobile/networth/NetWorthParts.jsx";
import { WORTH_THEME, WORTH_BAND_T, WORTH_LABELS, VIEWS, fmtWorth, fmtWorthAxis, toRow, chartProps, changeSaid, comingSoonRows } from "../../mobile/networth/worthUi.jsx";

// The Progress tab (/app/progress): a band (ScreenBand.jsx) with three
// views, swiped between or picked by the dots, each a figure and a picture
// drawn straight on it: net worth and its line over time (on dark green),
// how this tax year's goals are going, and where income sits against the
// £100k trap (on that view the band turns red in the trap, amber near it).
// On the cream below, each view's details: under Net worth the assets and
// debts (netWorthView.js), each opening its own page, under Goals the goals themselves with any goal pots, under the
// Tax shield its details. The figures come
// from src/lib/progressTracker.js, built from the same metrics as Home and
// the modules; targets set here are saved inputs (`set`) like any other
// answer.

// Each part's chart colour, as everywhere in the app (MODULE_CHART_COLOR, as
// on Forecast's net worth breakdown). In progressTracker.js's order round the
// ring every neighbouring pair clears the dataviz colour-blindness check, and
// the legend names each part with its value, so colour never works alone.
const PART_COLOR = {
  cash: MODULE_CHART_COLOR.cash,
  home: MODULE_CHART_COLOR.mortgage,
  investments: MODULE_CHART_COLOR.investments,
  pension: MODULE_CHART_COLOR.pension,
};
// Each goal's bar in the colour of what it builds in the net worth ring (ISA,
// capital gains and dividends: Investments; the emergency fund and cash
// interest: Cash), or for a debt its module's chart colour.
const GOAL_COLOR = {
  isa: PART_COLOR.investments,
  pension: PART_COLOR.pension,
  emergency: PART_COLOR.cash,
  cashInterest: PART_COLOR.cash,
  mortgage: PART_COLOR.home,
  studentLoan: MODULE_CHART_COLOR.studentLoan,
  cgt: PART_COLOR.investments,
  dividends: PART_COLOR.investments,
};

export default function ProgressTrackerDashboard({ d, m, statuses, set, celebrating = [], onOpenModule, onOpenWorth }) {
  // The goal tile showing its details ("add", "row:<id>" or "vault:<id>"),
  // and the one form open in it ("row:<id>" or "vault:<id>"; Add a goal's
  // form is its details).
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const { rows, annual, vaults, income } = buildProgressSnapshot(d, m, statuses);
  // Goals the pop-up is celebrating (CandidApp, GoalReached.jsx;
  // "<tax year>:row:<id>" or "vault:<id>"): their bars fill as each scrolls
  // into view. Kept for the visit, as closing the pop-up clears them.
  const taxYear = taxYearOf(new Date());
  const [visit, setVisit] = useState(celebrating);
  useEffect(() => {
    if (celebrating.some(k => !visit.includes(k))) setVisit(v => [...v, ...celebrating.filter(k => !v.includes(k))]);
  }, [celebrating.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  // The Goals list's order (FilterMenu, sortGoals), kept with their answers.
  const sortBy = GOAL_SORTS.some(o => o.key === d.goalsSort) ? d.goalsSort : "default";
  const pickSort = key => { set("goalsSort", key); posthog.capture("progress_goals_sorted", { by: key }); };
  const goals = [
    ...vaults.map(v => ({ vault: v, target: v.target, pct: v.pct, measured: v.target > 0, locked: false })),
    ...rows.map(row => ({ row, target: row.target, pct: row.pct, measured: row.tracked && row.target > 0 && !row.warnAt, locked: row.locked })),
  ];
  const toggle = key => { setExpanded(e => (e === key ? null : key)); setEditing(null); };
  const close = () => setEditing(null);
  const openModule = key => {
    posthog.capture("progress_module_opened", { module: key });
    onOpenModule?.(key);
  };
  const openTrap = () => {
    posthog.capture("progress_trap_opened", { above_taper: !!income.trap?.aboveTaper });
    onOpenModule?.("taxTrap");
  };

  // The band's views, net worth first, each its figure and picture drawn
  // straight on the band, with the details on the cream below: Net worth's
  // assets and debts, the goals, or the Tax shield's details. The band is
  // dark green on Net worth, light on Goals, light on the Tax shield but red
  // or amber while income is in
  // the £100k trap or near it; from the other views, the Tax shield's dot
  // says so. The goals stay put, only hidden, under the other views, so an
  // editor open in one keeps what's typed in it.
  // Net worth (netWorthView.js): the headline and its line over time on the
  // band, in the brand's dark green; on the cream, the assets and debts,
  // grouped by Category, Account or Access. A row opens its own page
  // (/app/progress/worth/<row>, MobileWorthDetail.jsx).
  // The grouping is swiped between on the cream, or picked by its dots, as
  // the band's views are (useBandViews).
  const grouping = useBandViews(VIEWS.length);
  const worthBy = VIEWS[grouping.view].key;
  // Each switch, by swipe or dot.
  const shownGrouping = useRef(grouping.view);
  useEffect(() => {
    if (shownGrouping.current === grouping.view) return;
    shownGrouping.current = grouping.view;
    posthog.capture("progress_worth_view", { by: worthBy });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs as the grouping changes
  }, [grouping.view]);
  const [worthRange, setWorthRange] = useState("1y");
  const worth = useMemo(() => worthAccounts(d, m), [d, m]);
  const timeline = useMemo(() => worthTimeline(d, m, worth, d.netWorthHistory), [d, m, worth]);
  const net = useMemo(() => netSeries(timeline, worth), [timeline, worth]);
  const openWorth = key => { posthog.capture("progress_worth_row_opened", { row: key }); onOpenWorth?.(key); };
  const views = [
    { key: "netWorth", label: "Net worth", body: () => (
      <WorthBand worth={worth} change={changeSaid(changeOver12(timeline, net))}
        chart={chartProps(timeline, net, worthRange, setWorthRange)}/>
    ) },
    { key: "goals", label: `Goals ${taxYearShort(taxYear)}`, body: t => <AnnualGoals annual={annual} t={t}/> },
    { key: "taxShield", label: "Tax shield", body: t => <ShieldBand income={income} t={t}/> },
  ];
  const WORTH = views.findIndex(v => v.key === "netWorth");
  const GOALS = views.findIndex(v => v.key === "goals");
  const SHIELD = views.findIndex(v => v.key === "taxShield");
  const { view, showView, moved, bandProps, reel } = useBandViews(views.length);
  const warn = WARN_ZONE[income.zone];
  const tone = view === WORTH ? "green" : view === SHIELD && warn ? warn : "light";
  const t = BAND_T[tone];

  return (
    <div>
      <style>{GOALS_CSS}</style>
      <ScreenBand tone={tone} {...bandProps}>
        <h1 style={SR_ONLY}>Progress</h1>
        <section aria-label="Your figures" data-tour="progress-cards">
          <BandViewCaption views={views.map(v => v.label)} view={view} moved={moved} onPick={showView} ink={t.figure} soft={t.label} faint={t.dot}
            marks={warn && { [SHIELD]: { color: WARN[warn].icon, note: income.zone === "in" ? "in the £100k trap" : "near the £100k trap" } }}/>
          <BandReel reel={reel}>{views[view].body(t)}</BandReel>
        </section>
      </ScreenBand>

      <ScreenSheet slick>
        <SheetGlass view={view}>{shown => (<>
          {shown === WORTH && (
            <div data-tour="progress-worth">
              <WorthLists groups={worthGroups(d, m, worth, worthBy)} worth={worth} grouping={grouping} onOpen={openWorth}/>
            </div>
          )}
          {shown === SHIELD && (
            <section aria-label="Tax shield details">
              <ShieldDetails income={income} t={SHEET_T} onOpenTrap={openTrap}/>
            </section>
          )}
          {/* Add a goal first, then the goals in the order picked: as built,
              the user's pots (newest first) then this tax year's goals from the
              modules (sortGoals). Each goal its own tile on the cream. */}
          <section data-tour="progress-goals" aria-labelledby="progress-goals-title" hidden={shown !== GOALS}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",padding:"0 2px"}}>
              <h2 id="progress-goals-title" style={kicker}>Goals</h2>
              <div style={{height:0,display:"flex",alignItems:"center"}}>
                <FilterMenu label="Sort goals" options={GOAL_SORTS} value={sortBy} defaultValue="default" onChange={pickSort}/>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"10px",marginTop:"16px"}}>
              <AddGoalTile d={d} names={vaults.map(v => v.name)} open={expanded === "add"} onToggle={() => toggle("add")}
                onSave={vault => { saveVault(d, set, vault, { added: true, fromGoal: false }); if (hasAccess()) set("subscriberFeaturesUsed", withFeatureUsed(d, "addGoal")); setExpanded(null); }}/>
              {sortGoals(goals, sortBy).map(({ vault: v, row }) => {
                if (v) {
                  const key = `vault:${v.id}`;
                  return (
                    <VaultTile key={key} vault={v} fresh={visit.includes(key)} names={vaults.map(x => x.name)} open={expanded === key} onToggle={() => toggle(key)}
                      editing={editing === key} onEdit={() => setEditing(key)} onCancel={close}
                      onSave={next => { saveVault(d, set, next, { added: false, fromGoal: v.fromGoal }); close(); }}
                      onRemove={() => { removeVault(d, set, v); close(); setExpanded(null); }}/>
                  );
                }
                const key = `row:${row.id}`;
                return (
                  <GoalTile key={key} row={row} fresh={visit.includes(`${taxYear}:${key}`)} open={expanded === key} onToggle={() => toggle(key)}
                    editing={editing === key} onEdit={() => setEditing(key)} onOpenModule={openModule}
                    editor={editing === key && <RowEditor row={row} d={d} m={m} set={set} onDone={close}/>}/>
                );
              })}
            </div>
          </section>
        </>)}</SheetGlass>
      </ScreenSheet>
    </div>
  );
}

// ── The band's views ───────────────────────────────────────────────────
// Each drawn in the colours `t` of the band (BAND_T).

// The band's colours: the wallet stack's light card colours (CardStack.jsx),
// or its red or amber warning ones, each with the small text a step darker,
// so it stays over 4.5:1 on the band's deepest corner, a firmer track, and
// `dot` for the caption's other dots.
const BAND_T = {
  light: { ...LIGHT, label: "#585858", body: "#585858", track: "rgba(22,47,36,0.12)", dot: "rgba(22,47,36,0.25)" },
  red: { ...WARN.red, body: "#7a4a43", track: "rgba(142,42,31,0.14)", dot: "rgba(142,42,31,0.28)" },
  amber: { ...WARN.amber, body: "#75583f", track: "rgba(134,74,15,0.14)", dot: "rgba(134,74,15,0.28)" },
  green: WORTH_BAND_T,
};
// The cream sheet's, as Forecasts' details below its band.
const SHEET_T = LIGHT;

// A view's lead figure, in the serif at the band's size, with its unit.
const heroFig = t => ({ fontFamily:SERIF, fontSize:"var(--hero-fig)", fontWeight:700, color:t.figure, lineHeight:1, letterSpacing:"-0.01em", marginTop:"8px" });
const unit = { fontFamily:SANS, fontSize:"0.32em", fontWeight:600, marginLeft:"5px", letterSpacing:0, whiteSpace:"nowrap" };
const cardText = t => ({ fontSize:"13px", color:t.body, lineHeight:1.45, margin:"8px 0 0" });

// Net worth on the band: the headline, assets and debts, the last 12
// months' change once there's a year saved, and the line over time with the
// time range beside the totals (NetWorthParts.jsx).
function WorthBand({ worth, change, chart }) {
  return (
    <div style={{marginTop:"14px"}}>
      <HeroSummary theme={WORTH_THEME} format={fmtWorth} labels={{ ...WORTH_LABELS, netWorthAria: `Net worth ${fmtWorth(worth.netWorth)}` }}
        netWorth={worth.netWorth} assetsTotal={worth.assetsTotal} debtsTotal={worth.debtsTotal} change={change}
        action={<Dropdown onBand options={chart.windows} value={chart.range} onChange={chart.onRangeChange} theme={WORTH_THEME} ariaLabel={WORTH_LABELS.rangeAria}/>}/>
      <div style={{marginTop:"8px"}}>
        <TrendChart theme={WORTH_THEME} format={fmtWorth} formatAxis={fmtWorthAxis} labels={WORTH_LABELS} {...chart}/>
      </div>
    </div>
  );
}

// On the cream: the assets, then the debts, each row its icon, name and £,
// largest first. A count beside a name says the row is several accounts.
// Grouped by Category, Account or Access (Access applies to the assets;
// the debts stay by category), switched by a swipe across the lists or the
// dots centred above them, the lists sliding as the band's views do. The
// grouping is named on the dots' line (ViewDots).
function WorthLists({ groups, worth, grouping, onOpen }) {
  if (!groups.assets.length && !groups.debts.length) {
    return <p style={{...helpText,padding:"0 2px"}}>Savings, investments, pensions and debts show here once they're entered.</p>;
  }
  const soon = comingSoonRows(worth);
  const list = { theme: WORTH_THEME, format: fmtWorth, onOpen };
  // Accounts hidden from the lists (worthEdit.js), in one row at the foot.
  const foot = (list, soonRows) => [...list.filter(g => !g.hidden).map(toRow), ...soonRows, ...list.filter(g => g.hidden).map(toRow)];
  const assets = foot(groups.assets, soon.assets);
  const debts = foot(groups.debts, soon.debts);
  return (
    <div {...grouping.bandProps}>
      <ViewDots theme={WORTH_THEME} views={VIEWS} view={grouping.view} moved={grouping.moved} onPick={grouping.showView} label={WORTH_LABELS.viewAria}/>
      <BandReel reel={grouping.reel}>
        <GroupedList {...list} first title={WORTH_LABELS.assetsTitle} total={worth.assetsTotal} items={assets} barAria={WORTH_LABELS.assetsBarAria}/>
        {debts.length > 0 && (
          <GroupedList {...list} title={WORTH_LABELS.debtsTitle} total={worth.debtsTotal || null} totalNegative items={debts} barAria={WORTH_LABELS.debtsBarAria}/>
        )}
      </BandReel>
    </div>
  );
}

// Average progress across this tax year's goals below (the modules'; pots
// have their own dates), as a ring that fills to it, with the figure plain
// inside and how many are reached. With none to measure yet, an empty ring.
const GOALS_CSS = `
.progress-goals { display: flex; justify-content: center; margin-top: 14px; --ring: 168px; }
`;
function AnnualGoals({ annual, t }) {
  return (
    <div className="progress-goals">
      <Ring pct={annual.total ? annual.pct : null} hits={annual.hits} total={annual.total} t={t}/>
    </div>
  );
}

// Drawn at 104px and scaled to --ring (GOALS_CSS), figures with it.
function Ring({ pct, hits, total, t, size = 104, stroke = 9 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, centre = size / 2;
  const filled = ((pct || 0) / 100) * c;
  return (
    <div role="img" aria-label={pct == null ? "No goals to measure yet" : `${pct}% complete, ${hits} of ${total} goals reached`}
      style={{position:"relative",width:"var(--ring)",height:"var(--ring)",flexShrink:0}}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{transform:"rotate(-90deg)",display:"block"}} aria-hidden="true">
        <circle cx={centre} cy={centre} r={r} fill="none" stroke={t.track} strokeWidth={stroke}/>
        {filled > 0 && (
          <circle cx={centre} cy={centre} r={r} fill="none" stroke={PROGRESS_GREEN} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${filled} ${c}`}/>
        )}
      </svg>
      <div aria-hidden="true" style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontFamily:SANS,fontSize:"calc(var(--ring) * 0.23)",fontWeight:700,color:pct == null ? t.body : t.figure,lineHeight:1}}>{pct == null ? "–" : `${pct}%`}</span>
        {pct != null && <span style={{fontSize:"clamp(11px, calc(var(--ring) * 0.08), 13.5px)",color:t.body,marginTop:"4px"}}>{hits} of {total} reached</span>}
      </div>
    </div>
  );
}

// ── Goals ──────────────────────────────────────────────────────────────

// A goal's tile: locked (greyed out until its module is answered, the
// greying its one sign of that: CLAUDE.md rule 4), measured (its bar and
// figures), or open without a target. Opening it gives the figures in full
// and what can be changed: for a locked one, the module that unlocks it.
function GoalTile({ row, fresh, open, onToggle, editing, onEdit, onOpenModule, editor }) {
  // Cash already on the best rates shows as reached, without the animation
  // (rowReached: nothing built up to mark).
  const reached = !!(row.tracked && row.hit);
  const [ref, phase] = useReachedReveal(fresh);
  const bar = row.locked ? lockedBar
    : row.tracked ? <ProgressBar pct={row.pct} color={GOAL_COLOR[row.id]} label={row.label} reached={reached} warn={!!row.warnAt} phase={phase}/>
    : <span style={{fontSize:"12px",color:MUT}}>{row.id === "emergency" ? "Spending not entered" : row.addable ? "Not added" : "No target set"}</span>;
  const figure = row.locked || (row.addable && !row.tracked) ? null
    : reached ? <ReachedMark phase={phase} warn={!!row.warnAt}/>
    : row.target > 0 ? <Figure current={row.current} target={row.target}/>
    : row.current > 0 ? <Figure current={row.current}/> : null;
  const action = row.paidField ? (row.tracked ? "Update" : "Set a target")
    : row.addable ? (row.tracked ? "Update" : "Add")
    : row.id === "emergency" ? (row.tracked ? "Edit" : "Add spending")
    : row.own ? "Edit target" : "Set your own target";
  return (
    <BarTile title={row.label} icon={row.allowance && <AllowanceIcon/>} bar={bar} figure={figure} locked={row.locked} open={open} onToggle={onToggle} innerRef={ref}>
      {row.locked ? (
        <Details text={`Unlocks once ${row.unlock} is answered.`}
          action={<TextButton onClick={() => onOpenModule(row.module)}>Open {row.moduleTitle}</TextButton>}/>
      ) : (
        <Details text={row.note} action={row.editable && !editing && <TextButton onClick={onEdit}>{action}</TextButton>}/>
      )}
      {editor}
    </BarTile>
  );
}

function RowEditor({ row, d, m, set, onDone }) {
  if (row.id === "emergency") return <EmergencyEditor m={m} set={set} onDone={onDone}/>;
  if (row.paidField) return <OverpaymentEditor row={row} set={set} onDone={onDone}/>;
  if (row.addable) return <AllowanceEditor row={row} d={d} set={set} onDone={onDone}/>;
  return <PensionTargetEditor row={row} set={set} onDone={onDone}/>;
}

// Capital gains or dividends this tax year, against their allowance. Gains
// are Investments' own answer (profit on sales since 6 April), so the module
// and Progress share one figure. Saving adds the goal (withAllowanceGoal).
function AllowanceEditor({ row, d, set, onDone }) {
  const gains = row.id === "cgt";
  const [value, setValue] = useState(row.tracked && row.current > 0 ? row.current : null);
  const save = () => {
    const pounds = poundsInput(value);
    if (gains) {
      set("hasSoldAssetsOutsideWrapper", pounds ? "yes" : "no");
      set("realisedCgtGains", pounds);
    } else {
      set("dividendsThisYear", pounds);
    }
    set("allowanceGoals", withAllowanceGoal(d, row.id));
    posthog.capture("progress_allowance_saved", { row: row.id, added: !row.tracked });
    onDone();
  };
  return (
    <EditorCard title={gains ? "Capital gains this tax year" : "Dividends this tax year"} onCancel={onDone} onSave={save}>
      <PillMoneyInput label={gains ? "Gains on sales since 6 April" : "Received since 6 April"} value={value} onChange={setValue}/>
      <p style={helpText}>
        {gains
          ? "Profit on anything sold from investments outside an ISA or pension. It's the same figure as in Investments."
          : "From shares and funds held outside an ISA or pension. Dividends inside an ISA are tax-free and don't count."}
        {" "}It starts again from £0 on 6 April.
      </p>
    </EditorCard>
  );
}

// The user's own pension target for the year, theirs and their employer's,
// up to the allowance. Blank measures against the allowance again.
function PensionTargetEditor({ row, set, onDone }) {
  const [value, setValue] = useState(row.own ? row.target : null);
  const save = () => {
    const own = poundsInput(Math.min(+value || 0, row.limit));
    set(row.field, own);
    posthog.capture("progress_target_saved", { row: row.id, own: !!own });
    onDone();
  };
  return (
    <EditorCard title="Your pension target this tax year" onCancel={onDone} onSave={save}>
      <PillMoneyInput label="Target" value={value} onChange={setValue}/>
      <p style={helpText}>
        Yours and your employer's together, up to your {fmt(row.limit)} allowance. Left blank, progress is measured against the allowance.
      </p>
    </EditorCard>
  );
}

const MONTH_CHOICES = [{ value: "3", label: "3 months" }, { value: "6", label: "6 months" }, { value: "9", label: "9 months" }];

// The months of spending to keep, and the monthly spending: the same two
// answers Cash sizes the emergency fund from.
function EmergencyEditor({ m, set, onDone }) {
  const [months, setMonths] = useState(String(m.bufferMonths));
  const [spending, setSpending] = useState(m.expenses > 0 ? Math.round(m.expenses) : null);
  const save = () => {
    set("emergencyMonths", months);
    if (spending > 0) set("monthlyExpenses", capField("monthlyExpenses", String(Math.round(spending))));
    posthog.capture("progress_target_saved", { row: "emergency", months: +months });
    onDone();
  };
  return (
    <EditorCard title="Emergency fund" onCancel={onDone} onSave={save}>
      <PillSlider value={months} onChange={setMonths} options={MONTH_CHOICES}/>
      <p style={helpText}>{EMERGENCY_MONTHS_HINT[months]}.</p>
      <PillMoneyInput label="Monthly spending" value={spending} onChange={setSpending}/>
      <p style={helpText}>Cash uses the same two answers.</p>
    </EditorCard>
  );
}

// A debt's overpayment target for the tax year, and what's been overpaid so
// far (which starts again on 6 April: rollTaxYear). A student loan's already
// holds each lower balance typed in Student loan (LoanBalanceEditor).
function OverpaymentEditor({ row, set, onDone }) {
  const [target, setTarget] = useState(row.target || null);
  const [paid, setPaid] = useState(row.current || null);
  const save = () => {
    set(row.field, poundsInput(target));
    set(row.paidField, poundsInput(paid));
    posthog.capture("progress_target_saved", { row: row.id, own: +target > 0 });
    onDone();
  };
  return (
    <EditorCard title={`${row.label} overpayments this tax year`} onCancel={onDone} onSave={save}>
      <div style={{display:"flex",gap:"8px"}}>
        <PillMoneyInput label="Target" value={target} onChange={setTarget}/>
        <PillMoneyInput label="Overpaid so far" value={paid} onChange={setPaid}/>
      </div>
      <p style={helpText}>
        {row.id === "studentLoan"
          ? "Payments on top of what's taken from your pay. Updating your balance in Student loan adds what came off it here."
          : "Payments on top of your monthly mortgage payment."}
        {" "}What's overpaid starts again from £0 on 6 April.
      </p>
    </EditorCard>
  );
}

// ── Income against the £100k trap ──────────────────────────────────────

// The Tax shield's band, and its dot from the other views, warn: red in
// the trap, amber within £5,000 of it (progressTracker.js incomePosition's
// zone).
const WARN_ZONE = { in: "red", edge: "amber" };

// On the band: the one figure that says where income sits against the
// trap (in it, the extra tax it costs a year; otherwise how far below
// £100,000), then the bands with a marker at their income.
function ShieldBand({ income, t }) {
  if (income.zone === "none") {
    return <div data-band-keep="figure" style={{...heroFig(t),color:t.body,opacity:0.5}}>£–</div>;
  }
  const { trap, gap } = income;
  return (
    <>
      {income.zone === "in"
        ? trap
          ? <div data-band-keep="figure" style={heroFig(t)}>{fmt(trap.tax)}<span style={unit}>more tax a year</span></div>
          : <div data-band-keep="figure" style={heroFig(t)}>{fmt(income.income - 100000)}<span style={unit}>over £100k</span></div>
        : gap === 0
          ? <div data-band-keep="figure" style={heroFig(t)}>£100,000<span style={unit}>the trap's edge</span></div>
          : <div data-band-keep="figure" style={heroFig(t)}>{fmt(gap)}<span style={unit}>{income.zone === "clear" ? "below £100k" : "to £100k"}</span></div>}
      <BandTrack income={income} t={t}/>
    </>
  );
}

// On the cream below: what the band's figure means, as figures rather than
// an instruction; in the trap or within £5,000 of it, in a red or amber
// alert. Then adjusted net income, explained, as the small print, what a
// pension contribution would do, and the way into the trap's module.
function ShieldDetails({ income, t, onOpenTrap }) {
  if (income.zone === "none") {
    return <p style={{...cardText(t),margin:0}}>Where your income sits against the £100k trap shows here once your pay is entered.</p>;
  }
  const { trap, gap, perThousand, rise } = income;
  const trapRate = income.bands.find(b => b.name === "£100k tax trap").rateLabel;
  const past = `Past £100,000, each £1,000 more costs ${fmt(perThousand.trap)} in income tax rather than ${fmt(perThousand.now)}, as the Personal Allowance is withdrawn.`;
  const more = rise?.tax > 0 ? ` ${fmt(rise.by)} more would mean ${fmt(rise.tax)} of extra tax a year from the trap.` : "";
  const pension = trap?.takeHome == null ? null : trap.route === "sacrifice"
    ? `Salary sacrifice of ${fmt(trap.needed)} into your pension would bring it back to £100,000, for ${fmt(trap.takeHome)} less take-home pay.`
    : `Paying ${fmt(trap.needed)} more into your pension would bring it back to £100,000, for ${fmt(trap.takeHome)} less take-home pay after tax relief.`;
  return (
    <>
      {income.zone === "in" ? !trap ? (
        <p style={{...cardText(t),margin:0}}>{fmt(income.income - 100000)} over £100,000, where the Personal Allowance is withdrawn.</p>
      ) : (
        <Alert tone="red" t={t} title={trap.aboveTaper ? "Your Personal Allowance is gone" : `You're in the ${trap.rateLabel} tax trap`}>
          <p style={cardText(t)}>
            {trap.aboveTaper
              ? `${fmt(trap.tax)} more tax a year, as over £125,140 all ${fmt(trap.allowanceLost)} of your Personal Allowance is withdrawn.`
              : `${fmt(trap.tax)} more tax a year, as ${fmt(trap.over)} over £100,000 withdraws ${fmt(trap.allowanceLost)} of your Personal Allowance.`}
            {trap.childcareLost > 0 && ` ${fmt(trap.childcareLost)} a year of childcare support stops too.`}
          </p>
        </Alert>
      ) : income.zone === "edge" ? (
        <Alert tone="amber" t={t} title={gap > 0 ? `Within ${fmt(TRAP_EDGE)} of the ${trapRate} tax trap` : `At £100,000, the edge of the ${trapRate} tax trap`}>
          <p style={cardText(t)}>{past}{more}</p>
        </Alert>
      ) : (
        <p style={{...cardText(t),margin:0}}>
          {income.zone === "near" ? `${past}${more}`
            : `Clear of £100,000, where each £1,000 more starts costing ${fmt(perThousand.trap)} in income tax rather than ${fmt(perThousand.now)}.`}
        </p>
      )}
      <p style={{fontSize:"12px",color:t.body,lineHeight:1.45,margin:"12px 0 0"}}>
        <span style={{fontWeight:700,color:t.figure}}>{fmt(income.income)}</span> adjusted net income this tax year, the gold marker above, which the trap is measured on: taxable income less pension contributions and Gift Aid.{income.scottish ? " Scottish rates on pay." : ""}
      </p>
      {pension && (
        <p style={{...cardText(t),fontSize:"12px"}}>
          {pension}{!trap.fits && ` That's more than the ${fmt(trap.aaRoom)} of Annual Allowance left this year.`}
        </p>
      )}
      {trap && (
        <button type="button" onClick={onOpenTrap}
          style={{marginTop:"10px",background:"none",border:"none",padding:0,fontSize:"13px",fontWeight:700,color:t.figure,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:"2px"}}>
          Open £100k tax trap<ChevronRight size={14}/>
        </button>
      )}
    </>
  );
}

const SCALE_TO = 150000;
// Which threshold labels to keep when they'd overlap: the trap's first.
const TICK_PRIORITY = { "£100k tax trap": 0, "Additional rate": 1, "Top rate": 1, "Higher rate": 2, "Advanced rate": 3 };

// The bands as one bar, shaded deeper the higher the income tax rate on the
// next £1 (one hue, so the trap reads as the deepest band), the rate inside
// each band where it fits, a gold marker at their income, and threshold
// labels under it, left out where they'd collide.
function BandTrack({ income, t }) {
  const [ref, width] = useElementWidth(300);
  const dark = t === DARK;
  const ink = dark ? "246,234,208" : "22,47,36";
  const x = v => Math.min(1, v / SCALE_TO) * width;
  const bands = income.bands.filter(b => b.from < SCALE_TO);
  const marker = Math.min(Math.max(x(income.income) - 2, 0), width - 4);
  // A band's rate sits in its middle, or beside the marker when the marker
  // would cover it, on whichever side has room; with room on neither, it's
  // left out (the band's name and rate are written under the bar anyway).
  const rateAt = (left, w, label) => {
    const lw = label.length * 6.5 + 10, mid = marker + 2;
    if (w < lw) return null;
    if (Math.abs(mid - (left + w / 2)) >= lw / 2 + 4) return left + w / 2 - lw / 2;
    const before = mid - 4 - left, after = left + w - (mid + 4);
    if (Math.max(before, after) < lw) return null;
    return after >= before ? mid + 4 + (after - lw) / 2 : left + (before - lw) / 2;
  };
  const ticks = [];
  for (const b of bands.slice(1).sort((p, q) => (TICK_PRIORITY[p.name] ?? 4) - (TICK_PRIORITY[q.name] ?? 4))) {
    // About 5.5px a character at 10.5px ("£100,000" is 44px), a little over.
    const text = fmt(b.from), w = text.length * 5.6 + 2;
    const left = Math.min(Math.max(x(b.from) - w / 2, 0), width - w);
    if (!ticks.some(tk => left < tk.left + tk.w + 4 && tk.left < left + w + 4)) ticks.push({ text, w, left });
  }
  return (
    <div aria-hidden="true">
      <div ref={ref} style={{position:"relative",height:"22px",marginTop:"16px"}}>
        {bands.map((b, i) => {
          const left = x(b.from) + (i ? 1 : 0);
          const w = Math.max(0, x(Math.min(b.to, SCALE_TO)) - (i < bands.length - 1 ? 1 : 0) - left);
          const alpha = 0.12 + b.rate * 1.2;
          const labelAt = rateAt(left, w, b.rateLabel);
          return (
            <div key={b.from}>
              <div style={{position:"absolute",top:0,bottom:0,left:`${left}px`,width:`${w}px`,background:`rgba(${ink},${alpha})`,
                borderRadius:i === 0 ? "6px 0 0 6px" : i === bands.length - 1 ? "0 6px 6px 0" : 0}}/>
              {labelAt != null && (
                <span style={{position:"absolute",top:0,bottom:0,left:`${labelAt}px`,width:`${b.rateLabel.length * 6.5 + 10}px`,display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:"10.5px",fontWeight:700,color:alpha >= 0.5 ? (dark ? "#0e2219" : WHITE) : (dark ? t.figure : TEXT),whiteSpace:"nowrap"}}>{b.rateLabel}</span>
              )}
            </div>
          );
        })}
        <div style={{position:"absolute",top:"-5px",bottom:"-5px",left:`${marker}px`,width:"4px",borderRadius:"2px",background:GOLD,boxShadow:`0 0 0 2px ${dark ? "#0e2219" : WHITE}`}}/>
      </div>
      <div style={{position:"relative",height:"14px",marginTop:"6px"}}>
        {ticks.map(tk => (
          <span key={tk.text} style={{position:"absolute",left:`${tk.left}px`,width:`${tk.w}px`,textAlign:"center",fontSize:"10.5px",color:t.body,whiteSpace:"nowrap"}}>{tk.text}</span>
        ))}
      </div>
    </div>
  );
}
