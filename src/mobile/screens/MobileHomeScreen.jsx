import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScoreDetailSheet, G, GOLD, CDARK, WHITE, MUT, TEXT, SERIF, SC } from "../../CandidApp.jsx";
import { getModuleBreakdown } from "../../lib/moduleStatus.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import { mobileGreeting } from "../copy.js";

// Mobile Home screen — matches the "Claude Design" mockup's Overview tab
// (score progress bar, Opportunity pill, expandable Net Worth card, Biggest
// Win card), rebuilt against real app data instead of the mockup's sample
// numbers. Score labels/colors reuse the same bands as desktop's ScoreRing/
// ScoreDetailSheet rather than the mockup's own wording, so the score reads
// identically everywhere in the app. Icons stay lucide-react (CLAUDE.md rule
// 2) rather than the mockup's hand-drawn SVGs.
function scoreBand(score) {
  if (score >= 86) return { color: G, label: "Optimised" };
  if (score >= 66) return { color: "#2d6b4a", label: "On track" };
  if (score >= 41) return { color: GOLD, label: "Room to improve" };
  return { color: "#c0392b", label: "Needs attention" };
}

// Flat asset/liability list for the expandable Net Worth card — a simpler
// grouping than desktop's (ISA/unwrapped combined into one "Investments"
// line) to match the mockup's information density.
function netWorthBreakdown(d, m) {
  const isaPrev = (+d.isaPrevCash||0) + (+d.isaPrevSS||0) + (+d.isaPrevLISA||0) + (+d.isaPrevOther||0) || (+d.isaPreviousBalance||0);
  const assets = [
    { label: "Cash & savings", value: m.cash + m.bonds },
    { label: "Investments", value: m.isaUsedThisYear + isaPrev + (+d.unwrappedValue||0) },
    { label: "Pension", value: (+d.potValue||0) + (+d.potValue2||0) },
    { label: "Property equity", value: m.propertyEquity || 0 },
  ].filter(a => a.value > 0);
  const liabilities = [
    { label: "Student loan", value: m.loanBal || 0 },
    { label: "Mortgage", value: d.hasMortgage === "yes" ? (+d.mortgageBalance||0) : 0 },
    { label: "Personal loan", value: d.hasPersonalLoan === "yes" ? (+d.personalLoanBalance||0) : 0 },
  ].filter(l => l.value > 0);
  return { assets, liabilities };
}

