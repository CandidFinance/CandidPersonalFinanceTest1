// A blur that deepens towards an edge, laid over a scrolling area so content
// melts out of view under the tab bar or a top edge rather than being cut off.
// Place it inside a position: relative parent; it lets taps through.
//
// Usage: <ProgressiveBlur position="bottom" height="96px" />
//
// Ported from Magic UI's progressive-blur (MIT, https://magicui.design) to
// plain JS and inline styles. Each layer blurs a little more and is masked to
// its own band, so the blur builds in steps too small to see.

const ALL = "linear-gradient(rgba(0,0,0,0) 0%, rgba(0,0,0,1) 5%, rgba(0,0,0,1) 95%, rgba(0,0,0,0) 100%)";

function band(position, start, mid, end, stop) {
  if (position === "both") return ALL;
  const dir = position === "top" ? "to top" : "to bottom";
  return `linear-gradient(${dir}, rgba(0,0,0,0) ${start}%, rgba(0,0,0,1) ${mid}%, rgba(0,0,0,1) ${end}%, rgba(0,0,0,0) ${stop}%)`;
}

function lastBand(position) {
  if (position === "both") return ALL;
  const dir = position === "top" ? "to top" : "to bottom";
  return `linear-gradient(${dir}, rgba(0,0,0,0) 87.5%, rgba(0,0,0,1) 100%)`;
}

const layer = (z, blur, mask) => ({
  position: "absolute",
  inset: 0,
  zIndex: z,
  backdropFilter: `blur(${blur}px)`,
  WebkitBackdropFilter: `blur(${blur}px)`,
  maskImage: mask,
  WebkitMaskImage: mask,
});

export function ProgressiveBlur({ height = "30%", position = "bottom", blurLevels = [0.5, 1, 2, 4, 8, 16, 32, 64], style, zIndex = 10 }) {
  const middle = Array.from({ length: Math.max(0, blurLevels.length - 2) }, (_, i) => i + 1);
  const edge = position === "top" ? { top: 0 } : position === "bottom" ? { bottom: 0 } : { top: 0, bottom: 0 };

  return (
    <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, ...edge, zIndex, pointerEvents: "none", height: position === "both" ? "100%" : height, ...style }}>
      <div style={layer(1, blurLevels[0], band(position, 0, 12.5, 25, 37.5))} />
      {middle.map((i) => (
        <div key={i} style={layer(i + 1, blurLevels[i], band(position, i * 12.5, (i + 1) * 12.5, (i + 2) * 12.5, (i + 3) * 12.5))} />
      ))}
      <div style={layer(blurLevels.length, blurLevels[blurLevels.length - 1], lastBand(position))} />
    </div>
  );
}

export default ProgressiveBlur;
