// The second half of `npm run build`: copies the root .html pages that Vite
// doesn't build (the privacy policy and terms) into dist/ as they are. The
// calculator pages are built by Vite (vite.config.js), so they're already in
// dist/ and are left alone. In Node rather than a shell loop, so the build
// runs the same on Windows as on Vercel.
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of readdirSync(root)) {
  if (!file.endsWith(".html") || existsSync(join(root, "dist", file))) continue;
  copyFileSync(join(root, file), join(root, "dist", file));
  console.log(`copied ${file} to dist/`);
}
