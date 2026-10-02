import { useState, useRef, useEffect } from "react";
import { ArrowUp, CircleAlert } from "lucide-react";
import { G, GOLD, MUT, TEXT, SERIF, WHITE, SC, PillSlider } from "../../CandidApp.jsx";
import { rentVsBuyInputs, calcRentVsBuy, ISA_ALLOWANCE, SELLING_COSTS_PCT } from "../../lib/rentVsBuy.js";
import { STRESS_REMORTGAGE_UPLIFT } from "../../lib/mortgage.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import InfoButton from "../InfoButton.jsx";
import PillCell from "./PillCell.jsx";

// Property step 3: rent vs buy over the years before the buyer would sell
// (logic in src/lib/rentVsBuy.js). Moderate scenario only for now.

const TENURE_OPTIONS = [{ value:"freehold", label:"Freehold" }, { value:"leasehold", label:"Leasehold" }];
const MONEY_OPTIONS = [{ value:"cash", label:"Cash" }, { value:"invested", label:"Invested" }];
const pct = n => `${n < 0 ? "−" : ""}${Math.round(Math.abs(n) * 10) / 10}%`;
const twoDp = n => Math.round(n * 100) / 100;
const years = n => `${n} ${n === 1 ? "year" : "years"}`;

// One cell per year: buy or rent, whichever leaves more if you sold or
// cashed in at the end of that year. Tap a year to see how it adds up.
// Labelled while the cells are wide enough; past 8 years, colour only, with
// a key. The colour is each year's one state indicator; the outline marks
// the year shown in the breakdown below.
function Timeline({ rows, selectedYear, onSelect }) {
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
function NetCostChart({ rows, buyingAtStart, selectedYear }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || 320);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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
const RATE_OPTIONS = [
  { scenario:"stress", label:"Rates up" },
  { scenario:"moderate", label:"No change" },
  { scenario:"lower", label:"Rates down" },
];
function RateChoice({ outcomes, ratePct, chosen, onChoose }) {
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
            background:active ? G : "#ede7db", color:active ? WHITE : TEXT, textAlign:"center",
          }}>
            <div style={{fontSize:"10.5px",fontWeight:600,color:active ? "rgba(255,255,255,0.8)" : MUT}}>{o.label}</div>
            <div style={{fontSize:"14px",fontWeight:700,margin:"1px 0"}}>{Math.round(rateFor(o.scenario) * 100) / 100}%</div>
            <div style={{fontSize:"11px",fontWeight:600}}>{buyAhead ? "Buy" : "Rent"} +{fmtCompact(Math.abs(result.gapAtHorizon))}</div>
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
function Comparison({ heading, rows }) {
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
function NegativeEquity({ result, shown, fixedYears, onShowRatesUp, ratesUpShown }) {
  const ne = result.negativeEquityYears;
  if (!ne.length && !(shown.saleShortfall > 0)) return null;
  const first = ne[0], last = ne[ne.length - 1];
  const which = !ne.length ? null
    : first === last ? `year ${first}`
    : last - first === 1 ? `years ${first} and ${last}`
    : `years ${first} to ${last}`;
  const body = { fontSize:"12.5px", color:TEXT, lineHeight:1.5, margin:"4px 0 0" };
  return (
    <div style={{borderLeft:`3px solid ${SC.critical}`,padding:"2px 0 2px 10px",margin:"0 0 14px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"13px",fontWeight:700,color:SC.critical}}>
        <CircleAlert size={15} style={{flexShrink:0}}/>
        {which ? `Negative equity in ${which}` : "Selling wouldn't clear the mortgage"}
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
function whyText(row) {
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

export default function RentVsBuyStep({ d, m, set, regionalRows, marketRates }) {
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null); // null: the last year
  const [earningsInfoOpen, setEarningsInfoOpen] = useState(false);
  const [rateScenario, setRateScenario] = useState("moderate");
  const [rateInfoOpen, setRateInfoOpen] = useState(false);
  const [framingOpen, setFramingOpen] = useState(false);
  const [costsInfoOpen, setCostsInfoOpen] = useState(false);
  const [ownInfoOpen, setOwnInfoOpen] = useState(false);
  const fieldLabel = { fontSize:"11px", fontWeight:600, color:MUT, letterSpacing:"0.07em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:"6px" };
  const explainer = { fontSize:"11.5px", color:MUT, lineHeight:1.5, background:"#ede7db", borderRadius:"8px", padding:"8px 10px", margin:0 };
  const figureLabel = { fontSize:"10px", fontWeight:600, color:MUT, letterSpacing:"0.06em", textTransform:"uppercase" };

  const input = rentVsBuyInputs(d, m, regionalRows, "moderate", marketRates);
  // The first remortgage, if the fix ends before the sale: the year the new
  // deal starts.
  const remortgageYear = input.mortgage.loan > 0 && input.mortgage.fixedYears < input.horizonYears ? input.mortgage.fixedYears + 1 : null;
  const outcomes = input.monthlyRent > 0 && remortgageYear
    ? Object.fromEntries(RATE_OPTIONS.map(o => [o.scenario, calcRentVsBuy({ ...input, mortgageScenario: o.scenario })]))
    : null;
  const result = input.monthlyRent > 0 ? (outcomes ? outcomes[rateScenario] : calcRentVsBuy(input)) : null;
  const leasehold = input.tenure === "leasehold";
  const cash = input.returnType === "cash";
  const together = input.people.length > 1;
  const last = result?.years.at(-1);
  const shown = result ? (result.years.find(y => y.year === selectedYear) || last) : null;
  const buyingAhead = result ? result.gapAtHorizon > 0 : false;
  const isaRoomNow = input.alreadyInIsa + input.people.reduce((s, p) => s + p.isaHeadroom, 0);
  const buyingCostLines = shown ? [
    { label:"Mortgage interest", value:shown.buying.mortgageInterest },
    { label:"Maintenance", value:shown.buying.maintenance },
    ...(leasehold ? [{ label:"Ground rent", value:shown.buying.groundRent }, { label:"Service charge", value:shown.buying.serviceCharge }] : []),
    ...(shown.buying.stampDutyAndFees > 0 ? [{ label:"Stamp duty and fees", value:shown.buying.stampDutyAndFees }] : []),
    ...(shown.buying.remortgageFees > 0 ? [{ label:"Remortgage fees", value:shown.buying.remortgageFees }] : []),
    { label:"Selling costs", value:shown.buying.sellingCosts },
  ] : [];

  return (
    <div>
      <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Rent vs buy</div>

      {/* Own rows: "Years before you'd sell" is too long a caption to share a
          row on a small phone without being cut off. */}
      <div style={{display:"flex",gap:"10px"}}>
        <PillCell><PillMoneyInput label="Monthly rent" value={+d.propertyMonthlyRent || null} onChange={v => set("propertyMonthlyRent", v ?? "")}/></PillCell>
      </div>
      <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
        <PillCell><PillMoneyInput label="Years before you'd sell" unit="" value={input.horizonYears} onChange={v => set("propertyHorizonYears", v ?? "")}/></PillCell>
      </div>
      <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
        <PillCell><div style={{flex:1,minWidth:0}}><PillSlider value={input.tenure} onChange={v => set("propertyTenure", v)} options={TENURE_OPTIONS}/></div></PillCell>
      </div>
      {leasehold && (
        <>
          <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
            <PillCell><PillMoneyInput label="Ground rent a year" value={+d.propertyGroundRent || null} onChange={v => set("propertyGroundRent", v ?? "")}/></PillCell>
            <PillCell><PillMoneyInput label="Service charge a year" value={+d.propertyServiceCharge || null} onChange={v => set("propertyServiceCharge", v ?? "")}/></PillCell>
          </div>
          <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
            <PillCell><PillMoneyInput label="Ground rent rise a year" unit="%" value={+d.propertyGroundRentGrowth || null} onChange={v => set("propertyGroundRentGrowth", v ?? "")}/></PillCell>
            <div style={{flex:1}}/>
          </div>
        </>
      )}

      <div style={{...fieldLabel,marginTop:"18px"}}>
        Assumptions
        <InfoButton open={assumptionsOpen} onClick={() => setAssumptionsOpen(o => !o)}/>
      </div>
      <p style={{fontSize:"12.5px",color:TEXT,margin:"6px 0 0"}}>
        House prices {pct(input.housePriceGrowthPct)} a year · rents {pct(input.rentGrowthPct)} · {cash ? `cash ${pct(input.investmentReturnPct)}` : `invested ${pct(input.investmentReturnPct)}`}
      </p>
      {assumptionsOpen && (
        <div style={{marginTop:"10px"}}>
          <div style={{display:"flex",gap:"10px"}}>
            <PillCell><PillMoneyInput label="House price growth" unit="%" allowNegative value={input.housePriceGrowthPct || null} onChange={v => set("propertyHousePriceGrowth", v ?? "")}/></PillCell>
            <PillCell><PillMoneyInput label="Rent growth" unit="%" allowNegative value={input.rentGrowthPct || null} onChange={v => set("propertyRentGrowth", v ?? "")}/></PillCell>
          </div>
          <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
            <PillCell><div style={{flex:1,minWidth:0}}><PillSlider value={input.returnType} onChange={v => set("propertyRenterMoney", v)} options={MONEY_OPTIONS}/></div></PillCell>
            <PillCell>
              {cash
                ? <PillMoneyInput label="Cash rate" unit="%" value={twoDp(input.investmentReturnPct) || null} onChange={v => set("propertyCashReturn", v ?? "")}/>
                : <PillMoneyInput label="Investment return" unit="%" value={twoDp(input.investmentReturnPct) || null} onChange={v => set("propertyInvestmentReturn", v ?? "")}/>}
            </PillCell>
          </div>
          {cash && (d.propertyCashReturn === "" || d.propertyCashReturn == null) && (
            <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>
              {input.bestCashRatePct != null && input.bestCashRatePct > input.ownCashRatePct
                ? `The best savings rate Candid tracks. Your own accounts average ${pct(input.ownCashRatePct)}.`
                : "The average rate on your own cash savings, Premium Bonds and Cash ISAs."}
            </p>
          )}
          {!cash && (
            <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
              <PillCell><PillMoneyInput label="Of which dividends" unit="%" value={twoDp(input.dividendYieldPct) || null} onChange={v => set("propertyDividendYield", v ?? "")}/></PillCell>
              <div style={{flex:1}}/>
            </div>
          )}
        </div>
      )}

      <div style={{marginTop:"18px",background:WHITE,borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",padding:"18px"}}>
        {!result ? (
          <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:0}}>Add your current monthly rent to compare renting with buying.</p>
        ) : (
          <>
            {outcomes && (
              <div style={{marginBottom:"16px"}}>
                <div style={{...figureLabel,display:"flex",alignItems:"center",gap:"6px",marginBottom:"8px"}}>
                  Mortgage rate from year {remortgageYear}
                  <InfoButton open={rateInfoOpen} onClick={() => setRateInfoOpen(o => !o)}/>
                </div>
                {rateInfoOpen && (
                  <p style={{...explainer,marginBottom:"8px"}}>
                    Your {input.mortgage.fixedYears}-year fix ends before you'd sell, so you'd remortgage at whatever rates are then. Each option shows the result if they're {STRESS_REMORTGAGE_UPLIFT} points higher, the same or {STRESS_REMORTGAGE_UPLIFT} points lower. Higher payments mean the renter puts aside more each month; lower payments, less.
                  </p>
                )}
                <RateChoice outcomes={outcomes} ratePct={input.mortgage.ratePct} chosen={rateScenario} onChoose={setRateScenario}/>
              </div>
            )}
            <div style={figureLabel}>Better off after {years(result.horizonYears)}</div>
            <div style={{fontFamily:SERIF,fontSize:"30px",fontWeight:700,color:TEXT,lineHeight:1.2}}>{buyingAhead ? "Buying" : "Renting"}</div>
            <p style={{display:"flex",alignItems:"center",gap:"4px",fontSize:"13px",color:TEXT,margin:"2px 0 0"}}>
              <ArrowUp size={14} color={SC.ok} strokeWidth={2.6}/>
              ~{fmtCompact(Math.abs(result.gapAtHorizon))} vs {buyingAhead ? "renting" : "buying"}
            </p>

            <NetCostChart rows={result.years} selectedYear={shown.year}
              buyingAtStart={result.years[0].buying.stampDutyAndFees + input.price * SELLING_COSTS_PCT / 100}/>
            <Timeline rows={result.years} selectedYear={shown.year} onSelect={y => setSelectedYear(y)}/>

            <hr style={{border:"none",borderTop:"1px solid rgba(22,47,36,0.1)",margin:"16px 0 12px"}}/>
            <div style={{...figureLabel,display:"flex",alignItems:"center",gap:"6px"}}>
              If you sold after {years(shown.year)}
              <InfoButton open={framingOpen} onClick={() => setFramingOpen(o => !o)}/>
            </div>
            {framingOpen && (
              <p style={{...explainer,marginTop:"6px"}}>
                Renting or buying, a home costs money to live in. Buying costs interest, upkeep and the costs of buying and selling, while the whole home {input.housePriceGrowthPct < 0 ? "falls" : "rises"} in value. Renting costs rent, while your money grows elsewhere. Every figure is a total since the day you'd buy.
              </p>
            )}
            <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"6px 0 12px"}}>{whyText(shown)}</p>
            <NegativeEquity result={result} shown={shown} fixedYears={input.mortgage.fixedYears}
              onShowRatesUp={outcomes ? () => setRateScenario("stress") : null} ratesUpShown={rateScenario === "stress"}/>

            <Comparison
              heading={shown.year === 1 ? "Year 1" : `Years 1 to ${shown.year}`}
              rows={[
                { label:"Costs", kind:"cost", buying:shown.buying.notRecovered, renting:shown.renting.notRecovered,
                  info:{
                    button: <InfoButton open={costsInfoOpen} onClick={() => setCostsInfoOpen(o => !o)}/>,
                    panel: costsInfoOpen && (
                      <div style={explainer}>
                        <div style={{fontWeight:600,marginBottom:"2px"}}>Ownership cost</div>
                        {buyingCostLines.map(l => (
                          <div key={l.label} style={{display:"flex",justifyContent:"space-between",gap:"10px"}}><span>{l.label}</span><span>{fmt(l.value)}</span></div>
                        ))}
                        <div style={{fontWeight:600,margin:"6px 0 2px"}}>Rental cost</div>
                        <div style={{display:"flex",justifyContent:"space-between",gap:"10px"}}><span>Rent</span><span>{fmt(shown.renting.notRecovered)}</span></div>
                      </div>
                    ),
                  } },
                { label:"Growth", kind:"gain", buying:shown.buying.priceRise, renting:shown.renting.earnings - shown.renting.tax,
                  info:{
                    button: <InfoButton open={earningsInfoOpen} onClick={() => setEarningsInfoOpen(o => !o)}/>,
                    panel: earningsInfoOpen && (
                      <div style={explainer}>
                        <p style={{margin:0}}>
                          Buying: the {shown.buying.priceRise >= 0 ? "rise" : "fall"} in the whole home's value, at {pct(Math.abs(input.housePriceGrowthPct))} a year.
                        </p>
                        <p style={{margin:"6px 0 0"}}>
                          Renting: the growth in wealth from money not going into the property, {cash ? "interest" : "investment returns"} of {fmt(shown.renting.earnings)}, less {fmt(shown.renting.tax)} in tax. That's on the {fmt(input.upfront)} kept {cash ? "in cash" : "invested"} instead of spent on the deposit, stamp duty and fees, plus what's put aside each month instead of the buyer's higher costs.
                        </p>
                        <p style={{margin:"6px 0 0"}}>
                          About {fmt(Math.min(input.upfront, isaRoomNow))} of the starting money sits in ISAs, tax-free. After this year, Candid assumes {together ? "each of you adds" : "you add"} to ISAs only what {together ? "you each" : "you"} could save from income, up to {fmt(ISA_ALLOWANCE)} a year: about {fmt(input.people[0].isaCapacity)} for you{together ? ` and ${fmt(input.people[1].isaCapacity)} for your partner` : ""}.
                        </p>
                        {together && input.partnerEstimate && (
                          <p style={{margin:"6px 0 0"}}>
                            Your partner's take-home pay is roughly {fmt(input.partnerEstimate.takeHome)} a year. Scaling your monthly costs to their salary puts theirs at about {fmt(input.partnerEstimate.costs)}, leaving around {fmt(input.partnerEstimate.surplus)} a year to save.
                          </p>
                        )}
                      </div>
                    ),
                  } },
                { label:"Cost of living there", kind:"net", buying:shown.buying.netCost, renting:shown.renting.netCost },
                { label:"A month", kind:"month", buying:shown.buying.netCost / (shown.year * 12), renting:shown.renting.netCost / (shown.year * 12) },
                { label:"Your own money", kind:"own", buying:shown.buying.ownMoneyIn, renting:Math.max(0, shown.renting.ownMoneyIn),
                  info:{
                    button: <InfoButton open={ownInfoOpen} onClick={() => setOwnInfoOpen(o => !o)}/>,
                    panel: ownInfoOpen && (
                      <div style={explainer}>
                        <p style={{margin:0}}>Still yours either way, so not a cost.</p>
                        <p style={{margin:"6px 0 0"}}>
                          {shown.buying.priceRise >= 0
                            ? "Buying: your deposit and the loan paid off, which you get back when you sell."
                            : "Buying: your deposit and the loan paid off. The fall in the home's value comes out of this when you sell, which is why it's counted under Growth."}
                        </p>
                        <p style={{margin:"6px 0 0"}}>
                          {shown.renting.ownMoneyIn > 0
                            ? `Renting: the ${fmt(input.upfront)} you didn't spend on buying, ${shown.renting.ownMoneyIn >= input.upfront ? "plus" : "less"} ${fmt(Math.abs(shown.renting.ownMoneyIn - input.upfront))} ${shown.renting.ownMoneyIn >= input.upfront ? "put aside" : "taken out to cover the higher rent"}.`
                            : "Renting: paying the higher rent would have used up all of the renter's savings."}
                        </p>
                      </div>
                    ),
                  } },
              ]}/>
          </>
        )}
      </div>
    </div>
  );
}
