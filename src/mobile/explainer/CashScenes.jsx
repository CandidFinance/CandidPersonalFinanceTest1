import React from "react";
import {
  useStage, StageFrame, TextZone, introLead, useBeats, useTween, useCountUp, useLinearRise, setBack, clamp, TILE_SHADOW, EASE_ENTRANCE, EASE_LANDING
} from "./ExplainerKit.jsx";

// A caption lands this long before the picture it describes.
const CAPTION_LEAD = 500;

function ChartBar({ x, y, w, h, bg, color, topRadius = 0, bottomRadius = 0, children, reduceMotion, style }) {
  return (
    <div style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      background: bg,
      color: color,
      borderTopLeftRadius: topRadius,
      borderTopRightRadius: topRadius,
      borderBottomLeftRadius: bottomRadius,
      borderBottomRightRadius: bottomRadius,
      transition: reduceMotion ? "none" : "border-radius 300ms ease",
      overflow: "hidden",
      ...style
    }}>
      {children}
    </div>
  );
}

export function CashRates({ active, reduceMotion, theme, ariaLabel, format, intro, labels, onSettled, amount, lowInterest, highInterest, difference }) {
  const stage = useStage(reduceMotion);
  const { W, H, A } = stage;
  const lead = introLead(intro, 0.69);
  const offsets = [0, 2400, 4800, 7600, 11000];
  const beat = useBeats(active, reduceMotion, offsets.map(t => lead + t), onSettled);
  const captionBeat = useBeats(active, reduceMotion, offsets.map(t => Math.max(0, lead + t - CAPTION_LEAD)));
  const b = i => reduceMotion || beat > i;
  const captions = [
    labels.captionSaved,
    labels.captionRates,
    labels.captionInterest,
    labels.captionGap,
    labels.captionTakeaway
  ];
  let text = intro;
  if (!reduceMotion) {
    const idx = Math.min(captionBeat - 1, captions.length - 1);
    for (let i = idx; i >= 0; i--) {
      if (captions[i]) { text = captions[i]; break; }
    }
  }

  const axisY = H - 56;
  const headY = A - 26;
  const stackTop = A + 100;
  const chartH = axisY - stackTop;
  const bw = Math.round(W * 0.38);
  const x0 = 10;
  const x1 = W - 10 - bw;
  const baseH = Math.round(chartH * 0.6);
  const highH = Math.round((chartH - baseH - 2) * 0.9);
  const lowH = Math.round(highH * lowInterest / highInterest);

  const colGrow = useTween(b(0), 800, reduceMotion);
  const intGrow = useTween(b(2), 750, reduceMotion);
  const gapTween = useTween(b(3), 450, reduceMotion);
  const lowCount = useCountUp(lowInterest, b(2), 750, reduceMotion);
  const highCount = useCountUp(highInterest, b(2), 750, reduceMotion);
  const gapCount = useCountUp(difference, b(3), 700, reduceMotion);

  const colFigureOpacity = colGrow >= 0.75 ? clamp((colGrow - 0.75) / 0.25, 0, 1) : 0;
  const intFigureOpacityLow = intGrow >= (1 - 200/750) ? clamp((intGrow - (1 - 200/750)) / (200/750), 0, 1) : 0;
  const intFigureOpacityHigh = intFigureOpacityLow;

  const columns = [
    { x: x0, baseHeight: baseH, interestHeight: lowH, count: lowCount, label: labels.lowRate },
    { x: x1, baseHeight: baseH, interestHeight: highH, count: highCount, label: labels.highRate }
  ];

  return (
    <StageFrame stage={stage} ariaLabel={ariaLabel}>
      <TextZone text={text} active={active} reduceMotion={reduceMotion} W={W} theme={theme} />
      <div style={{
        position: "absolute",
        left: 0,
        top: axisY,
        width: W,
        height: 1,
        background: theme.neutral,
        opacity: b(0) ? 0.5 : 0,
        transition: reduceMotion ? "none" : "opacity 450ms ease"
      }} />
      {columns.map((col, i) => {
        const baseHeight = col.baseHeight * (b(0) ? colGrow : 0);
        const interestHeight = col.interestHeight * (b(2) ? intGrow : 0);
        const interestTop = axisY - col.baseHeight - 2 - interestHeight;
        const figureOpacity = (col.interestHeight >= 30) ? (i === 0 ? intFigureOpacityLow : intFigureOpacityHigh) : 1;
        return (
          <React.Fragment key={i}>
            <ChartBar
              x={col.x}
              y={axisY - baseHeight}
              w={bw}
              h={baseHeight}
              bg={theme.accent}
              color={theme.onAccent}
              topRadius={b(2) ? 0 : 12}
              bottomRadius={0}
              reduceMotion={reduceMotion}
            >
              {baseHeight >= 30 && (
                <div style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.onAccent,
                  fontSize: 22,
                  fontWeight: 700,
                  opacity: colFigureOpacity,
                  transition: reduceMotion ? "none" : "opacity 200ms ease"
                }}>
                  {format(amount)}
                </div>
              )}
              {baseHeight < 30 && (
                <div style={{
                  position: "absolute",
                  left: 0,
                  top: -22,
                  width: "100%",
                  textAlign: "center",
                  color: theme.onAccent,
                  fontSize: 22,
                  fontWeight: 700
                }}>
                  {format(amount)}
                </div>
              )}
            </ChartBar>
            {b(2) && (
              <ChartBar
                x={col.x}
                y={interestTop}
                w={bw}
                h={interestHeight}
                bg={theme.paleGain}
                color={theme.gain}
                topRadius={12}
                bottomRadius={0}
                reduceMotion={reduceMotion}
              >
                {col.interestHeight >= 30 ? (
                  <div style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: theme.gain,
                    fontSize: 22,
                    fontWeight: 700,
                    opacity: figureOpacity,
                    transition: reduceMotion ? "none" : "opacity 200ms ease"
                  }}>
                    {"+" + format(Math.round(col.count))}
                  </div>
                ) : (
                  <div style={{
                    position: "absolute",
                    left: 0,
                    top: -22,
                    width: "100%",
                    textAlign: "center",
                    color: theme.gain,
                    fontSize: 22,
                    fontWeight: 700
                  }}>
                    {"+" + format(Math.round(col.count))}
                  </div>
                )}
              </ChartBar>
            )}
            <div style={{
              position: "absolute",
              left: col.x,
              top: axisY + 10,
              width: bw,
              textAlign: "center",
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.3,
              whiteSpace: "pre-line",
              color: theme.text,
              opacity: b(1) ? 1 : 0,
              transition: reduceMotion ? "none" : "opacity 450ms ease"
            }}>
              {col.label}
            </div>
          </React.Fragment>
        );
      })}
      {b(3) && (
        <div style={{
          position: "absolute",
          left: 0,
          top: headY + (1 - gapTween) * 14,
          width: W,
          textAlign: "center",
          opacity: gapTween
        }}>
          <div style={{ fontSize: 44, fontFamily: theme.fontFigure, color: theme.gain, fontWeight: 700 }}>{format(Math.round(gapCount))}</div>
          <div style={{ fontSize: 14, color: theme.muted, marginTop: 4 }}>{labels.gapLabel}</div>
        </div>
      )}
    </StageFrame>
  );
}

