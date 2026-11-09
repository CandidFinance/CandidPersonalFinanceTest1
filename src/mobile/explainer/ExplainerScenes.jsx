// The animated scenes in a module's walk-through. Each is a short story told
// in beats, on a stage laid out to the space it has (at least 360 by 620). They
// know nothing about the app: words, figures, colours and fonts come in as
// props (lib/moduleExplainer.js, ModuleExplainer.jsx).
import React, { useEffect, useRef, useState } from "react";

const EASE_ENTRANCE = "cubic-bezier(0.2,0.7,0.2,1)";
const EASE_LANDING = "cubic-bezier(0.34,1.56,0.64,1)";
const EASE_GROWTH = "cubic-bezier(0.22,0.61,0.36,1)";
// Fades out inside the page's side margin, so it never meets a hard edge.
const TILE_SHADOW = "0 6px 16px rgba(0,0,0,0.10)";

// How long the opening text holds before the visuals start: its build, then time to read it.
function introLead(intro, pace = 0.6) {
  const words = wordCount(intro);
  return Math.round((words * 55 + Math.max(2500, words * 230)) * pace);
}

// An item that has given way to a newer one: t runs 0 (in focus) to 1 (set back).
const setBack = t => (t > 0 ? { filter: `blur(${2 * t}px)`, opacity: 1 - 0.5 * t } : {});

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function splitWords(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean);
}

function wordCount(text) {
  return splitWords(text).length;
}

function interpArray(t, arr) {
  if (t <= 0) return arr[0];
  if (t >= arr.length - 1) return arr[arr.length - 1];
  const i = Math.floor(t);
  const f = t - i;
  return arr[i] + (arr[i + 1] - arr[i]) * f;
}

function useStage(reduceMotion) {
  const rootRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setDims({ w: r.width, h: r.height });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const minH = reduceMotion ? 720 : 620;
  const rw = dims.w || 360;
  const rh = dims.h || minH;
  const s = Math.min(rw / 360, rh / minH, 1.35);
  const W = rw / s;
  const H = rh / s;
  const A = reduceMotion ? 172 : 146;
  const ready = dims.w > 0 && dims.h > 0;

  return { rootRef, s, W, H, A, ready };
}

function StageFrame({ stage, ariaLabel, children }) {
  const { rootRef, s, W, H, ready } = stage;
  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={ariaLabel}
      style={{
        flex: 1,
        alignSelf: "stretch",
        minHeight: 480,
        position: "relative"
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: H,
          transformOrigin: "top left",
          transform: `scale(${s})`,
          visibility: ready ? "visible" : "hidden"
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Time after the last beat for its animation to finish.
const SETTLE_MS = 1200;

function useBeats(active, reduceMotion, times, onSettled) {
  const [count, setCount] = useState(0);
  const key = times.join("|");

  useEffect(() => {
    let timers = [];
    if (!active) {
      setCount(0);
      return undefined;
    }
    if (reduceMotion) {
      setCount(times.length);
      if (onSettled) onSettled();
      return undefined;
    }
    setCount(0);
    timers = times.map((t, i) =>
      setTimeout(() => {
        setCount(c => Math.max(c, i + 1));
      }, t)
    );
    if (onSettled) timers.push(setTimeout(onSettled, times[times.length - 1] + SETTLE_MS));
    return () => timers.forEach(clearTimeout);
  }, [active, reduceMotion, key]);

  return count;
}

function useCountUp(target, running, ms, reduceMotion, from = 0) {
  const [value, setValue] = useState(from);
  const currentRef = useRef(from);
  const rafRef = useRef();

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!running) {
      currentRef.current = from;
      setValue(from);
      return undefined;
    }
    if (reduceMotion) {
      currentRef.current = target;
      setValue(target);
      return undefined;
    }
    const startValue = currentRef.current;
    const startTime = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - startTime) / ms);
      const v = startValue + (target - startValue) * (1 - Math.pow(1 - t, 3));
      const rounded = Math.round(v);
      currentRef.current = rounded;
      setValue(rounded);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        currentRef.current = target;
        setValue(target);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, running, ms, reduceMotion, from]);

  return value;
}

function useTween(on, ms, reduceMotion) {
  const [value, setValue] = useState(on && reduceMotion ? 1 : 0);
  const valueRef = useRef(value);
  const rafRef = useRef();

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!on) {
      valueRef.current = 0;
      setValue(0);
      return undefined;
    }
    if (reduceMotion) {
      valueRef.current = 1;
      setValue(1);
      return undefined;
    }
    const startValue = valueRef.current;
    const startTime = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - startTime) / ms);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const v = startValue + (1 - startValue) * eased;
      valueRef.current = v;
      setValue(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        valueRef.current = 1;
        setValue(1);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [on, ms, reduceMotion]);

  return value;
}

function useLinearRise(target, running, ms, reduceMotion) {
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);
  const rafRef = useRef();

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!running) {
      valueRef.current = 0;
      setValue(0);
      return undefined;
    }
    if (reduceMotion || ms <= 0) {
      valueRef.current = target;
      setValue(target);
      return undefined;
    }
    const startValue = valueRef.current;
    const startTime = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - startTime) / ms);
      const v = startValue + (target - startValue) * t;
      const rounded = Math.round(v);
      valueRef.current = rounded;
      setValue(rounded);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        valueRef.current = target;
        setValue(target);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, running, ms, reduceMotion]);

  return value;
}

function TextZone({ text, active, reduceMotion, W, theme }) {
  const [displayText, setDisplayText] = useState(text);
  const [visibleCount, setVisibleCount] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const displayRef = useRef(text);

  useEffect(() => {
    let timers = [];
    let rafA;
    let rafB;
    const words = splitWords(text);

    const startBuild = () => {
      setVisibleCount(0);
      rafA = requestAnimationFrame(() => {
        rafB = requestAnimationFrame(() => {
          let i = 0;
          const next = () => {
            i += 1;
            setVisibleCount(i);
            if (i < words.length) {
              timers.push(setTimeout(next, 55));
            }
          };
          next();
        });
      });
    };

    if (!active) {
      setDisplayText(text);
      displayRef.current = text;
      setVisibleCount(0);
      setOpacity(1);
      return undefined;
    }

    if (reduceMotion) {
      setDisplayText(text);
      displayRef.current = text;
      setVisibleCount(words.length);
      setOpacity(1);
      return undefined;
    }

    if (displayRef.current !== text) {
      setOpacity(0);
      timers.push(
        setTimeout(() => {
          setDisplayText(text);
          displayRef.current = text;
          setOpacity(1);
          startBuild();
        }, 180)
      );
    } else {
      setDisplayText(text);
      setOpacity(1);
      startBuild();
    }

    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
    };
  }, [text, active, reduceMotion]);

  const words = splitWords(displayText);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: W,
        color: theme.text,
        fontFamily: theme.fontBody,
        fontSize: reduceMotion ? 19 : 24,
        fontWeight: 500,
        lineHeight: 1.35,
        textAlign: "left",
        opacity,
        transition: reduceMotion ? "none" : "opacity 180ms ease"
      }}
    >
      {words.map((w, i) => (
        <React.Fragment key={`${w}-${i}`}>
          <span
            style={{
              display: "inline-block",
              opacity: i < visibleCount ? 1 : 0,
              transform: `translateY(${i < visibleCount ? 0 : 3}px)`,
              transition: reduceMotion
                ? "none"
                : "opacity 260ms ease, transform 260ms ease"
            }}
          >
            {w}
          </span>
          {i < words.length - 1 ? " " : null}
        </React.Fragment>
      ))}
    </div>
  );
}

