import { useState, useEffect } from "react";
import { useElementWidth } from "../useElementWidth.js";
import { CircleAlert } from "lucide-react";
import { G, GOLD, MUT, TEXT, SERIF, WHITE, SC, CDARK } from "../../design-tokens.js";
import { STRESS_REMORTGAGE_UPLIFT } from "../../lib/mortgage.js";
import { fmt, fmtCompact } from "../../lib/format.js";

// Parts of the rent vs buy step (RentVsBuyStep): the year-by-year timeline,
// the cost chart, the rate choice, the side-by-side comparison and the
// negative equity note, with the number formats they share.

export const pct = n => `${n < 0 ? "−" : ""}${Math.round(Math.abs(n) * 10) / 10}%`;
export const twoDp = n => Math.round(n * 100) / 100;
export const years = n => `${n} ${n === 1 ? "year" : "years"}`;

// One cell per year: buy or rent, whichever leaves more if you sold or
// cashed in at the end of that year. Tap a year to see how it adds up.
// Labelled while the cells are wide enough; past 8 years, colour only, with
// a key. The colour is each year's one state indicator; the outline marks
// the year shown in the breakdown below.
export function Timeline({ rows, selectedYear, onSelect }) {
  const labelled = rows.length <= 8;
  const colour = side => side === "buy" ? G : GOLD;
  const key = (
    <span style={{display:"flex",gap:"10px"}}>
      <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:"9px",height:"9px",borderRadius:"2px",background:G}}/>Buy</span>
      <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:"9px",height:"9px",borderRadius:"2px",background:GOLD}}/>Rent</span>
    </span>
  );
  return (
    <div style={{marginTop:"6px"}}>
      <div style={{display:"flex",gap:"3px"}}>
        {rows.map(r => {
          const side = r.buyerWealth > r.renterWealth ? "buy" : "rent";
          const selected = r.year === selectedYear;
          return (
            <button key={r.year} type="button" onClick={() => onSelect(r.year)} aria-pressed={selected}
              aria-label={`Year ${r.year}: ${side === "buy" ? "buying" : "renting"} ahead`}
              style={{flex:1,minWidth:0,padding:0,background:"none",border:"none",fontFamily:"inherit",cursor:"pointer",textAlign:"center"}}>
              {labelled && <div style={{fontSize:"10px",fontWeight:selected ? 800 : 600,color:selected ? TEXT : MUT,marginBottom:"3px"}}>Y{r.year}</div>}
              <div style={{height:labelled ? "26px" : "20px",borderRadius:"6px",background:colour(side),color:WHITE,fontSize:"11px",fontWeight:700,
                display:"flex",alignItems:"center",justifyContent:"center",outline:selected ? `2px solid ${TEXT}` : "none",outlineOffset:"1px"}}>
                {labelled ? (side === "buy" ? "Buy" : "Rent") : ""}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"8px",marginTop:"6px",fontSize:"10.5px",color:MUT}}>
        {labelled ? <span>Tap a year to see how it adds up</span> : <><span>Year 1</span>{key}<span>Year {rows.length}</span></>}
      </div>
      {!labelled && <div style={{fontSize:"10.5px",color:MUT,marginTop:"2px"}}>Tap a year to see how it adds up</div>}
    </div>
  );
}

// Each option's net cost so far (money not got back, less what it earned),
// year by year from the day of purchase: lower is better, and the point
// where the lines cross is when the answer changes. Year y sits over the
// centre of its timeline cell below, so the two line up; "now" is the left
// edge, where buying starts with its one-off costs and renting at nothing.
// Measured in real pixels so the viewBox matches the rendered width 1:1
// (same approach as MobileForecastScreen).
export function NetCostChart({ rows, buyingAtStart, selectedYear }) {
  const [wrapRef, width] = useElementWidth(320);
  const n = rows.length, H = 120, PT = 8, PB = 6;
  const buying = [buyingAtStart, ...rows.map(r => r.buying.netCost)];
  const renting = [0, ...rows.map(r => r.renting.netCost)];
  const all = [...buying, ...renting];
  const top = Math.max(1, ...all), bottom = Math.min(0, ...all);
  const pad = (top - bottom) * 0.06;
  const hi = top + pad, lo = bottom < 0 ? bottom - pad : 0;
  const x = i => i === 0 ? 4 : ((i - 0.5) / n) * width;
  const y = v => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
  const path = vals => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const sx = x(selectedYear);
  const swatch = colour => <span style={{width:"12px",height:"3px",borderRadius:"2px",background:colour,display:"inline-block"}}/>;
  return (
    <div ref={wrapRef} style={{marginTop:"14px"}}>
      <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:"4px 12px",fontSize:"11px",color:MUT,marginBottom:"6px"}}>
        <span style={{display:"flex",alignItems:"center",gap:"5px"}}>{swatch(G)}Buying</span>
        <span style={{display:"flex",alignItems:"center",gap:"5px"}}>{swatch(GOLD)}Renting</span>
        <span>Cost of living there so far · lower is better</span>
      </div>
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} style={{display:"block",overflow:"visible"}}>
        {lo < 0 && <line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke="rgba(22,47,36,0.15)" strokeWidth="1"/>}
        <line x1={sx} x2={sx} y1={PT} y2={H - PB} stroke="rgba(22,47,36,0.3)" strokeWidth="1" strokeDasharray="3 3"/>
        <path d={path(renting)} fill="none" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d={path(buying)} fill="none" stroke={G} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={sx} cy={y(renting[selectedYear])} r="4" fill={GOLD}/>
        <circle cx={sx} cy={y(buying[selectedYear])} r="4" fill={G}/>
      </svg>
    </div>
  );
}

