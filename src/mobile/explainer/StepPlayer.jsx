import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

// The step-by-step player behind a module's walk-through, and its visuals.
// Knows nothing about the app: text, colours, fonts and formatting all come in
// as props (see ModuleExplainer.jsx).

/* ---------------- shared helpers ---------------- */

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const srOnly = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

/* ---------------- StepPlayer ---------------- */

export function StepPlayer({
  pages = [],
  theme,
  reduceMotion = false,
  onDone,
  onSkip,
  onStep,
  onReplay,
  replayLabel = "Replay this page",
  doneLabel = "Continue",
  skipLabel = "Skip",
  backLabel = "Back",
  nextLabel = "Next",
  pageLabel = (x, y) => `Page ${x} of ${y}`,
}) {
  const [index, setIndex] = useState(0);
  const [replays, setReplays] = useState(0);
  // Which showing of a page has finished its animations; Next fills in then.
  const [settledRun, setSettledRun] = useState(null);

  const [built, setBuilt] = useState(() => {
    const first = pages[0];
    const on = !!reduceMotion;
    const list = (first && first.blocks ? first.blocks : []).map(() => ({
      active: on,
      progress: on ? 1 : 0,
    }));
    return { pageId: first ? first.id : null, list };
  });

  const completedRef = useRef(new Set());
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const cbRef = useRef({ onStep, onDone, onSkip });
  cbRef.current = { onStep, onDone, onSkip };
  const contentRef = useRef(null);

  const total = pages.length;
  const page = pages[index];

  // Opening a page: report it and reset the scroll position.
  useEffect(() => {
    const list = pagesRef.current;
    const current = list[index];
    if (!current) return;
    const cb = cbRef.current.onStep;
    if (cb) cb({ id: current.id, index, total: list.length });
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [index]);

  // Build the current page, or restore it instantly when it was already finished.
  useEffect(() => {
    const list = pagesRef.current;
    const current = list[index];
    if (!current) return undefined;

    const pageBlocks = current.blocks || [];
    const pageId = current.id;
    const alreadyDone = !reduceMotion && completedRef.current.has(pageId);

    if (reduceMotion || alreadyDone) {
      setBuilt({
        pageId,
        list: pageBlocks.map(() => ({ active: true, progress: 1 })),
      });
      return undefined;
    }

    setBuilt({
      pageId,
      list: pageBlocks.map(() => ({ active: false, progress: 0 })),
    });

    let cancelled = false;
    const timers = [];
    const rafs = [];
    let remaining = pageBlocks.length;

    const finishOne = () => {
      remaining -= 1;
      if (remaining <= 0) completedRef.current.add(pageId);
    };

    const animateCount = (i, countMs) => {
      const start = Date.now();
      const tick = () => {
        if (cancelled) return;
        const t = Math.min(1, (Date.now() - start) / countMs);
        const progress = easeOutCubic(t);
        setBuilt((prev) => {
          if (prev.pageId !== pageId || i >= prev.list.length) return prev;
          const next = prev.list.slice();
          next[i] = { active: true, progress };
          return { pageId, list: next };
        });
        if (t < 1) rafs.push(requestAnimationFrame(tick));
        else finishOne();
      };
      rafs.push(requestAnimationFrame(tick));
    };

    if (pageBlocks.length === 0) completedRef.current.add(pageId);

    let elapsed = 0;
    pageBlocks.forEach((b, i) => {
      elapsed += Math.max(0, num(b.gap));
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          const countMs = num(b.countMs);
          setBuilt((prev) => {
            if (prev.pageId !== pageId || i >= prev.list.length) return prev;
            const next = prev.list.slice();
            next[i] = { active: true, progress: countMs > 0 ? 0 : 1 };
            return { pageId, list: next };
          });
          if (countMs > 0) animateCount(i, countMs);
          else finishOne();
        }, elapsed)
      );
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      rafs.forEach(cancelAnimationFrame);
    };
  }, [index, reduceMotion, replays]);

  if (!page) return null;

  const isLast = index >= total - 1;
  const pageBlocks = page.blocks || [];
  const pageIsComplete = reduceMotion || completedRef.current.has(page.id);

  const stateFor = (i) => {
    if (pageIsComplete) return { active: true, progress: 1 };
    if (built.pageId === page.id && built.list[i]) return built.list[i];
    return { active: false, progress: 0 };
  };

  const goNext = () => {
    if (isLast) {
      const cb = cbRef.current.onDone;
      if (cb) cb();
      return;
    }
    setIndex((i) => Math.min(i + 1, total - 1));
  };

  const goBack = () => setIndex((i) => Math.max(0, i - 1));

  // The open page from the start again.
  const replay = () => {
    completedRef.current.delete(page.id);
    setBuilt({ pageId: null, list: [] });
    setReplays((n) => n + 1);
    if (contentRef.current) contentRef.current.scrollTop = 0;
    if (onReplay) onReplay({ id: page.id, index, total });
  };

  const handleSkip = () => {
    const cb = cbRef.current.onSkip;
    if (cb) cb({ id: page.id, index, total });
  };

  const textButton = {
    minHeight: 44,
    minWidth: 44,
    padding: "8px 12px",
    background: "transparent",
    border: "none",
    color: theme.muted,
    fontFamily: theme.fontBody,
    fontSize: 14,
    cursor: "pointer",
  };

  const secondaryButton = {
    minHeight: 44,
    minWidth: 44,
    padding: "10px 18px",
    borderRadius: 100,
    border: `1px solid ${theme.track}`,
    background: "transparent",
    color: theme.text,
    fontFamily: theme.fontBody,
    fontSize: 15,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const primaryButton = {
    minHeight: 44,
    minWidth: 44,
    padding: "10px 20px",
    borderRadius: 100,
    border: "none",
    color: theme.onAccent || theme.surface,
    fontFamily: theme.fontBody,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const settled = settledRun === `${index}-${replays}`;
  const nextButton = {
    ...primaryButton,
    backgroundColor: theme.track,
    backgroundImage: `linear-gradient(${theme.accent}, ${theme.accent})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${settled ? 100 : 0}% 100%`,
    color: settled ? primaryButton.color : theme.muted,
    transition: settled && !reduceMotion ? "background-size 500ms ease, color 300ms ease" : "none",
  };

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: theme.surface,
        color: theme.text,
        fontFamily: theme.fontBody,
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 8px 0" }}>
        <button type="button" onClick={handleSkip} style={textButton}>
          {skipLabel}
        </button>
      </div>

      <div
        ref={contentRef}
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          padding: "4px 20px 20px",
          boxSizing: "border-box",
        }}
      >
        <div key={`${page.id != null ? page.id : index}-${replays}`} style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
          {/* The page's words lead it; its title stays for screen readers. */}
          <h2 style={srOnly}>{page.title}</h2>

          {pageBlocks.map((b, i) => {
            const st = stateFor(i);
            return (
              <div
                key={b.id != null ? b.id : i}
                style={{
                  ...(b.fill ? { flex: "1 1 auto", display: "flex", minHeight: 0 } : { marginBottom: 16 }),
                  opacity: st.active ? 1 : 0,
                  transform: st.active ? "translateY(0)" : "translateY(8px)",
                  transition: reduceMotion ? "none" : "opacity 450ms ease, transform 450ms ease",
                }}
              >
                {b.render({
                  active: st.active,
                  progress: st.progress,
                  reduceMotion,
                  onSettled: i === pageBlocks.length - 1 ? () => setSettledRun(`${index}-${replays}`) : undefined,
                  theme,
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          flex: "0 0 auto",
          borderTop: `1px solid ${theme.track}`,
          padding: "10px 20px",
          paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
        }}
      >
        <div
          aria-hidden="true"
          style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 10 }}
        >
          {pages.map((p, i) => (
            <span
              key={p.id != null ? p.id : i}
              style={{
                height: 8,
                width: i === index ? 18 : 8,
                borderRadius: 4,
                background: i === index ? theme.accent : theme.track,
                transition: reduceMotion ? "none" : "width 250ms ease, background-color 250ms ease",
              }}
            />
          ))}
        </div>
        <span style={srOnly}>{pageLabel(index + 1, total)}</span>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {index > 0 && (
            <button type="button" onClick={goBack} style={secondaryButton}>
              {backLabel}
            </button>
          )}
          <button type="button" onClick={replay} aria-label={replayLabel} title={replayLabel} style={{ ...secondaryButton, padding: 0, width: 44, marginLeft: "auto" }}>
            <RotateCcw size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={goNext} style={nextButton}>
            {isLast ? doneLabel : nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
