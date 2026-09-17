import { useState, useRef, useEffect } from "react";
import { WHITE, MUT, TEXT, G, SERIF, PillSlider, FORECAST_COLORS, FORECAST_SHORT_LABEL } from "../../CandidApp.jsx";
import { calcForecast, calcForecastSeries, buildForecastAssumptions } from "../../lib/forecast.js";
import { fmtCompact } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";

// Mobile Forecast screen — the mockup's "Surplus" comparison view (multi-
// strategy line chart + low/mid/high table), built on the same calcForecast/
// calcForecastSeries/buildForecastAssumptions desktop already uses (now
// shared via src/lib/forecast.js) so the numbers and assumption copy can
// never disagree between mobile and desktop. The mockup's separate "Net
// worth" toggle view isn't included — it projects a single net-worth growth
// line the app has no real calculation for (desktop's own Forecast screen
// doesn't have one either), so it isn't reproduced here rather than
// inventing figures with no source of truth.
const HORIZON_OPTIONS = [{value:5,label:"5yr"},{value:10,label:"10yr"},{value:20,label:"20yr"},{value:40,label:"40yr"}];

export default function MobileForecastScreen({ d, m }) {
  const [horizon, setHorizon] = useState(10);
  const [surplus, setSurplus] = useState(null);
  const [lumpSum, setLumpSum] = useState(null);
  const [openTip, setOpenTip] = useState(null);
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
  }, []);

  const forecast = calcForecast(d, m, surplus, horizon, lumpSum ?? 0);
  const series = calcForecastSeries(d, m, surplus, horizon, lumpSum ?? 0);
  const assumptions = buildForecastAssumptions(d, m);

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
    const xTicks = [...new Set([0, Math.round(horizon*0.25), Math.round(horizon*0.5), Math.round(horizon*0.75), horizon])];
    return { VW, VH, PL, PR, PT, PB, cW, cH, sx, sy, paths, yTicks, xTicks };
  })();

  return (
    <div>
      <label style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Time horizon</label>
      <div style={{marginTop:"8px"}}>
        <PillSlider value={horizon} onChange={setHorizon} options={HORIZON_OPTIONS}/>
      </div>

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
          {/* X-axis + year ticks */}
          <line x1={chart.PL} x2={chart.VW-chart.PR} y1={chart.VH-chart.PB} y2={chart.VH-chart.PB} stroke="rgba(22,47,36,0.25)" strokeWidth="1.5"/>
          {chart.xTicks.map((yr,i) => (
            <text key={i} x={chart.sx(yr)} y={chart.VH-chart.PB+14} fontSize="9" fontWeight="700" fill={MUT} textAnchor="middle">Yr {yr}</text>
          ))}
          <line x1={chart.PL} x2={chart.PL} y1={chart.PT} y2={chart.VH-chart.PB} stroke="rgba(22,47,36,0.25)" strokeWidth="1.5"/>
        </svg>
      </div>

      <div style={{height:"1px",background:"rgba(22,47,36,0.08)",margin:"20px 0"}}/>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px"}}>
        <span style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Estimate at {horizon}yrs</span>
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
    </div>
  );
}
