import { useEffect, useRef, useState } from "react";
import { useReducedMotion, useScroll, animate } from "framer-motion";
import { G, WHITE, GEORGIA, MONO, HIGHLIGHT, SITE_INK, SITE_MUTED, SITE_RULE } from "../design-tokens.js";
import StartCheckButton from "./StartCheckButton.jsx";
import { HEADER_HEIGHT } from "./SiteHeader.jsx";

// ── The landing page's first screen: the "Statement" design (Highlighter
// version), ported from design/landing/statement-lab.html, where Harvey
// approved it. A headline with four documents around it; on scroll a
// receipt rises, each document is pulled into its line (largest £ first)
// and the total counts up.
//
// Two states, one markup. As served (pre-rendered for search engines and
// link previews), without JavaScript and with reduced motion on, the scene
// is static: the hero, then the finished receipt below it with the real
// total. In a browser with motion allowed, `animated` turns the scene into
// a tall scroll track with a sticky stage, and the effect below drives it.
//
// The scroll animation writes transforms straight onto the elements (as the
// lab does) rather than through useTransform: every value depends on
// measured geometry (where each line sits once the receipt has risen and
// been scaled to fit), which a per-element transform would have to re-read.

// Each document is pulled into the receipt line of the same index.
// `rot` is its resting tilt, multiplied by TILT degrees.
const TILES = [
  { cls: "rs-t1", rot: -1, head: ["Student loan", "Plan 2"], rows: [["Balance", "£48,210"], ["Overpaying", "£100 / month", true], ["Written off", "2054"]] },
  { cls: "rs-t2", rot: 0.8, head: ["Payslip", "Oct 2026"], rows: [["Basic pay", "£7,083.33"], ["Income tax", "£1,786.00"], ["Pension 5%", "£354.17", true]] },
  { cls: "rs-t3 rs-app", rot: 0.6, app: { label: "Easy access saver", balance: "£20,000.00", badge: "1.50% AER" } },
  { cls: "rs-t4", rot: -0.8, head: ["ISA allowance", "2026-27"], rows: [["Used", "£0"], ["Left", "£20,000", true]] },
];

const LINES = [
  { what: "Overpayments on a loan that will be written off", detail: "£100 a month on Plan 2, written off in 2054", amount: 1200 },
  { what: "Higher-rate pension relief not claimed", detail: "The extra 20% on £4,250, claimed through self assessment", amount: 850 },
  { what: "Cash earning 1.5% when 4.4% is available", detail: "£20,000 in an easy access saver", amount: 580 },
  { what: "Interest taxed outside an ISA", detail: "At 4.4%, £380 above the £500 allowance, taxed at 40%", amount: 152 },
];
const TOTAL = LINES.reduce((sum, l) => sum + l.amount, 0);
const pounds = n => "£" + n.toLocaleString("en-GB");

