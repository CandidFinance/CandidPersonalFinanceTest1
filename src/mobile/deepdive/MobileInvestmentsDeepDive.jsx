import { useState } from "react";
import { Lock } from "lucide-react";
import { fmt } from "../../lib/format.js";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, getModuleProducts, OPPORTUNITY_TILE_BG } from "../../CandidApp.jsx";
import MobileWinTile from "../MobileWinTile.jsx";
import MobileProviderTile from "../MobileProviderTile.jsx";
import GoToProviderButton from "../GoToProviderButton.jsx";
import PillMoneyInput from "../PillMoneyInput.jsx";
import { buildReminderSubject } from "../reminders.js";
import { firstName } from "../copy.js";

// Portfolio breakdown preview — not a real feature yet (no holdings-level
// data exists anywhere in the app: no geography/sector/asset-type split, no
// per-fund valuation or growth). Shown as an illustrative, locked mockup
// (static placeholder figures, greyed out, non-interactive, with a lock
// overlay) so the design is visible without pretending it's live — matches
// the "How do I compare to my peers?" Coming Soon tile on the Forecast tab.
function PortfolioBreakdownTile() {
  const view = "geo";
  const SEGMENTS_BY_VIEW = {
    geo: [
      { label:"UK", pct:38, color:"#2d6b4a" },
      { label:"North America", pct:32, color:GOLD },
      { label:"Europe", pct:18, color:"#8a4fae" },
      { label:"Emerging markets", pct:12, color:"#9a9a8e" },
    ],
    sector: [
      { label:"Technology", pct:28, color:"#2d6b4a" },
      { label:"Financials", pct:22, color:GOLD },
      { label:"Healthcare", pct:16, color:"#8a4fae" },
      { label:"Other", pct:34, color:"#9a9a8e" },
    ],
    asset: [
      { label:"Equities", pct:70, color:"#2d6b4a" },
      { label:"Bonds", pct:18, color:GOLD },
      { label:"Property", pct:7, color:"#8a4fae" },
      { label:"Cash", pct:5, color:"#9a9a8e" },
    ],
  };
  const holdings = [
    { name:"Vanguard FTSE Global All Cap", value:"£12,450", growth:"+8.2%" },
    { name:"iShares Core S&P 500", value:"£9,200", growth:"+11.4%" },
    { name:"Fundsmith Equity", value:"£5,100", growth:"+6.7%" },
    { name:"Cash (uninvested)", value:"£1,250", growth:"—" },
  ];
  const segments = SEGMENTS_BY_VIEW[view];
  const r = 46, cx = 60, cy = 60, circumference = 2 * Math.PI * r;
  let cumulative = 0;

  return (
    <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginTop:"16px",position:"relative",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
        <div style={{fontSize:"13px",fontWeight:600,color:G}}>Portfolio breakdown</div>
        <span style={{fontSize:"9.5px",fontWeight:700,color:GOLD,background:"rgba(196,150,58,0.15)",padding:"4px 9px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase"}}>Coming soon</span>
      </div>

      <div style={{opacity:0.4,filter:"grayscale(35%)",pointerEvents:"none"}}>
        <div style={{display:"flex",gap:"5px",background:"#ede7db",borderRadius:"100px",padding:"3px"}}>
          {[{value:"geo",label:"Geography"},{value:"sector",label:"Sector"},{value:"asset",label:"Asset type"}].map(o => (
            <div key={o.value} style={{flex:1,textAlign:"center",padding:"7px 0",borderRadius:"100px",background:view===o.value?G:"transparent",color:view===o.value?WHITE:MUT,fontSize:"11.5px",fontWeight:600}}>{o.label}</div>
          ))}
        </div>

        <div style={{display:"flex",justifyContent:"center",marginTop:"20px"}}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            {segments.map((seg,i) => {
              const dash = (seg.pct/100) * circumference;
              const el = (
                <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="16"
                  strokeDasharray={`${dash} ${circumference-dash}`} strokeDashoffset={-cumulative}
                  transform={`rotate(-90 ${cx} ${cy})`}/>
              );
              cumulative += dash;
              return el;
            })}
          </svg>
        </div>

        <div style={{display:"flex",flexWrap:"wrap",gap:"10px",justifyContent:"center",marginTop:"14px"}}>
          {segments.map((seg,i) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:"5px"}}>
              <span style={{width:"8px",height:"8px",borderRadius:"50%",background:seg.color,display:"inline-block"}}/>
              <span style={{fontSize:"11px",color:TEXT}}>{seg.label} {seg.pct}%</span>
            </div>
          ))}
        </div>

        <div style={{marginTop:"18px"}}>
          {holdings.map((h,i) => (
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid rgba(22,47,36,0.06)"}}>
              <span style={{fontSize:"13px",color:TEXT}}>{h.name}</span>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:SERIF,fontSize:"14px",fontWeight:700,color:G}}>{h.value}</div>
                <div style={{fontSize:"11px",color:"#2d6b4a"}}>{h.growth}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"10px",background:"rgba(246,240,230,0.6)",padding:"0 30px",textAlign:"center"}}>
        <div style={{width:"42px",height:"42px",borderRadius:"50%",background:WHITE,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 10px rgba(22,47,36,0.15)"}}>
          <Lock size={18} color={G}/>
        </div>
        <p style={{fontSize:"12.5px",color:G,fontWeight:600,lineHeight:1.5,margin:0}}>Connect your investment accounts to see a full breakdown by geography, sector and asset type</p>
      </div>
    </div>
  );
}

