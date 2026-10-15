import { FONT_SIZE, HEADER_BG_DARK, HEADER_BG_LIGHT, HEADER_WORDMARK_DARK, HEADER_WORDMARK_LIGHT } from "./design-tokens.js";

// The header bar on every page: the Candid. wordmark, an optional page
// label in the middle and an optional action on the right.

// Grid (not flex space-between) so the page label stays centred whether or
// not `right` is present — with only 2 flex children, space-between shoves
// a lone `center` all the way to the far edge instead of the middle.
// `light` (the app's own screens; the welcome-back and admin pages keep the
// dark-green header) swaps the header to the same
// cream as the page background, matching the app-like "no chrome" look of
// the Claude Design mockup the mobile build has been targeting all along —
// a native app's own header usually doesn't sit in a contrasting color bar.
// A hairline border replaces the color-block as the only remaining visual
// separation from the content below. In this mode the "Candid." wordmark
// sits in the bar itself, above that hairline, in brand green; the bar's
// contents are capped to the same 580px / 20px-gutter column as the app's
// content so the wordmark left-aligns with the tiles below it.
export function NavBar({ right, center, onLogoClick, light }) {
  const wordmarkStyle = light
    ? {...HEADER_WORDMARK_LIGHT,fontSize:"20px",justifySelf:"start"}
    : {...HEADER_WORDMARK_DARK,fontSize:FONT_SIZE.HEADLINE,justifySelf:"start"};
  const row = (
    <>
      <span style={{justifySelf:"start",display:"inline-flex",alignItems:"center",gap:"8px"}}>
        {onLogoClick ? (
          <button type="button" onClick={onLogoClick} aria-label={light ? "Back to Home" : "Back to Dashboard"} style={{...wordmarkStyle,background:"none",border:"none",padding:0,cursor:"pointer"}}>Candid.</button>
        ) : (
          <span style={wordmarkStyle}>Candid.</span>
        )}
      </span>
      {center ? <div style={{color:light?"rgba(22,47,36,0.5)":"rgba(255,255,255,0.5)",fontSize:FONT_SIZE.LABEL,fontWeight:500,justifySelf:"center",textAlign:"center"}}>{center}</div> : <span/>}
      <div style={{justifySelf:"end",display:"flex",alignItems:"center"}}>{right}</div>
    </>
  );
  const grid = {display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",columnGap:"12px"};
  if (light) return (
    <div style={{background:HEADER_BG_LIGHT,borderBottom:"1px solid rgba(22,47,36,0.08)",paddingTop:"env(safe-area-inset-top, 0px)",flexShrink:0}}>
      <div style={{...grid,maxWidth:"580px",margin:"0 auto",padding:"14px 20px",width:"100%",boxSizing:"border-box"}}>{row}</div>
    </div>
  );
  return (
    <div style={{background:HEADER_BG_DARK,padding:"18px 32px",paddingTop:"calc(18px + env(safe-area-inset-top, 0px))",...grid,flexShrink:0}}>{row}</div>
  );
}