// Timings from the lab's approved settings.
const SCROLL_VH = 300;  // extra scroll the scene holds the stage for
const COUNT_S = 0.9;    // the total's count-up per landed line
const ARC_PX = 40;      // how far a document lifts on its way to the receipt
const TILT = 5;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const CSS = `
  .rs { position: relative; margin-top: -${HEADER_HEIGHT}px; color: ${SITE_INK}; }
  .rs-stage { position: relative; }
  .rs-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 640px) minmax(0, 1fr); grid-template-rows: 1fr 1fr;
    grid-template-areas: "t1 msg t2" "t3 msg t4"; align-items: center; justify-items: center; gap: 12px 32px;
    padding: ${HEADER_HEIGHT + 8}px 40px 56px; max-width: 1760px; margin: 0 auto; min-height: 640px; }
  .rs-msg { grid-area: msg; text-align: center; }
  .rs-msg h1 { font: 700 80px/1.02 ${GEORGIA}; letter-spacing: -0.025em; color: ${SITE_INK}; margin: 0 0 22px; text-wrap: balance; }
  .rs mark { background: linear-gradient(transparent 12%, ${HIGHLIGHT} 12%, ${HIGHLIGHT} 92%, transparent 92%); color: inherit; padding: 0 .08em; }
  .rs-lede { font-size: 18px; line-height: 1.5; color: ${SITE_MUTED}; max-width: 520px; margin: 0 auto 28px; text-wrap: pretty; }
  .rs-reassure { display: flex; justify-content: center; flex-wrap: wrap; gap: 6px 18px; margin-top: 16px; font-size: 14px; font-weight: 500; color: ${SITE_MUTED}; }
  .rs-reassure span::before { content: ""; display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: currentColor; margin-right: 8px; vertical-align: middle; }
  .rs-quick { margin-top: 10px; font-size: 13.5px; color: ${SITE_MUTED}; }
  .rs-quick a { color: ${SITE_INK}; font-weight: 600; }
  .rs-hint { display: none; }

  /* Desktop documents grow with the screen (360px and 14.4px type at 1440
     wide, up to 420px), filling the page's width either side of the message. */
  .rs-tile { position: relative; z-index: 3; width: min(25vw, 420px, 100%); background: ${WHITE}; color: ${SITE_MUTED}; border: 1px solid ${SITE_RULE};
    border-radius: 6px; padding: 1.35em 1.5em; font: clamp(12px, 1vw, 16px)/1.5 ${MONO}; box-shadow: 0 18px 40px -22px rgba(20,35,28,.35), 0 2px 4px rgba(20,35,28,.05);
    transform: rotate(calc(var(--r) * ${TILT}deg)); }
  .rs-tile h4 { margin: 0 0 .8em; font: 600 .92em/1 ${MONO}; letter-spacing: .08em; text-transform: uppercase; color: ${SITE_INK}; display: flex; justify-content: space-between; gap: 1.4em; }
  .rs-tile .rs-row { display: flex; justify-content: space-between; gap: 1.4em; padding: .25em 0; border-top: 1px dashed ${SITE_RULE}; }
  .rs-tile .rs-row:first-of-type { border-top: 0; }
  .rs-tile b { font-weight: 600; color: ${SITE_INK}; }
  .rs-tile .rs-hl { background: linear-gradient(transparent 14%, ${HIGHLIGHT} 14%, ${HIGHLIGHT} 90%, transparent 90%); padding: 0 3px; margin: 0 -3px; }
  .rs-tile.rs-app { font-family: 'DM Sans', sans-serif; border-radius: 18px; }
  .rs-app .rs-bal { font: 600 2.1em/1.1 'DM Sans', sans-serif; color: ${SITE_INK}; letter-spacing: -.02em; margin: .1em 0 .4em; }
  .rs-app .rs-badge { display: inline-block; font-weight: 600; padding: .3em .6em; border-radius: 6px; color: ${SITE_INK}; background: ${HIGHLIGHT}; }
  /* Each pair sits in the middle of its half of the screen, well apart, and
     staggered towards the page edges where there's room (wide screens). */
  .rs-t1 { grid-area: t1; justify-self: start; } .rs-t2 { grid-area: t2; justify-self: end; }
  .rs-t3 { grid-area: t3; justify-self: end; } .rs-t4 { grid-area: t4; justify-self: start; }

  .rs-receipt { position: relative; z-index: 2; width: min(620px, calc(100% - 32px)); margin: 30px auto 0; background: ${WHITE}; color: ${SITE_INK};
    border: 1px solid ${SITE_RULE}; border-radius: 4px; padding: 34px 40px 30px; box-shadow: 0 40px 80px -40px rgba(20,35,28,.45); }
  .rs-receipt::before, .rs-receipt::after { content: ""; position: absolute; left: -1px; right: -1px; height: 9px;
    background: radial-gradient(circle at 9px 9px, transparent 6px, ${WHITE} 6.5px) 0 0/18px 9px repeat-x; }
  .rs-receipt::before { top: -9px; transform: scaleY(-1); } .rs-receipt::after { bottom: -9px; }
  .rs-rhead { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; border-bottom: 2px solid ${SITE_INK}; padding-bottom: 12px; }
  .rs-rhead h2 { font: 700 22px/1.2 ${GEORGIA}; letter-spacing: -.02em; margin: 0; }
  .rs-eg { font: 500 10.5px/1.45 ${MONO}; text-transform: uppercase; letter-spacing: .07em; color: ${SITE_MUTED}; text-align: right; }
  .rs-line { display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: baseline; padding: 13px 0; border-bottom: 1px dashed ${SITE_RULE};
    transition: opacity .35s ease, background-color .6s ease; }
  .rs-line .rs-what { font-size: 15.5px; line-height: 1.4; }
  .rs-line small { display: block; font: 11.5px/1.5 ${MONO}; color: ${SITE_MUTED}; margin-top: 2px; }
  .rs-line .rs-amt { font: 500 17px/1 ${MONO}; font-variant-numeric: tabular-nums; }
  .rs-line .rs-what, .rs-line .rs-amt { transition: filter .35s ease; }
  .rs-total { display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: 16px; padding-top: 18px; }
  .rs-total .rs-what { font: 700 12px/1.3 ${MONO}; text-transform: uppercase; letter-spacing: .08em; }
  .rs-total .rs-amt { font: 700 64px/1 ${GEORGIA}; color: ${G}; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
  .rs-total .rs-amt span { font: 500 14px/1 'DM Sans', sans-serif; color: ${SITE_MUTED}; letter-spacing: 0; margin-left: 6px; }
  .rs-foot { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 20px; transition: opacity .4s ease; }
  .rs-foot p { margin: 0; font-size: 12.5px; color: ${SITE_MUTED}; max-width: 300px; }

  /* Animated: the scene becomes a scroll track; the stage sticks while the
     receipt rises over it. Lines start faint until their document lands. */
  .rs.rs-animated { height: calc(100vh + ${SCROLL_VH}vh); height: calc(100svh + ${SCROLL_VH}vh); }
  .rs-animated .rs-stage { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; }
  .rs-animated .rs-hero { height: 100%; min-height: 0; }
  .rs-animated .rs-msg, .rs-animated .rs-tile, .rs-animated .rs-receipt { will-change: transform, opacity; }
  .rs-animated .rs-receipt { position: absolute; left: 50%; top: 50%; margin: 0; translate: -50% -50%; }
  .rs-animated .rs-line:not(.is-in) { opacity: .18; }
  .rs-animated .rs-line:not(.is-in) .rs-what, .rs-animated .rs-line:not(.is-in) .rs-amt { filter: blur(3px); }
  .rs-animated .rs-line.is-lit { background: color-mix(in srgb, ${HIGHLIGHT} 45%, transparent); }
  .rs-animated .rs-foot:not(.is-shown) { opacity: 0; pointer-events: none; }
  .rs-animated .rs-hint { display: block; position: absolute; left: 0; right: 0; bottom: 18px; text-align: center;
    font: 500 11px/1 ${MONO}; letter-spacing: .1em; text-transform: uppercase; color: ${SITE_MUTED}; }

  /* Narrower desktops: a slimmer middle column and smaller documents. */
  @media (max-width: 1180px) {
    .rs-hero { grid-template-columns: minmax(0, 1fr) minmax(0, 470px) minmax(0, 1fr); }
    .rs-msg h1 { font-size: 60px; }
    .rs-tile { font-size: 10.5px; padding: 13px 14px; }
  }
  /* Phones and tablets: two documents above the message, two below. */
  @media (max-width: 900px) {
    .rs-hero { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto auto auto;
      grid-template-areas: "t1 t2" "msg msg" "t3 t4"; align-content: center; gap: 14px 10px; padding: ${HEADER_HEIGHT}px 16px 40px; min-height: 0; }
    .rs-msg h1 { font-size: 42px; }
    .rs-lede { font-size: 15.5px; margin-bottom: 20px; }
    .rs-quick { display: none; }
    .rs-reassure { font-size: 12.5px; gap: 4px 12px; margin-top: 12px; }
    .rs-tile { width: 100%; max-width: 170px; font-size: 9.5px; padding: 9px 10px; justify-self: center; }
    .rs-t1, .rs-t2 { align-self: end; } .rs-t3, .rs-t4 { align-self: start; }
    .rs-app .rs-bal { font-size: 1.8em; }
    .rs-receipt { padding: 24px 18px 22px; }
    .rs-rhead { flex-direction: column; gap: 6px; }
    .rs-eg { text-align: left; }
    .rs-line { padding: 10px 0; gap: 12px; }
    .rs-line .rs-what { font-size: 14px; }
    .rs-line small { font-size: 10.5px; }
    .rs-line .rs-amt { font-size: 15px; }
    .rs-total .rs-amt { font-size: 48px; }
  }
  /* Short phones (e.g. 375x640): the fixed header takes 80px of the first
     screen, so everything tightens to keep all four documents uncropped. */
  @media (max-width: 900px) and (max-height: 760px) {
    .rs-hero { gap: 10px 10px; padding-bottom: 14px; }
    .rs-msg h1 { font-size: 34px; margin-bottom: 12px; }
    .rs-lede { font-size: 14px; line-height: 1.45; margin-bottom: 14px; }
    .rs-reassure { margin-top: 8px; }
    .rs-tile { font-size: 8.5px; padding: 7px 9px; }
  }
`;

