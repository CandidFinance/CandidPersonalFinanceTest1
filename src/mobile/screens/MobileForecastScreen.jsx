import { useState, useRef, useEffect } from "react";
import { Lock } from "lucide-react";
import { WHITE, MUT, TEXT, G, GOLD, SERIF, PillSlider, FORECAST_COLORS, FORECAST_SHORT_LABEL } from "../../CandidApp.jsx";
import { calcForecast, calcForecastSeries, calcNetWorthTrajectory, buildForecastAssumptions } from "../../lib/forecast.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";

// Mobile Forecast screen — a "Surplus" comparison view (multi-strategy line
// chart + low/mid/high table) and a "Net worth" view (single projected net
// worth line + asset/liability breakdown), toggled at the top. Both are built
// on shared src/lib/forecast.js functions desktop-equivalent logic already
// uses (calcForecast/calcForecastSeries/calcNetWorthTrajectory/
// buildForecastAssumptions), so the numbers and assumption copy can never
// disagree between mobile and desktop, and nothing here is an invented figure
// — see calcNetWorthTrajectory's own comment for exactly which existing
// growth/paydown assumptions feed the net worth line.
const VIEW_OPTIONS = [{value:"surplus",label:"Surplus"},{value:"networth",label:"Net worth"}];
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
// the way cash is), not an invented feature.
const NW_ROW_META = {
  Cash:               { color:"rgba(196,150,58,0.7)", liquidity:"Available today — no restrictions." },
  Investments:        { color:"#2d6b4a",               liquidity:"Available today if needed, though selling outside an ISA may trigger Capital Gains Tax." },
  Pension:            { color:"#1e4030", locked:true,  liquidity:"Locked until your private pension access age (currently 55, rising to 57 from 2028) — not accessible today." },
  "Property equity":  { color:"#8a4fae", locked:true,  liquidity:"Illiquid — accessing this value means selling or remortgaging." },
  Debts:              { color:"#c0392b",               liquidity:"What you still owe — reduces what you could access, not an asset itself." },
};

