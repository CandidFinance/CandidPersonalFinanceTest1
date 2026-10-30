// The emails about someone's account, in the same layout as the rest
// (emailLayout.js): confirming an email address (api/email.js), a sign-in
// link (api/billing.js), a friend's invite rewarded (server/referrals.js),
// and from the daily run (api/alerts.js), a reminder to confirm and the
// welcome the day after a free user does. Each { subject, text, html }.
// Pure, unit tested in emailLayout.test.js.

import { renderEmail, SITE } from "./emailLayout.js";

// Their first name as they typed it into Candid, for "Hi Jo,". It's theirs
// to type, so only a plain name is used: letters, an apostrophe or hyphen,
// nothing that could read as a link or a message.
const hi = name => {
  const first = typeof name === "string" ? name.trim().split(/\s+/)[0] : "";
  return /^\p{L}[\p{L}'’-]{0,29}$/u.test(first) ? `Hi ${first},` : "Hi,";
};

// `title`: the module they answered, `figure`: its £ a year (or null).
export function confirmEmail({ name, title = null, figure = null, url, days }) {
  return renderEmail({ campaign: "confirm",
    subject: "Confirm your email for Candid", preheader: "One tap to confirm it's you.",
    greeting: hi(name),
    blocks: [
      ...(title && figure ? [{ panel: { label: `Your ${title.toLowerCase()} answer`, text: `${figure} a year, our estimate on your figures` } }, { p: "It's saved in Candid on the device you used." }]
        : title ? [{ p: `Your ${title.toLowerCase()} answer is saved in Candid on the device you used.` }] : []),
      { p: "Confirm this is your email address:" },
      { button: { label: "Confirm my email", href: url } },
      { small: `The link works for ${days} days. If you didn't enter this address on Candid, ignore this email and nothing more will be sent.` },
    ],
  });
}

export function signInEmail({ url }) {
  return renderEmail({ campaign: "signIn",
    subject: "Your Candid sign-in link", preheader: "It works for 20 minutes.",
    blocks: [
      { p: "Open this link on the device you want to use Candid on. It works for 20 minutes." },
      { button: { label: "Sign in to Candid", href: url } },
      { small: "If you didn't ask for this, you can ignore it." },
    ],
    signoff: false,
  });
}

// Once, a couple of days after the confirmation email, for an address
// still not confirmed. `url`: a fresh link, good for `days`. `founding`:
// confirming now makes them a founding user.
export function confirmReminderEmail({ name, url, days, founding, unsubscribeUrl }) {
  return renderEmail({ campaign: "confirmReminder",
    subject: "Confirm your email for Candid",
    preheader: founding ? "Confirm it and rate alerts are free for you." : "One tap to confirm it's you.",
    greeting: hi(name),
    blocks: [
      { p: "You left this email address on Candid, but it isn't confirmed yet." },
      ...(founding ? [{ p: "Confirm it and you're a founding user, with rate alerts free: an email when a low rate is costing you £100+ a year on your figures - at most once a month." }] : []),
      { button: { label: "Confirm my email", href: url } },
      { small: `The link works for ${days} days. If you didn't enter this address on Candid, ignore this email and nothing more will be sent.` },
    ],
    unsubscribeUrl,
  });
}

// The day after a free user confirms their email. `founding`: rate alerts
// are theirs free, offered with `optInUrl` unless `optedIn` already.
// `inviteCode`: their invite link's, or null (it's in Edit inputs).
export function confirmedWelcomeEmail({ name, founding, optedIn, optInUrl, inviteCode = null, cap, unsubscribeUrl }) {
  const invite = inviteCode ? `${SITE}/app/start?ref=${inviteCode}` : null;
  const offer = founding && !optedIn;
  return renderEmail({ campaign: "confirmed",
    subject: "Thanks for confirming - welcome to Candid",
    preheader: offer ? "Rate alerts are free for founding users." : "Your invite link, and how to keep your answers.",
    greeting: hi(name),
    blocks: [
      { p: "Thanks for confirming your email address, and welcome to Candid." },
      { p: "Your answers are saved on the device you used. Sign in to Candid with this email address and they're saved to your account, so you can pick up where you left off on any device." },
      ...(founding ? [
        { h: "Rate alerts, free for founding users" },
        optedIn
          ? { p: "You're signed up. When a low rate is costing you £100+ a year on your figures, we'll email you - at most once a month." }
          : { p: "Turn them on and we'll email you when a low rate is costing you £100+ a year on your figures - at most once a month. They're free for founding users only, so don't miss out." },
        ...(optedIn ? [] : [{ button: { label: "Turn on rate alerts", href: optInUrl } }]),
      ] : []),
      { h: "Share Candid" },
      { p: `Know a partner, friend or colleague who could do with a hand with their money? Send them your link. When they join and complete their first module, you get a free month of Candid, up to ${cap} months, and they get an extra answer free.${invite ? "" : " Your link is in Candid, under Edit inputs."}` },
      ...(invite ? [{ panel: { label: "Your invite link", text: [{ a: invite.replace(/^https:\/\/www\./, ""), href: invite }] } }] : []),
      { p: "Any questions or feedback, just reply to this email." },
    ],
    note: "Candid is guidance, not advice.",
    unsubscribeUrl,
  });
}

// `kind`: "stripe_credit" (a month off a paid subscription's next bill) or
// "free_month" (until `until`, turned on by `url` on their device).
export function referralRewardEmail({ kind, until = null, url = null, cap, creditPence = null }) {
  const where = `You can earn up to ${cap} months this way. Your link is in Candid, under Edit inputs.`;
  if (kind === "stripe_credit") {
    const off = creditPence > 0 ? `£${(creditPence / 100).toFixed(2)}` : "A month of Candid";
    return renderEmail({ campaign: "referral",
      subject: "A friend joined Candid: a month off your bill", preheader: `${off} comes off your next bill.`,
      blocks: [
        { p: `A friend you invited has joined Candid and completed their first module, so ${creditPence > 0 ? `${off}, a month of Candid,` : "a month of Candid"} comes off your next bill.` },
        { p: where },
      ],
    });
  }
  const date = until ? new Date(until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }) : null;
  return renderEmail({ campaign: "referral",
    subject: "A friend joined Candid: you've got a free month", preheader: "Every module, free for a month.",
    blocks: [
      { p: `A friend you invited has joined Candid and completed their first module, so you've got a free month: every module's answer and Candid Assist${date ? `, until ${date}` : ""}.` },
      { p: "Open this link on the phone or computer you use Candid on, and it's on. The link works for 7 days." },
      { button: { label: "Turn on my free month", href: url } },
      { small: `The month ends by itself, and nothing is charged. ${where}` },
    ],
  });
}
