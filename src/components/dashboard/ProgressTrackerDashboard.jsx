import { useState } from "react";
import posthog from "posthog-js";
import { ChevronRight } from "lucide-react";
import { buildProgressSnapshot, poundsInput } from "../../lib/progressTracker.js";
import { EMERGENCY_MONTHS_HINT } from "../../lib/metrics.js";
import { capField } from "../../lib/onboarding.js";
import { fmt, fmtK1 } from "../../lib/format.js";
import { useElementWidth } from "../../mobile/useElementWidth.js";
import PillMoneyInput from "../../mobile/PillMoneyInput.jsx";
import { PillSlider } from "../../mobile/PillSlider.jsx";
import {
  G, GOLD, WHITE, MUT, TEXT, SERIF, SUCCESS, RADIUS_CARD, STATUS_TILE, PROVIDER_TILE_SHADOW, MODULE_CHART_COLOR,
} from "../../design-tokens.js";
import { Tile, BarTile, ProgressBar, lockedBar, Figure, Details, TextButton, EditorCard, helpText } from "./ProgressParts.jsx";
import { AddGoalTile, VaultTile, saveVault, removeVault } from "./GoalVaults.jsx";

// The Progress tab (/app/progress): what net worth is made of, how this tax
// year's goals are going, the goals themselves with any goal pots, and where
// income sits against the tax bands, each in its own tile. The figures come
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
// Each goal's bar in the colour of what it builds in the net worth ring (ISA:
// Investments; the emergency fund and cash interest: Cash), or for a debt
// its module's chart colour.
const GOAL_COLOR = {
  isa: PART_COLOR.investments,
  pension: PART_COLOR.pension,
  emergency: PART_COLOR.cash,
  cashInterest: PART_COLOR.cash,
  mortgage: PART_COLOR.home,
  studentLoan: MODULE_CHART_COLOR.studentLoan,
};

export default function ProgressTrackerDashboard({ d, m, statuses, set, onOpenModule }) {
  // The goal tile showing its details ("add", "row:<id>" or "vault:<id>"),
  // and the one form open in it ("row:<id>" or "vault:<id>"; Add a goal's
  // form is its details).
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const { rows, annual, netWorth, vaults, income } = buildProgressSnapshot(d, m, statuses);
  const toggle = key => { setExpanded(e => (e === key ? null : key)); setEditing(null); };
  const close = () => setEditing(null);
  const openModule = key => {
    posthog.capture("progress_module_opened", { module: key });
    onOpenModule?.(key);
  };

  return (
    <div>
      {/* Net worth leads the headline pair, with three times the room of the
          annual goals beside it (never under 112px, so the ring reads on a
          phone); stacked only on the narrowest phones. */}
      <style>{`
        .progress-summary { display: grid; grid-template-columns: minmax(0, 3fr) minmax(112px, 1fr); gap: 12px; }
        @media (max-width: 359px) { .progress-summary { grid-template-columns: minmax(0, 1fr); } }
      `}</style>

      <h1 style={{fontFamily:SERIF,fontSize:"22px",color:G,fontWeight:700,margin:"0 0 16px",lineHeight:1.2}}>Your progress</h1>

      <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
        <div className="progress-summary">
          <Tile title="Net worth" wash>
            <NetWorth picture={netWorth}/>
          </Tile>
          <Tile title="Annual goals" wash>
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",marginTop:"12px"}}>
              <Ring pct={annual.total ? annual.pct : null} hits={annual.hits} total={annual.total}/>
            </div>
          </Tile>
        </div>

        {/* Add a goal first, then the user's pots (newest first), then this
            tax year's goals from the modules. */}
        <Tile title="Goals">
          <div style={{display:"flex",flexDirection:"column",gap:"10px",marginTop:"12px"}}>
            <AddGoalTile names={vaults.map(v => v.name)} open={expanded === "add"} onToggle={() => toggle("add")}
              onSave={vault => { saveVault(d, set, vault, { added: true, fromGoal: false }); setExpanded(null); }}/>
            {vaults.map(v => {
              const key = `vault:${v.id}`;
              return (
                <VaultTile key={v.id} vault={v} names={vaults.map(x => x.name)} open={expanded === key} onToggle={() => toggle(key)}
                  editing={editing === key} onEdit={() => setEditing(key)} onCancel={close}
                  onSave={next => { saveVault(d, set, next, { added: false, fromGoal: v.fromGoal }); close(); }}
                  onRemove={() => { removeVault(d, set, v); close(); setExpanded(null); }}/>
              );
            })}
            {rows.map(row => {
              const key = `row:${row.id}`;
              return (
                <GoalTile key={row.id} row={row} open={expanded === key} onToggle={() => toggle(key)}
                  editing={editing === key} onEdit={() => setEditing(key)} onOpenModule={openModule}
                  editor={editing === key && <RowEditor row={row} m={m} set={set} onDone={close}/>}/>
              );
            })}
          </div>
        </Tile>

        <Tile title="Tax shield & income band">
          <IncomeBands income={income} onOpenTrap={() => {
            posthog.capture("progress_trap_opened", { above_taper: !!income.trap?.aboveTaper });
            onOpenModule?.("taxTrap");
          }}/>
        </Tile>
      </div>
    </div>
  );
}

