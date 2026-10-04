import { ChevronDown } from "lucide-react";
import { MUT, TEXT, CDARK, FONT_SIZE, PILL_HEIGHT } from "../../CandidApp.jsx";
import { pillFieldStyle } from "../PillMoneyInput.jsx";

// Dropdown pill, PILL_HEIGHT tall like every other input pill. A native
// <select> so phones use their own picker.
//
// With a `label` it matches PillMoneyInput: small caption on top, the chosen
// value below in the same answer text as every pill (see pillFieldStyle). Without one (`compact`) it's a single line in the
// same type as PillSlider's options, to sit beside a toggle; the visible text
// is a span with a transparent 16px <select> laid over it, since iOS Safari
// zooms the page on focusing any select under 16px (same approach as
// GoToProviderButton). `short` on an option is shown in the pill when space
// is tight; the picker always lists the full labels.
export default function PillSelect({ label, value, onChange, options, placeholder = "Choose" }) {
  const chosen = options.find(o => o.value === value);
  const pill = { flex:1, minWidth:0, position:"relative", background:CDARK, borderRadius:"100px", height:PILL_HEIGHT, boxSizing:"border-box", display:"flex", cursor:"pointer" };
  const chevron = <ChevronDown size={16} color={MUT} style={{position:"absolute",right:"14px",top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>;
  const choices = (
    <>
      <option value="" disabled>{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </>
  );

  if (!label) {
    return (
      <label style={{...pill,alignItems:"center",padding:"0 30px 0 14px"}}>
        <span style={{fontSize:FONT_SIZE.BODY,fontWeight:600,color:chosen ? TEXT : MUT,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
          {chosen ? (chosen.short || chosen.label) : placeholder}
        </span>
        {chevron}
        <select value={value || ""} onChange={e => onChange(e.target.value)} aria-label={placeholder}
          style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0,fontSize:"16px",cursor:"pointer"}}>
          {choices}
        </select>
      </label>
    );
  }

  return (
    <label style={{...pill,flexDirection:"column",justifyContent:"center",padding:"0 16px"}}>
      <span style={{fontSize:"9.5px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{label}</span>
      <select value={value || ""} onChange={e => onChange(e.target.value)} style={{appearance:"none",WebkitAppearance:"none",border:"none",background:"none",color:value ? TEXT : MUT,padding:"0 24px 0 0",margin:0,outline:"none",cursor:"pointer",...pillFieldStyle("100%")}}>
        {choices}
      </select>
      {chevron}
    </label>
  );
}