export default function ReceiptScene() {
  const reduceMotion = useReducedMotion();
  const [animated, setAnimated] = useState(false);
  const { scrollY } = useScroll();

  const sceneRef = useRef(null);
  const stageRef = useRef(null);
  const messageRef = useRef(null);
  const receiptRef = useRef(null);
  const footRef = useRef(null);
  const totalRef = useRef(null);
  const hintRef = useRef(null);
  const tileRefs = useRef([]);
  const lineRefs = useRef([]);

  // Only a browser with motion allowed gets the scroll scene.
  useEffect(() => { setAnimated(!reduceMotion); }, [reduceMotion]);

  useEffect(() => {
    if (!animated) return;
    const scene = sceneRef.current, stage = stageRef.current, message = messageRef.current, receipt = receiptRef.current;
    const foot = footRef.current, totalEl = totalRef.current, hint = hintRef.current;
    // Copies, not the ref arrays themselves: React empties those (each entry
    // to null) as the page unmounts, before this effect's cleanup runs, and
    // the cleanup still needs the elements.
    const tiles = [...tileRefs.current], lines = [...lineRefs.current];
    let geo = null, shown = 0, target = 0, counter = null, alive = true;
    totalEl.textContent = pounds(0);

    // Position relative to the stage, ignoring transforms (offsetLeft/Top).
    function offset(el) {
      let x = 0, y = 0;
      while (el && el !== stage) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
      return [x, y];
    }

    function measure() {
      receipt.style.scale = "";
      const sH = stage.clientHeight, [rx, ry] = offset(receipt), rw = receipt.offsetWidth, rh = receipt.offsetHeight;
      // Shrink the receipt to fit the screen height, perforations included.
      const fit = Math.min(1, (sH - 48) / (rh + 18));
      receipt.style.scale = String(fit);
      // The receipt is centred on (rx, ry) and scaled about that centre.
      geo = {
        rise: sH - (ry - (rh * fit) / 2) + 30,
        tiles: tiles.map((t, i) => {
          const [tx, ty] = offset(t), l = lines[i];
          const lx = rx + (l.offsetLeft + l.offsetWidth / 2 - rw / 2) * fit;
          const ly = ry + (l.offsetTop + l.offsetHeight / 2 - rh / 2) * fit;
          return { dx: lx - (tx + t.offsetWidth / 2), dy: ly - (ty + t.offsetHeight / 2), scaleTo: Math.min(0.5, (l.offsetHeight * fit) / t.offsetHeight) };
        }),
      };
    }

    function tick() {
      if (!geo) return;
      const r = scene.getBoundingClientRect(), span = scene.offsetHeight - stage.offsetHeight;
      const p = clamp(-r.top / Math.max(1, span));
      hint.style.opacity = String(1 - clamp(p / 0.06));
      receipt.style.transform = `translateY(${(1 - easeOut(clamp((p - 0.04) / 0.26))) * geo.rise}px)`;
      const fade = clamp((p - 0.02) / 0.2);
      message.style.opacity = String(1 - fade);
      message.style.transform = `translateY(${-40 * fade}px) scale(${1 - 0.04 * fade})`;
      // Out of the tab order (and the accessibility tree) while faded or
      // hidden, so keyboard focus never lands on a button nobody can see.
      message.inert = fade > 0.5;
      let landed = 0;
      tiles.forEach((t, i) => {
        const e = clamp((p - (0.32 + i * 0.14)) / 0.12), k = easeInOut(e), g = geo.tiles[i];
        const lift = ARC_PX * Math.sin(Math.PI * k);
        t.style.transform = `translate(${g.dx * k}px, ${g.dy * k - lift}px) rotate(${TILES[i].rot * TILT * (1 - k)}deg) scale(${1 - (1 - g.scaleTo) * k})`;
        t.style.opacity = String(1 - clamp((k - 0.7) / 0.3));
        const done = e >= 1;
        lines[i].classList.toggle("is-in", done);
        lines[i].classList.toggle("is-lit", done && p < 0.97);
        if (done) landed += LINES[i].amount;
      });
      foot.classList.toggle("is-shown", p > 0.9);
      foot.inert = p <= 0.9;
      if (landed !== target) {
        target = landed;
        counter?.stop();
        counter = animate(shown, landed, {
          duration: COUNT_S, ease: [0.33, 1, 0.68, 1],
          onUpdate: v => { shown = Math.round(v); totalEl.textContent = pounds(shown); },
        });
      }
    }

    const refresh = () => { measure(); tick(); };
    const unsubscribe = scrollY.on("change", tick);
    window.addEventListener("resize", refresh);
    refresh();
    document.fonts?.ready.then(() => { if (alive) refresh(); });

    return () => {
      alive = false;
      unsubscribe();
      window.removeEventListener("resize", refresh);
      counter?.stop();
      // Back to the finished, static receipt (reduced motion switched on).
      [receipt, message, hint, ...tiles].forEach(el => { el.style.transform = ""; el.style.opacity = ""; });
      receipt.style.scale = "";
      lines.forEach(l => l.classList.remove("is-in", "is-lit"));
      foot.classList.remove("is-shown");
      message.inert = false;
      foot.inert = false;
      totalEl.textContent = pounds(TOTAL);
    };
  }, [animated, scrollY]);

  return (
    <section ref={sceneRef} className={`rs${animated ? " rs-animated" : ""}`}>
      <style>{CSS}</style>
      <div ref={stageRef} className="rs-stage">
        <div className="rs-hero">
          {TILES.map((tile, i) => (
            <div key={tile.cls} ref={el => { tileRefs.current[i] = el; }} className={`rs-tile ${tile.cls}`} style={{ "--r": tile.rot }} aria-hidden="true">
              {tile.app ? (
                <>
                  <div>{tile.app.label}</div>
                  <div className="rs-bal">{tile.app.balance}</div>
                  <span className="rs-badge">{tile.app.badge}</span>
                </>
              ) : (
                <>
                  <h4><span>{tile.head[0]}</span><span>{tile.head[1]}</span></h4>
                  {tile.rows.map(([label, value, hl]) => (
                    <div key={label} className="rs-row"><span>{label}</span><b className={hl ? "rs-hl" : undefined}>{value}</b></div>
                  ))}
                </>
              )}
            </div>
          ))}

          <div ref={messageRef} className="rs-msg">
            <h1>Save the money you're <mark>losing</mark>.</h1>
            <p className="rs-lede">
              Unclaimed pension relief, the £100k tax trap, idle cash and student loan overpayments cost good earners thousands a year. Answer a few questions and see, in pounds, what Candid could help you save.
            </p>
            <StartCheckButton source="hero" size="large" />
            <div className="rs-reassure"><span>First module free</span><span>No card needed</span></div>
            <div className="rs-quick">
              Or answer one question in 30 seconds:{" "}
              <a href="/student-loan-calculator.html">student loan</a>{" · "}
              <a href="/100k-tax-trap-calculator.html">£100k tax trap</a>
            </div>
          </div>
        </div>

        <div ref={receiptRef} className="rs-receipt">
          <div className="rs-rhead">
            <h2>What you could save</h2>
            <div className="rs-eg">Example: £85k salary<br />Plan 2 loan · £20k saved</div>
          </div>
          {LINES.map((line, i) => (
            <div key={line.what} ref={el => { lineRefs.current[i] = el; }} className="rs-line">
              <div className="rs-what">{line.what}<small>{line.detail}</small></div>
              <div className="rs-amt">{pounds(line.amount)}</div>
            </div>
          ))}
          <div className="rs-total">
            <div className="rs-what">You could save</div>
            <div className="rs-amt"><b ref={totalRef} style={{ fontWeight: "inherit" }}>{pounds(TOTAL)}</b><span>a year</span></div>
          </div>
          <div ref={footRef} className="rs-foot">
            <p>Example figures. Yours come from your own answers.</p>
            <StartCheckButton source="receipt" />
          </div>
        </div>

        <div ref={hintRef} className="rs-hint" aria-hidden="true">Scroll to add it up</div>
      </div>
    </section>
  );
}
