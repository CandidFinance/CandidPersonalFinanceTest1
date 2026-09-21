import { useState } from "react";
import { AlertTriangle, PartyPopper, Banknote, Lock } from "lucide-react";
import {
  isPensionContributing,
  calcPensionTaperSaving, calcAnnualAllowanceTaper,
  calcCarryForward, defaultCarryForwardYears, calcBonusSacrifice, calcPensionGrowthTrajectory,
} from "../../lib/pension.js";
import { fmt, fmtK, fmtCompact } from "../../lib/format.js";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, PillSlider, getModuleProducts, OPPORTUNITY_TILE_BG } from "../../CandidApp.jsx";
import MobileWinTile from "../MobileWinTile.jsx";
import MobileProviderTile from "../MobileProviderTile.jsx";
import PillMoneyInput from "../PillMoneyInput.jsx";
import { buildReminderSubject } from "../reminders.js";
import { firstName } from "../copy.js";

const SACRIFICE_OPTIONS = [0,25,50,75,100].map(p => ({ value:p, label:`${p}%` }));
const EXTRA_PCT_OPTIONS = [1,2,3,5].map(p => ({ value:p, label:`+${p}%` }));

// Full mobile version of desktop's Pension deep dive (ModuleDeepDive,
// moduleKey==="pension" — CandidApp.jsx): the two core wins (employer match,
// Personal Allowance taper recovery), the interactive 3-year carry-forward
// table, the full bonus-sacrifice calculator (slider, tax/NI/SL breakdown,
// future-value comparison), and the growth-trajectory tile (stats, "what if
// you contributed more" stepper, earliest-retirement estimate, Lump Sum
// Allowance flag). The growth chart itself is redesigned as horizontal
// progress bars rather than a ported vertical-bar SVG — 3–5 vertical columns
// each needing their own label underneath doesn't fit a narrow screen the
// way desktop's wide canvas allows; a horizontal bar list is the mobile-
// native equivalent, not a shrunk copy.
function YearToggle({ value, onChange }) {
  return (
    <div style={{display:"flex",gap:"6px"}}>
      {[{v:true,label:"Had a scheme"},{v:false,label:"No scheme"}].map(opt => (
        <button key={String(opt.v)} onClick={() => onChange(opt.v)} style={{
          border:"none",borderRadius:"100px",padding:"6px 12px",fontSize:"11.5px",fontWeight:600,cursor:"pointer",
          background:value===opt.v?G:"#ede7db",color:value===opt.v?WHITE:MUT,
        }}>{opt.label}</button>
      ))}
    </div>
  );
}

