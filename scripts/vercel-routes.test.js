import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rewrites, rewriteFor } from "./vercel-routes.js";

// Every <Route path> in main.jsx, minus "/" (index.html) and "*" (the 404).
const routes = [...readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8").matchAll(/<Route path="([^"]+)"/g)]
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
