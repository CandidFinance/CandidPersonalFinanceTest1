// The app's routes as vercel.json lists them. Only these paths (plus "/",
// which is index.html itself, and real files) are served the app; anything
// else gets dist/404.html with a 404 status, rather than the homepage with a
// 200. vite.config.js applies the same rules to `vite preview`, and
// vercel-routes.test.js checks the list matches main.jsx's <Route>s.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const rewrites = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")).rewrites;

// Vercel's sources here are plain paths with ":name" segments, each
// matching one segment of the request path.
export function matchesSource(source, path) {
  const want = source.split("/");
  const got = path.replace(/\/$/, "").split("/");
  return want.length === got.length && want.every((part, i) => part.startsWith(":") ? got[i] !== "" : part === got[i]);
}

export function rewriteFor(path) {
  return rewrites.find(r => matchesSource(r.source, path))?.destination ?? null;
}
