import { CREAM, SANS, MODULES_BAND_BG, STACK_SLICK_BG } from "../design-tokens.js";

// A screen's top band and the cream sheet below it (Modules, Forecasts).
// The band runs to the screen's edges on a phone (out past the column's
// 20px padding and up under the top inset); where the column is narrower
// than the screen it's a rounded panel instead. On a phone the sheet
// overlaps the band's foot with rounded corners.
// `tone`: "light", the soft green-to-gold of Modules; "dark", the card
// stack's oil slick, with anything drawn past its edges cut off.
// A figure printed on the band is as big as one on a stack's card.
const CSS = `
.screen-band { --hero-fig: 52px; }
@media (max-width: 379px) { .screen-band { --hero-fig: 44px; } }
@media (min-width: 1000px) { .screen-band { --hero-fig: 72px; } }
.screen-band { margin: calc(-16px - env(safe-area-inset-top, 0px)) -20px 0; padding: calc(22px + env(safe-area-inset-top, 0px)) 20px 52px; }
.screen-band.light { background: ${MODULES_BAND_BG}; }
.screen-band.dark { background: ${STACK_SLICK_BG}; overflow: hidden; }
.screen-sheet { position: relative; margin: -28px -20px 0; padding: 20px 20px 0; background: ${CREAM}; border-radius: 28px 28px 0 0; }
@media (min-width: 581px) {
  .screen-band { margin: 0; padding: 22px 20px; border-radius: 28px; }
  .screen-sheet { margin: 0; padding: 20px 0 0; border-radius: 0; }
}
`;

export function ScreenBand({ tone = "light", children, ...rest }) {
  return (
    <>
      <style>{CSS}</style>
      <div className={`screen-band ${tone}`} {...rest}>{children}</div>
    </>
  );
}

export function ScreenSheet({ children }) {
  return <div className="screen-sheet">{children}</div>;
}

// A page title as Modules has it, large in the sans.
export const SCREEN_TITLE = { fontFamily: SANS, fontSize: "30px", fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.1, margin: "0 0 16px" };
