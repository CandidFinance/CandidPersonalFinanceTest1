// Captures app screens as a user sees them on a phone, for the /iterate
// reviewers (.claude/skills/iterate): 390px-wide screenshots in slices,
// top to bottom, plus each screen's visible text.
//
//   node scripts/screen-capture.mjs --out <dir> --profile rich --routes app/module/cash,app/progress
//
// Routes go without the leading slash (Git Bash rewrites "/app/..." into a
// Windows path). Profiles are in scripts/profiles.js. Runs on the last build
// (dist/), like the screen check, with the app and Cash tours marked done so
// the screen is what a returning user sees. Nothing leaves the machine.
// Writes <out>/<screen>-<n>.png and <out>/<screen>.txt, <screen> being the
// route's last part.
//
// The DEV TOOLS button is removed from every slice and the text, so it can't
// cover the hero. The tab bar and the floating Assist button show only in the
// last slice: in the others they would cover content at the bottom edge that
// the next slice doesn't repeat, which reviewers would report as overlap.

import { preview } from "vite";
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { PROFILES } from "./profiles.js";

const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; };
const out = arg("out");
const profileName = arg("profile") || "rich";
const routes = (arg("routes") || "").split(",").map(r => r.trim().replace(/^\/+/, "")).filter(Boolean);
if (!out || !routes.length) { console.error("Usage: node scripts/screen-capture.mjs --out <dir> --routes app/module/cash[,…] [--profile rich]"); process.exit(1); }
if (!PROFILES[profileName]) { console.error(`No profile "${profileName}". Profiles: ${Object.keys(PROFILES).join(", ")}`); process.exit(1); }
if (!existsSync("dist/app-shell.html")) { console.error("No build in dist/. Run `npm run build` first (from PowerShell)."); process.exit(1); }
mkdirSync(out, { recursive: true });

const inputs = { ...PROFILES[profileName], cashTourDone: true, appTourDone: true };
const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: "silent" });
const base = server.resolvedUrls.local[0].replace(/\/$/, "");
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.route("**/*", r => {
    const url = r.request().url();
    if (/supabase\.co|posthog|stripe\.com|truelayer|resend\.com/.test(url)) return r.abort();
    if (url.startsWith(base + "/api/")) return r.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    return r.continue();
  });
  const page = await ctx.newPage();
  await page.goto(base + "/");
  await page.evaluate(d => {
    localStorage.setItem("candid_inputs", JSON.stringify(d));
    localStorage.setItem("candid_insights", JSON.stringify({ score: 70, modules: {} }));
    localStorage.setItem("candid_cookie_choice", "denied");
    localStorage.setItem("candid_insights_date", new Date().toISOString());
  }, inputs);
  for (const route of routes) {
    const name = route.split("/").pop();
    await page.goto(`${base}/${route}`);
    await page.waitForTimeout(2500);
    await page.addStyleTag({ content: `
      [data-capture-hide] { display: none !important; }
      html[data-capture-no-chrome] nav[data-tab-bar],
      html[data-capture-no-chrome] [data-tour="assist"] { visibility: hidden !important; }` });
    await page.evaluate(() => {
      for (const b of document.querySelectorAll("button")) if (b.innerText.trim() === "DEV TOOLS") b.setAttribute("data-capture-hide", "");
    });
    writeFileSync(`${out}/${name}.txt`, await page.innerText("body"));
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const slices = Math.min(8, Math.ceil(height / 780));
    let n = 0;
    for (let y = 0; n < slices; y += 780, n++) {
      await page.evaluate(([y, last]) => {
        window.scrollTo(0, y);
        document.documentElement.toggleAttribute("data-capture-no-chrome", !last);
      }, [y, n === slices - 1]);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${out}/${name}-${n + 1}.png` });
    }
    console.log(`${name}: ${n} slices, ${out}/${name}-1..${n}.png and ${name}.txt`);
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
