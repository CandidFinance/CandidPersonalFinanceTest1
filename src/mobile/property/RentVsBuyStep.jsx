import { useState } from "react";
import { G, GOLD, MUT, TEXT, SERIF, WHITE, PillSlider } from "../../CandidApp.jsx";
import { rentVsBuyInputs, calcRentVsBuy, ISA_ALLOWANCE } from "../../lib/rentVsBuy.js";
import { fmt } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import InfoButton from "../InfoButton.jsx";
import PillCell from "./PillCell.jsx";

// Property step 3: rent vs buy over the years before the buyer would sell
// (logic in src/lib/rentVsBuy.js). Moderate scenario only for now.

const TENURE_OPTIONS = [{ value:"freehold", label:"Freehold" }, { value:"leasehold", label:"Leasehold" }];
const MONEY_OPTIONS = [{ value:"cash", label:"Cash" }, { value:"invested", label:"Invested" }];
const pct = n => `${Math.round(n * 10) / 10}%`;
const twoDp = n => Math.round(n * 100) / 100;
const years = n => `${n} ${n === 1 ? "year" : "years"}`;

// Consecutive years with the same side ahead, e.g. rent in years 1-2 then
// buy in years 3-5.
function runsOf(rows) {
  const runs = [];
  for (const r of rows) {
    const side = r.buyerWealth > r.renterWealth ? "buy" : "rent";
    const last = runs[runs.length - 1];
    if (last && last.side === side) last.to = r.year;
    else runs.push({ side, from: r.year, to: r.year });
  }
  return runs;
}

// One cell per year, buy or rent, whichever leaves more if you sold or
// cashed in at the end of that year. Labelled while the cells are wide
// enough; past 8 years, colour only, with a key. The colours are each
// year's one state indicator.
function Timeline({ rows }) {
  const labelled = rows.length <= 8;
  const colour = side => side === "buy" ? G : GOLD;
  return (
    <div style={{marginTop:"14px"}}>
      <div style={{display:"flex",gap:"3px"}}>
        {rows.map(r => {
          const side = r.buyerWealth > r.renterWealth ? "buy" : "rent";
          return (
            <div key={r.year} style={{flex:1,minWidth:0,textAlign:"center"}}>
              {labelled && <div style={{fontSize:"10px",fontWeight:600,color:MUT,marginBottom:"3px"}}>Y{r.year}</div>}
              <div style={{height:labelled ? "26px" : "14px",borderRadius:"6px",background:colour(side),color:WHITE,fontSize:"11px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {labelled ? (side === "buy" ? "Buy" : "Rent") : ""}
              </div>
            </div>
          );
        })}
      </div>
      {!labelled && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"5px",fontSize:"10.5px",color:MUT}}>
          <span>Year 1</span>
          <span style={{display:"flex",gap:"10px"}}>
            <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:"9px",height:"9px",borderRadius:"2px",background:G}}/>Buy</span>
            <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:"9px",height:"9px",borderRadius:"2px",background:GOLD}}/>Rent</span>
          </span>
          <span>Year {rows.length}</span>
        </div>
      )}
    </div>
  );
}

