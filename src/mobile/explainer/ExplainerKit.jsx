// What every walk-through scene is built from: the stage that fits the page,
// the opening text and captions, and the timing hooks. No words, figures or
// colours of its own (playbook: docs/module-walkthrough-playbook.md).
import React, { useEffect, useRef, useState } from "react";

export const EASE_ENTRANCE = "cubic-bezier(0.2,0.7,0.2,1)";
export const EASE_LANDING = "cubic-bezier(0.34,1.56,0.64,1)";
export const EASE_GROWTH = "cubic-bezier(0.22,0.61,0.36,1)";
// Fades out inside the page's side margin, so it never meets a hard edge.
export const TILE_SHADOW = "0 6px 16px rgba(0,0,0,0.10)";

// How long the opening text holds before the visuals start: its build, then time to read it.
export function introLead(intro, pace = 0.6) {
  const words = wordCount(intro);
  return Math.round((words * 55 + Math.max(2500, words * 230)) * pace);
}

// An item that has given way to a newer one: t runs 0 (in focus) to 1 (set back).
export const setBack = t => (t > 0 ? { filter: `blur(${2 * t}px)`, opacity: 1 - 0.5 * t } : {});

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

function splitWords(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean);
}

function wordCount(text) {
  return splitWords(text).length;
}

export function interpArray(t, arr) {
  if (t <= 0) return arr[0];
  if (t >= arr.length - 1) return arr[arr.length - 1];
  const i = Math.floor(t);
  const f = t - i;
  return arr[i] + (arr[i + 1] - arr[i]) * f;
}

export function useStage(reduceMotion) {
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

export function StageFrame({ stage, ariaLabel, children }) {
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

export function useBeats(active, reduceMotion, times, onSettled) {
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

export function useCountUp(target, running, ms, reduceMotion, from = 0) {
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

export function useTween(on, ms, reduceMotion) {
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

export function useLinearRise(target, running, ms, reduceMotion) {
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

export function TextZone({ text, active, reduceMotion, W, theme }) {
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
