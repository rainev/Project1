---
name: grid-dialog-covered-on-phone
description: At phone width a DataGrid row dialog opens under the grid's pinned actions column, which visually covers Confirm
metadata: { type: gotcha }
---
At 390px the row-action dialog's Confirm button is painted beneath the grid's sticky actions
column (screenshot, 2026-09-26). `elementFromPoint` still reports the button on top, so an
automated click passes while a person sees no button. Do not trust the click alone: look at a
viewport screenshot.

**How to apply:** for the steps staff record on a phone, put a `FormScreen` with `op: <transition>`,
`id: $id` and `when: { state: … }` on the record's detail page. It posts `/v0/<transition>/<model>/<id>`
and shows only in the stage that admits it. Framework fix: see `docs/plans/PRODUCTION-BACKLOG.md`.
