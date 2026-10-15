// The second step of `npm run build`: copies the root .html pages that Vite
// doesn't build (the privacy policy, terms and the 404 page) into dist/,
// with the shared footer and social tags filled in (src/lib/sitePartials.js),
// as Vite does for the pages it builds. The calculator pages are built by
// Vite (vite.config.js), so they're already in dist/ and are left alone. In
// Node rather than a shell loop, so the build runs the same on Windows as on
// Vercel.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applySitePartials } from "../src/lib/sitePartials.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of readdirSync(root)) {
  if (!file.endsWith(".html") || existsSync(join(root, "dist", file))) continue;
  writeFileSync(join(root, "dist", file), applySitePartials(readFileSync(join(root, file), "utf8")));
  console.log(`copied ${file} to dist/`);
}
