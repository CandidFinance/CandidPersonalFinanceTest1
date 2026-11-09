# Module walk-throughs: build playbook

For Claude agents building a module's educational walk-through, or delegating any coding to DeepSeek. It records how the Investments pilot was built on 9 Nov 2026, what went wrong, and the standard Harvey arrived at over nine review rounds.

**Precedence:** Harvey's newest instruction, then this document, then earlier memories. CLAUDE.md still governs product rules. One conflict is settled here: CLAUDE.md rule 5 lists "£ above graph stacks" as Playfair, but see section 5, Type and figures.

**Goal for each new module:** Harvey reviews once or twice, not nine times. Investments took 9 rounds and most of them could have been avoided with sections 2 to 6.

**Status:** Investments is live (7d45b82). Next, in order: Cash, Student loan, Pension, Kids & family, Property (one walk-through, not three), then move the £100k tax trap onto the shared player. Ignore RSUs, retirement, and the hidden Mortgage and Personal loan modules.

---

## 1. DeepSeek: hard rules

Harvey's words: "I do NOT want my codebase going to deepseek."

- **Send only briefs you wrote from scratch.** No repo files, excerpts, real paths, user data, product name, or token values. Words and numbers reach generated code through props.
- **Code in the repo counts as codebase, including code DeepSeek originally wrote.** `ExplainerScenes.jsx` cannot be sent back for changes.
- **Describing an interface in your own words is fine** (a hook's name, arguments and behaviour). Pasting its source is not.
- **Direct API only:** `https://api.deepseek.com/chat/completions`, model `deepseek-flash`. Use the script in Appendix A.
- **Never install `deepseek-mcp` or point any DeepSeek-backed agent at the repo.** It runs a repo-aware session that could read the code and `.env.local`.
- **The key:** ask Harvey for it. Keep it in a `deepseek.key` file in your session scratchpad. Never put it in the repo, memory, a commit or a command line. Don't print it.
- **Budget:** $5 cap on the account, $4.77 left on 9 Nov. A full 3,400-line scenes file cost about 5 cents, so cost isn't the constraint. Review time is.
- **Save every brief locally** so Harvey can see exactly what was sent.
- **Security-scan every reply before it enters the repo:**
  `grep -nE "fetch|XMLHttp|WebSocket|localStorage|sessionStorage|eval\(|new Function|dangerouslySet|Math\.random|document\.cookie|navigator\.|window\.location|<style|http" <file>`

**What DeepSeek is good for here:** a complete first draft of self-contained scenes from a very detailed brief. **What it isn't good for:** judgement about the finished page. Round 5's 178-line brief with exact coordinates produced a correct structure in one pass. Vaguer briefs produced dry, generic animation. Every round after 5 was faster as direct local edits.

---

## 2. Workflow

1. **Agree a storyboard in words before generating anything.** For each page: the opening text, the beats, and what is on screen in the final frame. Most of Harvey's corrections were about final composition and could have been settled here. State how you've read anything ambiguous.
2. **Write facts and copy** in `src/lib/moduleExplainer.js`, with every rule and figure from the engine. Facts only, never directive (CLAUDE.md, Product rules).
3. **Write the brief** (section 3). One generation per module.
4. **Generate, scan, integrate.** Add the scene components and register them in `KINDS`.
5. **Fix locally from then on.** Don't regenerate for positioning or timing. Only regenerate from a revised brief if the structure is wrong, and expect to reapply local fixes.
6. **Film every page** with Appendix B at 390x844, and desktop 1280x900 and reduced motion.
7. **Do the final-frame review (section 6) yourself and fix what you find** before Harvey sees anything. Harvey's explicit request: "review the final state of the pages."
8. **Hand back on localhost, uncommitted.** Copy and UI wait for Harvey's go-ahead. Name the pages by their real numbers and confirm the mapping if his notes repeat a number.
9. **On "Ship":** run `/ship`. Tests, `npm run build && npm run check:key`, `/code-review`, commit only the task's files, confirm the Vercel deployment.

**Prove timing on one page first.** Change it, have Harvey react, then apply across the module. Round 7 applied 230ms a word everywhere, and round 8 had to cut it by 40% everywhere.

---

## 3. Writing the brief

Open with a role, and require one fenced code block containing the whole file and nothing else.

**Generate scenes only.** The shared helpers live in `src/mobile/explainer/ExplainerKit.jsx`, so DeepSeek doesn't rewrite them. Describe them in the brief using the interface below, have the scenes import from a neutral path such as `./kit`, and change the path on integration. Don't paste the file's source.

```
useStage(reduceMotion) -> { rootRef, s, W, H, A, ready }. Call at the top of every scene.
StageFrame({ stage, ariaLabel, children }). The scene's root element.
TextZone({ text, active, reduceMotion, W, theme }). The opening text and captions, built word by word.
introLead(intro, pace = 0.6) -> ms before the first beat.
useBeats(active, reduceMotion, times, onSettled) -> how many times have passed. Times must ascend. Pass onSettled through from props.
useTween(on, ms, reduceMotion) -> 0 to 1, eased.
useCountUp(target, running, ms, reduceMotion, from = 0) -> the counting value.
useLinearRise(target, running, ms, reduceMotion) -> a value rising steadily to target.
setBack(t) -> style for an item giving way to a newer one (t from 0 to 1).
clamp(v, lo, hi), lerp(a, b, t), interpArray(t, arr).
TILE_SHADOW, EASE_ENTRANCE, EASE_LANDING, EASE_GROWTH.
```

Every brief states:

- **Technical:** JSX, imports only from react and the helper file, inline styles only, no packages, CSS files or injected styles. No network, storage, analytics, eval, `dangerouslySetInnerHTML` or `Math.random`. No emoji or text arrows; draw icons as inline SVG.
- **Named exports**, one per scene. Scene props: `{ active, reduceMotion, theme, ariaLabel, format, intro, labels, onSettled, ...data }`.
- **No user-facing words in code.** All words come from `labels`, `intro` or data. Numbers show only through `format(value)`, and animated values passed to it are whole pounds unless settled.
- **Theme:** `{ text, muted, surface, tile, track, accent, onAccent, neutral, gain, cost, paleGain, ring, stripe, glass, glassEdge, fontBody, fontFigure }`. Theme colours only.
- **The stage formulas** (section 8) and the instruction that x 0 and x W are the page's text margins.
- **Per scene:** data and label names, then each beat as a time offset, with every element's position as a formula of W, H and A, and a one-line description of the final frame.
- **Every animation requirement in section 5**, as written. Don't summarise them.
- **Explicit negatives:** nothing visible before its beat, every element has an explicit `top` and `left`, no `transform: scale` on charts or text.

A strong scene description looks like this (from the pilot):

> 12500: as the gain begins, the right column's top corners animate to square. A gain block with the same x and width grows upward from the top of the right column, 2px gap, from height 0 to gainH over 700ms with growth easing, rounded top corners 12, square bottom. Inside: "+" format(end - start), centred.

"A nice animated bar chart showing the gain" is what produced rounds 1 and 2.

---

## 4. DeepSeek's recurring defects

Check for all of these in the first frames:

- An element missing `top`, so a tile lands over the caption.
- A shape drawn before its beat (stray dot, empty axis, column name during the intro).
- Raw fractional values passed to `format`, so pence tick during a count.
- Text zone not aligned with the page margins.
- Stamps or pills covering a figure.
- Figures that sit in a growing bar before it has room.
- Content centred in a fixed box rather than using the column.
- A sheet or child positioned twice, inside a wrapper that's already offset.
- Copy-pasted per-bar blocks where a mapped component would do.

---

## 5. Design and animation standard

### Page structure
- No visible page title. Keep it for screen readers. The explainer text leads the page.
- Explainer text is 24px, line height 1.35, weight 500, left-aligned at the page margin, with about four lines reserved above the visuals.
- The opening text appears on an empty page, then gives way to step captions in the same place. Visuals arrive only after it has gone.
- Captions come first, then the picture acts on them. One new thing per beat.
- Original colours only: cream and dark green. No per-module colour schemes.
- Use "To you", never the user's name.
- Every example states its assumptions. Nothing misleading: a share's value doesn't drop until it's sold, and taxable amounts stay neutral until split.

### Timing
- Opening text: `(words x 55 + max(2500, words x 230)) x 0.6` ms. Investments page 1 uses 0.51 and page 6 uses 0.7. The first figure is what Harvey settled on.
- A short caption holds about 2.5s. Simple scenes run about 30% quicker.
- Keep things brisk where nothing new is being taught.

### Layout
- Scenes are laid out from real width and height, never a fixed centred box. Content reaches the same side margins as the Next button, on phone and desktop.
- Spread items across the available height. No dead space at the bottom, and no large gap under the caption.
- Stacks stand in from both edges (about 10 units) so the x-axis shows on both sides of every stack.
- Nothing inside a stack reaches its edges.
- Two charts on one screen need a clear gap and a faint dashed rule between them.
- Objects keep real proportions; never stretch one to fill space. The calendar is a small icon (about 143 by 165).
- An opening tile is centred until it moves aside. When compact it reflows to name and £ only, rather than being scaled down.
- Labels above a bar line up with the bar's edges. Keep clear space between axis labels and a footnote.

### Long pages: show one thing at the end
- Older content gets out of the way as new content arrives. The last visual must be the focus.
- **Compressing pages stack newest at the top.** The new item appears at the top and pushes older ones down the page, where they shrink and blur slightly (2px blur, 50% opacity). Faint dashed rules separate the sections.
- **Or clear the page:** older content fades out and the final tiles are alone on screen, as on the £100k walk-through. Payoff tiles stack vertically at full width.

### Charts
- Build order for line charts: the full-length axis, then the line runs along it, then the end label arrives last.
- Build order for bars: bars grow up from the axis. Only compressing-page sections arrive from above.
- Axes, column names and tracks arrive with the first bar, not during the text.
- Stacked segments share exactly the same x and width.
- Bars touching an axis have square bottoms. Only the topmost segment has rounded top corners.
- Splits are stepped waterfalls (gain, tax taken off, what's left) with dashed connectors, not pop-out tiles.
- A final stack carries its total above it, and is shortened to make room.
- Keys under stacks are one or two words on one line, about 12px.
- Highlights stand clear of what they mark, so green never disappears on green.
- Redraw charts at the new size. Never scale them as images.

### Type and figures
- **One font size for every £ inside one chart** (22px in the pilot's waterfall).
- **DM Sans for a figure above a bar when it sits with other figures in that chart.** Harvey rejected Playfair here on 9 Nov.
- **Playfair is right for a standalone headline:** a tile's main £, a page's hero £, and "Unused" £ above page-6-style allowance bars.
- A £ is centred in its block. Extra text is placed around it and never moves it. Stamps sit on the tile's corner.
- Matching tiles put their £ on the same line.
- Tax in a chart or tile uses brackets: (£2.40). A worked sum keeps its minus: "£3,000 + £2,000 − £480".
- Months are three letters.
- **Tickers:** a split lands with its final figure. Don't count from pre-tax to post-tax in a row. Count only headline figures, in step with the bar they describe. Pence appear only on a settled small amount.

### Colour meaning
- Money reaching the user: pale green fill with green text, matching the "You receive" tile. A "You keep" stack must look different from the solid green gain stack.
- Red means tax or loss only. Emptying or resetting a bar is grey.
- Unfilled allowance uses the stripe, always.
- A final top-up is green, holds briefly, then fades to the bar's dark green so it reads as full, before any reset.

### Surfaces
- One shared tight shadow: `0 6px 16px rgba(0,0,0,0.10)`. The stage doesn't clip, so shadows never hit a hard edge.
- A tile's edge sits on the text margin. Don't inset it to dodge clipping.

### Next button
- Muted until the page's animation finishes, then fills dark green from the left. It's always tappable.

### What Harvey likes
Objects that persist and transform through a story, side-by-side comparisons, waterfalls, a flip calendar, numbers moving with their shapes, and a worked £ example teaching one idea per page.

---

## 6. Final-frame review

Open each page's last frame at full size. Judge it as a finished design, not as a list of requested changes. Then scan the sequence for transitions.

- [ ] Is the newest or most important thing obviously the focus?
- [ ] Is anything clipped, cut off by an edge, or touching an edge it shouldn't?
- [ ] Do side margins match the Next button? Any dead space?
- [ ] Do all figures in a chart match in size and font? Are figures on one screen consistent and do they tally?
- [ ] Do axes show on both sides of each stack? Corners right?
- [ ] Are keys, tags and text short enough to breathe inside their containers?
- [ ] Do mid-transition frames show anything ugly (a figure poking out behind a moving block)?
- [ ] Do figures move in step with their bars, with no jumps ahead?
- [ ] Is the text readable for long enough? Does Next fill only at the end?
- [ ] Desktop and reduced motion correct, no page errors, tests pass?

---

## 7. What went wrong

| Round | Problem | Root cause | Do this instead |
|---|---|---|---|
| Setup | `deepseek-mcp` suggested | It's a repo-aware agent | Direct API, self-written briefs |
| 1-2 | Dry single animations | Brief too generic | Specify each page's beats, coordinates and payoff |
| 3 | Per-module colours rejected | Trying an unrequested idea | Original palette only |
| 3 | Bars and figures misaligned, text after pictures | Rules left unstated | Section 5 in every brief |
| 4 | Stray dot, tile over caption, SOLD over price, pence ticking | DeepSeek's recurring defects | Section 4 check |
| 5 | Visuals clustered in the centre, big gaps | Fixed-size stage centred on screen | Flexible W and H from real size |
| 6 | Shadows cut off, on every page | Stage had `overflow: hidden`, patched tile by tile | Find the shared cause first |
| 6 | Calendar overran the bars and looked stretched | Sheet positioned twice | Check child offsets; keep proportions |
| 7 | Text not visible enough | Title and small text competed; never tested for reading | Text leads; no visible title |
| 7 | £110 in the wrong font | Agent applied a CLAUDE.md rule over Harvey's specific "same size" request | Latest specific instruction wins; flag conflicts |
| 8 | Intro far too slow | One timing guess rolled out to every page | Prove on one page first |
| 8 | Harvey: quality falling short | Checked requests were done, never judged the page | Section 6 every round |
| 8 | Page 3 still built from the bottom (round 9) | Only changed the entry direction; "top-down" needed a layout reversal | Restate what you'll build for any spatial request |
| 9 | Next button drained visibly into the next page | Transition ran in both directions | Animate only the fill; snap back |
| Ship | Walk-through reopened after a back swipe | State cleared only by its own buttons | Clear overlay state on route change |
| Ship | Back showed a frozen page with the wrong caption | Page marked complete at 0ms | Pages replay on Back |

**Tooling mistakes:**
- The filming script was deleted after each use, then recovered from the session log three times. It's now in Appendix B.
- Multi-line patches in Git Bash heredocs failed on apostrophes. Write patch scripts with the Write tool.
- A filming step longer than the page gives only the first frame, which proves nothing. Make the step shorter than the page length.
- Next is always tappable, so film fixed durations per page.
- The API key appeared in the conversation transcript. Pass it by file, and rotate it when the work ends.

---

## 8. Build reference

| File | Role |
|---|---|
| `src/lib/moduleExplainer.js` | Pages as plain data, figures from the engine, `MODULE_EXPLAINERS` |
| `src/lib/moduleExplainer.test.js` | Figures tally, tax follows the user's rate, no directive words |
| `src/mobile/explainer/StepPlayer.jsx` | Page player, Back, Replay, Next fill |
| `src/mobile/explainer/ExplainerScenes.jsx` | Investments' scene components |
| `src/mobile/explainer/ExplainerKit.jsx` | Shared stage, text and timing helpers |
| `src/mobile/explainer/ModuleExplainer.jsx` | Theme, `KINDS`, formatting, choice screen |
| `src/CandidApp.jsx` | Offer and playback, `explainer_*` events |

**Adding a module:** add its function to `MODULE_EXPLAINERS`, add its scenes to `KINDS`, add tests. The offer, playback and the "How this area works" link follow from the `MODULE_EXPLAINERS` entry.

**A page:** `{ id, title, intro, scene: { id, kind, labels, ariaLabel, ...data } }`.

**Stage:**
- `minH = reduceMotion ? 720 : 620`
- `s = min(rootW / 360, rootH / minH, 1.35)`, `W = rootW / s`, `H = rootH / s`
- `A` (top of visuals) `= reduceMotion ? 172 : 146`
- The player's scroll area has 20px side padding and `overflowX: hidden`. The stage itself doesn't clip.

**`useBeats`** counts offsets in order, so offsets must stay ascending. To add a beat in the middle, renumber every later `b(n)` in that scene. It calls `onSettled` 1200ms after the last beat, which fills Next.

**Module facts:** Savings reads the Cash ISA limit from `cashIsaLimit` and Premium Bonds from the live rate. The text "users who take the walk-through have better outcomes" stays out until data supports it; track it with `explainer_*` and `reveal_shown.explainer`.

**Choice screen copy:** "About 2 minutes. Explains where your figures come from." Keep it true for each module.

**Open, optional:** reduced-motion users see the intro but not later captions; closing a replay resets the module page's scroll and open tiles; the scenes are in the main bundle (use the lazy pattern in `screens/entry/lazy.js`); `AllowanceBars` duplicates its two bars; the "10%" label is hard-coded; `format` and `money` duplicate each other.

---

## Appendix A: send a brief

Save in your scratchpad as `send-brief.mjs`, next to `deepseek.key`. Run `node send-brief.mjs <brief.md> <output.jsx>`.

```js
// Sends one written brief to DeepSeek and saves the reply beside it.
// Usage: node send-brief.mjs <brief.md> <output.jsx>
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [brief, output] = process.argv.slice(2);
const key = readFileSync(join(here, "deepseek.key"), "utf8").trim();

const res = await fetch("https://api.deepseek.com/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model: "deepseek-flash",
    max_tokens: 140000,
    messages: [{ role: "user", content: readFileSync(brief, "utf8") }],
  }),
});
const body = await res.text();
writeFileSync(`${output}.response.json`, body);
if (!res.ok) { console.error(`HTTP ${res.status}: ${body.slice(0, 500)}`); process.exit(1); }

const json = JSON.parse(body);
const text = json.choices[0].message.content;
const match = text.match(/```(?:jsx|javascript|js)?\r?\n([\s\S]*?)```/);
if (!match) { console.error("No fenced code block in the reply"); process.exit(1); }
writeFileSync(output, match[1]);
console.log(JSON.stringify({
  finish: json.choices[0].finish_reason,
  usage: json.usage,
  lines: match[1].split("\n").length,
}));
```

## Appendix B: film the pages

Save as `scripts/_scenes.mjs` (the scratchpad can't resolve `node_modules`), and delete it straight after. Needs `npm run build` first. It serves on port 4179 and stops itself.

`node scripts/_scenes.mjs <outDir> [width] [height] [pages e.g. 1,3] [stepMs] [reduced]`

Set `LEN` to override page length in seconds. Update the module path, the profile and the per-page lengths for each module. Check `strip-N.png` for the sequence and the last `pN/NN.jpg` for the final frame.

```js
import { preview } from "vite";
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
const OUT = process.argv[2];
const WIDTH = +(process.argv[3] || 390), HEIGHT = +(process.argv[4] || 844), ONLY = process.argv[5] ? process.argv[5].split(",").map(Number) : null, STEP = +(process.argv[6] || 1000);
const reduced = process.argv[7] === "reduced";
mkdirSync(OUT, { recursive: true });
const d = {name:"Jo",appEntered:true,email:"check@example.com",unlockGate:true,unlockedModules:["studentLoan","investments"],selectedModules:["studentLoan","investments"],answeredModules:["studentLoan","investments"],goalsAsked:true,confidenceAsked:true,employmentStatus:"employed",employmentAsked:true,salary:"70000",salaryTrajectory:"stable",age:"31",monthlyExpenses:"2000",hasInvestments:"no",studentLoan:"none",hasPgLoan:"no",cashTiers:[{amount:"20000",rate:"4"}],hasPremiumBonds:"no",hasCashIsaThisYear:"yes",isaThisYearCash:"5000",hasOtherIsaThisYear:"no",pensionStatus:"yes",hasPension:"yes",myContribution:"3",employerContributionType:"match",employerMatch:"5",askedFields:["employmentStatus","salary","salaryTrajectory","monthlyExpenses","age"],appTourDone:true,cashTourDone:true};
const srv = await preview({ preview: { port: 4179, strictPort: true }, logLevel: "error" });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1, reducedMotion: reduced ? "reduce" : "no-preference" });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.route(/supabase\.co|posthog|stripe\.com|truelayer|resend\.com/, r => r.abort());
await p.route(/\/api\//, r => r.fulfill({ status: 503, body: "" }));
await p.addInitScript(d => { localStorage.setItem("candid_inputs", JSON.stringify(d)); localStorage.setItem("candid_insights", JSON.stringify({score:70,modules:{}})); localStorage.setItem("candid_cookie_choice","denied"); localStorage.setItem("candid_insights_date", new Date().toDateString()); }, d);
await p.goto("http://localhost:4179/app/module/investments"); await p.waitForTimeout(3000);
await p.getByText("How this area works").click();
await p.addStyleTag({ content: "button:has(svg.lucide-wrench){display:none!important}" });
if (process.env.REPLAY) { await p.waitForTimeout(9000); await p.getByRole("button",{name:/Replay/}).click(); await p.waitForTimeout(800); await p.screenshot({path:OUT+"/replay.jpg",type:"jpeg",quality:60}); console.log("errors:",errs.length?errs:"none"); await b.close(); await srv.httpServer.close(); process.exit(0); }
const next = () => p.getByRole("button", { name: /^(Next|Done)/ }).last();
for (let n = 1; n <= 6; n++) {
  const want = !ONLY || ONLY.includes(n);
  const t0 = Date.now(); const shots = [];
  if (want) mkdirSync(`${OUT}/p${n}`, { recursive: true });
  const LEN = process.env.LEN ? +process.env.LEN : [23,20,33,33,22,12][n-1];
  for (let i = 0; want && i * STEP < LEN * 1000; i++) {
    await p.waitForTimeout(Math.max(0, t0 + i * STEP - Date.now()));
    const f = `${OUT}/p${n}/${String(i).padStart(2,"0")}.jpg`; await p.screenshot({ path: f, type: "jpeg", quality: 60 }); shots.push({ f, t: ((Date.now()-t0)/1000).toFixed(1) });
  }
  if (want && shots.length) {
    const cols = 7, tw = WIDTH > 600 ? 280 : 200, th = Math.round(tw*HEIGHT/WIDTH);
    const html = `<body style="margin:0;background:#333;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:4px;width:${cols*(tw+4)}px">` + shots.map(s => `<div style="position:relative"><img src="data:image/jpeg;base64,${readFileSync(s.f).toString("base64")}" style="width:${tw}px;height:${th}px;display:block"/><span style="position:absolute;left:0;bottom:0;background:#000;color:#fff;font:12px sans-serif;padding:1px 4px">${s.t}</span></div>`).join("") + "</body>";
    const q = await ctx.newPage(); await q.setViewportSize({ width: cols*(tw+4), height: 800 }); await q.setContent(html); await q.waitForTimeout(250); await q.screenshot({ path: `${OUT}/strip-${n}.png`, fullPage: true }); await q.close();
  }
  await next().click(); await p.waitForTimeout(200);
}
console.log("errors:", errs.length ? errs : "none");
await b.close(); await srv.httpServer.close(); process.exit(0);
```
