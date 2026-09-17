import { isPensionContributing, calcPensionTaperSaving, calcAnnualAllowanceTaper, calcSimpleCarryForward } from "../../lib/pension.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import { G, GOLD, WHITE, MUT, TEXT, SERIF } from "../../CandidApp.jsx";
import MobileWinTile from "../MobileWinTile.jsx";

// Trimmed (v1) mobile version of desktop's Pension deep dive (ModuleDeepDive,
// moduleKey==="pension" — CandidApp.jsx), per the agreed mobile deep-dive
// scope: the two core wins (employer match / Personal Allowance taper
// recovery) as full tap-to-expand wins, and simple, non-interactive figures
// for carry-forward and bonus sacrifice rather than desktop's full 3-year
// table and 0–100% slider calculator. Also drops the growth-trajectory bar
// chart, "what if you contributed more" stepper, earliest-retirement-age
// search, and Lump Sum Allowance inflection point — all explicitly deferred
// to a later pass (agreed: full parity later, not this v1).
export default function MobilePensionDeepDive({ d, m }) {
  const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT, padding:"5px 0" };

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

  // Stepped-out match calculation, same pattern as Cash's ISA→PSA breakdown.
  const yourContribAmount = m.salary * myPct / 100;
  const employerCapAmount = m.salary * empCapPct / 100;
  // Illustrative starting rate when not contributing at all and no match is
  // on record — mirrors the 5% baseline the "tax relief foregone" opportunity
  // figure above already assumes.
  const illustrativeRate = empCapPct > 0 ? empCapPct : 5;
  const illustrativeAmount = m.salary * illustrativeRate / 100;
  const illustrativeRelief = Math.round(illustrativeAmount * m.tr);
  const illustrativeNetCost = Math.round(illustrativeAmount - illustrativeRelief);

  const taper = calcPensionTaperSaving(m);
  const showSacrificeCalc = m.adjustedNetIncome >= 80000 && m.adjustedNetIncome <= 125140;

  const aa = calcAnnualAllowanceTaper(d, m);
  const cf = calcSimpleCarryForward(d, m, aa.approxAA);

  const hasStatedBonus = (+d.bonusAmount||0) > 0;
  const bonusPotential = hasStatedBonus ? Math.round((+d.bonusAmount||0) * m.tr) : 0;

  const opportunityCols = [];
  if (!contributing) opportunityCols.push({ label:"Tax relief foregone", value: fmtCompact(Math.round(m.salary*0.05*m.tr)) });
  else if (m.missedMatch > 0) opportunityCols.push({ label:"Missed employer match", value: fmtCompact(m.missedMatch) });
  if (taper.inTaper && taper.taperTotalSaving > 0) opportunityCols.push({ label:"Personal Allowance recoverable", value: fmtCompact(taper.taperTotalSaving) });

  return (
    <div>
      {opportunityCols.length > 0 && (
        <div style={{background:"rgba(196,150,58,0.12)",borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
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
        <MobileWinTile number={1} title={matchWinTitle} headline={matchWinHeadline} tagLabel="Today">
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
        <MobileWinTile number={showMatchWin ? 2 : 1}
          title={taper.inTaper ? "Recover your Personal Allowance" : "Get ahead of the £100k taper"}
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
        </MobileWinTile>
      )}

      {aa.inAATaper && (
        <div style={{borderLeft:`4px solid ${G}`,background:"rgba(22,47,36,0.04)",borderRadius:"0 10px 10px 0",padding:"14px 16px",marginBottom:"16px"}}>
          <div style={{fontSize:"10px",fontWeight:700,color:G,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"6px"}}>Worth knowing</div>
          <p style={{fontSize:"13px",color:G,lineHeight:1.6,margin:"0 0 6px",fontWeight:600}}>
            Your Annual Allowance may be reduced to approximately {fmt(aa.approxAA)} this tax year (down from £60,000).
          </p>
          <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.6,margin:0}}>
            Once adjusted income passes £260,000, your allowance shrinks £1 for every £2 above that, down to a £10,000 floor. Based on your figures, this looks like it applies to you.
          </p>
        </div>
      )}

      {cf.showCarryForward && (
        <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginBottom:"16px"}}>
          <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"8px"}}>Carry forward unused allowance</div>
          <div style={rowStyle}><span>This year's allowance{aa.inAATaper?" (tapered)":""}</span><span>{fmt(aa.approxAA)}</span></div>
          <div style={rowStyle}><span>+ Unused from last 3 years (assumed)</span><span>{fmt(cf.cfTotalUnused)}</span></div>
          <div style={{...rowStyle,fontWeight:700}}><span>Up to</span><span>{fmt(cf.cfMaxContributable)}</span></div>
          <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,marginTop:"8px",marginBottom:0}}>
            Assumes you had a pension scheme with nothing contributed in each of the last 3 tax years — the best case. Check your provider's statements or HMRC account for your real figure before a large contribution.
          </p>
        </div>
      )}

      {hasStatedBonus && (
        <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px"}}>
          <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"8px"}}>Model bonus sacrifice</div>
          <div style={rowStyle}><span>Sacrifice your full {fmt(+d.bonusAmount)} bonus</span><span style={{fontWeight:700,color:"#2d6b4a"}}>up to {fmt(bonusPotential)}</span></div>
          <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,marginTop:"8px",marginBottom:0}}>
            Potential saving at your {trPct}% tax rate if you sacrifice the full bonus into your pension instead of taking it as cash — this depends on actually receiving the bonus, so it's not counted in the Opportunity figure above. A slider to model partial sacrifice is coming soon.
          </p>
        </div>
      )}
    </div>
  );
}
