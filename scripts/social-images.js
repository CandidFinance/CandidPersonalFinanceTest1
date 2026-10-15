// Makes the 1200x630 link-preview images (og:image / twitter:image) in
// public/og/: one for the homepage, which is every page's default
// (src/lib/sitePartials.js), and one per calculator page, named after it.
// Run by hand after changing a title here:  node scripts/social-images.js
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "og");

const IMAGES = [
  { file: "home", kicker: "Personal finance, in pounds", title: "Stop leaking wealth to tax traps and idle cash." },
  { file: "student-loan-calculator", kicker: "Free calculator", title: "Should you pay off your student loan early?" },
  { file: "100k-tax-trap-calculator", kicker: "Free calculator", title: "The £100,000 tax trap and childcare cliff." },
  { file: "mortgage-vs-savings-calculator", kicker: "Free calculator", title: "Overpay the mortgage, or save the cash?" },
];

const page = ({ kicker, title }) => `<!DOCTYPE html>
<html><head>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:opsz,wght@9..40,500;9..40,700&display=block" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #162f24; color: #faf7f0; font-family: 'DM Sans', sans-serif;
         display: flex; flex-direction: column; justify-content: space-between; padding: 72px 88px; }
  .mark { font-family: 'Playfair Display', Georgia, serif; font-weight: 700; font-size: 44px; color: #c4963a; }
  .kicker { font-size: 20px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #c4963a; margin-bottom: 22px; }
  h1 { font-family: 'Playfair Display', Georgia, serif; font-weight: 700; font-size: 68px; line-height: 1.1; max-width: 960px; }
  .foot { display: flex; justify-content: space-between; font-size: 22px; color: rgba(250,247,240,0.6); border-top: 1px solid rgba(250,247,240,0.15); padding-top: 24px; }
</style></head>
<body>
  <div class="mark">Candid.</div>
  <div><div class="kicker">${kicker}</div><h1>${title}</h1></div>
  <div class="foot"><span>candid-finance.co.uk</span><span>Guidance, not advice</span></div>
</body></html>`;

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const image of IMAGES) {
    await tab.setContent(page(image), { waitUntil: "networkidle" });
    await tab.evaluate(() => document.fonts.ready);
    await tab.screenshot({ path: join(outDir, `${image.file}.png`) });
    console.log(`wrote public/og/${image.file}.png`);
  }
} finally {
  await browser.close();
}
