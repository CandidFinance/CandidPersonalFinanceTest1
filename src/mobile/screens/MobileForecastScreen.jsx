import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TilePopover, anchor } from "../MobileTile.jsx";
import { useElementWidth } from "../useElementWidth.js";
import { Lock, ChevronRight } from "lucide-react";
import { ScreenBand, ScreenSheet, SCREEN_TITLE } from "../ScreenBand.jsx";
import { calcForecast, calcForecastSeries, calcNetWorthTrajectory, buildForecastAssumptions } from "../../lib/forecast.js";
import { fmt, fmtK1, fmtCompact, formatThousands } from "../../lib/format.js";
import posthog from "posthog-js";
import PillMoneyInput, { PILL_ANSWER_TEXT } from "../PillMoneyInput.jsx";
import { PremiumSheetPortal } from "../Premium.jsx";
import { hasAccess } from "../../lib/entitlement.js";
import InfoButton from "../InfoButton.jsx";
import { retirementAgeFor } from "../../lib/metrics.js";
import { LIGHT } from "../CardStack.jsx";
import { MODULE_CHART_COLOR, WHITE, MUT, TEXT, G, GOLD, SERIF, SANS, CREAM, SR_ONLY, FORECAST_COLORS, FORECAST_SHORT_LABEL, CRITICAL, PILL_HEIGHT } from "../../design-tokens.js";

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

// The band graphs' axis stops this far in from each screen edge; the lines
// carry on past it to the edge.
const BAND_INSET = 26;

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
  // The Surplus lines taken off the graph (by tapping their row below), so
  // two can be compared on their own. All on to start with.
  const [hiddenLines, setHiddenLines] = useState(() => new Set());
  const toggleLine = label => setHiddenLines(h => {
    const next = new Set(h);
    if (!next.delete(label)) next.add(label);
    return next;
  });
  // A lump sum today is a subscriber feature (as Add a goal's rule:
  // subscribers, and anyone from before the paywall). For anyone else the
  // pill is locked, and a tap opens Candid Premium's sheet, as the crown does.
  const lumpLocked = !hasAccess() && d.unlockGate === true;
  const [premiumOpen, setPremiumOpen] = useState(false);
  const openPremium = () => { setPremiumOpen(true); posthog.capture("premium_opened", { from: "forecast_lump_sum" }); };
  // Each view's chart is drawn afresh as it comes up, so each is measured
  // again then (otherwise it keeps the fallback width).
  const [chartRef, chartWidth] = useElementWidth(340, [view]);

  // Only a monthly surplus the user types goes into the figures, the Surplus
  // card's and the Net worth line's; until then it's £0. Our own estimate
  // from their answers is only the pill's placeholder, since it can be well
  // above what's really spare.
  const monthly = surplus ?? 0;
  const lump = lumpLocked ? 0 : lumpSum ?? 0;
  const estimate = Math.max(0, Math.round(m.monthlySurplus || 0));
  // Not rerun when only an open row changes.
  const forecast = useMemo(() => calcForecast(d, m, monthly, horizon, lump), [d, m, monthly, horizon, lump]);
  const assumptions = useMemo(() => buildForecastAssumptions(d, m), [d, m]);
  // The lines run on past the horizon to the screen's right edge, so a few
  // years more are worked out than the horizon: enough to cross the graph's
  // inset on any screen 260px or wider (not the measured width, so nothing
  // is worked out again as it's measured). The years up to the horizon are
  // the same either way (each year follows from the one before).
  const extraYears = Math.min(10, Math.ceil(horizon / 8) + 1);
  const trajectory = useMemo(() => calcNetWorthTrajectory(d, m, horizon + extraYears, monthly), [d, m, horizon, extraYears, monthly]);
  const series = useMemo(() => calcForecastSeries(d, m, monthly, horizon + extraYears, lump), [d, m, monthly, horizon, extraYears, lump]);
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
  // horizon line, a field or the Surplus graph (a drag along it reads each
  // year), which take their own drags, nor while a ?'s card is open (a drag
  // on its backdrop is to close it).
  const swipe = useRef(null), swipedAt = useRef(0);
  const onPointerDown = e => {
    const open = e.currentTarget.querySelector("[role=dialog]");
    swipe.current = open || e.pointerType === "mouse" || e.target.closest("[role=radiogroup], input, [data-scrub]") ? null : { x: e.clientX, y: e.clientY };
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
            ? <NetWorthBand age={age} horizon={horizon} trajectory={trajectory} chartRef={chartRef} chartWidth={chartWidth}/>
            : <SurplusBand horizon={horizon} monthly={monthly} lump={lump} lumpLocked={lumpLocked} series={series} options={forecast.options} hidden={hiddenLines} chartRef={chartRef} chartWidth={chartWidth}/>}
        </motion.div>

        {/* The horizon sets both views, so it sits below them. */}
        <HorizonLine value={horizon} onChange={setHorizon} options={HORIZON_OPTIONS}/>
        {view === 1 && (
          <SurplusInputs surplus={surplus} estimate={estimate} setSurplus={setSurplus} lumpLocked={lumpLocked} onLocked={openPremium} lumpSum={lumpSum} setLumpSum={setLumpSum}/>
        )}
      </ScreenBand>
      <PremiumSheetPortal open={premiumOpen} d={d} from="forecast_lump_sum" onClose={() => setPremiumOpen(false)}/>

      <ScreenSheet>
        <section aria-label={`${VIEWS[view]} details`}>
          {view === 0
            ? <NetWorthBreakdown t={LIGHT} age={age} horizon={horizon} netWorthRows={netWorthRows} m={m}
                showNwAssumptions={showNwAssumptions} setShowNwAssumptions={setShowNwAssumptions} openRow={openRow} setOpenRow={setOpenRow}/>
            : <SurplusEstimates t={LIGHT} horizon={horizon} age={age} forecast={forecast} assumptions={assumptions} openTip={openTip} setOpenTip={setOpenTip} hidden={hiddenLines} onToggle={toggleLine} canHide={monthly > 0 || lump > 0}/>}
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
// On the band, in cream and each place's colour; the details on the cream
// below in the colours `t` they're given (CardStack.jsx's LIGHT).

