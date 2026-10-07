import crypto from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { EXTRACTION_TOOL, EXTRACTION_SYSTEM, htmlToText, planChanges, reviewDedupeKey, rowFields } from "../src/lib/rateFeed.js";

// The savings rate feed, one route for both callers:
//  - Vercel Cron, daily (vercel.json), authorised by CRON_SECRET. Each run
//    reads the sources not checked for 6 days, a few at a time, so every
//    page is read about once a week and no run hits the time limit.
//  - The /admin/rates page, authorised by FEEDBACK_ADMIN_PASSWORD: lists
//    sources and open reviews, approves or rejects reviews, adds sources,
//    and can run a check straight away.
// Everything goes through the service-role key; none of these tables can be
// written with the anon key.

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.FEEDBACK_ADMIN_PASSWORD;
const CRON_SECRET = process.env.CRON_SECRET;
const ALLOWED_HOSTNAMES = ["candid-finance.co.uk", "www.candid-finance.co.uk", "localhost", "127.0.0.1"];

const MODEL = "claude-haiku-4-5-20251001";
const RECHECK_AFTER_DAYS = 6;
const SOURCES_PER_RUN = 6;
const CONCURRENCY = 3;
const RUN_BUDGET_MS = 45000;
const FETCH_TIMEOUT_MS = 15000;
const USER_AGENT = "Mozilla/5.0 (compatible; CandidRateCheck/1.0; +https://candid-finance.co.uk)";

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;
const attemptLimiter = redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "10 m"), prefix: "ratelimit:rates-admin" });

function safeEqual(supplied, expected) {
  if (typeof supplied !== "string" || !expected) return false;
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isAllowedOrigin(req) {
  const value = req.headers.origin || req.headers.referer;
  if (!value) return false;
  try { return ALLOWED_HOSTNAMES.includes(new URL(value).hostname); } catch { return false; }
}

// ── Supabase (service role) ──────────────────────────────────────────────────
async function db(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path.split("?")[0]} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

// ── Reading one provider page ────────────────────────────────────────────────
async function fetchPageText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: "fetch_failed" });
  return htmlToText(await res.text());
}

async function extractProducts(providerName, url, pageText) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      temperature: 0,
      system: EXTRACTION_SYSTEM,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: EXTRACTION_TOOL.name },
      messages: [{ role: "user", content: `Provider: ${providerName}\nPage: ${url}\n\n<page_text>\n${pageText}\n</page_text>` }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || `Claude returned ${res.status}`), { status: "extract_failed" });
  const call = (data.content || []).find(c => c.type === "tool_use");
  return Array.isArray(call?.input?.products) ? call.input.products : [];
}

const isUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
const sha256 = s => crypto.createHash("sha256").update(s).digest("hex");

// Reads one source and works out what to change. With dryRun nothing is
// written; the plan is returned instead.
export async function checkSource(source, { force = false, dryRun = false } = {}) {
  const now = new Date().toISOString();
  const result = { source: source.provider_name, url: source.url };
  let pageText;
  try {
    pageText = await fetchPageText(source.url);
  } catch (e) {
    result.status = "fetch_failed"; result.error = e.message;
  }

  if (pageText && pageText.length < 200) { result.status = "no_content"; result.error = "Page has almost no text (it may need JavaScript to load)"; }

  if (!result.status) {
    const hash = sha256(pageText);
    const rows = dryRun && source.rows ? source.rows
      : await db(`savings_rates?source_id=eq.${source.id}&status=eq.live&select=id,provider_name,product_name,rate_kind,is_isa,rate_aer,term_months,notice_days`);
    if (!force && hash === source.last_hash) {
      result.status = "unchanged";
      if (!dryRun && rows.length) await db(`savings_rates?source_id=eq.${source.id}&status=eq.live`, { method: "PATCH", body: { checked_at: now, updated_at: now } });
    } else {
      try {
        const products = await extractProducts(source.provider_name, source.url, pageText);
        const plan = planChanges(rows, products, pageText);
        Object.assign(result, { status: plan.validCount ? "ok" : "no_rates", products: products.length, plan });
        if (!dryRun) await applyPlan(source, plan, now);
      } catch (e) {
        result.status = e.status || "error"; result.error = e.message;
      }
    }
    result.hash = hash;
  }

  if (!dryRun) {
    await db(`rate_sources?id=eq.${source.id}`, { method: "PATCH", body: {
      last_fetched_at: now, last_status: result.status, last_error: result.error || null,
      ...(result.hash ? { last_hash: result.hash } : {}),
      ...(result.plan ? { last_product_count: result.plan.validCount } : {}),
    } });
  }
  return result;
}

