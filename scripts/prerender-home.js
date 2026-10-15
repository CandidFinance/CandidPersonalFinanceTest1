// The third step of `npm run build`: renders the homepage (src/site/
// LandingPage.jsx) to HTML and writes it into dist/index.html, so its
// headings and copy are in the page itself and crawlers can read them
// without running JavaScript. The app still renders on the client as before;
// main.jsx keeps this markup on screen until the landing page's own code has
// loaded (see RootRoute there).
//
// Every other app route gets dist/app-shell.html instead: the same page with
// an empty root, so /app/* never shows the homepage's markup first. The
// routes that serve it are vercel.json's rewrites.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = join(root, "dist", "index.html");
const EMPTY_ROOT = '<div id="root"></div>';

// Elements that animate in start hidden (framer-motion renders each one's
// `initial` style, opacity 0). Without JavaScript nothing animates them in,
// so this shows them as they finish.
const NO_SCRIPT_REVEAL =
  '<noscript><style>#root [style*="opacity:0"]{opacity:1!important;transform:none!important}</style></noscript>';

const vite = await createServer({
  root,
  configFile: false,
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  // The automatic JSX runtime, as @vitejs/plugin-react gives the app. The
  // project config isn't loaded: its dev plugins would start the Assist agent.
  esbuild: { jsx: "automatic" },
});
try {
  const { renderHome } = await vite.ssrLoadModule("/src/site/renderHome.jsx");
  const markup = renderHome();
  const shell = readFileSync(indexPath, "utf8");
  if (!shell.includes(EMPTY_ROOT)) throw new Error(`dist/index.html has no ${EMPTY_ROOT} to fill`);
  writeFileSync(join(root, "dist", "app-shell.html"), shell);
  writeFileSync(indexPath, shell
    .replace(EMPTY_ROOT, `<div id="root">${markup}</div>`)
    .replace("</head>", `  ${NO_SCRIPT_REVEAL}\n  </head>`));
  console.log(`prerendered the homepage into dist/index.html (${Math.round(markup.length / 1024)} kB)`);
} finally {
  await vite.close();
}
