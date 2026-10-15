import { MessageCircle, Send } from "lucide-react";
import { GOLD, MUT, TEXT, SERIF, CDARK } from "../../design-tokens.js";

// Mobile Chat screen — matches the mockup's placeholder layout (icon badge,
// headline, description, "Coming soon" pill, disabled input bar), with the
// app's own copy rather than the mockup's illustrative text.
export default function MobileChatScreen() {
  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:"65vh"}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"20px"}}>
        <div style={{width:"56px",height:"56px",borderRadius:"16px",background:"rgba(196,150,58,0.14)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"18px"}}>
          <MessageCircle size={26} color={GOLD}/>
        </div>
        <h1 style={{fontFamily:SERIF,fontWeight:600,fontSize:"22px",color:TEXT,margin:0}}>Let's talk Candidly</h1>
        <p style={{fontSize:"14px",color:MUT,lineHeight:1.55,marginTop:"10px",maxWidth:"280px"}}>
          Ask specific questions about your own numbers — pension, ISA, mortgage overpayments and more — grounded in your Candid report.
        </p>
        <div style={{marginTop:"16px",background:"rgba(196,150,58,0.14)",color:"#8a6a24",fontSize:"11px",fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",padding:"6px 14px",borderRadius:"100px"}}>
          Coming soon
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:"10px",background:CDARK,borderRadius:"100px",padding:"12px 16px",opacity:0.6}}>
        <span style={{fontSize:"14px",color:MUT,flex:1}}>Ask Candid...</span>
        <Send size={18} color={MUT}/>
      </div>
    </div>
  );
}
