// Opens every app screen and module page in a real browser, for a spread of
// profiles, and steps through each module's answer, failing on any page
// error or the "Something is wrong" screen. Catches what the unit tests
// can't: a screen that throws when it draws (a variable used where it isn't
// defined, say), as the student loan page did in October 2026.
//
//   npm run check:screens   on the last build (dist/)
//   npm run verify          builds, then checks
//   npm run check:key       the key ICPs only (KEY_PROFILES), on the last build:
//                           the quick check for most changes
//
// Serves dist/ with `vite preview` on a free port (the way Vercel serves it,
// vite.config.js). Nothing leaves the machine: Supabase, PostHog, Stripe,
// TrueLayer and Resend are blocked, and /api/* answers 503.

import { preview } from "vite";
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALL_MODULES as all, PROFILES, KEY_PROFILES } from "./profiles.js";

if (!existsSync("dist/app-shell.html")) {
  console.error("No build in dist/. Run `npm run build` first, or `npm run verify`.");
  process.exit(1);
}

const RUN = process.argv.includes("--key") ? Object.fromEntries(KEY_PROFILES.map(k => [k, PROFILES[k]])) : PROFILES;
const ROUTES = ["/app/home", "/app/progress", "/app/modules", "/app/forecast", "/app/chat", "/app/inputs", "/app/property", ...all.map(k => `/app/module/${k}`)];
const BLOCK = /supabase\.co|posthog|stripe\.com|truelayer|resend\.com/;

