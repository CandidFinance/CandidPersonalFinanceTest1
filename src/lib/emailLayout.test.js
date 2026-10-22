import test from "node:test";
import assert from "node:assert/strict";
import { renderEmail, withUtm, SITE } from "./emailLayout.js";
import { confirmEmail, signInEmail, referralRewardEmail, confirmedWelcomeEmail, confirmReminderEmail } from "./accountEmails.js";
import { welcomeEmail } from "./weekly.js";

test("One email, as HTML and plain text: the same words in each", () => {
  const e = renderEmail({
    subject: "S", greeting: "Hi Jo,", unsubscribeUrl: "https://u", note: "Guidance, not advice.",
    blocks: [{ p: ["Hello ", { b: "there" }, ", ", { a: "sign in", href: "https://x/signin" }] }, { h: "What you'll get" }, { list: ["One", "Two"] }, { button: { label: "Open Candid", href: "https://x" } }],
  });
  assert.equal(e.text, "Hi Jo,\n\nHello there, sign in (https://x/signin)\n\nWHAT YOU'LL GET\n- One\n- Two\n\nOpen Candid: https://x\n\nThe Candid team\n\nGuidance, not advice.\nStop these emails: https://u\nCandid Personal Finance Ltd · Company no. 17383565 · 66 Paul Street, London, EC2A 4NA");
  assert.match(e.html, /<img src="https:\/\/www\.candid-finance\.co\.uk\/email\/candid-logo\.png"[^>]*alt="Candid\."/);
  assert.match(e.html, /background:#faf7f0/);
  assert.match(e.html, /<strong[^>]*>there<\/strong>/);
  assert.match(e.html, /<h2[^>]*>What you&#39;ll get<\/h2>|<h2[^>]*>What you'll get<\/h2>/);
  // The gold rule under the logo, and a gold dot for each bullet.
  assert.equal((e.html.match(/background:#c4963a;font-size:0/g) || []).length, 3);
  assert.match(e.html, /color:#162f24;">The Candid team<\/p>/);
  assert.match(e.html, /<a href="https:\/\/u"[^>]*>Stop these emails<\/a>/);
});

test("What people type is escaped in the HTML", () => {
  const { html } = renderEmail({ subject: "<s>", blocks: [{ p: "<script>x</script> & \"q\"" }] });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt; &amp; &quot;q&quot;/);
});

test("The account emails: a button for each link, and no unsubscribe link", () => {
  const confirm = confirmEmail({ name: "Jo Bloggs", title: "Pension", figure: "£1,200", url: "https://c", days: 14 });
  assert.match(confirm.text, /^Hi Jo,\n\nYour pension answer: £1,200 a year, our estimate on your figures/);
  assert.match(confirm.html, /href="https:\/\/c"[^>]*>Confirm my email<\/a>/);
  assert.doesNotMatch(confirm.text, /Stop these emails/);
  assert.equal(confirmEmail({ name: "<b>", url: "https://c", days: 14 }).text.split("\n")[0], "Hi,");
  const signIn = signInEmail({ url: "https://s" });
  assert.match(signIn.html, />Sign in to Candid<\/a>/);
  assert.doesNotMatch(signIn.text, /The Candid team/);
  const month = referralRewardEmail({ kind: "free_month", until: "2026-11-20T00:00:00Z", url: "https://r", cap: 12 });
  assert.match(month.text, /until 20 November 2026\./);
  assert.match(month.html, /href="https:\/\/r"[^>]*>Turn on my free month<\/a>/);
  assert.match(referralRewardEmail({ kind: "stripe_credit", cap: 12 }).subject, /a month off your bill/);
});

test("The welcome: bold lead-ins on its bullets, the plan and the invite link in panels", () => {
  const { html } = welcomeEmail({ name: "Alex", plan: "monthly", amountPence: 299, periodEnd: "2026-11-20T17:59:52Z", inviteCode: "abcd2345", unsubscribeUrl: "https://u" });
  assert.match(html, /<strong[^>]*>An email roundup on Sunday mornings<\/strong>/);
  assert.match(html, />Your plan<\/div>/);
  assert.match(html, />Your invite link<\/div>[\s\S]*href="https:\/\/www\.candid-finance\.co\.uk\/app\/start\?ref=abcd2345"/);
});

test("A free user's welcome: rate alerts offered to a founding user who hasn't asked for them, and their invite link", () => {
  const base = { name: "Jo", optInUrl: "https://o", cap: 12, unsubscribeUrl: "https://u" };
  const offer = confirmedWelcomeEmail({ ...base, founding: true, optedIn: false, inviteCode: "abcd2345" });
  assert.match(offer.html, /href="https:\/\/o"[^>]*>Turn on rate alerts<\/a>/);
  assert.match(offer.text, /free for founding users only/);
  assert.match(offer.text, /candid-finance\.co\.uk\/app\/start\?ref=abcd2345/);
  assert.match(offer.text, /Subscribe and they're saved to this email address/);
  const on = confirmedWelcomeEmail({ ...base, founding: true, optedIn: true });
  assert.doesNotMatch(on.text, /Turn on rate alerts/);
  assert.match(on.text, /You're signed up/);
  assert.match(on.text, /Your link is in Candid, under Edit inputs/);
  const later = confirmedWelcomeEmail({ ...base, founding: false, optedIn: false });
  assert.doesNotMatch(later.text, /founding|Turn on rate alerts/);
});

test("The reminder to confirm: a fresh link on a CTA-blue button, and the founding offer while it's open", () => {
  const r = confirmReminderEmail({ name: "Jo", url: "https://c", days: 14, founding: true, unsubscribeUrl: "https://u" });
  assert.match(r.html, /background:#0071E3;"><a href="https:\/\/c"[^>]*>Confirm my email<\/a>/);
  assert.match(r.text, /isn't confirmed yet/);
  assert.match(r.text, /founding user, with rate alerts free/);
  assert.doesNotMatch(confirmReminderEmail({ name: "Jo", url: "https://c", days: 14, founding: false, unsubscribeUrl: "https://u" }).text, /founding/);
});

test("links to the site carry the email's campaign; /api/ links, other sites and plain-text labels are left alone", () => {
  assert.equal(withUtm(`${SITE}/app/home`, "rates"), `${SITE}/app/home?utm_source=candid-email&utm_medium=email&utm_campaign=rates`);
  assert.equal(withUtm(`${SITE}/signin?restore=abc#top`, "signIn"), `${SITE}/signin?restore=abc&utm_source=candid-email&utm_medium=email&utm_campaign=signIn#top`);
  assert.equal(withUtm(`${SITE}/api/alerts?action=unsubscribe&t=x`, "rates"), `${SITE}/api/alerts?action=unsubscribe&t=x`);
  assert.equal(withUtm("https://www.gov.uk/", "weekly"), "https://www.gov.uk/");
  // An invite link is passed on to friends: their visits aren't the email's.
  assert.equal(withUtm(`${SITE}/app/start?ref=abcd2345`, "welcome"), `${SITE}/app/start?ref=abcd2345`);
  assert.equal(withUtm(`${SITE}/app/home`, null), `${SITE}/app/home`);

  const { html, text } = renderEmail({
    subject: "S", campaign: "rates",
    blocks: [
      { p: ["See ", { a: "candid-finance.co.uk/app/home", href: `${SITE}/app/home` }] },
      { button: { label: "See it in Candid", href: `${SITE}/app/module/cash` } },
    ],
    unsubscribeUrl: `${SITE}/api/alerts?action=unsubscribe&t=x`,
  });
  assert.match(html, /app\/module\/cash\?utm_source=candid-email&amp;utm_medium=email&amp;utm_campaign=rates/);
  assert.match(html, /href="https:\/\/www\.candid-finance\.co\.uk\?utm_source=candid-email/);
  assert.match(text, /See it in Candid: https:\/\/www\.candid-finance\.co\.uk\/app\/module\/cash\?utm_source=candid-email/);
  // A label that is the link itself still shows as just the link.
  assert.match(text, /See https:\/\/www\.candid-finance\.co\.uk\/app\/home\?utm_source=candid-email&utm_medium=email&utm_campaign=rates\n/);
  assert.match(text, /Stop these emails: https:\/\/www\.candid-finance\.co\.uk\/api\/alerts\?action=unsubscribe&t=x\n/);
});
