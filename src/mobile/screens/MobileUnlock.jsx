import { useEffect, useState } from "react";
import { Lock, Check } from "lucide-react";
import { G, MUT, TEXT, SERIF, WHITE } from "../../CandidApp.jsx";
import { MODULE_META, getModuleBreakdown } from "../../lib/moduleStatus.js";
import { fmt } from "../../lib/format.js";
import { unlockAsk, validEmail } from "../../lib/unlock.js";

// A locked module (src/lib/unlock.js): what it's worth, in £, with the answer
// itself frosted until it's unlocked. The first unlock asks for an email,
// each later one a single tap of feedback. The frosted lines are stand-ins,
// not the real answer blurred, so nothing can be read from the page.
// `onUnlock(ask, answer)` unlocks it and goes on to the answer.
export default function MobileUnlock({ moduleKey, d, m, statuses, onUnlock }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);
  const meta = MODULE_META.find(mm => mm.key === moduleKey);
  const mod = getModuleBreakdown(d, m, statuses, null, "amount").moduleList.find(mm => mm.key === moduleKey);
  const ask = unlockAsk(d);
  const [email, setEmail] = useState(d.email || "");
  const [callOk, setCallOk] = useState(false);
  const [tried, setTried] = useState(false);
  const amount = mod?.amount > 0 ? mod.amount : 0;
  const emailOk = validEmail(email);

  // What's behind the frost, named, so it's clear what unlocking gets them.
  const hidden = amount > 0 ? ["Why you're missing it", "How to fix it"] : ["Where you stand", "What to keep an eye on"];
  const cta = amount > 0 ? "Show me how to fix it" : "Show me";

  const label = { fontSize:"10.5px", fontWeight:600, color:MUT, letterSpacing:"0.09em", textTransform:"uppercase" };
  const primary = disabled => ({ width:"100%", background:disabled ? "rgba(22,47,36,0.2)" : G, color:WHITE, border:"none", borderRadius:"100px", padding:"15px", fontSize:"15.5px", fontWeight:700, fontFamily:"inherit", cursor:disabled ? "not-allowed" : "pointer" });
  const option = { display:"block", width:"100%", textAlign:"left", background:WHITE, border:"1.5px solid rgba(22,47,36,0.15)", borderRadius:"14px", padding:"13px 16px", fontSize:"14.5px", fontWeight:600, color:TEXT, fontFamily:"inherit", cursor:"pointer" };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
        <div style={{width:"34px",height:"34px",borderRadius:"9px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {meta?.icon && <meta.icon size={16} color={G}/>}
        </div>
        <h1 style={{fontSize:"15px",color:TEXT,fontWeight:700,margin:0}}>{meta?.title || moduleKey}</h1>
      </div>

      {/* The figure is the first thing they see. */}
      {amount > 0 ? (
        <div style={{margin:"22px 0 4px"}}>
          <div style={{fontFamily:SERIF,fontSize:"64px",fontWeight:700,color:G,lineHeight:1,letterSpacing:"-0.02em"}}>{fmt(amount)}</div>
          <div style={{fontSize:"16px",color:TEXT,fontWeight:600,marginTop:"10px"}}>{mod.amountIsLumpSum ? "by the time they're 18" : "a year you're missing out on"}</div>
        </div>
      ) : (
        <div style={{fontFamily:SERIF,fontSize:"30px",fontWeight:700,color:G,lineHeight:1.2,margin:"22px 0 4px"}}>Your answer is ready</div>
      )}

      {/* What unlocking shows, each under a frost of stand-in lines (not the
          real answer blurred, so nothing can be read from the page). */}
      <div aria-hidden="true" style={{margin:"22px 0 24px",display:"flex",flexDirection:"column",gap:"16px"}}>
        {hidden.map(h => (
          <div key={h}>
            <div style={{display:"flex",alignItems:"center",gap:"6px",...label,color:TEXT}}><Lock size={12} color={G}/>{h}</div>
            <div style={{filter:"blur(5px)",userSelect:"none",marginTop:"8px"}}>
              {[90, 70].map((w, i) => <div key={i} style={{height:"11px",width:`${w}%`,borderRadius:"6px",background:"rgba(22,47,36,0.16)",marginBottom:"8px"}}/>)}
            </div>
          </div>
        ))}
      </div>

      {ask.kind === "email" && (
        <form onSubmit={e => { e.preventDefault(); setTried(true); if (emailOk) onUnlock(ask, { email, callOk }); }}>
          <div style={{fontSize:"16px",fontWeight:700,color:TEXT,marginBottom:"12px"}}>Enter your email to see {amount > 0 ? "why, and how to fix it" : "your answer"}, for free</div>
          <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
            style={{width:"100%",boxSizing:"border-box",border:`1.5px solid ${tried && !emailOk ? "#b3261e" : "rgba(22,47,36,0.15)"}`,borderRadius:"100px",padding:"14px 18px",fontSize:"15px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE}}/>
          {tried && !emailOk && <div style={{fontSize:"12px",color:"#b3261e",margin:"6px 0 0 6px"}}>Enter a valid email address</div>}
          <button type="submit" style={{...primary(false),marginTop:"10px"}}>{cta}</button>
          <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"12px 0 0"}}>
            We'll notify you when you could be keeping more: a better rate, an allowance going unused, or money sitting idle.
          </p>
          <label style={{display:"flex",alignItems:"center",gap:"8px",margin:"12px 0 0",cursor:"pointer"}}>
            <span style={{width:"18px",height:"18px",borderRadius:"5px",border:callOk ? "none" : "1.5px solid rgba(22,47,36,0.3)",background:callOk ? G : WHITE,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxSizing:"border-box"}}>
              {callOk && <Check size={12} color={WHITE} strokeWidth={3}/>}
            </span>
            <input type="checkbox" checked={callOk} onChange={e => setCallOk(e.target.checked)} style={{position:"absolute",opacity:0,width:0,height:0}}/>
            <span style={{fontSize:"12.5px",color:MUT}}>Happy to have a chat to talk it through</span>
          </label>
          <p style={{fontSize:"11.5px",color:MUT,margin:"14px 0 0",textAlign:"center"}}>
            Unsubscribe any time. <a href="/privacy.html" target="_blank" rel="noreferrer" style={{color:MUT}}>Privacy policy</a>
          </p>
        </form>
      )}

      {ask.kind === "question" && (
        <div>
          <div style={label}>One quick question to see {amount > 0 ? "how to fix it" : "your answer"}</div>
          <div style={{fontSize:"17px",fontWeight:700,color:TEXT,lineHeight:1.35,margin:"6px 0 14px"}}>{ask.question.ask}</div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {ask.question.options.map(o => (
              <button key={o.value} type="button" style={option} onClick={() => onUnlock(ask, o.value)}>{o.label}</button>
            ))}
          </div>
        </div>
      )}

      {ask.kind === "free" && (
        <button type="button" style={primary(false)} onClick={() => onUnlock(ask, null)}>{cta}</button>
      )}
    </div>
  );
}
