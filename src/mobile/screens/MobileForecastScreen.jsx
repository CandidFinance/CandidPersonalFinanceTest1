import { useId, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useElementWidth } from "../useElementWidth.js";
import { Lock, ChevronRight } from "lucide-react";
import { ScreenBand, ScreenSheet, SCREEN_TITLE } from "../ScreenBand.jsx";
import { calcForecast, calcForecastSeries, calcNetWorthTrajectory, buildForecastAssumptions } from "../../lib/forecast.js";
import { fmt, fmtK1, fmtCompact, formatThousands } from "../../lib/format.js";
import posthog from "posthog-js";
import PillMoneyInput, { PILL_ANSWER_TEXT } from "../PillMoneyInput.jsx";
import { PremiumSheetPortal } from "../Premium.jsx";
import { CTA_WASH } from "../deepdive/SubscribeButtons.jsx";
import { hasAccess } from "../../lib/entitlement.js";
import InfoButton from "../InfoButton.jsx";
import { retirementAgeFor } from "../../lib/metrics.js";
import { LIGHT, DARK } from "../CardStack.jsx";
import { MODULE_CHART_COLOR, WHITE, MUT, G, GOLD, SERIF, SANS, CREAM, SR_ONLY, FORECAST_COLORS, FORECAST_SHORT_LABEL, CRITICAL, CTA_BLUE, PILL_HEIGHT } from "../../design-tokens.js";

// The Forecasts tab: a dark band (ScreenBand.jsx) with two views, swiped
// between or picked by the dots. Net worth: everything you own less
// everything you owe, projected forward, its figure and line drawn straight
// on the band in cream. Surplus: what the money left over each month (and a
// lump sum) could grow to in an ISA, in savings or in a pension, side by
// side. The horizon line at the band's foot sets both, and on the cream
// below are the view's details: the breakdown by part, or the low/mid/high
// table. Every figure comes from src/lib/forecast.js (calcForecast,
// calcForecastSeries, calcNetWorthTrajectory, buildForecastAssumptions), so
// nothing here is an invented figure; see calcNetWorthTrajectory's own
// comment for which growth and paydown assumptions feed the net worth line.

// Normal Minimum Pension Age rises from 55 to 57 from April 2028 — matches
// the liquidity copy below.
const PENSION_ACCESS_AGE = 57;

// X-axis year ticks at a single, genuinely uniform step (1/2/5/10/20/25/50
// years — whichever gives ~4 intervals across the horizon), stopping at the
// largest multiple of that step that doesn't exceed the horizon. Previous
// attempts either split the horizon into 25/50/75% fractions (rounding each
// independently produces jittery, non-uniform gaps like 36/37/39/40) or
// forced the exact horizon in as an extra tick (which, when it wasn't itself
// a multiple of the step, crammed a much-too-close final tick right next to
// the one before it, e.g. 30/31). Neither is needed: a milestone chart
// doesn't require a tick to land exactly on the endpoint — the line/dot
// already marks it — so plain, evenly-spaced round-number ticks read as
// consistent at every horizon length.
function buildYearTicks(horizon) {
  if (horizon <= 0) return [0];
  const niceSteps = [1, 2, 5, 10, 20, 25, 50];
  const rawStep = horizon / 4;
  const step = niceSteps.find(s => s >= rawStep) || Math.ceil(rawStep / 50) * 50;
  const ticks = [];
  for (let y = 0; y <= horizon; y += step) ticks.push(y);
  return ticks;
}

// Net worth breakdown rows — colour, and the assumption/liquidity copy shown
// when a row is expanded. Liquidity is a genuine, important distinction the
// figures above don't otherwise convey (a pension pot isn't spendable today
// the way cash is), not an invented feature. Colours are each
// module's chart colour (design-tokens.js MODULE_CHART_COLOR), the same as
// the Surplus chart's and Home's.
const NW_ROW_META = {
  Cash:               { color:MODULE_CHART_COLOR.cash, liquidity:"Available today — no restrictions." },
  Investments:        { color:MODULE_CHART_COLOR.investments, liquidity:"Available today if needed, though selling outside an ISA may trigger Capital Gains Tax." },
  Pension:            { color:MODULE_CHART_COLOR.pension, locked:true, liquidity:"Locked until your private pension access age (currently 55, rising to 57 from 2028) — not accessible today." },
  "Property equity":  { color:MODULE_CHART_COLOR.mortgage, locked:true, liquidity:"Illiquid — accessing this value means selling or remortgaging." },
  Debts:              { color:MODULE_CHART_COLOR.personalLoan, liquidity:"What you still owe — reduces what you could access, not an asset itself." },
};

// The band's two views, in the order the dots show them.
const VIEWS = ["Net worth", "Surplus"];