const caps = t => ({ fontSize:"11px", fontWeight:600, color:t.label, letterSpacing:"0.09em", textTransform:"uppercase" });
const note = t => ({ marginTop:"8px", background:t.track, borderRadius:"10px", padding:"10px 12px", display:"flex", flexDirection:"column", gap:"6px" });
const noteText = t => ({ fontSize:"12px", color:t.body, lineHeight:1.55, margin:0 });
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
// Behind a year's readout on the Surplus graph: the band's own dark green.
const READ_BG = "rgba(14,34,25,0.9)";

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

// The frame both band graphs share (Net worth, Surplus): its size, the
// axis's ends, where each year sits and which years are labelled.
function bandFrame(W, horizon) {
  const H = 172, PT = 26, PB = 34;
  const x0 = BAND_INSET, x1 = W - BAND_INSET;
  const perYear = (x1 - x0) / horizon;
  return { W, H, PT, axisY: H - PB, x0, x1, perYear, sx: i => x0 + i * perYear,
    labelled: labelYears(horizon, perYear), year0: new Date().getFullYear(),
    // The last year a run off the right edge needs.
    runTo: horizon + Math.ceil(BAND_INSET / perYear) };
}

// The axis: from Now to the horizon, a tick a year, a taller one and the
// year on each labelled one.
function BandAxis({ f, horizon }) {
  return (
    <>
      <line x1={f.x0} x2={f.x1} y1={f.axisY} y2={f.axisY} stroke={CREAM_FAINT} strokeWidth="1.5"/>
      {Array.from({ length: horizon + 1 }, (_, y) => {
        const big = f.labelled.includes(y);
        return <line key={y} x1={f.sx(y)} x2={f.sx(y)} y1={f.axisY} y2={f.axisY + (big ? 7 : 4)} stroke={big ? CREAM_SOFT : CREAM_FAINT} strokeWidth="1.2"/>;
      })}
      {f.labelled.map(y => (
        <text key={y} x={f.sx(y)} y={f.axisY + 22} fontFamily={SANS} fontSize="11" fontWeight="600" fill={CREAM_SOFT} textAnchor="middle">{y === 0 ? "Now" : f.year0 + y}</text>
      ))}
    </>
  );
}

