# Candid Assist on mobile: roadmap

Roadmap, 14 October 2026. How Candid Assist's account-opening agent gets from a laptop prototype to the mobile app, and what happens with providers that only open accounts in their own app. Follows on from `agentic-cash-workplan.md` section 12 (Candid Assist).

Items marked **(verify)** are my understanding at the time of writing, not confirmed facts. Check them before relying on them.

---

## 1. Where it stands

**The agent is a laptop prototype.** `scripts/assist-agent/agent.js` runs on the user's own computer, starts with `npm run dev`, and drives a real Chrome window with Playwright. Candid's dev build talks to it at `127.0.0.1:5287`. It never ships to production: the Assist panel only offers it when `import.meta.env.DEV` is true.

**What it does today**
- Reads the provider's page as HTML (headings, visible text, every control with its label and options), not screenshots.
- Fills the application from the user's profile (`profile.local.json`, gitignored). Claude only ever sees the field names, never the values.
- Picks from any dropdown or address list, puts dates and phone numbers in the field's format, matches income bands, and ticks answer checkboxes.
- Asks the user in a Candid tile for anything the profile doesn't cover, and saves the answer to the profile when it's one of its own fields.
- Sort code and account number come from a tile, are used once, and are never saved. They're hidden from everything Claude reads.
- Hands over to the user for the ID check, passwords, one-time codes, declarations, terms and consents, and paying in.
- Logs each run to `scripts/assist-agent/runs/` (gitignored) without the values typed.

**The guardrails are code, not instructions to the model** (`guardrails.js`, unit tested): what it may never press, fill or tick.

## 2. The problem

- **Candid's mobile app is a web app.** There's no native shell (no Capacitor, React Native or similar).
- **A web app can't control another site.** Banks block being embedded in other sites, and a page can't reach into a page on another site. So the agent can't run from the mobile app as it is.
- **Opening a browser takes the user out of the app.** On a phone, that breaks the flow at exactly the point Candid is trying to make easy.

## 3. Options

| | A. Native shell, provider's page inside the app | B. Browser on Candid's servers | C. Savings platform partnership |
|---|---|---|---|
| **What it is** | Wrap Candid in Capacitor; the provider's page loads in a web view inside Candid | A headless browser in the cloud fills the form; the user only sees tiles | One identity check with a platform (Raisin, Flagstone, HL Active Savings), then accounts open through its systems |
| **User stays in the app** | Yes | Yes | Yes |
| **Where the user's details go** | Stay on the phone; Claude gets the page structure only | Through Candid's servers, bank details included | To the platform, under its terms |
| **How the bank sees it** | The user's own phone and network, which is what fraud checks expect | Data-centre IP addresses and automated browsers, which bot and fraud systems flag | A regulated platform's own process |
| **Passwords and one-time codes** | Typed by the user into the real page | Would have to be relayed through Candid, close to the pattern banks warn customers about | Not needed per bank |
| **Effort** | A port of the agent, plus an app shell | A server service, plus heavy security work | A commercial deal, and probably a regulatory arrangement |
| **Verdict** | **Recommended next step** | **Avoid** | **Long-term end state** |

## 4. Recommended route: provider's page inside the app

### Design
- **Hidden by default.** The provider's page loads in a web view inside Candid, out of sight. The user sees Candid's tiles and a one-line progress note.
- **Slides up at the user's turn.** For the ID check, a password, a one-time code or a declaration, the real page slides up as a sheet inside Candid. It slides away when the user hands back.
- **A "Watch" button** shows the page at any time. Being able to see what's being typed matters for trust.
- **Approvals and question tiles** work as they do in the prototype.
- **Some steps can't be hidden.** The identity check, setting a password and declarations stay the user's own action on the real page. Hiding the page for everything else is fine; hiding those would mean Candid agreeing to things on the user's behalf (see section 7).

### What carries over from the prototype
- `profile.js`: profile fields, derived forms (dates, phones, monthly income), option matching. Pure JavaScript, unit tested.
- `guardrails.js`: what the agent may never press, fill or tick; bank detail handling; redaction. Pure JavaScript, unit tested.
- The page reading code in `agent.js` (`snapshot`), which already runs inside the page.
- The tools, the system prompt and the agent loop, moved from Node into the app.
- The Candid tiles (`ProfileTile.jsx`, `AgentPanel.jsx`).

### What changes
- **Typing and clicking:** `browser.js` uses Playwright, which sends real input events. In a web view it becomes a script injected into the page: setting values through the native setter and dispatching input events, and synthetic clicks and key presses.
- **Calling Claude:** from a Candid API route (a Vercel function), with the API key on the server. The route receives page structure and tool calls only, never profile values.
- **The profile:** stored on the device in the platform's secure storage, not a JSON file.
- **The local HTTP server** (`127.0.0.1:5287`) goes; the agent runs in the app itself.

