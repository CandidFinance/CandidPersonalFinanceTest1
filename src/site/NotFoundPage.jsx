import { useEffect } from "react";
import { Link } from "react-router-dom";
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
  return (
    <SiteLayout>
      <section className="st-section st-hero">
        <div className="st-label">404</div>
        <h1 className="st-h1">Page not found</h1>
        <p className="st-lede">There's nothing at this address. It may have moved, or the link may be mistyped.</p>
        <p style={{ fontSize: "16px", margin: "28px 0 0" }}>
          <Link to="/" className="st-link">Go to the Candid homepage</Link>
        </p>
      </section>
    </SiteLayout>
  );
}
