---
name: handoff
description: Write a short handoff note so the session can be cleared and the work picked up in a fresh one. Use when asked to hand off or wrap up, or before /clear.
disable-model-invocation: true
---
# Hand off

Write `.claude/handoff.md` (it's gitignored; replace any existing one), at most 40 lines:

- **Goal:** what we're trying to achieve, in one or two sentences.
- **Done:** what changed, as file paths with a few words each. Committed or not?
- **Verified:** which checks ran and what they returned. Say what hasn't been checked.
- **Decisions:** choices Harvey made, and approaches tried and dropped (and why), so the next session doesn't redo them.
- **Next:** the remaining steps, specific enough to start on without re-reading the code. Name the files and functions.
- **Watch out:** gotchas found this session. If one will matter again, suggest adding it to CLAUDE.md as well.

Don't paste code or long logs. Point to files and line numbers instead.

Then tell Harvey: "Handoff written. Run /clear, then start with: read .claude/handoff.md and carry on."
