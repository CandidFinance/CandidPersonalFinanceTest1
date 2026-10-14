// What the account-opening agent does in the browser beyond a plain click:
// typing that checks what the field took, and picking from any kind of
// dropdown or list. Checked against a page of awkward controls by
// browser.check.js.

import { matchOption } from "./profile.js";

// A control the snapshot tagged (data-agent-ref).
export const loc = (page, ref) => page.locator(`[data-agent-ref="${ref}"]`).first();

// Types a value and checks what the field ended up holding. Masked fields
// (dates, phone numbers) often drop separators or reject fill(), so it
// retypes key by key, then digits only, until the digits match.
export async function typeInto(locator, value) {
  const digitsOf = s => String(s).replace(/\D/g, "");
  const ok = async () => { const got = await locator.inputValue().catch(() => value); return got === value || (digitsOf(value) && digitsOf(got) === digitsOf(value)); };
  await locator.fill(value);
  if (await ok()) return;
  for (const attempt of [value, digitsOf(value)]) {
    if (!attempt) continue;
    await locator.fill("");
    await locator.pressSequentially(attempt, { delay: 40 });
    if (await ok()) return;
  }
  throw new Error(`the field didn't take "${value}"`);
}

// Every visible option on the page now (or, `wide`, any short element with a
// digit in it, for address lists made of buttons or links), tagged so one can
// be clicked. One entry per text, the innermost element.
async function gatherOptions(page, wide) {
  return page.evaluate(wide => {
    const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
    const roles = '[role=option], [role=menuitem], [role=menuitemradio], [role=listbox] li, [class*="__option"], [class*="-option"], [class*="Option"]';
    const sel = wide ? roles + ", li, button, a, label, [role=radio], [role=button]" : roles;
    const byText = new Map();
    let n = window.__agentOpt || 0;
    for (const el of document.querySelectorAll(sel)) {
      if (!visible(el)) continue;
      const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 160) continue;
      if (wide && !el.matches(roles) && !/\d/.test(text)) continue;
      if (!el.dataset.agentOpt) el.dataset.agentOpt = String(++n);
      byText.set(text, el.dataset.agentOpt);
    }
    window.__agentOpt = n;
    return [...byText].map(([text, opt]) => ({ text, opt }));
  }, wide);
}

// Scrolls the open (visible) list one screen further; false at the bottom.
const scrollList = page => page.evaluate(() => {
  const scrolls = el => el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY);
  for (const start of document.querySelectorAll('[role=listbox], [role=option], [class*="__menu"], [class*="-menu"]')) {
    if (!start.getClientRects().length) continue;
    let box = start;
    while (box && !scrolls(box)) box = box.parentElement;
    if (!box) continue;
    const before = box.scrollTop;
    box.scrollTop += box.clientHeight;
    return box.scrollTop > before;
  }
  return false;
});

// The option the keyboard is on in an open list.
const activeOption = page => page.evaluate(() => {
  const a = document.activeElement;
  const id = a && a.getAttribute("aria-activedescendant");
  const el = (id && document.getElementById(id)) || document.querySelector('[role=option][aria-selected=true], [role=option][data-highlighted], [class*="option"][class*="focused"]');
  return el ? (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim() : "";
});

// Picks the option matching `want` (profile key `key`) from the dropdown,
// list or search box at `ref`: what's showing first, then opened, scrolled,
// typed into, and last stepped through with the arrow keys. Returns
// { picked } or { error, seen }.
export async function pickOption(page, item, ref, want, key) {
  const el = loc(page, ref);
  if (item.tag === "select") {
    const match = matchOption(want, item.options, key);
    if (!match) return { error: "no option matches", seen: item.options };
    await el.selectOption({ label: match });
    return { picked: match };
  }
  const seen = new Set();
  const tryPick = async () => {
    const opts = await gatherOptions(page, key === "addressLine1");
    opts.forEach(o => seen.add(o.text));
    const match = matchOption(want, opts.map(o => o.text), key);
    if (match) await page.locator(`[data-agent-opt="${opts.find(o => o.text === match).opt}"]`).first().click();
    return match;
  };
  let picked = await tryPick();
  if (picked) return { picked };
  if (item.type !== "radio") { await el.click().catch(() => {}); await page.waitForTimeout(500); }
  if ((picked = await tryPick())) return { picked };
  for (let i = 0; i < 40 && await scrollList(page); i++) {
    await page.waitForTimeout(250);
    if ((picked = await tryPick())) return { picked };
  }
  if (item.tag === "input" && !["radio", "checkbox"].includes(item.type)) {
    await el.fill(String(want)).catch(() => {});
    await page.waitForTimeout(900);
    if ((picked = await tryPick())) return { picked };
  }
  await el.focus().catch(() => {});
  const stepped = [];
  for (let i = 0; i < 200; i++) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(60);
    const text = await activeOption(page);
    if (!text || (stepped.length > 1 && text === stepped[0])) break; // nothing there, or round again
    if (text === stepped[stepped.length - 1]) break; // stuck at the end
    stepped.push(text); seen.add(text);
    if (matchOption(want, [text], key)) { await page.keyboard.press("Enter"); return { picked: text }; }
  }
  await page.keyboard.press("Escape").catch(() => {});
  return { error: "no option matches", seen: [...seen] };
}

// A custom dropdown's options, read by opening it and closing it again, so
// the user can be asked with the real choices.
export async function listOptions(page, ref) {
  await loc(page, ref).click().catch(() => {});
  await page.waitForTimeout(500);
  const texts = (await gatherOptions(page, false)).map(o => o.text);
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(200);
  if (texts.length && (await gatherOptions(page, false)).length) await loc(page, ref).click().catch(() => {}); // some only close on a second click
  return texts.slice(0, 40);
}

// A dropdown that isn't a <select>.
export const isCustomDropdown = item => !!item && item.tag !== "select" && (item.role === "combobox" || /listbox|menu|true/.test(item.popup || ""));
