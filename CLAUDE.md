## Design Language & UI Rules

1. **Persistent Navigation:** Every page (Homepage, Dashboard, Modules) must share the identical `<Header>` component featuring the "Candid" wordmark + current page label.
2. **Zero Emoji Policy:** Never use emojis in copy, buttons, headers, or icons. Use text labels or a single unified SVG icon set (e.g., Lucide React configured consistently).
3. **Surface Variety:** Do NOT default to wrapping every section in a white rounded border card (`rounded-xl border shadow-sm`). Reserve card containers strictly for discrete, interactive components (e.g., forms, actionable modules). Use whitespace, section backgrounds, or plain `<hr />` dividers for general content.
4. **Single State Indicator:** Every piece of state (e.g., Status, Completion, Progress) gets ONE visual indicator on screen. Eliminate redundant badges or secondary icons repeating the same status.
5. **Editorial Serif Figures:** All prominent numeric metrics (headline £ amounts, scores, key stats) must use the display serif font (`font-serif`, mapped to Georgia or Playfair Display). All supporting text, labels, and UI chrome remain sans-serif.
