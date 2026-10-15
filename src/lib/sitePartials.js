// Shared markup for the standalone .html pages (the calculators, privacy,
// terms, 404), which can't use the app's React components. A page writes a
// placeholder element and the build swaps in the markup: Vite does it for
// the pages it builds (vite.config.js), scripts/copy-static-pages.js for the
// pages it copies. The dev server runs the same swap, so pages look the same
// locally.
//
//   <candid-last-updated date="YYYY-MM-DD"></candid-last-updated>
//       "Last updated 13 October 2026", under a page's h1.
//   <candid-footer></candid-footer>
//       The site footer, with the regulatory disclaimer.
//
// Every page also gets its OpenGraph and Twitter card tags (addSocialMeta)
// and the company's Organization structured data (addOrganization).
import { DISCLAIMER, DISCLAIMER_DETAIL } from "./disclaimer.js";

export const SITE_URL = "https://www.candid-finance.co.uk";
// Shared image for pages that don't name their own og:image. 1200x630, made
// by scripts/social-images.js.
export const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/og/home.png`;
export const COMPANIES_HOUSE_URL = "https://find-and-update.company-information.service.gov.uk/company/17383565";

// Schema.org Organization, on every page. Other JSON-LD on a page refers to
// it by "@id" (e.g. a calculator's "publisher").
export const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Candid Personal Finance Ltd",
  alternateName: "Candid",
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/icon-512.png`,
  identifier: { "@type": "PropertyValue", propertyID: "UK Companies House company number", value: "17383565" },
  address: { "@type": "PostalAddress", streetAddress: "66 Paul Street", addressLocality: "London", postalCode: "EC2A 4NA", addressCountry: "GB" },
  sameAs: [COMPANIES_HOUSE_URL],
};

export function renderLastUpdated(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) {
    throw new Error(`<candid-last-updated> needs date="YYYY-MM-DD", got "${date}"`);
  }
  const shown = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
  return `<p style="font-size:13px;color:#6b6b6b;margin-top:10px;">Last updated <time datetime="${date}">${shown}</time></p>`;
}

// Hand-matches src/site/SiteFooter.jsx's company line and colours.
export function renderFooter() {
  const link = "color:rgba(255,255,255,0.5);";
  return `<footer style="background:#162F24;padding:28px 32px;text-align:center;margin-top:40px;">
    <p style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.85);">${DISCLAIMER}</p>
    <p style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:6px;line-height:1.6;">${DISCLAIMER_DETAIL}</p>
    <p style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:10px;line-height:1.6;">
      © 2026 Candid Personal Finance Ltd · Company no. 17383565 ·
      <a href="/about" style="${link}">About</a> ·
      <a href="/privacy.html" style="${link}">Privacy</a> ·
      <a href="/terms.html" style="${link}">Terms</a>
    </p>
  </footer>`;
}

// A tag's content, matched to its own quote mark so an apostrophe inside a
// double-quoted description doesn't cut it short.
const metaContent = (html, key) =>
  html.match(new RegExp(`<meta\\s+(?:property|name)=["']${key}["']\\s+content=(["'])(.*?)\\1`, "i"))?.[2];

// Adds whichever OpenGraph and Twitter card tags a page doesn't already
// have, from what it does: og:title falls back to <title>, og:description
// to the meta description, og:url to the canonical link, og:image to
// DEFAULT_SOCIAL_IMAGE. A page sets its own by writing the tag itself.
export function addSocialMeta(html) {
  const title = metaContent(html, "og:title") ?? html.match(/<title>([^<]*)<\/title>/i)?.[1];
  const description = metaContent(html, "og:description") ?? metaContent(html, "description");
  const url = metaContent(html, "og:url") ?? html.match(/<link\s+rel=["']canonical["']\s+href=(["'])(.*?)\1/i)?.[2];
  const image = metaContent(html, "og:image") ?? DEFAULT_SOCIAL_IMAGE;
  const tags = [
    ["property", "og:title", title],
    ["property", "og:description", description],
    ["property", "og:type", "website"],
    ["property", "og:url", url],
    ["property", "og:image", image],
    ["property", "og:site_name", "Candid Finance"],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", title],
    ["name", "twitter:description", description],
    ["name", "twitter:image", image],
  ].filter(([, key, value]) => value != null && metaContent(html, key) == null);
  if (!tags.length) return html;
  const markup = tags.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${value}"/>`).join("\n    ");
  return html.replace("</head>", `    ${markup}\n  </head>`);
}

export function addOrganization(html) {
  const json = JSON.stringify(ORGANIZATION, null, 2).replace(/\n/g, "\n    ");
  return html.replace("</head>", `    <script type="application/ld+json">\n    ${json}\n    </script>\n  </head>`);
}

export function applySitePartials(html) {
  const out = addOrganization(addSocialMeta(html))
    .replace(/<candid-last-updated\s+date=["']([^"']*)["']\s*><\/candid-last-updated>/g, (_, date) => renderLastUpdated(date))
    .replace(/<candid-footer><\/candid-footer>/g, renderFooter());
  const leftover = out.match(/<candid-[a-z-]+[^>]*>/);
  if (leftover) throw new Error(`Unrecognised placeholder ${leftover[0]}`);
  return out;
}
