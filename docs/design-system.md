# Candid design system: app components

The app's controls live in `src/mobile/ui/` and are built on the scales in `src/design-tokens.js`. See every one, in each state, at `http://localhost:5173/dev/ui-kit` (dev only).

Agreed 10 Nov 2026. Screens move over a module at a time; this doc says what new code uses.

## Rules

1. **No hand-built buttons, switches, chips, fields or sheets in new code.** Use the component. If it can't do what's needed, add a variant to the component, not a local style.
2. **Every button is 37px** with 13px words (`BUTTON_HEIGHT`; Harvey, 10 Nov 2026: 44px felt too tall), and keeps a 44px tap area. Fields (£, drop-down, text) stay 44px (`PILL_HEIGHT`), or 37px with `size="compact"`.
3. **One disabled look** (`DISABLED_OPACITY`, 0.4) and **one press feedback** (`PRESS_SCALE`, 0.97 on buttons). Loading shows words ("Saving…"), not a spinner.
4. **One primary button per view.** Blue (`variant="blue"`) is for the paywall and invites only.
5. **On/off is a Switch; a choice between named options is a Segmented.** A two-way choice ("Relief at source / Salary sacrifice") is never drawn as a switch.
6. **Every animation respects reduced motion.** The components already do.
7. Everything else in CLAUDE.md's Design Language still applies: no emoji, serif only for the headline £, cards only for things you act on.

## Which component

| Need | Use | Notes |
|---|---|---|
| An action | `Button` | `variant` primary, secondary, text (`blue` = primary in blue); `tone` green, blue (paywall and invites only) or danger (deleting for good); one height (37px); `loading`, `icon`, `fullWidth`. `buttonStyle()` for an `<a>` |
| Close, back, more | `IconButton` | `label` required; 34px, or 28px inside a tile |
| On/off setting | `Switch`, `SwitchRow` | `SwitchRow` in a white grouped list (Account) |
| Pick one of 2 to 4 | `Segmented` | `size="compact"` inside a tile, `onDark` on the green band |
| Answer to a form question, one of a few | `PillSlider` | Same look as Segmented, with field states |
| Toggle filter or quick pick | `Chip` with `pressed` | Without `pressed`: a small action |
| Status label (not tapped) | `Tag` | `color` a hex token; caps on a pale wash |
| £ or % amount | `PillMoneyInput` | |
| Drop-down | `Select` | Native picker on phones; `state` and `size` |
| Email, name, code | `TextField` | Label, hint, error wired for screen readers |
| Year, a long list | `YearPicker`, `WheelPicker` | |
| Bottom sheet | `Sheet` + `SheetHeader` | Drag to close, focus, scroll lock and Escape built in |
| A tile | `MobileTile` (`src/mobile/MobileTile.jsx`), `CardStack` | Unchanged |
| Celebration | `fireConfetti(el)` | Milestones only |
| A rolling £ figure | `AnimatedCounter` | |
| Standout tile edge | `ShineBorder` | The one hero tile on a screen, at most |
| Ticked list | `TaskList` | |
| Remove something | `DeleteButton` | Asks before deleting |
| Fade under an edge | `ProgressiveBlur` | |

Import from the folder: `import { Button, Sheet, SheetHeader } from "../ui";` (adjust the path).

## Scales (`src/design-tokens.js`)

- `SPACE`: 2, 4, 8, 12, 16, 20, 24, 32px (`xxs` to `xxxl`). 6px and 10px are allowed in between.
- `RADIUS`: `pill` 100px, `sheet` 22px, `hero` 18px, `tile` 14px, `control` 12px, `small` 8px.
- `CONTROL_HEIGHT`: `default` 44px, `compact` 37px. `BUTTON_HEIGHT` is the compact one.
- `SHADOW`: `tile`, `raised`, `popover`, `knob`. Always green-tinted, never black.
- `Z`: tab bar 4000, goal 4100, Assist button 4500, sheet 4600, overlay 4700, Assist 4900, sign-in 6000.

## Credits

`AnimatedCounter`, `DeleteButton` and `TaskList` are ported from Rare UI (https://rareui.com). Its licence requires the credit in Account > Legal documents and the notice at the top of each file; keep both. `Confetti`, `ShineBorder` and `ProgressiveBlur` are from Magic UI (MIT).

## Moving a screen over

1. Swap the local `pill`, `button`, `link` and `Switch` helpers for the components, then delete the helpers.
2. Screenshot the screen at 390px before and after.
3. Harvey checks it on localhost before it's committed.

Order: Account and Premium (pilot), then the deep dives, PaydayCheck and PayCheckCard, BankConfirm and OpportunityChoice, onboarding and chat starts, Assist, then the rest.