export function InterestSteps({ active, reduceMotion, theme, ariaLabel, format, intro, labels, onSettled, interest, exempt, taxable, tax, kept, received }) {
  const stage = useStage(reduceMotion);
  const { W, H, A } = stage;
  const lead = introLead(intro, 0.69);
  const offsets = [0, 3100, 5800, 8500, 12000, 12500];
  const beat = useBeats(active, reduceMotion, offsets.map(t => lead + t), onSettled);
  const captionBeat = useBeats(active, reduceMotion, offsets.map(t => Math.max(0, lead + t - CAPTION_LEAD)));
  const b = i => reduceMotion || beat > i;
  const captions = [labels.captionInterest, labels.captionExempt, labels.captionTaxable, labels.captionSplit, labels.captionPayoff, null];
  let text = intro;
  if (!reduceMotion) {
    const idx = Math.min(captionBeat - 1, captions.length - 1);
    for (let i = idx; i >= 0; i--) {
      if (captions[i]) { text = captions[i]; break; }
    }
  }

  const axisY = H - 60;
  const stackTop = A + 26;
  const chartH = axisY - stackTop;
  const gapX = 8;
  const cw = (W - 20 - 3 * gapX) / 4;
  const x = i => 10 + i * (cw + gapX);
  const h = v => Math.round(chartH * v / interest);

  const exemptH = h(exempt);
  const taxableH = chartH - exemptH;
  const taxH = h(tax);
  const keptH = Math.max(0, taxableH - taxH - (taxH > 0 ? 2 : 0));
  const topY = axisY - chartH;
  const levelY = axisY - taxableH;

  const interestGrow = useTween(b(0), 800, reduceMotion);
  const exemptGrow = useTween(b(1), 800, reduceMotion);
  const taxableGrow = useTween(b(2), 700, reduceMotion);
  const splitGrow = useTween(b(3), 600, reduceMotion);
  const chartFade = useTween(b(4), 500, reduceMotion);
  const tilesIn = b(5);

  const figure = (value, color, grow, height, label) => (
    <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color, opacity: height >= 30 ? clamp((grow - 0.7) / 0.3, 0, 1) : 0 }}>
      {label && <div style={{ fontSize: 12, lineHeight: "15px" }}>{label}</div>}
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
  const rule = (left, right, y, on) => (
    <div style={{ position: "absolute", left, top: y, width: Math.max(0, right - left), height: 1, borderTop: `1px dashed ${theme.neutral}`, opacity: on ? 0.5 : 0, transition: reduceMotion ? "none" : "opacity 400ms ease" }} />
  );
  const columnNames = [labels.interestCol, labels.exemptCol, labels.taxableCol, labels.splitCol];
  const taxLabelled = taxH >= 52, keptLabelled = keptH >= 52;
  const keptGrown = keptH * splitGrow;
  const taxGrown = taxH * splitGrow;
  const tileH = 170;
  const firstTileTop = A - 26;
  const secondTileTop = firstTileTop + tileH + 44;
  const tile = (top, delay, background, color, title, value, working) => (
    <div style={{ position: "absolute", left: 0, top: tilesIn ? top : top + 14, width: W, height: tileH, background, borderRadius: 18, opacity: tilesIn ? 1 : 0, transition: reduceMotion ? "none" : `opacity 450ms ${EASE_ENTRANCE} ${delay}ms, top 450ms ${EASE_ENTRANCE} ${delay}ms` }}>
      <div style={{ position: "absolute", left: 0, top: 22, width: "100%", textAlign: "center", fontSize: 14, fontWeight: 700, color }}>{title}</div>
      <div style={{ position: "absolute", left: 0, top: 54, width: "100%", textAlign: "center", fontSize: 46, fontFamily: theme.fontFigure, fontWeight: 700, color }}>{value}</div>
      {working && <div style={{ position: "absolute", left: 0, top: 122, width: "100%", textAlign: "center", fontSize: 13, color }}>{working}</div>}
    </div>
  );

  return (
    <StageFrame stage={stage} ariaLabel={ariaLabel}>
      <TextZone text={text} active={active} reduceMotion={reduceMotion} W={W} theme={theme} />
      {!tilesIn && (
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, opacity: 1 - chartFade, pointerEvents: "none" }}>
          <div style={{ position: "absolute", left: 0, top: axisY, width: W, height: 1, background: theme.neutral, opacity: b(0) ? 0.5 : 0, transition: reduceMotion ? "none" : "opacity 450ms ease" }} />
          {columnNames.map((label, i) => b(i) && (
            <div key={i} style={{ position: "absolute", left: x(i), top: axisY + 8, width: cw, textAlign: "center", fontSize: 12, color: theme.muted, fontFamily: theme.fontBody }}>{label}</div>
          ))}
          <ChartBar x={x(0)} y={axisY - chartH * interestGrow} w={cw} h={chartH * interestGrow} bg={theme.gain} color={theme.onAccent} topRadius={12} reduceMotion={reduceMotion}>
            {figure(format(interest), theme.onAccent, interestGrow, chartH * interestGrow)}
          </ChartBar>
          {rule(x(0) + cw, x(1), topY, b(1))}
          {exempt > 0 ? (
            <ChartBar x={x(1)} y={topY} w={cw} h={exemptH * exemptGrow} bg={theme.paleGain} color={theme.gain} topRadius={12} bottomRadius={12} reduceMotion={reduceMotion}>
              {figure(format(exempt), theme.gain, exemptGrow, exemptH * exemptGrow)}
            </ChartBar>
          ) : b(1) && (
            <div style={{ position: "absolute", left: x(1), top: topY + 8, width: cw, textAlign: "center", color: theme.muted, fontSize: 20, fontWeight: 700 }}>{format(0)}</div>
          )}
          {rule(x(1) + cw, x(2), levelY, b(2))}
          <ChartBar x={x(2)} y={axisY - taxableH * taxableGrow} w={cw} h={taxableH * taxableGrow} bg={theme.neutral} color={theme.onAccent} topRadius={12} reduceMotion={reduceMotion}>
            {figure(format(taxable), theme.onAccent, taxableGrow, taxableH * taxableGrow)}
          </ChartBar>
          {rule(x(2) + cw, x(3), levelY, b(3))}
          {taxable === 0 && [[2, 2], [3, 3]].map(([col, at]) => b(at) && (
            <div key={col} style={{ position: "absolute", left: x(col), top: axisY - 28, width: cw, textAlign: "center", color: theme.muted, fontSize: 20, fontWeight: 700 }}>{format(0)}</div>
          ))}
          {b(3) && (
            <>
              <ChartBar x={x(3)} y={axisY - keptGrown} w={cw} h={keptGrown} bg={theme.paleGain} color={theme.gain} reduceMotion={reduceMotion}>
                {figure(format(kept), theme.gain, splitGrow, keptGrown, keptLabelled ? labels.toUser : null)}
              </ChartBar>
              <ChartBar x={x(3)} y={axisY - keptGrown - 2 - taxGrown} w={cw} h={taxGrown} bg={theme.cost} color={theme.onAccent} topRadius={12} reduceMotion={reduceMotion}>
                {figure("(" + format(tax) + ")", theme.onAccent, splitGrow, taxGrown, taxLabelled ? labels.toTaxman : null)}
              </ChartBar>
              {tax > 0 && taxH < 30 && (
                <div style={{ position: "absolute", left: x(3), top: levelY - 26, width: cw, textAlign: "center", color: theme.cost, fontSize: 20, fontWeight: 700, opacity: splitGrow }}>{"(" + format(tax) + ")"}</div>
              )}
            </>
          )}
        </div>
      )}
      {tile(firstTileTop, 0, theme.paleGain, theme.gain, labels.receiveTitle, format(received), labels.receiveWorking)}
      {tax > 0
        ? tile(secondTileTop, 100, theme.cost, theme.onAccent, labels.taxTitle, "(" + format(tax) + ")", null)
        : tile(secondTileTop, 100, theme.tile, theme.muted, labels.taxTitle, format(0), null)}
    </StageFrame>
  );
}

