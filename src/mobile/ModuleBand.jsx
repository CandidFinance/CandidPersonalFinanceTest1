import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { CREAM, SERIF, SANS, RADIUS_PILL, ALERT_ON_DARK, WARN_ON_DARK } from "../design-tokens.js";
import { CREAM_SOFT } from "./ScreenBand.jsx";
import { Button } from "./ui";

// A module page's top, on the dark band (ScreenBand, in MobileModuleDeepDive):
// the module's name with its status in glass beside it (ALERT_ON_DARK when
// it needs action, WARN_ON_DARK when it's worth a look) and the spanner to
// the inputs, then the page's yearly £, large, a short line saying what it
// is, and "Explain this" (the answer step by step). The title and figure
// stay as the sheet comes up (`data-band-keep`). `figure`: the £ as text, or
// null for none; `suffix` follows it ("a year"). `line`: one sentence;
// `note`: a second, smaller one (where the figure comes from). `tour`: the
// data-tour hook a guided tour lights up. Cash's band (CashBand) is one.
const GLASS_PILL = { display:"inline-flex", alignItems:"center", padding:"4px 10px", borderRadius:RADIUS_PILL, background:"rgba(255,255,255,0.10)", backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)", border:"1px solid rgba(255,255,255,0.16)", fontSize:"11px", fontWeight:700, whiteSpace:"nowrap" };

export default function ModuleBand({ title, label, status, statusTone = null, figure, suffix, line, note, tour, onShowReveal, onEditInputs }) {
  return (
    <section aria-label={label || title} data-tour={tour}>
      <div style={{display:"flex",alignItems:"center",gap:"10px",minHeight:"28px"}}>
        <div data-band-keep="title" style={{fontSize:"11px",fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:CREAM_SOFT,whiteSpace:"nowrap"}}>{title}</div>
        {status && <span style={{...GLASS_PILL,color:statusTone === "alert" ? ALERT_ON_DARK : statusTone === "warn" ? WARN_ON_DARK : CREAM}}>{status}</span>}
        {onEditInputs && (
          <button type="button" onClick={onEditInputs} aria-label="Edit your finances" className="tap44" style={{marginLeft:"auto",background:"none",border:"none",padding:"4px",marginRight:"-4px",cursor:"pointer",color:CREAM,display:"flex"}}>
            <SlidersHorizontal size={20} strokeWidth={2.2} aria-hidden="true"/>
          </button>
        )}
      </div>
      {figure != null && (
        <div data-band-keep="figure" style={{fontFamily:SERIF,fontSize:"var(--hero-fig)",fontWeight:700,color:CREAM,lineHeight:1.05,letterSpacing:"-0.01em",marginTop:"8px"}}>
          {figure}{suffix && <span style={{fontFamily:SANS,fontSize:"0.32em",fontWeight:600,marginLeft:"5px",letterSpacing:0}}>{suffix}</span>}
        </div>
      )}
      {line && <div style={{fontSize:"13px",color:CREAM_SOFT,lineHeight:1.45,marginTop:figure != null ? "6px" : "10px"}}>{line}</div>}
      {note && <div style={{fontSize:"12px",color:CREAM_SOFT,opacity:0.8,lineHeight:1.45,marginTop:"4px"}}>{note}</div>}
      {onShowReveal && (
        <Button variant="secondary" onClick={onShowReveal} style={{marginTop:"16px",border:"none",paddingRight:"12px"}}>
          Explain this<ChevronRight size={17} strokeWidth={2.5} aria-hidden="true" style={{marginLeft:"-4px"}}/>
        </Button>
      )}
    </section>
  );
}
