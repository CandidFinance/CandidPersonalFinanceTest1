---
name: ship
description: Candid's finish-and-push routine. Use when a change is done and about to be committed, pushed or deployed to candid-finance.co.uk.
---
# Ship a change

Run these in order and report what each one showed. Stop at the first failure and fix the cause.

1. **Tests.** `npm test` (about 10s). The Stop hook already runs it when `src/lib`, `scripts`, `api` or `server` changed, so only run it here if that hasn't happened this turn. After a deliberate engine change: `CHARACTERISATION_UPDATE=1 npm test`, then read the snapshot diff and say which figures moved and why.
2. **Screens (UI changes only).** `npm run build && npm run check:key`, the 4 key ICP profiles only. Run the full `npm run verify` only if Harvey asks or the change touches every module (shared calcs, routing). Never run two builds or checks at once, and when stopping one, make sure its `node` and `headless_shell` processes are gone. Never touch Harvey's own chrome.exe. If the change adds a new kind of user or answer, add a profile to `PROFILES` in `scripts/screen-check.js` (and to `KEY_PROFILES` if it's a core user).
3. **Fresh-eyes review (anything beyond a one-line fix).** Run `/code-review` on the diff. It reviews in a separate context, so it isn't marking its own work. Fix findings that affect correctness. List the rest as optional; don't chase them.
4. **Copy or UI the user sees: stop here.** Leave it uncommitted, give Harvey the localhost URL, and push only when he says so. If the dev server shows a blank page or "Outdated Optimize Dep", restart it with `npx vite --port 5173 --force`.
5. **Commit and push to `main`** (that's production). Stage only this task's files, not unrelated untracked ones.
6. **Confirm the deploy** with the Vercel connector: `list_deployments` with teamId `team_FPotACdYGoSY1dZCVbrUQlAp`, project candid-personal-finance-test1, and match `githubCommitSha` to the push. Wait for READY. Don't poll the live site with curl (the bot check returns 403s) or `/api/billing` (it uses up the rate limit). If it shows `git_info_fail`, ask Harvey to redeploy.
7. **Clean up.** Stop any dev or preview server this session started.

End with one line per step: what ran, and its result.
