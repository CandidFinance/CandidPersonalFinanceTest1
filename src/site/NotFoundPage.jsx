import { useEffect } from "react";
import { Link } from "react-router-dom";
import { G, MUT, SERIF } from "../design-tokens.js";
import SiteLayout from "./SiteLayout.jsx";

// Any path main.jsx doesn't route. Reached in the browser by following a
// link inside the site; a request straight to a wrong address gets the
// server's 404.html instead, with a 404 status (see vercel.json).
export default function NotFoundPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Page not found | Candid";
    return () => { document.title = previous; };
  }, []);
  const link = { color: G, fontWeight: 600 };
  return (
    <SiteLayout>
      <section style={{ maxWidth: "640px", margin: "0 auto", padding: "72px 16px 120px", boxSizing: "border-box" }}>
        <h1 style={{ fontFamily: SERIF, fontSize: "36px", fontWeight: 700, color: G, margin: 0, lineHeight: 1.15 }}>Page not found</h1>
        <p style={{ fontSize: "15px", color: MUT, lineHeight: 1.65, margin: "14px 0 0" }}>
          There's nothing at this address. It may have moved, or the link may be mistyped.
        </p>
        <p style={{ fontSize: "15px", lineHeight: 1.65, margin: "20px 0 0" }}>
          <Link to="/" style={link}>Go to the Candid homepage</Link>
        </p>
      </section>
    </SiteLayout>
  );
}
