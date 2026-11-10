import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, Crown, Plus } from "lucide-react";

// Net worth's presentational parts: Progress's net worth view
// (ProgressTrackerDashboard.jsx), its row pages (MobileWorthDetail.jsx) and
// the dev mock (/dev/net-worth-mock). Every word, number and colour comes
// through props (worthUi.jsx). First drafted by DeepSeek from a written
// brief, then edited here: repo code doesn't go back to DeepSeek.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function Segmented({ options, value, onChange, theme, onBand, ariaLabel }) {
  const buttons = useRef([]);
  const at = options.findIndex(o => o.key === value);
  const onKeyDown = (e, i) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
    onChange(options[next].key);
    buttons.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={ariaLabel}
      style={{ display: "flex", width: "100%", boxSizing: "border-box", padding: 3, borderRadius: 100, background: onBand ? theme.bandTrack : theme.track }}>
      {options.map((o, i) => {
        const on = i === at;
        return (
          <button key={o.key} ref={n => { buttons.current[i] = n; }} type="button" role="radio" aria-checked={on}
            tabIndex={i === Math.max(at, 0) ? 0 : -1} onClick={() => onChange(o.key)} onKeyDown={e => onKeyDown(e, i)}
            style={{ flex: 1, minHeight: 32, padding: "0 8px", borderRadius: 100, border: "none", cursor: "pointer", fontFamily: theme.fontBody, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
              background: on ? (onBand ? theme.bandText : theme.surface) : "transparent",
              color: on ? (onBand ? theme.band : theme.text) : (onBand ? theme.bandMuted : theme.muted),
              transition: "background 200ms ease, color 200ms ease" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// A small button showing the current choice, opening a short list. The button
// is 44px tall to tap, with a 28px pill drawn inside it.
export function Dropdown({ options, value, onChange, theme, onBand, ariaLabel, alignRight = onBand }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null), list = useRef(null), trigger = useRef(null);
  const current = options.find(o => o.key === value);

  useEffect(() => {
    if (!open) return undefined;
    list.current?.querySelector('[aria-selected="true"]')?.focus();
    const away = e => { if (!root.current?.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const onListKey = e => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...list.current.querySelectorAll("button")];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div ref={root} style={{ position: "relative", flexShrink: 0, margin: "-8px 0" }}>
      <button ref={trigger} type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${ariaLabel}: ${current?.label}`} onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", minHeight: 44, padding: 0, background: "transparent", border: "none", cursor: "pointer", fontFamily: theme.fontBody }}>
        <span style={{ display: "flex", alignItems: "center", gap: 3, height: 28, padding: "0 8px 0 11px", borderRadius: 100, whiteSpace: "nowrap", fontSize: 12, fontWeight: 600,
          background: onBand ? theme.bandTrack : theme.track, color: onBand ? theme.bandText : theme.text }}>
          {current?.label}
          <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }}/>
        </span>
      </button>
      {open && (
        <div ref={list} role="listbox" aria-label={ariaLabel} onKeyDown={onListKey}
          style={{ position: "absolute", top: "calc(100% - 4px)", right: alignRight ? 0 : "auto", left: alignRight ? "auto" : 0, zIndex: 20, minWidth: 136, padding: 4, background: theme.surface, borderRadius: 12, boxShadow: "0 8px 22px rgba(0,0,0,0.24)" }}>
          {options.map(o => {
            const on = o.key === value;
            return (
              <button key={o.key} type="button" role="option" aria-selected={on} onClick={() => { onChange(o.key); setOpen(false); trigger.current?.focus(); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", minHeight: 40, padding: "0 10px", border: "none", borderRadius: 8, background: on ? theme.track : "transparent", color: theme.text, fontFamily: theme.fontBody, fontSize: 13, fontWeight: on ? 700 : 500, cursor: "pointer", textAlign: "left", whiteSpace: "nowrap" }}>
                {o.label}
                {on && <Check size={14} strokeWidth={2.4} aria-hidden="true"/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const figureSize = text => (text.length > 12 ? 34 : text.length > 9 ? 40 : 46);

function Figure({ theme, text, ariaLabel }) {
  return (
    <div role="group" aria-label={ariaLabel} data-band-keep="figure"
      style={{ fontFamily: theme.fontFigure, fontWeight: 700, color: theme.bandText, lineHeight: 1, letterSpacing: "-0.01em", fontSize: figureSize(text), fontVariantNumeric: "tabular-nums" }}>
      {text}
    </div>
  );
}

function Trend({ tone }) {
  const up = tone === "up";
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <path d={up ? "M1 9.4 L4.3 5.6 L6.6 7.9 L11 2.7" : "M1 2.6 L4.3 6.4 L6.6 4.1 L11 9.3"}/>
      <path d={up ? "M7.9 2.7 H11 V5.8" : "M7.9 9.3 H11 V6.2"}/>
    </svg>
  );
}

export function HeroSummary({ theme, format, labels, netWorth, assetsTotal, debtsTotal, change, action }) {
  const cols = [
    { label: labels.assets, value: assetsTotal, color: theme.asset },
    ...(debtsTotal ? [{ label: labels.debts, value: debtsTotal, color: theme.debt, negative: true }] : []),
  ];
  return (
    <>
      <Figure theme={theme} text={format(netWorth)} ariaLabel={labels.netWorthAria}/>
      {change && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: change.tone === "up" ? theme.asset : change.tone === "down" ? theme.debt : theme.bandMuted }}>
          {change.tone !== "flat" && <Trend tone={change.tone}/>}
          <span>{change.text}</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 22, marginTop: 16 }}>
        {cols.map(c => (
          <div key={c.label} style={{ flex: "0 0 auto", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: theme.bandMuted, lineHeight: 1.3 }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }}/>
              {c.label}
            </div>
            <div style={{ marginTop: 3, fontSize: 15, fontWeight: 700, color: theme.bandText, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{c.negative ? `(${format(c.value)})` : format(c.value)}</div>
          </div>
        ))}
        {action && <div style={{ marginLeft: "auto", marginBottom: -3 }}>{action}</div>}
      </div>
    </>
  );
}

// One timeline, months apart: the past as a solid line and the projection
// dashed, with Now between them. Swiping sideways moves along it, and the
// vertical scale follows what's in view. `points`: { t (year * 12 + month),
// label, value }.
const H = 144, PT = 8, PB = 122, GUTTER = 46, PL = 5;

export function TrendChart({ theme, format, formatAxis, labels, windows, range, points, nowIndex, lineColor, reduceMotion }) {
  const line = lineColor || theme.asset;
  const uid = useId().replace(/:/g, "");
  const rootRef = useRef(null), scroller = useRef(null), frame = useRef(0), slRef = useRef(0), drag = useRef(null);
  const [width, setWidth] = useState(320);
  const [sl, setSl] = useState(0);
  const [reading, setReading] = useState(null);
  const [revealed, setRevealed] = useState(!!reduceMotion);

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    setWidth(node.getBoundingClientRect().width || 320);
    const ro = new ResizeObserver(([e]) => { if (e.contentRect.width > 0) setWidth(e.contentRect.width); });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const plotW = Math.max(20, width - GUTTER - PL);
  const months = windows.find(w => w.key === range)?.months ?? Infinity;
  const span = Math.max(1, Math.min(months, n - 1));
  const perMonth = plotW / span;
  const maxScroll = Math.max(0, (n - 1) * perMonth - plotW);

  // Opens with Now three-quarters across: the past to its left and the start
  // of the projection to its right, so there's visibly more either way.
  useLayoutEffect(() => {
    const target = clamp(nowIndex * perMonth - 0.75 * plotW, 0, maxScroll);
    if (scroller.current) scroller.current.scrollLeft = target;
    slRef.current = target;
    setSl(target);
    setReading(null);
  }, [nowIndex, perMonth, plotW, maxScroll]);

  useEffect(() => {
    if (reduceMotion) { setRevealed(true); return undefined; }
    setRevealed(false);
    let b = 0;
    const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setRevealed(true)); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, [range, reduceMotion]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onScroll = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const v = scroller.current?.scrollLeft ?? 0;
      if (Math.abs(v - slRef.current) > 2) setReading(null);
      slRef.current = v;
      setSl(v);
    });
  };

  // What's in view, its edges interpolated so the scale moves smoothly. A
  // bounce past either end (Safari's overscroll) reads as that end: before
  // the first saved month there's nothing to draw (it crashed the screen).
  const at = clamp(sl, 0, maxScroll);
  const first = at / perMonth, last = Math.min((at + plotW) / perMonth, n - 1);
  const valueAt = f => {
    const i = clamp(Math.floor(f), 0, n - 2);
    return points[i].value + (points[i + 1].value - points[i].value) * (f - i);
  };
  let lo = Math.min(valueAt(first), valueAt(last)), hi = Math.max(valueAt(first), valueAt(last));
  for (let i = Math.ceil(first); i <= Math.floor(last); i++) { lo = Math.min(lo, points[i].value); hi = Math.max(hi, points[i].value); }
  const pad = hi === lo ? (Math.abs(hi) * 0.1 || 1) : (hi - lo) * 0.12;
  lo = lo >= 0 ? Math.max(0, lo - pad) : lo - pad; // positive values never get a negative axis
  hi += pad;

  const xAt = i => PL + i * perMonth - at;
  const yAt = v => PT + (1 - (v - lo) / (hi - lo)) * (PB - PT);
  const a = Math.max(0, Math.floor(first) - 1), b = Math.min(n - 1, Math.ceil(last) + 1);
  const path = (from, to) => {
    let d = "";
    for (let i = from; i <= to; i++) d += `${i === from ? "M" : "L"}${xAt(i).toFixed(1)} ${yAt(points[i].value).toFixed(1)} `;
    return d;
  };
  const past = a < nowIndex ? path(a, Math.min(b, nowIndex)) : "";
  const future = b > nowIndex ? path(Math.max(a, nowIndex), b) : "";
  const area = past ? `${past}L${xAt(Math.min(b, nowIndex)).toFixed(1)} ${PB} L${xAt(a).toFixed(1)} ${PB} Z` : "";
  const xNow = xAt(nowIndex);
  const futureInView = last > nowIndex;

  const step = span <= 18 ? 3 : span <= 72 ? 12 : 60;
  const ticks = [];
  for (let i = a; i <= b; i++) {
    if (i === nowIndex || points[i].t % step) continue;
    const x = xAt(i);
    if (x < 16 || x > plotW - 16 || Math.abs(x - xNow) < 36) continue;
    ticks.push({ i, x, text: step < 12 ? points[i].label : String(Math.floor(points[i].t / 12)) });
  }

  const readAt = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    setReading(clamp(Math.round((e.clientX - rect.left - PL + at) / perMonth), 0, n - 1));
  };
  const onPointerDown = e => { if (e.pointerType === "mouse") drag.current = { x: e.clientX, from: scroller.current.scrollLeft, moved: false }; };
  const onPointerMove = e => {
    if (e.pointerType !== "mouse") return;
    const d = drag.current;
    if (!d) { readAt(e); return; }
    if (Math.abs(e.clientX - d.x) > 3) d.moved = true;
    if (d.moved) scroller.current.scrollLeft = d.from - (e.clientX - d.x);
  };
  const onPointerUp = e => {
    if (e.pointerType === "mouse") { drag.current = null; return; }
    readAt(e); // a touch only gets here if it was a tap: a swipe becomes a scroll
  };
  const onPointerLeave = e => { if (e.pointerType === "mouse") { drag.current = null; setReading(null); } };

  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
  const anim = !reduceMotion && revealed;
  const lineProps = { fill: "none", stroke: line, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" };
  const readout = reading !== null ? points[reading] : null;
  const small = { fontSize: 11, fill: theme.bandMuted, style: { fontFamily: theme.fontBody, fontVariantNumeric: "tabular-nums" } };

  return (
    <div ref={rootRef} style={{ width: "100%", position: "relative" }}>
      <div style={{ height: 18, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {readout ? (
          <>
            <span style={{ fontSize: 12, color: theme.bandMuted, whiteSpace: "nowrap" }}>{readout.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.bandText, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{format(Math.round(readout.value))}</span>
          </>
        ) : futureInView ? <span style={{ fontSize: 12, color: theme.bandMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{labels.projectedNote}</span> : null}
      </div>
      <div style={{ position: "relative" }}>
        {/* data-scrub: a swipe here moves the chart, not the band's views
            or the sheet (ScreenBand.jsx). */}
        <div ref={scroller} onScroll={onScroll} tabIndex={0} role="group" aria-label={labels.chartAria} data-scrub=""
          style={{ overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", overscrollBehaviorX: "none", WebkitOverflowScrolling: "touch" }}>
          <div style={{ width: PL + (n - 1) * perMonth + GUTTER, height: H }}>
            <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerLeave}
              style={{ display: "block", position: "sticky", left: 0, cursor: maxScroll > 0 ? "grab" : "default" }}>
              <defs>
                <linearGradient id={`area${uid}`} x1="0" y1={PT} x2="0" y2={PB} gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={line} stopOpacity={0.22}/>
                  <stop offset="100%" stopColor={line} stopOpacity={0}/>
                </linearGradient>
                <clipPath id={`clip${uid}`}>
                  <rect x={0} y={0} height={H} width={revealed ? plotW + PL : 0}
                    style={{ width: revealed ? plotW + PL : 0, transition: anim ? `width 900ms ${ease}` : "none" }}/>
                </clipPath>
              </defs>
              {[0, 0.5, 1].map(s => {
                const y = PT + s * (PB - PT);
                return (
                  <g key={s}>
                    <line x1={0} y1={y} x2={plotW + PL} y2={y} stroke={theme.bandHairline} strokeDasharray="2 4"/>
                    <text x={width - 2} y={y} textAnchor="end" dominantBaseline="middle" {...small}>{formatAxis(Math.round(hi - s * (hi - lo)))}</text>
                  </g>
                );
              })}
              <g clipPath={`url(#clip${uid})`}>
                {area && <path d={area} fill={`url(#area${uid})`}/>}
                {past && <path d={past} {...lineProps}/>}
                {future && <path d={future} {...lineProps} strokeDasharray="6 5"/>}
              </g>
              {xNow >= 0 && xNow <= plotW + PL && (
                <circle cx={xNow} cy={yAt(points[nowIndex].value)} r={4} fill={line} stroke={theme.band} strokeWidth={2}/>
              )}
              {readout && (
                <g>
                  <line x1={xAt(reading)} x2={xAt(reading)} y1={PT} y2={PB} stroke={theme.bandMuted}/>
                  <circle cx={xAt(reading)} cy={yAt(readout.value)} r={5} fill={line}/>
                </g>
              )}
              {ticks.map(t => <text key={t.i} x={t.x} y={H - 6} textAnchor="middle" {...small}>{t.text}</text>)}
              {xNow >= 0 && xNow <= plotW + PL && (
                <text x={xNow} y={H - 6} textAnchor={xNow < 18 ? "start" : xNow > plotW - 18 ? "end" : "middle"} {...small} style={{ ...small.style, fontWeight: 700 }} fill={theme.bandText}>{labels.now}</text>
              )}
            </svg>
          </div>
        </div>
        {sl > 2 && <div aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width: 22, height: PB, pointerEvents: "none", background: `linear-gradient(90deg, ${theme.band}, transparent)` }}/>}
      </div>
    </div>
  );
}

export function CompositionBar({ theme, parts, ariaLabel }) {
  const shown = parts.filter(p => p.value > 0);
  if (!shown.length) return null;
  return (
    <div role="img" aria-label={ariaLabel} style={{ display: "flex", width: "100%", height: 5, gap: 2 }}>
      {shown.map((p, i) => (
        <div key={p.id} style={{ flexGrow: p.value, flexBasis: 0, minWidth: 4, background: p.color,
          borderRadius: shown.length === 1 ? 3 : i === 0 ? "3px 0 0 3px" : i === shown.length - 1 ? "0 3px 3px 0" : 0 }}/>
      ))}
    </div>
  );
}

// A dot for each way of grouping the rows, centred at the top of the sheet:
// the one showing in ink, each a 44px-tall button (overlapping what's
// around it, so the row takes little room), and a line for screen readers
// as each switch happens. Swiping the lists switches too (useBandViews).
export function ViewDots({ theme, views, view, moved, onPick, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", justifyContent: "center", margin: "-16px 0 -8px" }}>
      {views.map((v, i) => (
        <button key={v.key} type="button" onClick={() => onPick(i)} aria-label={`Group by ${v.label.toLowerCase()}`} aria-pressed={i === view}
          style={{ width: 24, height: 44, background: "none", border: 0, padding: 0, cursor: "pointer", display: "grid", placeItems: "center" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: i === view ? theme.text : theme.dot, transition: "background 0.2s" }}/>
        </button>
      ))}
      <div aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{moved ? `Grouped by ${views[view].label.toLowerCase()}` : ""}</div>
    </div>
  );
}

// A section of rows in one container. Values share one right-hand edge with
// the section's total. A count beside the name says the row is several
// accounts. A row with a note is for the breakdown pages only.
// A section's title, as a tile's (TILE_KICKER in design-tokens.js).
const kicker = theme => ({ margin: 0, fontSize: 11, fontWeight: 600, color: theme.muted, letterSpacing: "0.09em", textTransform: "uppercase", lineHeight: 1.3 });

// The section's title, total and bar sit inside its tile, above the rows.
// Rows are top-aligned: the name and £ level with the icon's top, a note
// under the name and a gain (`sub`) under the £. The rules between rows run
// from the icon's left edge.
export function GroupedList({ theme, format, title, titleAction, total, totalNegative, noBar, items, barAria, onOpen, first, addRow }) {
  const hair = <span aria-hidden="true" style={{ position: "absolute", top: 0, left: 14, right: 0, height: 1, background: theme.hairline }}/>;
  const row = { display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 14px", minHeight: 52, boxSizing: "border-box", width: "100%", fontFamily: "inherit", textAlign: "left", background: "transparent", border: "none", color: theme.text, margin: 0 };
  const tile = (bg, color) => ({ width: 30, height: 30, flexShrink: 0, borderRadius: 9, background: bg, color, display: "flex", alignItems: "center", justifyContent: "center" });
  const bar = !noBar && items.filter(it => !it.dim).length >= 2;
  // The name and £ on one line from the icon's top edge.
  const line = { fontSize: 13, lineHeight: "17px" };
  return (
    <section aria-label={title} style={{ marginTop: first ? 0 : 24, fontFamily: theme.fontBody }}>
      {titleAction && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>{titleAction}</div>}
      <div style={{ background: theme.surface, borderRadius: 14, boxShadow: theme.shadow, overflow: "hidden" }}>
        <div style={{ padding: "14px 14px 4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <h2 style={kicker(theme)}>{title}</h2>
            {/* The total in the title's own type, so it sits back with it. */}
            {total != null && <div style={{ ...kicker(theme), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{totalNegative ? `(${format(total)})` : format(total)}</div>}
          </div>
          {bar && <div style={{ marginTop: 10 }}><CompositionBar theme={theme} parts={items} ariaLabel={barAria}/></div>}
        </div>
        <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
        {items.map((it, i) => {
          const value = it.text ?? (it.negative ? `(${format(it.value)})` : format(it.value));
          const said = [it.label, value, it.subSaid, it.count > 1 ? it.countSaid : null, it.note].filter(Boolean).join(", ");
          const inner = (
            <>
              {it.logo
                ? <img src={it.logo} alt="" width="30" height="30" loading="lazy" style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, objectFit: "contain", background: "#fff", border: `1px solid ${theme.hairline}`, boxSizing: "border-box" }}/>
                : it.icon && <span aria-hidden="true" style={it.dim ? tile(theme.track, theme.muted) : tile(it.color, theme.surface)}>{it.icon}</span>}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ ...line, display: "flex", alignItems: "center", gap: 6, fontWeight: it.dim ? 600 : 700, color: it.dim ? theme.muted : theme.text }}>
                  {it.label}
                  {it.count > 1 && <span aria-hidden="true" style={{ fontSize: 11, fontWeight: 700, color: theme.muted, background: theme.track, borderRadius: 100, minWidth: 18, height: 17, padding: "0 5px", boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{it.count}</span>}
                </span>
                {it.note && <span style={{ display: "block", marginTop: 2, fontSize: 12, color: theme.muted, lineHeight: 1.4 }}>{it.note}</span>}
              </span>
              <span style={{ flexShrink: 0, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                <span style={{ ...line, display: "block", fontWeight: it.dim ? 600 : 700, color: it.dim ? theme.muted : theme.text }}>{value}</span>
                {it.sub && <span style={{ display: "block", marginTop: 2, fontSize: 12, lineHeight: 1.4, fontWeight: 500, color: it.subTone === "gain" ? theme.gainText : theme.muted }}>{it.sub}</span>}
              </span>
            </>
          );
          return (
            <li key={it.id} style={{ position: "relative" }}>
              {i > 0 && hair}
              {onOpen && it.openable !== false
                ? <button type="button" aria-label={said} onClick={() => onOpen(it.id)} style={{ ...row, cursor: "pointer" }}>{inner}</button>
                : <div style={row}>{inner}</div>}
            </li>
          );
        })}
        {addRow && (
          <li style={{ position: "relative" }}>
            {items.length > 0 && hair}
            <button type="button" onClick={addRow.onAdd} style={{ ...row, alignItems: "center", cursor: "pointer" }}>
              <span aria-hidden="true" style={tile(theme.track, theme.text)}><Plus size={16} strokeWidth={2}/></span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700 }}>{addRow.label}</span>
              {addRow.locked && <Crown size={15} strokeWidth={2} color={theme.premium} aria-label={addRow.lockedSaid}/>}
            </button>
          </li>
        )}
        </ul>
      </div>
    </section>
  );
}

export function NetWorthScreen({ theme, format, formatAxis, labels, netWorth, assetsTotal, debtsTotal, change, chart, views, view, onViewChange, assets, debts, onOpen, addAsset, addDebt }) {
  return (
    <div style={{ fontFamily: theme.fontBody, background: theme.page, color: theme.text, minHeight: "100%" }}>
      <div style={{ background: theme.band, padding: "22px 20px" }}>
        <HeroSummary theme={theme} format={format} labels={labels} netWorth={netWorth} assetsTotal={assetsTotal} debtsTotal={debtsTotal} change={change}
          action={<Dropdown onBand options={chart.windows} value={chart.range} onChange={chart.onRangeChange} theme={theme} ariaLabel={labels.rangeAria}/>}/>
        <div style={{ marginTop: 8 }}>
          <TrendChart theme={theme} format={format} formatAxis={formatAxis} labels={labels} {...chart}/>
        </div>
      </div>
      <div style={{ padding: "20px 20px 120px" }}>
        <GroupedList theme={theme} format={format} title={labels.assetsTitle} total={assetsTotal} items={assets} barAria={labels.assetsBarAria} onOpen={onOpen} first addRow={addAsset}
          titleAction={<Dropdown options={views} value={view} onChange={onViewChange} theme={theme} ariaLabel={labels.viewAria}/>}/>
        <GroupedList theme={theme} format={format} title={labels.debtsTitle} total={debtsTotal} totalNegative items={debts} barAria={labels.debtsBarAria} onOpen={onOpen} addRow={addDebt}/>
      </div>
    </div>
  );
}

// A row's own page: its figure and its value over time on the band, then what
// makes it up, and the facts that used to sit under the row. `wrap`:
// { band, sheet }, each a function putting its part in the app's own band
// and sheet (ScreenBand.jsx); without it, plain blocks (the dev mock).
export function DetailScreen({ theme, format, formatAxis, labels, title, value, chart, bandBody, breakdown, breakdownTitle, onOpenPart, more, moreTitle, onOpenMore, facts = [], factsTitle, actions, onBack, children, wrap, logo }) {
  const hasBreakdown = breakdown && breakdown.items.length > 1;
  const hasMore = more && more.length > 0;
  const band = (
      <>
        <button type="button" onClick={onBack} aria-label={labels.backSaid} data-band-keep="title"
          style={{ display: "flex", alignItems: "center", gap: 2, minHeight: 44, margin: "0 0 4px -8px", padding: "0 8px 0 0", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: theme.bandMuted }}>
          <ChevronLeft size={20} strokeWidth={2} aria-hidden="true"/>
          {logo && <img src={logo} alt="" width="22" height="22" style={{ width: 22, height: 22, borderRadius: 6, objectFit: "contain", background: "#fff", margin: "0 7px 0 2px" }}/>}
          {title}
        </button>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <Figure theme={theme} text={value} ariaLabel={`${title} ${value}`}/>
          {chart && <Dropdown onBand options={chart.windows} value={chart.range} onChange={chart.onRangeChange} theme={theme} ariaLabel={labels.rangeAria}/>}
        </div>
        {(bandBody || chart) && (
          <div style={{ marginTop: 8 }}>
            {bandBody || <TrendChart theme={theme} format={format} formatAxis={formatAxis} labels={labels} {...chart}/>}
          </div>
        )}
      </>
  );
  const sheet = (
      <>
        {children}
        {hasBreakdown && (
          <GroupedList theme={theme} format={format} title={breakdownTitle} total={breakdown.total} totalNegative={breakdown.negative} items={breakdown.items} barAria={breakdownTitle} onOpen={onOpenPart} first/>
        )}
        {hasMore && (
          <GroupedList theme={theme} format={format} title={moreTitle} items={more} noBar onOpen={onOpenMore} first={!hasBreakdown}/>
        )}
        {facts.length > 0 && (
          <section aria-label={factsTitle} style={{ marginTop: hasBreakdown || hasMore ? 24 : 0 }}>
            <h2 style={{ ...kicker(theme), margin: "0 0 12px", padding: "0 2px" }}>{factsTitle}</h2>
            <dl style={{ margin: 0, background: theme.surface, borderRadius: 14, boxShadow: theme.shadow, overflow: "hidden" }}>
              {facts.map(([k, v, tone], i) => {
                const soon = labels.soon && v === labels.soon;
                return (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, minHeight: 46, padding: "10px 14px", boxSizing: "border-box", borderTop: i ? `1px solid ${theme.hairline}` : "none", opacity: soon ? 0.6 : 1 }}>
                    <dt style={{ fontSize: 13, color: theme.muted, lineHeight: 1.3 }}>{k}</dt>
                    <dd style={{ margin: 0, fontSize: 13, fontWeight: soon ? 500 : 700, color: soon ? theme.muted : tone === "gain" ? theme.gainText : theme.text, textAlign: "right", lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}>{v}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
        )}
        {actions && actions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
            {actions.map(a => (
              <button key={a.label} type="button" onClick={a.onClick}
                style={{ minHeight: 44, borderRadius: 12, border: "none", background: theme.track, color: a.danger ? theme.dangerText : theme.text, fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </>
  );
  if (wrap) return <div style={{ fontFamily: theme.fontBody, color: theme.text }}>{wrap.band(band)}{wrap.sheet(sheet)}</div>;
  return (
    <div style={{ fontFamily: theme.fontBody, background: theme.page, color: theme.text, minHeight: "100vh" }}>
      <div style={{ background: theme.band, padding: "8px 20px 22px" }}>{band}</div>
      <div style={{ padding: "20px 20px 120px" }}>{sheet}</div>
    </div>
  );
}

// A tax year's payments, a bar a month: principal on the axis, interest above
// it. Tap or hover a bar to read its month. `months`: { label, interest, principal }.
export function MonthlyStack({ theme, format, labels, months, note }) {
  const [pick, setPick] = useState(null);
  const CHART = 96, GAP = 2;
  const max = Math.max(1, ...months.map(m => m.interest + m.principal));
  const picked = pick !== null ? months[pick] : null;
  const key = [{ label: labels.principal, color: theme.asset }, { label: labels.interest, color: theme.interest }];
  return (
    <div>
      <div style={{ height: 18, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: theme.bandMuted, whiteSpace: "nowrap" }}>
        {picked ? (
          <>
            <span>{picked.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.bandText, fontVariantNumeric: "tabular-nums" }}>{labels.interest} {format(picked.interest)}, {labels.principal.toLowerCase()} {format(picked.principal)}</span>
          </>
        ) : note}
      </div>
      <div role="group" aria-label={labels.aria} style={{ display: "flex", gap: 4, marginTop: 8 }}>
        {months.map((m, i) => {
          const total = m.interest + m.principal;
          const room = CHART - (m.interest && m.principal ? GAP : 0);
          const ih = total ? Math.max(m.interest ? 2 : 0, (m.interest / max) * room) : 0;
          const ph = total ? Math.max(m.principal ? 2 : 0, (m.principal / max) * room) : 0;
          return (
            <button key={m.label} type="button" disabled={!total}
              aria-label={total ? `${m.label}: ${labels.interest} ${format(m.interest)}, ${labels.principal} ${format(m.principal)}` : m.label}
              onClick={() => setPick(p => (p === i ? null : i))}
              onPointerEnter={e => { if (e.pointerType === "mouse" && total) setPick(i); }}
              onPointerLeave={e => { if (e.pointerType === "mouse") setPick(null); }}
              style={{ flex: 1, minWidth: 0, padding: 0, background: "transparent", border: "none", cursor: total ? "pointer" : "default", fontFamily: "inherit", opacity: pick !== null && pick !== i ? 0.45 : 1 }}>
              <span style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: m.interest && m.principal ? GAP : 0, height: CHART }}>
                {total === 0 && <span style={{ display: "block", height: 2, background: theme.bandTrack }}/>}
                {ih > 0 && <span style={{ display: "block", height: ih, background: theme.interest, borderRadius: "4px 4px 0 0" }}/>}
                {ph > 0 && <span style={{ display: "block", height: ph, background: theme.asset, borderRadius: ih > 0 ? 0 : "4px 4px 0 0" }}/>}
              </span>
              <span style={{ display: "block", marginTop: 6, fontSize: 11, color: theme.bandMuted }}>{m.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
        {key.map(k => (
          <span key={k.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: theme.bandMuted }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: k.color }}/>{k.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// A bottom sheet over a dimmed page.
export function Sheet({ theme, title, onClose, closeSaid, children }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 30, display: "flex", alignItems: "flex-end", justifyContent: "center", background: theme.scrim }}>
      <button type="button" aria-label={closeSaid} onClick={onClose} style={{ position: "absolute", inset: 0, background: "transparent", border: "none" }}/>
      <div role="dialog" aria-modal="true" aria-label={title}
        style={{ position: "relative", width: "100%", maxWidth: 430, maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box", padding: "22px 20px 24px", background: theme.page, borderRadius: "20px 20px 0 0", fontFamily: theme.fontBody, color: theme.text }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
