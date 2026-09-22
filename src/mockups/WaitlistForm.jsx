import { useState } from "react";
import posthog from "posthog-js";
import { motion } from "framer-motion";
import { G, WHITE, SANS } from "../CandidApp.jsx";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
// Apple's own button blue — the one accent colour on this page that departs
// from Candid's usual green/gold, reserved for the waitlist CTA per the brief.
export const WAITLIST_BLUE = "#0071E3";
const STORAGE_KEY = "candid_waitlist_joined";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Posts to a `waitlist` table (columns: email text, source text) via the same
// anon-key REST pattern CandidApp.jsx's supaInsert uses elsewhere in this app.
// NOTE: that table doesn't exist in Supabase yet, so this currently fails —
// gracefully, as an inline error, never a false "you're on the list" — until
// the table is created (flagged to the user; not created here without asking,
// since it's a live production database).
async function joinWaitlist(email, source) {
  if (!SUPA_URL || !SUPA_KEY) return { ok: false, reason: "not_configured" };
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Prefer: "return=minimal" },
      body: JSON.stringify({ email, source }),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, reason: "network" };
  }
}

// `source` tags which section of the page the signup came from (hero vs the
// final CTA) so it's visible in analytics/the waitlist rows later.
export default function WaitlistForm({ id, source = "hero" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) ? "success" : "idle"; } catch (e) { return "idle"; }
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) { setStatus("invalid"); return; }
    setStatus("loading");
    const result = await joinWaitlist(email.trim(), source);
    if (result.ok) {
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch (e) {}
      posthog.capture("waitlist_joined", { source });
      setStatus("success");
    } else {
      posthog.capture("waitlist_join_failed", { source, reason: result.reason || result.status });
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div id={id} style={{ fontFamily: SANS, fontSize: "15px", fontWeight: 600, color: G, padding: "16px 4px" }}>
        You're on the list — we'll email you the moment Candid launches.
      </div>
    );
  }

  return (
    <form id={id} onSubmit={handleSubmit} style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
      <input
        type="email" value={email} required
        onChange={e => { setEmail(e.target.value); if (status !== "idle") setStatus("idle"); }}
        placeholder="you@email.com"
        style={{
          flex: "1 1 280px", maxWidth: "340px", padding: "16px 20px",
          border: `1.5px solid ${status === "invalid" || status === "error" ? "#c0392b" : "rgba(22,47,36,0.18)"}`,
          borderRadius: "100px", fontSize: "15px", fontFamily: SANS, color: G, background: WHITE,
        }}
      />
      <motion.button
        type="submit" disabled={status === "loading"}
        whileHover={{ scale: 1.03 }}
        style={{
          background: WAITLIST_BLUE, border: "none", borderRadius: "100px", padding: "16px 32px",
          fontSize: "15px", fontWeight: 700, color: WHITE, fontFamily: SANS,
          cursor: status === "loading" ? "default" : "pointer", opacity: status === "loading" ? 0.7 : 1,
        }}
      >
        {status === "loading" ? "Joining…" : "Join the waitlist"}
      </motion.button>
      {status === "invalid" && <div style={{ width: "100%", fontSize: "12px", color: "#c0392b" }}>Enter a valid email address.</div>}
      {status === "error" && <div style={{ width: "100%", fontSize: "12px", color: "#c0392b" }}>Something went wrong — please try again.</div>}
    </form>
  );
}
