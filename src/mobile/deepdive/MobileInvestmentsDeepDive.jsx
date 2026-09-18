import { useState } from "react";
import { Lock } from "lucide-react";
import { fmt } from "../../lib/format.js";
import { G, GOLD, WHITE, MUT, TEXT, SERIF } from "../../CandidApp.jsx";
import MobileWinTile from "../MobileWinTile.jsx";
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
        tagLabel="Today"
        reminder={m.crystallisable > 0 ? {
          id: "investments-crystallise-gains",
          title: buildReminderSubject(fmt(m.cgtSaving), "Crystallise capital gains"),
          // Informational, not directive — states the figures and points to
          // your platform/adviser for the "how", rather than instructing a
          // specific trade (avoids reading as financial advice).
          description: `${firstName(d) ? firstName(d)+", d" : "D"}on't forget to check your investment gains before the tax year ends. You have around ${fmt(totalGains)} of unrealised gain, and £3,000 of gain is CGT-exempt each year — crystallising ${fmt(m.crystallisable)} of it now is worth up to ${fmt(m.cgtSaving)}.\n\nThis needs actioning before April 5th - worth a quick check with your platform or a financial adviser on how to do this for your holdings.`,
        } : null}>
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
        tagLabel="Future opportunity" tagColor="#2d6b4a"
        reminder={m.isaHeadroom > 0 ? {
          id: "investments-isa-allowance",
          title: buildReminderSubject(fmt(m.isaHeadroom), "Unused ISA allowance"),
          description: `${firstName(d) ? firstName(d)+", d" : "D"}on't forget to check your ISA allowance before the tax year ends. You have ${fmt(m.isaHeadroom)} of it unused — investing it shelters future growth from tax, permanently.\n\nUnused allowance doesn't carry over: it's gone after April 5th and a fresh £20,000 opens on April 6th - worth a quick check with your platform or adviser on where to put it.`,
        } : null}>
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

      <PortfolioBreakdownTile/>
    </div>
  );
}
