import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { G, MUT, TEXT, SERIF, SUCCESS, RADIUS_CARD } from "../design-tokens.js";
import { bankedChanges, gainedSoFar, MODULE_META } from "../lib/moduleStatus.js";
import { hasAccess, accessInfo, PLANS } from "../lib/entitlement.js";
import { fmt } from "../lib/format.js";

// Home's "Gained from your changes" (moduleStatus.js gainedSoFar). The
// yearly worth of the changes leads, since the pot itself starts small (a
// change worth £900 a year is £2 on its first day); the chart shows the pot
// filling over the year, solid to today and dashed from there on, so it
// reads as money coming in from day one. For a subscriber, the worth against
// what they pay. A section background, not a card (CLAUDE.md rule 3).

const DAY = 86400000;
// A UTC-midnight day number as the local date gainedSoFar reads.
const asLocal = ms => { const t = new Date(ms); return new Date(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()); };
const fmtDay = (ms, year) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });

export default function GainedFromChanges({ d }) {
  const [open, setOpen] = useState(false);
  const gained = gainedSoFar(d);
  const kicker = { fontSize:"11px", fontWeight:600, color:MUT, letterSpacing:"0.09em", textTransform:"uppercase" };

  if (!gained.count) return (
    <div style={{marginTop:"22px"}}>
      <div style={kicker}>Gained from your changes</div>
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

  return (
    <div style={{marginTop:"16px",background:"rgba(45,107,74,0.07)",borderRadius:RADIUS_CARD,padding:"18px 18px 14px"}}>
      <div style={kicker}>Gained from your changes</div>
      <div style={{display:"flex",alignItems:"baseline",gap:"6px",marginTop:"6px"}}>
        <span style={{fontFamily:SERIF,fontSize:"38px",fontWeight:700,color:SUCCESS,lineHeight:1.1}}>{fmt(gained.perYear)}</span>
        <span style={{fontSize:"15px",fontWeight:600,color:TEXT}}>a year</span>
      </div>
      <p style={{fontSize:"13px",color:MUT,lineHeight:1.45,margin:"4px 0 0"}}>
        About {fmt(Math.round(gained.perYear / 12))} a month, estimated, from the changes you've made.
        {compare && <> <span style={{fontWeight:700,color:TEXT}}>{compare}.</span></>}
      </p>
      <GainChart d={d} soFar={gained.total}/>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{marginTop:"10px",background:"none",border:"none",padding:0,fontSize:"13px",fontWeight:700,color:G,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:"2px"}}>
        By module<ChevronDown size={14} style={{transform:open?"rotate(180deg)":"none",transition:"transform 0.2s"}}/>
      </button>
      {open && (
        <div style={{display:"flex",flexDirection:"column",gap:"8px",marginTop:"10px"}}>
          {gained.byModule.map(g => (
            <div key={g.key} style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:"12px"}}>
              <span style={{fontSize:"13px",color:TEXT}}>{MODULE_META.find(mm => mm.key === g.key)?.title || g.key}</span>
              <span style={{fontSize:"13px",color:MUT,whiteSpace:"nowrap"}}><b style={{color:TEXT}}>{fmt(g.perYear)} a year</b> · {fmt(g.gained)} so far</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The pot over a year from the first change: solid to today, dashed after
// (if the changes stay in place). Exact at each change, linear between, so
// the points are just the change days, today and the end. Tap or hover for
// the figure on any day.
function GainChart({ d, soFar }) {
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
  const days = bankedChanges(d).map(c => Date.parse(c.on));
  const start = Math.min(today, ...days);
  // 365 days, the first counted, so a year on the pot is the yearly figure.
  const end = Math.max(start + 364 * DAY, today + 60 * DAY);
  const at = ms => gainedSoFar(d, asLocal(ms)).total;
  const points = [...new Set([start, ...days, today, end])].sort((a, b) => a - b).map(ms => ({ ms, v: at(ms) }));
  const top = Math.max(1, points[points.length - 1].v);

  const H = 120, padTop = 26, padBottom = 20;
  const x = ms => ((ms - start) / (end - start)) * width;
  const y = v => padTop + (1 - v / top) * (H - padTop - padBottom);
  const base = H - padBottom;
  const line = pts => pts.map((p, i) => `${i ? "L" : "M"}${x(p.ms).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const past = points.filter(p => p.ms <= today), ahead = points.filter(p => p.ms >= today);
  const area = `${line(past)} L${x(today).toFixed(1)},${base} L${x(start).toFixed(1)},${base} Z`;
  const endValue = points[points.length - 1].v;
  // The end label only when it won't run into today's.
  const showEnd = x(end) - x(today) > 120;
  const todayX = Math.min(Math.max(x(today), 4), width - 4);
  const todayAnchor = todayX < 60 ? "start" : todayX > width - 60 ? "end" : "middle";

  const move = e => {
    const r = ref.current.getBoundingClientRect();
    const ms = start + Math.round(Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * (end - start) / DAY) * DAY;
    setHover({ ms, v: at(ms) });
  };
  const tip = hover && (hover.ms > today ? `Projected: ${fmt(hover.v)} by ${fmtDay(hover.ms, true)}` : `${fmt(hover.v)} by ${fmtDay(hover.ms)}`);

  return (
    <div ref={ref} style={{position:"relative",marginTop:"14px",touchAction:"pan-y"}}
      onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)}>
      <svg width={width} height={H} role="img" style={{display:"block",overflow:"visible"}}
        aria-label={`${fmt(soFar)} gained so far; ${fmt(endValue)} by ${fmtDay(end, true)} if the changes stay in place.`}>
        <line x1={0} x2={width} y1={base} y2={base} stroke="rgba(22,47,36,0.15)" strokeWidth={1}/>
        <path d={area} fill={SUCCESS} opacity={0.14}/>
        <path d={line(ahead)} fill="none" stroke={SUCCESS} strokeWidth={2} strokeDasharray="4 4" opacity={0.55} strokeLinecap="round"/>
        <path d={line(past)} fill="none" stroke={SUCCESS} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
        {showEnd && !hover && <text x={width} y={y(endValue) - 10} textAnchor="end" fontSize="12" fill={MUT}>{fmt(endValue)} by {fmtDay(end)}</text>}
        <circle cx={todayX} cy={y(soFar)} r={5} fill={SUCCESS} stroke="#eef3ee" strokeWidth={2}/>
        <text x={todayX} y={y(soFar) - 12} textAnchor={todayAnchor} fontSize="12.5" fontWeight="700" fill={TEXT}>{fmt(soFar)} so far</text>
        <text x={0} y={H - 4} fontSize="11" fill={MUT}>{fmtDay(start)}</text>
        <text x={width} y={H - 4} textAnchor="end" fontSize="11" fill={MUT}>{fmtDay(end, true)}</text>
        {hover && <>
          <line x1={x(hover.ms)} x2={x(hover.ms)} y1={padTop - 8} y2={base} stroke="rgba(22,47,36,0.3)" strokeWidth={1}/>
          <circle cx={x(hover.ms)} cy={y(hover.v)} r={4} fill={SUCCESS} stroke="#eef3ee" strokeWidth={2}/>
        </>}
      </svg>
      {hover && (
        <div style={{position:"absolute",top:"-6px",left:Math.min(Math.max(x(hover.ms) - 110, 0), width - 220),width:"220px",textAlign:"center",pointerEvents:"none"}}>
          <span style={{display:"inline-block",background:"#fff",border:"1px solid rgba(22,47,36,0.12)",borderRadius:"8px",padding:"4px 8px",fontSize:"12px",fontWeight:600,color:TEXT,whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(22,47,36,0.1)"}}>{tip}</span>
        </div>
      )}
    </div>
  );
}
