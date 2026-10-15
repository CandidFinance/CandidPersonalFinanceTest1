import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import LandingPage from "./LandingPage.jsx";

// The homepage as HTML, for scripts/prerender-home.js. Run at build time
// only, in Node, so nothing here reaches the browser bundle.
export function renderHome() {
  return renderToString(
    <StaticRouter location="/">
      <LandingPage />
    </StaticRouter>
  );
}