export function CashCompare({ active, reduceMotion, theme, ariaLabel, format, intro, labels, onSettled, amount, interest, tax, received, saved }) {
  const stage = useStage(reduceMotion);
  const { W, H, A } = stage;
  const lead = introLead(intro, 0.69);
  const offsets = [0, 2400, 4900, 7400, 9800, 12400];
  const beat = useBeats(active, reduceMotion, offsets.map(t => lead + t), onSettled);
  const captionBeat = useBeats(active, reduceMotion, offsets.map(t => Math.max(0, lead + t - CAPTION_LEAD)));
  const b = i => reduceMotion || beat > i;
  const captions = [
    labels.captionTwo,
    labels.captionWrap,
    labels.captionEarn,
    labels.captionTax,
    null,
    labels.captionSaved
  ];
  let text = intro;
  if (!reduceMotion) {
    const idx = Math.min(captionBeat - 1, captions.length - 1);
    for (let i = idx; i >= 0; i--) {
      if (captions[i]) { text = captions[i]; break; }
    }
  }

  const tw = (W - 18) / 2;
  const nameTop = A - 34;
  const tileTop = nameTop + 36;
  const tileH = Math.min(360, H - tileTop - 130);
  const r = tileH / 5;

  const tileTween = useTween(b(0), 450, reduceMotion);
  const outlineT = useTween(b(1), 1000, reduceMotion);
  const interestCount = useCountUp(interest, b(2), 800, reduceMotion);
  const receiveTween = useTween(b(4), 700, reduceMotion);
  const savedTween = useTween(b(5), 450, reduceMotion);

  // What's received fills each tile from the bottom, in proportion to the amount.
  const fillH = tile => 1.9 * r * (tile.isLeft ? 1 : received / interest) * receiveTween;

  const tileRise = (1 - tileTween) * 14;
  const currentTileTop = tileTop + tileRise;

  const savedTopBase = tileTop + tileH + 20;
  const savedTop = savedTopBase + (1 - savedTween) * 14;

  const tiles = [
    { side: "left", x: 0, name: labels.inside, isLeft: true },
    { side: "right", x: W - tw, name: labels.outside, isLeft: false }
  ];

  return (
    <StageFrame stage={stage} ariaLabel={ariaLabel}>
      <TextZone text={text} active={active} reduceMotion={reduceMotion} W={W} theme={theme} />
      {tiles.map((tile, i) => (
        <div key={i} style={{
          position: "absolute",
          left: tile.x,
          top: currentTileTop,
          width: tw,
          height: tileH,
          background: theme.tile,
          borderRadius: 18,
          boxShadow: TILE_SHADOW,
          opacity: tileTween,
          transition: reduceMotion ? "none" : "opacity 450ms ease"
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 1.2 * r, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: theme.text, textAlign: "center", fontFamily: theme.fontBody }}>{format(amount)}</div>
          </div>
          <div style={{ position: "absolute", top: 1.65 * r - 26, left: 0, width: "100%", height: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: b(2) ? 1 : 0, transition: reduceMotion ? "none" : "opacity 450ms ease" }}>
            <div style={{ fontSize: 12.5, color: theme.muted, textAlign: "center" }}>{labels.interestRow}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: theme.text, textAlign: "center" }}>{"+" + format(Math.round(interestCount))}</div>
          </div>
          <div style={{ position: "absolute", top: 2.55 * r - 26, left: 0, width: "100%", height: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: b(3) ? 1 : 0, transition: reduceMotion ? "none" : "opacity 450ms ease" }}>
            <div style={{ fontSize: 12.5, color: theme.muted, textAlign: "center" }}>{labels.taxRow}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: tile.isLeft ? theme.gain : theme.cost, textAlign: "center" }}>{tile.isLeft ? labels.noTax : "(" + format(tax) + ")"}</div>
          </div>
          <div style={{ position: "absolute", left: 0, top: tileH - fillH(tile), width: "100%", height: fillH(tile), background: theme.paleGain, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ opacity: clamp((receiveTween - 0.6) / 0.4, 0, 1), textAlign: "center" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: theme.gain }}>{labels.receiveRow}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: theme.gain }}>{tile.isLeft ? format(interest) : format(received)}</div>
            </div>
          </div>
        </div>
      ))}
      <div style={{ position: "absolute", left: tw / 2 - 46, top: nameTop, width: 92, height: 28, borderRadius: 14, background: theme.gain, color: theme.onAccent, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: theme.fontBody, fontSize: 12, fontWeight: 700, opacity: b(1) ? 1 : 0, transition: reduceMotion ? "none" : `opacity 260ms ${EASE_LANDING}` }}>
        <svg width="12" height="14" viewBox="0 0 12 14">
          <path d="M6 1 L11 3 V7 C11 10 8.5 12 6 13 C3.5 12 1 10 1 7 V3 Z" fill="none" stroke={theme.onAccent} strokeWidth="1.5" />
        </svg>
        {labels.inside}
      </div>
      <div style={{ position: "absolute", left: W - tw, top: nameTop, width: tw, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: theme.muted, fontFamily: theme.fontBody, fontSize: 14, opacity: b(1) ? 1 : 0, transition: reduceMotion ? "none" : "opacity 300ms ease 600ms" }}>
        {labels.outside}
      </div>
      <svg width={tw + 10} height={tileH + 10} viewBox={`0 0 ${tw + 10} ${tileH + 10}`} style={{ position: "absolute", left: -5, top: currentTileTop - 5, pointerEvents: "none", overflow: "visible" }}>
        <rect x={1.5} y={1.5} width={tw + 7} height={tileH + 7} rx={21} fill="none" stroke={theme.gain} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - outlineT} />
      </svg>
      <div style={{
        position: "absolute",
        left: 0,
        top: savedTop,
        width: W,
        textAlign: "center",
        opacity: savedTween,
        transition: reduceMotion ? "none" : `opacity 450ms ${EASE_ENTRANCE}`
      }}>
        <div style={{ fontSize: 44, fontFamily: theme.fontFigure, color: theme.gain, fontWeight: 700 }}>{format(saved)}</div>
        <div style={{ fontSize: 14, color: theme.muted, marginTop: 4 }}>{labels.savedLabel}</div>
      </div>
    </StageFrame>
  );
}