// The Net worth graph's axis stops this far in from each screen edge; the
// line carries on past it to the edge.
const NW_INSET = 26;

export default function MobileForecastScreen({ d, m }) {
  const [openRow, setOpenRow] = useState(null);
  const age = +d.age || null;
  const retireAge = retirementAgeFor(d);
  // Age-based horizon pills ("Age 35") when we know the user's age — people
  // orient around age milestones, not "N years from now". The milestone AGES
  // are fixed (30/40/50/60, plus retirement always included); the number of
  // years each pill represents is derived from the user's own current age
  // (e.g. a 26-year-old's "Age 30" pill is 4 years, not a fixed offset).
  // Falls back to plain year labels when age is unknown.
  const milestoneAges = age
    ? [...new Set([30, 40, 50, 60, retireAge].filter(a => a > age))].sort((a,b) => a-b)
    : [];
  const HORIZON_OPTIONS = milestoneAges.length
    ? milestoneAges.map(targetAge => ({ value: targetAge - age, label: `Age ${targetAge}` }))
    : [{value:5,label:"5yr"},{value:10,label:"10yr"},{value:20,label:"20yr"},{value:40,label:"40yr"}];
  const [horizon, setHorizon] = useState(() => HORIZON_OPTIONS[0]?.value ?? 10);
  const [surplus, setSurplus] = useState(null);
  const [lumpSum, setLumpSum] = useState(null);
  const [openTip, setOpenTip] = useState(null);
  const [showNwAssumptions, setShowNwAssumptions] = useState(false);
  const [view, setView] = useState(0); // which of VIEWS is showing
  const viewMoved = useRef(false); // nothing announced until the first switch
  // A lump sum today is a subscriber feature (as Add a goal's rule:
  // subscribers, and anyone from before the paywall). For anyone else the
  // pill is locked, and a tap opens Candid Premium's sheet, as the crown does.
  const lumpLocked = !hasAccess() && d.unlockGate === true;
  const [premiumOpen, setPremiumOpen] = useState(false);
  const openPremium = () => { setPremiumOpen(true); posthog.capture("premium_opened", { from: "forecast_lump_sum" }); };
  // Each view's chart is drawn afresh as it comes up, so each is measured
  // again then (otherwise it keeps the fallback width).
  const [nwChartRef, nwChartWidth] = useElementWidth(340, [view]);
  const [surplusChartRef, surplusChartWidth] = useElementWidth(300, [view]);

  // Only a monthly surplus the user types goes into the figures, the Surplus
  // card's and the Net worth line's; until then it's £0. Our own estimate
  // from their answers is only the pill's placeholder, since it can be well
  // above what's really spare.
  const monthly = surplus ?? 0;
  const lump = lumpLocked ? 0 : lumpSum ?? 0;
  const estimate = Math.max(0, Math.round(m.monthlySurplus || 0));
  // Not rerun when only the chart's width or an open row changes.
  const forecast = useMemo(() => calcForecast(d, m, monthly, horizon, lump), [d, m, monthly, horizon, lump]);
  const series = useMemo(() => calcForecastSeries(d, m, monthly, horizon, lump), [d, m, monthly, horizon, lump]);
  const assumptions = useMemo(() => buildForecastAssumptions(d, m), [d, m]);
  // The line runs on past the horizon to the screen's right edge, so a few
  // years more are worked out than the horizon: as many as fit in the
  // graph's inset at its scale. The rows up to the horizon are the same
  // either way (each year follows from the one before).
  const extraYears = Math.min(10, Math.ceil(NW_INSET * horizon / Math.max(1, nwChartWidth - 2 * NW_INSET)) + 1);
  const trajectory = useMemo(() => calcNetWorthTrajectory(d, m, horizon + extraYears, monthly), [d, m, horizon, extraYears, monthly]);
  const netWorthRows = trajectory.slice(0, horizon + 1);

  const showView = i => {
    if (i === view) return;
    viewMoved.current = true;
    setView(i);
  };
  // A mostly sideways drag on the band switches the view, as the card
  // stack's does (CardStack.jsx); the browser cancels the pointer when it
  // takes an up or down drag as a page scroll. Touch and pen only: a mouse
  // drag selects text, and the dots are there for a mouse. Not from the
  // horizon line or a field, which take their own drags.
  const swipe = useRef(null), swipedAt = useRef(0);
  const onPointerDown = e => {
    swipe.current = e.pointerType === "mouse" || e.target.closest("[role=radiogroup], input") ? null : { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = e => {
    if (!swipe.current) return;
    const dx = e.clientX - swipe.current.x, dy = e.clientY - swipe.current.y;
    swipe.current = null;
    if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) {
      swipedAt.current = Date.now();
      showView((view + (dx < 0 ? 1 : -1) + VIEWS.length) % VIEWS.length);
    }
  };
  // A swipe that ends on a button isn't also a tap. Only the click straight
  // after it: a touch swipe often fires none, and a later tap or key press
  // must still work.
  const onClickCapture = e => {
    if (Date.now() - swipedAt.current > 400) return;
    swipedAt.current = 0;
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div>
      <ScreenBand tone="dark" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { swipe.current = null; }}
        onClickCapture={onClickCapture} style={{touchAction:"pan-y"}}>
        <h1 style={{...SCREEN_TITLE,color:CREAM,margin:"0 0 4px"}}>Forecasts</h1>
        {/* The view's name, with a dot for each view at the other end (the
            dots' 44px tap height overlapping what's below). */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",marginBottom:"-12px"}}>
          <div style={{fontSize:"11px",fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:CREAM_SOFT}}>{VIEWS[view]}</div>
          <div style={{display:"flex",marginRight:"-10px"}}>
            {VIEWS.map((label, i) => (
              <button key={label} type="button" onClick={() => showView(i)} aria-label={`Show ${label}`} aria-pressed={i === view}
                style={{width:"28px",height:"44px",background:"none",border:0,padding:0,cursor:"pointer",display:"grid",placeItems:"center"}}>
                <span style={{width:"7px",height:"7px",borderRadius:"50%",background:i === view ? CREAM : CREAM_FAINT,transform:i === view ? "scale(1.2)" : "none",transition:"background 0.2s, transform 0.2s"}}/>
              </button>
            ))}
          </div>
        </div>
        {/* Says which view has come up as each switch happens. */}
        <div aria-live="polite" style={SR_ONLY}>{viewMoved.current ? `${VIEWS[view]}, ${view + 1} of ${VIEWS.length}` : ""}</div>

        <motion.div key={view} initial={viewMoved.current ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          {view === 0
            ? <NetWorthBand age={age} horizon={horizon} trajectory={trajectory} chartRef={nwChartRef} chartWidth={nwChartWidth}/>
            : <SurplusCard t={DARK} surplus={surplus} estimate={estimate} setSurplus={setSurplus} lumpLocked={lumpLocked} onLocked={openPremium} lumpSum={lumpSum} setLumpSum={setLumpSum} horizon={horizon} age={age}
                series={series} chartRef={surplusChartRef} chartWidth={surplusChartWidth}/>}
        </motion.div>

        {/* The horizon sets both views, so it sits below them. */}
        <HorizonLine value={horizon} onChange={setHorizon} options={HORIZON_OPTIONS}/>
      </ScreenBand>
      <PremiumSheetPortal open={premiumOpen} d={d} from="forecast_lump_sum" onClose={() => setPremiumOpen(false)}/>

      <ScreenSheet>
        <section aria-label={`${VIEWS[view]} details`}>
          {view === 0
            ? <NetWorthBreakdown t={LIGHT} age={age} horizon={horizon} netWorthRows={netWorthRows} m={m}
                showNwAssumptions={showNwAssumptions} setShowNwAssumptions={setShowNwAssumptions} openRow={openRow} setOpenRow={setOpenRow}/>
            : <SurplusEstimates t={LIGHT} horizon={horizon} age={age} forecast={forecast} assumptions={assumptions} openTip={openTip} setOpenTip={setOpenTip}/>}
        </section>
        <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"16px 0 0"}}>Estimates from your answers, not promises: growth isn't guaranteed.</p>

        <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"12px",padding:"14px 16px",marginTop:"20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}}>
          <div>
            <div style={{fontSize:"13px",fontWeight:600,color:G}}>How do I compare to my peers?</div>
            <div style={{fontSize:"12px",color:MUT,marginTop:"2px"}}>See how your net worth stacks up by age and income.</div>
          </div>
          <span style={{fontSize:"9.5px",fontWeight:700,color:GOLD,background:"rgba(196,150,58,0.15)",padding:"4px 9px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase",flexShrink:0}}>Coming soon</span>
        </div>
      </ScreenSheet>
    </div>
  );
}

