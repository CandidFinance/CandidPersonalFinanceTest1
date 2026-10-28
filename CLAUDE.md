## Commands

- `npm test`: engine tests (~10s, fixed clock 8 Oct 2026). A Stop hook runs it automatically when `src/lib`, `scripts`, `api` or `server` change.
- `CHARACTERISATION_UPDATE=1 npm test`: rebuild the figures snapshot after a deliberate engine change, then review its diff.
- `npm run build && npm run check:key`: screen check on the 4 key ICP profiles. The full `npm run verify` (28 profiles, ~10 min) only on request or for changes that touch every module.
- `npm run dev`: http://localhost:5173. Stale deps (blank page, "Outdated Optimize Dep"): `npx vite --port 5173 --force`.
- Use `/ship` to finish a change, and `/handoff` then `/clear` to switch tasks.

## How we work

- One task per session. Run `/clear` between unrelated tasks. Context over 200k makes every turn slower, dearer and less accurate (the hook warns you).
- Use plan mode for changes across several files or unfamiliar code. Skip it when the diff fits in one sentence.
- Send broad investigation ("where is X used", "how does Y work") to a subagent, so the file dumps stay out of the main context.
- Read files in line ranges, not whole. For UI checks, screenshot the component or viewport you changed, not the full page.
- Report diagnosis before fixing a bug, unless told "just fix it". Don't touch code outside the task. Ask before installing tools or dependencies.
- Stop every dev or preview server you start once the check that needed it is done. Old ones pile up and slow the machine.
- When compacting, keep: the task goal, the files changed, what's been verified, and decisions Harvey made.
- One-off Playwright checks: put the script in `scripts/_*.mjs` (the scratchpad can't resolve `node_modules`), run it there, and delete it straight after.
- A new question in a module's walk-through must go in `ADDED_LATER` in `src/lib/moduleStatus.js`. It changes the answers fingerprint, so otherwise every existing user of that module gets a false "did you make a change?" (BankConfirm) prompt.
- In an effect, copy any callback-ref array (`refs.current[i] = el`) when the effect starts (`[...refs.current]`). React nulls those entries on unmount before the effect's cleanup runs; using the live array crashed the site on leaving the landing page (37ef43d).

## Deploys and data (production)

- `main` deploys to production on Vercel. Work happens on `main`; `feature/mobile-app` is stale.
- If a push gets no Vercel deployment, "Redeploy" in the dashboard only rebuilds the old commit. Push an empty commit (`git commit --allow-empty`) to trigger a build of the new one.
- Don't point system redirects (OAuth or payment returns, legacy routes) at `/app/module/*` or `/app/property*`. For anyone not yet in the app, those count as a shared link: CandidApp's `linkedModule` effect sets `appEntered`, fires `app_entered` and inserts a report row. Use `/app/home` or `/app/inputs` instead.
- Push straight away for logic fixes. For copy or UI the user sees, leave it uncommitted and wait for Harvey's go-ahead after he checks localhost.
- The single Supabase project `dcprmqujnzoeiqhwxgpf` is production, and its `test` table is the real report table. `anon` has column-level grants only: a client insert must request `?select=id`, a new client-updated column needs a GRANT (hand Harvey the SQL; auto mode blocks it), and a PATCH that matches no row still returns success. Verify writes by querying the rows.

## Product rules

- Candid is a calculator, not an adviser. No directive copy ("start with X", numbered steps, "what to do first"). List opportunities neutrally, largest £ first. Never tie shares to the user's profile ("people like you"). Avoid "advice", "tailored plan", "action plan", "roadmap".
- Never name the founder or their background (employers, qualifications) on the site, including in meta descriptions and JSON-LD. Describe the people behind Candid as a team who built it to solve their own problem. Company details go in the footer.

## Design Language & UI Rules

1. **Persistent Navigation:** Every page (Homepage, Dashboard, Modules) must share the identical `<Header>` component featuring the "Candid" wordmark + current page label.
2. **Zero Emoji Policy:** Never use emojis in copy, buttons, headers, or icons. Use text labels or a single unified SVG icon set (e.g., Lucide React configured consistently).
3. **Surface Variety:** Do NOT default to wrapping every section in a white rounded border card (`rounded-xl border shadow-sm`). Reserve card containers strictly for discrete, interactive components (e.g., forms, actionable modules). Use whitespace, section backgrounds, or plain `<hr />` dividers for general content.
4. **Single State Indicator:** Every piece of state (e.g., Status, Completion, Progress) gets ONE visual indicator on screen. Eliminate redundant badges or secondary icons repeating the same status.
5. **Editorial Serif Figures:** All prominent numeric metrics (headline £ amounts, scores, key stats) must use the display serif font (`font-serif`, mapped to Georgia or Playfair Display). All supporting text, labels, and UI chrome remain sans-serif.
