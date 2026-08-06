import fs from "fs";
import path from "path";
import os from "os";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import ReportPdf from "../src/pdf/ReportPdf.jsx";
import { calcMetrics, computeModuleStatuses } from "../src/CandidApp.jsx";

// ── Layer 1: only our own site (or local dev) may call this route ────────────
const ALLOWED_HOSTNAMES = ["candid-finance.co.uk", "www.candid-finance.co.uk", "localhost", "127.0.0.1"];

// ── Layer 2: only a plausible request shape is processed ──────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_EMAIL_SOURCES = new Set(["new", "prefilled", "edited"]);

// ── Layer 3: in-memory per-IP rate limit (same pattern as api/claude.js) ──────
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;
const requestLog = new Map(); // ip -> timestamps[]
let sweepCounter = 0;

function sweepStaleEntries() {
  if (++sweepCounter % 100 !== 0) return;
  const now = Date.now();
  for (const [ip, timestamps] of requestLog) {
    const fresh = timestamps.filter(t => now - t < RATE_WINDOW_MS);
    if (fresh.length === 0) requestLog.delete(ip);
    else requestLog.set(ip, fresh);
  }
}

function isRateLimited(ip) {
  sweepStaleEntries();
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT;
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function isAllowedOrigin(req) {
  const value = req.headers.origin || req.headers.referer;
  if (!value) return false;
  try {
    return ALLOWED_HOSTNAMES.includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function isValidBody(body) {
  if (!body || typeof body !== "object") return false;
  if (typeof body.email !== "string" || !EMAIL_RE.test(body.email.trim())) return false;
  if (!ALLOWED_EMAIL_SOURCES.has(body.email_source)) return false;
  if (typeof body.marketing_opt_in !== "boolean") return false;
  if (!body.d || typeof body.d !== "object") return false;
  if (!body.insights || typeof body.insights !== "object") return false;
  return true;
}

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function insertPdfRequest({ session_id, email, email_source, marketing_opt_in, candid_score }) {
  if (!SUPA_URL || !SUPA_KEY) return null;
  const res = await fetch(`${SUPA_URL}/rest/v1/report_pdf_requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify({ session_id, email, email_source, marketing_opt_in, candid_score }),
  });
  const data = await res.json();
  return Array.isArray(data) && data[0]?.id ? data[0].id : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!isValidBody(req.body)) {
    return res.status(400).json({ error: "Invalid request" });
  }

  if (isRateLimited(getClientIp(req))) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const { d, insights, email, email_source, marketing_opt_in, session_id, candid_score } = req.body;
  const trimmedEmail = email.trim();

  let requestId = null;
  try {
    requestId = await insertPdfRequest({
      session_id: session_id || null,
      email: trimmedEmail,
      email_source,
      marketing_opt_in,
      candid_score: candid_score ?? insights?.score ?? null,
    });
  } catch (e) {
    console.error("[generate-report-pdf] Supabase insert failed:", e);
  }

  let pdfPath;
  try {
    const m = calcMetrics(d);
    const statuses = computeModuleStatuses(d, m);
    const buffer = await renderToBuffer(createElement(ReportPdf, { d, m, statuses, insights }));
    pdfPath = path.join(os.tmpdir(), `candid-report-${requestId || Date.now()}.pdf`);
    fs.writeFileSync(pdfPath, buffer);
    console.log(`[generate-report-pdf] PDF generated for ${trimmedEmail} at ${pdfPath}`);
  } catch (e) {
    console.error("[generate-report-pdf] PDF generation failed:", e);
    return res.status(500).json({ error: "PDF generation failed", requestId });
  }

  // Email delivery (Resend) not wired yet — generated PDF is left on disk at
  // pdfPath for manual verification in the meantime.
  return res.status(200).json({ ok: true, requestId, pdfPath });
}
