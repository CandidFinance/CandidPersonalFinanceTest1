import { useState, useRef, useEffect } from "react";
import { MUT, TEXT, SERIF, SUCCESS, RADIUS_CARD, HERO_TILE_BG, MODULE_CHART_COLOR } from "../design-tokens.js";
import { bankedChanges, gainedSoFar, taxYearStart, MODULE_META } from "../lib/moduleStatus.js";
import { hasAccess, accessInfo, PLANS } from "../lib/entitlement.js";
import { fmt } from "../lib/format.js";

// Home's "Gains" (moduleStatus.js gainedSoFar). The
// yearly worth of the changes leads, since the pot itself starts small (a
// change worth £900 a year is £2 on its first day); the chart shows the pot
// filling over the tax year, split by module, solid to today and pale for
// the rest of the year, so it reads as money coming in from day one. The
// pot starts again each 6 April, with what came before in one line. For a subscriber,
// the worth against what they pay. Same oil-slick fill as the score tile.

const DAY = 86400000;
// A UTC-midnight day number as the local date gainedSoFar reads.
const asLocal = ms => { const t = new Date(ms); return new Date(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()); };
const fmtDay = (ms, year) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });

// Each module's colour is its chart colour everywhere (MODULE_CHART_COLOR).
// Those are soft and some sit close together, so colour never works alone:
// the legend below and the tooltip name them.
const SURFACE = "#F7F9F5";
const titleOf = key => MODULE_META.find(mm => mm.key === key)?.title || key;
const Dot = ({ color }) => <span style={{width:"8px",height:"8px",borderRadius:"50%",background:color,display:"inline-block",flexShrink:0}}/>;

export default function GainedFromChanges({ d }) {
  const gained = gainedSoFar(d);
  const from = taxYearStart();
  const thisYear = gainedSoFar(d, new Date(), from);
  const kicker = { fontSize:"11px", fontWeight:600, color:MUT, letterSpacing:"0.09em", textTransform:"uppercase" };

  if (!gained.count) return (
    <div style={{marginTop:"22px"}}>
      <div style={kicker}>Saved</div>
      <p style={{fontSize:"13px",color:MUT,lineHeight:1.45,margin:"6px 0 0"}}>
        When you make a change and update your figures in a module, what it's worth adds up here.
      </p>
    </div>
  );

  // What they pay a year, on their plan; rounded down so it never overstates.
  const paying = hasAccess();
  const cost = accessInfo()?.plan === "monthly" ? PLANS.monthly.amount * 12 : PLANS.yearly.amount;
  const times = Math.floor(gained.perYear / cost);
  const compare = !paying || gained.perYear <= cost ? null
    : times >= 2 ? `${times}x what you pay for Candid` : "More than you pay for Candid";
  // Largest first: at the bottom of the stack, and top of the legend.
  const keys = gained.byModule.map(g => g.key);

  return (
    <div style={{marginTop:"16px",background:HERO_TILE_BG,border:"1px solid rgba(22,47,36,0.08)",borderRadius:RADIUS_CARD,padding:"18px 18px 16px",boxShadow:"0 4px 18px rgba(22,47,36,0.07)"}}>
      <div style={kicker}>Saved</div>
      <div style={{display:"flex",alignItems:"baseline",gap:"6px",marginTop:"6px"}}>
        <span style={{fontFamily:SERIF,fontSize:"38px",fontWeight:700,color:SUCCESS,lineHeight:1.1}}>{fmt(gained.perYear)}</span>
        <span style={{fontSize:"15px",fontWeight:600,color:TEXT}}>a year</span>
      </div>
      <p style={{fontSize:"13px",color:MUT,lineHeight:1.45,margin:"4px 0 0"}}>
        About {fmt(Math.round(gained.perYear / 12))} a month, estimated, from the changes you've made.
        {compare && <> <span style={{fontWeight:700,color:TEXT}}>{compare}.</span></>}
      </p>
      <GainChart d={d} keys={keys} from={from} soFar={thisYear.total}/>
      {/* The legend, and the figures behind the bands: always shown. */}
      <div style={{display:"flex",flexDirection:"column",gap:"8px",marginTop:"14px",paddingTop:"12px",borderTop:"1px solid rgba(22,47,36,0.08)"}}>
        {thisYear.byModule.map(g => (
          <div key={g.key} style={{display:"flex",alignItems:"center",gap:"8px"}}>
            {keys.length > 1 && <Dot color={MODULE_CHART_COLOR[g.key] || SUCCESS}/>}
            <span style={{fontSize:"13px",color:TEXT,flex:1,minWidth:0}}>{titleOf(g.key)}</span>
            <span style={{fontSize:"13px",color:MUT,whiteSpace:"nowrap"}}><b style={{color:TEXT}}>{fmt(g.perYear)} a year</b> · {fmt(g.gained)} this tax year</span>
          </div>
        ))}
      </div>
      {/* Gained before this tax year, so the reset each April never hides it. */}
      {gained.total > thisYear.total && (
        <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.45,margin:"10px 0 0"}}>{fmt(gained.total)} in all since your first change.</p>
      )}
    </div>
  );
}

