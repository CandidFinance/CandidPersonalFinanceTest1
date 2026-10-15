import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import LandingPage from "./LandingPage.jsx";
import AboutPage from "./AboutPage.jsx";

// Marketing pages rendered to HTML at build time, for scripts/prerender.js.
// Run in Node only, so nothing here reaches the browser bundle.
const PAGES = { "/": LandingPage, "/about": AboutPage };

export function renderPage(path) {
  const Page = PAGES[path];
  if (!Page) throw new Error(`No page to prerender at ${path}`);
  return renderToString(
    <StaticRouter location={path}>
      <Page />
    </StaticRouter>
  );
}
