import { useEffect, useState } from "react";
import { Lock, Check } from "lucide-react";
import { G, MUT, TEXT, SERIF, WHITE, RADIUS_CARD } from "../../CandidApp.jsx";
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

  const label = { fontSize:"10.5px", fontWeight:600, color:MUT, letterSpacing:"0.09em", textTransform:"uppercase" };
  const primary = disabled => ({ width:"100%", background:disabled ? "rgba(22,47,36,0.2)" : G, color:WHITE, border:"none", borderRadius:"100px", padding:"14px", fontSize:"15px", fontWeight:700, fontFamily:"inherit", cursor:disabled ? "not-allowed" : "pointer" });
  const option = { display:"block", width:"100%", textAlign:"left", background:WHITE, border:"1.5px solid rgba(22,47,36,0.15)", borderRadius:"14px", padding:"13px 16px", fontSize:"14.5px", fontWeight:600, color:TEXT, fontFamily:"inherit", cursor:"pointer" };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"22px"}}>
        <div style={{width:"42px",height:"42px",borderRadius:"11px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {meta?.icon && <meta.icon size={18} color={G}/>}
        </div>
        <h1 style={{fontFamily:SERIF,fontSize:"20px",color:TEXT,fontWeight:700,margin:0,lineHeight:1.2}}>{meta?.title || moduleKey}</h1>
      </div>

      <div style={label}>Your answer is ready</div>
      {amount > 0 ? (
        <div style={{marginTop:"6px"}}>
          <span style={{fontFamily:SERIF,fontSize:"34px",fontWeight:700,color:G,lineHeight:1.1}}>{fmt(amount)}</span>
          <span style={{fontSize:"14px",color:MUT}}>{mod.amountIsLumpSum ? " by 18" : " a year"} at stake here</span>
        </div>
      ) : (
        <p style={{fontSize:"15px",color:TEXT,lineHeight:1.5,margin:"6px 0 0"}}>See where you stand, and why.</p>
      )}

      {/* The frosted answer: stand-in lines under a blur. */}
      <div aria-hidden="true" style={{position:"relative",margin:"18px 0 22px",padding:"4px 0"}}>
        <div style={{filter:"blur(6px)",userSelect:"none"}}>
          {[92, 78, 85, 60].map((w, i) => (
            <div key={i} style={{height:"12px",width:`${w}%`,borderRadius:"6px",background:"rgba(22,47,36,0.18)",marginBottom:"12px"}}/>
          ))}
        </div>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:"40px",height:"40px",borderRadius:"50%",background:WHITE,boxShadow:"0 4px 14px rgba(22,47,36,0.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Lock size={17} color={G}/>
          </div>
        </div>
      </div>

      {ask.kind === "email" && (
        <form onSubmit={e => { e.preventDefault(); setTried(true); if (emailOk) onUnlock(ask, { email, callOk }); }}
          style={{background:WHITE,border:"1px solid rgba(22,47,36,0.08)",borderRadius:RADIUS_CARD,padding:"18px",boxShadow:"0 2px 10px rgba(22,47,36,0.05)"}}>
          <div style={{fontSize:"16px",fontWeight:700,color:TEXT}}>Unlock it with your email</div>
          <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,margin:"6px 0 14px"}}>Free. We'll keep your results and tell you when something changes, like a better rate.</p>
          <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
            style={{width:"100%",boxSizing:"border-box",border:`1.5px solid ${tried && !emailOk ? "#b3261e" : "rgba(22,47,36,0.15)"}`,borderRadius:"100px",padding:"13px 18px",fontSize:"15px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE}}/>
          {tried && !emailOk && <div style={{fontSize:"12px",color:"#b3261e",margin:"6px 0 0 6px"}}>Enter a valid email address</div>}
          <label style={{display:"flex",alignItems:"flex-start",gap:"10px",margin:"14px 0 16px",cursor:"pointer"}}>
            <span style={{width:"20px",height:"20px",borderRadius:"6px",border:callOk ? "none" : "1.5px solid rgba(22,47,36,0.3)",background:callOk ? G : WHITE,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"1px",boxSizing:"border-box"}}>
              {callOk && <Check size={13} color={WHITE} strokeWidth={3}/>}
            </span>
            <input type="checkbox" checked={callOk} onChange={e => setCallOk(e.target.checked)} style={{position:"absolute",opacity:0,width:0,height:0}}/>
            <span style={{fontSize:"13.5px",color:TEXT,lineHeight:1.45}}>I'm happy for Candid to get in touch to talk my results through</span>
          </label>
          <button type="submit" style={primary(false)}>Unlock my answer</button>
          <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"10px 0 0",textAlign:"center"}}>
            Unsubscribe any time. <a href="/privacy.html" target="_blank" rel="noreferrer" style={{color:MUT}}>Privacy policy</a>
          </p>
        </form>
      )}

      {ask.kind === "question" && (
        <div>
          <div style={label}>One quick question to unlock it</div>
          <div style={{fontSize:"17px",fontWeight:700,color:TEXT,lineHeight:1.35,margin:"6px 0 14px"}}>{ask.question.ask}</div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {ask.question.options.map(o => (
              <button key={o.value} type="button" style={option} onClick={() => onUnlock(ask, o.value)}>{o.label}</button>
            ))}
          </div>
        </div>
      )}

      {ask.kind === "free" && (
        <button type="button" style={primary(false)} onClick={() => onUnlock(ask, null)}>Show my answer</button>
      )}
    </div>
  );
}