// ── The views ──────────────────────────────────────────────────────────
// Each drawn in the colours `t` it's given (CardStack.jsx): DARK on the
// band, LIGHT on the cream below.

const cardText = t => ({ fontSize:"13px", color:t.body, lineHeight:1.45, margin:"8px 0 0" });
const caps = t => ({ fontSize:"11px", fontWeight:600, color:t.label, letterSpacing:"0.09em", textTransform:"uppercase" });
const note = t => ({ marginTop:"8px", background:t.track, borderRadius:"10px", padding:"10px 12px", display:"flex", flexDirection:"column", gap:"6px" });
const noteText = t => ({ fontSize:"12px", color:t.body, lineHeight:1.55, margin:0 });

// A line chart's axes: three £ gridlines, then year (or age) ticks below,
// the first anchored left and the last right so no label spills past the
// chart's edges.
function Axes({ c, t, age }) {
  return (
    <>
      {c.yTicks.map((v,i) => (
        <g key={i}>
          <line x1={c.PL} x2={c.VW-c.PR} y1={c.sy(v)} y2={c.sy(v)} stroke={t.rule} strokeWidth="1"/>
          <text x={c.PL-6} y={c.sy(v)+3} fontSize="9" fontWeight="700" fill={t.body} textAnchor="end">{fmtCompact(v)}</text>
        </g>
      ))}
      <line x1={c.PL} x2={c.VW-c.PR} y1={c.VH-c.PB} y2={c.VH-c.PB} stroke={t.body} strokeOpacity="0.4" strokeWidth="1.5"/>
      {c.xTicks.map((yr,i) => (
        <text key={i} x={c.sx(yr)} y={c.VH-c.PB+14} fontSize="9" fontWeight="700" fill={t.body}
          textAnchor={i===0?"start":i===c.xTicks.length-1?"end":"middle"}>
          {i===0 ? "Now" : age ? age+yr : `Yr ${yr}`}
        </text>
      ))}
      <line x1={c.PL} x2={c.PL} y1={c.PT} y2={c.VH-c.PB} stroke={t.body} strokeOpacity="0.4" strokeWidth="1.5"/>
    </>
  );
}

