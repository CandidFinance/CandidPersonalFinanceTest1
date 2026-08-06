import path from "path";
import fs from "fs";
import { Document, Page, View, Text, Image, StyleSheet, Svg, Circle } from "@react-pdf/renderer";
import { G, GOLD, CREAM, CDARK, TEXT, MUT, WHITE, fmt } from "../CandidApp.jsx";
import { buildReportCards, scoreBand } from "./reportData.js";
import { registerReportFonts, noLigatures } from "./fonts.js";

registerReportFonts();

// Solid green background (matches the footer bar) rather than a transparent PNG —
// PDFKit's PNG alpha handling rendered the transparent version with a white backing
// instead of showing the green footer through it.
// Passed as a Buffer rather than a path string — @react-pdf/image resolves string
// paths via Node's legacy url.parse(), which misreads a Windows drive letter
// ("C:\Users\...") as a URL protocol and sends the path to fetch() instead of fs.
// Resolved from process.cwd() rather than import.meta.url — once this module is
// bundled (esbuild, Vercel's serverless function bundler), every source file's
// import.meta.url collapses to the single bundle's location, not its own.
const LOGO_BUFFER = fs.readFileSync(
  path.resolve(process.cwd(), "assets/Images/Candid.png")
);

const RING_R = 44;
const RING_CIRC = 2 * Math.PI * RING_R;

const styles = StyleSheet.create({
  page: {
    backgroundColor: CREAM,
    fontFamily: "DM Sans",
    fontSize: 10.5,
    color: TEXT,
    paddingBottom: 56, // clears the fixed footer band
  },
  header: {
    backgroundColor: G,
    paddingHorizontal: 40,
    paddingVertical: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordmark: {
    fontFamily: "Playfair Display",
    fontWeight: 700,
    fontSize: 24,
    color: GOLD,
  },
  reportDate: {
    fontSize: 9,
    color: "rgba(255,255,255,0.65)",
  },
  hero: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 40,
  },
  ringWrap: {
    width: RING_R * 2 + 10,
    height: RING_R * 2 + 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  ringLabelBox: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNumber: {
    fontFamily: "Playfair Display",
    fontWeight: 700,
    fontSize: 30,
  },
  scoreOutOf: {
    fontSize: 8,
    color: MUT,
    marginTop: -2,
  },
  scoreBandLabel: {
    fontSize: 10,
    fontWeight: 600,
    marginBottom: 22,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: MUT,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  totalNumber: {
    fontFamily: "Playfair Display",
    fontWeight: 700,
    fontSize: 38,
    color: G,
  },
  totalSuffix: {
    fontSize: 13,
    color: MUT,
  },
  cardsWrap: {
    paddingHorizontal: 40,
  },
  card: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  pill: {
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  pillText: {
    fontSize: 11,
    fontWeight: 700,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 7,
  },
  cardTitle: {
    fontSize: 12.5,
    fontWeight: 600,
    color: TEXT,
  },
  cardSummary: {
    fontSize: 10,
    color: MUT,
    lineHeight: 1.5,
  },
  noCards: {
    fontSize: 11,
    color: MUT,
    textAlign: "center",
    paddingVertical: 20,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: G,
    paddingVertical: 14,
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8.5,
    color: "rgba(255,255,255,0.75)",
  },
  footerLogo: {
    height: 22,
    width: 22 * 3.2, // source PNG is 1600x500 (3.2:1) — preserves aspect ratio
  },
});

function ScoreRingPdf({ score }) {
  const band = scoreBand(score);
  const dash = (Math.max(0, Math.min(100, score)) / 100) * RING_CIRC;
  return (
    <View style={styles.ringWrap}>
      <Svg
        width={RING_R * 2 + 10} height={RING_R * 2 + 10}
        viewBox={`0 0 ${RING_R * 2 + 10} ${RING_R * 2 + 10}`}
      >
        <Circle
          cx={RING_R + 5} cy={RING_R + 5} r={RING_R}
          fill="none" stroke={CDARK} strokeWidth={8}
        />
        <Circle
          cx={RING_R + 5} cy={RING_R + 5} r={RING_R}
          fill="none" stroke={band.color} strokeWidth={8}
          strokeDasharray={`${dash} ${RING_CIRC}`}
          strokeDashoffset={RING_CIRC / 4}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.ringLabelBox}>
        <Text style={[styles.scoreNumber, { color: band.color }]}>{Math.round(score)}</Text>
        <Text style={styles.scoreOutOf}>/ 100</Text>
      </View>
    </View>
  );
}

// Renders Candid's report as a downloadable PDF. Expects already-computed app state
// (calcMetrics/computeModuleStatuses/AI insights) — pure presentation, no data fetching.
// Not yet wired to any button or send pipeline; produced via `pdf(<ReportPdf .../>)`
// (browser) or `renderToBuffer`/`renderToStream` (Node) by whatever caller needs it next.
export default function ReportPdf({ d, m, statuses, insights }) {
  const { cards, totalOpportunity } = buildReportCards(d, m, statuses, insights);
  const band = scoreBand(insights?.score || 0);
  const reportDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Document title={`Candid report — ${d?.name || "your finances"}`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.wordmark}>Candid.</Text>
          <Text style={styles.reportDate}>{reportDate}</Text>
        </View>

        <View style={styles.hero}>
          <ScoreRingPdf score={insights?.score || 0} />
          <Text style={[styles.scoreBandLabel, { color: band.color }]}>{band.label}</Text>

          <Text style={styles.totalLabel}>Total opportunity identified</Text>
          <Text style={styles.totalNumber}>
            {fmt(totalOpportunity)}<Text style={styles.totalSuffix}> /yr</Text>
          </Text>
        </View>

        <View style={styles.cardsWrap}>
          {cards.length === 0 && (
            <Text style={styles.noCards}>{noLigatures("No live recommendations right now — your finances are well optimised.")}</Text>
          )}
          {cards.map(card => (
            <View key={card.key} style={styles.card} wrap={false}>
              <View style={styles.cardTopRow}>
                <View style={[styles.pill, { backgroundColor: card.tint.bg }]}>
                  <Text style={[styles.pillText, { color: card.tint.fg }]}>{card.amountLabel}</Text>
                </View>
                <View style={styles.cardTitleRow}>
                  <View style={[styles.cardTitleDot, { backgroundColor: card.tint.fg }]} />
                  <Text style={styles.cardTitle}>{noLigatures(card.title)}</Text>
                </View>
              </View>
              <Text style={styles.cardSummary}>{noLigatures(card.summary)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{noLigatures("Guidance, not financial advice — the right strategy depends on your full circumstances.")}</Text>
          <Image src={LOGO_BUFFER} style={styles.footerLogo} />
        </View>
      </Page>
    </Document>
  );
}
