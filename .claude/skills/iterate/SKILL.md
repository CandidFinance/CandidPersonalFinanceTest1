---
name: iterate
description: Candid's build-review-fix loop. Builds a change, then reviews it with three fresh-context reviewers (a non-specialist reader, a clarity checker, a design checker) and fixes what they find, round by round, until nothing material is left or 3 rounds are done. Use when Harvey runs /iterate or asks Claude to build something and review it until it's final.
---
# Iterate until final

The loop takes a change from a first draft to ready for Harvey's look, without him reviewing every round. It does not replace his final check on copy and UI (CLAUDE.md), and it doesn't make product decisions.

Work in a round folder in the scratchpad: `<scratchpad>/iterate/round-<n>/`. Keep a `log.md` there across rounds: the findings, what was done about each, and why.

## 1. Brief (before writing code)

Write these into `<scratchpad>/iterate/brief.md` and show Harvey the acceptance criteria in one short block. Carry on unless the task is ambiguous.

- **Acceptance criteria:** 3–5 lines on what "done" looks like for this task, checkable from the screen or the tests.
- **Screens:** the routes the change touches (e.g. `app/module/cash`).
- **Profile:** the test profile from `scripts/profiles.js` that shows the change best. Prefer `KEY_PROFILES`. If the change depends on an answer no profile has, add a profile there (it then joins the screen check too).
- **Persona:** one from `docs/personas.md` that matches the profile. For copy-heavy changes, add a second with medium literacy.
- **Intended meaning:** for each screen, what a user should take away: headline £ and what it is, good or bad, why, options, next tap. Write this now, before any reader runs, and don't change it to fit the readers' answers.

A change with no screen (engine, API, scripts) skips the readers and both checkers. Its loop is the tests plus `/code-review` until no correctness findings remain.

## 2. Build

Make the change. Follow CLAUDE.md as usual.

## 3. Hard gates (every round)

- `npm test` (the Stop hook runs it when `src/lib`, `scripts`, `api` or `server` change).
- From the **PowerShell** tool (the build fails from Bash): `npm run build`, then `npm run check:key`.

A failure here is fixed before any review. A round doesn't count until the gates pass.

## 4. Capture

```
node scripts/screen-capture.mjs --out <round folder> --profile <profile> --routes app/module/cash,app/progress
```

Routes go without the leading slash. Open one slice per screen yourself to confirm the capture shows the right screen. A tour, a blank page or the error screen means fix the capture first. A review of the wrong screen is worse than none.

## 5. Review (in parallel, one message)

Launch together:

- **`candid-reader`**, one per screen per persona. The brief: the persona's full entry from `docs/personas.md`, and the exact paths of that screen's `.png` slices and `.txt`. Nothing else: no task, no intent, no code. Its ignorance is the test.
- **`candid-design-checker`**, once. The brief: the task, the changed files, the round folder.

When the readers are back, launch:

- **`candid-clarity-checker`**, once. The brief: the task, the acceptance criteria, the intended meaning, the changed files, the round folder, and every reader report in full.

From round 2, review only the screens the last round's fixes changed, unless a fix touched something shared.

## 6. Triage

Go through both checkers' findings:

| Finding | Action |
|---|---|
| `material`, `in-task` | Fix this round. |
| `minor`, `in-task` | Fix in one pass, then stop chasing minors. List any left in the report. |
| `your-call` | Don't touch. List it for Harvey with the evidence. |
| `out-of-task`, a confirmed bug | Log it to Notion (step 8). Don't fix it in this task. |
| `out-of-task`, copy or design | List it for Harvey. |
| A reader misread the checker dismissed | Drop it. |

Before fixing a figure finding, make sure the checker confirmed it in the code. Never act on a reader's figure claim alone: in the first test, a reader reported a chart mismatch that wasn't there.

Record every finding and its outcome in `log.md`.

## 7. Loop or stop

Back to step 3 with the fixes, as round n+1. Stop when any of these is true:

- **Done:** the gates pass, and the round's checkers return no `material` in-task findings.
- **Cap:** 3 rounds completed. Stop and report what's left.
- **Stuck:** the same finding comes back after a fix, or a fix needs a product decision. Stop and ask Harvey; don't go round in circles.

Each round costs about 70k tokens per reader plus the two checkers. Don't add readers or rounds beyond this.

## 8. Log out-of-task bugs to Notion

Harvey's "Mobile UI" page (Notion page `3e22f017-e6c5-8029-9f7d-f48ae1f4f41c`) has colour-coded toggles; bugs go in the **BUGS** toggle as to-dos.

1. Fetch the page. Skip any bug that's already listed there, in any wording.
2. Add each new one as an unchecked to-do **at the end of the BUGS toggle**, in this form:
   `[Review <d Mon>] <Screen>: <what's wrong, for a user> (<file:line>). Seen with the <profile> profile.`
3. Use only an insert or append operation. Never replace or rewrite the page's existing content. If the update tool can't insert inside the toggle without rewriting the page, don't write; list the bugs in the report instead and say why.
4. Only confirmed bugs, with evidence. No copy opinions or "your call" items.

## 9. Finish

Report in this order:

1. **Outcome:** done, or stopped (cap or stuck) and why.
2. **What changed**, in a few lines, with links to the files.
3. **Acceptance criteria**, each met or not.
4. **Rounds:** for each, the material findings and what fixed them, one line each.
5. **Your call:** the `your-call` items, each with the reader quote or evidence that raised it.
6. **Logged to Notion:** the bugs added, or "none".
7. **Left over:** minor findings not fixed.

Then:

- **Copy or UI the user sees:** leave it uncommitted. Give Harvey the localhost URL (`npm run dev`, http://localhost:5173) and the screen to check. When he approves, run `/ship`.
- **No visible change:** run `/ship`.

If Harvey later changes copy or a screen the loop produced, add the before/after to `docs/consumer-clarity.md` as its last section says. That's how the standard learns what the loop missed.