const signed = v => `${v < 0 ? "−" : ""}${fmt(Math.abs(v))}`;

// ── The Net worth view, drawn straight on the dark band ────────────────
// Everything in cream: the figure at the horizon, then a line across the
// whole screen. The axis runs from Now to the horizon's year, a tick a year
// and a label every few; each labelled year has a dot on the line with its
// £ above. Past either end of the axis the line runs on to the screen's
// edge and fades out: on the right the years after the horizon (worked out
// the same way), on the left the first year's slope carried back, so it
// reads as a line going somewhere rather than one that stops.
const CREAM_SOFT = "rgba(250,247,240,0.7)";
const CREAM_FAINT = "rgba(250,247,240,0.35)";

// The labelled years: an even, round step (four or five across the
// horizon, each at least LABEL_GAP px apart), plus the horizon itself,
// without a step that would sit too close to it.
const LABEL_GAP = 56;
function labelYears(horizon, perYear) {
  const step = [1, 2, 5, 10, 20, 25, 50].find(s => s >= horizon / 4.5 && s * perYear >= LABEL_GAP) ?? horizon;
  const years = [];
  for (let y = 0; y <= horizon; y += step) {
    if (y === 0 || (horizon - y >= step / 2 && (horizon - y) * perYear >= LABEL_GAP)) years.push(y);
  }
  if (years[years.length - 1] !== horizon) years.push(horizon);
  return years;
}