### Risks
- **Less reliable typing.** Injected events are marked as synthetic, and some masked fields and keyboard-only lists ignore them. Expect a few providers to need a hand-over for one field.
- **Providers that block in-app web views,** or send the ID check to their own app. Those fall back to the prepared hand-off (section 5).
- **App store review** of a shell around a web app, and of an app that fills in third-party forms **(verify)**.
- **Provider terms** on automated access to their sites **(verify per provider)**.

### Work items
- [ ] Decide on the native shell (Capacitor is the default: it keeps the React code).
- [ ] Ship the shell with the current web app inside it, unchanged, to TestFlight and Android internal testing.
- [ ] Port `browser.js` to an injected script; rerun `browser.check.js`'s cases against it in a web view.
- [ ] Move the agent loop into the app; add the Candid API route for Claude, with rate limiting and sign-in.
- [ ] Move the profile to secure device storage, with export and delete.
- [ ] Build the hidden web view with the slide-up sheet and the Watch button.
- [ ] Supervised runs on 5 to 10 real providers, using the run logs to fix failures.
- [ ] Compliance view on section 7 before any user other than the founder uses it.

## 5. App-only providers (for example, a Trading 212 Cash ISA)

**An agent can't operate another app on a phone.** iOS doesn't allow it. Android technically allows it through accessibility services, but Play Store policy restricts that, and it would be fragile. So for app-only providers, Candid prepares the user and hands over.

### The prepared hand-off
Assist already stores each provider's iOS and Android app links (`appOnly`, `iosAppUrl`, `androidAppUrl` in `src/lib/assist.js`). Build on that:
- **A "your answers" sheet**, built from the user's profile in the order that provider's app asks, with a copy button on each answer.
- **The amount, and which of the user's accounts it comes from,** as the Cash walkthrough already shows.
- **One button** that opens the provider's app, or its store page if it isn't installed.
- **On return,** "I've opened it" updates Candid, as the walkthrough's "Update Candid to match" does now.
- **Bank details** follow the same rule as the agent: never stored by Candid.

This works in the current web app, with no native shell.

### Around it
- **Check for a web sign-up first.** Some providers that look app-only also open accounts on the web. Those can use the agent instead **(verify per provider; Trading 212 included)**.
- **Funding can still happen behind the scenes.** Once the account is open, the Open Banking payment work (`agentic-cash-workplan.md` phases 1 and 2) can move the money from the user's bank into it, if the provider accepts bank transfers in **(verify for each app-only provider)**.
- **Each provider's question order** is curated by hand, with a "last checked" date, as the rate feed's hand-kept providers are.

### Work items
- [ ] List the app-only providers in the rate feed and check each for a web sign-up.
- [ ] Record each one's application questions, in order, with a "last checked" date.
- [ ] Build the answers sheet with copy buttons, the open-app button and the return step.
- [ ] Check which accept bank transfers in, for Open Banking funding later.

## 6. Long term: a savings platform partnership

Option C in section 3. One identity check, then accounts open and money moves between banks through the platform's own systems. This is the only route where opening an account is genuinely behind the scenes for every provider on the platform. It's already in `agentic-cash-workplan.md` section 3, deferred until there's a product to show. The in-app agent (section 4) is that product.

## 7. Questions for the compliance consultant

Add these to the consultant session in `agentic-cash-workplan.md` section 2:
- [ ] Can Candid fill in an application with the provider's page hidden, as long as the user sees and does the ID check, password and declarations themselves?
- [ ] Is a declaration the user ticks on the provider's real page, inside Candid's app, theirs, or does Candid need to show the statements itself?
- [ ] Does filling applications on the user's instruction need permissions, or an appointed representative arrangement?
- [ ] Provider terms on automated access, and whether to ask the launch providers directly.
- [ ] Holding sort code and account number in memory for one form, never stored: anything to add under data protection rules?

**Fixed, whatever the answers:** Candid never relays passwords or one-time codes, and never ticks a declaration, terms or consent on the user's behalf.

## 8. Sequence

| Step | Item | Depends on |
|---|---|---|
| 1 | Prepared hand-off for app-only providers (section 5) | Nothing: works in the current web app |
| 2 | Compliance questions (section 7) | The consultant session already planned |
| 3 | Native shell with the web app unchanged | A decision on Capacitor |
| 4 | Agent ported into the app, hidden web view, slide-up sheet (section 4) | Steps 2 and 3 |
| 5 | Supervised runs on real providers; fix from run logs | Step 4 |
| 6 | Open Banking funding into opened accounts | `agentic-cash-workplan.md` phases 1 and 2 |
| 7 | Savings platform partnership (section 6) | A working in-app agent to show |
