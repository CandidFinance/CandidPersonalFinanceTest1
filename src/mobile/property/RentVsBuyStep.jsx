import { useState, useRef } from "react";
import { ArrowUp, CircleAlert } from "lucide-react";
import { MUT, TEXT, SERIF, WHITE, SC, WARNING, CDARK } from "../../design-tokens.js";
import { PillSlider } from "../PillSlider.jsx";
import { rentVsBuyInputs, calcRentVsBuy, breakevenGrowthPct, ISA_ALLOWANCE } from "../../lib/rentVsBuy.js";
import { breakevenLine } from "../../lib/propertyReveal.js";
import { monthlyBudget } from "../../lib/monthlyBudget.js";
import { STRESS_REMORTGAGE_UPLIFT } from "../../lib/mortgage.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import InfoButton from "../InfoButton.jsx";
import PillCell from "./PillCell.jsx";
import { motion } from "framer-motion";
import ExpandChevron, { CARD_PADDING_WITH_CHEVRON } from "./ExpandChevron.jsx";
import EmptyResultCard from "./EmptyResultCard.jsx";
import StickySummaryBar, { SummaryLabel, SummaryFigure } from "./StickySummaryBar.jsx";
import AssumptionsHeading from "./AssumptionsHeading.jsx";
import { ExplainLink } from "../ModuleScreenParts.jsx";
import useWhyInfo from "./useWhyInfo.jsx";
import { pct, twoDp, years, Timeline, NetCostChart, RATE_OPTIONS, RateChoice, Comparison, NegativeEquity, whyText, negativeEquityText } from "./RentVsBuyParts.jsx";

// Property step 3: rent vs buy over the years before the buyer would sell
// (logic in src/lib/rentVsBuy.js). Moderate scenario only for now.

const TENURE_OPTIONS = [{ value:"freehold", label:"Freehold" }, { value:"leasehold", label:"Leasehold" }];
const MONEY_OPTIONS = [{ value:"cash", label:"Cash" }, { value:"invested", label:"Invested" }];