// updated_at is moved on whenever a rate is confirmed, changed or not: the
// app shows it as "correct as of", so it means "last checked against the
// provider's page".
async function applyPlan(source, plan, now) {
  for (const p of plan.publish) {
    await db(`savings_rates?id=eq.${p.id}`, { method: "PATCH", body: { ...p.fields, checked_at: now, updated_at: now } });
  }
  if (!plan.reviews.length) return;
  // Skip anything already raised in the last 30 days, open or resolved, so a
  // rejected change isn't raised again every week.
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const recent = await db(`savings_rate_reviews?source_id=eq.${source.id}&created_at=gte.${since}&select=dedupe_key`);
  const seen = new Set(recent.map(r => r.dedupe_key));
  const fresh = plan.reviews
    .map(r => ({ ...r, source_id: source.id, dedupe_key: reviewDedupeKey(source.id, r) }))
    .filter(r => !seen.has(r.dedupe_key));
  if (fresh.length) await db("savings_rate_reviews", { method: "POST", body: fresh, prefer: "return=minimal" });
}

// The sources due a check, oldest first, run a few at a time within the
// time budget. From the admin page (force) it's the named sources, or the
// longest-unchecked ones whether due or not, read again even if unchanged.
export async function runRefresh({ force = false, sourceIds = null } = {}) {
  const started = Date.now();
  const cutoff = new Date(Date.now() - RECHECK_AFTER_DAYS * 864e5).toISOString();
  const filter = sourceIds?.length ? `id=in.(${sourceIds.join(",")})`
    : force ? "active=eq.true"
    : `active=eq.true&or=(last_fetched_at.is.null,last_fetched_at.lt.${cutoff})`;
  const due = await db(`rate_sources?${filter}&order=last_fetched_at.asc.nullsfirst&limit=${SOURCES_PER_RUN}&select=*`);
  const results = [];
  const queue = [...due];
  async function worker() {
    while (queue.length && Date.now() - started < RUN_BUDGET_MS) {
      const source = queue.shift();
      try { results.push(await checkSource(source, { force })); }
      catch (e) { results.push({ source: source.provider_name, status: "error", error: e.message }); }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results.map(({ plan, hash, ...r }) => ({ ...r, ...(plan ? { published: plan.publish.length, reviews: plan.reviews.length, rejected: plan.rejected.length } : {}) }));
}

// ── Admin actions ────────────────────────────────────────────────────────────
async function resolveReview(id, approve) {
  const [review] = await db(`savings_rate_reviews?id=eq.${id}&resolved_at=is.null&select=*,rate_sources(provider_name,url)`);
  if (!review) throw new Error("Review not found or already resolved");
  const now = new Date().toISOString();
  if (approve) {
    if (review.change_type === "new") {
      await db("savings_rates", { method: "POST", prefer: "return=minimal", body: {
        ...review.proposed, provider_name: review.rate_sources.provider_name, product_url: review.rate_sources.url,
        source_id: review.source_id, status: "live", checked_at: now, updated_at: now,
      } });
    } else if (review.change_type === "rate_change" && review.row_id) {
      await db(`savings_rates?id=eq.${review.row_id}`, { method: "PATCH", body: { ...review.proposed, checked_at: now, updated_at: now } });
    } else if (review.change_type === "missing" && review.row_id) {
      await db(`savings_rates?id=eq.${review.row_id}`, { method: "PATCH", body: { status: "withdrawn", updated_at: now } });
    }
  }
  await db(`savings_rate_reviews?id=eq.${id}`, { method: "PATCH", body: { resolved_at: now, resolution: approve ? "approved" : "rejected" } });
}

// A source's name and page, checked. One source per page: a single read of
// a page picks up every product on it, so the same page twice would only
// duplicate them.
async function sourceFields(providerName, url, exceptId = null) {
  let parsed;
  try { parsed = new URL(String(url)); } catch { parsed = null; }
  const name = String(providerName || "").trim().slice(0, 120);
  if (!parsed || parsed.protocol !== "https:" || !name) throw Object.assign(new Error("Needs a provider name and an https URL"), { http: 400 });
  const [taken] = await db(`rate_sources?url=eq.${encodeURIComponent(parsed.toString())}&select=id,provider_name,active`);
  if (taken && taken.id !== exceptId) {
    throw Object.assign(new Error(`That page is already a source (${taken.provider_name}${taken.active ? "" : ", paused"}). Every product on a page comes from its one entry.`), { http: 409 });
  }
  return { provider_name: name, url: parsed.toString() };
}

async function adminOverview() {
  const [sources, reviews, rates] = await Promise.all([
    db("rate_sources?select=id,provider_name,url,active,last_fetched_at,last_status,last_error,last_product_count&order=provider_name.asc"),
    db("savings_rate_reviews?resolved_at=is.null&select=id,source_id,change_type,product_name,current_rate,proposed,created_at,rate_sources(provider_name,url)&order=created_at.desc"),
    db("savings_rates?status=eq.live&select=id,provider_name,product_name,account_type,rate_aer,is_isa,checked_at,updated_at,source_id&order=rate_aer.desc"),
  ]);
  return { sources, reviews, rates };
}

export default async function handler(req, res) {
  if (!SUPA_URL || !SERVICE_KEY || !process.env.ANTHROPIC_API_KEY) {
    console.error("[api/rates] Supabase service key or ANTHROPIC_API_KEY not configured");
    return res.status(503).json({ error: "Service temporarily unavailable" });
  }

  // Vercel Cron: GET with the cron secret.
  if (req.method === "GET" && CRON_SECRET && safeEqual(req.headers.authorization, `Bearer ${CRON_SECRET}`)) {
    const results = await runRefresh();
    console.log("[api/rates] cron run:", JSON.stringify(results));
    return res.status(200).json({ results });
  }

  // Everything else is the admin page.
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: "Service temporarily unavailable" });
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: "Forbidden" });
  if (attemptLimiter) {
    try {
      const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
      const { success } = await attemptLimiter.limit(ip);
      if (!success) return res.status(429).json({ error: "Too many attempts, try again shortly" });
    } catch (e) {
      console.error("[api/rates] rate-limit check failed:", e?.message);
    }
  }
  if (!safeEqual(req.headers["x-admin-password"], ADMIN_PASSWORD)) return res.status(401).json({ error: "Unauthorized" });

  try {
    if (req.method === "GET") return res.status(200).json(await adminOverview());
    if (req.method !== "POST") return res.status(405).end();
    const { action, id, providerName, url, sourceIds } = req.body || {};
    if (id !== undefined && !isUuid(id)) return res.status(400).json({ error: "Bad id" });
    if (sourceIds !== undefined && !(Array.isArray(sourceIds) && sourceIds.every(isUuid))) return res.status(400).json({ error: "Bad source ids" });
    if (action === "approve" || action === "reject") {
      await resolveReview(String(id), action === "approve");
    } else if (action === "add_source") {
      await db("rate_sources", { method: "POST", prefer: "return=minimal", body: await sourceFields(providerName, url) });
    } else if (action === "update_source") {
      // A new page or name for an existing source. Its live rates move with
      // it, so the next read matches them up instead of raising them as new.
      const fields = await sourceFields(providerName, url, String(id));
      await db(`rate_sources?id=eq.${String(id)}`, { method: "PATCH", body: { ...fields, last_hash: null, last_status: null, last_error: null } });
      await db(`savings_rates?source_id=eq.${String(id)}`, { method: "PATCH", body: { provider_name: fields.provider_name, product_url: fields.url } });
    } else if (action === "toggle_source") {
      const [source] = await db(`rate_sources?id=eq.${String(id)}&select=active`);
      if (source) await db(`rate_sources?id=eq.${String(id)}`, { method: "PATCH", body: { active: !source.active } });
    } else if (action === "run") {
      const results = await runRefresh({ force: true, sourceIds: sourceIds || null });
      return res.status(200).json({ results, ...(await adminOverview()) });
    } else {
      return res.status(400).json({ error: "Unknown action" });
    }
    return res.status(200).json(await adminOverview());
  } catch (e) {
    if (e.http) return res.status(e.http).json({ error: e.message });
    console.error("[api/rates] admin action failed:", e);
    return res.status(500).json({ error: e.message });
  }
}