const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: "silent" });
const base = server.resolvedUrls.local[0].replace(/\/$/, "");
const browser = await chromium.launch();
const problems = [];
try {
  for (const [name, d] of Object.entries(RUN)) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route("**/*", route => {
      const url = route.request().url();
      if (BLOCK.test(url)) return route.abort();
      if (url.startsWith(base + "/api/")) return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      return route.continue();
    });
    const page = await ctx.newPage();
    let errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error" && /Error/.test(m.text()) && !/Failed to load resource|net::/.test(m.text())) errors.push(m.text().split("\n")[0].slice(0, 200)); });
    await page.goto(base + "/");
    await page.evaluate(d => {
      localStorage.setItem("candid_inputs", JSON.stringify(d));
      localStorage.setItem("candid_insights", JSON.stringify({ score: 70, modules: {} }));
      localStorage.setItem("candid_cookie_choice", "denied");
      localStorage.setItem("candid_insights_date", new Date().toISOString());
    }, d);
    const check = async label => {
      const body = await page.innerText("body").catch(() => "");
      const broken = /Something (is|went) wrong/i.test(body);
      if (broken || errors.length) problems.push(`${name} ${label}${broken ? " [error screen]" : ""}: ${[...new Set(errors)].slice(0, 2).join(" | ") || "no message"}`);
      errors = [];
      return broken;
    };
    for (const r of ROUTES) {
      await page.goto(base + r);
      await page.waitForTimeout(1200);
      let broken = await check(r);
      // Cash's tour, the first time it opens (CashTour.jsx): each stop,
      // past the estimates and the email, to the closing card.
      // (Not the goal reached pop-up, GoalReached.jsx, which can follow it.)
      const tour = page.locator('[role="dialog"][aria-modal="true"]:not([aria-labelledby="goal-reached-title"])');
      // The app's tour, the first time Home opens (AppTour.jsx): each stop,
      // across Progress and Modules, and back to Home.
      if (!broken && r === "/app/home") {
        for (let i = 0; i < 10 && await tour.count(); i++) {
          await tour.getByRole("button", { name: /^(Next|Done)$/ }).first().click();
          await page.waitForTimeout(1300);
        }
        if (await tour.count()) problems.push(`${name} ${r}: the app tour didn't close`);
        if (!page.url().endsWith("/app/home")) problems.push(`${name} ${r}: the app tour ended on ${page.url()}`);
        broken = await check(`${r} (tour)`);
      }
      if (!broken && r === "/app/module/cash") {
        for (let i = 0; i < 9 && await tour.count(); i++) {
          await tour.getByRole("button", { name: /^(Next|Not now|Done)$/ }).first().click();
          await page.waitForTimeout(400);
        }
        if (await tour.count()) problems.push(`${name} ${r}: the tour didn't close`);
        broken = await check(`${r} (tour)`);
      }
      // Chat: past the way in (chatStart.js: "Ask a question", or "Just
      // exploring" from scratch) to a starter question, answered through to
      // its module button, then the lump-sum conversation and back.
      // Once in a while (Nov 2026, not yet caught) the way in never shows. So
      // that the next time says why: a screenshot and what's on screen, then
      // one reload. Listed as a problem even when the reload brings it, as a
      // real user only gets the first open. False when it never shows.
      const toStarters = async () => {
        const ask = page.getByRole("button", { name: "Ask a question" });
        const explore = page.getByRole("button", { name: "Just exploring" });
        const wayIn = () => ask.or(explore).first().waitFor({ timeout: 20000 }).then(() => true, () => false);
        if (!(await wayIn())) {
          const shot = join(tmpdir(), `candid-chat-stuck-${name}-${Date.now()}.png`);
          await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
          const seen = await page.evaluate(() => ({
            dialogs: [...document.querySelectorAll("[role=dialog]")].map(e => e.innerText.replace(/\s+/g, " ").slice(0, 80)),
            buttons: [...document.querySelectorAll("button")].map(b => b.innerText.trim()).filter(Boolean).slice(0, 12),
            end: document.body.innerText.replace(/\s+/g, " ").slice(-300),
          })).catch(() => null);
          await page.reload();
          const second = await wayIn();
          problems.push(`${name} ${r}: the chat's way in didn't show within 20s, ${second ? "but did after a reload" : "nor after a reload"}. Screenshot ${shot}. On screen: ${JSON.stringify(seen)}`);
          if (!second) return false;
        }
        // The chat's replies can redraw just after they show, so a moment to settle.
        await page.waitForTimeout(1500);
        // Gone for good, with neither to click: say what's there, don't crash.
        if (await ask.count()) await ask.click();
        else if (await explore.count()) { await explore.click(); await page.getByRole("button", { name: "Done" }).click(); }
        else {
          const on = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(-400)).catch(() => "");
          problems.push(`${name} ${r}: the chat's way in showed, then went. On screen: ${on}`);
          return false;
        }
        return true;
      };
      if (!broken && r === "/app/chat" && await toStarters()) {
        await page.getByRole("button", { name: "What is the £100k tax trap?" }).click({ timeout: 15000 });
        await page.locator("[data-chat-module]").waitFor({ timeout: 15000 }).catch(() => problems.push(`${name} ${r}: the tax trap answer didn't reach its module button`));
        broken = await check(`${r} (answer)`);
        // Ask next shows once the answer has finished building.
        if (!broken) await page.getByRole("button", { name: /Childcare too\?/ }).waitFor({ timeout: 5000 }).catch(() => problems.push(`${name} ${r}: the answer's Ask next follow-ups are missing`));
        if (!broken) await page.goto(base + r);
        if (!broken && await toStarters()) {
          await page.getByRole("button", { name: /lump sum/ }).click({ timeout: 15000 });
          await page.getByRole("button", { name: "All topics" }).waitFor({ timeout: 3000 }).catch(() => problems.push(`${name} ${r}: the lump sum didn't open`));
          broken = await check(`${r} (lump sum)`);
          if (!broken) { await page.getByRole("button", { name: "All topics" }).click(); await page.waitForTimeout(300); broken = await check(`${r} (back)`); }
        }
      }
      // The module's answer, step by step, to its last step.
      if (!broken && r.startsWith("/app/module/")) {
        const explain = page.getByText("Explain this", { exact: true });
        if (await explain.count()) {
          await explain.first().click();
          await page.waitForTimeout(400);
          for (let i = 0; i < 3; i++) {
            const next = page.getByRole("button", { name: "Next" });
            if (!(await next.count())) break;
            await next.click();
            await page.waitForTimeout(300);
          }
          await check(`${r} (answer)`);
        }
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}

const checked = `${Object.keys(RUN).length} profiles x ${ROUTES.length} screens, and each module's answer`;
if (problems.length) {
  console.error(`Screen check failed (${checked}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`Screen check passed: ${checked}.`);