// Laid out like steps 1 and 2: the result first (the answer and the rate
// options, with the chart, timeline and breakdown behind a chevron so the
// result and the inputs fit on one screen), then the inputs that drive it,
// with a sticky bar keeping the answer in view while they're edited. While
// its guided walk-through runs, `guide` takes the inputs' place, and
// `holdResult` blurs the card until every answer is in; `onWalkThrough`
// reruns it.
export default function RentVsBuyStep({ d, m, set, regionalRows, marketRates, guide, holdResult = false, onWalkThrough, onExplain }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const resultRef = useRef(null);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null); // null: the last year
  const [earningsInfoOpen, setEarningsInfoOpen] = useState(false);
  const [rateScenario, setRateScenario] = useState("moderate");
  const [rateInfoOpen, setRateInfoOpen] = useState(false);
  const [framingOpen, setFramingOpen] = useState(false);
  const [costsInfoOpen, setCostsInfoOpen] = useState(false);
  const [ownInfoOpen, setOwnInfoOpen] = useState(false);
  const why = useWhyInfo({ d, m, regionalRows });
  const fieldLabel = { fontSize:"11px", fontWeight:600, color:MUT, letterSpacing:"0.07em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:"6px" };

  const input = rentVsBuyInputs(d, m, regionalRows, "moderate", marketRates);
  // Any rent figure, £0 included (living with family, say): the result
  // waits for an answer, not for a rent above zero.
  const rentGiven = d.propertyMonthlyRent !== "" && d.propertyMonthlyRent != null && !isNaN(+d.propertyMonthlyRent);
  // The first remortgage, if the fix ends before the sale: the year the new
  // deal starts.
  const remortgageYear = input.mortgage.loan > 0 && input.mortgage.fixedYears < input.horizonYears ? input.mortgage.fixedYears + 1 : null;
  const outcomes = rentGiven && remortgageYear
    ? Object.fromEntries(RATE_OPTIONS.map(o => [o.scenario, calcRentVsBuy({ ...input, mortgageScenario: o.scenario })]))
    : null;
  const result = rentGiven ? (outcomes ? outcomes[rateScenario] : calcRentVsBuy(input)) : null;
  const leasehold = input.tenure === "leasehold";
  const cash = input.returnType === "cash";
  const buyingAhead = result ? result.gapAtHorizon > 0 : false;

  // The inputs, below the result (see the layout note above the component).
  const inputs = (
    <>
      {/* Own rows: "Years before you'd sell" is too long a caption to share a
          row on a small phone without being cut off. */}
      <div style={{display:"flex",gap:"10px"}}>
        <PillCell info={why.button("rent")}><PillMoneyInput label="Monthly rent" value={+d.propertyMonthlyRent || null} onChange={v => set("propertyMonthlyRent", v ?? "")}/></PillCell>
      </div>
      {why.panel("rent")}
      <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
        <PillCell info={why.button("horizon")}><PillMoneyInput label="Years before you'd sell" unit="" value={input.horizonYears} onChange={v => set("propertyHorizonYears", v ?? "")}/></PillCell>
      </div>
      {why.panel("horizon")}
      <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
        <PillCell info={why.button("tenure")}><div style={{flex:1,minWidth:0}}><PillSlider value={input.tenure} onChange={v => set("propertyTenure", v)} options={TENURE_OPTIONS}/></div></PillCell>
      </div>
      {why.panel("tenure")}
      {leasehold && (
        <>
          <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
            <PillCell info={why.button("groundRent")}><PillMoneyInput label="Ground rent a year" value={+d.propertyGroundRent || null} onChange={v => set("propertyGroundRent", v ?? "")}/></PillCell>
            <PillCell info={why.button("serviceCharge")}><PillMoneyInput label="Service charge a year" value={+d.propertyServiceCharge || null} onChange={v => set("propertyServiceCharge", v ?? "")}/></PillCell>
          </div>
          {why.panel("groundRent", "serviceCharge")}
          <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
            <PillCell><PillMoneyInput label="Ground rent rise a year" unit="%" value={+d.propertyGroundRentGrowth || null} onChange={v => set("propertyGroundRentGrowth", v ?? "")}/></PillCell>
            <div style={{flex:1}}/>
          </div>
        </>
      )}

      {/* Out from under Assumptions: it moves the answer more than anything
          else (the line under the answer says by how much). */}
      <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
        <PillCell><PillMoneyInput label="House price growth a year" unit="%" allowNegative value={input.housePriceGrowthPct || null} onChange={v => set("propertyHousePriceGrowth", v ?? "")}/></PillCell>
      </div>

      <div style={{...fieldLabel,marginTop:"18px"}}>
        Assumptions
        <InfoButton open={assumptionsOpen} onClick={() => setAssumptionsOpen(o => !o)}/>
      </div>
      <p style={{fontSize:"12.5px",color:TEXT,margin:"6px 0 0"}}>
        Rents {pct(input.rentGrowthPct)} a year · upkeep {leasehold ? `${fmt(input.leaseholdMaintenance)} a year` : `${pct(input.maintenancePct)} of the value a year`} · selling costs {pct(input.sellingCostsPct)} · {cash ? `cash ${pct(input.investmentReturnPct)}` : `invested ${pct(input.investmentReturnPct)}`}
      </p>
      <RentVsBuyAssumptions assumptionsOpen={assumptionsOpen} input={input} set={set} leasehold={leasehold} why={why} cash={cash} d={d}/>
    </>
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",marginBottom:"10px"}}>
        <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase"}}>Which leaves you better off</div>
        {/* "Explain this" replays the answer step by step. */}
        <ExplainLink onClick={result && !holdResult ? onExplain : null}/>
      </div>
      {!result || holdResult ? (
        <EmptyResultCard text={guide ? "Answer a few questions below to compare renting with buying." : "Add your monthly rent below to compare renting with buying."}/>
      ) : (
        <RentVsBuyResult resultRef={resultRef} result={result} buyingAhead={buyingAhead} outcomes={outcomes} remortgageYear={remortgageYear} rateInfoOpen={rateInfoOpen} setRateInfoOpen={setRateInfoOpen} input={input} rateScenario={rateScenario} setRateScenario={setRateScenario} detailsOpen={detailsOpen} setSelectedYear={setSelectedYear} framingOpen={framingOpen} setFramingOpen={setFramingOpen} costsInfoOpen={costsInfoOpen} setCostsInfoOpen={setCostsInfoOpen} earningsInfoOpen={earningsInfoOpen} setEarningsInfoOpen={setEarningsInfoOpen} cash={cash} ownInfoOpen={ownInfoOpen} setOwnInfoOpen={setOwnInfoOpen} setDetailsOpen={setDetailsOpen} selectedYear={selectedYear} d={d} m={m} leasehold={leasehold}/>
      )}
      {result && !holdResult && (
        <StickySummaryBar watchRef={resultRef} label="Back to which leaves you better off">
          <SummaryLabel>After {years(result.horizonYears)}</SummaryLabel>
          <SummaryFigure color={TEXT}>{buyingAhead ? "Buying" : "Renting"}</SummaryFigure>
          <span style={{fontSize:"12.5px",fontWeight:600,color:MUT}}>~{fmtCompact(Math.abs(result.gapAtHorizon))} ahead</span>
        </StickySummaryBar>
      )}

      <hr style={{border:"none",borderTop:"1px solid rgba(22,47,36,0.1)",margin:"18px 0 14px"}}/>
      {guide || (<>
        <AssumptionsHeading text="Set your rent vs buy assumptions." onWalkThrough={onWalkThrough}/>
        {inputs}
      </>)}
    </div>
  );
}