export function ShareJourney({
  active,
  reduceMotion,
  theme,
  ariaLabel,
  format,
  intro,
  labels,
  start,
  end,
  points,
  dayLabel,
  onSettled
}) {
  const stage = useStage(reduceMotion);
  const { W, H, A } = stage;
  const lead = introLead(intro, 0.51);
  const offsets = [0, 510, 1275, 2550, 3250, 3550, 5850, 6550, 8550, 9150, 10050, 10950, 12050, 12850];
  const beat = useBeats(active, reduceMotion, offsets.map(t => lead + t), onSettled);
  const b = i => beat > i;

  let caption = labels.captionBuy;
  if (b(8)) caption = labels.captionStack;
  else if (b(6)) caption = labels.captionEnd;
  else if (b(3)) caption = labels.captionMoves;
  const text = reduceMotion ? intro : b(0) ? caption : intro;

  const [pointIndex, setPointIndex] = useState(0);
  const [flash, setFlash] = useState({ on: false, dir: 1 });
  const [pressed, setPressed] = useState(false);

  const clicked = b(2);
  const startMarkerOn = b(4);
  const movementsOn = b(5);
  const endReached = b(7);
  const shrink = useTween(b(9), 900, reduceMotion);
  const leftGrow = useTween(b(10), 800, reduceMotion);
  const rightGrow = useTween(b(11), 800, reduceMotion);
  const gainGrow = useTween(b(12), 700, reduceMotion);
  const axisT = useTween(b(3), 700, reduceMotion);

  useEffect(() => {
    if (!active) {
      setPointIndex(0);
      return undefined;
    }
    if (reduceMotion) {
      setPointIndex(30);
      return undefined;
    }
    if (!movementsOn) {
      if (!startMarkerOn) setPointIndex(0);
      return undefined;
    }
    let timers = [];
    let idx = 0;
    const delays = [170, 140, 110, 85, 70];
    const runNext = () => {
      if (idx >= 30) return;
      const delay = idx < 5 ? delays[idx] : 50;
      const t = setTimeout(() => {
        idx += 1;
        setPointIndex(idx);
        runNext();
      }, delay);
      timers.push(t);
    };
    runNext();
    return () => timers.forEach(clearTimeout);
  }, [active, reduceMotion, startMarkerOn, movementsOn]);

  useEffect(() => {
    if (!active || reduceMotion || pointIndex === 0) {
      setFlash({ on: false, dir: 1 });
      return undefined;
    }
    const dir = points[pointIndex] >= points[pointIndex - 1] ? 1 : -1;
    setFlash({ on: true, dir });
    const t = setTimeout(() => setFlash(f => ({ ...f, on: false })), 220);
    return () => clearTimeout(t);
  }, [pointIndex, active, reduceMotion, points]);

  useEffect(() => {
    if (!active || !clicked || reduceMotion) {
      setPressed(false);
      return undefined;
    }
    setPressed(true);
    const t = setTimeout(() => setPressed(false), 130);
    return () => clearTimeout(t);
  }, [active, clicked, reduceMotion]);

  const displayPoint = endReached ? 30 : pointIndex;
  const currentValue = points[displayPoint];
  const priceColor = endReached
    ? theme.gain
    : flash.on
      ? flash.dir > 0
        ? theme.gain
        : theme.cost
      : theme.text;

  const minV = Math.min(...points);
  const maxV = Math.max(...points);
  const spanV = maxV - minV || 1;
  const chartX0 = lerp(22, Math.max(200, Math.round(W * 0.56)), shrink);
  const chartX1 = lerp(W - 22, W - 14, shrink);
  const plotTop = lerp(A + 194, A + 6, shrink);
  const plotBottom = lerp(A + 364, A + 46, shrink);
  const chartAxisY = lerp(A + 384, A + 54, shrink);
  const markerScale = lerp(1, 0.6, shrink);
  const pointX = i => chartX0 + ((chartX1 - chartX0) * i) / 30;
  const pointY = v => plotTop + ((maxV - v) / spanV) * (plotBottom - plotTop);

  const linePoints = pointIndex > 0
    ? points
        .slice(0, pointIndex + 1)
        .map((v, i) => `${pointX(i)},${pointY(v)}`)
        .join(" ")
    : "";

  // The line chart ends here once it has moved up; the bars stay well clear of it.
  const chartBottom = A + 72;
  const axisY = H - 30;
  const chartGap = Math.round((axisY - chartBottom) * 0.2);
  const stackTop = chartBottom + chartGap + 44;
  const stackH = axisY - stackTop;
  const baseH = Math.round(stackH * 0.74);
  const gainH = stackH - baseH - 2;
  const cw = Math.round(W * 0.37);
  const leftX = 10;
  const rightX = W - 10 - cw;
  const leftHeight = baseH * leftGrow;
  const rightHeight = baseH * rightGrow;
  const rightTopFull = axisY - baseH;
  const gainHeight = gainH * gainGrow;
  const gainTop = rightTopFull - 2 - gainHeight;
  const figureOpacity = v => clamp((v - 0.55) / 0.45, 0, 1);
  // Centred above the chart, then a compact tile to its left.
  const tileW = lerp(260, Math.round(W * 0.46), shrink);
  const tileH = lerp(160, 72, shrink);
  const tileX = lerp((W - 260) / 2, 0, shrink);
  const tileDetail = 1 - clamp(shrink * 2.5, 0, 1);

  return (
    <StageFrame stage={stage} ariaLabel={ariaLabel}>
      <TextZone text={text} active={active} reduceMotion={reduceMotion} W={W} theme={theme} />

      <div
        style={{
          position: "absolute",
          left: tileX,
          top: A,
          width: tileW,
          height: tileH,
          opacity: b(1) ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 250ms ease"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: theme.tile,
            borderRadius: 22,
            boxShadow: TILE_SHADOW,
            transform: `scale(${pressed ? 0.95 : b(1) ? 1 : 0.85})`,
            transition: reduceMotion ? "none" : b(2) && pressed ? "transform 130ms ease" : `transform 400ms ${EASE_LANDING}`
          }}
        >
          <div
            style={{
              position: "absolute",
              left: lerp(18, 10, shrink),
              top: 18,
              width: lerp(60, 36, shrink),
              height: lerp(60, 36, shrink),
              borderRadius: "50%",
              background: theme.accent,
              color: theme.onAccent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: theme.fontBody,
              fontSize: lerp(24, 15, shrink),
              fontWeight: 700
            }}
          >
            {labels.monogram}
          </div>

          <div
            style={{
              position: "absolute",
              left: lerp(90, 54, shrink),
              right: 12,
              top: lerp(18, 11, shrink),
              color: theme.text,
              fontFamily: theme.fontBody,
              fontSize: lerp(21, 14, shrink),
              fontWeight: 700,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {labels.company}
          </div>

          <div
            style={{
              position: "absolute",
              left: 90,
              right: 12,
              top: 46,
              opacity: tileDetail,
              color: theme.muted,
              fontFamily: theme.fontBody,
              fontSize: 14,
              whiteSpace: "nowrap"
            }}
          >
            {labels.oneShare}
          </div>

          <div
            style={{
              position: "absolute",
              left: 90,
              right: 12,
              top: 66,
              opacity: tileDetail,
              color: theme.muted,
              fontFamily: theme.fontBody,
              fontSize: 13,
              whiteSpace: "nowrap"
            }}
          >
            {endReached ? labels.endLabel : dayLabel(displayPoint)}
          </div>

          <div
            style={{
              position: "absolute",
              left: lerp(130, 54, shrink),
              bottom: lerp(14, 9, shrink),
              transform: `translateX(${lerp(-50, 0, shrink)}%)`,
              whiteSpace: "nowrap",
              color: priceColor,
              fontFamily: theme.fontFigure,
              fontSize: lerp(48, 24, shrink),
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              transition: reduceMotion ? "none" : "color 200ms ease"
            }}
          >
            {format(currentValue)}
          </div>

          <div
            style={{
              position: "absolute",
              right: 20,
              bottom: 28,
              width: 9,
              height: 9,
              opacity: flash.on && !endReached ? 1 : 0,
              transition: reduceMotion ? "none" : "opacity 120ms ease"
            }}
          >
            <svg width="9" height="9" viewBox="0 0 9 9">
              {flash.dir > 0 ? (
                <path d="M4.5 1 L8 7 L1 7 Z" fill={theme.gain} />
              ) : (
                <path d="M4.5 8 L1 2 L8 2 Z" fill={theme.cost} />
              )}
            </svg>
          </div>

          <div
            style={{
              position: "absolute",
              inset: -2.5,
              border: `2.5px solid ${theme.accent}`,
              borderRadius: 24,
              opacity: clicked ? 1 : 0,
              pointerEvents: "none",
              transition: reduceMotion ? "none" : "opacity 200ms ease"
            }}
          />

          <div
            style={{
              position: "absolute",
              right: -10,
              top: -10,
              width: 22,
              height: 22,
              borderRadius: 11,
              background: theme.accent,
              opacity: clicked ? 1 : 0,
              transition: reduceMotion ? "none" : `opacity 220ms ${EASE_LANDING}, transform 220ms ${EASE_LANDING}`,
              transform: `scale(${clicked ? 1 : 0.7})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path
                d="M2.4 6.2 L5 8.7 L9.8 3.5"
                fill="none"
                stroke={theme.onAccent}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
      >
        {linePoints ? (
          <polyline
            points={linePoints}
            fill="none"
            stroke={theme.accent}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {Array.from({ length: pointIndex }, (_, i) => i + 1).map(i => (
          <circle
            key={`dot-${i}`}
            cx={pointX(i)}
            cy={pointY(points[i])}
            r={2.5 * markerScale}
            fill={theme.accent}
          />
        ))}

        {movementsOn && pointIndex > 0 ? (
          <>
            <circle cx={pointX(pointIndex)} cy={pointY(points[pointIndex])} r={5 * markerScale} fill={theme.gain} opacity={0.22} />
            <circle cx={pointX(pointIndex)} cy={pointY(points[pointIndex])} r={2.5 * markerScale} fill={theme.gain} />
          </>
        ) : null}

        <g opacity={startMarkerOn ? 1 : 0}>
          <circle
            cx={pointX(0)}
            cy={pointY(points[0])}
            r={6 * markerScale}
            fill={theme.tile}
            stroke={theme.accent}
            strokeWidth={2}
          />
          <text
            x={pointX(0)}
            y={pointY(points[0]) + 6 * markerScale + 13}
            textAnchor="middle"
            fill={theme.text}
            fontFamily={theme.fontBody}
            fontSize={11}
            fontVariantNumeric="tabular-nums"
            opacity={1 - shrink}
          >
            {format(start)}
          </text>
          <text
            x={pointX(0)}
            y={chartAxisY + 16}
            textAnchor="start"
            fill={theme.muted}
            fontFamily={theme.fontBody}
            fontSize={11}
          >
            {labels.startAxis}
          </text>
        </g>

        {axisT > 0 ? (
          <line
            x1={pointX(0)}
            y1={chartAxisY}
            x2={lerp(pointX(0), pointX(30), axisT)}
            y2={chartAxisY}
            stroke={theme.muted}
            strokeWidth={1}
          />
        ) : null}

        <g opacity={endReached ? 1 : 0}>
          <circle
            cx={pointX(30)}
            cy={pointY(points[30])}
            r={7 * markerScale}
            fill={theme.tile}
            stroke={theme.gain}
            strokeWidth={2}
          />
          <text
            x={pointX(30)}
            y={pointY(points[30]) - 7 * markerScale - 6}
            textAnchor="end"
            fill={theme.gain}
            fontFamily={theme.fontBody}
            fontSize={11}
            fontWeight={700}
            fontVariantNumeric="tabular-nums"
          >
            {format(end)}
          </text>
        </g>

        <text
          x={pointX(30)}
          y={chartAxisY + 16}
          textAnchor="end"
          fill={theme.muted}
          fontFamily={theme.fontBody}
          fontSize={11}
          style={{
            opacity: endReached ? 1 : 0,
            transform: `translateY(${endReached ? 0 : 6}px)`,
            transition: reduceMotion ? "none" : `opacity 300ms ease, transform 360ms ${EASE_LANDING}`
          }}
        >
          {labels.endAxis}
        </text>
      </svg>

      <div
        style={{
          position: "absolute",
          left: leftX,
          top: axisY - leftHeight,
          width: cw,
          height: leftHeight,
          background: theme.accent,
          borderRadius: "12px 12px 0 0",
          opacity: b(10) ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 200ms ease"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.onAccent,
            fontFamily: theme.fontBody,
            fontSize: 30,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            opacity: figureOpacity(leftGrow)
          }}
        >
          {format(start)}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: leftX,
          top: H - 24,
          width: cw,
          height: 20,
          textAlign: "center",
          color: theme.muted,
          fontFamily: theme.fontBody,
          fontSize: 13,
          lineHeight: "20px",
          whiteSpace: "nowrap",
          opacity: leftGrow
        }}
      >
        {labels.paidColumn}
      </div>

      <div
        style={{
          position: "absolute",
          left: rightX,
          top: axisY - rightHeight,
          width: cw,
          height: rightHeight,
          background: theme.accent,
          borderTopLeftRadius: gainGrow > 0 ? 0 : 12,
          borderTopRightRadius: gainGrow > 0 ? 0 : 12,
          opacity: b(11) ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 200ms ease"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.onAccent,
            fontFamily: theme.fontBody,
            fontSize: 30,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            opacity: figureOpacity(rightGrow)
          }}
        >
          {format(start)}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: rightX,
          top: H - 24,
          width: cw,
          height: 20,
          textAlign: "center",
          color: theme.muted,
          fontFamily: theme.fontBody,
          fontSize: 13,
          lineHeight: "20px",
          whiteSpace: "nowrap",
          opacity: rightGrow
        }}
      >
        {labels.nowColumn}
      </div>

      <div
        style={{
          position: "absolute",
          left: rightX,
          top: gainTop,
          width: cw,
          height: gainHeight,
          background: theme.gain,
          borderRadius: "12px 12px 0 0",
          opacity: b(12) ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 160ms ease"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.onAccent,
            fontFamily: theme.fontBody,
            fontSize: 30,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            opacity: figureOpacity(gainGrow)
          }}
        >
          {`+${format(end - start)}`}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: rightX,
          top: stackTop - 44,
          width: cw,
          height: 38,
          textAlign: "center",
          color: theme.text,
          fontFamily: theme.fontBody,
          fontSize: 30,
          fontWeight: 700,
          lineHeight: "38px",
          fontVariantNumeric: "tabular-nums",
          opacity: b(13) ? 1 : 0,
          transform: `scale(${b(13) ? 1 : 0.8})`,
          transition: reduceMotion ? "none" : `opacity 260ms ${EASE_LANDING}, transform 360ms ${EASE_LANDING}`
        }}
      >
        {format(end)}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: chartBottom + chartGap / 2,
          borderTop: `1px dashed ${theme.muted}`,
          opacity: b(10) ? 0.45 : 0,
          transition: reduceMotion ? "none" : "opacity 400ms ease"
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          top: H - 30,
          width: W,
          height: 1,
          background: theme.muted,
          opacity: b(10) ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 260ms ease"
        }}
      />
    </StageFrame>
  );
}

export function GainTaxedStack({
  active,
  reduceMotion,
  theme,
  ariaLabel,
  format,
  intro,
  labels,
  paid,
  gain,
  tax,
  keep,
  onSettled
}) {
  const stage = useStage(reduceMotion);
  const { W, H, A } = stage;
  const lead = introLead(intro);
  const offsets = [0, 500, 1600, 3600, 4400, 6400, 7200, 8600, 10400, 11200, 12300, 12800, 14800, 15400];
  const beat = useBeats(active, reduceMotion, offsets.map(t => lead + t * 0.7), onSettled);
  const b = i => beat > i;

  let caption = labels.captionPaid;
  if (b(12)) caption = labels.captionEnd;
  else if (b(8)) caption = labels.captionSplit;
  else if (b(5)) caption = labels.captionPull;
  else if (b(3)) caption = labels.captionGain;
  const text = reduceMotion ? intro : b(0) ? caption : intro;

  const [ring, setRing] = useState({ active: false, t: 0 });
  const stackAppear = useTween(b(1), 400, reduceMotion);
  const pullT = useTween(b(6), 1100, reduceMotion);
  const taxOn = b(9);
  const keepOn = b(11);
  const taxT = useTween(taxOn, 800, reduceMotion);
  const keepT = useTween(keepOn, 800, reduceMotion);
  // Each figure lands as its column finishes growing.
  const landed = v => clamp((v - 0.5) / 0.5, 0, 1);

  useEffect(() => {
    if (!active || !b(4) || reduceMotion) {
      setRing({ active: false, t: 0 });
      return undefined;
    }
    let raf;
    const start = performance.now();
    const total = 1600;
    const tick = now => {
      const elapsed = now - start;
      if (elapsed >= total) {
        setRing({ active: false, t: 0 });
        return;
      }
      const local = (elapsed % 800) / 800;
      setRing({ active: true, t: local });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, b(4), reduceMotion]);

  const axisY = H - 66;
  const top = A + 10;
  const total = axisY - top;
  const baseH = Math.round(total * 0.72);
  const gainH = total - baseH - 2;
  const stackX = (W - 150) / 2;
  const baseTop = axisY - baseH;
  const gainTop = baseTop - 2 - gainH;

  // The waterfall: the gain, the tax taken off it, what's left.
  const inset = 10;
  const figureRoom = 30;
  // One size for every figure in this chart.
  const figureFont = 22;
  const colTop = top + figureRoom;
  const colH = total - figureRoom;
  const cw = Math.round(W * 0.27);
  const colX = i => inset + (i * (W - 2 * inset - cw)) / 2;
  const unit = gain > 0 ? colH / gain : 0;
  const taxH = tax * unit;
  const keepH = keep * unit;

  const pullX = lerp(stackX, colX(0), pullT);
  const pullW = lerp(150, cw, pullT);
  const pullTop = lerp(top, colTop, pullT);
  const pullH = lerp(gainH, colH, pullT);
  const fade = reduceMotion ? "none" : "opacity 260ms ease";

  const columnLabel = (i, label, shown) => (
    <div
      style={{
        position: "absolute",
        left: colX(i) - 6,
        top: axisY + 4,
        width: cw + 12,
        height: 20,
        textAlign: "center",
        color: theme.muted,
        fontFamily: theme.fontBody,
        fontSize: 12,
        lineHeight: "20px",
        whiteSpace: "nowrap",
        opacity: shown ? 1 : 0,
        transition: fade
      }}
    >
      {label}
    </div>
  );

  return (
    <StageFrame stage={stage} ariaLabel={ariaLabel}>
      <TextZone text={text} active={active} reduceMotion={reduceMotion} W={W} theme={theme} />

      <div
        style={{
          position: "absolute",
          left: stackX,
          top: baseTop,
          width: 150,
          height: baseH,
          background: theme.accent,
          opacity: stackAppear * (1 - clamp(pullT * 3, 0, 1))
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.onAccent,
            fontFamily: theme.fontBody,
            fontSize: figureFont,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {format(paid)}
        </div>

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "calc(50% + 24px)",
            transform: "translateX(-50%)",
            padding: "4px 9px",
            borderRadius: 999,
            background: theme.gain,
            color: theme.onAccent,
            fontFamily: theme.fontBody,
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: "nowrap",
            opacity: b(2) ? 1 : 0,
            transition: reduceMotion ? "none" : `opacity 260ms ${EASE_LANDING}, transform 260ms ${EASE_LANDING}`,
            scale: b(2) ? 1 : 0.8
          }}
        >
          {labels.noTax}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: pullX,
          top: pullTop,
          width: pullW,
          height: pullH,
          background: theme.gain,
          borderRadius: "12px 12px 0 0",
          opacity: stackAppear
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.onAccent,
            fontFamily: theme.fontBody,
            fontSize: figureFont,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            opacity: taxOn ? 0 : 1,
            transition: fade
          }}
        >
          {`+${format(gain)}`}
        </div>

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: Math.max(8, pullH / 2 - 46),
            transform: "translateX(-50%)",
            padding: "3px 7px",
            borderRadius: 999,
            background: theme.paleGain,
            color: theme.gain,
            fontFamily: theme.fontBody,
            fontSize: 10,
            fontWeight: 700,
            whiteSpace: "nowrap",
            opacity: b(7) && !taxOn ? 1 : 0,
            transition: fade
          }}
        >
          {labels.taxableAt}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: colX(0),
          top,
          width: cw,
          height: 26,
          textAlign: "center",
          color: theme.text,
          fontFamily: theme.fontBody,
          fontSize: figureFont,
          fontWeight: 700,
          lineHeight: "26px",
          fontVariantNumeric: "tabular-nums",
          opacity: taxOn ? 1 : 0,
          transform: `scale(${taxOn ? 1 : 0.8})`,
          transition: reduceMotion ? "none" : `opacity 260ms ${EASE_LANDING}, transform 360ms ${EASE_LANDING}`
        }}
      >
        {format(gain)}
      </div>

      <div
        style={{
          position: "absolute",
          left: colX(1),
          top: colTop,
          width: cw,
          height: taxH * taxT,
          background: theme.cost,
          borderRadius: 10,
          overflow: "hidden",
          opacity: taxOn ? 1 : 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.onAccent,
          fontFamily: theme.fontBody,
          fontSize: figureFont,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums"
        }}
      >
        <span style={{ opacity: landed(taxT) }}>{`(${format(tax)})`}</span>
      </div>

      <div
        style={{
          position: "absolute",
          left: colX(2),
          top: axisY - keepH * keepT,
          width: cw,
          height: keepH * keepT,
          background: theme.paleGain,
          borderRadius: "12px 12px 0 0",
          overflow: "hidden",
          opacity: keepOn ? 1 : 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.gain,
          fontFamily: theme.fontBody,
          fontSize: figureFont,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums"
        }}
      >
        <span style={{ opacity: landed(keepT) }}>{format(keep)}</span>
      </div>

      {columnLabel(0, labels.gainCol, taxOn)}
      {columnLabel(1, labels.taxLabel, taxOn)}
      {columnLabel(2, labels.keepLabel, keepOn)}

      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" }}
      >
        <line x1={0} y1={axisY} x2={W} y2={axisY} stroke={theme.muted} strokeWidth={1} opacity={stackAppear} />

        {ring.active ? (
          <rect
            x={stackX - (8 + 6 * ring.t)}
            y={gainTop - (8 + 6 * ring.t)}
            width={150 + 2 * (8 + 6 * ring.t)}
            height={gainH + 2 * (8 + 6 * ring.t)}
            rx={20}
            fill="none"
            stroke={theme.gain}
            strokeWidth={3}
            opacity={1 - ring.t}
          />
        ) : null}

        <line x1={colX(0) + cw} y1={colTop} x2={colX(1)} y2={colTop} stroke={theme.muted} strokeWidth={1} strokeDasharray="4 4" opacity={taxOn ? 1 : 0} />
        <line x1={colX(1) + cw} y1={colTop + taxH} x2={colX(2)} y2={colTop + taxH} stroke={theme.muted} strokeWidth={1} strokeDasharray="4 4" opacity={keepOn ? 1 : 0} />
      </svg>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: H - 24,
          width: W,
          height: 20,
          textAlign: "center",
          color: theme.muted,
          fontFamily: theme.fontBody,
          fontSize: 12,
          lineHeight: "20px",
          opacity: b(13) ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 300ms ease"
        }}
      >
        {labels.footnote}
      </div>
    </StageFrame>
  );
}

export function WrapperCompare({
  active,
  reduceMotion,
  theme,
  ariaLabel,
  format,
  intro,
  labels,
  start,
  end,
  tax,
  received,
  exampleSaved,
  used,
  limit,
  onSettled
}) {
  const stage = useStage(reduceMotion);
  const { W, H, A } = stage;
  const lead = introLead(intro);
  const offsets = [
    0, 900, 1100, 3000, 3900, 6200, 7100, 9400, 10200, 10450, 11400, 12400,
    13200, 14200, 16000, 16100, 16800, 18800, 18900, 19600, 21800, 21900, 22600
  ];
  const beat = useBeats(active, reduceMotion, offsets.map(t => lead + t), onSettled);
  const b = i => beat > i;

  let caption = labels.captionTwo;
  if (b(20)) caption = labels.captionUsed;
  else if (b(17)) caption = labels.captionExample;
  else if (b(14)) caption = labels.captionSaved;
  else if (b(11)) caption = labels.captionReceive;
  else if (b(7)) caption = labels.captionSell;
  else if (b(5)) caption = labels.captionGrow;
  else if (b(3)) caption = labels.captionWrap;
  const text = reduceMotion ? intro : b(0) ? caption : intro;

  const tween1 = useTween(b(15), 600, reduceMotion);
  const tween2 = useTween(b(18), 600, reduceMotion);
  const tween3 = useTween(b(21), 600, reduceMotion);
  const L = tween1 + tween2 + tween3;

  const outlineT = useTween(b(4), 1000, reduceMotion);
  const leftTileOn = b(1) || reduceMotion;
  const rightTileOn = b(2) || reduceMotion;
  const valueRunning = b(6);
  const leftVal = useCountUp(end, valueRunning, 1200, reduceMotion, start);
  const rightVal = useCountUp(end, valueRunning, 1200, reduceMotion, start);
  const exampleVal = useCountUp(exampleSaved, b(19), 1200, reduceMotion, 0);
  const usedGrow = useTween(b(22), 1000, reduceMotion);
  const soldLeft = b(8);
  const soldRight = b(9);
  const row1On = b(10);
  const row2On = b(12);
  const row3On = b(13);
  const groupSOn = b(16);
  const groupEOn = b(19);
  const groupUOn = b(22);

  const roomy = clamp((H - 620) / 120, 0, 1);
  const T = interpArray(L, [150, 100, 76, 56]);
  const V = interpArray(L, [44, 34, 26, 22]);
  const R = interpArray(L, [34, 26, 22, 20]);
  const F = interpArray(L, [15, 13, 12, 12]);
  // The tile's small print goes first, once there's no room for it.
  const smallPrint = 1 - clamp(L - 1, 0, 1);

  const tw = Math.floor((W - 56) / 2);
  const leftX = 8;
  const rightX = W - 8 - tw;
  const leftCenter = leftX + tw / 2;
  const rightCenter = rightX + tw / 2;

  const sMorph = clamp(L - 1, 0, 1);
  const sLabelSize = lerp(17, 12, sMorph);
  const sFigSize = lerp(72, 22, sMorph);
  const sHeight = lerp(96, 44, sMorph);

  const eMorph = clamp(L - 2, 0, 1);
  const eHeight = lerp(130, 54, eMorph);
  const eLine = lerp(18, 12, eMorph);
  const eFig = lerp(52, 20, eMorph);

  const uFig = 44 + 12 * roomy;
  const uBar = 26 + 8 * roomy;
  const uHeight = 26 + uFig + 14 + uBar;

  // Newest at the top: each new item opens a space there and pushes the older ones down.
  const finalBlockH = 40 + 56 + 8 + 60;
  const room = H - 34 - A;
  const finalContentH = uHeight + 54 + 44 + finalBlockH;
  const sectionGap = clamp((room - finalContentH) / 3, 16, 40);
  const heroPad = Math.max(0, room - finalContentH - 3 * sectionGap);
  const uTop = A + heroPad / 2;
  const eTop = A + (uHeight + sectionGap + heroPad) * tween3;
  const sTop = eTop + (eHeight + sectionGap) * tween2;
  const blockTop = sTop + (sHeight + sectionGap) * tween1;
  const tileTop = blockTop + 40;
  const rowsTop = tileTop + T + 8;
  const usedVal = useCountUp(used, b(22), 1000, reduceMotion, 0);
  const trackW = W - 16;
  const usedRatio = limit > 0 ? clamp(used / limit, 0, 1) : 0;

  const sectionRule = (y, shown) => (
    <div style={{ position: "absolute", left: 8, right: 8, top: y, borderTop: `1px dashed ${theme.muted}`, opacity: shown * 0.45 }} />
  );

  const renderCalcRows = (x, isLeft) => (
    <div style={{ position: "absolute", left: x, top: rowsTop, width: tw, height: 3 * R }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: R,
          opacity: row1On ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 300ms ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: theme.fontBody,
          fontSize: F,
          color: theme.text,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap"
        }}
      >
        <span>{labels.soldFor}</span>
        <span>{format(end)}</span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: R,
          height: R,
          opacity: row2On ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 300ms ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: theme.fontBody,
          fontSize: F,
          color: theme.text,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap"
        }}
      >
        <span>{labels.taxRow}</span>
        {isLeft ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 6px",
              borderRadius: 999,
              background: theme.paleGain,
              color: theme.gain,
              fontSize: 11,
              fontWeight: 700
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                d="M1.7 5.2 L4 7.4 L8.4 2.5"
                fill="none"
                stroke={theme.gain}
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {labels.noTax}
          </span>
        ) : (
          <span
            style={{
              padding: "2px 6px",
              borderRadius: 999,
              background: theme.cost,
              color: theme.onAccent,
              fontSize: 11,
              fontWeight: 700
            }}
          >
            {`(${format(tax)})`}
          </span>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 2 * R - 1,
          height: 1,
          background: theme.muted,
          opacity: row3On ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 300ms ease"
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 2 * R,
          height: R,
          opacity: row3On ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 300ms ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: theme.fontBody,
          fontSize: F,
          fontWeight: 700,
          color: theme.text,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap"
        }}
      >
        <span>{labels.receiveRow}</span>
        <span>{isLeft ? format(end) : format(received)}</span>
      </div>
    </div>
  );

  return (
    <StageFrame stage={stage} ariaLabel={ariaLabel}>
      <TextZone text={text} active={active} reduceMotion={reduceMotion} W={W} theme={theme} />

      <div style={{ position: "absolute", inset: 0, ...setBack(clamp(L, 0, 1)) }}>

      <div
        style={{
          position: "absolute",
          left: leftCenter - 46,
          top: blockTop,
          width: 92,
          height: 28,
          borderRadius: 14,
          background: theme.gain,
          color: theme.onAccent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          fontFamily: theme.fontBody,
          fontSize: 12,
          fontWeight: 700,
          opacity: b(4) ? 1 : 0,
          transform: `scale(${b(4) ? 1 : 0.85})`,
          transition: reduceMotion ? "none" : `opacity 260ms ${EASE_LANDING}, transform 360ms ${EASE_LANDING}`
        }}
      >
        <svg width="12" height="14" viewBox="0 0 12 14">
          <path
            d="M6 1 L11 3 V7 C11 10 8.5 12 6 13 C3.5 12 1 10 1 7 V3 Z"
            fill="none"
            stroke={theme.onAccent}
            strokeWidth="1.5"
          />
        </svg>
        {labels.inside}
      </div>

      <div
        style={{
          position: "absolute",
          left: rightX,
          top: blockTop,
          width: tw,
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.muted,
          fontFamily: theme.fontBody,
          fontSize: 14,
          opacity: b(4) ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 300ms ease 600ms"
        }}
      >
        {labels.outside}
      </div>

      <div
        style={{
          position: "absolute",
          left: leftX,
          top: tileTop,
          zIndex: 2,
          width: tw,
          height: T,
          opacity: leftTileOn ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 320ms ease"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: theme.tile,
            borderRadius: 16,
            boxShadow: TILE_SHADOW,
            opacity: soldLeft ? 0.75 : 1
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 10,
              textAlign: "center",
              color: theme.muted,
              fontFamily: theme.fontBody,
              fontSize: 13,
              opacity: smallPrint
            }}
          >
            {labels.oneShare}
          </div>

          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.text,
              fontFamily: theme.fontBody,
              fontSize: V,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {format(leftVal)}
          </div>

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              textAlign: "center",
              top: `calc(50% + ${V * 0.62}px)`,
              color: theme.gain,
              fontFamily: theme.fontBody,
              fontSize: 12,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              opacity: valueRunning ? smallPrint : 0,
              transition: reduceMotion ? "none" : "opacity 300ms ease",
              whiteSpace: "nowrap"
            }}
          >
            {`+${format(end - start)}`}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            right: -6,
            top: -9,
            padding: "4px 9px",
            borderRadius: 999,
            background: theme.neutral,
            color: theme.onAccent,
            fontFamily: theme.fontBody,
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: "nowrap",
            transformOrigin: "center",
            opacity: soldLeft ? 1 : 0,
            transform: `rotate(6deg) scale(${soldLeft ? 1 : 1.7})`,
            transition: reduceMotion ? "none" : `opacity 80ms ease, transform 360ms ${EASE_LANDING}`
          }}
        >
          {labels.sold}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: rightX,
          top: tileTop,
          width: tw,
          height: T,
          opacity: rightTileOn ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 320ms ease"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: theme.tile,
            borderRadius: 16,
            boxShadow: TILE_SHADOW,
            opacity: soldRight ? 0.75 : 1
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 10,
              textAlign: "center",
              color: theme.muted,
              fontFamily: theme.fontBody,
              fontSize: 13,
              opacity: smallPrint
            }}
          >
            {labels.oneShare}
          </div>

          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.text,
              fontFamily: theme.fontBody,
              fontSize: V,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {format(rightVal)}
          </div>

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              textAlign: "center",
              top: `calc(50% + ${V * 0.62}px)`,
              color: theme.gain,
              fontFamily: theme.fontBody,
              fontSize: 12,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              opacity: valueRunning ? smallPrint : 0,
              transition: reduceMotion ? "none" : "opacity 300ms ease",
              whiteSpace: "nowrap"
            }}
          >
            {`+${format(end - start)}`}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            right: -6,
            top: -9,
            padding: "4px 9px",
            borderRadius: 999,
            background: theme.neutral,
            color: theme.onAccent,
            fontFamily: theme.fontBody,
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: "nowrap",
            transformOrigin: "center",
            opacity: soldRight ? 1 : 0,
            transform: `rotate(6deg) scale(${soldRight ? 1 : 1.7})`,
            transition: reduceMotion ? "none" : `opacity 80ms ease, transform 360ms ${EASE_LANDING}`
          }}
        >
          {labels.sold}
        </div>
      </div>

      <svg
        width={tw + 10}
        height={T + 10}
        viewBox={`0 0 ${tw + 10} ${T + 10}`}
        style={{
          position: "absolute",
          left: leftX - 5,
          top: tileTop - 5,
          pointerEvents: "none",
          overflow: "visible"
        }}
      >
        <rect
          x={1.5}
          y={1.5}
          width={tw + 7}
          height={T + 7}
          rx={21}
          fill="none"
          stroke={theme.gain}
          strokeWidth={3}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - outlineT}
        />
      </svg>

      {renderCalcRows(leftX, true)}
      {renderCalcRows(rightX, false)}
      </div>

      {sectionRule(blockTop - sectionGap / 2, tween1)}
      {sectionRule(sTop - sectionGap / 2, tween2)}
      {sectionRule(eTop - sectionGap / 2, tween3)}

      <div
        style={{
          position: "absolute",
          left: 8,
          top: sTop,
          width: W - 16,
          height: sHeight,
          opacity: groupSOn ? 1 : 0,
          ...(groupSOn ? setBack(clamp(L - 1, 0, 1)) : {}),
          transform: `translateY(${groupSOn ? 0 : -16}px)`,
          transition: reduceMotion ? "none" : `opacity 400ms ease, transform 500ms ${EASE_LANDING}`
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            textAlign: "center",
            color: theme.muted,
            fontFamily: theme.fontBody,
            fontSize: sLabelSize,
            lineHeight: `${sLabelSize + 4}px`
          }}
        >
          {labels.saved}
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: sHeight - sFigSize,
            height: sFigSize,
            textAlign: "center",
            color: theme.gain,
            fontFamily: theme.fontFigure,
            fontSize: sFigSize,
            fontWeight: 700,
            lineHeight: `${sFigSize}px`,
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {format(tax)}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 8,
          top: eTop,
          width: W - 16,
          height: eHeight,
          background: theme.tile,
          borderRadius: 16,
          boxShadow: TILE_SHADOW,
          opacity: groupEOn ? 1 : 0,
          ...(groupEOn ? setBack(clamp(L - 2, 0, 1)) : {}),
          transform: `translateY(${groupEOn ? 0 : -16}px)`,
          transition: reduceMotion ? "none" : `opacity 400ms ease, transform 500ms ${EASE_LANDING}`
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 16,
            top: lerp(18, 10, eMorph),
            width: "58%",
            color: theme.text,
            fontFamily: theme.fontBody,
            fontSize: eLine,
            lineHeight: `${eLine + 4}px`
          }}
        >
          {labels.exampleLine}
        </div>
        <div
          style={{
            position: "absolute",
            right: 16,
            top: lerp(16, 7, eMorph),
            textAlign: "right",
            color: theme.muted,
            fontFamily: theme.fontBody,
            fontSize: eLine,
            lineHeight: `${eLine + 4}px`
          }}
        >
          {labels.exampleSaved}
        </div>
        <div
          style={{
            position: "absolute",
            right: 16,
            top: eHeight - eFig - lerp(12, 8, eMorph),
            height: eFig,
            textAlign: "right",
            color: theme.gain,
            fontFamily: theme.fontBody,
            fontSize: eFig,
            fontWeight: 700,
            lineHeight: `${eFig}px`,
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {format(exampleVal)}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 8,
          top: uTop,
          width: W - 16,
          height: uHeight,
          opacity: groupUOn ? 1 : 0,
          transform: `translateY(${groupUOn ? 0 : -16}px)`,
          transition: reduceMotion ? "none" : `opacity 400ms ease, transform 500ms ${EASE_LANDING}`
        }}
      >
        <div
          style={{
            height: 26,
            lineHeight: "26px",
            textAlign: "center",
            color: theme.muted,
            fontFamily: theme.fontBody,
            fontSize: 17
          }}
        >
          {labels.usedLabel}
        </div>
        <div
          style={{
            height: uFig,
            lineHeight: `${uFig}px`,
            textAlign: "center",
            color: theme.text,
            fontFamily: theme.fontBody,
            fontSize: 17,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap"
          }}
        >
          <span style={{ fontFamily: theme.fontFigure, fontSize: uFig, fontWeight: 700 }}>{format(usedVal)}</span>
          {` ${labels.ofLabel} ${format(limit)}`}
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: uBar,
            borderRadius: uBar / 2,
            background: theme.stripe,
            overflow: "hidden"
          }}
        >
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: trackW * usedRatio * usedGrow, background: theme.accent }} />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: H - 24,
          width: W,
          height: 20,
          textAlign: "center",
          color: theme.muted,
          fontFamily: theme.fontBody,
          fontSize: 12,
          lineHeight: "20px",
          opacity: groupUOn ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 300ms ease"
        }}
      >
        {labels.footnote}
      </div>
    </StageFrame>
  );
}

export function GainWaterfall({
  active,
  reduceMotion,
  theme,
  ariaLabel,
  format,
  intro,
  labels,
  onSettled,
  invested,
  value,
  gain,
  exempt,
  taxable,
  tax,
  kept,
  received
}) {
  const stage = useStage(reduceMotion);
  const { W, H, A } = stage;
  const lead = introLead(intro);
  const offsets = [
    0, 900, 3000, 3900, 6100, 7000, 9200, 11400, 12300, 14700, 15600,
    18000, 18900, 21500, 22200, 22800, 23300
  ];
  const beat = useBeats(active, reduceMotion, offsets.map(t => lead + t), onSettled);
  const b = i => beat > i;

  let caption = labels.captionInvested;
  if (b(13)) caption = labels.captionPayoff;
  else if (b(11)) caption = labels.captionSplit;
  else if (b(9)) caption = labels.captionTaxable;
  else if (b(7)) caption = labels.captionExempt;
  else if (b(6)) caption = labels.captionGain;
  else if (b(4)) caption = labels.captionWorth;
  else if (b(2)) caption = labels.captionGrowth;
  const text = reduceMotion ? intro : b(0) ? caption : intro;

  const col1AGrow = useTween(b(1), 1000, reduceMotion);
  const col2AGrow = useTween(b(3), 900, reduceMotion);
  const col3AGrow = useTween(b(5), 900, reduceMotion);
  const bMix = useTween(b(6), 600, reduceMotion);
  const exemptT = useTween(b(8), 800, reduceMotion);
  const taxableT = useTween(b(10), 800, reduceMotion);
  const splitT = useTween(b(12), 1000, reduceMotion);
  const chartT = useTween(b(14), 900, reduceMotion);
  const taxTileOn = b(15);
  const taxTileVal = useCountUp(tax, b(15), 1200, reduceMotion, 0);
  const receivedTileVal = useCountUp(received, b(16), 1200, reduceMotion, 0);
  const investedVal = useCountUp(invested, b(1), 1000, reduceMotion, 0);
  const gainVal = useCountUp(gain, b(3), 900, reduceMotion, 0);

  const axisYA = H - 30;
  const tallestA = axisYA - A - 30;
  const axisInset = 10;
  const cwA = Math.round(W * 0.27) - 5;
  const xA0 = axisInset;
  const xA1 = (W - cwA) / 2;
  const xA2 = W - axisInset - cwA;
  const scaleA = value > 0 ? tallestA / value : 0;
  const investedHA = invested * scaleA;
  const valueHA = value * scaleA;
  const gainHA = Math.max(0, valueHA - investedHA);

  const axisY = H - 30;
  const tallest = H - 30 - A - 30;
  // The two tiles, one above the other, centred in the space.
  const payoffH = Math.min(170, Math.floor((H - A - 12) / 2));
  const payoffTop = A + Math.round((H - A - (2 * payoffH + 12)) / 2);
  const cw4 = Math.round(W * 0.22) - 5;
  const bX = i => axisInset + i * (W - 2 * axisInset - cw4) / 3;
  const topLevel = axisY - tallest;
  const scaleB = gain > 0 ? tallest / gain : 0;
  const exemptH = Math.max(0, exempt * scaleB);
  const taxableH = Math.max(0, taxable * scaleB);
  const innerSeg = Math.max(0, taxableH - 2);
  const minSeg = Math.min(46, innerSeg / 2);
  const ratio = tax + kept > 0 ? tax / (tax + kept) : 0.5;
  const taxSegH = Math.max(minSeg, Math.min(innerSeg - minSeg, Math.round(innerSeg * ratio)));
  const keepSegH = innerSeg - taxSegH;
  const splitTextOpacity = clamp((splitT - 0.55) / 0.45, 0, 1);
  const phaseAOpacity = 1 - bMix;
  const phaseBOpacity = bMix;

  const h1A = investedHA * col1AGrow;
  const h2A = gainHA * col2AGrow;
  const h3A = valueHA * col3AGrow;

  const col3Height = taxableH * taxableT;

  return (
    <StageFrame stage={stage} ariaLabel={ariaLabel}>
      <TextZone text={text} active={active} reduceMotion={reduceMotion} W={W} theme={theme} />

      <div style={{ position: "absolute", inset: 0, opacity: 1 - chartT, filter: chartT > 0 ? `blur(${3 * chartT}px)` : undefined }}>

      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" }}
      >
        <g opacity={phaseAOpacity}>
          <line
            x1={0}
            y1={axisYA}
            x2={W}
            y2={axisYA}
            stroke={theme.muted}
            strokeWidth={1}
            opacity={b(1) ? 1 : 0}
          />
          <line
            x1={xA0 + cwA}
            y1={axisYA - investedHA}
            x2={xA1}
            y2={axisYA - investedHA}
            stroke={theme.muted}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={b(3) ? 1 : 0}
          />
          <line
            x1={xA1 + cwA}
            y1={axisYA - valueHA}
            x2={xA2}
            y2={axisYA - valueHA}
            stroke={theme.muted}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={b(5) ? 1 : 0}
          />
        </g>

        <g opacity={phaseBOpacity}>
          <line
            x1={0}
            y1={axisY}
            x2={W}
            y2={axisY}
            stroke={theme.muted}
            strokeWidth={1}
          />
          <line
            x1={bX(0) + cw4}
            y1={topLevel}
            x2={bX(1)}
            y2={topLevel}
            stroke={theme.muted}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={b(8) ? 1 : 0}
          />
          <line
            x1={bX(1) + cw4}
            y1={axisY - taxableH}
            x2={bX(2)}
            y2={axisY - taxableH}
            stroke={theme.muted}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={b(10) ? 1 : 0}
          />
        </g>
      </svg>

      <div style={{ position: "absolute", inset: 0, opacity: phaseAOpacity }}>
        <div
          style={{
            position: "absolute",
            left: xA0,
            top: axisYA - h1A,
            width: cwA,
            height: h1A,
            background: theme.accent,
            borderRadius: "12px 12px 0 0"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: xA0,
            top: axisYA - h1A - 24,
            width: cwA,
            textAlign: "center",
            color: theme.text,
            fontFamily: theme.fontBody,
            fontSize: 16,
            fontWeight: 700,
            lineHeight: "20px",
            opacity: b(1) ? 1 : 0,
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {format(investedVal)}
        </div>
        <div
          style={{
            position: "absolute",
            left: xA0,
            top: axisYA + 8,
            width: cwA,
            textAlign: "center",
            color: theme.muted,
            fontFamily: theme.fontBody,
            fontSize: 12,
            lineHeight: "16px",
            opacity: b(1) ? 1 : 0
          }}
        >
          {labels.invested}
        </div>

        <div
          style={{
            position: "absolute",
            left: xA1,
            top: axisYA - investedHA - h2A,
            width: cwA,
            height: h2A,
            background: theme.gain,
            borderRadius: "12px 12px 0 0"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: xA1,
            top: axisYA - investedHA - h2A - 24,
            width: cwA,
            textAlign: "center",
            color: theme.gain,
            fontFamily: theme.fontBody,
            fontSize: 16,
            fontWeight: 700,
            lineHeight: "20px",
            opacity: b(3) ? 1 : 0,
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {`+${format(gainVal)}`}
        </div>
        <div
          style={{
            position: "absolute",
            left: xA1,
            top: axisYA + 8,
            width: cwA,
            textAlign: "center",
            color: theme.muted,
            fontFamily: theme.fontBody,
            fontSize: 12,
            lineHeight: "16px",
            opacity: b(3) ? 1 : 0
          }}
        >
          {labels.growth}
        </div>

        <div
          style={{
            position: "absolute",
            left: xA2,
            top: axisYA - h3A,
            width: cwA,
            height: h3A,
            background: theme.accent,
            borderRadius: "12px 12px 0 0"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: xA2,
            top: axisYA - h3A - 24,
            width: cwA,
            textAlign: "center",
            color: theme.text,
            fontFamily: theme.fontBody,
            fontSize: 16,
            fontWeight: 700,
            lineHeight: "20px",
            opacity: b(5) ? 1 : 0,
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {format(value)}
        </div>
        <div
          style={{
            position: "absolute",
            left: xA2,
            top: axisYA + 8,
            width: cwA,
            textAlign: "center",
            color: theme.muted,
            fontFamily: theme.fontBody,
            fontSize: 12,
            lineHeight: "16px",
            opacity: b(5) ? 1 : 0
          }}
        >
          {labels.worth}
        </div>
      </div>

      <div style={{ position: "absolute", inset: 0, opacity: phaseBOpacity }}>
        <div
          style={{
            position: "absolute",
            left: bX(0),
            top: axisY - tallest,
            width: cw4,
            height: tallest,
            background: theme.gain,
            borderRadius: "12px 12px 0 0"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: bX(0),
            top: topLevel - 24,
            width: cw4,
            textAlign: "center",
            color: theme.text,
            fontFamily: theme.fontBody,
            fontSize: 16,
            fontWeight: 700,
            lineHeight: "20px",
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {format(gain)}
        </div>
        <div
          style={{
            position: "absolute",
            left: bX(0),
            top: axisY + 8,
            width: cw4,
            textAlign: "center",
            color: theme.muted,
            fontFamily: theme.fontBody,
            fontSize: 12,
            lineHeight: "16px"
          }}
        >
          {labels.gainCol}
        </div>

        <div
          style={{
            position: "absolute",
            left: bX(1),
            top: topLevel,
            width: cw4,
            height: exemptH * exemptT,
            background: theme.paleGain,
            borderRadius: 12
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: theme.gain,
              fontFamily: theme.fontBody,
              opacity: clamp((exemptT - 0.55) / 0.45, 0, 1),
              fontVariantNumeric: "tabular-nums"
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: "22px" }}>{format(exempt)}</div>
            <div style={{ fontSize: 13, lineHeight: "16px" }}>{labels.toUser}</div>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: bX(1),
            top: axisY + 8,
            width: cw4,
            textAlign: "center",
            color: theme.muted,
            fontFamily: theme.fontBody,
            fontSize: 12,
            lineHeight: "16px",
            opacity: b(8) ? 1 : 0
          }}
        >
          {labels.exemptCol}
        </div>

        <div
          style={{
            position: "absolute",
            left: bX(2),
            top: axisY - col3Height,
            width: cw4,
            height: col3Height,
            background: theme.neutral,
            borderRadius: "12px 12px 0 0",
            opacity: b(10) ? 1 : 0
          }}
        />
        <div
          style={{
            position: "absolute",
            left: bX(2),
            top: axisY - col3Height - 24,
            width: cw4,
            textAlign: "center",
            color: theme.text,
            fontFamily: theme.fontBody,
            fontSize: 16,
            fontWeight: 700,
            lineHeight: "20px",
            opacity: b(10) ? 1 : 0,
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {format(taxable)}
        </div>
        <div
          style={{
            position: "absolute",
            left: bX(2),
            top: axisY + 8,
            width: cw4,
            textAlign: "center",
            color: theme.muted,
            fontFamily: theme.fontBody,
            fontSize: 12,
            lineHeight: "16px",
            opacity: b(10) ? 1 : 0
          }}
        >
          {labels.taxableCol}
        </div>

        <div
          style={{
            position: "absolute",
            left: bX(3),
            top: axisY - taxableH,
            width: cw4,
            height: taxableH,
            background: theme.neutral,
            borderRadius: "12px 12px 0 0",
            opacity: b(12) ? 1 - splitT : 0
          }}
        />

        <div
          style={{
            position: "absolute",
            left: bX(3),
            top: axisY - taxableH,
            width: cw4,
            height: taxSegH * splitT,
            background: theme.cost,
            borderRadius: "12px 12px 0 0",
            opacity: b(12) ? splitT : 0
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: theme.onAccent,
              fontFamily: theme.fontBody,
              opacity: splitTextOpacity,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: "19px" }}>{format(tax)}</div>
            <div style={{ fontSize: 12, lineHeight: "15px" }}>{labels.toTaxman}</div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: bX(3),
            top: axisY - keepSegH * splitT,
            width: cw4,
            height: keepSegH * splitT,
            background: theme.paleGain,
            opacity: b(12) ? splitT : 0
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: theme.gain,
              fontFamily: theme.fontBody,
              opacity: splitTextOpacity,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: "19px" }}>{format(kept)}</div>
            <div style={{ fontSize: 12, lineHeight: "15px" }}>{labels.toUser}</div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: bX(3),
            top: axisY + 8,
            width: cw4,
            textAlign: "center",
            color: theme.muted,
            fontFamily: theme.fontBody,
            fontSize: 12,
            lineHeight: "16px",
            opacity: b(12) ? 1 : 0
          }}
        >
          {labels.splitCol}
        </div>
      </div>

      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: payoffTop,
          width: W,
          height: payoffH,
          background: theme.cost,
          borderRadius: 18,
                    color: theme.onAccent,
          opacity: taxTileOn ? 1 : 0,
          transform: `scale(${taxTileOn ? 1 : 0.9})`,
          transition: reduceMotion ? "none" : `opacity 320ms ease, transform 420ms ${EASE_LANDING}`
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            top: 18,
            textAlign: "center",
            fontFamily: theme.fontBody,
            fontSize: 15,
            lineHeight: "20px"
          }}
        >
          {labels.taxTitle}
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: theme.fontFigure,
            fontSize: 52,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {format(taxTileVal)}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: payoffTop + payoffH + 12,
          width: W,
          height: payoffH,
          background: theme.paleGain,
          borderRadius: 18,
                    color: theme.text,
          opacity: taxTileOn ? 1 : 0,
          transform: `scale(${taxTileOn ? 1 : 0.9})`,
          transition: reduceMotion ? "none" : `opacity 320ms ease, transform 420ms ${EASE_LANDING}`
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            top: 18,
            textAlign: "center",
            fontFamily: theme.fontBody,
            fontSize: 15,
            lineHeight: "20px"
          }}
        >
          {labels.receiveTitle}
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.gain,
            fontFamily: theme.fontFigure,
            fontSize: 52,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {format(receivedTileVal)}
        </div>
        <div
          style={{
            position: "absolute",
            left: 6,
            right: 6,
            bottom: 18,
            textAlign: "center",
            whiteSpace: "nowrap",
            color: theme.muted,
            fontFamily: theme.fontBody,
            fontSize: 13,
            lineHeight: "18px"
          }}
        >
          {labels.receiveWorking}
        </div>
      </div>
    </StageFrame>
  );
}

export function TaxYearCalendar({
  active,
  reduceMotion,
  theme,
  ariaLabel,
  format,
  intro,
  labels,
  months,
  aprilDays,
  start,
  lastDay,
  firstDay,
  meters,
  onSettled
}) {
  const stage = useStage(reduceMotion);
  const { W, H, A } = stage;

  const sheetList = [start, ...months, ...aprilDays, lastDay, firstDay];
  const lastDayIndex = sheetList.length - 2;
  const firstDayIndex = sheetList.length - 1;

  const delays = [];
  months.forEach(() => delays.push(170));
  aprilDays.forEach((_, i) => delays.push([260, 310, 370, 440][Math.min(i, 3)]));
  delays.push(440);

  const A0Rel = 1400 + delays.reduce((sum, d) => sum + d, 0);
  const lead = introLead(intro);
  const offsets = [
    0,
    600,
    1400,
    A0Rel,
    A0Rel + 400,
    A0Rel + 3000,
    A0Rel + 3700,
    A0Rel + 4900,
    A0Rel + 6000,
    A0Rel + 6700
  ];
  const beat = useBeats(active, reduceMotion, offsets.map(t => lead + t), onSettled);
  const b = i => beat > i;

  let caption = labels.captionYear;
  if (b(8)) caption = labels.captionReset;
  else if (b(5)) caption = labels.captionFinal;
  else if (b(4)) caption = labels.captionFlag;
  const text = reduceMotion ? intro : b(0) ? caption : intro;

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentRef = useRef(0);
  const [flip, setFlip] = useState(null);
  const [arrived, setArrived] = useState(false);
  const [calendarPop, setCalendarPop] = useState(false);
  const [flagPulse, setFlagPulse] = useState(1);
  const timersRef = useRef([]);
  const rafsRef = useRef([]);

  const resetOn = b(9) || reduceMotion;
  const calendarOn = b(1) || reduceMotion;
  const flagVisible = !reduceMotion && b(4) && !b(9);
  const topUpOn = b(6) && !resetOn;
  const riseOn = b(2) && !resetOn;
  const riseDuration = Math.max(1, A0Rel - 1400);

  const rise0 = useLinearRise(meters[0].nearly, riseOn, riseDuration, reduceMotion);
  const rise1 = useLinearRise(meters[1].nearly, riseOn, riseDuration, reduceMotion);
  const topUpT = useTween(topUpOn, 700, reduceMotion);
  const resetT = useTween(resetOn, 800, reduceMotion);

  const displayed = m => Math.round(resetOn ? m.full * (1 - resetT) : m.nearly + (m.full - m.nearly) * topUpT);
  const display0 = resetOn || topUpOn ? displayed(meters[0]) : rise0;
  const display1 = resetOn || topUpOn ? displayed(meters[1]) : rise1;

  // A page's proportions, centred in the space above the meters.
  const calendarSpace = H - 212 - (A + 6);
  const calendarH = Math.round(Math.min(380, calendarSpace) * 0.5);
  const calendarW = Math.round(calendarH * 0.86);
  const calendarX = (W - calendarW) / 2;
  const calendarTop = A + 6 + (calendarSpace - calendarH) / 2;
  const sheetTop = 30;
  const sheetH = calendarH - sheetTop;

  const beginFlip = (to, duration, onDone) => {
    const from = currentRef.current;
    if (from === to) {
      if (onDone) onDone();
      return;
    }
    setFlip({ from, to, active: false, duration });
    const rafA = requestAnimationFrame(() => {
      const rafB = requestAnimationFrame(() => {
        setFlip(f => (f ? { ...f, active: true } : f));
      });
      rafsRef.current.push(rafB);
    });
    rafsRef.current.push(rafA);
    const t = setTimeout(() => {
      currentRef.current = to;
      setCurrentIndex(to);
      setFlip(null);
      if (onDone) onDone();
    }, duration);
    timersRef.current.push(t);
  };

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      rafsRef.current.forEach(cancelAnimationFrame);
      timersRef.current = [];
      rafsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!active) {
      currentRef.current = 0;
      setCurrentIndex(0);
      setFlip(null);
      setArrived(false);
      return undefined;
    }
    if (reduceMotion) {
      currentRef.current = firstDayIndex;
      setCurrentIndex(firstDayIndex);
      setArrived(false);
      return undefined;
    }
    if (!b(2)) return undefined;

    currentRef.current = 0;
    setCurrentIndex(0);
    setFlip(null);
    setArrived(false);

    const localTimers = [];
    let elapsed = 0;
    let step = 1;
    delays.forEach(d => {
      const to = step;
      const at = elapsed;
      const duration = Math.min(240, d * 0.75);
      const t = setTimeout(() => {
        beginFlip(to, duration, () => {
          if (to === lastDayIndex) setArrived(true);
        });
      }, at);
      localTimers.push(t);
      elapsed += d;
      step += 1;
    });

    return () => localTimers.forEach(clearTimeout);
  }, [active, reduceMotion, b(2), lead]);

  useEffect(() => {
    if (!active || reduceMotion || !b(9)) return undefined;
    const t = setTimeout(() => {
      beginFlip(firstDayIndex, 240);
    }, 0);
    return () => clearTimeout(t);
  }, [active, reduceMotion, b(9)]);

  useEffect(() => {
    if (!arrived) {
      setCalendarPop(false);
      return undefined;
    }
    setCalendarPop(true);
    const t = setTimeout(() => setCalendarPop(false), 350);
    return () => clearTimeout(t);
  }, [arrived]);

  useEffect(() => {
    if (!flagVisible) {
      setFlagPulse(1);
      return undefined;
    }
    const seq = [1.06, 1, 1.06, 1];
    const localTimers = seq.map((v, i) => setTimeout(() => setFlagPulse(v), 300 + i * 300));
    return () => localTimers.forEach(clearTimeout);
  }, [flagVisible]);

  const headerNext = resetOn || reduceMotion;
  const displayIndex = reduceMotion ? firstDayIndex : currentIndex;
  const shownSheet = sheetList[displayIndex] || firstDay;

  const renderFace = (sheet, zIndex, transform, transition, key) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: calendarW,
        height: sheetH,
        background: theme.tile,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        transformOrigin: "top center",
        transform,
        transition,
        backfaceVisibility: "hidden",
        zIndex
      }}
    >
      {sheet.top ? (
        <div
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            top: 7,
            textAlign: "center",
            color: theme.muted,
            fontFamily: theme.fontBody,
            fontSize: 11,
            textTransform: "uppercase",
            lineHeight: "14px"
          }}
        >
          {sheet.top}
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.text,
          fontFamily: theme.fontBody,
          fontWeight: 700,
          fontSize: String(sheet.big).length <= 2 ? 58 : 42,
          lineHeight: 1,
          textAlign: "center"
        }}
      >
        {sheet.big}
      </div>
    </div>
  );

  const fillColor0 = resetOn ? theme.neutral : theme.accent;
  const fillGain0 = resetOn ? theme.neutral : b(7) ? theme.accent : theme.gain;
  const full0 = Math.max(1, meters[0].full);
  const full1 = Math.max(1, meters[1].full);
  const accent0Base = (meters[0].nearly / full0) * W;
  const accent1Base = (meters[1].nearly / full1) * W;
  const gain0Base = ((meters[0].full - meters[0].nearly) / full0) * W * topUpT;
  const gain1Base = ((meters[1].full - meters[1].nearly) / full1) * W * topUpT;
  const accent0W = resetOn ? accent0Base * (1 - resetT) : W * (rise0 / full0);
  const accent1W = resetOn ? accent1Base * (1 - resetT) : W * (rise1 / full1);
  const gain0W = resetOn ? gain0Base * 0 + ((meters[0].full - meters[0].nearly) / full0) * W * (1 - resetT) : gain0Base;
  const gain1W = resetOn ? ((meters[1].full - meters[1].nearly) / full1) * W * (1 - resetT) : gain1Base;

  const meterBlock = (index, top, display, accentW, gainW, fillA, fillG) => (
    <div
      style={{
        position: "absolute",
        left: 0,
        top,
        width: W,
        height: 80,
        opacity: calendarOn ? 1 : 0,
        transition: reduceMotion ? "none" : "opacity 400ms ease"
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: 24,
          color: theme.text,
          fontFamily: theme.fontBody,
          fontSize: 16,
          lineHeight: "24px",
          fontWeight: 700
        }}
      >
        {meters[index].label}
      </div>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          height: 24,
          color: theme.text,
          fontFamily: theme.fontBody,
          fontSize: 16,
          lineHeight: "24px",
          textAlign: "right",
          fontVariantNumeric: "tabular-nums"
        }}
      >
        {format(display)} {labels.usedSuffix}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 30,
          height: 18,
          borderRadius: 9,
          background: theme.stripe,
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: Math.max(0, Math.min(W, accentW + (gainW > 0 ? 1 : 0))),
            height: 18,
            background: fillA
          }}
        />
        <div
          style={{
            position: "absolute",
            left: Math.max(0, Math.min(W, accentW)),
            top: 0,
            width: Math.max(0, Math.min(W - accentW, gainW)),
            height: 18,
            background: fillG,
            transition: reduceMotion || resetOn ? "none" : "background 700ms ease"
          }}
        />
      </div>
    </div>
  );

  return (
    <StageFrame stage={stage} ariaLabel={ariaLabel}>
      <TextZone text={text} active={active} reduceMotion={reduceMotion} W={W} theme={theme} />

      <div
        style={{
          position: "absolute",
          left: calendarX,
          top: calendarTop,
          width: calendarW,
          height: calendarH,
          background: theme.tile,
          borderRadius: 12,
          boxShadow: TILE_SHADOW,
          opacity: calendarOn ? 1 : 0,
          transform: `scale(${calendarOn ? (calendarPop ? 1.03 : 1) : 0.8})`,
          transformOrigin: "center top",
          transition: reduceMotion ? "none" : `opacity 300ms ease, transform 420ms ${EASE_LANDING}`
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: calendarW,
            height: sheetTop,
            background: theme.accent,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            zIndex: 5
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.onAccent,
              fontFamily: theme.fontBody,
              fontSize: 12,
              fontWeight: 700,
              opacity: headerNext ? 0 : 1,
              transition: reduceMotion ? "none" : "opacity 500ms ease"
            }}
          >
            {labels.yearNow}
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.onAccent,
              fontFamily: theme.fontBody,
              fontSize: 12,
              fontWeight: 700,
              opacity: headerNext ? 1 : 0,
              transition: reduceMotion ? "none" : "opacity 500ms ease"
            }}
          >
            {labels.yearNext}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 20,
            top: -7,
            width: 5,
            height: 16,
            borderRadius: 3,
            background: theme.ring,
            zIndex: 8
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 20,
            top: -7,
            width: 5,
            height: 16,
            borderRadius: 3,
            background: theme.ring,
            zIndex: 8
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 0,
            top: sheetTop,
            width: calendarW,
            height: sheetH,
            perspective: "700px",
            zIndex: 2
          }}
        >
          {flip ? (
            <>
              {renderFace(
                sheetList[flip.to],
                1,
                "rotateX(0deg)",
                "none",
                `behind-${flip.to}`
              )}
              {renderFace(
                sheetList[flip.from],
                2,
                `rotateX(${flip.active ? -100 : 0}deg)`,
                reduceMotion ? "none" : `transform ${flip.duration}ms cubic-bezier(0.4,0,0.2,1)`,
                `front-${flip.from}-${flip.to}`
              )}
            </>
          ) : (
            renderFace(shownSheet, 1, "rotateX(0deg)", "none", `face-${displayIndex}`)
          )}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: calendarX + calendarW - 26,
          top: calendarTop + sheetTop + 6,
          padding: "5px 10px",
          borderRadius: 999,
          background: theme.cost,
          color: theme.onAccent,
          fontFamily: theme.fontBody,
          fontSize: 12,
          fontWeight: 700,
          lineHeight: "18px",
          whiteSpace: "nowrap",
          opacity: flagVisible ? 1 : 0,
          transformOrigin: "left center",
          transform: `scale(${flagVisible ? flagPulse : 0.7})`,
          transition: reduceMotion ? "none" : `opacity 250ms ease, transform 360ms ${EASE_LANDING}`,
          zIndex: 10
        }}
      >
        {labels.lastDayFlag}
      </div>

      {meterBlock(0, H - 172, display0, accent0W, gain0W, fillColor0, fillGain0)}
      {meterBlock(1, H - 84, display1, accent1W, gain1W, fillColor0, fillGain0)}
    </StageFrame>
  );
}

export function AllowanceBars({
  active,
  reduceMotion,
  theme,
  ariaLabel,
  format,
  intro,
  labels,
  bars,
  onSettled
}) {
  const stage = useStage(reduceMotion);
  const { W, H, A } = stage;
  const lead = introLead(intro, 0.7);
  const offsets = [0, 800, 1200, 1500, 3400, 4200, 4600];
  const beat = useBeats(active, reduceMotion, offsets.map(t => lead + t), onSettled);
  const b = i => beat > i;

  let caption = labels.captionUsed;
  if (b(4)) caption = labels.captionLeft;
  const text = reduceMotion ? intro : b(0) ? caption : intro;

  const fill1On = b(2) || reduceMotion;
  const fill2On = b(3) || reduceMotion;
  const fill1T = useTween(fill1On, 1200, reduceMotion);
  const fill2T = useTween(fill2On, 1200, reduceMotion);
  const unused1On = b(5) || reduceMotion;
  const unused2On = b(6) || reduceMotion;
  const unusedVal0 = useCountUp(bars[0].unused, unused1On, 1200, reduceMotion, 0);
  const unusedVal1 = useCountUp(bars[1].unused, unused2On, 1200, reduceMotion, 0);

  const bw = Math.round(W * 0.4);
  const x0 = 8;
  const x1 = W - 8 - bw;
  const stackTop = A + 86;
  const axisY = H - 52;
  const barH = axisY - stackTop;
  const trackOn = b(1) || reduceMotion;

  const ratio0 = bars[0].limit > 0 ? clamp(bars[0].used / bars[0].limit, 0, 1) : 0;
  const ratio1 = bars[1].limit > 0 ? clamp(bars[1].used / bars[1].limit, 0, 1) : 0;
  const fillH0 = barH * ratio0 * fill1T;
  const fillH1 = barH * ratio1 * fill2T;
  const fillTop0 = axisY - fillH0;
  const fillTop1 = axisY - fillH1;
  const tileH = 28;
  const glassTop0 = Math.min(axisY - 4 - tileH, Math.max(stackTop + 4, fillTop0 - tileH / 2));
  const glassTop1 = Math.min(axisY - 4 - tileH, Math.max(stackTop + 4, fillTop1 - tileH / 2));
  const glassOpacity0 = clamp((fill1T - 0.55) / 0.45, 0, 1);
  const glassOpacity1 = clamp((fill2T - 0.55) / 0.45, 0, 1);

  return (
    <StageFrame stage={stage} ariaLabel={ariaLabel}>
      <TextZone text={text} active={active} reduceMotion={reduceMotion} W={W} theme={theme} />

      <div
        style={{
          position: "absolute",
          left: x0,
          top: A,
          width: bw,
          height: 74,
          opacity: unused1On ? 1 : 0,
          transform: `translateY(${unused1On ? 0 : 12}px)`,
          transition: reduceMotion ? "none" : `opacity 300ms ease, transform 400ms ${EASE_LANDING}`
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 24,
            textAlign: "center",
            color: theme.muted,
            fontFamily: theme.fontBody,
            fontSize: 15,
            lineHeight: "24px"
          }}
        >
          {labels.unusedLabel}
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 24,
            height: 50,
            textAlign: "center",
            color: theme.text,
            fontFamily: theme.fontFigure,
            fontSize: 38,
            fontWeight: 700,
            lineHeight: "50px",
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {format(unusedVal0)}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: x1,
          top: A,
          width: bw,
          height: 74,
          opacity: unused2On ? 1 : 0,
          transform: `translateY(${unused2On ? 0 : 12}px)`,
          transition: reduceMotion ? "none" : `opacity 300ms ease, transform 400ms ${EASE_LANDING}`
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 24,
            textAlign: "center",
            color: theme.muted,
            fontFamily: theme.fontBody,
            fontSize: 15,
            lineHeight: "24px"
          }}
        >
          {labels.unusedLabel}
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 24,
            height: 50,
            textAlign: "center",
            color: theme.text,
            fontFamily: theme.fontFigure,
            fontSize: 38,
            fontWeight: 700,
            lineHeight: "50px",
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {format(unusedVal1)}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: x0,
          top: stackTop,
          width: bw,
          height: barH,
          borderRadius: "12px 12px 0 0",
          background: theme.stripe,
          opacity: trackOn ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 300ms ease"
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: bw,
            height: fillH0,
            background: theme.gain,
            borderRadius: "12px 12px 0 0"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: bw / 2,
            top: glassTop0 - stackTop,
            transform: "translateX(-50%)",
            padding: "4px 10px",
            borderRadius: 10,
            background: theme.glass,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: `1px solid ${theme.glassEdge}`,
            color: theme.text,
            fontFamily: theme.fontBody,
            fontSize: 15,
            fontWeight: 700,
            lineHeight: "18px",
            whiteSpace: "nowrap",
            opacity: glassOpacity0
          }}
        >
          {bars[0].usedShort}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: x1,
          top: stackTop,
          width: bw,
          height: barH,
          borderRadius: "12px 12px 0 0",
          background: theme.stripe,
          opacity: trackOn ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 300ms ease"
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: bw,
            height: fillH1,
            background: theme.gain,
            borderRadius: "12px 12px 0 0"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: bw / 2,
            top: glassTop1 - stackTop,
            transform: "translateX(-50%)",
            padding: "4px 10px",
            borderRadius: 10,
            background: theme.glass,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: `1px solid ${theme.glassEdge}`,
            color: theme.text,
            fontFamily: theme.fontBody,
            fontSize: 15,
            fontWeight: 700,
            lineHeight: "18px",
            whiteSpace: "nowrap",
            opacity: glassOpacity1
          }}
        >
          {bars[1].usedShort}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: axisY,
          width: W,
          height: 1,
          background: theme.muted,
          opacity: trackOn ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 300ms ease"
        }}
      />

      <div
        style={{
          position: "absolute",
          left: x0,
          top: H - 46,
          width: bw,
          height: 40,
          textAlign: "center",
          color: theme.muted,
          fontFamily: theme.fontBody,
          fontSize: 12,
          lineHeight: "18px",
          whiteSpace: "nowrap",
          opacity: trackOn ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 300ms ease"
        }}
      >
        {bars[0].label}
      </div>

      <div
        style={{
          position: "absolute",
          left: x1,
          top: H - 46,
          width: bw,
          height: 40,
          textAlign: "center",
          color: theme.muted,
          fontFamily: theme.fontBody,
          fontSize: 12,
          lineHeight: "18px",
          whiteSpace: "nowrap",
          opacity: trackOn ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 300ms ease"
        }}
      >
        {bars[1].label}
      </div>
    </StageFrame>
  );
}
