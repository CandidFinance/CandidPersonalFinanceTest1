import { useState } from "react";
import { fmt } from "../../lib/format.js";
import { G, GOLD, WHITE, MUT, TEXT, SERIF } from "../../CandidApp.jsx";
import MobileWinTile from "../MobileWinTile.jsx";

// Trimmed mobile version of desktop's Investments deep dive (ModuleDeepDive,
// moduleKey==="investments" — CandidApp.jsx). Keeps both wins (crystallise
// CGT-exempt gains, use unused ISA allowance) with the same numbers, using
// tap-to-reveal "?" bubbles for the two explainer asides (Bed & breakfasting,
// Use it or lose it) instead of desktop's always-visible MiniExpandTiles.
// Drops the ISA compound-growth line chart and live ISA-provider product
// cards for this v1 — same trim rationale as Cash/Student Loan (no
// savingsRates wired into the mobile route yet, and inline charts need
// mobile-specific redesign, not a direct port).
export default function MobileInvestmentsDeepDive({ d, m, statuses }) {
  const [openInfo, setOpenInfo] = useState(null); // "bnb" | "useit" | null
  const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT, padding:"5px 0" };
  const infoBtnStyle = { background:"#a8a89c", color:WHITE, border:"none", borderRadius:"50%", width:"15px", height:"15px", fontSize:"10px", fontWeight:700, lineHeight:"15px", textAlign:"center", padding:0, cursor:"pointer", flexShrink:0 };

  const totalOpp = statuses.investments?.amount || 0;
  const unwrappedVal = +d.unwrappedValue || 0;
  const surplusSources = [];
  if (m.surplusCash > 5000) surplusSources.push(`${fmt(m.surplusCash)} of surplus cash above your ${m.bufferMonths}-month emergency fund`);
  if (unwrappedVal > 0) surplusSources.push(`${fmt(unwrappedVal)} of unwrapped investments`);
  const showMoveMsg = m.isaHeadroom > 0 && surplusSources.length > 0;

  const retirementAge = 67;
  const currentAge = +d.age || 30;
  const growthYears = Math.max(1, retirementAge - currentAge);
  const isaProjectedValue = m.isaHeadroom * Math.pow(1.07, growthYears);

  const totalGains = +d.unrealisedGains || 0;
  const cgtRatePct = Math.round(m.cgtRate * 100);
  const yearsNeeded = Math.ceil(totalGains / 3000);
  const taxpayerBand = m.tr !== 0.20 ? "higher/additional-rate" : "basic-rate";
  const taxIfWait = Math.round((totalGains - 3000) * m.cgtRate);

  return (
    <div>
      {(m.isaHeadroom > 0 || m.crystallisable > 0) && (
        <div style={{background:"rgba(196,150,58,0.12)",borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
          <div style={{fontSize:"10px",fontWeight:800,color:"#8a6a24",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Opportunity</div>
          {totalOpp > 0 ? (
            <>
              <div style={{fontFamily:SERIF,fontSize:"32px",color:TEXT,fontWeight:700,lineHeight:1.1}}>{fmt(totalOpp)}</div>
              <div style={{fontSize:"12px",color:"#8a6a24",marginTop:"4px",fontWeight:600}}>CGT saving available this tax year</div>
            </>
          ) : (
            <div style={{fontSize:"13.5px",color:"#8a6a24",fontWeight:600}}>No CGT saving to bank this tax year</div>
          )}
          {m.isaHeadroom > 0 && (
            <div style={{fontSize:"12px",color:TEXT,lineHeight:1.5,marginTop:"10px"}}>
              Plus {fmt(m.isaHeadroom)} of unused ISA allowance — not a guaranteed gain, but investing it shelters future growth from tax.
            </div>
          )}
        </div>
      )}

      <MobileWinTile number={1} title="Crystallise paper gains"
        headline={m.crystallisable > 0 ? `${fmt(m.cgtSaving)} saved this tax year` : "No unrealised gains to crystallise this tax year."}
        tagLabel="Today">
        {m.crystallisable > 0 ? (
          <div>
            <p style={{fontSize:"13.5px",color:TEXT,lineHeight:1.6,marginBottom:yearsNeeded>1?"10px":0}}>
              You have ~{fmt(totalGains)} of unrealised gain. £3,000 is CGT-exempt each year — bank {fmt(m.crystallisable)} of gain now at £0 tax.{yearsNeeded > 1 && ` At that rate, shielding it all takes ${yearsNeeded} tax years.`}
            </p>
            {yearsNeeded > 1 && (
              <div style={{background:"rgba(22,47,36,0.03)",border:"1px solid rgba(22,47,36,0.12)",borderRadius:"10px",padding:"12px 14px",marginBottom:"10px"}}>
                <div style={{fontSize:"10px",fontWeight:700,color:G,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:"6px"}}>Wait and sell it all, vs shielding £3,000/yr</div>
                <div style={rowStyle}><span>Total unrealised gain</span><span style={{fontWeight:600}}>{fmt(totalGains)}</span></div>
                <div style={rowStyle}><span>Less: one year's exemption</span><span>−{fmt(3000)}</span></div>
                <div style={{...rowStyle,fontWeight:700,color:"#c0392b"}}><span>Tax due at {cgtRatePct}%</span><span>{fmt(taxIfWait)}</span></div>
                <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginTop:"6px",marginBottom:0}}>Shield {fmt(3000)}/yr instead — spread across {yearsNeeded} tax years — and the same gain costs £0 in total: a saving of {fmt(taxIfWait)}.</p>
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  <span style={{fontSize:"12.5px",fontWeight:600,color:GOLD}}>Bed &amp; breakfasting</span>
                  <button onClick={() => setOpenInfo(o => o==="bnb"?null:"bnb")} style={infoBtnStyle}>?</button>
                </div>
                {openInfo === "bnb" && (
                  <p style={{fontSize:"12px",color:MUT,lineHeight:1.55,marginTop:"6px",background:"#ede7db",borderRadius:"8px",padding:"8px 10px"}}>
                    HMRC's "30-day rule" cancels the gain if you repurchase the same shares within 30 days. Buying back inside an ISA or pension sidesteps this — outside a wrapper, wait 30 days or buy a similarly-exposed fund instead.
                  </p>
                )}
              </div>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  <span style={{fontSize:"12.5px",fontWeight:600,color:"#c0392b"}}>Use it or lose it</span>
                  <button onClick={() => setOpenInfo(o => o==="useit"?null:"useit")} style={infoBtnStyle}>?</button>
                </div>
                {openInfo === "useit" && (
                  <p style={{fontSize:"12px",color:MUT,lineHeight:1.55,marginTop:"6px",background:"#ede7db",borderRadius:"8px",padding:"8px 10px"}}>
                    The £3,000 exempt amount doesn't carry over — unused, it's gone on April 5th. You're a {taxpayerBand} taxpayer, so gains above it are taxed at {cgtRatePct}%.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.6}}>No unrealised gains recorded outside an ISA or pension this year — nothing to crystallise. If that changes, come back before April 5th to use your £3,000 exempt amount.</p>
        )}
      </MobileWinTile>

      <MobileWinTile number={2} title="Utilise unused ISA allowance"
        headline={m.isaHeadroom > 0
          ? `${fmt(m.isaHeadroom)} remaining — invested, that could grow to ~${fmt(Math.round(isaProjectedValue))} tax-free by 67`
          : "You've used your full £20,000 ISA allowance this tax year."}
        tagLabel="Future opportunity" tagColor="#2d6b4a">
        {m.isaHeadroom > 0 ? (
          <div>
            {showMoveMsg && (
              <div style={{borderLeft:`3px solid ${GOLD}`,paddingLeft:"12px",marginBottom:"10px"}}>
                <div style={{fontSize:"11px",fontWeight:700,color:GOLD,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:"4px"}}>Move this into your S&amp;S ISA</div>
                <p style={{fontSize:"13px",color:TEXT,lineHeight:1.6,margin:0}}>
                  You have {surplusSources.join(" and ")} — {fmt(m.isaHeadroom)} of ISA allowance is available to shelter it from tax, permanently.
                </p>
              </div>
            )}
            <p style={{fontSize:"12px",color:MUT,lineHeight:1.55,margin:0}}>
              Illustrative only — assumes 7% p.a. nominal growth (not guaranteed) and investing at age {currentAge}, retiring at {retirementAge}. Real returns could be lower or negative.
            </p>
          </div>
        ) : (
          <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.6}}>Nothing left to shelter this tax year — check back after April 6th for a fresh £20,000 allowance.</p>
        )}
      </MobileWinTile>
    </div>
  );
}