// A line's run off the right edge fades out: a gradient across the inset,
// from the line's colour to nothing.
function RunFade({ id, f, color }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={f.x1} x2={f.W} y1="0" y2="0">
      <stop offset="0" stopColor={color} stopOpacity="0.9"/><stop offset="1" stopColor={color} stopOpacity="0"/>
    </linearGradient>
  );
}

// A safe id for url(#…) from useId's.
const svgId = raw => raw.replace(/[^\w-]/g, "");

function NetWorthBand({ age, horizon, trajectory, chartRef, chartWidth }) {
  const id = `nw${svgId(useId())}`;
  const values = trajectory.map(r => r.netWorth);
  const f = bandFrame(chartWidth, horizon);
  const { W, PT, axisY, x0, sx, year0, labelled } = f;
  // The left run: the first year's change carried back to the screen's edge.
  const leftValue = values[0] - (values[1] - values[0]) * (x0 / f.perYear);
  const rightEnd = Math.min(values.length - 1, f.runTo);
  // Scaled to the years from now to the horizon only: the runs off each edge
  // aren't the user's figures, so they mustn't squash the line. Where one
  // would leave the chart, it's held at its top or bottom.
  const shown = values.slice(0, horizon + 1);
  const yMin = Math.min(...shown), yMax = Math.max(...shown);
  const span = yMax - yMin || Math.max(1, Math.abs(yMax));
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
  const end = values[horizon];
  return (
    <>
      <div style={{fontFamily:SERIF,fontSize:"var(--hero-fig)",fontWeight:700,color:CREAM,lineHeight:1.05,letterSpacing:"-0.01em",marginTop:"6px"}}>{signed(end)}</div>
      <p style={SR_ONLY}>
        {age ? `At age ${age + horizon}` : `In ${horizon} years`}, in {year0 + horizon}, from {signed(values[0])} now. {labelled.slice(1, -1).map(y => `${year0 + y}: ${signed(values[y])}.`).join(" ")}
      </p>
      <div ref={chartRef} style={{margin:"8px -20px 0"}}>
        <svg width={W} height={f.H} viewBox={`0 0 ${W} ${f.H}`} style={{display:"block",overflow:"visible"}} aria-hidden="true">
          <defs>
            <linearGradient id={`${id}l`} gradientUnits="userSpaceOnUse" x1="0" x2={x0} y1="0" y2="0">
              <stop offset="0" stopColor={CREAM} stopOpacity="0"/><stop offset="1" stopColor={CREAM} stopOpacity="0.9"/>
            </linearGradient>
            <RunFade id={`${id}r`} f={f} color={CREAM}/>
          </defs>
          <BandAxis f={f} horizon={horizon}/>
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
      <div style={{...anchor,display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px"}}>
        <span style={caps(t)}>Breakdown {age ? `at age ${age+horizon}` : `at ${horizon}yrs`}</span>
        <InfoButton onClick={() => setShowNwAssumptions(o => !o)} open={showNwAssumptions}/>
        <AnimatePresence>
          {showNwAssumptions && (
            <TilePopover key="how" title="How it's worked out" onClose={() => setShowNwAssumptions(false)}>
              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                {[`Cash grows at your own savings rate, and is assumed to never exceed your ${fmt(m.emergencyBuffer)} emergency fund target.`,
                  "Once that's topped up, all further monthly surplus is assumed fully invested into the market (growing at 7% p.a. nominal) rather than held as cash. Your pension grows at 6% p.a. — the same rates the rest of the app uses.",
                  "Student loan, personal loan and mortgage are paid down at their real rates and repayments. Property value is held flat — no house-price growth is assumed.",
                ].map(line => <p key={line} style={{fontSize:"13.5px",color:TEXT,lineHeight:1.5,margin:0}}>{line}</p>)}
              </div>
            </TilePopover>
          )}
        </AnimatePresence>
      </div>
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

// The one-off pill for a non-subscriber: £0, not editable, in the blues of
// the app's other subscriber features, with a sheen passing over it and a
// lock.
const LOCKED_PILL_CSS = `
.lump-lock { position: relative; overflow: hidden; }
.lump-lock > * { position: relative; z-index: 1; }
.lump-lock::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 260%; z-index: 0; pointer-events: none;
  background: linear-gradient(112deg, transparent 32%, rgba(255,255,255,0.3) 46%, transparent 60%);
  will-change: transform; animation: lump-lock-sheen 7s ease-in-out infinite; }
@keyframes lump-lock-sheen { 0% { transform: translateX(-75%); } 55%, 100% { transform: translateX(25%); } }
@media (prefers-reduced-motion: reduce) { .lump-lock::after { animation: none; transform: translateX(-30%); } }
`;
// On the dark band, softened as the other pill is: the subscriber wash
// (CTA_WASH) at 40% with a dotted blue edge, its caption a pale blue that
// reads on it.
const LOCKED_ON_DARK = { fill: "rgba(234,243,254,0.4)", edge: "rgba(140,190,255,0.75)", label: "#d6e8ff" };
function LockedLumpPill({ onClick }) {
  return (
    <button type="button" className="lump-lock" onClick={onClick} aria-label="One-off today. Adding one is for subscribers"
      style={{flex:1,minWidth:0,background:LOCKED_ON_DARK.fill,border:`1.5px dotted ${LOCKED_ON_DARK.edge}`,borderRadius:"100px",padding:"0 16px",height:PILL_HEIGHT,boxSizing:"border-box",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"flex-start",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
      <style>{LOCKED_PILL_CSS}</style>
      <span style={{display:"flex",alignItems:"center",gap:"4px",fontSize:"9.5px",fontWeight:700,color:LOCKED_ON_DARK.label,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>
        One-off today<Lock size={10} strokeWidth={2.6} aria-hidden="true"/>
      </span>
      <span style={{...PILL_ANSWER_TEXT,color:"rgba(250,247,240,0.6)"}}>£0</span>
    </button>
  );
}

// ── The Surplus view, drawn straight on the dark band ──────────────────
// What goes in by the horizon (each month's amount and the one-off), then
// a line for each place it could go, in that place's colour (the rows below
// carry the same colours, so there's no key). The same frame as Net worth:
// an axis from Now to the horizon's year, each line marked on the labelled
// years, ending in a dot and running on to the right edge, fading. Not to the left: nothing has gone
// in before today. A line that stops before the horizon (a student loan
// cleared or written off) ends at its dot there. A line whose row below is
// tapped off isn't drawn, and the rest are scaled to fill the graph.
// Hovering, or touching and dragging along, the graph reads one year: a
// guide at that year, a marker on each line and its £ beside it.
function SurplusBand({ horizon, monthly, lump, lumpLocked, series, options, hidden, chartRef, chartWidth }) {
  const id = `sp${svgId(useId())}`;
  const f = bandFrame(chartWidth, horizon);
  const { W, PT, axisY, sx, year0 } = f;
  const putIn = monthly * 12 * horizon + lump;
  // Only the places the estimates below list at this horizon.
  const listed = new Set(options.map(o => o.label));
  const lines = series.series.filter(s => listed.has(s.label) && !hidden.has(s.label)).map(s => {
    // Stops before the horizon, as the series worked out to the horizon
    // alone would say (one that stops on it runs on, flat).
    const stop = s.termYear != null && s.termYear < horizon ? s.termYear : null;
    return { label: s.label, color: FORECAST_COLORS[s.label] || CREAM_SOFT, values: s.values, end: stop ?? horizon, runs: stop == null };
  });
  const allHidden = listed.size > 0 && lines.length === 0 && putIn > 0;
  // Scaled to the years up to the horizon, from £0; a run that would leave
  // the top is held there.
  const yMax = Math.max(0, ...lines.flatMap(l => l.values.slice(0, l.end + 1)));
  const empty = yMax <= 0;
  // The year being read, and whether the arrow keys moved it there (only
  // then is it read out: hovering would read out every year passed).
  const [reading, setReading] = useState(null);
  const at = !empty && reading && reading.year <= horizon ? reading.year : null;
  const yearAt = e => {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    return Math.max(0, Math.min(horizon, Math.round((x - f.x0) / f.perYear)));
  };
  // A mouse reads as it moves and lets go as it leaves; a finger's reading
  // stays after it lifts, until a tap anywhere else.
  const onScrub = e => {
    if (e.type === "pointermove" && e.pointerType !== "mouse" && !e.buttons) return; // a pen hovering
    const year = yearAt(e);
    setReading(r => r && r.year === year && !r.keys ? r : { year, keys: false });
  };
  const reads = at != null;
  useEffect(() => {
    if (!reads) return;
    const away = e => { if (!e.target.closest?.("[data-scrub]")) setReading(null); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [reads]);
  // A new horizon starts with nothing read.
  useEffect(() => setReading(null), [horizon]);
  const onKeyDown = e => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    let year;
    if (step) year = Math.max(0, Math.min(horizon, (at ?? (step > 0 ? -1 : horizon + 1)) + step));
    else if (e.key === "Home") year = 0;
    else if (e.key === "End") year = horizon;
    else if (e.key === "Escape" && at != null) { setReading(null); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    setReading({ year, keys: true });
  };
  const yearName = y => y === 0 ? "Now" : String(year0 + y);
  const sy = v => PT + (1 - v / (yMax || 1)) * (axisY - 10 - PT);
  const syRun = v => Math.max(PT - 10, sy(v));
  const path = (l, from, to, y = sy) => `M${l.values.slice(from, to + 1).map((v, k) => `${sx(from + k).toFixed(1)},${y(v).toFixed(1)}`).join(" L")}`;
  const rightEnd = Math.min(series.years.length - 1, f.runTo);
  // Each line reaching the year read, its £ beside the guide: on the right
  // of it, or the left near the right edge. Labels go in the order the
  // lines sit, each nudged off its line only as far as keeps them apart.
  const readout = at == null ? [] : lines.filter(l => at <= l.end)
    .map(l => ({ label: l.label, color: l.color, v: l.values[at], y: sy(l.values[at]) }))
    .sort((a, b) => a.y - b.y);
  const GAP = 17, top = PT, bottom = axisY - 9;
  readout.forEach((r, k) => { r.ly = Math.max(r.y, k ? readout[k - 1].ly + GAP : top); });
  for (let k = readout.length - 1; k >= 0; k--) {
    readout[k].ly = Math.min(readout[k].ly, k === readout.length - 1 ? bottom : readout[k + 1].ly - GAP);
  }
  const onLeft = at != null && sx(at) > W - 120;
  return (
    <>
      <div style={{display:"flex",alignItems:"baseline",flexWrap:"wrap",columnGap:"8px",marginTop:"6px"}}>
        <span style={{fontFamily:SERIF,fontSize:"var(--hero-fig)",fontWeight:700,color:CREAM,lineHeight:1.05,letterSpacing:"-0.01em"}}>{fmt(putIn)}</span>
        <span style={{fontSize:"14px",fontWeight:600,color:CREAM_SOFT}}>put in by {year0 + horizon}</span>
      </div>
      {!empty && (
        <p style={SR_ONLY}>
          By {year0 + horizon}: {lines.map(l => `${FORECAST_SHORT_LABEL[l.label] || l.label} ${fmt(l.values[l.end])}${l.end < horizon ? ` (stops in ${year0 + l.end})` : ""}`).join(", ")}.
        </p>
      )}
      <div ref={chartRef} data-scrub={empty ? undefined : ""} tabIndex={empty ? undefined : 0} role={empty ? undefined : "group"}
        aria-label={empty ? undefined : "Surplus graph. Left and right arrow keys read each year."}
        onPointerDown={empty ? undefined : onScrub} onPointerMove={empty ? undefined : onScrub}
        onPointerLeave={e => { if (e.pointerType === "mouse") setReading(null); }} onKeyDown={empty ? undefined : onKeyDown} onBlur={() => setReading(null)}
        className="surplus-scrub" style={{margin:"8px -20px 0",position:"relative",touchAction:"pan-y",outline:"none",cursor:empty ? undefined : "crosshair"}}>
        <style>{`.surplus-scrub:focus-visible { box-shadow: inset 0 0 0 2px ${CREAM_SOFT}; border-radius: 12px; }`}</style>
        {empty && (
          <p style={{position:"absolute",left:f.x0 + 12,right:BAND_INSET + 12,top:PT,bottom:f.H - axisY + 12,margin:0,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",fontSize:"13.5px",lineHeight:1.45,color:CREAM_SOFT}}>
            {allHidden ? "Every line is hidden. Tap a name below to show it again."
              : lumpLocked ? "Add an amount each month to see where it could grow." : "Add an amount each month, or one-off, to see where it could grow."}
          </p>
        )}
        <div aria-live="polite" style={SR_ONLY}>
          {at != null && reading.keys ? `${yearName(at)}: ${readout.map(r => `${FORECAST_SHORT_LABEL[r.label] || r.label} ${fmt(r.v)}`).join(", ") || "no line reaches this year"}` : ""}
        </div>
        <svg width={W} height={f.H} viewBox={`0 0 ${W} ${f.H}`} style={{display:"block",overflow:"visible"}} aria-hidden="true">
          <defs>{lines.map((l, i) => <RunFade key={l.label} id={`${id}r${i}`} f={f} color={l.color}/>)}</defs>
          <BandAxis f={f} horizon={horizon}/>
          {!empty && lines.map((l, i) => (
            <g key={l.label}>
              {l.runs && rightEnd > horizon && <path d={path(l, horizon, rightEnd, syRun)} fill="none" stroke={`url(#${id}r${i})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>}
              <path d={path(l, 0, l.end)} fill="none" stroke={l.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              {/* A marker on each labelled year the line reaches, and a
                  larger one where it ends. */}
              {f.labelled.filter(y => y < l.end).map(y => <circle key={y} cx={sx(y)} cy={sy(l.values[y])} r="3.5" fill={l.color}/>)}
              <circle cx={sx(l.end)} cy={sy(l.values[l.end])} r="4.5" fill={l.color}/>
            </g>
          ))}
          {at != null && (
            <g style={{pointerEvents:"none"}}>
              <line x1={sx(at)} x2={sx(at)} y1={PT - 8} y2={axisY} stroke={CREAM_SOFT} strokeWidth="1" strokeDasharray="2 3"/>
              <text x={sx(at)} y={PT - 13} textAnchor="middle" fill={CREAM} fontSize="11" fontWeight="800" fontFamily={SANS}>{yearName(at)}</text>
              {readout.map(r => <circle key={r.label} cx={sx(at)} cy={r.y} r="5" fill={r.color} stroke={READ_BG} strokeWidth="2"/>)}
              {readout.map(r => {
                const text = fmtK1(r.v), w = 21 + text.length * 6.4;
                const x = onLeft ? sx(at) - 10 - w : sx(at) + 10;
                return (
                  <g key={r.label} transform={`translate(${x.toFixed(1)},${(r.ly - 8).toFixed(1)})`}>
                    <rect width={w} height="16" rx="8" fill={READ_BG}/>
                    <circle cx="8" cy="8" r="3.5" fill={r.color}/>
                    <text x="15" y="12" fill={CREAM} fontSize="11" fontWeight="700" fontFamily={SANS}>{text}</text>
                  </g>
                );
              })}
            </g>
          )}
        </svg>
      </div>
    </>
  );
}

// Below the horizon on the Surplus view: what goes in, in quiet pills (no
// fill, a dotted edge) so the graph leads. Each month's amount starts
// empty, our estimate from their answers only its placeholder, and its ?
// pops out what to put in, centred on the screen (the band would cut off a
// card hung below it). The one-off is a subscriber feature
// (LockedLumpPill otherwise).
const POP_CENTRED = { position:"fixed", inset:0, margin:"auto", height:"fit-content", width:"min(340px, calc(100vw - 40px))", transformOrigin:"center", padding:"18px 20px 20px" };
function SurplusInputs({ surplus, estimate, setSurplus, lumpLocked, onLocked, lumpSum, setLumpSum }) {
  const [why, setWhy] = useState(false);
  const info = (
    <InfoButton onClick={e => { e.preventDefault(); setWhy(w => !w); }} open={why}
      style={{background:CREAM_SOFT,color:G,width:"13px",height:"13px",lineHeight:"13px",fontSize:"9px"}}/>
  );
  return (
    <div style={{marginTop:"18px"}}>
      <div style={{display:"flex",gap:"10px"}}>
        <PillMoneyInput onDark label="Each month" labelExtra={info} value={surplus} onChange={setSurplus} placeholder={formatThousands(estimate)}/>
        {lumpLocked ? <LockedLumpPill onClick={onLocked}/> : <PillMoneyInput onDark label="One-off today" value={lumpSum} onChange={setLumpSum}/>}
      </div>
      <AnimatePresence>
        {why && (
          <TilePopover key="each-month" title="Each month" onClose={() => setWhy(false)} style={POP_CENTRED}>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              <p style={{fontSize:"14px",color:TEXT,lineHeight:1.5,margin:0}}>What you usually have left at the end of a month, once bills and spending are paid.</p>
              <p style={{fontSize:"14px",color:TEXT,lineHeight:1.5,margin:0}}>The same amount goes into each line above, so you can compare where it could grow the most.</p>
            </div>
          </TilePopover>
        )}
      </AnimatePresence>
    </div>
  );
}

// Below the band while Surplus is up: each place's low, mid and high
// estimate at the horizon, its ? popping out its assumptions. Tapping a
// place's name takes its line off the graph or puts it back: its dot
// hollow while it's off.
function SurplusEstimates({ t, horizon, age, forecast, assumptions, openTip, setOpenTip, hidden, onToggle, canHide }) {
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
      {/* Only once there are lines to hide. */}
      {canHide && <p style={{fontSize:"11.5px",color:t.body,lineHeight:1.4,margin:"-4px 0 4px"}}>Tap a name to hide or show its line.</p>}
      {forecast.options.map((o,i) => {
        const isOpen = openTip === o.label;
        const a = assumptions[o.label];
        const shown = !hidden.has(o.label);
        const color = FORECAST_COLORS[o.label] || MUT;
        return (
          <div key={o.label} style={{...anchor,padding:"10px 0",borderBottom:i===forecast.options.length-1?"none":`1px solid ${t.rule}`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:"7px",minWidth:0}}>
                {/* The 44px tap height reaches into the row's padding. */}
                <button type="button" onClick={() => onToggle(o.label)} aria-pressed={shown}
                  style={{display:"flex",alignItems:"center",gap:"7px",minWidth:0,minHeight:"44px",margin:"-12px 0",padding:0,background:"none",border:0,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                  <span style={{width:"8px",height:"8px",boxSizing:"border-box",borderRadius:"50%",background:shown ? color : "transparent",border:`1.5px solid ${color}`,display:"inline-block",flexShrink:0,transition:"background 0.15s"}}/>
                  <span style={{fontSize:"13px",color:t.figure,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {FORECAST_SHORT_LABEL[o.label]||o.label}<span style={SR_ONLY}>, line on the graph</span>
                  </span>
                </button>
                {a && <InfoButton onClick={() => setOpenTip(isOpen ? null : o.label)} open={isOpen}/>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"48px 48px 48px",gap:"6px",flexShrink:0}}>
                <span style={{fontSize:"12px",color:t.body,textAlign:"right"}}>{fmtCompact(o.low)}</span>
                <span style={{fontFamily:SERIF,fontSize:"12.5px",color:t.figure,fontWeight:700,textAlign:"right"}}>{fmtCompact(o.central)}</span>
                <span style={{fontSize:"12px",color:t.body,textAlign:"right"}}>{fmtCompact(o.high)}</span>
              </div>
            </div>
            {o.note && <div style={{fontSize:"11px",color:t.body,marginTop:"3px",lineHeight:1.4}}>{o.note}</div>}
            <AnimatePresence>
              {isOpen && a && (
                <TilePopover key="why" title={o.label} onClose={() => setOpenTip(null)}>
                  <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                    {a.lines.map((line,i) => <p key={i} style={{fontSize:"13.5px",color:TEXT,lineHeight:1.5,margin:0}}>{line}</p>)}
                    <div style={{display:"flex",gap:"14px",fontSize:"12px",color:MUT}}>
                      <span>Low <b style={{color:TEXT}}>{a.rates.low}</b></span>
                      <span>Central <b style={{color:TEXT}}>{a.rates.central}</b></span>
                      <span>High <b style={{color:TEXT}}>{a.rates.high}</b></span>
                    </div>
                  </div>
                </TilePopover>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </>
  );
}
