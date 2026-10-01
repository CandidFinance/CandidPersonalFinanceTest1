import { ChevronDown } from "lucide-react";
import { MUT, TEXT, CDARK } from "../../CandidApp.jsx";

// Dropdown styled to match PillMoneyInput: small caption on top, the chosen
// value below, on the same pill. A native <select> so phones use their own
// picker; 16px so iOS Safari doesn't zoom the page on focus.
export default function PillSelect({ label, value, onChange, options, placeholder = "Choose" }) {
  return (
    <label style={{flex:1,minWidth:0,position:"relative",background:CDARK,borderRadius:"100px",padding:"9px 16px",display:"flex",flexDirection:"column",cursor:"pointer"}}>
      <span style={{fontSize:"9.5px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</span>
      <select value={value || ""} onChange={e => onChange(e.target.value)} style={{appearance:"none",WebkitAppearance:"none",border:"none",background:"none",fontSize:"16px",fontWeight:600,color:value ? TEXT : MUT,fontFamily:"inherit",padding:"0 24px 0 0",margin:0,width:"100%",outline:"none",cursor:"pointer"}}>
        <option value="" disabled>{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={16} color={MUT} style={{position:"absolute",right:"16px",top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
    </label>
  );
}