// The pot over the tax year, 6 April to 5 April, one band per module
// stacked in `keys` order (bottom first): full colour to today, pale after
// (if the changes stay in place), with a dashed line along the projected
// top. Today's point moves right through the year, and it all starts again
// on 6 April. Exact at each change, linear between, so the points are just
// the change days, today and the end. Tap or hover for the figures on any
// day.
function GainChart({ d, keys, from, soFar }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const start = Date.parse(from);
  const end = Date.UTC(new Date(start).getUTCFullYear() + 1, 3, 5);
  const days = bankedChanges(d).map(c => Date.parse(c.on)).filter(ms => ms > start && ms <= end);
  // Each module's pot on a day, and the running total up the stack.
  const at = ms => {
    const g = gainedSoFar(d, asLocal(ms), from);
    const by = Object.fromEntries(g.byModule.map(m => [m.key, m.gained]));
    let sum = 0;
    return { ms, total: g.total, by, tops: keys.map(k => (sum += by[k] || 0)) };
  };
  const points = [...new Set([start, ...days, today, end])].sort((a, b) => a - b).map(at);
  const top = Math.max(1, ...points.map(p => p.tops[p.tops.length - 1]));

  const H = 130, padTop = 26, padBottom = 20;
  const x = ms => ((ms - start) / (end - start)) * width;
  const y = v => padTop + (1 - v / top) * (H - padTop - padBottom);
  const base = H - padBottom;
  const xy = (ms, v) => `${x(ms).toFixed(1)},${y(v).toFixed(1)}`;
  // Band i between the stack's level i-1 and level i, over `pts`.
  const band = (pts, i) => {
    const upper = pts.map(p => xy(p.ms, p.tops[i]));
    const lower = [...pts].reverse().map(p => xy(p.ms, i ? p.tops[i - 1] : 0));
    return `M${upper.join(" L")} L${lower.join(" L")} Z`;
  };
  const past = points.filter(p => p.ms <= today), ahead = points.filter(p => p.ms >= today);
  const topLine = pts => pts.map((p, i) => `${i ? "L" : "M"}${xy(p.ms, p.tops[p.tops.length - 1])}`).join(" ");
  const todayX = Math.min(Math.max(x(today), 4), width - 4);
  const todayAnchor = todayX < 60 ? "start" : todayX > width - 60 ? "end" : "middle";
  // Today's date sits on the date row under the dot; the year's first and
  // last dates give way when it would run into them.
  const showStart = todayX > 90, showEnd = todayX < width - 120;
  const colour = k => MODULE_CHART_COLOR[k] || SUCCESS;

  const move = e => {
    const r = ref.current.getBoundingClientRect();
    const ms = start + Math.round(Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * (end - start) / DAY) * DAY;
    setHover(at(ms));
  };

  return (
    <div ref={ref} style={{position:"relative",marginTop:"14px",touchAction:"pan-y"}}
      onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)}>
      <svg width={width} height={H} role="img" style={{display:"block",overflow:"visible"}}
        aria-label={`${fmt(soFar)} saved so far this tax year. Figures by module below.`}>
        <line x1={0} x2={width} y1={base} y2={base} stroke="rgba(22,47,36,0.15)" strokeWidth={1}/>
        {/* A 2px line in the tile's colour round each band keeps
            neighbouring bands apart. */}
        {keys.map((k, i) => <path key={`a${k}`} d={band(ahead, i)} fill={colour(k)} fillOpacity={0.45} stroke={SURFACE} strokeWidth={2} strokeLinejoin="round"/>)}
        {past.length > 1 && keys.map((k, i) => <path key={`p${k}`} d={band(past, i)} fill={colour(k)} stroke={SURFACE} strokeWidth={2} strokeLinejoin="round"/>)}
        <path d={topLine(ahead)} fill="none" stroke="rgba(22,47,36,0.45)" strokeWidth={1.5} strokeDasharray="4 4" strokeLinecap="round"/>
        <line x1={todayX} x2={todayX} y1={y(soFar)} y2={base} stroke="rgba(22,47,36,0.35)" strokeWidth={1}/>
        <circle cx={todayX} cy={y(soFar)} r={4.5} fill={TEXT} stroke={SURFACE} strokeWidth={2}/>
        <text x={todayX} y={y(soFar) - 11} textAnchor={todayAnchor} fontSize="12.5" fontWeight="700" fill={TEXT}>{fmt(soFar)} so far</text>
        {showStart && <text x={0} y={H - 4} fontSize="11" fill={MUT}>{fmtDay(start)}</text>}
        {showEnd && <text x={width} y={H - 4} textAnchor="end" fontSize="11" fill={MUT}>{fmtDay(end, true)}</text>}
        <text x={todayX} y={H - 4} textAnchor={todayAnchor} fontSize="11" fontWeight="700" fill={TEXT}>{fmtDay(today)}</text>
        {hover && <line x1={x(hover.ms)} x2={x(hover.ms)} y1={padTop - 8} y2={base} stroke="rgba(22,47,36,0.4)" strokeWidth={1}/>}
      </svg>
      {hover && (
        // Inside the chart's top, on the side away from the finger.
        <div style={{position:"absolute",top:0,...(x(hover.ms) > width / 2 ? { left: 0 } : { right: 0 }),width:"200px",pointerEvents:"none",background:"#fff",border:"1px solid rgba(22,47,36,0.12)",borderRadius:"8px",padding:"6px 9px",boxShadow:"0 2px 8px rgba(22,47,36,0.1)",boxSizing:"border-box"}}>
          <div style={{fontSize:"12px",fontWeight:700,color:TEXT}}>{hover.ms > today ? "Projected: " : ""}{fmt(hover.total)} by {fmtDay(hover.ms, hover.ms > today)}</div>
          {keys.length > 1 && keys.map(k => (
            <div key={k} style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"11.5px",color:MUT,marginTop:"2px"}}>
              <Dot color={colour(k)}/><span style={{flex:1}}>{titleOf(k)}</span><span style={{color:TEXT}}>{fmt(hover.by[k] || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
