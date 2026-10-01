import { useState } from "react";
import { MUT, TEXT, SERIF, WHITE, PillSlider } from "../../CandidApp.jsx";
import { rentVsBuyInputs, calcRentVsBuy, ISA_ALLOWANCE } from "../../lib/rentVsBuy.js";
import { PROPERTY_REGIONS } from "../../lib/regions.js";
import { fmt } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import InfoButton from "../InfoButton.jsx";
import PillCell from "./PillCell.jsx";

// Property step 3: rent vs buy over the years the buyer expects to stay
// (logic in src/lib/rentVsBuy.js). Moderate scenario only for now.

const TENURE_OPTIONS = [{ value:"freehold", label:"Freehold" }, { value:"leasehold", label:"Leasehold" }];
const pct = n => `${Math.round(n * 10) / 10}%`;
const years = n => `${n} ${n === 1 ? "year" : "years"}`;

export default function RentVsBuyStep({ d, m, set, regionalRows }) {
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [costInfoOpen, setCostInfoOpen] = useState(false);
  const [investInfoOpen, setInvestInfoOpen] = useState(false);
  const fieldLabel = { fontSize:"11px", fontWeight:600, color:MUT, letterSpacing:"0.07em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:"6px" };
  const explainer = { fontSize:"11.5px", color:MUT, lineHeight:1.5, background:"#ede7db", borderRadius:"8px", padding:"8px 10px", margin:0 };
  const row = { display:"flex", justifyContent:"space-between", alignItems:"center", gap:"12px", fontSize:"13.5px", color:TEXT, padding:"6px 0" };
  const lineRow = { display:"flex", justifyContent:"space-between", gap:"10px" };
  const figureLabel = { fontSize:"10px", fontWeight:600, color:MUT, letterSpacing:"0.06em", textTransform:"uppercase" };

  const input = rentVsBuyInputs(d, m, regionalRows);
  const result = input.monthlyRent > 0 ? calcRentVsBuy(input) : null;
  const leasehold = input.tenure === "leasehold";
  const regionLabel = PROPERTY_REGIONS.find(r => r.value === d.propertyRegion)?.label;
  const together = input.people.length > 1;
  const c = result?.firstYearCosts;
  const last = result?.years.at(-1);
  const monthlyGap = c ? c.monthlyTotal - input.monthlyRent : 0;

  return (
    <div>
      <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Rent vs buy</div>

      <div style={{display:"flex",gap:"10px"}}>
        <PillCell><PillMoneyInput label="Monthly rent" value={+d.propertyMonthlyRent || null} onChange={v => set("propertyMonthlyRent", v ?? "")}/></PillCell>
        <PillCell><PillMoneyInput label="Years you'd stay" unit="" value={input.horizonYears} onChange={v => set("propertyHorizonYears", v ?? "")}/></PillCell>
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
        Home values {pct(input.housePriceGrowthPct)} a year · rents {pct(input.rentGrowthPct)} · investments {pct(input.investmentReturnPct)}
      </p>
      {assumptionsOpen && (
        <div style={{marginTop:"10px"}}>
          <div style={{display:"flex",gap:"10px"}}>
            <PillCell><PillMoneyInput label="Home values a year" unit="%" value={input.housePriceGrowthPct || null} onChange={v => set("propertyHousePriceGrowth", v ?? "")}/></PillCell>
            <PillCell><PillMoneyInput label="Rents a year" unit="%" value={input.rentGrowthPct || null} onChange={v => set("propertyRentGrowth", v ?? "")}/></PillCell>
          </div>
          <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
            <PillCell><PillMoneyInput label="Investment return" unit="%" value={input.investmentReturnPct || null} onChange={v => set("propertyInvestmentReturn", v ?? "")}/></PillCell>
            <PillCell><PillMoneyInput label="Of which dividends" unit="%" value={input.dividendYieldPct || null} onChange={v => set("propertyDividendYield", v ?? "")}/></PillCell>
          </div>
          <p style={{...explainer,marginTop:"10px"}}>
            Home values: Candid assumes 3% a year unless you change it. Rents: the latest ONS figure for {regionLabel || "your region"}. Investments: Royal London's mid growth assumption for UK shares (5%), which is Royal London's own figure, not an FCA-prescribed rate. Dividends are taxed each year outside an ISA; the rest of the return is growth, taxed when sold.
          </p>
        </div>
      )}

      <div style={{marginTop:"18px",background:WHITE,borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",padding:"18px"}}>
        {!result ? (
          <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:0}}>Add your current monthly rent to compare renting with buying.</p>
        ) : (
          <>
            <div style={figureLabel}>{result.breakevenYear ? "Buying pulls ahead" : "Renting stays ahead"}</div>
            <div style={{fontFamily:SERIF,fontSize:"26px",fontWeight:700,color:TEXT,lineHeight:1.2}}>
              {result.breakevenYear ? `From year ${result.breakevenYear}` : `For all ${years(result.horizonYears)}`}
            </div>
            <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"4px 0 0"}}>
              {result.gapAtHorizon >= 0
                ? `After ${years(result.horizonYears)}, buying leaves you ${fmt(result.gapAtHorizon)} better off.`
                : `After ${years(result.horizonYears)}, renting leaves you ${fmt(-result.gapAtHorizon)} better off.`}
            </p>

            <div style={{display:"flex",gap:"24px",marginTop:"14px"}}>
              <div>
                <div style={figureLabel}>Buying</div>
                <div style={{fontFamily:SERIF,fontSize:"20px",fontWeight:700,color:TEXT}}>{fmt(last.buyerWealth)}</div>
              </div>
              <div>
                <div style={figureLabel}>Renting</div>
                <div style={{fontFamily:SERIF,fontSize:"20px",fontWeight:700,color:TEXT}}>{fmt(last.renterWealth)}</div>
              </div>
            </div>
            <div style={{fontSize:"11.5px",color:MUT,marginTop:"2px"}}>What each would leave after {years(result.horizonYears)}, after selling costs and tax</div>

            <hr style={{border:"none",borderTop:"1px solid rgba(22,47,36,0.1)",margin:"16px 0 8px"}}/>
            <div style={row}>
              <span style={{display:"flex",alignItems:"center",gap:"6px"}}>
                Buyer's monthly cost
                <InfoButton open={costInfoOpen} onClick={() => setCostInfoOpen(o => !o)}/>
              </span>
              <span>{fmt(c.monthlyTotal)}</span>
            </div>
            {costInfoOpen && (
              <div style={{...explainer,margin:"2px 0 6px"}}>
                <div style={lineRow}><span>Mortgage</span><span>{fmt(c.mortgagePayment)}</span></div>
                <div style={lineRow}><span>Maintenance</span><span>{fmt(c.maintenance)}</span></div>
                {leasehold && <div style={lineRow}><span>Ground rent</span><span>{fmt(c.groundRent)}</span></div>}
                {leasehold && <div style={lineRow}><span>Service charge</span><span>{fmt(c.serviceCharge)}</span></div>}
                <p style={{margin:"6px 0 0"}}>
                  First-year figures. {leasehold ? "Maintenance is £1,200 a year for a flat's own upkeep, rising 2% a year; the service charge rises 5% a year." : "Maintenance is 1% of the home's value a year."} A remortgage fee is added at the start of each new deal. The part of the mortgage that repays the loan isn't lost: it's in the buyer's equity.
                </p>
              </div>
            )}
            <div style={row}><span>Rent</span><span>{fmt(input.monthlyRent)}</span></div>
            <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,margin:"2px 0 6px"}}>
              {monthlyGap >= 0
                ? `Renting leaves ${fmt(monthlyGap)} a month to invest in year 1.`
                : `Renting costs ${fmt(-monthlyGap)} a month more in year 1, drawn from the renter's investments.`}
            </p>
            <div style={row}>
              <span style={{display:"flex",alignItems:"center",gap:"6px"}}>
                Renter invests upfront
                <InfoButton open={investInfoOpen} onClick={() => setInvestInfoOpen(o => !o)}/>
              </span>
              <span>{fmt(input.upfront)}</span>
            </div>
            {investInfoOpen && (
              <div style={{...explainer,margin:"2px 0 6px"}}>
                <p style={{margin:0}}>
                  The same as the buyer's deposit, stamp duty and fees. Of that, {fmt(Math.min(input.upfront, input.people.reduce((s, p) => s + p.isaHeadroom, 0)))} fits in {together ? "your ISAs" : "your ISA"} this tax year; the rest is invested outside an ISA, where dividends above £500 and gains above £3,000 a year are taxed.
                </p>
                <p style={{margin:"6px 0 0"}}>
                  After that, Candid assumes {together ? "each of you adds" : "you add"} to ISAs only what {together ? "you each" : "you"} could save from income, up to {fmt(ISA_ALLOWANCE)} a year: about {fmt(input.people[0].isaCapacity)} a year for you{together ? ` and ${fmt(input.people[1].isaCapacity)} for your partner` : ""}.
                </p>
                {together && input.partnerEstimate && (
                  <p style={{margin:"6px 0 0"}}>
                    Your partner's take-home pay is roughly {fmt(input.partnerEstimate.takeHome)} a year. Scaling your monthly costs to their salary puts theirs at about {fmt(input.partnerEstimate.costs)}, leaving around {fmt(input.partnerEstimate.surplus)} a year to save.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