export default function MobileHomeScreen({ insights, d, m, statuses }) {
  const navigate = useNavigate();
  const [scoreDetailOpen, setScoreDetailOpen] = useState(false);
  const [netWorthOpen, setNetWorthOpen] = useState(false);
  if (!insights) return null;

  const score = insights.score || 0;
  const { color: scoreColor, label: scoreLabel } = scoreBand(score);
  const { modulesWithRec, totalOpp } = getModuleBreakdown(d, m, statuses, insights, "amount");
  const topWin = modulesWithRec[0] || null;
  const { assets, liabilities } = netWorthBreakdown(d, m);
  const netWorthPositive = m.netWorth >= 0;
  const topWinColor = topWin ? (SC[topWin.status] || MUT) : MUT;

  return (
    <div>
      <h1 style={{fontFamily:SERIF,fontSize:"22px",color:G,fontWeight:700,marginBottom:"20px",lineHeight:1.2}}>
        {mobileGreeting(d)}
      </h1>

      {/* Score — tap opens the full breakdown sheet. */}
      <div onClick={() => setScoreDetailOpen(true)} style={{cursor:"pointer",marginBottom:"4px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Candid Score</span>
          <span style={{fontSize:"14px",color:MUT}}>›</span>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",gap:"8px",marginTop:"6px"}}>
          <span style={{fontFamily:SERIF,fontWeight:700,fontSize:"48px",lineHeight:1,color:scoreColor}}>{score}</span>
          <span style={{fontSize:"14px",color:MUT,marginBottom:"7px"}}>/100 · {scoreLabel}</span>
        </div>
        {insights.headline && (
          <p style={{fontSize:"13px",color:MUT,marginTop:"6px",lineHeight:1.5}}>{insights.headline}</p>
        )}
        <div style={{height:"6px",borderRadius:"100px",background:CDARK,marginTop:"12px",overflow:"hidden"}}>
          <div style={{height:"100%",borderRadius:"100px",background:scoreColor,width:`${Math.min(100,score)}%`}}/>
        </div>
      </div>
      {scoreDetailOpen && (
        // isMobile=false here on purpose: that flag switches ScoreDetailSheet
        // into a bottom-sheet pinned to the very bottom of the *browser*
        // viewport (full width, vertically flush to the bottom) — correct for
        // an actual narrow-phone-width desktop visitor, but on this mobile
        // app route (viewed at any window width, including a full desktop
        // browser) it rendered detached from the app's own centred content
        // column instead of appearing over the Candid Score tile. The
        // centred-modal mode is the closer match here.
        <ScoreDetailSheet insights={insights} displayScore={score} isMobile={false}
          onClose={() => setScoreDetailOpen(false)}
          onReviewModules={() => { setScoreDetailOpen(false); navigate("/dashboard"); }}/>
      )}

      {/* Opportunity — taps through to the full module ranking (desktop for now). */}
      {totalOpp > 0 && (
        <div onClick={() => navigate("/dashboard")} style={{marginTop:"14px",background:"rgba(196,150,58,0.12)",borderRadius:"12px",padding:"11px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"baseline",gap:"6px"}}>
            <span style={{fontSize:"11px",fontWeight:600,color:"#8a6a24",letterSpacing:"0.07em",textTransform:"uppercase"}}>Opportunity</span>
            <span style={{fontFamily:SERIF,fontWeight:700,fontSize:"17px",color:TEXT}}>{fmtCompact(totalOpp)}<span style={{fontSize:"12px",fontWeight:500,color:MUT}}>/yr</span></span>
          </div>
          <span style={{fontSize:"14px",color:"#8a6a24",flexShrink:0}}>›</span>
        </div>
      )}

      <div style={{height:"1px",background:"rgba(22,47,36,0.08)",margin:"20px 0"}}/>

      {/* Net worth — tap to expand the assets/liabilities breakdown in place. */}
      <div onClick={() => setNetWorthOpen(v => !v)} style={{cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Net worth</span>
          <span style={{fontSize:"14px",color:MUT,display:"inline-block",transform:netWorthOpen?"rotate(180deg)":"none",transition:"transform 0.2s"}}>⌄</span>
        </div>
        <div style={{display:"flex",alignItems:"baseline",gap:"8px",marginTop:"6px"}}>
          <span style={{fontFamily:SERIF,fontWeight:700,fontSize:"30px",color:netWorthPositive?TEXT:"#c0392b"}}>{fmt(Math.abs(m.netWorth))}</span>
        </div>
        <div style={{display:"flex",gap:"20px",marginTop:"10px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
            <span style={{width:"7px",height:"7px",borderRadius:"50%",background:"#2d6b4a",display:"inline-block"}}/>
            <span style={{fontSize:"12.5px",color:MUT}}>Assets <b style={{color:TEXT}}>{fmt(m.totalAssets)}</b></span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
            <span style={{width:"7px",height:"7px",borderRadius:"50%",background:"#c0392b",display:"inline-block"}}/>
            <span style={{fontSize:"12.5px",color:MUT}}>Liabilities <b style={{color:TEXT}}>{fmt(m.totalLiabilities)}</b></span>
          </div>
        </div>
        {netWorthOpen && (assets.length > 0 || liabilities.length > 0) && (
          <div style={{marginTop:"16px",paddingTop:"14px",borderTop:`1px solid rgba(22,47,36,0.08)`,display:"flex",flexDirection:"column",gap:"10px"}}>
            {assets.length > 0 && (
              <div style={{fontSize:"10.5px",fontWeight:700,color:"#2d6b4a",letterSpacing:"0.08em",textTransform:"uppercase"}}>Assets</div>
            )}
            {assets.map((a,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:"13px",color:TEXT}}>{a.label}</span>
                <span style={{fontSize:"13px",fontWeight:600,color:TEXT}}>{fmt(a.value)}</span>
              </div>
            ))}
            {liabilities.length > 0 && (
              <div style={{fontSize:"10.5px",fontWeight:700,color:"#c0392b",letterSpacing:"0.08em",textTransform:"uppercase",marginTop:"6px"}}>Liabilities</div>
            )}
            {liabilities.map((l,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:"13px",color:TEXT}}>{l.label}</span>
                <span style={{fontSize:"13px",fontWeight:600,color:TEXT}}>{fmt(l.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{height:"1px",background:"rgba(22,47,36,0.08)",margin:"20px 0"}}/>

      {/* Biggest win — the one interactive card on this screen (CLAUDE.md rule 3:
          reserve card wrapping for discrete, actionable components). */}
      {topWin && (
        <div>
          <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase",marginBottom:"10px"}}>Your biggest win</div>
          <div style={{background:WHITE,border:"1px solid rgba(22,47,36,0.08)",borderRadius:"14px",padding:"18px",boxShadow:"0 2px 10px rgba(22,47,36,0.05)"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <div style={{width:"34px",height:"34px",borderRadius:"9px",background:`${topWinColor}1f`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {topWin.icon && <topWin.icon size={16} color={topWinColor}/>}
              </div>
              <div style={{fontSize:"15px",fontWeight:600,color:TEXT,lineHeight:1.3}}>{topWin.title}</div>
            </div>
            <div style={{fontFamily:SERIF,fontWeight:700,fontSize:"23px",color:"#2d6b4a",marginTop:"12px"}}>
              {fmtCompact(topWin.amount)}{topWin.amountIsLumpSum ? " by 18" : "/yr"}
            </div>
            <p style={{fontSize:"13px",color:MUT,marginTop:"4px",lineHeight:1.5}}>{topWin.summary}</p>
            <button onClick={() => navigate(`/app/module/${topWin.key}`)} style={{marginTop:"14px",width:"100%",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"12px",fontSize:"14px",fontWeight:600,cursor:"pointer"}}>
              Review in {topWin.title}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