function NetWorthBand({ age, horizon, trajectory, chartRef, chartWidth }) {
  const id = `nw${useId().replace(/[^\w-]/g, "")}`; // safe inside url(#…)
  const values = trajectory.map(r => r.netWorth);
  const year0 = new Date().getFullYear();
  const W = chartWidth, H = 172, PT = 26, PB = 34;
  const x0 = NW_INSET, x1 = W - NW_INSET;
  const perYear = (x1 - x0) / horizon;
  const sx = i => x0 + i * perYear;
  // The left run: the first year's change carried back to the screen's edge.
  const leftValue = values[0] - (values[1] - values[0]) * (x0 / perYear);
  const rightEnd = Math.min(values.length - 1, horizon + Math.ceil(NW_INSET / perYear));
  // Scaled to the years from now to the horizon only: the runs off each edge
  // aren't the user's figures, so they mustn't squash the line. Where one
  // would leave the chart, it's held at its top or bottom.
  const shown = values.slice(0, horizon + 1);
  const yMin = Math.min(...shown), yMax = Math.max(...shown);
  const span = yMax - yMin || Math.max(1, Math.abs(yMax));
  const axisY = H - PB;
  // A flat line sits mid-height rather than on the axis.
  const sy = v => yMax === yMin ? PT + (axisY - 14 - PT) / 2 : PT + (1 - (v - yMin) / span) * (axisY - 14 - PT);
  const syRun = v => Math.min(axisY - 4, Math.max(PT - 10, sy(v)));
  const pts = (from, to, y = sy) => values.slice(from, to + 1).map((v, k) => `${sx(from + k).toFixed(1)},${y(v).toFixed(1)}`);
  const main = `M${pts(0, horizon).join(" L")}`;
  const right = `M${pts(horizon, rightEnd, syRun).join(" L")}`;
  const left = `M0,${syRun(leftValue).toFixed(1)} L${sx(0)},${sy(values[0]).toFixed(1)}`;
  // A £ label kept whole on screen: the ones at Now and the horizon sit
  // near the edges (about 6.5px a character at 11px bold).
  const labelX = (x, text) => { const half = text.length * 3.3 + 4; return Math.min(W - half, Math.max(half, x)); };
  const money = v => `${v < 0 ? "−" : ""}${fmtK1(v)}`;
  const labelled = labelYears(horizon, perYear);
  const end = values[horizon];
  const yearOf = y => (y === 0 ? "Now" : `${year0 + y}`);
  return (
    <>
      <div style={{fontFamily:SERIF,fontSize:"var(--hero-fig)",fontWeight:700,color:CREAM,lineHeight:1.05,letterSpacing:"-0.01em",marginTop:"6px"}}>{signed(end)}</div>
      <p style={SR_ONLY}>
        {age ? `At age ${age + horizon}` : `In ${horizon} years`}, in {year0 + horizon}, from {signed(values[0])} now. {labelled.slice(1, -1).map(y => `${year0 + y}: ${signed(values[y])}.`).join(" ")}
      </p>
      <div ref={chartRef} style={{margin:"8px -20px 0"}}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:"block",overflow:"visible"}} aria-hidden="true">
          <defs>
            <linearGradient id={`${id}l`} gradientUnits="userSpaceOnUse" x1="0" x2={x0} y1="0" y2="0">
              <stop offset="0" stopColor={CREAM} stopOpacity="0"/><stop offset="1" stopColor={CREAM} stopOpacity="0.9"/>
            </linearGradient>
            <linearGradient id={`${id}r`} gradientUnits="userSpaceOnUse" x1={x1} x2={W} y1="0" y2="0">
              <stop offset="0" stopColor={CREAM} stopOpacity="0.9"/><stop offset="1" stopColor={CREAM} stopOpacity="0"/>
            </linearGradient>
          </defs>
          {/* The axis: a tick a year, a taller one and the year on each label. */}
          <line x1={x0} x2={x1} y1={axisY} y2={axisY} stroke={CREAM_FAINT} strokeWidth="1.5"/>
          {Array.from({ length: horizon + 1 }, (_, y) => {
            const big = labelled.includes(y);
            return <line key={y} x1={sx(y)} x2={sx(y)} y1={axisY} y2={axisY + (big ? 7 : 4)} stroke={big ? CREAM_SOFT : CREAM_FAINT} strokeWidth="1.2"/>;
          })}
          {labelled.map(y => (
            <text key={y} x={sx(y)} y={axisY + 22} fontFamily={SANS} fontSize="11" fontWeight="600" fill={CREAM_SOFT} textAnchor="middle">{yearOf(y)}</text>
          ))}
          {/* The line, then its runs off each edge. */}
          <path d={left} fill="none" stroke={`url(#${id}l)`} strokeWidth="2.4" strokeLinecap="round"/>
          {rightEnd > horizon && <path d={right} fill="none" stroke={`url(#${id}r)`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>}
          <path d={main} fill="none" stroke={CREAM} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          {labelled.map(y => (
            <g key={y}>
              <circle cx={sx(y)} cy={sy(values[y])} r={y === horizon ? 4.5 : 3.5} fill={CREAM}/>
              <text x={labelX(sx(y), money(values[y]))} y={sy(values[y]) - 11} fontFamily={SANS} fontSize="11" fontWeight="700" fill={CREAM} textAnchor="middle">
                {money(values[y])}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </>
  );
}

// The time horizon, on the band: a line with a marker for each age and the
// age above it, the one picked larger and brighter. A radio group to screen
// readers, as PillSlider: one Tab stop (the picked age), and the arrow keys
// move and pick.
function HorizonLine({ value, onChange, options }) {
  const buttons = useRef([]);
  // None picked when the horizon isn't one of the options (the ages change
  // with the answers), so no marker claims a horizon the figures aren't for.
  const picked = options.findIndex(o => o.value === value);
  const onKeyDown = e => {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const next = Math.min(options.length - 1, Math.max(0, picked < 0 ? 0 : picked + dir));
    onChange(options[next].value);
    buttons.current[next]?.focus();
  };
  const MARK = 56; // each marker's width, the line running between their centres
  return (
    <div role="radiogroup" aria-label="Time horizon" onKeyDown={onKeyDown}
      style={{position:"relative",display:"flex",justifyContent:"space-between",marginTop:"18px"}}>
      <div aria-hidden="true" style={{position:"absolute",left:MARK / 2,right:MARK / 2,bottom:"16px",height:"1.5px",background:CREAM_FAINT}}/>
      {options.map((o, i) => {
        const on = i === picked;
        return (
          <button key={o.value} ref={el => { buttons.current[i] = el; }} type="button" role="radio" aria-checked={on} tabIndex={on || (picked < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            style={{position:"relative",width:MARK,height:"52px",padding:0,background:"none",border:0,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",gap:"8px",fontFamily:SANS,color:CREAM}}>
            <span style={{fontSize:"12px",fontWeight:on ? 800 : 600,opacity:on ? 1 : 0.6,whiteSpace:"nowrap",transition:"opacity 0.2s"}}>{o.label}</span>
            <span style={{height:"16px",marginBottom:"9px",display:"grid",placeItems:"center"}}>
              <span style={{width:on ? "14px" : "7px",height:on ? "14px" : "7px",borderRadius:"50%",background:on ? CREAM : CREAM_SOFT,
                boxShadow:on ? "0 0 0 4px rgba(250,247,240,0.18)" : "none",transition:"width 0.2s, height 0.2s, box-shadow 0.2s"}}/>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Below the stack while Net worth is in front: the breakdown by what you own
// and owe at the horizon, each row opening on its assumptions.
function NetWorthBreakdown({ t, age, horizon, netWorthRows, m, showNwAssumptions, setShowNwAssumptions, openRow, setOpenRow }) {
  const r = netWorthRows[horizon];
  const rows = [
    { label:"Cash", value:r.cash, assumption:`Grown at your effective savings rate (${(m.effectiveSavingsRate||3.5).toFixed(1)}% p.a.). Assumes cash never exceeds your ${fmt(m.emergencyBuffer)} emergency fund target — once reached, further surplus is assumed invested instead (see Investments).` },
    { label:"Investments", value:r.investments, assumption:`Today's ISA + unwrapped balance grown at 7% p.a. nominal — an illustrative long-term equity return, not guaranteed. Once your cash buffer is topped up, all further monthly surplus is assumed fully invested into the market.` },
    { label:"Pension", value:r.pension, assumption:"Your pot plus ongoing contributions, grown at 6% p.a. — the same rate calcMetrics uses for your projected pot elsewhere in the app." },
    ...(r.propertyEquity > 0 ? [{ label:"Property equity", value:r.propertyEquity, assumption:"Property value held flat (no house-price growth assumed) — equity grows only as your mortgage is paid down at its real rate and repayment." }] : []),
    ...(r.debts > 0 ? [{ label:"Debts", value:r.debts, negative:true, assumption:"Remaining student loan and/or personal loan balance, projected forward at their real interest rates and repayments." }] : []),
  ];
  const maxVal = Math.max(...rows.map(row => Math.abs(row.value)), 1);
  return (
    <>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px"}}>
        <span style={caps(t)}>Breakdown {age ? `at age ${age+horizon}` : `at ${horizon}yrs`}</span>
        <InfoButton onClick={() => setShowNwAssumptions(o => !o)} open={showNwAssumptions}/>
      </div>
      {showNwAssumptions && (
        <div style={{...note(t),marginBottom:"8px"}}>
          <p style={noteText(t)}>Cash grows at your own savings rate, and is assumed to never exceed your {fmt(m.emergencyBuffer)} emergency fund target.</p>
          <p style={noteText(t)}>Once that's topped up, all further monthly surplus is assumed fully invested into the market (growing at 7% p.a. nominal) rather than held as cash. Your pension grows at 6% p.a. — the same rates the rest of the app uses.</p>
          <p style={noteText(t)}>Student loan, personal loan and mortgage are paid down at their real rates and repayments. Property value is held flat — no house-price growth is assumed.</p>
        </div>
      )}
      {rows.map((row,i) => {
        const meta = NW_ROW_META[row.label] || {};
        const isOpen = openRow === row.label;
        return (
          <div key={row.label} onClick={() => setOpenRow(isOpen ? null : row.label)} style={{padding:"11px 0",borderBottom:i===rows.length-1?"none":`1px solid ${t.rule}`,cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                <span style={{fontSize:"14px",color:t.figure}}>{row.label}</span>
                {meta.locked && <Lock size={12} color={t.body}/>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                <span style={{fontFamily:SERIF,fontSize:"18px",fontWeight:700,color:row.negative ? CRITICAL : t.figure}}>{row.negative?"−":""}{fmt(row.value)}</span>
                <ChevronRight size={13} color={t.body} style={{transform:isOpen?"rotate(90deg)":"none",transition:"transform 0.15s"}}/>
              </div>
            </div>
            <div style={{height:"6px",borderRadius:"3px",background:t.track,overflow:"hidden",marginTop:"8px"}}>
              <div style={{height:"100%",borderRadius:"3px",width:`${Math.max(2,(Math.abs(row.value)/maxVal)*100)}%`,background:meta.color||G}}/>
            </div>
            {isOpen && (
              <div style={note(t)} onClick={e => e.stopPropagation()}>
                {row.label === "Pension" && age && (
                  <div style={{display:"flex",alignItems:"baseline",gap:"6px"}}>
                    <span style={{fontFamily:SERIF,fontSize:"20px",fontWeight:700,color:t.figure}}>{Math.max(0, PENSION_ACCESS_AGE - age)}</span>
                    <span style={{fontSize:"12.5px",color:t.body}}>years until available (from age {PENSION_ACCESS_AGE})</span>
                  </div>
                )}
                <p style={{...noteText(t),fontSize:"13px"}}>{row.assumption}</p>
                <p style={{...noteText(t),fontSize:"13px",fontWeight:600}}>{meta.liquidity}</p>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// The lump sum pill for a non-subscriber: £0, not editable, in the pale
// blue and CTA blue border of the app's other subscriber features, with
// a sheen passing over it and a lock.
const LOCKED_PILL_CSS = `
.lump-lock { position: relative; overflow: hidden; }
.lump-lock > * { position: relative; z-index: 1; }
.lump-lock::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 260%; z-index: 0; pointer-events: none;
  background: linear-gradient(112deg, transparent 32%, rgba(255,255,255,0.75) 46%, transparent 60%);
  will-change: transform; animation: lump-lock-sheen 7s ease-in-out infinite; }
@keyframes lump-lock-sheen { 0% { transform: translateX(-75%); } 55%, 100% { transform: translateX(25%); } }
@media (prefers-reduced-motion: reduce) { .lump-lock::after { animation: none; transform: translateX(-30%); } }
`;
function LockedLumpPill({ onClick }) {
  return (
    <button type="button" className="lump-lock" onClick={onClick} aria-label="Lump sum today. Adding one is for subscribers"
      style={{flex:1,minWidth:0,background:CTA_WASH,border:`1.5px solid ${CTA_BLUE}`,borderRadius:"100px",padding:"0 16px",height:PILL_HEIGHT,boxSizing:"border-box",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"flex-start",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
      <style>{LOCKED_PILL_CSS}</style>
      <span style={{display:"flex",alignItems:"center",gap:"4px",fontSize:"9.5px",fontWeight:700,color:CTA_BLUE,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>
        Lump sum today<Lock size={10} strokeWidth={2.6} aria-hidden="true"/>
      </span>
      <span style={{...PILL_ANSWER_TEXT,color:MUT}}>£0</span>
    </button>
  );
}

// The Surplus card: what your monthly surplus and a lump sum could grow to,
// by where they go.
function SurplusCard({ t, surplus, estimate, setSurplus, lumpLocked, onLocked, lumpSum, setLumpSum, horizon, age, series, chartRef, chartWidth }) {
  const chart = (() => {
    const allValues = series.series.flatMap(s => s.values);
    // Nothing to grow until a monthly amount or a lump sum is added: the
    // axes still show, on a nominal £10k scale, with a note over them.
    const empty = !allValues.some(v => v > 0);
    const yMax = empty ? 10000 : Math.max(1, ...allValues);
    const VW = chartWidth, VH = 150, PL = 34, PR = 4, PT = 8, PB = 20;
    const cW = VW - PL - PR, cH = VH - PT - PB;
    const sx = i => PL + (i / horizon) * cW;
    const sy = v => PT + (1 - v / yMax) * cH;
    const paths = series.series.map(s => {
      const endIdx = s.termYear != null ? s.termYear : s.values.length - 1;
      const path = s.values.slice(0, endIdx + 1).map((v,i) => `${i===0?"M":"L"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
      const lastIdx = Math.min(endIdx, s.values.length - 1);
      return { label: s.label, path, lastX: sx(lastIdx), lastY: sy(s.values[lastIdx]) };
    });
    const yTicks = [0, 0.5, 1].map(f => yMax * f);
    const xTicks = buildYearTicks(horizon);
    return { VW, VH, PL, PR, PT, PB, cW, cH, sx, sy, paths, yTicks, xTicks, empty };
  })();
  return (
    <>
      <p style={cardText(t)}>What the money left over each month could grow to in a Stocks and Shares ISA, in savings, or in your pension, side by side. Change the monthly amount or add a lump sum to compare.</p>
      <div style={{display:"flex",gap:"10px",marginTop:"12px"}}>
        <PillMoneyInput label="Monthly surplus" value={surplus} onChange={setSurplus} placeholder={formatThousands(estimate)}/>
        {lumpLocked ? <LockedLumpPill onClick={onLocked}/> : <PillMoneyInput label="Lump sum today" value={lumpSum} onChange={setLumpSum}/>}
      </div>

      <div style={{...caps(t),marginTop:"18px"}}>Projected value · {horizon} years</div>
      <div style={{display:"flex",gap:"14px",marginTop:"8px",flexWrap:"wrap"}}>
        {chart.paths.map(p => (
          <div key={p.label} style={{display:"flex",alignItems:"center",gap:"5px"}}>
            <span style={{width:"7px",height:"7px",borderRadius:"50%",background:FORECAST_COLORS[p.label]||MUT,display:"inline-block"}}/>
            <span style={{fontSize:"11.5px",color:t.figure}}>{FORECAST_SHORT_LABEL[p.label]||p.label}</span>
          </div>
        ))}
      </div>
      <div ref={chartRef} style={{marginTop:"10px",position:"relative"}}>
        {chart.empty && (
          <div style={{position:"absolute",left:chart.PL + 10,top:chart.PT + 8,width:chart.cW - 20,height:chart.cH - 16,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",border:`1px dashed ${t.body}`,borderRadius:"12px",padding:"0 16px",boxSizing:"border-box",fontSize:"13px",lineHeight:1.45,color:t.body}}>
            {lumpLocked ? "Add a monthly amount to see what it could grow to." : "Add a monthly amount or a lump sum to see what it could grow to."}
          </div>
        )}
        <svg width={chart.VW} height={chart.VH} viewBox={`0 0 ${chart.VW} ${chart.VH}`} style={{display:"block"}} aria-hidden="true">
          <Axes c={chart} t={t} age={age}/>
          {!chart.empty && chart.paths.map(p => {
            const color = FORECAST_COLORS[p.label] || MUT;
            return (
              <g key={p.label}>
                <path d={p.path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx={p.lastX} cy={p.lastY} r="3.5" fill={color}/>
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}

// Below the stack while Surplus is in front: each place's low, mid and high
// estimate at the horizon, each opening on its assumptions.
function SurplusEstimates({ t, horizon, age, forecast, assumptions, openTip, setOpenTip }) {
  const horizonLabel = (yr) => age ? `age ${age+yr}` : `${yr} yrs`;
  const colHead = { fontSize:"9.5px", fontWeight:700, color:t.label, letterSpacing:"0.06em", textTransform:"uppercase", textAlign:"right" };
  return (
    <>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px"}}>
        <span style={caps(t)}>Estimate at {horizonLabel(horizon)}</span>
        <div style={{display:"grid",gridTemplateColumns:"48px 48px 48px",gap:"6px"}}>
          <span style={colHead}>Low</span>
          <span style={colHead}>Mid</span>
          <span style={colHead}>High</span>
        </div>
      </div>
      {forecast.options.map((o,i) => {
        const isOpen = openTip === o.label;
        const a = assumptions[o.label];
        return (
          <div key={o.label} style={{padding:"10px 0",borderBottom:i===forecast.options.length-1?"none":`1px solid ${t.rule}`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:"7px",minWidth:0}}>
                <span style={{width:"8px",height:"8px",borderRadius:"50%",background:FORECAST_COLORS[o.label]||MUT,display:"inline-block",flexShrink:0}}/>
                <span style={{fontSize:"13px",color:t.figure,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{FORECAST_SHORT_LABEL[o.label]||o.label}</span>
                {a && <InfoButton onClick={() => setOpenTip(isOpen ? null : o.label)} open={isOpen}/>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"48px 48px 48px",gap:"6px",flexShrink:0}}>
                <span style={{fontSize:"12px",color:t.body,textAlign:"right"}}>{fmtCompact(o.low)}</span>
                <span style={{fontFamily:SERIF,fontSize:"12.5px",color:t.figure,fontWeight:700,textAlign:"right"}}>{fmtCompact(o.central)}</span>
                <span style={{fontSize:"12px",color:t.body,textAlign:"right"}}>{fmtCompact(o.high)}</span>
              </div>
            </div>
            {o.note && <div style={{fontSize:"11px",color:t.body,marginTop:"3px",lineHeight:1.4}}>{o.note}</div>}
            {isOpen && a && (
              <div style={note(t)}>
                {a.lines.map((line,i) => <p key={i} style={noteText(t)}>{line}</p>)}
                <div style={{display:"flex",gap:"14px",marginTop:"2px",fontSize:"11px",color:t.body}}>
                  <span>Low <b style={{color:t.figure}}>{a.rates.low}</b></span>
                  <span>Central <b style={{color:t.figure}}>{a.rates.central}</b></span>
                  <span>High <b style={{color:t.figure}}>{a.rates.high}</b></span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
