import { useState } from "react";
import { fmt } from "../../lib/format.js";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, getModuleProducts, OPPORTUNITY_TILE_BG, OPPORTUNITY_TILE_LABEL, OPPORTUNITY_TILE_FIGURE, OPPORTUNITY_TILE_BODY } from "../../CandidApp.jsx";
import MobileWinTile from "../MobileWinTile.jsx";
import MobileProviderTile from "../MobileProviderTile.jsx";
import GoToProviderButton from "../GoToProviderButton.jsx";
import PillMoneyInput from "../PillMoneyInput.jsx";
import InfoButton from "../InfoButton.jsx";
import { buildReminderSubject } from "../reminders.js";
import { firstName } from "../copy.js";
import { ExplainLink } from "../ModuleScreenParts.jsx";

// Trimmed mobile version of desktop's Investments deep dive (ModuleDeepDive,
// moduleKey==="investments" — CandidApp.jsx). Keeps both wins (crystallise
// CGT-exempt gains, use unused ISA allowance) with the same numbers, using
// tap-to-reveal "?" bubbles for the two explainer asides (Bed & breakfasting,
// Use it or lose it) instead of desktop's always-visible MiniExpandTiles.
// Drops the ISA compound-growth line chart and live ISA-provider product
// cards for this v1 — same trim rationale as Cash/Student Loan (no
// savingsRates wired into the mobile route yet, and inline charts need
// mobile-specific redesign, not a direct port).
// Leads with the answer: the tax-free profit tile only when there's profit to
// talk about, otherwise the ISA allowance first. `onShowReveal` replays the
// answer step by step ("Explain this").
export default function MobileInvestmentsDeepDive({ d, m, statuses, onRecordCrystallisedGain, onShowReveal }) {
  const [openInfo, setOpenInfo] = useState(null); // "bnb" | "useit" | "isa" | null
  const [loggingGain, setLoggingGain] = useState(false);
  const [amountSoldInput, setAmountSoldInput] = useState(null);
  const [gainInput, setGainInput] = useState(null);
  const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT, padding:"5px 0" };

  const openGainLogger = () => { setAmountSoldInput(null); setGainInput(null); setLoggingGain(true); };
  const closeGainLogger = () => setLoggingGain(false);
  const saveGainLog = () => {
    if (onRecordCrystallisedGain) onRecordCrystallisedGain(Math.max(0, +amountSoldInput || 0), Math.max(0, +gainInput || 0));
    closeGainLogger();
  };

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
  // Single source of truth for every £ figure this tile shows — crystallisable
  // (m, from metrics.js) is "what fits under this year's remaining allowance";
  // everything else here is derived from that one number, so the collapsed
  // pill, the breakdown, and the two-option comparison can never disagree
  // with each other the way the old cgtSaving-vs-ad-hoc-taxIfWait split did.
  const taxableSurplus = Math.max(0, totalGains - m.crystallisable);
  const instantSellTax = Math.round(taxableSurplus * m.cgtRate);
  // How many tax years it'd take to shield the whole gain: this year's
  // (already-reduced) allowance first, then a fresh £3,000 each year after —
  // not `remainingCgtAllowance` repeated, since only THIS year is capped by
  // gains already realised.
  const spreadYears = (() => {
    const years = [];
    let remaining = totalGains;
    const first = Math.min(remaining, m.remainingCgtAllowance);
    if (first > 0) { years.push(first); remaining -= first; }
    while (remaining > 0.5) {
      const slice = Math.min(remaining, 3000);
      years.push(slice);
      remaining -= slice;
    }
    return years;
  })();
  const spreadTimingLabel = spreadYears
    .map((amt, i) => i === 0 ? `${fmt(Math.round(amt))} today` : i === 1 ? `${fmt(Math.round(amt))} after April 5` : `${fmt(Math.round(amt))} in tax year ${i+1}`)
    .join(", ");
  const products = getModuleProducts("investments", d, m);
  const showGains = m.crystallisable > 0 || totalGains > 0;
  const hasOpportunity = m.isaHeadroom > 0 || m.crystallisable > 0;

  return (
    <div>
      {!hasOpportunity && onShowReveal && <div style={{marginBottom:"14px"}}><ExplainLink onClick={onShowReveal}/></div>}
      {hasOpportunity && (
        <div style={{background:OPPORTUNITY_TILE_BG,borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",marginBottom:"10px"}}>
            <div style={{fontSize:"10px",fontWeight:800,color:OPPORTUNITY_TILE_LABEL,letterSpacing:"0.08em",textTransform:"uppercase"}}>Opportunity</div>
            <ExplainLink onClick={onShowReveal} color={OPPORTUNITY_TILE_FIGURE}/>
          </div>
          {/* The same lead figure as the answer step by step: tax-free profit
              when there is some, otherwise the unused ISA allowance. */}
          {totalOpp > 0 ? (
            <>
              <div style={{fontFamily:SERIF,fontSize:"32px",color:OPPORTUNITY_TILE_FIGURE,fontWeight:700,lineHeight:1.1}}>{fmt(totalOpp)}</div>
              <div style={{fontSize:"12px",color:OPPORTUNITY_TILE_LABEL,marginTop:"4px",fontWeight:600}}>Capital gains tax you could avoid this year</div>
              {m.isaHeadroom > 0 && (
                <div style={{fontSize:"12px",color:OPPORTUNITY_TILE_BODY,lineHeight:1.5,marginTop:"10px"}}>
                  Plus {fmt(m.isaHeadroom)} of unused ISA allowance — not a guaranteed gain, but investing it shelters future growth from tax.
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{fontFamily:SERIF,fontSize:"32px",color:OPPORTUNITY_TILE_FIGURE,fontWeight:700,lineHeight:1.1}}>{fmt(m.isaHeadroom)}</div>
              <div style={{fontSize:"12px",color:OPPORTUNITY_TILE_LABEL,marginTop:"4px",fontWeight:600}}>Of this year's ISA allowance unused</div>
              <div style={{fontSize:"12px",color:OPPORTUNITY_TILE_BODY,lineHeight:1.5,marginTop:"10px"}}>
                Not a guaranteed gain, but investing it shelters future growth from tax.
              </div>
            </>
          )}
        </div>
      )}

      {showGains && (
      <MobileWinTile number={1} title="Take profit tax-free"
        headline={m.crystallisable > 0
          ? (m.remainingCgtAllowance >= 3000
              ? "Your full £3,000 tax-free gains allowance is available this year."
              : `You have ${fmt(m.remainingCgtAllowance)} of your £3,000 tax-free gains allowance left this year.`)
          : "No profit to take tax-free this tax year."}
        tagLabel="Harvest gains" tagColor={GOLD}
        reminder={m.crystallisable > 0 ? {
          id: "investments-crystallise-gains",
          title: buildReminderSubject(fmt(m.crystallisable), "Crystallise capital gains"),
          // Informational, not directive — states the figures and points to
          // your platform/adviser for the "how", rather than instructing a
          // specific trade (avoids reading as financial advice).
          description: `${firstName(d) ? firstName(d)+", y" : "Y"}ou have ${fmt(m.remainingCgtAllowance)} of your £3,000 CGT allowance left this year, against ~${fmt(totalGains)} of unrealised gain.${instantSellTax > 0 ? ` Selling it all today would cost ${fmt(instantSellTax)} in tax — spreading it over ${spreadYears.length} tax years (${spreadTimingLabel}) avoids that entirely.` : ` Crystallising ${fmt(m.crystallisable)} of it now costs £0 in tax.`}\n\nThis needs actioning before April 5th - worth a quick check with your platform or a financial adviser on how to do this for your holdings.`,
        } : null}>
        {m.crystallisable > 0 ? (
          <div>
            <div style={{background:"#f8f7f4",border:"1px solid rgba(22,47,36,0.1)",borderRadius:"10px",padding:"4px 14px",marginBottom:"12px"}}>
              <div style={rowStyle}><span>Profit so far</span><span style={{fontWeight:600}}>{fmt(totalGains)}</span></div>
              <div style={rowStyle}><span>Less: tax-free allowance left</span><span>−{fmt(m.crystallisable)}</span></div>
              <div style={{...rowStyle,borderTop:"1px solid rgba(22,47,36,0.1)",fontWeight:600}}><span>Profit above the allowance</span><span>{fmt(taxableSurplus)}</span></div>
              <div style={{...rowStyle,fontWeight:700,color:instantSellTax>0?"#c0392b":G}}><span>Tax if you sold it all today ({cgtRatePct}%)</span><span>{fmt(instantSellTax)}</span></div>
            </div>

            {instantSellTax > 0 ? (
              <>
                <div style={{display:"flex",gap:"8px",marginBottom:"6px"}}>
                  <div style={{flex:1,background:WHITE,border:"1.5px solid rgba(192,57,43,0.25)",borderRadius:"10px",padding:"10px 12px"}}>
                    <div style={{fontSize:"9.5px",fontWeight:700,color:MUT,letterSpacing:"0.04em",textTransform:"uppercase",marginBottom:"6px"}}>Sell it all today</div>
                    <div style={{fontFamily:SERIF,fontSize:"17px",fontWeight:700,color:"#c0392b"}}>{fmt(instantSellTax)}</div>
                    <div style={{fontSize:"10.5px",color:MUT,marginTop:"2px"}}>Tax due</div>
                  </div>
                  <div style={{flex:1,background:"rgba(196,150,58,0.1)",border:`1.5px solid ${GOLD}`,borderRadius:"10px",padding:"10px 12px"}}>
                    <div style={{fontSize:"9.5px",fontWeight:700,color:"#8a6a24",letterSpacing:"0.04em",textTransform:"uppercase",marginBottom:"6px"}}>Spread over {spreadYears.length} tax years</div>
                    <div style={{fontFamily:SERIF,fontSize:"17px",fontWeight:700,color:G}}>{fmt(0)}</div>
                    <div style={{fontSize:"10.5px",color:"#8a6a24",fontWeight:600,marginTop:"2px"}}>Saves {fmt(instantSellTax)}</div>
                  </div>
                </div>
                <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,marginBottom:"12px"}}>Spread plan: {spreadTimingLabel}.</p>
              </>
            ) : (
              <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,marginBottom:"12px"}}>Fully shielded by this year's allowance — no CGT due either way.</p>
            )}

            <GoToProviderButton storageKey="candid_gia_provider_pref" defaultLabel={`Take ${fmt(m.crystallisable)} of profit tax-free`}/>

            {onRecordCrystallisedGain && (
              <div style={{marginTop:"10px"}}>
                {!loggingGain ? (
                  <button onClick={openGainLogger} style={{background:"transparent",border:"none",color:MUT,fontSize:"12px",fontWeight:600,textDecoration:"underline",cursor:"pointer",padding:0}}>
                    I've sold some — update my figures
                  </button>
                ) : (
                  <div style={{background:"#ede7db",borderRadius:"10px",padding:"12px 14px"}}>
                    <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"8px"}}>Record what you sold</div>
                    <div style={{display:"flex",gap:"8px"}}>
                      <PillMoneyInput label="Amount sold" value={amountSoldInput} onChange={setAmountSoldInput}/>
                      <PillMoneyInput label="Gain crystallised" value={gainInput} onChange={setGainInput}/>
                    </div>
                    <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginTop:"10px",marginBottom:0}}>
                      We'll move this from your investments into cash, and count the gain against this year's CGT allowance.
                    </p>
                    <div style={{display:"flex",gap:"8px",marginTop:"12px"}}>
                      <button onClick={closeGainLogger} style={{flex:1,background:"transparent",border:"1.3px solid rgba(22,47,36,0.2)",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,color:G,cursor:"pointer"}}>Cancel</button>
                      <button onClick={saveGainLog} style={{flex:1,background:G,border:"none",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,color:WHITE,cursor:"pointer"}}>Save</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{display:"flex",flexDirection:"column",gap:"8px",marginTop:"14px"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  <span style={{fontSize:"12.5px",fontWeight:600,color:GOLD}}>Buying back in (bed and breakfasting)</span>
                  <InfoButton onClick={() => setOpenInfo(o => o==="bnb"?null:"bnb")} open={openInfo==="bnb"}/>
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
                  <InfoButton onClick={() => setOpenInfo(o => o==="useit"?null:"useit")} open={openInfo==="useit"}/>
                </div>
                {openInfo === "useit" && (
                  <p style={{fontSize:"12px",color:MUT,lineHeight:1.55,marginTop:"6px",background:"#ede7db",borderRadius:"8px",padding:"8px 10px"}}>
                    The £3,000 exemption doesn't carry over — whatever's unused is gone on April 5th.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.6}}>
            {m.remainingCgtAllowance === 0
              ? "You've used your full £3,000 tax-free gains allowance this tax year — further profit outside an ISA or pension will be taxed at your marginal rate."
              : "No profit recorded outside an ISA or pension this year — nothing to take tax-free. If that changes, come back before April 5th to use your £3,000 allowance."}
          </p>
        )}
      </MobileWinTile>
      )}

      <MobileWinTile number={showGains ? 2 : 1} title="Use your ISA allowance"
        headline={m.isaHeadroom > 0
          ? `${fmt(m.isaHeadroom)} remaining.`
          : "You've used your full £20,000 ISA allowance this tax year."}
        tagLabel="Future opportunity" tagColor="#2d6b4a"
        reminder={m.isaHeadroom > 0 ? {
          id: "investments-isa-allowance",
          title: buildReminderSubject(fmt(m.isaHeadroom), "Unused ISA allowance"),
          description: `${firstName(d) ? firstName(d)+", d" : "D"}on't forget to check your ISA allowance before the tax year ends. You have ${fmt(m.isaHeadroom)} of it unused — investing it shelters future growth from tax, permanently.\n\nUnused allowance doesn't carry over: it's gone after April 5th and a fresh £20,000 opens on April 6th - worth a quick check with your platform or adviser on where to put it.`,
        } : null}>
        {m.isaHeadroom > 0 ? (
          <div>
            <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,marginTop:0,marginBottom:"4px"}}>
              Invest it and shelter the growth from tax, for good.{" "}
              <InfoButton onClick={() => setOpenInfo(o => o==="isa"?null:"isa")} open={openInfo==="isa"} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",verticalAlign:"middle"}}/>
            </p>
            <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginTop:0,marginBottom:openInfo==="isa"?"10px":"12px"}}>
              Invested, that could grow to ~{fmt(Math.round(isaProjectedValue))} tax-free by 67.
            </p>
            {openInfo === "isa" && (
              <div style={{marginBottom:"12px"}}>
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
            )}
            <GoToProviderButton storageKey="candid_isa_provider_pref" defaultLabel="To my ISA"/>
          </div>
        ) : (
          <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.6}}>Nothing left to shelter this tax year — check back after April 6th for a fresh £20,000 allowance.</p>
        )}
      </MobileWinTile>

      <MobileProviderTile heading="Where to open one" products={products.products} disclaimer={products.disclaimer}/>
    </div>
  );
}