// The returns curve on page 4: an illustrative bell, with the average at its centre.
const BELL_POINTS = 80, BELL_SPAN = 12, BELL_SD = 1.9;
const BELL_MEAN = 0.5;
const bellValue = u => Math.exp(-((u - BELL_SPAN * BELL_MEAN) ** 2) / (2 * BELL_SD ** 2));

export function PrizeDraws({ active, reduceMotion, theme, ariaLabel, format, intro, labels, onSettled, amount, ratePct, rateText, draws }) {
  const stage = useStage(reduceMotion);
  const { W, H, A } = stage;
  const lead = introLead(intro, 0.83);
  const offsets = [0, 2000, 5000, 7800, 11000, 11800, 12200, 13500, 14100, 14700, 18500, 19300, 22800, 23300];
  const beat = useBeats(active, reduceMotion, offsets.map(t => lead + t), onSettled);
  const captionBeat = useBeats(active, reduceMotion, offsets.map(t => Math.max(0, lead + t - CAPTION_LEAD)));
  const b = i => reduceMotion || beat > i;
  const captions = [labels.captionDraws, null, labels.captionSum, labels.captionRate, labels.captionAverage, null, null, null, null, labels.captionLuck, labels.captionTax, null, labels.captionGuarantee, null];
  let text = intro;
  if (!reduceMotion) {
    const idx = Math.min(captionBeat - 1, captions.length - 1);
    for (let i = idx; i >= 0; i--) {
      if (captions[i]) { text = captions[i]; break; }
    }
  }

  // The figure above the calendar, then the calendar.
  const headTop = A - 34;
  const gapG = 10;
  const cw = (W - 3 * gapG) / 4;
  const gridTop = headTop + 136;
  const ch = Math.min(cw * 1.1, (H - gridTop - 20 - 2 * gapG) / 3);
  const MONTH_MS = 215, FLIP_MS = 240;
  // useLinearRise counts in whole numbers, so these run in thousandths.
  const enterTimeline = useLinearRise(15000, b(0), 15 * 45, reduceMotion) / 1000;
  const flipTimeline = useLinearRise(12000, b(1), 12 * MONTH_MS, reduceMotion) / 1000;
  const calendarFade = useTween(b(4), 700, reduceMotion);
  const won = draws.reduce((sum, d, i) => sum + d.prize * clamp(flipTimeline - i, 0, 1), 0);
  const heldIn = useTween(b(0), 450, reduceMotion);

  // The curve.
  const axisY = H - 92;
  const curveTop = A + 84;
  const curveH = axisY - curveTop;
  const curveDraw = useTween(b(6), 1200, reduceMotion);
  const point = i => [W * i / BELL_POINTS, axisY - curveH * bellValue(BELL_SPAN * i / BELL_POINTS)];
  const line = Array.from({ length: BELL_POINTS + 1 }, (_, i) => point(i).map(v => v.toFixed(1)).join(",")).join(" L ");
  // Luck: the line and its figure move up once and down once, then settle back.
  const swingT = useLinearRise(1000, b(9), 3200, reduceMotion) / 1000;
  const swing = swingT > 0 && swingT < 1 ? Math.sin(swingT * Math.PI * 2) : 0;
  const meanFraction = BELL_MEAN + 0.055 * swing;
  const meanX = W * meanFraction;
  const shownRate = swing === 0 ? rateText : `${(ratePct + 0.45 * swing).toFixed(2)}%`;
  const markerT = useTween(b(7), 500, reduceMotion);
  // The line always ends on the curve, wherever it has moved to.
  const markerY = axisY - curveH * bellValue(BELL_SPAN * meanFraction) * markerT;
  const bellFade = useTween(b(10), 600, reduceMotion);

  // The comparison it ends on: two columns under their headings.
  const compareIn = useTween(b(11), 450, reduceMotion);
  const lastRowsIn = useTween(b(13), 450, reduceMotion);
  const colW = (W - 18) / 2;
  const compareTop = A + 16;
  const headH = 46;
  const rowH = Math.min(128, (H - compareTop - headH - 24) / 3);
  const columns = [
    { x: 0, name: labels.bondsName, tax: labels.taxBonds, taxColor: theme.gain, pays: labels.paysBonds, rate: labels.rateBonds, note: labels.rateBondsNote },
    { x: W - colW, name: labels.savingsName, tax: labels.taxSavings, taxColor: theme.cost, pays: labels.paysSavings, rate: labels.rateSavings, note: labels.rateSavingsNote },
  ];
  const rows = [
    { label: labels.taxRow, value: c => c.tax, color: c => c.taxColor, opacity: compareIn },
    { label: labels.paysRow, value: c => c.pays, color: () => theme.text, opacity: lastRowsIn },
    { label: labels.rateRow, value: c => c.rate, color: () => theme.text, note: c => c.note, size: 30, opacity: lastRowsIn },
  ];
  const rowTop = i => compareTop + headH + i * rowH;

  return (
    <StageFrame stage={stage} ariaLabel={ariaLabel}>
      <TextZone text={text} active={active} reduceMotion={reduceMotion} W={W} theme={theme} />
      {!b(5) && (
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, opacity: 1 - calendarFade, pointerEvents: "none" }}>
          <div style={{ position: "absolute", left: 0, top: headTop + (1 - heldIn) * 14, width: W, textAlign: "center", opacity: heldIn }}>
            <div style={{ fontSize: 13, color: theme.muted }}>{labels.heldLabel}</div>
            <div style={{ fontSize: 42, lineHeight: 1.2, fontFamily: theme.fontFigure, fontWeight: 700, color: theme.text }}>{format(Math.round(amount + won))}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.gain, minHeight: 20, opacity: b(2) ? 1 : 0, transition: reduceMotion ? "none" : "opacity 400ms ease" }}>{b(3) ? labels.rateLine : labels.sumLine}</div>
          </div>
          {draws.map((draw, i) => {
            const flip = clamp((flipTimeline - i) * MONTH_MS / FLIP_MS, 0, 1);
            return (
              <div key={i} style={{ position: "absolute", left: (i % 4) * (cw + gapG), top: gridTop + Math.floor(i / 4) * (ch + gapG), width: cw, height: ch, perspective: 600, opacity: clamp((enterTimeline - i) / 3, 0, 1) }}>
                <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", transform: `rotateY(${flip * 180}deg)` }}>
                  <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: theme.track, borderRadius: 14, backfaceVisibility: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: theme.muted, fontSize: 13, fontWeight: 700 }}>{draw.label}</div>
                  <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: draw.prize > 0 ? theme.paleGain : theme.tile, borderRadius: 14, boxShadow: draw.prize > 0 ? "none" : TILE_SHADOW, backfaceVisibility: "hidden", transform: "rotateY(180deg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ position: "absolute", top: 7, left: 0, width: "100%", textAlign: "center", fontSize: 11, color: draw.prize > 0 ? theme.gain : theme.muted }}>{draw.label}</div>
                    {draw.prize > 0
                      ? <div style={{ fontSize: 17, fontWeight: 700, color: theme.gain, marginTop: 10 }}>{"+" + format(draw.prize)}</div>
                      : <div style={{ width: 14, height: 2, background: theme.neutral, borderRadius: 1, marginTop: 10 }} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {b(5) && !b(11) && (
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, opacity: 1 - bellFade, pointerEvents: "none" }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <defs><clipPath id="prize-curve-reveal"><rect x={0} y={0} width={W * curveDraw} height={H} /></clipPath></defs>
            <line x1={0} y1={axisY} x2={W} y2={axisY} stroke={theme.neutral} strokeOpacity={0.5} />
            <g clipPath="url(#prize-curve-reveal)">
              <path d={`M 0,${axisY} L ${line} L ${W},${axisY} Z`} fill={theme.paleGain} />
              <path d={`M ${line}`} fill="none" stroke={theme.gain} strokeWidth={2.5} />
            </g>
            <line x1={meanX} y1={axisY} x2={meanX} y2={markerY} stroke={theme.accent} strokeWidth={1.5} strokeDasharray="4 4" />
            <circle cx={meanX} cy={markerY} r={7} fill={theme.accent} stroke={theme.tile} strokeWidth={2.5} opacity={markerT} />
          </svg>
          <div style={{ position: "absolute", left: clamp(meanX - 70, 0, W - 140), top: curveTop - 64, width: 140, textAlign: "center", opacity: markerT }}>
            <div style={{ fontSize: 12.5, color: theme.muted }}>{labels.averageLabel}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{shownRate}</div>
          </div>
          <div style={{ position: "absolute", left: 0, top: axisY + 10, width: W, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: theme.text, opacity: b(8) ? 1 : 0, transition: reduceMotion ? "none" : "opacity 400ms ease" }}>
            <span>{labels.lessLabel}</span><span>{labels.moreLabel}</span>
          </div>
        </div>
      )}
      {columns.map((column, i) => (
        <div key={i} style={{ position: "absolute", left: column.x, top: compareTop + (1 - compareIn) * 14, width: colW, textAlign: "center", fontSize: 18, fontWeight: 700, color: theme.text, opacity: compareIn }}>{column.name}</div>
      ))}
      {rows.map((row, r) => (
        <React.Fragment key={r}>
          <div style={{ position: "absolute", left: 0, top: rowTop(r), width: W, borderTop: `1px dashed ${theme.neutral}`, opacity: 0.5 * row.opacity }} />
          {columns.map((column, i) => (
            <div key={i} style={{ position: "absolute", left: column.x, top: rowTop(r) + 16, width: colW, textAlign: "center", opacity: row.opacity }}>
              <div style={{ fontSize: 12.5, color: theme.muted }}>{row.label}</div>
              <div style={{ fontSize: row.size || 20, lineHeight: 1.25, fontWeight: 700, color: row.color(column), marginTop: 4 }}>{row.value(column)}</div>
              {row.note && <div style={{ fontSize: 13, lineHeight: 1.3, color: theme.muted, marginTop: 2 }}>{row.note(column)}</div>}
            </div>
          ))}
        </React.Fragment>
      ))}
    </StageFrame>
  );
}

