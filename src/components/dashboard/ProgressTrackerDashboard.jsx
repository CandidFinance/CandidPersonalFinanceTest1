import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { ChevronRight } from "lucide-react";
import { buildProgressSnapshot, sortGoals, GOAL_SORTS, poundsInput, withAllowanceGoal, TRAP_EDGE } from "../../lib/progressTracker.js";
import { EMERGENCY_MONTHS_HINT } from "../../lib/metrics.js";
import { capField } from "../../lib/onboarding.js";
import { fmt, fmtK1 } from "../../lib/format.js";
import { taxYearOf, taxYearShort } from "../../lib/taxYear.js";
import { hasAccess, withFeatureUsed } from "../../lib/entitlement.js";
import { useElementWidth } from "../../mobile/useElementWidth.js";
import CardStack, { DARK } from "../../mobile/CardStack.jsx";
import Alert from "../../mobile/AlertBox.jsx";
import FilterMenu from "../../mobile/FilterMenu.jsx";
import PillMoneyInput from "../../mobile/PillMoneyInput.jsx";
import { PillSlider } from "../../mobile/PillSlider.jsx";
import {
  G, GOLD, WHITE, MUT, TEXT, SERIF, SANS, PROGRESS_GREEN, MODULE_CHART_COLOR,
} from "../../design-tokens.js";
import { Tile, BarTile, AllowanceIcon, ProgressBar, ReachedMark, useReachedReveal, lockedBar, Figure, Details, TextButton, EditorCard, helpText } from "./ProgressParts.jsx";
import { AddGoalTile, VaultTile, saveVault, removeVault } from "./GoalVaults.jsx";

// The Progress tab (/app/progress): three cards in a wallet stack, as on
// Home (CardStack.jsx): net worth and what it's made of, how this tax
// year's goals are going, and where income sits against the £100k trap.
// Below them, the goals themselves with any goal pots. The figures come
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

export default function ProgressTrackerDashboard({ d, m, statuses, set, celebrating = [], onOpenModule }) {
  // The goal tile showing its details ("add", "row:<id>" or "vault:<id>"),
  // and the one form open in it ("row:<id>" or "vault:<id>"; Add a goal's
  // form is its details).
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const { rows, annual, netWorth, vaults, income } = buildProgressSnapshot(d, m, statuses);
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

  // Net worth leads. Each card's top line shows while it's behind.
  const cards = [
    { key: "netWorth", label: "Net worth", amount: `${netWorth.netWorth < 0 ? "−" : ""}${fmtK1(netWorth.netWorth)}`,
      body: t => <NetWorth picture={netWorth} t={t}/> },
    { key: "goals", label: `Goals ${taxYearShort(taxYear)}`, amount: annual.total ? `${annual.pct}%` : "",
      body: t => <AnnualGoals annual={annual} t={t}/> },
    { key: "taxShield", label: "Tax shield", amount: shieldLine(income), amountSans: true, warn: WARN_ZONE[income.zone],
      body: t => <TaxShield income={income} t={t} onOpenTrap={openTrap}/> },
  ];

  return (
    <div>
      <style>{GOALS_CSS}</style>
      <h1 style={{fontFamily:SERIF,fontSize:"22px",color:G,fontWeight:700,margin:"0 0 16px",lineHeight:1.2}}>Your progress</h1>

      <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
        <section aria-label="Your figures" data-tour="progress-cards">
          <CardStack cards={cards}/>
        </section>

        {/* Add a goal first, then the goals in the order picked: as built,
            the user's pots (newest first) then this tax year's goals from the
            modules (sortGoals). */}
        <Tile title="Goals" tour="progress-goals"
          action={<FilterMenu label="Sort goals" options={GOAL_SORTS} value={sortBy} defaultValue="default" onChange={pickSort}/>}>
          <div style={{display:"flex",flexDirection:"column",gap:"10px",marginTop:"12px"}}>
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
        </Tile>
      </div>
    </div>
  );
}

// ── The stack's cards ──────────────────────────────────────────────────
// Each drawn in the colours `t` it's wearing (CardStack.jsx): DARK in front.

// A card's lead figure, in the serif at the stack's size, with its unit.
const heroFig = t => ({ fontFamily:SERIF, fontSize:"var(--hero-fig)", fontWeight:700, color:t.figure, lineHeight:1, letterSpacing:"-0.01em", marginTop:"8px" });
const unit = { fontFamily:SANS, fontSize:"0.32em", fontWeight:600, marginLeft:"5px", letterSpacing:0, whiteSpace:"nowrap" };
const cardText = t => ({ fontSize:"13px", color:t.body, lineHeight:1.45, margin:"8px 0 0" });

