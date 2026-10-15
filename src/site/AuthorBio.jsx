import { G, GOLD, MUT } from "../design-tokens.js";

// Who builds Candid, for the homepage. Plain text over the page background,
// no tile: it's information, not something to act on.
export default function AuthorBio() {
  return (
    <section aria-labelledby="author-bio-heading" style={{ maxWidth: "640px", margin: "0 auto", padding: "0 24px 88px", textAlign: "center" }}>
      <h2 id="author-bio-heading" style={{ fontSize: "10px", fontWeight: 700, color: GOLD, letterSpacing: "0.16em", textTransform: "uppercase", margin: "0 0 14px" }}>
        Who builds Candid
      </h2>
      <p style={{ fontSize: "15px", color: G, lineHeight: 1.7, margin: 0 }}>
        Built by Harvey Preston. Before Candid, Harvey worked at Strategy& (PwC's strategy consulting business) and Channel 4 Ventures.
      </p>
      <p style={{ fontSize: "13px", color: MUT, lineHeight: 1.6, margin: "8px 0 0" }}>
        Candid Personal Finance Ltd · Company no. 17383565
      </p>
    </section>
  );
}
