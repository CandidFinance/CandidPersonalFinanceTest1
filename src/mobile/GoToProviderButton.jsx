import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { G, WHITE, MUT, RADIUS_PILL, FONT_SIZE, SANS } from "../CandidApp.jsx";
import { INVESTMENT_PROVIDERS, getSavedProvider, saveProvider, openInvestmentProvider } from "../utils/deepLinks.js";

// High-contrast "go straight to my platform" CTA. Uses a native <select>
// (styled to look like the pill button) rather than a custom dropdown —
// picking a provider pops the device's own picker UI (the iOS wheel,
// Android's modal list) instead of pushing the surrounding tile layout
// around. First pick saves the provider (under `storageKey`, so separate
// CTAs — e.g. ISA vs general account — can remember different platforms)
// and fires its deep link (src/utils/deepLinks.js); once saved, the button
// reads "Go to {Provider}" and repeats that deep link directly, with a
// small "Change provider" native select underneath for anyone who switches
// platforms.
export default function GoToProviderButton({ storageKey, defaultLabel }) {
  const [saved, setSaved] = useState(null);

  useEffect(() => { setSaved(getSavedProvider(storageKey)); }, [storageKey]);

  const pick = (key) => {
    const provider = INVESTMENT_PROVIDERS.find(p => p.key === key);
    if (!provider) return;
    saveProvider(storageKey, provider.key);
    setSaved(provider);
    openInvestmentProvider(provider);
  };

  const pillStyle = {
    width:"100%", display:"block", background:G, color:WHITE, border:"none",
    borderRadius:RADIUS_PILL, padding:"12px 18px", fontSize:FONT_SIZE.BODY,
    fontWeight:700, fontFamily:SANS, cursor:"pointer", textAlign:"center",
    appearance:"none", WebkitAppearance:"none",
  };

  // Both pickers below draw their visible label themselves and lay a
  // transparent 16px <select> over it. iOS Safari zooms the page in on
  // focusing any select under 16px; this keeps the smaller visible text while
  // the tappable select stays at 16px.
  const selectOverlay = {
    position:"absolute", inset:0, width:"100%", height:"100%", opacity:0,
    fontSize:"16px", cursor:"pointer", appearance:"none", WebkitAppearance:"none",
  };

  if (!saved) {
    return (
      <div style={{position:"relative"}}>
        <div aria-hidden="true" style={pillStyle}>{defaultLabel}</div>
        <ChevronDown size={14} color={WHITE} style={{position:"absolute",right:"16px",top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
        <select value="" onChange={e => pick(e.target.value)} aria-label={defaultLabel} style={selectOverlay}>
          <option value="" disabled>{defaultLabel}</option>
          {INVESTMENT_PROVIDERS.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => openInvestmentProvider(saved)} style={pillStyle}>Go to {saved.name}</button>
      <div style={{position:"relative",width:"fit-content",margin:"6px auto 0"}}>
        <span aria-hidden="true" style={{display:"block",color:MUT,fontSize:FONT_SIZE.LABEL,fontWeight:600,textDecoration:"underline",textAlign:"center"}}>Change provider</span>
        <select value="" onChange={e => pick(e.target.value)} aria-label="Change provider" style={selectOverlay}>
          <option value="" disabled>Change provider</option>
          {INVESTMENT_PROVIDERS.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
        </select>
      </div>
    </div>
  );
}
