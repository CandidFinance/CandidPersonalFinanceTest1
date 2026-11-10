// A slow light that travels round a tile's edge, for the one high-value tile
// on a screen (the hero, the largest opportunity). Drop it inside a tile that
// is position: relative; it takes the tile's corner radius and lets taps
// through. Still when the phone asks for reduced motion.
//
// Usage: <div style={{ ...CARD, position: "relative" }}><ShineBorder />...</div>
//
// `tileBorder`: the tile's own border width (CARD has 1px). The shine sits
// over that border, not inside it, so the edge is one line of even width.
//
// Ported from Magic UI's shine-border (MIT, https://magicui.design) to plain
// JS. The keyframe is a CSS animation (as in the original), added to the page
// once.
import { GOLD, PROGRESS_GREEN } from "../../design-tokens.js";

const CSS = `@keyframes candid-shine { 0% { background-position: 0% 0%; } 50% { background-position: 100% 100%; } 100% { background-position: 0% 0%; } }
.candid-shine { animation: candid-shine var(--shine-duration, 14s) infinite linear; }
@media (prefers-reduced-motion: reduce) { .candid-shine { animation: none; } }`;

export function ShineBorder({ borderWidth = 1.5, duration = 14, shineColor = [GOLD, PROGRESS_GREEN], tileBorder = 1, style, ...props }) {
  const colors = Array.isArray(shineColor) ? shineColor.join(",") : shineColor;
  return (
    <>
      <style>{CSS}</style>
      <div
        aria-hidden="true"
        className="candid-shine"
        style={{
          "--shine-duration": `${duration}s`,
          position: "absolute",
          inset: `-${tileBorder}px`,
          borderRadius: "inherit",
          pointerEvents: "none",
          willChange: "background-position",
          backgroundImage: `radial-gradient(transparent,transparent,${colors},transparent,transparent)`,
          backgroundSize: "300% 300%",
          padding: `${borderWidth}px`,
          boxSizing: "border-box",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          ...style,
        }}
        {...props}
      />
    </>
  );
}

export default ShineBorder;
