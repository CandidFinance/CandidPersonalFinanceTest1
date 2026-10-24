import { test } from "node:test";
import assert from "node:assert/strict";
import { WEEKLY_DRAFT_TOOL, WEEKLY_DRAFT_DAY, weeklyDraftSystem, weeklyDraftPrompt, weeklyDraftFromTool, weeklyFlagEmail } from "./weeklyDraft.js";
import { nextSunday } from "./weekly.js";

const week = "2026-10-25";
const events = [
  { id: "boe-old", kind: "bankRate", date: "2026-09-17", from: 4 },
  { id: "boe-last", kind: "bankRate", date: "2026-10-22", from: 4 },
  { id: "budget-x", kind: "budget", date: "2026-10-28" },
  { id: "boe-far", kind: "bankRate", date: "2026-12-17", from: 3.75 },
];
const toolInput = {
  subject: "Budget week: what's been reported", intro: "A quiet week for rates ahead of Wednesday's Budget.",
  items: [
    { title: "Cash ISA limit reported to fall", status: "rumour", body: "Several papers report a lower cash ISA limit.", source: "Financial Times", url: "https://www.ft.com/x",
      impact: { kind: "cashIsaLimit", change: "", limit: "12000", from: "April 2027", cap: "" } },
    { title: "Easy-access rates edge down", status: "news", body: "Three providers cut easy-access rates this week.", source: "Moneyfacts", url: "",
      impact: { kind: "none", change: "", limit: "", from: "", cap: "" } },
  ],
  note: "Check the FT report.",
};

test("Saturday's run drafts the issue for the next day", () => {
  assert.equal(new Date("2026-10-24T12:00:00Z").getUTCDay(), WEEKLY_DRAFT_DAY);
  assert.equal(nextSunday(new Date("2026-10-24T15:00:00Z")), week);
});

test("the tool is strict, every property required, and shares the event items", () => {
  const walk = s => {
    if (s?.type === "object") {
      assert.equal(s.additionalProperties, false);
      assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort());
      Object.values(s.properties).forEach(walk);
    }
    if (s?.type === "array") walk(s.items);
  };
  walk(WEEKLY_DRAFT_TOOL.input_schema);
  assert.equal(WEEKLY_DRAFT_TOOL.strict, true);
  assert.ok(!("found" in WEEKLY_DRAFT_TOOL.input_schema.properties));
  assert.match(weeklyDraftSystem(), /never what the reader should do/);
  assert.match(weeklyDraftSystem(), /rumour/);
});

test("the prompt names the week, the event just past and the one coming, not those further off", () => {
  const prompt = weeklyDraftPrompt(week, "2026-10-24", events);
  assert.match(prompt, /Sunday 25 October/);
  assert.match(prompt, /since Sunday 18 October/);
  assert.match(prompt, /separate email about the Bank Rate decision on Thursday 22 October/);
  assert.match(prompt, /Coming up: the Budget on Wednesday 28 October/);
  assert.doesNotMatch(prompt, /17 September|17 December/);
  assert.match(prompt, /next Sunday's email will recap the Budget/);
});

test("the Sunday after a Budget is its recap", () => {
  const prompt = weeklyDraftPrompt("2026-11-01", "2026-10-31", events);
  assert.match(prompt, /This issue is the Budget recap: the Budget was on Wednesday 28 October/);
  assert.doesNotMatch(prompt, /separate email about the Budget/);
  assert.doesNotMatch(prompt, /will recap the Budget/);
});

test("Claude's tool input becomes a clean issue, with an impact only where one fits", () => {
  const issue = weeklyDraftFromTool(toolInput);
  assert.deepEqual(Object.keys(issue).sort(), ["intro", "items", "subject"]);
  assert.deepEqual(issue.items[0].impact, { kind: "cashIsaLimit", limit: "12000", from: "April 2027" });
  assert.equal(issue.items[0].status, "rumour");
  assert.equal(issue.items[1].impact, null);
});

test("the flag: what's waiting and where to approve it, or that it needs writing", () => {
  const draft = weeklyDraftFromTool(toolInput);
  const ok = weeklyFlagEmail(week, { draft, note: "Check the FT report." });
  assert.match(ok.subject, /^To approve: .*Sunday 25 October/);
  assert.match(ok.text, /\[rumour\] Cash ISA limit reported to fall \[for you: Cash ISA limit\]/);
  assert.match(ok.text, /Claude's note: Check the FT report\./);
  assert.match(ok.text, /\/admin\/alerts/);
  const missing = weeklyFlagEmail(week, { error: "Claude returned 529" });
  assert.match(missing.subject, /needs writing/);
  assert.match(missing.text, /Claude returned 529/);
});
