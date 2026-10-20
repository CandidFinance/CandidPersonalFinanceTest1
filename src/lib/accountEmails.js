// The emails about someone's account, in the same layout as the rest
// (emailLayout.js): confirming an email address (api/email.js), a sign-in
// link (api/billing.js), and a friend's invite rewarded
// (server/referrals.js). Each { subject, text, html }. Pure, unit tested in
// emailLayout.test.js.

import { renderEmail } from "./emailLayout.js";

// Their first name as they typed it into Candid, for "Hi Jo,". It's theirs
// to type, so only a plain name is used: letters, an apostrophe or hyphen,
// nothing that could read as a link or a message.
const hi = name => {
  const first = typeof name === "string" ? name.trim().split(/\s+/)[0] : "";
  return /^\p{L}[\p{L}'’-]{0,29}$/u.test(first) ? `Hi ${first},` : "Hi,";
};

// `title`: the module they answered, `figure`: its £ a year (or null).
export function confirmEmail({ name, title = null, figure = null, url, days }) {
  return renderEmail({
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
  return renderEmail({
    subject: "Your Candid sign-in link", preheader: "It works for 20 minutes.",
    blocks: [
      { p: "Open this link on the device you want to use Candid on. It works for 20 minutes." },
      { button: { label: "Sign in to Candid", href: url } },
      { small: "If you didn't ask for this, you can ignore it." },
    ],
    signoff: false,
  });
}

// `kind`: "stripe_credit" (a month off a paid subscription's next bill) or
// "free_month" (until `until`, turned on by `url` on their device).
export function referralRewardEmail({ kind, until = null, url = null, cap }) {
  const where = `You can earn up to ${cap} months this way. Your link is in Candid, under Edit inputs.`;
  if (kind === "stripe_credit") {
    return renderEmail({
      subject: "A friend joined Candid: a month off your bill", preheader: "£2.99 comes off your next bill.",
      blocks: [
        { p: "A friend you invited has joined Candid and completed their first module, so £2.99, a month of Candid, comes off your next bill." },
        { p: where },
      ],
    });
  }
  const date = until ? new Date(until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }) : null;
  return renderEmail({
    subject: "A friend joined Candid: you've got a free month", preheader: "Every module, free for a month.",
    blocks: [
      { p: `A friend you invited has joined Candid and completed their first module, so you've got a free month: every module's answer, Candid Assist, and Candid on your other devices${date ? `, until ${date}` : ""}.` },
      { p: "Open this link on the phone or computer you use Candid on, and it's on. The link works for 7 days." },
      { button: { label: "Turn on my free month", href: url } },
      { small: `The month ends by itself, and nothing is charged. ${where}` },
    ],
  });
}