export default function MobileForecastScreen({ d, m }) {
  const [view, setView] = useState("surplus");
  const [openRow, setOpenRow] = useState(null);
  const age = +d.age || null;
  const retireAge = +d.retirementAge || 65;
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
  const horizonLabel = (yr) => age ? `age ${age+yr}` : `${yr} yrs`;
  const [horizon, setHorizon] = useState(() => HORIZON_OPTIONS[0]?.value ?? 10);
  const [surplus, setSurplus] = useState(null);
  const [lumpSum, setLumpSum] = useState(null);
  const [openTip, setOpenTip] = useState(null);
  const [showNwAssumptions, setShowNwAssumptions] = useState(false);
  const chartWrapRef = useRef(null);
  // Measured in real CSS pixels so the viewBox always matches the rendered
  // width 1:1 — stretching a small fixed viewBox to fill a wider container
  // (via preserveAspectRatio="none") scaled strokes/text non-uniformly and
  // made the chart look blurry/distorted.
  const [chartWidth, setChartWidth] = useState(340);
  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const update = () => setChartWidth(el.clientWidth || 340);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const forecast = calcForecast(d, m, surplus, horizon, lumpSum ?? 0);
  const series = calcForecastSeries(d, m, surplus, horizon, lumpSum ?? 0);
  const assumptions = buildForecastAssumptions(d, m);
  const netWorthRows = calcNetWorthTrajectory(d, m, horizon);

  const chart = (() => {
    const allValues = series.series.flatMap(s => s.values);
    const yMax = Math.max(1, ...allValues);
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
    return { VW, VH, PL, PR, PT, PB, cW, cH, sx, sy, paths, yTicks, xTicks };
  })();

  const nwChart = (() => {
    const values = netWorthRows.map(r => r.netWorth);
    const yMin = Math.min(0, ...values);
    const yMax = Math.max(1, ...values);
    const VW = chartWidth, VH = 150, PL = 40, PR = 4, PT = 8, PB = 20;
    const cW = VW - PL - PR, cH = VH - PT - PB;
    const sx = i => PL + (i / horizon) * cW;
    const sy = v => PT + (1 - (v - yMin) / (yMax - yMin || 1)) * cH;
    const path = values.map((v,i) => `${i===0?"M":"L"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
    const yTicks = [0, 0.5, 1].map(f => yMin + (yMax - yMin) * f);
    const xTicks = buildYearTicks(horizon);
    return { VW, VH, PL, PR, PT, PB, cW, cH, sx, sy, path, yTicks, xTicks, lastX: sx(horizon), lastY: sy(values[horizon]) };
  })();

  return (
    <div>
      <PillSlider value={view} onChange={setView} options={VIEW_OPTIONS}/>

      <label style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase",marginTop:"16px",display:"block"}}>Time horizon</label>
      <div style={{marginTop:"8px"}}>
        <PillSlider value={horizon} onChange={setHorizon} options={HORIZON_OPTIONS}/>
      </div>

      {view === "surplus" ? (
        <>
      <div style={{display:"flex",gap:"10px",marginTop:"14px"}}>
        <PillMoneyInput label="Monthly surplus" value={surplus != null ? surplus : Math.round(m.monthlySurplus)} onChange={setSurplus}/>
        <PillMoneyInput label="Lump sum today" value={lumpSum} onChange={setLumpSum}/>
      </div>

      <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase",marginTop:"22px"}}>
        Projected value · {horizon} years
      </div>
      <div style={{display:"flex",gap:"14px",marginTop:"8px",flexWrap:"wrap"}}>
        {chart.paths.map(p => (
          <div key={p.label} style={{display:"flex",alignItems:"center",gap:"5px"}}>
            <span style={{width:"7px",height:"7px",borderRadius:"50%",background:FORECAST_COLORS[p.label]||MUT,display:"inline-block"}}/>
            <span style={{fontSize:"11.5px",color:TEXT}}>{FORECAST_SHORT_LABEL[p.label]||p.label}</span>
          </div>
        ))}
      </div>

      <div ref={chartWrapRef} style={{marginTop:"10px"}}>
        <svg width={chart.VW} height={chart.VH} viewBox={`0 0 ${chart.VW} ${chart.VH}`} style={{display:"block"}}>
          {/* Y-axis gridlines + ballpark labels */}
          {chart.yTicks.map((v,i) => (
            <g key={i}>
              <line x1={chart.PL} x2={chart.VW-chart.PR} y1={chart.sy(v)} y2={chart.sy(v)} stroke="rgba(22,47,36,0.08)" strokeWidth="1"/>
              <text x={chart.PL-6} y={chart.sy(v)+3} fontSize="9" fontWeight="700" fill={MUT} textAnchor="end">{fmtCompact(v)}</text>
            </g>
          ))}
          {/* strategy lines */}
          {chart.paths.map(p => (
            <g key={p.label}>
              <path d={p.path} fill="none" stroke={FORECAST_COLORS[p.label]||MUT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx={p.lastX} cy={p.lastY} r="3.5" fill={FORECAST_COLORS[p.label]||MUT}/>
            </g>
          ))}
          {/* X-axis + year/age ticks — first anchors left, last anchors right,
              so labels never spill past the chart's own edges. */}
          <line x1={chart.PL} x2={chart.VW-chart.PR} y1={chart.VH-chart.PB} y2={chart.VH-chart.PB} stroke="rgba(22,47,36,0.25)" strokeWidth="1.5"/>
          {chart.xTicks.map((yr,i) => (
            <text key={i} x={chart.sx(yr)} y={chart.VH-chart.PB+14} fontSize="9" fontWeight="700" fill={MUT}
              textAnchor={i===0?"start":i===chart.xTicks.length-1?"end":"middle"}>
              {i===0 ? "Now" : age ? age+yr : `Yr ${yr}`}
            </text>
          ))}
          <line x1={chart.PL} x2={chart.PL} y1={chart.PT} y2={chart.VH-chart.PB} stroke="rgba(22,47,36,0.25)" strokeWidth="1.5"/>
        </svg>
      </div>

      <div style={{height:"1px",background:"rgba(22,47,36,0.08)",margin:"20px 0"}}/>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px"}}>
        <span style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Estimate at {horizonLabel(horizon)}</span>
        <div style={{display:"grid",gridTemplateColumns:"48px 48px 48px",gap:"6px"}}>
          <span style={{fontSize:"9.5px",fontWeight:700,color:"#9a9a8e",letterSpacing:"0.06em",textTransform:"uppercase",textAlign:"right"}}>Low</span>
          <span style={{fontSize:"9.5px",fontWeight:700,color:"#9a9a8e",letterSpacing:"0.06em",textTransform:"uppercase",textAlign:"right"}}>Mid</span>
          <span style={{fontSize:"9.5px",fontWeight:700,color:"#9a9a8e",letterSpacing:"0.06em",textTransform:"uppercase",textAlign:"right"}}>High</span>
        </div>
      </div>
      {forecast.options.map(o => {
        const isOpen = openTip === o.label;
        const a = assumptions[o.label];
        return (
          <div key={o.label} style={{padding:"10px 0",borderBottom:"1px solid rgba(22,47,36,0.06)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:"7px",minWidth:0}}>
                <span style={{width:"8px",height:"8px",borderRadius:"50%",background:FORECAST_COLORS[o.label]||MUT,display:"inline-block",flexShrink:0}}/>
                <span style={{fontSize:"13px",color:TEXT,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{FORECAST_SHORT_LABEL[o.label]||o.label}</span>
                {a && (
                  <button onClick={() => setOpenTip(isOpen ? null : o.label)} style={{background:"#a8a89c",color:WHITE,border:"none",borderRadius:"50%",width:"15px",height:"15px",fontSize:"10px",fontWeight:700,lineHeight:"15px",textAlign:"center",padding:0,cursor:"pointer",flexShrink:0}}>?</button>
                )}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"48px 48px 48px",gap:"6px",flexShrink:0}}>
                <span style={{fontSize:"12px",color:MUT,textAlign:"right"}}>{fmtCompact(o.low)}</span>
                <span style={{fontFamily:SERIF,fontSize:"12.5px",color:TEXT,fontWeight:700,textAlign:"right"}}>{fmtCompact(o.central)}</span>
                <span style={{fontSize:"12px",color:MUT,textAlign:"right"}}>{fmtCompact(o.high)}</span>
              </div>
            </div>
            {o.note && (
              <div style={{fontSize:"11px",color:MUT,marginTop:"3px",lineHeight:1.4}}>{o.note}</div>
            )}
            {isOpen && a && (
              <div style={{marginTop:"8px",background:"#ede7db",borderRadius:"10px",padding:"10px 12px",display:"flex",flexDirection:"column",gap:"6px"}}>
                {a.lines.map((line,i) => (
                  <p key={i} style={{fontSize:"12px",color:"#4a4a4a",lineHeight:1.55,margin:0}}>{line}</p>
                ))}
                <div style={{display:"flex",gap:"14px",marginTop:"2px",fontSize:"11px",color:MUT}}>
                  <span>Low <b style={{color:TEXT}}>{a.rates.low}</b></span>
                  <span>Central <b style={{color:G}}>{a.rates.central}</b></span>
                  <span>High <b style={{color:TEXT}}>{a.rates.high}</b></span>
                </div>
              </div>
            )}
          </div>
        );
      })}
        </>
      ) : (
        <>
          <div style={{display:"flex",gap:"14px",marginTop:"18px"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>Today</div>
              <div style={{fontFamily:SERIF,fontSize:"22px",color:G,fontWeight:700,marginTop:"3px"}}>{fmt(netWorthRows[0].netWorth)}</div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{age ? `At age ${age+horizon}` : `In ${horizon} yrs`}</div>
              <div style={{fontFamily:SERIF,fontSize:"22px",color:G,fontWeight:700,marginTop:"3px"}}>{fmt(netWorthRows[horizon].netWorth)}</div>
            </div>
          </div>

          <div ref={chartWrapRef} style={{marginTop:"14px"}}>
            <svg width={nwChart.VW} height={nwChart.VH} viewBox={`0 0 ${nwChart.VW} ${nwChart.VH}`} style={{display:"block"}}>
              {nwChart.yTicks.map((v,i) => (
                <g key={i}>
                  <line x1={nwChart.PL} x2={nwChart.VW-nwChart.PR} y1={nwChart.sy(v)} y2={nwChart.sy(v)} stroke="rgba(22,47,36,0.08)" strokeWidth="1"/>
                  <text x={nwChart.PL-6} y={nwChart.sy(v)+3} fontSize="9" fontWeight="700" fill={MUT} textAnchor="end">{fmtCompact(v)}</text>
                </g>
              ))}
              <path d={nwChart.path} fill="none" stroke={G} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx={nwChart.lastX} cy={nwChart.lastY} r="3.5" fill={G}/>
              <line x1={nwChart.PL} x2={nwChart.VW-nwChart.PR} y1={nwChart.VH-nwChart.PB} y2={nwChart.VH-nwChart.PB} stroke="rgba(22,47,36,0.25)" strokeWidth="1.5"/>
              {nwChart.xTicks.map((yr,i) => (
                <text key={i} x={nwChart.sx(yr)} y={nwChart.VH-nwChart.PB+14} fontSize="9" fontWeight="700" fill={MUT}
                  textAnchor={i===0?"start":i===nwChart.xTicks.length-1?"end":"middle"}>
                  {i===0 ? "Now" : age ? age+yr : `Yr ${yr}`}
                </text>
              ))}
              <line x1={nwChart.PL} x2={nwChart.PL} y1={nwChart.PT} y2={nwChart.VH-nwChart.PB} stroke="rgba(22,47,36,0.25)" strokeWidth="1.5"/>
            </svg>
          </div>

          <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"12px",padding:"14px 16px",marginTop:"16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}}>
            <div>
              <div style={{fontSize:"13px",fontWeight:600,color:G}}>How do I compare to my peers?</div>
              <div style={{fontSize:"12px",color:MUT,marginTop:"2px"}}>See how your net worth stacks up by age and income.</div>
            </div>
            <span style={{fontSize:"9.5px",fontWeight:700,color:GOLD,background:"rgba(196,150,58,0.15)",padding:"4px 9px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase",flexShrink:0}}>Coming soon</span>
          </div>

          <div style={{height:"1px",background:"rgba(22,47,36,0.08)",margin:"20px 0"}}/>

          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
            <span style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Breakdown {age ? `at age ${age+horizon}` : `at ${horizon}yrs`}</span>
            <button onClick={() => setShowNwAssumptions(o => !o)} style={{background:"#a8a89c",color:WHITE,border:"none",borderRadius:"50%",width:"15px",height:"15px",fontSize:"10px",fontWeight:700,lineHeight:"15px",textAlign:"center",padding:0,cursor:"pointer"}}>?</button>
          </div>
          {showNwAssumptions && (
            <div style={{marginBottom:"12px",background:"#ede7db",borderRadius:"10px",padding:"10px 12px",display:"flex",flexDirection:"column",gap:"6px"}}>
              <p style={{fontSize:"12px",color:"#4a4a4a",lineHeight:1.55,margin:0}}>Cash grows at your own savings rate, and is assumed to never exceed your {fmt(m.emergencyBuffer)} emergency fund target.</p>
              <p style={{fontSize:"12px",color:"#4a4a4a",lineHeight:1.55,margin:0}}>Once that's topped up, all further monthly surplus is assumed fully invested into the market (growing at 7% p.a. nominal) rather than held as cash. Your pension grows at 6% p.a. — the same rates the rest of the app uses.</p>
              <p style={{fontSize:"12px",color:"#4a4a4a",lineHeight:1.55,margin:0}}>Student loan, personal loan and mortgage are paid down at their real rates and repayments. Property value is held flat — no house-price growth is assumed.</p>
            </div>
          )}
          {(() => {
            const r = netWorthRows[horizon];
            const rows = [
              { label:"Cash", value:r.cash, assumption:`Grown at your effective savings rate (${(m.effectiveSavingsRate||3.5).toFixed(1)}% p.a.). Assumes cash never exceeds your ${fmt(m.emergencyBuffer)} emergency fund target — once reached, further surplus is assumed invested instead (see Investments).` },
              { label:"Investments", value:r.investments, assumption:`Today's ISA + unwrapped balance grown at 7% p.a. nominal — an illustrative long-term equity return, not guaranteed. Once your cash buffer is topped up, all further monthly surplus is assumed fully invested into the market.` },
              { label:"Pension", value:r.pension, assumption:"Your pot plus ongoing contributions, grown at 6% p.a. — the same rate calcMetrics uses for your projected pot elsewhere in the app." },
              ...(r.propertyEquity > 0 ? [{ label:"Property equity", value:r.propertyEquity, assumption:"Property value held flat (no house-price growth assumed) — equity grows only as your mortgage is paid down at its real rate and repayment." }] : []),
              ...(r.debts > 0 ? [{ label:"Debts", value:r.debts, negative:true, assumption:"Remaining student loan and/or personal loan balance, projected forward at their real interest rates and repayments." }] : []),
            ];
            const maxVal = Math.max(...rows.map(row => Math.abs(row.value)), 1);
            return rows.map((row,i) => {
              const meta = NW_ROW_META[row.label] || {};
              const isOpen = openRow === row.label;
              return (
                <div key={row.label} onClick={() => setOpenRow(isOpen ? null : row.label)} style={{padding:"12px 0",borderBottom:"1px solid rgba(22,47,36,0.06)",cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                      <span style={{fontSize:"15px",color:TEXT}}>{row.label}</span>
                      {meta.locked && <Lock size={12} color={MUT}/>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                      <span style={{fontFamily:SERIF,fontSize:"20px",fontWeight:700,color:row.negative?"#c0392b":G}}>{row.negative?"−":""}{fmt(row.value)}</span>
                      <span style={{fontSize:"13px",color:"#6b6b6b",display:"inline-block",transform:isOpen?"rotate(90deg)":"none",transition:"transform 0.15s"}}>›</span>
                    </div>
                  </div>
                  <div style={{height:"8px",borderRadius:"4px",background:"#ede7db",overflow:"hidden",marginTop:"8px"}}>
                    <div style={{height:"100%",borderRadius:"4px",width:`${Math.max(2,(Math.abs(row.value)/maxVal)*100)}%`,background:meta.color||G}}/>
                  </div>
                  {isOpen && (
                    <div style={{marginTop:"10px",background:"#ede7db",borderRadius:"10px",padding:"10px 12px",display:"flex",flexDirection:"column",gap:"6px"}} onClick={e => e.stopPropagation()}>
                      {row.label === "Pension" && age && (
                        <div style={{display:"flex",alignItems:"baseline",gap:"6px"}}>
                          <span style={{fontFamily:SERIF,fontSize:"20px",fontWeight:700,color:G}}>{Math.max(0, PENSION_ACCESS_AGE - age)}</span>
                          <span style={{fontSize:"12.5px",color:"#4a4a4a"}}>years until available (from age {PENSION_ACCESS_AGE})</span>
                        </div>
                      )}
                      <p style={{fontSize:"13px",color:"#4a4a4a",lineHeight:1.55,margin:0}}>{row.assumption}</p>
                      <p style={{fontSize:"13px",color:"#4a4a4a",lineHeight:1.55,margin:0,fontWeight:600}}>{meta.liquidity}</p>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </>
      )}
    </div>
  );
}