// The assumptions the answer uses, each editable, behind "Assumptions".
function RentVsBuyAssumptions({ assumptionsOpen, input, set, leasehold, why, cash, d }) {
  return (
    <>
      {assumptionsOpen && (
        <div style={{marginTop:"10px"}}>
          <div style={{display:"flex",gap:"10px"}}>
            <PillCell><PillMoneyInput label="Rent growth" unit="%" allowNegative value={input.rentGrowthPct || null} onChange={v => set("propertyRentGrowth", v ?? "")}/></PillCell>
            <PillCell>
              {leasehold
                ? <PillMoneyInput label="Upkeep a year" value={input.leaseholdMaintenance || null} onChange={v => set("propertyLeaseholdMaintenance", v ?? "")}/>
                : <PillMoneyInput label="Upkeep, % of value" unit="%" value={input.maintenancePct || null} onChange={v => set("propertyMaintenancePct", v ?? "")}/>}
            </PillCell>
          </div>
          <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
            <PillCell><PillMoneyInput label="Selling costs" unit="%" value={input.sellingCostsPct || null} onChange={v => set("propertySellingCosts", v ?? "")}/></PillCell>
            <div style={{flex:1}}/>
          </div>
          <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>
            Selling costs cover the estate agent (about 1.4% with VAT), legal fees and moving. Upkeep is repairs and maintenance{leasehold ? " inside the flat; the service charge covers the building" : ""}.
          </p>
          <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
            <PillCell info={why.button("renterMoney")}><div style={{flex:1,minWidth:0}}><PillSlider value={input.returnType} onChange={v => set("propertyRenterMoney", v)} options={MONEY_OPTIONS}/></div></PillCell>
            <PillCell>
              {cash
                ? <PillMoneyInput label="Cash rate" unit="%" value={twoDp(input.investmentReturnPct) || null} onChange={v => set("propertyCashReturn", v ?? "")}/>
                : <PillMoneyInput label="Investment return" unit="%" value={twoDp(input.investmentReturnPct) || null} onChange={v => set("propertyInvestmentReturn", v ?? "")}/>}
            </PillCell>
          </div>
          {why.panel("renterMoney")}
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
    </>
  );
}

// The answer: buying or renting ahead at the horizon, year by year, with
// the rates choice and what's behind the figures.
function RentVsBuyResult({ resultRef, result, buyingAhead, outcomes, remortgageYear, rateInfoOpen, setRateInfoOpen, input, rateScenario, setRateScenario, detailsOpen, setSelectedYear, framingOpen, setFramingOpen, costsInfoOpen, setCostsInfoOpen, earningsInfoOpen, setEarningsInfoOpen, cash, ownInfoOpen, setOwnInfoOpen, setDetailsOpen, selectedYear, d, m, leasehold }) {
  const explainer = { fontSize:"11.5px", color:MUT, lineHeight:1.5, background:CDARK, borderRadius:"8px", padding:"8px 10px", margin:0 };
  const figureLabel = { fontSize:"10px", fontWeight:600, color:MUT, letterSpacing:"0.06em", textTransform:"uppercase" };
  const together = input.people.length > 1;
  const last = result?.years.at(-1);
  const shown = result ? (result.years.find(y => y.year === selectedYear) || last) : null;
  // How much the answer leans on house prices, for the rate option chosen.
  // Buying the user can't afford month to month: the comparison assumes they
  // pay it, so it says so above the answer (src/lib/monthlyBudget.js).
  const budget = result ? monthlyBudget(d, m) : null;
  const budgetWarning = !budget ? null
    : budget.status === "short" ? { color: SC.critical, text: `Buying would leave you ${fmt(-budget.left)} short each month, so this assumes money you don't have.` }
    : budget.leftIfRatesRise != null && budget.leftIfRatesRise < 0 ? { color: WARNING, text: `If rates are higher from year ${budget.ratesRise.year}, buying would leave you ${fmt(-budget.leftIfRatesRise)} short each month.` }
    : null;
  const leans = result ? breakevenLine(breakevenGrowthPct(outcomes ? { ...input, mortgageScenario: rateScenario } : input), buyingAhead) : null;
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
    <>
      <motion.div ref={resultRef} initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.4}}
        style={{scrollMarginTop:"16px",background:WHITE,borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",padding:CARD_PADDING_WITH_CHEVRON}}>
          {budgetWarning && (
            <div style={{display:"flex",alignItems:"flex-start",gap:"6px",fontSize:"12.5px",fontWeight:600,color:TEXT,lineHeight:1.45,marginBottom:"12px"}}>
              <CircleAlert size={15} color={budgetWarning.color} style={{flexShrink:0,marginTop:"1px"}}/>
              {budgetWarning.text}
            </div>
          )}
          {/* The answer, centred: buying or renting, larger, with by how
              much on the same line at its usual size. */}
          <div style={{textAlign:"center"}}>
            <div style={figureLabel}>Better off after {years(result.horizonYears)}</div>
            <div style={{display:"flex",alignItems:"baseline",justifyContent:"center",gap:"10px",flexWrap:"wrap",marginTop:"2px"}}>
              <span style={{fontFamily:SERIF,fontSize:"38px",fontWeight:700,color:TEXT,lineHeight:1.15}}>{buyingAhead ? "Buying" : "Renting"}</span>
              <span style={{display:"inline-flex",alignItems:"center",gap:"4px",fontSize:"13px",color:TEXT}}>
                <ArrowUp size={14} color={SC.ok} strokeWidth={2.6}/>
                ~{fmtCompact(Math.abs(result.gapAtHorizon))} vs {buyingAhead ? "renting" : "buying"}
              </span>
            </div>
            {leans && <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"6px 0 0"}}>{leans}</p>}
          </div>

          {outcomes && (
            <div style={{marginTop:"14px"}}>
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

          {/* Collapsed, a negative-equity warning still shows in one line,
              so it can't be missed; the full note is in the details. */}
          {!detailsOpen && result.negativeEquityYears.length > 0 && (
            <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"12px",fontSize:"13px",fontWeight:700,color:SC.critical}}>
              <CircleAlert size={15} style={{flexShrink:0}}/>
              {negativeEquityText(result.negativeEquityYears)}
            </div>
          )}

          {/* The chart, timeline and year-by-year breakdown, collapsed by
              default so the result and the inputs below fit on one screen. */}
          {detailsOpen && (<>
          <NetCostChart rows={result.years} selectedYear={shown.year}
            buyingAtStart={result.years[0].buying.stampDutyAndFees + input.price * input.sellingCostsPct / 100}/>
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
                          {input.partnerEstimate.shared
                            ? `Your partner's take-home pay is roughly ${fmt(input.partnerEstimate.takeHome)} a year. With your spending shared, together you'd have about ${fmt(input.partnerEstimate.householdSurplus)} a year to save, split between you by take-home pay.`
                            : `Your partner's take-home pay is roughly ${fmt(input.partnerEstimate.takeHome)} a year. Scaling your monthly costs to their salary puts theirs at about ${fmt(input.partnerEstimate.costs / 12)} a month, leaving around ${fmt(input.partnerEstimate.surplus)} a year to save.`}
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
          </>)}
          <ExpandChevron open={detailsOpen} onToggle={() => setDetailsOpen(o => !o)} label="the details"/>
      </motion.div>
    </>
  );
}