export default function MobilePensionDeepDive({ d, m }) {
  const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT, padding:"5px 0" };
  const infoBtnStyle = { background:"#a8a89c", color:WHITE, border:"none", borderRadius:"50%", width:"15px", height:"15px", fontSize:"10px", fontWeight:700, lineHeight:"15px", textAlign:"center", padding:0, cursor:"pointer", flexShrink:0 };
  const [cfYears, setCfYears] = useState(defaultCarryForwardYears());
  const [bonusInput, setBonusInput] = useState(+d.bonusAmount || null);
  const [sacrificePct, setSacrificePct] = useState(100);
  const [extraPct, setExtraPct] = useState(1);
  const [showFVInfo, setShowFVInfo] = useState(false);

  if (m.pensionStatus === "unknown") {
    return <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.6}}>You told us you're not sure about your pension situation — find out your contribution rate and employer match, then come back to see your options here.</p>;
  }

  const contributing = isPensionContributing(d);
  const trPct = Math.round(m.tr * 100);
  const myPct = +d.myContribution || 0;
  const empCapPct = +d.employerMatch || 0;
  const showMatchWin = !contributing || m.missedMatch > 0;
  const matchWinTitle = !contributing ? "Start your pension" : "Capture full employer match";
  const matchWinHeadline = !contributing
    ? `Every £${100-trPct} becomes £100 with ${trPct}% tax relief${empCapPct > 0 ? ` — plus an unclaimed ${empCapPct}% employer match` : ""}`
    : `Up to ${fmt(m.missedMatch)}/yr`;

  const yourContribAmount = m.salary * myPct / 100;
  const employerCapAmount = m.salary * empCapPct / 100;
  const illustrativeRate = empCapPct > 0 ? empCapPct : 5;
  const illustrativeAmount = m.salary * illustrativeRate / 100;
  const illustrativeRelief = Math.round(illustrativeAmount * m.tr);
  const illustrativeNetCost = Math.round(illustrativeAmount - illustrativeRelief);

  const taper = calcPensionTaperSaving(m);
  const showSacrificeCalc = m.adjustedNetIncome >= 80000 && m.adjustedNetIncome <= 125140;

  const aa = calcAnnualAllowanceTaper(d, m);
  const cf = calcCarryForward(d, m, aa.approxAA, cfYears);

  const hasStatedBonus = (+d.bonusAmount||0) > 0;
  const bonusPotential = hasStatedBonus ? Math.round((+d.bonusAmount||0) * m.tr) : 0;
  const bs = calcBonusSacrifice(d, m, bonusInput, sacrificePct);

  const traj = calcPensionGrowthTrajectory(d, m, extraPct);
  const products = getModuleProducts("pension", d, m);

  // Salary Sacrifice Tax Saver (folded into the existing £100k-taper win
  // below, rather than a separate tile) — a flexible "what if you tried a
  // custom %" exploration alongside that tile's exact "sacrifice this much
  // to fully escape the taper" figure. Reuses extraPct so it stays in sync
  // with the growth-trajectory stepper further down the page.
  const isSalarySacrifice = d.pensionType === "sacrifice";
  const niSavingPct = isSalarySacrifice && m.salary > 50270 ? 2 : 0;
  const totalReliefPct = trPct + niSavingPct;
  const illustrativeExtraAmt = m.salary * extraPct / 100;
  const illustrativeExtraRelief = Math.round(illustrativeExtraAmt * (m.tr + niSavingPct/100));
  const illustrativeExtraNetCost = Math.round(illustrativeExtraAmt - illustrativeExtraRelief);
  const newAdjustedIncome = Math.max(0, m.adjustedNetIncome - illustrativeExtraAmt);
  const newBandLabel = newAdjustedIncome > 125140 ? "additional" : newAdjustedIncome > 50270 ? "higher" : "basic";
  // Personal Savings Allowance — a band fact, not something £100k itself
  // changes (it shifts at £50,270 and £125,140, not £100k), so it's shown
  // as context in this tile rather than as a consequence of the taper.
  const psaAmount = m.taxBandLabel === "additional" ? 0 : m.taxBandLabel === "higher" ? 500 : 1000;

  const opportunityCols = [];
  if (!contributing) opportunityCols.push({ label:"Tax relief foregone", value: fmtCompact(Math.round(m.salary*0.05*m.tr)) });
  else if (m.missedMatch > 0) opportunityCols.push({ label:"Missed employer match", value: fmtCompact(m.missedMatch) });
  if (taper.inTaper && taper.taperTotalSaving > 0) opportunityCols.push({ label:"Personal Allowance recoverable", value: fmtCompact(taper.taperTotalSaving) });

  let winCounter = 0;
  const win1Num = showMatchWin ? ++winCounter : null;
  const win2Num = showSacrificeCalc ? ++winCounter : null;
  const win3Num = cf.showCarryForward ? ++winCounter : null;
  const win4Num = ++winCounter; // bonus-sacrifice win always rendered (calculator or prompt)

  return (
    <div>
      {opportunityCols.length > 0 && (
        <div style={{background:OPPORTUNITY_TILE_BG,borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
          <div style={{fontSize:"10px",fontWeight:800,color:"#8a6a24",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Opportunity</div>
          <div style={{display:"flex",gap:"22px",flexWrap:"wrap"}}>
            {opportunityCols.map((c,i) => (
              <div key={i}>
                <div style={{fontFamily:SERIF,fontSize:"32px",color:TEXT,fontWeight:700,lineHeight:1.1}}>{c.value}</div>
                <div style={{fontSize:"12px",color:"#8a6a24",marginTop:"4px",fontWeight:600}}>{c.label}</div>
              </div>
            ))}
          </div>
          {hasStatedBonus && (
            <div style={{fontSize:"12px",color:TEXT,lineHeight:1.5,marginTop:"10px"}}>
              Plus up to {fmt(bonusPotential)} potential from sacrificing your full bonus — see below.
            </div>
          )}
        </div>
      )}

      {showMatchWin && (
        <MobileWinTile number={win1Num} title={matchWinTitle} headline={matchWinHeadline} tagLabel="Today"
          reminder={empCapPct > 0 ? {
            id: "pension-employer-match",
            title: buildReminderSubject(`${fmt(m.missedMatch)}/yr`, "Pension employer match"),
            // Informational, not directive — states what the numbers show and
            // leaves the decision and the "how" to HR/payroll, rather than
            // instructing the person to act (avoids reading as financial advice).
            description: contributing
              ? `${firstName(d) ? firstName(d)+", d" : "D"}on't forget to check your employer's pension match. Based on your salary (${fmt(m.salary)}), increasing your contribution from ${myPct}% to ${empCapPct}% is worth ${fmt(m.missedMatch)}/yr.\n\nDrop HR or Payroll an email to ask how to update your contribution rate - it will likely take effect from next month.`
              : `${firstName(d) ? firstName(d)+", d" : "D"}on't forget to check your employer's pension match. Based on your salary (${fmt(m.salary)}), contributing at least ${empCapPct}% would unlock your employer's full match — worth ${fmt(m.missedMatch)}/yr, on top of ${trPct}% tax relief.\n\nDrop HR or Payroll an email to ask how to set this up - it will likely take effect from next month.`,
          } : null}>
          <p style={{fontSize:"13.5px",color:TEXT,lineHeight:1.6,marginBottom:"10px"}}>
            {!contributing
              ? `You're not currently contributing. Pension contributions get ${trPct}% tax relief automatically${empCapPct > 0 ? `, and your employer will match up to ${empCapPct}% of salary if you contribute at least that much` : ""} — money you're leaving unclaimed.`
              : `You're contributing but not capturing the full match. Increasing to ${empCapPct}% claims the rest — free money from your employer, on top of your own ${trPct}% tax relief.`}
          </p>
          {contributing ? (
            <div>
              <div style={rowStyle}><span>Your contribution — {myPct}% of salary</span><span style={{fontWeight:600}}>{fmt(yourContribAmount)}/yr</span></div>
              <div style={rowStyle}><span>Employer match cap — {empCapPct}% of salary</span><span style={{fontWeight:600}}>{fmt(employerCapAmount)}/yr</span></div>
              <div style={{height:"1px",background:"rgba(22,47,36,0.1)",margin:"6px 0"}}/>
              <div style={{...rowStyle,fontWeight:700,color:"#2d6b4a"}}><span>Uplift if you match the cap</span><span>+{fmt(m.missedMatch)}/yr</span></div>
            </div>
          ) : (
            <div>
              <div style={rowStyle}><span>Contribute {illustrativeRate}% of salary</span><span style={{fontWeight:600}}>{fmt(illustrativeAmount)}/yr</span></div>
              <div style={rowStyle}><span>Tax relief at {trPct}%</span><span>−{fmt(illustrativeRelief)}/yr</span></div>
              {empCapPct > 0 && (
                <div style={{...rowStyle,color:"#2d6b4a"}}><span>Employer matches {empCapPct}%</span><span style={{fontWeight:600}}>+{fmt(employerCapAmount)}/yr</span></div>
              )}
              <div style={{height:"1px",background:"rgba(22,47,36,0.1)",margin:"6px 0"}}/>
              <div style={{...rowStyle,fontWeight:700}}><span>Net cost to you</span><span>{fmt(illustrativeNetCost)}/yr</span></div>
              <div style={{...rowStyle,fontWeight:700,color:"#2d6b4a"}}><span>Goes into your pension</span><span>{fmt(illustrativeAmount + (empCapPct>0?employerCapAmount:0))}/yr</span></div>
            </div>
          )}
        </MobileWinTile>
      )}

      {showSacrificeCalc && (
        <MobileWinTile number={win2Num}
          title="Salary sacrifice tax saver"
          headline={taper.inTaper
            ? `Sacrificing ${fmt(taper.taperSacrificeNeeded)} recovers your full Personal Allowance — worth ~${fmt(taper.taperTotalSaving)}`
            : `You're ${fmt(Math.max(0, taper.taperStart - taper.ani))} below the £100k taper — sacrifice now to stay ahead of it`}
          tagLabel="Today">
          <p style={{fontSize:"13.5px",color:TEXT,lineHeight:1.6,marginBottom:taper.inTaper&&taper.taperTotalSaving>0?"12px":0}}>
            {taper.inTaper
              ? `Between £100k–£125,140 you lose £1 of Personal Allowance for every £2 earned — an effective 60% tax rate. Salary sacrifice restores it, saving roughly ${fmt(taper.taperTotalSaving)} in tax and NI.`
              : `Your income sits in the £80k–£100k zone. Sacrificing now builds wealth efficiently — and softens the taper if a bonus or rise pushes you over £100k later.`}
          </p>
          {taper.inTaper && taper.taperTotalSaving > 0 && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginBottom:"10px",textAlign:"center"}}>
              <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"8px",padding:"10px 6px"}}>
                <div style={{fontFamily:SERIF,fontSize:"16px",color:G,fontWeight:700}}>{fmt(taper.taperSacrificeNeeded)}</div>
                <div style={{fontSize:"10px",color:MUT,marginTop:"2px"}}>sacrifice needed</div>
              </div>
              <div style={{background:"rgba(45,107,74,0.08)",borderRadius:"8px",padding:"10px 6px"}}>
                <div style={{fontFamily:SERIF,fontSize:"16px",color:"#2d6b4a",fontWeight:700}}>{fmt(taper.taperTaxSaving)}</div>
                <div style={{fontSize:"10px",color:MUT,marginTop:"2px"}}>tax saved</div>
              </div>
              <div style={{background:"rgba(196,150,58,0.18)",borderRadius:"8px",padding:"10px 6px"}}>
                <div style={{fontFamily:SERIF,fontSize:"16px",color:G,fontWeight:700}}>{fmt(taper.taperTotalSaving)}</div>
                <div style={{fontSize:"10px",color:G,marginTop:"2px",fontWeight:600}}>total saving</div>
              </div>
            </div>
          )}
          {d.hasKids === "yes" && (
            <div style={{background:"rgba(192,57,43,0.05)",border:"1px solid rgba(192,57,43,0.18)",borderRadius:"10px",padding:"12px 14px",marginBottom:"8px"}}>
              <div style={{fontSize:"10.5px",fontWeight:700,color:"#c0392b",letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:"6px"}}>Also at stake: your childcare support</div>
              <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.6,margin:0}}>
                Tax-Free Childcare and free childcare hours are lost entirely — not tapered — the moment either parent crosses £100,000. Staying under it can be worth £5,000–£7,500 per child a year.
              </p>
            </div>
          )}
          <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"10px 12px",marginBottom:"12px"}}>
            <p style={{fontSize:"12px",color:MUT,lineHeight:1.6,margin:0}}>
              Your Personal Savings Allowance is {psaAmount>0?fmt(psaAmount):"£0"} as a {m.taxBandLabel}-rate taxpayer{psaAmount>0?" — savings interest above that is taxed at your marginal rate":""}. This doesn't move within the £100k–£125,140 taper zone itself — it only shrinks further if you cross into additional-rate above £125,140, or would recover to £1,000 if sacrifice took you all the way back under £50,270.
            </p>
          </div>

          <div style={{background:"rgba(22,47,36,0.03)",border:"1px solid rgba(22,47,36,0.12)",borderRadius:"10px",padding:"12px 14px"}}>
            <div style={{fontSize:"10px",fontWeight:700,color:G,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:"8px"}}>Or try your own amount — sacrifice an extra {extraPct}% of salary</div>
            <div style={rowStyle}><span>Comes off your taxable income</span><span style={{fontWeight:600}}>−{fmt(Math.round(illustrativeExtraAmt))}</span></div>
            <div style={rowStyle}><span>Tax{niSavingPct>0?" + NI":""} relief at {totalReliefPct}%</span><span>−{fmt(illustrativeExtraRelief)}</span></div>
            <div style={{...rowStyle,fontWeight:700}}><span>Net cost to your take-home</span><span>{fmt(illustrativeExtraNetCost)}</span></div>
          </div>
          <p style={{fontSize:"12px",color:MUT,lineHeight:1.55,marginTop:"10px",marginBottom:0}}>
            That leaves your taxable income at ~{fmt(Math.round(newAdjustedIncome))}
            {newBandLabel !== m.taxBandLabel ? `, dropping you into the ${newBandLabel}-rate band.` : `, still within the ${m.taxBandLabel}-rate band.`} Use the "What if you contributed more?" stepper further down to try a different percentage.
          </p>
        </MobileWinTile>
      )}

      {aa.inAATaper && (
        <div style={{borderLeft:`4px solid ${G}`,background:"rgba(22,47,36,0.04)",borderRadius:"0 10px 10px 0",padding:"14px 16px",marginBottom:"16px"}}>
          <div style={{fontSize:"10px",fontWeight:700,color:G,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"6px"}}>Worth knowing</div>
          <p style={{fontSize:"13px",color:G,lineHeight:1.6,margin:"0 0 6px",fontWeight:600}}>
            Your Annual Allowance may be reduced to approximately {fmt(aa.approxAA)} this tax year (down from £60,000).
          </p>
          <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.6,margin:0}}>
            Once adjusted income passes £260,000, your allowance shrinks £1 for every £2 above that, down to a £10,000 floor.{" "}
            {cf.showCarryForward
              ? "Carry forward unused allowance from the last 3 tax years to contribute more without a charge — use the calculator below."
              : "Carry forward unused allowance from the last 3 tax years to contribute more without a charge — check your provider's statements or HMRC account for an exact figure."}
          </p>
        </div>
      )}

      {cf.showCarryForward && (
        <MobileWinTile number={win3Num} title="Carry forward unused allowance"
          headline={cf.cfTotalUnused > 0
            ? `Up to ${fmt(cf.cfMaxContributable)} could go into your pension this tax year using carry forward`
            : "Fill in your last 3 tax years below to see how much you could inject in one go"}
          tagLabel="Today">
          <p style={{fontSize:"13px",color:TEXT,lineHeight:1.6,marginBottom:"12px"}}>
            Had a scheme in earlier years but didn't use the full £60,000 allowance? Carry the unused part forward for up to 3 years. Capped at 100% of this year's earnings ({fmt(cf.cfRelevantEarnings)}).
          </p>
          {cf.cfBreakdown.map((y, i) => (
            <div key={y.label} style={{background:"#ede7db",borderRadius:"10px",padding:"10px 12px",marginBottom:"8px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
                <div style={{fontSize:"12px",fontWeight:700,color:G}}>{y.label}</div>
                <YearToggle value={y.hadScheme} onChange={v => setCfYears(prev => prev.map((yy,idx) => idx===i ? {...yy, hadScheme:v} : yy))}/>
              </div>
              {y.hadScheme && (
                <div style={{marginTop:"8px",display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
                  <label style={{fontSize:"11.5px",color:MUT,flexShrink:0}}>Contributed (£)</label>
                  <input type="number" value={y.contribution} placeholder="0"
                    onChange={e => { const v = e.target.value; setCfYears(prev => prev.map((yy,idx) => idx===i ? {...yy, contribution:v} : yy)); }}
                    style={{width:"90px",padding:"5px 8px",fontSize:"12.5px",border:"1.5px solid rgba(22,47,36,0.18)",borderRadius:"6px",background:WHITE}}/>
                  <span style={{fontSize:"11.5px",color:"#2d6b4a",fontWeight:600}}>{fmt(y.unused)} unused</span>
                </div>
              )}
            </div>
          ))}
          <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"12px 14px",marginTop:"4px"}}>
            <div style={rowStyle}><span>This year's allowance{aa.inAATaper?" (tapered)":""}</span><span>{fmt(aa.approxAA)}</span></div>
            <div style={rowStyle}><span>+ Unused from last 3 years</span><span>{fmt(cf.cfTotalUnused)}</span></div>
            <div style={{...rowStyle,fontWeight:700}}><span>Theoretical maximum</span><span>{fmt(cf.cfTheoreticalMax)}</span></div>
            {cf.cfEarningsCapped && (
              <div style={{...rowStyle,color:"#c0392b",marginTop:"4px"}}>
                <span>Capped at 100% of earnings</span><span style={{fontWeight:700}}>{fmt(cf.cfMaxContributable)}</span>
              </div>
            )}
          </div>
          {aa.showVctEis && (
            <div style={{background:"rgba(196,150,58,0.08)",border:"1px solid rgba(196,150,58,0.3)",borderRadius:"10px",padding:"14px 16px",marginTop:"12px"}}>
              <div style={{fontSize:"10.5px",fontWeight:700,color:G,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"8px"}}>If pension contributions alone can't fix this</div>
              <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.6,margin:0}}>
                Even with carry forward, getting Threshold Income below £200,000 through pension contributions alone may not be realistic here. VCTs and EIS are the usual alternative — both give 30% upfront income tax relief, with far more risk and illiquidity. Speak to an FCA-regulated adviser before investing.
              </p>
            </div>
          )}
        </MobileWinTile>
      )}

      {hasStatedBonus ? (
        <MobileWinTile number={win4Num} title="Model bonus sacrifice"
          headline={`Sacrificing your ${fmt(+d.bonusAmount)} bonus could save up to ${fmt(bonusPotential)} in tax`}
          tagLabel="Today"
          reminder={bonusPotential > 0 ? {
            id: "pension-bonus-sacrifice",
            title: buildReminderSubject(fmt(bonusPotential), "Bonus sacrifice"),
            // Informational, not directive — states the figures and the action
            // needed (an email to HR/Payroll) rather than instructing the
            // person to sacrifice their bonus, avoiding reading as advice.
            description: `${firstName(d) ? firstName(d)+", d" : "D"}on't forget to check whether you can sacrifice your bonus into your pension before it's paid. Based on your bonus (${fmt(+d.bonusAmount)}), sacrificing it could save up to ${fmt(bonusPotential)} in tax and National Insurance.\n\nDrop HR or Payroll an email to ask about bonus sacrifice - this needs actioning before your bonus is paid, as it usually can't be done retrospectively.`,
          } : null}>
          <p style={{fontSize:"13px",color:MUT,lineHeight:1.6,marginBottom:"14px"}}>
            Sacrifice your bonus before it hits your payslip and you avoid tax, NI{bs.bonusSlRate > 0 ? ", and student loan repayments" : ""} on it entirely. It goes into your pension gross and grows tax-free.
          </p>

          <div style={{marginBottom:"14px"}}>
            <label style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>How much to sacrifice</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 92px",gap:"8px",marginTop:"8px",alignItems:"stretch"}}>
              <PillSlider value={sacrificePct} onChange={setSacrificePct} options={SACRIFICE_OPTIONS}/>
              <PillMoneyInput label="Bonus" value={bonusInput} onChange={setBonusInput}/>
            </div>
          </div>

          {(bs.crossesTaper || bs.crossesAR) && (
            <div style={{background:"rgba(192,57,43,0.05)",border:"1px solid rgba(192,57,43,0.2)",borderRadius:"8px",padding:"8px 10px",marginBottom:"14px",display:"flex",gap:"8px",alignItems:"flex-start"}}>
              <AlertTriangle size={13} style={{flexShrink:0,marginTop:"2px"}} color="#c0392b"/>
              <div style={{fontSize:"11.5px",color:MUT,lineHeight:1.5}}>
                {bs.crossesTaper && !bs.crossesAR ? "Your bonus crosses the 60% taper zone (£100k–£125,140)." : "Your bonus spans the 40% → 60% taper → 45% rate bands."} Sacrificing the portion in that zone is especially valuable.
              </div>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"10px"}}>
            <div style={{background:"rgba(45,107,74,0.06)",border:"1px solid rgba(45,107,74,0.22)",borderRadius:"8px",padding:"10px 10px"}}>
              <div style={{fontSize:"8.5px",fontWeight:700,color:"#2d6b4a",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>You receive</div>
              <div style={{fontFamily:SERIF,fontSize:"15px",color:G,fontWeight:700,marginBottom:"4px"}}>{fmt(bs.totalReceived)}</div>
              <div style={{fontSize:"10.5px",color:MUT,display:"flex",flexDirection:"column",gap:"2px"}}>
                {bs.sacrificedAmt > 0 && <span style={{color:"#2d6b4a",fontWeight:500}}>Pension: {fmt(bs.sacrificedAmt)}</span>}
                {bs.takeHomeCash > 0 && <span>Cash: {fmt(bs.takeHomeCash)}</span>}
                {bs.employerNISave > 0 && <span style={{color:"#2d6b4a",marginTop:"2px"}}>+{fmt(bs.employerNISave)} employer NI*</span>}
              </div>
            </div>
            <div style={{background:"rgba(192,57,43,0.05)",border:"1px solid rgba(192,57,43,0.18)",borderRadius:"8px",padding:"10px 10px"}}>
              <div style={{fontSize:"8.5px",fontWeight:700,color:"#c0392b",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Paid to HMRC{bs.bonusSlRate>0?" + SLC":""}</div>
              <div style={{fontFamily:SERIF,fontSize:"15px",color:TEXT,fontWeight:700,marginBottom:"4px"}}>{sacrificePct===100?fmt(0):fmt(bs.totalDeducted)}</div>
              <div style={{fontSize:"10.5px",color:MUT,display:"flex",flexDirection:"column",gap:"2px"}}>
                {sacrificePct===100
                  ? <span style={{color:"#2d6b4a",fontWeight:600,display:"flex",alignItems:"center",gap:"4px"}}>Nothing <PartyPopper size={11}/></span>
                  : <>{bs.taxOnCash>0 && <span>Tax: {fmt(bs.taxOnCash)}</span>}{bs.niOnCash>0 && <span>NI: {fmt(bs.niOnCash)}</span>}{bs.slOnCash>0 && <span>Student loan: {fmt(bs.slOnCash)}</span>}</>}
              </div>
            </div>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
            <span style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5}}>
              <b style={{fontFamily:SERIF}}>{fmtCompact(bs.bonusFVpartial(sacrificePct))}</b> at retirement (age {bs.retireAge})
            </span>
            <button onClick={() => setShowFVInfo(o => !o)} style={infoBtnStyle}>?</button>
          </div>
          {showFVInfo && (
            <p style={{fontSize:"12px",color:MUT,lineHeight:1.55,background:"#ede7db",borderRadius:"8px",padding:"8px 10px",marginTop:"6px"}}>
              Assumes this amount is left untouched in your pension and grows at 6% p.a. until retirement.
              {bs.bonusSlRate > 0 && bs.loanBal > 0 && (m.willClear
                ? ` The ${fmt(bs.slRepaymentFromBonus)} student loan deduction on the cash portion also brings your clear date forward, saving roughly ${fmt(bs.slInterestSaved)} in interest.`
                : ` Your loan is unlikely to clear before write-off, so the ${fmt(bs.slRepaymentFromBonus)} student loan deduction on the cash portion would likely be written off anyway.`)}
              {" "}Employer NI of 13.8% on the sacrificed amount is also saved — some employers pass this on.
            </p>
          )}
        </MobileWinTile>
      ) : (
        <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
          <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"6px",display:"flex",alignItems:"center",gap:"6px"}}><Banknote size={15}/>Getting a bonus? Sacrifice it before it's paid</div>
          <p style={{fontSize:"13px",color:MUT,lineHeight:1.6,margin:0}}>
            Sacrificing a bonus into your pension before it hits your payslip means you never pay tax or NI on it. If you're expecting one this year, update your inputs to model it here.
          </p>
        </div>
      )}

      {traj.showTrajectory && (() => {
        const maxBar = Math.max(...traj.bars.map(b => b.value), 1);
        const barColors = { now:"rgba(196,150,58,0.5)", retirement:GOLD, optimised:"#2d6b4a", bonus:"rgba(45,107,74,0.7)", extra:"#8a4fae" };
        // Short labels for narrow mobile columns — the bars themselves are a
        // cumulative staircase (see calcPensionGrowthTrajectory), so each
        // label after "Optimised" is a running "+lever" on top of the last,
        // not an independent scenario.
        const shortLabel = {
          now: "Now",
          retirement: `Retire (${traj.retireAge})`,
          optimised: `Optimised (+${traj.matchCapIncreasePct}%)`,
          bonus: "+ Bonus",
          extra: `+ ${extraPct}%`,
        };
        return (
          <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px"}}>
            <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"14px"}}>Pension growth trajectory</div>
            <div style={{display:"flex",alignItems:"stretch",justifyContent:"space-between",gap:"4px",height:"150px"}}>
              {traj.bars.map(bar => {
                const uplift = bar.key !== "retirement" ? bar.value - traj.currentPot : 0;
                return (
                  <div key={bar.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:"100%"}}>
                    {/* Fixed-height label area (whether or not the uplift badge renders) so
                        it never eats into the bar's own space below — otherwise columns with
                        a badge got a shorter effective track and drew a shorter bar even when
                        their value was higher. */}
                    <div style={{height:"36px",flexShrink:0,display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center"}}>
                      {uplift > 0 && (
                        <div style={{fontSize:"9px",fontWeight:700,color:"#2d6b4a",background:"rgba(45,107,74,0.12)",borderRadius:"100px",padding:"1px 6px",whiteSpace:"nowrap",marginBottom:"3px"}}>+{fmtK(uplift)}</div>
                      )}
                      <div style={{fontSize:"13px",fontWeight:700,fontFamily:SERIF,color:TEXT,whiteSpace:"nowrap"}}>{fmtK(bar.value)}</div>
                    </div>
                    <div style={{flex:1,width:"100%",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
                      <div style={{width:"100%",maxWidth:"52px",borderRadius:"5px 5px 0 0",background:barColors[bar.key]||G,height:`${Math.max(3,(bar.value/maxBar)*100)}%`}}/>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",gap:"4px",marginTop:"6px"}}>
              {traj.bars.map(bar => (
                <div key={bar.key} style={{flex:1,textAlign:"center",fontSize:"9.5px",color:MUT,lineHeight:1.25}}>{shortLabel[bar.key] || bar.label}</div>
              ))}
            </div>

            {+d.niYears > 0 && (
              <p style={{fontSize:"12px",color:TEXT,lineHeight:1.6,marginTop:"14px"}}>
                State pension estimate: <b style={{fontFamily:SERIF}}>{fmt(m.statePensionAnnual)}/yr</b>, based on your recorded National Insurance years.
              </p>
            )}

            <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.6,marginTop:"10px"}}>
              Based on 6% annual growth over {traj.years} year{traj.years!==1?"s":""} to age {traj.retireAge}. Contributions shown in today's money.
            </p>

            <div style={{marginTop:"14px"}}>
              <div style={{fontSize:"9.5px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"6px"}}>What if you contributed more?</div>
              <PillSlider value={extraPct} onChange={setExtraPct} options={EXTRA_PCT_OPTIONS}/>
              <p style={{fontSize:"11px",color:MUT,lineHeight:1.5,marginTop:"8px",marginBottom:0}}>
                An extra {extraPct}% of salary grows to {fmt(traj.withExtraPot - Math.round(traj.hasBonus ? traj.withBonusPot : traj.optimisedPot))} on top{(traj.hasMissedMatch || traj.hasBonus) ? " of your optimised/bonus scenario" : " of your projected pot"} by retirement.
              </p>
            </div>

            {traj.showLsaFlag && (
              <div style={{marginTop:"10px",fontSize:"11.5px",color:MUT,lineHeight:1.5}}>
                {traj.alreadyPastLsa
                  ? `Your pot is already above the ${fmt(traj.LSA_INFLECTION_POT)} Lump Sum Allowance inflection point — further growth doesn't add to your tax-free withdrawal amount, which stays fixed at £268,275.`
                  : `Your pot is projected to cross the ${fmt(traj.LSA_INFLECTION_POT)} Lump Sum Allowance inflection point around age ${traj.lsaCrossAge} — beyond that, further growth doesn't add to your tax-free withdrawal amount.`}
              </div>
            )}
          </div>
        );
      })()}

      <div style={{background:"rgba(255,255,255,0.55)",borderRadius:"14px",border:"1.5px dashed rgba(22,47,36,0.15)",padding:"18px",display:"flex",alignItems:"flex-start",gap:"14px",marginTop:"16px"}}>
        <div style={{width:"38px",height:"38px",borderRadius:"10px",background:"rgba(22,47,36,0.05)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Lock size={16} color={MUT}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}}>
            <div style={{fontSize:"14px",fontWeight:600,color:MUT}}>Old pension pot tracing</div>
            <span style={{fontSize:"9.5px",fontWeight:700,color:GOLD,background:"rgba(196,150,58,0.15)",padding:"3px 9px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase",flexShrink:0,whiteSpace:"nowrap"}}>Coming soon</span>
          </div>
          <p style={{fontSize:"12.5px",color:"#9a9a8e",lineHeight:1.55,marginTop:"6px",marginBottom:0}}>
            Lost track of a pension from an old employer? We'll help you find and consolidate it here.
          </p>
        </div>
      </div>

      <MobileProviderTile heading={d.hasPension === "yes" ? "Consolidate or top up" : "Get started"} products={products.products} disclaimer={products.disclaimer}/>
    </div>
  );
}