// Net worth, then a ring of what it's made of and beside it (below it,
// when the card is narrow) a legend naming each part with its value in £k,
// then gross assets and total debt. Pointing at a part, or its legend row,
// brings that part forward.
function NetWorth({ picture, t }) {
  const [active, setActive] = useState(null);
  const shown = picture.parts.filter(p => p.value > 0);
  const dim = id => active !== null && active !== id;
  const line = (label, value) => (
    <div style={{display:"flex",justifyContent:"space-between",gap:"8px",fontSize:"12px"}}>
      <dt style={{color:t.body}}>{label}</dt>
      <dd style={{margin:0,fontWeight:700,color:t.figure,whiteSpace:"nowrap"}}>{value}</dd>
    </div>
  );
  return (
    <>
      <div style={heroFig(t)}>{picture.netWorth < 0 ? "−" : ""}{fmtK1(picture.netWorth)}</div>
      <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"14px 20px",marginTop:"14px"}}>
        <Donut parts={shown} dim={dim} onPoint={setActive} track={t.track}/>
        <div style={{flex:"1 1 150px",minWidth:0}}>
          {shown.length > 0 ? (
            <ul style={{listStyle:"none",margin:0,padding:0,display:"flex",flexDirection:"column",gap:"7px"}}>
              {shown.map(p => (
                <li key={p.id} onMouseEnter={() => setActive(p.id)} onMouseLeave={() => setActive(null)}
                  style={{display:"flex",alignItems:"center",gap:"7px",opacity:dim(p.id) ? 0.45 : 1,transition:"opacity 0.15s"}}>
                  <span style={{width:"8px",height:"8px",borderRadius:"50%",background:PART_COLOR[p.id],flexShrink:0}}/>
                  <span style={{fontSize:"12.5px",color:t.figure,flex:1,minWidth:0}}>{p.label}</span>
                  <span style={{fontSize:"12.5px",fontWeight:600,color:t.figure,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{fmtK1(p.value)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{...helpText,color:t.body}}>Savings, investments and pensions show here once they're entered.</p>
          )}
          <dl style={{margin:"12px 0 0",paddingTop:"10px",borderTop:`1px solid ${t.rule}`,display:"flex",flexDirection:"column",gap:"4px"}}>
            {line("Gross assets", fmtK1(picture.grossAssets))}
            {line("Total debt", fmtK1(picture.totalDebt))}
          </dl>
        </div>
      </div>
    </>
  );
}

// The ring of net worth's parts. The figure itself is the card's lead, so
// it isn't repeated in the middle (CLAUDE.md rule 4).
function Donut({ parts, dim, onPoint, track, size = 120, stroke = 15 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, centre = size / 2;
  const total = parts.reduce((s, p) => s + p.value, 0);
  // A 2px gap of background between neighbouring parts, rather than a drawn
  // border; none for a single part, which is the whole ring.
  const gap = parts.length > 1 ? 2 : 0;
  let start = 0;
  const arcs = parts.map(p => {
    const len = (p.value / total) * c;
    const arc = { ...p, dash: `${Math.max(0.5, len - gap)} ${c}`, offset: -start };
    start += len;
    return arc;
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{transform:"rotate(-90deg)",display:"block",flexShrink:0}} aria-hidden="true">
      {total === 0 && <circle cx={centre} cy={centre} r={r} fill="none" stroke={track} strokeWidth={stroke}/>}
      {arcs.map(a => (
        <circle key={a.id} cx={centre} cy={centre} r={r} fill="none" stroke={PART_COLOR[a.id]} strokeWidth={stroke}
          strokeDasharray={a.dash} strokeDashoffset={a.offset} opacity={dim(a.id) ? 0.3 : 1}
          onMouseEnter={() => onPoint(a.id)} onMouseLeave={() => onPoint(null)} style={{transition:"opacity 0.15s"}}/>
      ))}
    </svg>
  );
}

// Average progress across this tax year's goals below (the modules'; pots
// have their own dates), as a ring that fills to it, with the figure plain
// inside and how many are reached. With none to measure yet, an empty ring.
// On a phone the ring is larger with the text under it, filling the card
// to the stack's height; on desktop, the ring beside the text.
const GOALS_CSS = `
.progress-goals { display: flex; flex-direction: column; align-items: center; gap: 14px; margin-top: 14px; text-align: center; --ring: 168px; }
@media (min-width: 1000px) { .progress-goals { flex-direction: row; gap: 18px; margin-top: 12px; text-align: left; --ring: 104px; } }
`;
function AnnualGoals({ annual, t }) {
  return (
    <div className="progress-goals">
      <Ring pct={annual.total ? annual.pct : null} hits={annual.hits} total={annual.total} t={t}/>
      <p style={{...cardText(t),margin:0}}>
        {annual.total
          ? "Average progress across this tax year's goals, to 5 April. Each goal is listed below."
          : "This tax year's goals are measured here once the modules they come from are answered."}
      </p>
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
        <span style={{fontFamily:SERIF,fontSize:"calc(var(--ring) * 0.23)",fontWeight:700,color:pct == null ? t.body : t.figure,lineHeight:1}}>{pct == null ? "–" : `${pct}%`}</span>
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
// answers Cash & savings sizes the emergency fund from.
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
      <p style={helpText}>Cash & savings uses the same two answers.</p>
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

// Behind, the Tax shield card warns: red in the trap, amber within £5,000
// of it (progressTracker.js incomePosition's zone).
const WARN_ZONE = { in: "red", edge: "amber" };

// The Tax shield's top line: where income sits against £100,000.
function shieldLine(income) {
  if (income.zone === "none") return "Pay not entered";
  if (income.zone === "in") return `${fmt(income.trap?.over ?? income.income - 100000)} into the £100k trap`;
  if (income.gap === 0) return "At the £100k trap";
  if (income.zone === "clear") return "Safe from £100k trap";
  return `${fmt(income.gap)} from the £100k trap`;
}

// Leads with where income sits against the trap and what it costs, or
// would cost, as figures rather than an instruction; in the trap or within
// £5,000 of it, in a red or amber alert. Then the bands with a marker at
// their income, and adjusted net income, explained, as the small print.
function TaxShield({ income, t, onOpenTrap }) {
  if (income.zone === "none") {
    return <p style={cardText(t)}>Where your income sits against the £100k trap shows here once your pay is entered.</p>;
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
        <p style={cardText(t)}>{fmt(income.income - 100000)} over £100,000, where the Personal Allowance is withdrawn.</p>
      ) : (
        <Alert tone="red" t={t} title={trap.aboveTaper ? "Your Personal Allowance is gone" : `You're in the ${trap.rateLabel} tax trap`}>
          <div style={heroFig(t)}>{fmt(trap.tax)}<span style={unit}>a year</span></div>
          <p style={cardText(t)}>
            {trap.aboveTaper
              ? `More tax, as over £125,140 all ${fmt(trap.allowanceLost)} of your Personal Allowance is withdrawn.`
              : `More tax, as ${fmt(trap.over)} over £100,000 withdraws ${fmt(trap.allowanceLost)} of your Personal Allowance.`}
            {trap.childcareLost > 0 && ` ${fmt(trap.childcareLost)} a year of childcare support stops too.`}
          </p>
        </Alert>
      ) : income.zone === "edge" ? (
        <Alert tone="amber" t={t} title={gap > 0 ? `Within ${fmt(TRAP_EDGE)} of the ${trapRate} tax trap` : `At £100,000, the edge of the ${trapRate} tax trap`}>
          {gap > 0 && <div style={heroFig(t)}>{fmt(gap)}<span style={unit}>to £100k</span></div>}
          <p style={cardText(t)}>{past}{more}</p>
        </Alert>
      ) : (
        <>
          <div style={heroFig(t)}>{fmt(gap)}<span style={unit}>{income.zone === "near" ? "to £100k" : "below £100k"}</span></div>
          <p style={cardText(t)}>
            {income.zone === "near" ? `${past}${more}`
              : `Clear of £100,000, where each £1,000 more starts costing ${fmt(perThousand.trap)} in income tax rather than ${fmt(perThousand.now)}.`}
          </p>
        </>
      )}
      <BandTrack income={income} t={t}/>
      <p style={{fontSize:"12px",color:t.body,lineHeight:1.45,margin:"8px 0 0"}}>
        <span style={{fontWeight:700,color:t.figure}}>{fmt(income.income)}</span> adjusted net income this tax year, which the trap is measured on: taxable income less pension contributions and Gift Aid.{income.scottish ? " Scottish rates on pay." : ""}
      </p>
      {pension && (
        <p style={{...cardText(t),fontSize:"12.5px"}}>
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
