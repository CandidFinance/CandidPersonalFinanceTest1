// Checks browser.js against a page with the awkward controls provider forms
// use: a masked date field, a custom dropdown, an address list of buttons, a
// list that loads more as it scrolls, a keyboard-only combobox and an income
// band <select>. Needs a browser, so it isn't part of npm test. Run:
//   node scripts/assist-agent/browser.check.js

import assert from "node:assert/strict";
import { chromium } from "playwright";
import { typeInto, pickOption, loc } from "./browser.js";

const PAGE = `<!doctype html><body>
<label>Date of birth <input data-agent-ref="dob" placeholder="DD/MM/YYYY" id="dob"></label>
<script>
  // Masks as you type: digits only, slashes put in for you.
  dob.addEventListener("input", () => { const d = dob.value.replace(/\\D/g, "").slice(0, 8); dob.value = [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/"); });
</script>

<button data-agent-ref="gender" aria-haspopup="listbox" id="gbtn">Select gender</button>
<ul role="listbox" id="glist" style="display:none"><li role="option">Man</li><li role="option">Woman</li><li role="option">Prefer not to say</li></ul>
<script>gbtn.onclick = () => glist.style.display = "block"; glist.onclick = e => { gbtn.textContent = e.target.textContent; glist.style.display = "none"; };</script>

<div id="addr"></div>
<script>
  const a = ["Flat 1, 1 Example Street, London SW1A 1AA", "1 Example Street, London SW1A 1AA", "11 Example Street, London SW1A 1AA"];
  for (let i = 2; i < 40; i++) if (i !== 11) a.push(i + " Example Street, London SW1A 1AA");
  for (const t of a) { const b = document.createElement("button"); b.textContent = t; b.onclick = () => addr.dataset.picked = t; addr.append(b); }
  addr.firstChild.dataset.agentRef = "addr";
</script>

<button data-agent-ref="country" aria-haspopup="listbox" id="cbtn">Country</button>
<div id="cbox" style="display:none;height:60px;overflow-y:auto" role="listbox"></div>
<script>
  // Shows ten countries, and ten more each time it's scrolled to the bottom.
  const all = Array.from({ length: 60 }, (_, i) => "Country " + i); all[47] = "United Kingdom";
  let shown = 0; const more = () => { for (const c of all.slice(shown, shown + 10)) { const d = document.createElement("div"); d.setAttribute("role", "option"); d.textContent = c; d.style.height = "20px"; cbox.append(d); } shown += 10; };
  more(); cbtn.onclick = () => cbox.style.display = "block";
  cbox.onscroll = () => { if (cbox.scrollTop + cbox.clientHeight >= cbox.scrollHeight - 2) more(); };
  cbox.onclick = e => { cbtn.dataset.picked = e.target.textContent; cbox.style.display = "none"; };
</script>

<input data-agent-ref="title" role="combobox" id="tin" aria-activedescendant="">
<div id="tlist"><span id="t0" hidden>Mr</span><span id="t1" hidden>Mrs</span><span id="t2" hidden>Ms</span><span id="t3" hidden>Dr</span></div>
<script>
  // Keyboard only: its options are never visible, arrow keys move through them.
  let ti = -1; tin.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { ti = (ti + 1) % 4; tin.setAttribute("aria-activedescendant", "t" + ti); }
    if (e.key === "Enter") tin.value = document.getElementById("t" + ti).textContent;
  });
</script>

<select data-agent-ref="income" id="inc"><option>Please select</option><option>Under £25,000</option><option>£25,000 - £49,999</option><option>£50,000 - £74,999</option><option>£75,000 - £99,999</option><option>£100,000+</option></select>
</body>`;

let browser;
try { browser = await chromium.launch({ channel: "chrome" }); } catch { browser = await chromium.launch(); }
const page = await browser.newPage();
await page.setContent(PAGE);
const check = async (name, fn) => { try { await fn(); console.log("ok  ", name); } catch (e) { console.log("FAIL", name, "-", e.message.split("\n")[0]); process.exitCode = 1; } };

await check("masked date field takes the date", async () => {
  await typeInto(loc(page, "dob"), "07/04/1993");
  assert.equal(await page.inputValue("#dob"), "07/04/1993");
});
await check("custom dropdown: Male picks 'Man'", async () => {
  const r = await pickOption(page, { tag: "button", popup: "listbox" }, "gender", "Male", "gender");
  assert.equal(r.picked, "Man");
  assert.equal(await page.textContent("#gbtn"), "Man");
});
await check("address list of buttons: picked by line 1, not the flat", async () => {
  const r = await pickOption(page, { tag: "button" }, "addr", "1 Example Street", "addressLine1");
  assert.equal(r.picked, "1 Example Street, London SW1A 1AA");
  assert.equal(await page.getAttribute("#addr", "data-picked"), "1 Example Street, London SW1A 1AA");
});
await check("list that loads as it scrolls: finds option 47", async () => {
  const r = await pickOption(page, { tag: "button", popup: "listbox" }, "country", "British", "nationality");
  assert.equal(r.picked, "United Kingdom");
  assert.equal(await page.getAttribute("#cbtn", "data-picked"), "United Kingdom");
});
await check("keyboard-only combobox: cycles to Dr", async () => {
  const r = await pickOption(page, { tag: "input", type: "text", role: "combobox" }, "title", "Dr", "title");
  assert.equal(r.picked, "Dr");
  assert.equal(await page.inputValue("#tin"), "Dr");
});
await check("income band select: 75000 picks £75,000 - £99,999", async () => {
  const options = await page.$$eval("#inc option", os => os.map(o => o.textContent));
  const r = await pickOption(page, { tag: "select", options }, "income", "75000", "annualIncome");
  assert.equal(r.picked, "£75,000 - £99,999");
});
await check("no match: says so and lists what it saw", async () => {
  const r = await pickOption(page, { tag: "button", popup: "listbox" }, "gender", "Non-binary", "gender");
  assert.ok(!r.picked && r.seen.includes("Woman"));
});
await browser.close();
