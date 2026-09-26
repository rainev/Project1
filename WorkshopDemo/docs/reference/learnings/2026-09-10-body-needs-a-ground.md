---
name: body-needs-a-ground
description: Styling only the app shell leaves `<body>` transparent, which breaks theming and makes contrast unmeasurable
metadata: { type: feedback }
---
The app shell carried `bg-canvas`, but `<body>` itself had no background or colour. Visually it looked
fine. Two things were quietly broken:

- `getComputedStyle(document.body).backgroundColor` is `rgba(0, 0, 0, 0)`, so **any contrast check
  against the page ground is meaningless** — it compares against transparent black.
- The page borrows whatever ground the host provides, so a themed app can render on an unexpected
  background outside its own shell.

**How to apply:** set `body { background-color: var(--color-canvas); color: var(--color-ink); }` from
the same tokens the components use. Then a single token change re-themes everything, and contrast is
measurable — both are now asserted in the browser gate.
