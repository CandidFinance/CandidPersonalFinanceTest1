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
  assert.equal(rewriteFor("/how-it-works"), "/app-shell.html");
  assert.equal(rewriteFor("/app/module/pension"), "/app-shell.html");
  assert.equal(rewriteFor("/app/assessment/5"), "/app-shell.html");
  assert.equal(rewriteFor("/fake-url"), null);
  assert.equal(rewriteFor("/app/module"), null);
  assert.equal(rewriteFor("/app/module/pension/extra"), null);
});
