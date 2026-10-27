// Pre-written "email HR" drafts for reminder actions. A web app can't attach a
// file or draft into the user's mail client directly, so each draft is opened
// via a mailto: link (subject + body prefilled, recipient left blank for the
// user to fill in) and also embedded in the calendar event's description, so
// the text is still there at reminder time. Pure logic only — no design
// tokens/CandidApp imports — so it's safe to import from anywhere.

// Signs off with the user's full name (HR knows them by it), or a visible
// placeholder if onboarding didn't capture one so it's obvious to fill in.
function signOff(name) {
  return (name || "").trim() || "[Your name]";
}

export function pensionMatchDraft({ name, contributing, myPct }) {
  const n = (name || "").trim();
  const context = contributing && myPct > 0
    ? `I currently contribute ${myPct}% of my salary to the company pension.`
    : "I'd like to understand my options for the company pension.";
  return {
    subject: n ? `Pension matching questions - ${n}` : "Pension matching questions",
    body: `Hi,

Hope you are well.

${context} I'd like to make sure I'm getting the full benefit of any employer contribution, and have two questions:

1. What is the company's pension match cap, i.e. the maximum employer contribution, and what do I need to contribute to receive it in full?
2. What do I need to do to set up or change my contribution to that level (any forms or portal steps), and what is the cut-off for it to take effect from the next payroll?

Many thanks,
${signOff(name)}`,
  };
}

export function bonusSacrificeDraft({ name }) {
  const n = (name || "").trim();
  return {
    subject: n ? `Bonus pension sacrifice - ${n}` : "Bonus pension sacrifice",
    body: `Hi,

Hope you are well.

I'm interested in paying some or all of my bonus into my pension via salary sacrifice, before it's paid. Could you let me know:

1. Whether the company offers bonus sacrifice into the pension.
2. What I need to do to set this up, and the deadline for doing so ahead of the payroll run that pays my bonus.
3. Whether any employer National Insurance saving is passed on into my pension.

Many thanks,
${signOff(name)}`,
  };
}

// The £100k tax trap's pension payment, by salary sacrifice, from the next
// pay period.
export function salarySacrificeDraft({ name, perMonth, perYear }) {
  const n = (name || "").trim();
  const gbp = v => `£${Math.round(v).toLocaleString("en-GB")}`;
  return {
    subject: n ? `Pension salary sacrifice - ${n}` : "Pension salary sacrifice",
    body: `Hi,

Hope you are well.

I'd like to pay an extra ${gbp(perMonth)} a month (${gbp(perYear)} a year) into my workplace pension through salary sacrifice, starting from the next pay period. Could you let me know:

1. What I need to do to set this up (any forms or portal steps), and the cut-off for it to take effect from the next payroll.
2. Whether any employer National Insurance saving is passed on into my pension.

Many thanks,
${signOff(name)}`,
  };
}

export function buildMailtoUrl({ subject, body }) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Plain-text version of a draft for the calendar event description.
export function draftAsText({ subject, body }, who = "HR") {
  return `Draft email to ${who} (subject: ${subject}):\n\n${body}`;
}
