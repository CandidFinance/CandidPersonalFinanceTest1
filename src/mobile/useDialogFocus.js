import { useEffect, useRef } from "react";

// Keyboard focus for a modal dialog (`ref` on its outermost element): moved
// into it when it opens, kept inside it while Tab and Shift+Tab cycle, and
// handed back to wherever it was when it closes. `onEscape` closes it on
// Escape (left out for a dialog with no way past it). `focusOnOpen: false`
// when the dialog moves focus itself (the Cash tour's Next button).
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function useDialogFocus(ref, { onEscape = null, focusOnOpen = true } = {}) {
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;
  useEffect(() => {
    const before = document.activeElement;
    const box = ref.current;
    if (focusOnOpen && box && !box.contains(document.activeElement)) box.focus({ preventScroll: true });
    const onKey = e => {
      const el = ref.current;
      if (!el) return;
      if (e.key === "Escape" && escapeRef.current) { e.preventDefault(); escapeRef.current(); return; }
      if (e.key !== "Tab") return;
      const items = [...el.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null || x.getClientRects().length);
      if (!items.length) { e.preventDefault(); el.focus({ preventScroll: true }); return; }
      const first = items[0], last = items[items.length - 1];
      const inside = el.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first || document.activeElement === el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (!inside || document.activeElement === last)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (before && before.isConnected && typeof before.focus === "function") before.focus({ preventScroll: true });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
