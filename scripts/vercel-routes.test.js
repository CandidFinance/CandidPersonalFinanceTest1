import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { headers, rewrites, rewriteFor } from "./vercel-routes.js";

// Every <Route path> in main.jsx, minus "/" (index.html), "*" (the 404) and
// routes behind import.meta.env.DEV, which never reach production.
const routes = [...readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8").matchAll(/(?<!import\.meta\.env\.DEV && )<Route path="([^"]+)"/g)]
  .map(m => m[1])
  .filter(p => p !== "/" && p !== "*");

test("vercel.json serves the app on exactly main.jsx's routes", () => {
  assert.deepEqual(rewrites.map(r => r.source).sort(), [...routes].sort());
});

test("app routes go to the app shell, anything else to the 404", () => {
  assert.equal(rewriteFor("/signin"), "/app-shell.html");
  assert.equal(rewriteFor("/how-it-works"), "/prerendered/how-it-works.html");
  assert.equal(rewriteFor("/app/module/pension"), "/app-shell.html");
  assert.equal(rewriteFor("/app/assessment/5"), "/app-shell.html");
  assert.equal(rewriteFor("/fake-url"), null);
  assert.equal(rewriteFor("/app/module"), null);
  assert.equal(rewriteFor("/app/module/pension/extra"), null);
});

// prerender.js's PAGES, read as text: importing it would start Vite.
const prerendered = [...readFileSync(new URL("./prerender.js", import.meta.url), "utf8").matchAll(/path: "([^"]+)", file: "(prerendered\/[^"]+)"/g)]
  .map(m => `${m[1]} -> /${m[2]}`);

test("every /prerendered/ rewrite has a page in prerender.js, and the reverse", () => {
  const served = rewrites.filter(r => r.destination.startsWith("/prerendered/")).map(r => `${r.source} -> ${r.destination}`);
  assert.ok(prerendered.length > 0);
  assert.deepEqual(served.sort(), [...prerendered].sort());
});

// The policy has no 'unsafe-inline' for scripts, so each inline <script> runs
// only if its hash is listed. Editing one changes its hash: put the new one
// (in this test's failure message) in vercel.json's script-src in place of
// the old. Vite moves an inline module script into a file of its own, so
// those need no hash.
test("every inline script in the root pages is allowed by the content security policy", () => {
  const policy = headers.find(h => h.key.startsWith("Content-Security-Policy"))?.value ?? "";
  const scriptSrc = policy.split("; ").find(d => d.startsWith("script-src ")) ?? "";
  assert.ok(!scriptSrc.includes("'unsafe-inline'"));
  const root = new URL("../", import.meta.url);
  const wanted = [];
  for (const file of readdirSync(root).filter(f => f.endsWith(".html"))) {
    const html = readFileSync(new URL(file, root), "utf8");
    for (const [, attrs, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/\bsrc=|application\/ld\+json|type="module"/.test(attrs)) continue;
      assert.ok(!body.includes("{{"), `${file}: a {{FIGURE}} token in an inline script changes its hash at build`);
      wanted.push(`'sha256-${createHash("sha256").update(body).digest("base64")}'`);
    }
  }
  const listed = scriptSrc.split(" ").filter(s => s.startsWith("'sha256-"));
  assert.deepEqual(listed.sort(), wanted.sort());
});