export default function RentVsBuyStep({ d, m, set, regionalRows }) {
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [workingsOpen, setWorkingsOpen] = useState(false);
  const fieldLabel = { fontSize:"11px", fontWeight:600, color:MUT, letterSpacing:"0.07em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:"6px" };
  const explainer = { fontSize:"11.5px", color:MUT, lineHeight:1.5, background:"#ede7db", borderRadius:"8px", padding:"8px 10px", margin:0 };
  const lineRow = { display:"flex", justifyContent:"space-between", gap:"10px" };
  const figureLabel = { fontSize:"10px", fontWeight:600, color:MUT, letterSpacing:"0.06em", textTransform:"uppercase" };

  const input = rentVsBuyInputs(d, m, regionalRows);
  const result = input.monthlyRent > 0 ? calcRentVsBuy(input) : null;
  const leasehold = input.tenure === "leasehold";
  const cash = input.returnType === "cash";
  const together = input.people.length > 1;
  const c = result?.firstYearCosts;
  const last = result?.years.at(-1);
  const buyingAhead = result ? result.gapAtHorizon > 0 : false;
  const runs = result ? runsOf(result.years) : [];
  const monthlyGap = c ? c.monthlyTotal - input.monthlyRent : 0;
  const isaRoomNow = input.alreadyInIsa + input.people.reduce((s, p) => s + p.isaHeadroom, 0);

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
            <PillCell><PillMoneyInput label="House price growth" unit="%" value={input.housePriceGrowthPct || null} onChange={v => set("propertyHousePriceGrowth", v ?? "")}/></PillCell>
            <PillCell><PillMoneyInput label="Rent growth" unit="%" value={input.rentGrowthPct || null} onChange={v => set("propertyRentGrowth", v ?? "")}/></PillCell>
          </div>
          <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
            <PillCell><div style={{flex:1,minWidth:0}}><PillSlider value={input.returnType} onChange={v => set("propertyRenterMoney", v)} options={MONEY_OPTIONS}/></div></PillCell>
            <PillCell>
              {cash
                ? <PillMoneyInput label="Cash rate" unit="%" value={twoDp(input.investmentReturnPct) || null} onChange={v => set("propertyCashReturn", v ?? "")}/>
                : <PillMoneyInput label="Investment return" unit="%" value={twoDp(input.investmentReturnPct) || null} onChange={v => set("propertyInvestmentReturn", v ?? "")}/>}
            </PillCell>
          </div>
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
            <div style={figureLabel}>Better off after {years(result.horizonYears)}</div>
            <div style={{fontFamily:SERIF,fontSize:"30px",fontWeight:700,color:TEXT,lineHeight:1.2}}>{buyingAhead ? "Buying" : "Renting"}</div>
            <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"2px 0 0"}}>
              By {fmt(Math.abs(result.gapAtHorizon))} over {buyingAhead ? "renting" : "buying"}.
              {runs.length > 1 && ` ${runs.map((r, i) => `${i === 0 ? (r.side === "buy" ? "Buying" : "Renting") : (r.side === "buy" ? "buying" : "renting")} is ahead ${r.from === r.to ? `in year ${r.from}` : `in years ${r.from} to ${r.to}`}`).join(", then ")}.`}
            </p>

            <Timeline rows={result.years}/>

            <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"10px 0 0"}}>
              After {years(result.horizonYears)}, buying leaves {fmt(last.buyerWealth)} and renting {fmt(last.renterWealth)}, after selling costs and tax.
            </p>

            <hr style={{border:"none",borderTop:"1px solid rgba(22,47,36,0.1)",margin:"14px 0 10px"}}/>
            <div style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"12.5px",color:TEXT}}>
              How this is worked out
              <InfoButton open={workingsOpen} onClick={() => setWorkingsOpen(o => !o)}/>
            </div>
            {workingsOpen && (
              <div style={{...explainer,marginTop:"8px"}}>
                <div style={{fontWeight:600,color:TEXT,marginBottom:"2px"}}>Buyer's monthly cost, year 1</div>
                <div style={lineRow}><span>Mortgage</span><span>{fmt(c.mortgagePayment)}</span></div>
                <div style={lineRow}><span>Maintenance</span><span>{fmt(c.maintenance)}</span></div>
                {leasehold && <div style={lineRow}><span>Ground rent</span><span>{fmt(c.groundRent)}</span></div>}
                {leasehold && <div style={lineRow}><span>Service charge</span><span>{fmt(c.serviceCharge)}</span></div>}
                <div style={{...lineRow,fontWeight:600,color:TEXT}}><span>Total</span><span>{fmt(c.monthlyTotal)}</span></div>
                <div style={lineRow}><span>Rent</span><span>{fmt(input.monthlyRent)}</span></div>
                <p style={{margin:"6px 0 0"}}>
                  {monthlyGap >= 0
                    ? `Renting leaves ${fmt(monthlyGap)} a month to put aside in year 1.`
                    : `Renting costs ${fmt(-monthlyGap)} a month more in year 1, taken from the renter's savings.`}
                  {" "}The part of the mortgage that repays the loan isn't lost: it's in the buyer's equity.
                </p>
                <p style={{margin:"8px 0 0"}}>
                  The renter starts with {fmt(input.upfront)}, the same as the buyer's deposit, stamp duty and fees, {cash ? "kept in cash" : "invested"}. About {fmt(Math.min(input.upfront, isaRoomNow))} of it sits in ISAs; the rest is taxed each year{cash ? " on interest above the Personal Savings Allowance" : " on dividends, and on gains when sold"}. After this year, Candid assumes {together ? "each of you adds" : "you add"} to ISAs only what {together ? "you each" : "you"} could save from income, up to {fmt(ISA_ALLOWANCE)} a year: about {fmt(input.people[0].isaCapacity)} for you{together ? ` and ${fmt(input.people[1].isaCapacity)} for your partner` : ""}.
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
