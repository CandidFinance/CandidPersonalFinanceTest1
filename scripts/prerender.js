// The last step of `npm run build`: renders the marketing pages that need
// to be readable without JavaScript (the homepage and /about,
// src/site/renderPages.jsx) to HTML, each into its own copy of
// dist/index.html with its own title, description and social tags. The app
// still renders on the client as before; main.jsx keeps this markup on
// screen until the page's own code has loaded (see Prerendered there).
//
// Every other app route gets dist/app-shell.html: the same page with an
// empty root, so /app/* never shows a marketing page's markup first. The
// routes that serve each file are vercel.json's rewrites.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { SITE_URL } from "../src/lib/sitePartials.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const EMPTY_ROOT = '<div id="root"></div>';

// `meta` replaces the homepage's own head tags; the homepage keeps them.
const PAGES = [
  { path: "/", file: "index.html" },
  {
    path: "/about", file: "prerendered/about.html",
    meta: {
      title: "About | Candid",
      description: "Built to stop you wasting thousands on financial blind spots: the tax traps, idle cash and unused allowances costing you.",
      url: `${SITE_URL}/about`,
    },
  },
];

// Elements that animate in start hidden (framer-motion renders each one's
// `initial` style, opacity 0). Without JavaScript nothing animates them in,
// so this shows them as they finish.
const NO_SCRIPT_REVEAL =
  '<noscript><style>#root [style*="opacity:0"]{opacity:1!important;transform:none!important}</style></noscript>';

const escapeAttr = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

// Swaps the shell's title, description, canonical and og/twitter text for
// the page's own. Each tag must be there to swap, so a renamed tag fails the
// build rather than leaving the homepage's text on another page.
function withMeta(html, { title, description, url }) {
  const swaps = [
    [/<title>[^<]*<\/title>/, `<title>${title}</title>`],
    [/(<link rel="canonical" href=")[^"]*"/, `$1${url}"`],
    ...[["name", "description", description], ["property", "og:title", title], ["property", "og:description", description],
      ["property", "og:url", url], ["name", "twitter:title", title], ["name", "twitter:description", description]]
      .map(([attr, key, value]) => [new RegExp(`(<meta ${attr}="${key}" content=")[^"]*"`), `$1${escapeAttr(value)}"`]),
  ];
  for (const [pattern, replacement] of swaps) {
    if (!pattern.test(html)) throw new Error(`index.html has no tag matching ${pattern}`);
    html = html.replace(pattern, replacement);
  }
  return html;
}

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
  const { renderPage } = await vite.ssrLoadModule("/src/site/renderPages.jsx");
  const shell = readFileSync(join(dist, "index.html"), "utf8");
  if (!shell.includes(EMPTY_ROOT)) throw new Error(`dist/index.html has no ${EMPTY_ROOT} to fill`);
  writeFileSync(join(dist, "app-shell.html"), shell);
  for (const page of PAGES) {
    const markup = renderPage(page.path);
    const html = (page.meta ? withMeta(shell, page.meta) : shell)
      .replace(EMPTY_ROOT, `<div id="root">${markup}</div>`)
      .replace("</head>", `  ${NO_SCRIPT_REVEAL}\n  </head>`);
    mkdirSync(dirname(join(dist, page.file)), { recursive: true });
    writeFileSync(join(dist, page.file), html);
    console.log(`prerendered ${page.path} into dist/${page.file} (${Math.round(markup.length / 1024)} kB)`);
  }
} finally {
  await vite.close();
}
