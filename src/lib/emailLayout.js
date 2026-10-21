// Every email Candid sends, laid out once: written as blocks, rendered as
// a designed HTML email and as plain text (the fallback a mail app shows
// when it won't show HTML). Pure, unit tested in emailLayout.test.js.
//
// The look, from the app's tokens (design-tokens.js): a cream page, a white
// card with the wordmark (public/email/candid-logo.png) and a short gold
// rule, Playfair Display for the greeting, headings and sign-off (Georgia
// where a mail app won't load web fonts), DM Sans for the rest, gold-dot
// bullets and pill buttons in the site's CTA blue (CTA_BLUE, Apple's
// button blue); the small print under the card.
// Email-safe: tables and inline styles only, light scheme only.
//
// Text within a block: a string, or a list of pieces, each a string,
// { b } (bold) or { a, href } (a link; a label that is the link itself, short
// of "https://www.", shows as the link in plain text).
// Blocks:
//   { p }                       a paragraph
//   { h }                       a section heading
//   { list: [text, ...] }       bullets
//   { button: { label, href } } a pill button
//   { panel: { label, text } }  a tinted box (an invite link, a total)
//   { news: { title, status, body, forYou, source, url } }  a news item
//   { small }                   smaller, muted text

export const SITE = "https://www.candid-finance.co.uk";
const COMPANY = "Candid Personal Finance Ltd · Company no. 17383565 · 66 Paul Street, London, EC2A 4NA";

const C = { blue: "#0071E3", green: "#162f24", gold: "#c4963a", cream: "#faf7f0", line: "#ece6d9", text: "#1a1a1a", muted: "#6b6b6b", success: "#2d6b4a" };
const SANS = "'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "'Playfair Display',Georgia,'Times New Roman',serif";
const FONTS = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Playfair+Display:wght@700&display=swap";
const STATUS = {
  rumour: { label: "Rumour", bg: "#f6eedb", fg: "#8a6a24" },
  confirmed: { label: "Confirmed", bg: "#e3efe8", fg: C.success },
  news: { label: "News", bg: "#eeeeea", fg: "#4a4a4a" },
};

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pieces = t => Array.isArray(t) ? t : [t];

// ── Plain text ───────────────────────────────────────────────────────────────
const plain = t => pieces(t).map(x => typeof x === "string" ? x : x.href ? (x.href.endsWith(x.a) ? x.href : `${x.a} (${x.href})`) : x.b ?? "").join("");

function textOf(b) {
  if (b.p !== undefined) return [plain(b.p), ""];
  if (b.h !== undefined) return [b.h.toUpperCase()];
  if (b.list) return [...b.list.map(i => `- ${plain(i)}`), ""];
  if (b.button) return [`${b.button.label}: ${b.button.href}`, ""];
  if (b.panel) return [`${b.panel.label}: ${plain(b.panel.text)}`, ""];
  if (b.small !== undefined) return [plain(b.small), ""];
  if (b.news) {
    const n = b.news;
    return [
      `${n.title}${STATUS[n.status] ? ` (${STATUS[n.status].label})` : ""}`, n.body,
      ...(n.forYou ? [`For you: ${n.forYou}`] : []),
      ...(n.source ? [`Source: ${n.source}${n.url ? ` (${n.url})` : ""}`] : []),
      "",
    ];
  }
  return [];
}

// ── HTML ─────────────────────────────────────────────────────────────────────
const link = (label, href) => `<a href="${esc(href)}" style="color:${C.green};font-weight:700;text-decoration:underline;">${esc(label)}</a>`;
const inline = t => pieces(t).map(x => typeof x === "string" ? esc(x) : x.href ? link(x.a, x.href) : `<strong style="font-weight:700;color:${C.text};">${esc(x.b)}</strong>`).join("");
const P = `margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.text};`;

