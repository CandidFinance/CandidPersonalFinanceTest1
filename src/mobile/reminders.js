// Shared "add a calendar reminder" logic for mobile Win tiles' Bell action.
// No native app / calendar permission exists in a web PWA, so this generates
// a standard .ics file and hands it to the OS via a direct navigation to a
// blob URL — the widely-used technique for triggering iOS Safari's native
// "Add to Calendar" sheet (and Android's calendar-app chooser) without a
// library or backend. Pure logic only — no design tokens/CandidApp imports —
// so it's safe to import from anywhere without circular-import risk.

// Reminder titles follow "Candid: £value, subject" so the calendar entry
// identifies which app it came from and what it's about at a glance, without
// needing to open it. valueLabel should already be formatted (e.g. "£1,200/yr").
export function buildReminderSubject(valueLabel, subject) {
  return `Candid: ${valueLabel}, ${subject}`;
}

// Next working day (skips Saturday/Sunday) — reminders are things like
// "email HR" or "call the Student Loan Company", which only make sense on a
// weekday.
export function nextWorkingDay(base = new Date()) {
  const d = new Date(base);
  d.setDate(d.getDate() + 1);
  const day = d.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 6) d.setDate(d.getDate() + 2);
  else if (day === 0) d.setDate(d.getDate() + 1);
  return d;
}

function escapeIcsText(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function formatIcsDateTime(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

// Builds a minimal RFC5545 .ics file for a single 15-minute event at 9am on
// the given date. Floating local time (no TZID/Z) — the calendar app shows
// it at 9am in whatever timezone the device is in, which is what a same-day
// personal reminder needs.
function buildIcs({ title, description, date }) {
  const start = new Date(date); start.setHours(9, 0, 0, 0);
  const end = new Date(date); end.setHours(9, 15, 0, 0);
  const uid = `candid-${Date.now()}-${Math.random().toString(36).slice(2)}@candid.app`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Candid//Reminder//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDateTime(new Date())}`,
    `DTSTART:${formatIcsDateTime(start)}`,
    `DTEND:${formatIcsDateTime(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    // Alert at the event's own start time — without a VALARM, most calendar
    // apps add the event silently with no notification at all.
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(title)}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// Triggers the OS's native "add event" flow for a reminder on the next
// working day. Returns nothing — this is a side-effecting action, not a
// calculation.
export function triggerCalendarReminder({ title, description }) {
  const ics = buildIcs({ title, description, date: nextWorkingDay() });
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