// Trimmed mobile version of desktop's Investments deep dive (ModuleDeepDive,
// moduleKey==="investments" — CandidApp.jsx). Keeps both wins (crystallise
// CGT-exempt gains, use unused ISA allowance) with the same numbers, using
// tap-to-reveal "?" bubbles for the two explainer asides (Bed & breakfasting,
// Use it or lose it) instead of desktop's always-visible MiniExpandTiles.
// Drops the ISA compound-growth line chart and live ISA-provider product
// cards for this v1 — same trim rationale as Cash/Student Loan (no
// savingsRates wired into the mobile route yet, and inline charts need
// mobile-specific redesign, not a direct port).
export default function MobileInvestmentsDeepDive({ d, m, statuses, onRecordCrystallisedGain }) {
  const [openInfo, setOpenInfo] = useState(null); // "bnb" | "useit" | "isa" | null
  const [loggingGain, setLoggingGain] = useState(false);
  const [amountSoldInput, setAmountSoldInput] = useState(null);
  const [gainInput, setGainInput] = useState(null);
  const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT, padding:"5px 0" };
  const infoBtnStyle = { background:"#a8a89c", color:WHITE, border:"none", borderRadius:"50%", width:"15px", height:"15px", fontSize:"10px", fontWeight:700, lineHeight:"15px", textAlign:"center", padding:0, cursor:"pointer", flexShrink:0 };

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

  return (
    <div>
      {(m.isaHeadroom > 0 || m.crystallisable > 0) && (
        <div style={{background:OPPORTUNITY_TILE_BG,borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
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
        headline={m.crystallisable > 0
          ? (m.remainingCgtAllowance >= 3000
              ? "Your full £3,000 CGT allowance is available this year."
              : `You have ${fmt(m.remainingCgtAllowance)} of your £3,000 CGT allowance left this year.`)
          : "No unrealised gains to crystallise this tax year."}
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
              <div style={rowStyle}><span>Total unrealised gain</span><span style={{fontWeight:600}}>{fmt(totalGains)}</span></div>
              <div style={rowStyle}><span>Less: allowance available</span><span>−{fmt(m.crystallisable)}</span></div>
              <div style={{...rowStyle,borderTop:"1px solid rgba(22,47,36,0.1)",fontWeight:600}}><span>Taxable surplus</span><span>{fmt(taxableSurplus)}</span></div>
              <div style={{...rowStyle,fontWeight:700,color:instantSellTax>0?"#c0392b":G}}><span>Instant-sell tax bill ({cgtRatePct}%)</span><span>{fmt(instantSellTax)}</span></div>
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
                    <div style={{fontSize:"9.5px",fontWeight:700,color:"#8a6a24",letterSpacing:"0.04em",textTransform:"uppercase",marginBottom:"6px"}}>Spread over {spreadYears.length} tax yrs · optimal</div>
                    <div style={{fontFamily:SERIF,fontSize:"17px",fontWeight:700,color:G}}>{fmt(0)}</div>
                    <div style={{fontSize:"10.5px",color:"#8a6a24",fontWeight:600,marginTop:"2px"}}>Saves {fmt(instantSellTax)}</div>
                  </div>
                </div>
                <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,marginBottom:"12px"}}>Spread plan: {spreadTimingLabel}.</p>
              </>
            ) : (
              <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,marginBottom:"12px"}}>Fully shielded by this year's allowance — no CGT due either way.</p>
            )}

            <GoToProviderButton storageKey="candid_gia_provider_pref" defaultLabel={`Bank ${fmt(m.crystallisable)} tax-free now`}/>

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
                    The £3,000 exemption doesn't carry over — whatever's unused is gone on April 5th.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.6}}>
            {m.remainingCgtAllowance === 0
              ? "You've used your full £3,000 CGT allowance this tax year — further gains outside an ISA or pension will be taxed at your marginal rate."
              : "No unrealised gains recorded outside an ISA or pension this year — nothing to crystallise. If that changes, come back before April 5th to use your £3,000 exempt amount."}
          </p>
        )}
      </MobileWinTile>

      <MobileWinTile number={2} title="Utilise unused ISA allowance"
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
              <button onClick={() => setOpenInfo(o => o==="isa"?null:"isa")} style={{...infoBtnStyle,display:"inline-flex",alignItems:"center",justifyContent:"center",verticalAlign:"middle"}}>?</button>
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

      <PortfolioBreakdownTile/>
    </div>
  );
}