export function MonthsStack({ active, reduceMotion, theme, ariaLabel, format, intro, labels, onSettled, markers }) {
  const stage = useStage(reduceMotion);
  const { W, H, A } = stage;
  const lead = introLead(intro);
  const offsets = [0, 1600, 4400, 7200, 10000];
  const beat = useBeats(active, reduceMotion, offsets.map(t => lead + t), onSettled);
  const captionBeat = useBeats(active, reduceMotion, offsets.map(t => Math.max(0, lead + t - CAPTION_LEAD)));
  const b = i => reduceMotion || beat > i;
  const captions = [
    labels.captionBlock,
    labels.captionThree,
    labels.captionSix,
    labels.captionNine,
    labels.captionAccess
  ];
  let text = intro;
  if (!reduceMotion) {
    const idx = Math.min(captionBeat - 1, captions.length - 1);
    for (let i = idx; i >= 0; i--) {
      if (captions[i]) { text = captions[i]; break; }
    }
  }

  const axisY = H - 30;
  const stackTop = A + 16;
  const gapB = 3;
  const bh = (axisY - stackTop - 8 * gapB) / 9;
  const bw = Math.round(W * 0.3);
  const bx = 10;

  const blockData = Array.from({ length: 9 }, (_, i) => {
    const group = i < 3 ? 0 : i < 6 ? 1 : 2;
    const beatIndex = i === 0 ? 0 : group === 0 ? 1 : group === 1 ? 2 : 3;
    const delay = (i === 0) ? 0 : (i - (group === 0 ? 1 : group === 1 ? 3 : 6)) * 180;
    const opacityBase = group === 0 ? 1 : group === 1 ? 0.82 : 0.64;
    const baseTop = axisY - (i + 1) * bh - i * gapB;
    return { i, group, beatIndex, delay, opacityBase, baseTop };
  });

  const highestLanded = (() => {
    let h = -1;
    for (let i = 8; i >= 0; i--) {
      if (b(blockData[i].beatIndex)) { h = i; break; }
    }
    return h;
  })();

  const markerData = [
    { k: 0, i: 2, beat: b(1) },
    { k: 1, i: 5, beat: b(2) },
    { k: 2, i: 8, beat: b(3) }
  ];

  const markerSetBack = (k) => {
    if (reduceMotion) return 0;
    if (k === 0 && b(2) && !b(4)) return 0.5;
    if (k === 1 && b(3) && !b(4)) return 0.5;
    return 0;
  };

  return (
    <StageFrame stage={stage} ariaLabel={ariaLabel}>
      <TextZone text={text} active={active} reduceMotion={reduceMotion} W={W} theme={theme} />
      <div style={{
        position: "absolute",
        left: 0,
        top: axisY,
        width: W,
        height: 1,
        background: theme.neutral,
        opacity: b(0) ? 0.5 : 0,
        transition: reduceMotion ? "none" : "opacity 450ms ease"
      }} />
      {blockData.map(({ i, beatIndex, delay, opacityBase, baseTop }) => {
        const active = b(beatIndex);
        const top = active ? baseTop : baseTop - 24;
        const opacity = active ? opacityBase : 0;
        const topRadius = (i === highestLanded) ? 10 : 0;
        return (
          <div key={i} style={{
            position: "absolute",
            left: bx,
            top,
            width: bw,
            height: bh,
            background: theme.accent,
            opacity,
            borderTopLeftRadius: topRadius,
            borderTopRightRadius: topRadius,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            transition: reduceMotion ? "none" : `top 450ms ${EASE_LANDING}, opacity 450ms ${EASE_LANDING}, border-radius 300ms ease`,
            transitionDelay: active ? `${delay}ms` : "0ms"
          }} />
        );
      })}
      {markerData.map(({ k, i, beat: mkBeat }) => {
        const y = axisY - (i + 1) * bh - i * gapB;
        const marker = markers[k];
        const active = mkBeat;
        const ruleWidth = active ? W - (bx + bw) : 0;
        const textOpacity = active ? 1 : 0;
        const sb = markerSetBack(k);
        return (
          <React.Fragment key={k}>
            <div style={{
              position: "absolute",
              left: bx + bw,
              top: y,
              width: ruleWidth,
              height: 1,
              borderTop: `1px dashed ${theme.neutral}`,
              opacity: 0.5,
              transition: reduceMotion ? "none" : `width 400ms ease ${300}ms`
            }} />
            <div style={{
              position: "absolute",
              left: bx + bw + 14,
              top: y + 8,
              width: W - (bx + bw + 14),
              opacity: textOpacity,
              transition: reduceMotion ? "none" : `opacity 450ms ease ${300}ms`
            }}>
              <div style={setBack(sb)}>
                <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{marker.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: theme.text }}>{format(marker.amount)}</div>
                <div style={{ fontSize: 12.5, color: theme.muted, lineHeight: 1.3 }}>{marker.hint}</div>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </StageFrame>
  );
}