function htmlOf(b) {
  if (b.p !== undefined) return `<p style="${P}">${inline(b.p)}</p>`;
  if (b.h !== undefined) return `<h2 style="margin:26px 0 12px;font-family:${SERIF};font-size:19px;line-height:1.3;font-weight:700;color:${C.green};">${esc(b.h)}</h2>`;
  if (b.small !== undefined) return `<p style="margin:0 0 14px;font-family:${SANS};font-size:13px;line-height:1.55;color:${C.muted};">${inline(b.small)}</p>`;
  if (b.list) {
    const rows = b.list.map(i => `<tr><td valign="top" width="22" style="width:22px;padding:0 0 12px;"><div style="width:7px;height:7px;margin-top:9px;border-radius:50%;background:${C.gold};font-size:0;line-height:0;">&nbsp;</div></td><td valign="top" style="padding:0 0 12px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.text};">${inline(i)}</td></tr>`).join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">${rows}</table>`;
  }
  if (b.button) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;"><tr><td style="border-radius:100px;background:${C.blue};"><a href="${esc(b.button.href)}" style="display:inline-block;padding:13px 26px;border-radius:100px;font-family:${SANS};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(b.button.label)}</a></td></tr></table>`;
  }
  if (b.panel) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;"><tr><td style="padding:14px 16px;background:${C.cream};border:1px solid ${C.line};border-radius:12px;">`
      + `<div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.muted};">${esc(b.panel.label)}</div>`
      + `<div style="margin-top:4px;font-family:${SANS};font-size:15px;line-height:1.55;color:${C.text};word-break:break-word;">${inline(b.panel.text)}</div></td></tr></table>`;
  }
  if (b.news) {
    const n = b.news, s = STATUS[n.status];
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr><td style="padding:18px 0 0;border-top:1px solid ${C.line};">`
      + `<div style="font-family:${SANS};font-size:16px;line-height:1.4;font-weight:700;color:${C.text};">${esc(n.title)}${s ? ` <span style="display:inline-block;margin-left:6px;padding:2px 9px;border-radius:100px;background:${s.bg};color:${s.fg};font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;vertical-align:2px;">${s.label}</span>` : ""}</div>`
      + `<p style="margin:8px 0 12px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.text};">${esc(n.body)}</p>`
      + (n.forYou ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;"><tr><td style="padding:12px 14px;background:#f1f6f2;border-left:3px solid ${C.success};border-radius:8px;"><div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.success};">For you</div><div style="margin-top:3px;font-family:${SANS};font-size:14.5px;line-height:1.55;color:${C.text};">${esc(n.forYou)}</div></td></tr></table>` : "")
      + (n.source ? `<div style="font-family:${SANS};font-size:12.5px;color:${C.muted};">Source: ${n.url ? `<a href="${esc(n.url)}" style="color:${C.muted};text-decoration:underline;">${esc(n.source)}</a>` : esc(n.source)}</div>` : "")
      + `</td></tr></table>`;
  }
  return "";
}

// One email. `greeting`: "Hi Lizzie," or "Hi,". `preheader`: the line a
// mail app shows after the subject. `signoff`: "The Candid team" under it
// (false for a short link email). `unsubscribeUrl`: for emails people can
// stop; `note`: a line of small print above it.
export function renderEmail({ subject, preheader = "", greeting = "Hi,", blocks = [], signoff = true, note = null, unsubscribeUrl = null }) {
  const text = [
    greeting, "",
    ...blocks.flatMap(textOf),
    ...(signoff ? ["The Candid team", ""] : []),
    ...(note ? [note] : []),
    ...(unsubscribeUrl ? [`Stop these emails: ${unsubscribeUrl}`] : []),
    COMPANY,
  ].join("\n");

  const small = `font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(subject)}</title><link href="${FONTS}" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${C.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.cream};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};"><tr><td align="center" style="padding:28px 12px 36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid ${C.line};border-radius:18px;">
<tr><td style="padding:30px 32px 0;"><a href="${SITE}" style="text-decoration:none;"><img src="${SITE}/email/candid-logo.png" width="118" height="37" alt="Candid." style="display:block;border:0;outline:none;font-family:${SERIF};font-size:28px;font-weight:700;color:${C.green};"></a></td></tr>
<tr><td style="padding:16px 32px 0;"><div style="width:44px;height:2px;background:${C.gold};font-size:0;line-height:0;">&nbsp;</div></td></tr>
<tr><td style="padding:24px 32px 30px;">
<p style="margin:0 0 16px;font-family:${SERIF};font-size:22px;line-height:1.3;font-weight:700;color:${C.green};">${esc(greeting)}</p>
${blocks.map(htmlOf).join("\n")}
${signoff ? `<p style="margin:26px 0 0;font-family:${SERIF};font-size:22px;line-height:1.3;font-weight:700;color:${C.green};">The Candid team</p>` : ""}
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;"><tr><td align="center" style="padding:20px 24px 0;${small}">
${note ? `${esc(note)}<br>` : ""}${unsubscribeUrl ? `<a href="${esc(unsubscribeUrl)}" style="color:${C.muted};text-decoration:underline;">Stop these emails</a><br>` : ""}${esc(COMPANY)}
</td></tr></table>
</td></tr></table>
</body></html>`;
  return { subject, text, html };
}
