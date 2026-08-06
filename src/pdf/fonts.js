import path from "path";
import { Font } from "@react-pdf/renderer";

// Local ttf files (not @fontsource's woff2) — react-pdf's fontkit subsetting path is
// more reliable against ttf than woff2. Resolved from process.cwd() rather than this
// file's own import.meta.url, since bundling (esbuild, Vercel's function bundler)
// collapses every source file's import.meta.url to the single output bundle's location.
const FONTS_DIR = path.resolve(process.cwd(), "assets/fonts");
const f = name => path.join(FONTS_DIR, name);

const PLAYFAIR_500 = f("PlayfairDisplay-Medium.ttf");
const PLAYFAIR_700 = f("PlayfairDisplay-Bold.ttf");
const DMSANS_300 = f("DMSans-Light.ttf");
const DMSANS_400 = f("DMSans-Regular.ttf");
const DMSANS_500 = f("DMSans-Medium.ttf");
const DMSANS_600 = f("DMSans-SemiBold.ttf");
const DMSANS_700 = f("DMSans-Bold.ttf");

let registered = false;

// Idempotent — safe to call on every render/import without re-registering.
export function registerReportFonts() {
  if (registered) return;
  registered = true;

  Font.register({
    family: "Playfair Display",
    fonts: [
      { src: PLAYFAIR_500, fontWeight: 500 },
      { src: PLAYFAIR_700, fontWeight: 700 },
    ],
  });

  Font.register({
    family: "DM Sans",
    fonts: [
      { src: DMSANS_300, fontWeight: 300 },
      { src: DMSANS_400, fontWeight: 400 },
      { src: DMSANS_500, fontWeight: 500 },
      { src: DMSANS_600, fontWeight: 600 },
      { src: DMSANS_700, fontWeight: 700 },
    ],
  });

  // react-pdf hyphenates justified text by default (e.g. "sacri-fice" mid-word) —
  // off by default is closer to the web app's non-justified paragraphs.
  Font.registerHyphenationCallback(word => [word]);
}

// Previously inserted a zero-width non-joiner before "fi"/"fl" to work around the woff2
// build silently dropping the ligature glyph when subsetting. The ttf files don't have
// that bug — their "fi"/"fl" glyphs are well-formed — and the ZWNJ workaround itself was
// producing an overlapping-glyph artifact (these fonts have no ZWNJ glyph, so fontkit
// substituted a zero-advance fallback that didn't survive PDF font subsetting/embedding
// cleanly). Kept as a pass-through — call sites don't need to change — but it no longer
// does anything with these fonts.
export function noLigatures(text) {
  return text;
}