// ── Headline ───────────────────────────────────────────────────────────

// Average progress across this tax year's goals below (the modules'; pots
// have their own dates), as a ring that fills to it, with the figure plain
// inside (as Home's score: CLAUDE.md rule 4) and how many are reached. With
// none to measure yet, an empty ring. Sized to its tile, up to `size`.
function Ring({ pct, hits, total, size = 120, stroke = 10 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, centre = size / 2;
  const filled = ((pct || 0) / 100) * c;
  return (
    <div role="img" aria-label={pct == null ? "No goals to measure yet" : `${pct}% complete, ${hits} of ${total} goals reached`}
      style={{position:"relative",flex:`0 1 ${size}px`,minWidth:0,maxWidth:`${size}px`,aspectRatio:"1 / 1"}}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{transform:"rotate(-90deg)",display:"block"}} aria-hidden="true">
        <circle cx={centre} cy={centre} r={r} fill="none" stroke="rgba(45,107,74,0.14)" strokeWidth={stroke}/>
        {filled > 0 && (
          <circle cx={centre} cy={centre} r={r} fill="none" stroke={SUCCESS} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${filled} ${c}`}/>
        )}
      </svg>
      <div aria-hidden="true" style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontFamily:SERIF,fontSize:"22px",fontWeight:700,color:pct == null ? MUT : TEXT,lineHeight:1}}>{pct == null ? "–" : `${pct}%`}</span>
        <span style={{fontSize:"11px",color:MUT,marginTop:"4px"}}>({hits} of {total})</span>
      </div>
    </div>
  );
}

// Net worth as a ring of what it's made of with the figure in the middle,
// and beside it (below it, when the tile is narrow) a legend naming each
// part with its value in £k, then gross assets and total debt. Pointing at a
// part, or its legend row, brings that part forward.
function NetWorth({ picture }) {
  const [active, setActive] = useState(null);
  const shown = picture.parts.filter(p => p.value > 0);
  const dim = id => active !== null && active !== id;
  const line = (label, value) => (
    <div style={{display:"flex",justifyContent:"space-between",gap:"8px",fontSize:"12px"}}>
      <dt style={{color:MUT}}>{label}</dt>
      <dd style={{margin:0,fontWeight:700,color:TEXT,whiteSpace:"nowrap"}}>{value}</dd>
    </div>
  );
  return (
    <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"center",gap:"14px 20px",marginTop:"12px"}}>
      <Donut parts={shown} netWorth={picture.netWorth} dim={dim} onPoint={setActive}/>
      <div style={{flex:"1 1 150px",minWidth:0}}>
        {shown.length > 0 ? (
          <ul style={{listStyle:"none",margin:0,padding:0,display:"flex",flexDirection:"column",gap:"7px"}}>
            {shown.map(p => (
              <li key={p.id} onMouseEnter={() => setActive(p.id)} onMouseLeave={() => setActive(null)}
                style={{display:"flex",alignItems:"center",gap:"7px",opacity:dim(p.id) ? 0.45 : 1,transition:"opacity 0.15s"}}>
                <span style={{width:"8px",height:"8px",borderRadius:"50%",background:PART_COLOR[p.id],flexShrink:0}}/>
                <span style={{fontSize:"12.5px",color:TEXT,flex:1,minWidth:0}}>{p.label}</span>
                <span style={{fontSize:"12.5px",fontWeight:600,color:TEXT,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{fmtK1(p.value)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={helpText}>Savings, investments and pensions show here once they're entered.</p>
        )}
        <dl style={{margin:"12px 0 0",paddingTop:"10px",borderTop:"1px solid rgba(22,47,36,0.08)",display:"flex",flexDirection:"column",gap:"4px"}}>
          {line("Gross assets", fmtK1(picture.grossAssets))}
          {line("Total debt", fmtK1(picture.totalDebt))}
        </dl>
      </div>
    </div>
  );
}

function Donut({ parts, netWorth, dim, onPoint, size = 180, stroke = 20 }) {
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
    <div style={{position:"relative",flex:`0 1 ${size}px`,minWidth:0,maxWidth:`${size}px`,aspectRatio:"1 / 1"}}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{transform:"rotate(-90deg)",display:"block"}} aria-hidden="true">
        {total === 0 && <circle cx={centre} cy={centre} r={r} fill="none" stroke="rgba(22,47,36,0.07)" strokeWidth={stroke}/>}
        {arcs.map(a => (
          <circle key={a.id} cx={centre} cy={centre} r={r} fill="none" stroke={PART_COLOR[a.id]} strokeWidth={stroke}
            strokeDasharray={a.dash} strokeDashoffset={a.offset} opacity={dim(a.id) ? 0.3 : 1}
            onMouseEnter={() => onPoint(a.id)} onMouseLeave={() => onPoint(null)} style={{transition:"opacity 0.15s"}}/>
        ))}
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
        <span style={{fontFamily:SERIF,fontWeight:700,color:TEXT,lineHeight:1,fontSize:"24px"}}>
          {netWorth < 0 ? "−" : ""}{fmtK1(netWorth)}
        </span>
      </div>
    </div>
  );
}

// ── Goals ──────────────────────────────────────────────────────────────

// A goal's tile: locked (greyed out until its module is answered, the
// greying its one sign of that: CLAUDE.md rule 4), measured (its bar and
// figures), or open without a target. Opening it gives the figures in full
// and what can be changed: for a locked one, the module that unlocks it.
function GoalTile({ row, open, onToggle, editing, onEdit, onOpenModule, editor }) {
  const bar = row.locked ? lockedBar
    : row.tracked ? <ProgressBar pct={row.pct} color={GOAL_COLOR[row.id]} label={row.label}/>
    : <span style={{fontSize:"12px",color:MUT}}>{row.id === "emergency" ? "Spending not entered" : "No target set"}</span>;
  const figure = row.locked ? null
    : row.target > 0 ? <Figure current={row.current} target={row.target}/>
    : row.current > 0 ? <Figure current={row.current}/> : null;
  const action = row.paidField ? (row.tracked ? "Update" : "Set a target")
    : row.id === "emergency" ? (row.tracked ? "Edit" : "Add spending")
    : row.own ? "Edit target" : "Set your own target";
  return (
    <BarTile title={row.label} bar={bar} figure={figure} locked={row.locked} open={open} onToggle={onToggle}>
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

function RowEditor({ row, m, set, onDone }) {
  if (row.id === "emergency") return <EmergencyEditor m={m} set={set} onDone={onDone}/>;
  if (row.paidField) return <OverpaymentEditor row={row} set={set} onDone={onDone}/>;
  return <PensionTargetEditor row={row} set={set} onDone={onDone}/>;
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

// ── Income against the tax bands ───────────────────────────────────────

const SCALE_TO = 150000;
// Which threshold labels to keep when they'd overlap: the trap's first.
const TICK_PRIORITY = { "£100k tax trap": 0, "Additional rate": 1, "Top rate": 1, "Higher rate": 2, "Advanced rate": 3 };

function IncomeBands({ income, onOpenTrap }) {
  return (
    <>
      {income.income > 0 ? (
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:"12px",marginTop:"12px"}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:"14px",fontWeight:700,color:TEXT}}>{income.band.name}, {income.band.rateLabel}</div>
              <div style={{fontSize:"12px",color:MUT,marginTop:"2px"}}>Adjusted net income this tax year</div>
            </div>
            <span style={{fontFamily:SERIF,fontSize:"22px",fontWeight:700,color:TEXT,whiteSpace:"nowrap"}}>{fmt(income.income)}</span>
          </div>
          <BandTrack income={income}/>
          <p style={{...helpText,marginTop:"10px"}}>
            {income.context}{income.scottish ? " Scottish rates on pay." : ""}
          </p>
        </>
      ) : (
        <p style={{...helpText,marginTop:"8px"}}>Where your income sits against the tax bands shows here once your pay is entered.</p>
      )}
      {income.trap && <TrapAlert trap={income.trap} onOpen={onOpenTrap}/>}
    </>
  );
}

// The bands as one bar, shaded deeper the higher the income tax rate on the
// next £1 (one hue, so the trap reads as the deepest band), the rate inside
// each band where it fits, a gold marker at their income, and threshold
// labels under it, left out where they'd collide.
function BandTrack({ income }) {
  const [ref, width] = useElementWidth(320);
  const x = v => Math.min(1, v / SCALE_TO) * width;
  const bands = income.bands.filter(b => b.from < SCALE_TO);
  const marker = Math.min(Math.max(x(income.income) - 2, 0), width - 4);
  // A band's rate sits in its middle, or beside the marker when the marker
  // would cover it, on whichever side has room; with room on neither, it's
  // left out (the band's name and rate are written above the bar anyway).
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
    if (!ticks.some(t => left < t.left + t.w + 4 && t.left < left + w + 4)) ticks.push({ text, w, left });
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
              <div style={{position:"absolute",top:0,bottom:0,left:`${left}px`,width:`${w}px`,background:`rgba(22,47,36,${alpha})`,
                borderRadius:i === 0 ? "6px 0 0 6px" : i === bands.length - 1 ? "0 6px 6px 0" : 0}}/>
              {labelAt != null && (
                <span style={{position:"absolute",top:0,bottom:0,left:`${labelAt}px`,width:`${b.rateLabel.length * 6.5 + 10}px`,display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:"10.5px",fontWeight:700,color:alpha >= 0.5 ? WHITE : TEXT,whiteSpace:"nowrap"}}>{b.rateLabel}</span>
              )}
            </div>
          );
        })}
        <div style={{position:"absolute",top:"-5px",bottom:"-5px",left:`${marker}px`,width:"4px",borderRadius:"2px",background:GOLD,boxShadow:`0 0 0 2px ${WHITE}`}}/>
      </div>
      <div style={{position:"relative",height:"14px",marginTop:"6px"}}>
        {ticks.map(t => (
          <span key={t.text} style={{position:"absolute",left:`${t.left}px`,width:`${t.w}px`,textAlign:"center",fontSize:"10.5px",color:MUT,whiteSpace:"nowrap"}}>{t.text}</span>
        ))}
      </div>
    </div>
  );
}

// Over £100,000: what the trap costs and what getting back under it would
// take (from the tax trap module), as figures rather than an instruction,
// with the module a tap away.
function TrapAlert({ trap, onOpen }) {
  const tile = STATUS_TILE.tight;
  const pension = trap.takeHome == null ? null : trap.route === "sacrifice"
    ? `Salary sacrifice of ${fmt(trap.needed)} into your pension would bring it back to £100,000, for ${fmt(trap.takeHome)} less take-home pay.`
    : `Paying ${fmt(trap.needed)} more into your pension would bring it back to £100,000, for ${fmt(trap.takeHome)} less take-home pay after tax relief.`;
  return (
    <div style={{marginTop:"16px",background:tile.background,border:tile.border,borderRadius:RADIUS_CARD,boxShadow:PROVIDER_TILE_SHADOW,padding:"16px"}}>
      <div style={{fontSize:"14.5px",fontWeight:700,color:TEXT,lineHeight:1.35}}>
        {trap.aboveTaper ? "Your Personal Allowance is gone" : `You're in the ${trap.rateLabel} tax trap`}
      </div>
      <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,margin:"6px 0 0"}}>
        {trap.aboveTaper
          ? `Over £125,140, all ${fmt(trap.allowanceLost)} of it is withdrawn: ${fmt(trap.tax)} more tax a year.`
          : `Adjusted net income ${fmt(trap.over)} over £100,000 withdraws ${fmt(trap.allowanceLost)} of your Personal Allowance: ${fmt(trap.tax)} more tax a year.`}
        {trap.childcareLost > 0 && ` ${fmt(trap.childcareLost)} a year of childcare support stops too.`}
      </p>
      {pension && (
        <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,margin:"6px 0 0"}}>
          {pension}{!trap.fits && ` That's more than the ${fmt(trap.aaRoom)} of Annual Allowance left this year.`}
        </p>
      )}
      <button type="button" onClick={onOpen} style={{marginTop:"12px",display:"inline-flex",alignItems:"center",gap:"4px",background:G,border:"none",borderRadius:"100px",padding:"10px 16px",color:WHITE,fontSize:"13px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
        Open £100k tax trap
        <ChevronRight size={14}/>
      </button>
    </div>
  );
}
