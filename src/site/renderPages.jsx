import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import LandingPage from "./LandingPage.jsx";
import AboutPage from "./AboutPage.jsx";
import TheProblemPage from "./TheProblemPage.jsx";
import HowItWorksPage from "./HowItWorksPage.jsx";
import WhatCandidIsPage from "./WhatCandidIsPage.jsx";

// Marketing pages rendered to HTML at build time, for scripts/prerender.js.
// Run in Node only, so nothing here reaches the browser bundle.
const PAGES = {
  "/": LandingPage,
  "/about": AboutPage,
  "/the-problem": TheProblemPage,
  "/how-it-works": HowItWorksPage,
  "/what-candid-is": WhatCandidIsPage,
};

export function renderPage(path) {
  const Page = PAGES[path];
  if (!Page) throw new Error(`No page to prerender at ${path}`);
  return renderToString(
    <StaticRouter location={path}>
      <Page />
    </StaticRouter>
  );
}
