---
name: board-screen-cannot-send-requirements
description: BoardScreen sorts lanes by `title` and its move buttons send no payload, so any transition with `require` fails from a card
metadata: { type: gotcha }
---
Seen 2026-09-26 in App-Stack 1.7.0:
- **`title` is hard-coded.** Each lane lists `sort=title`, so a model without a `title` field gets
  `400 "title" is not a sortable field` and an empty board. The undocumented `titleField` prop
  changes nothing. This is why `batch` names its lot code `title`.
- **No payload.** A card's move button posts the transition with nothing in it, and every batch
  step requires a count, so each one was refused with
  `check: must have required property 'germinatedCells'`.

**How to apply:** use a `Tabs` of `DataGrid`s with `filter: { status: <state> }`. Grid `rowActions`
open a dialog built from the transition's `require`. Tab children go under the `Tabs` node's own
`children`, each with a `slot:`; placed beside it, they render nothing. A framework fix (a
dialog on board moves) is in `docs/plans/PRODUCTION-BACKLOG.md`.