// What the answer would be if mortgage rates have moved by the time the
// fix ends, 1.5 points either way or not at all. Each option shows its own
// outcome; the one chosen drives everything else in the tile. Only shown
// when the fix ends before the sale; otherwise rates can't change the
// answer.
export const RATE_OPTIONS = [
  { scenario:"stress", label:"Rates up" },
  { scenario:"moderate", label:"No change" },
  { scenario:"lower", label:"Rates down" },
];
// Whether the screen is wider than a phone. The rate tiles' "Buy +£46k" line
// fits beside the rate on a wider screen, but crowds three tiles on a phone,
// where tapping a tile shows its result anyway.
const WIDE_PX = 600;
function useWideScreen() {
  const query = `(min-width: ${WIDE_PX}px)`;
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setWide(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return wide;
}

export function RateChoice({ outcomes, ratePct, chosen, onChoose }) {
  const wide = useWideScreen();
  const rateFor = scenario => scenario === "stress" ? ratePct + STRESS_REMORTGAGE_UPLIFT
    : scenario === "lower" ? Math.max(0, ratePct - STRESS_REMORTGAGE_UPLIFT) : ratePct;
  return (
    <div style={{display:"flex",gap:"6px"}}>
      {RATE_OPTIONS.map(o => {
        const result = outcomes[o.scenario];
        const buyAhead = result.gapAtHorizon > 0;
        const active = o.scenario === chosen;
        return (
          <button key={o.scenario} type="button" onClick={() => onChoose(o.scenario)} aria-pressed={active} style={{
            flex:1, minWidth:0, border:"none", borderRadius:"12px", padding:"8px 4px", fontFamily:"inherit", cursor:"pointer",
            background:active ? G : CDARK, color:active ? WHITE : TEXT, textAlign:"center",
          }}>
            <div style={{fontSize:"10.5px",fontWeight:600,color:active ? "rgba(255,255,255,0.8)" : MUT}}>{o.label}</div>
            <div style={{fontSize:"14px",fontWeight:700,margin:"1px 0"}}>{Math.round(rateFor(o.scenario) * 100) / 100}%</div>
            {wide && <div style={{fontSize:"11px",fontWeight:600}}>{buyAhead ? "Buy" : "Rent"} +{fmtCompact(Math.abs(result.gapAtHorizon))}</div>}
          </button>
        );
      })}
    </div>
  );
}

// Buying and renting side by side, as running totals since the purchase:
// what each costs (red), what each gains (green, or red for a fall in the
// home's value), the net of the two (the cost of living there) and its
// monthly average, then the person's own money that's still theirs either
// way (equity, or savings), which isn't a cost. A net gain shows in green.
// Each `rows` entry is { label, buying, renting, kind, info } where kind
// is "cost", "gain", "net", "month" or "own", and info an optional
// { button, panel } pair; the panel spans the table under its row.
export function Comparison({ heading, rows }) {
  const cell = { fontSize:"13px", color:TEXT, textAlign:"right", whiteSpace:"nowrap", padding:"4px 0" };
  const value = (v, kind) => {
    if (kind === "cost") return <span style={{color:SC.critical}}>−{fmt(v)}</span>;
    if (kind === "gain") return <span style={{color:v < 0 ? SC.critical : SC.ok,fontWeight:600}}>{v < 0 ? "−" : "+"}{fmt(Math.abs(v))}</span>;
    if (v < 0 && (kind === "net" || kind === "month")) return <span style={{color:SC.ok}}>{fmt(-v)} gain</span>;
    return fmt(v);
  };
  const style = kind => kind === "net" ? { ...cell, fontFamily:SERIF, fontSize:"17px", fontWeight:700, paddingTop:"6px" }
    : kind === "month" || kind === "own" ? { ...cell, color:MUT, fontSize:"12px" } : cell;
  const head = { fontSize:"10px", fontWeight:700, color:MUT, letterSpacing:"0.08em", textTransform:"uppercase", textAlign:"right" };
  return (
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto auto",columnGap:"16px",alignItems:"baseline"}}>
      <div style={{fontSize:"11px",color:MUT}}>{heading}</div>
      <div style={head}>Buying</div>
      <div style={head}>Renting</div>
      {rows.map(r => (
        <div key={r.label} style={{display:"contents"}}>
          <div style={{...style(r.kind),textAlign:"left",whiteSpace:"normal",fontFamily:"inherit",fontSize:r.kind === "net" ? "13px" : style(r.kind).fontSize,display:"flex",alignItems:"center",gap:"6px"}}>
            {r.label}{r.info?.button}
          </div>
          <div style={style(r.kind)}>{value(r.buying, r.kind)}</div>
          <div style={style(r.kind)}>{value(r.renting, r.kind)}</div>
          {r.info?.panel && <div style={{gridColumn:"1 / -1",margin:"2px 0 6px"}}>{r.info.panel}</div>}
        </div>
      ))}
    </div>
  );
}

// Shown when prices fall far enough that selling wouldn't clear the
// mortgage: in negative equity (the home worth less than the loan) or with
// too little equity left to cover selling costs. Names every year in
// negative equity, so it shows even when the year selected isn't one of
// them, then what selling in the selected year would leave to pay. A red
// rule and icon, not a card: it's information, not a control.
//
// A fix ending in negative equity doesn't raise the remortgage rate by
// itself: staying with the same lender on a new deal is usually possible,
// and how much more it costs varies too much to pick one figure. Instead the
// note links to the Rates up option (onShowRatesUp, null when there's no
// rate choice), which the user can see applied above.
export function NegativeEquity({ result, shown, fixedYears, onShowRatesUp, ratesUpShown }) {
  const ne = result.negativeEquityYears;
  if (!ne.length && !(shown.saleShortfall > 0)) return null;
  const body = { fontSize:"12.5px", color:TEXT, lineHeight:1.5, margin:"4px 0 0" };
  return (
    <div style={{borderLeft:`3px solid ${SC.critical}`,padding:"2px 0 2px 10px",margin:"0 0 14px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"13px",fontWeight:700,color:SC.critical}}>
        <CircleAlert size={15} style={{flexShrink:0}}/>
        {ne.length ? negativeEquityText(ne) : "Selling wouldn't clear the mortgage"}
      </div>
      {shown.equity < 0 ? (
        <p style={body}>
          After {years(shown.year)} the home would be worth {fmt(shown.propertyValue)}, {fmt(-shown.equity)} less than the {fmt(shown.mortgageBalance)} left on the mortgage. Selling then would mean paying {fmt(shown.saleShortfall)} from savings to clear the mortgage and selling costs.
        </p>
      ) : shown.saleShortfall > 0 ? (
        <p style={body}>
          After {years(shown.year)} the home would be worth {fmt(shown.propertyValue)}, only {fmt(shown.equity)} more than the mortgage. Selling costs would take that and more, leaving {fmt(shown.saleShortfall)} to pay from savings.
        </p>
      ) : (
        <p style={body}>Tap {ne.length === 1 ? "that year" : "one of those years"} on the timeline to see what selling then would cost.</p>
      )}
      {ne.includes(fixedYears) && fixedYears < result.horizonYears && (
        <p style={body}>
          Your fix ends in year {fixedYears}, while the home is worth less than the loan. Staying with your lender on a new deal is usually possible, but rates for loans above the home's value tend to be higher.
          {onShowRatesUp && (ratesUpShown
            ? " The figures above assume rates up."
            : <> <button type="button" onClick={onShowRatesUp} style={{background:"none",border:"none",padding:0,color:G,fontSize:"inherit",fontWeight:700,fontFamily:"inherit",cursor:"pointer",textDecoration:"underline"}}>See it with rates up</button></>)}
        </p>
      )}
    </div>
  );
}

// Why the side ahead in a given year is ahead, in one line (the heading
// above it already says which year).
export function whyText(row) {
  const b = row.buying, r = row.renting;
  const buyAhead = row.buyerWealth > row.renterWealth;
  const gap = `~${fmtCompact(Math.abs(r.netCost - b.netCost))}`;
  const oneOffs = b.stampDutyAndFees + b.sellingCosts;
  if (!buyAhead && b.netCost - oneOffs < r.netCost) {
    return `Renting leaves you ${gap} better off. Buying's one-off costs (${fmt(oneOffs)} in stamp duty, fees and selling costs) haven't been made back yet.`;
  }
  return buyAhead
    ? `Buying leaves you ${gap} better off.`
    : `Renting leaves you ${gap} better off.`;
}

// "Years 3 to 5" style, for the one-line negative equity warning.
export function negativeEquityText(ne) {
  const first = ne[0], last = ne[ne.length - 1];
  return first === last ? `Negative equity in year ${first}`
    : last - first === 1 ? `Negative equity in years ${first} and ${last}`
    : `Negative equity in years ${first} to ${last}`;
}
