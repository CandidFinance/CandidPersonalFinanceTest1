import { MUT } from "../design-tokens.js";

// A thin rule with a word in the middle ("or"), between two ways of doing
// the same thing: Google and an email, a passkey and a password.
export default function OrRule({ label = "or", margin = "14px 0 12px" }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:"12px",margin}}>
      <hr style={{flex:1,border:"none",borderTop:"1px solid rgba(22,47,36,0.12)",margin:0}}/>
      <span style={{fontSize:"12.5px",color:MUT}}>{label}</span>
      <hr style={{flex:1,border:"none",borderTop:"1px solid rgba(22,47,36,0.12)",margin:0}}/>
    </div>
  );
}
