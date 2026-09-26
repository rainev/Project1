---
name: refuse-with-a-field-error
description: A hook's { deny } reaches FormScreen as the bare word "forbidden"; throw ValidationFailure to put the reason on the field
metadata: { type: gotcha }
---
`app/hooks/batch.ts` first refused an overlapping batch with `{ deny: 'area … is taken …' }`. The
API's `detail` carried the reason, but the form showed only **forbidden**, so staff could not tell
why a batch would not save.

**How to apply:** throw `new ValidationFailure([{ path: '/<field>', keyword: 'farm', message }])`
from the hook. The form and the row dialogs then show the message under that field, with a 422.
The class is imported from `../../.app-stack/packages/core/src/errors.ts` so that `instanceof`
matches the framework's copy. It is a read-only import; nothing in `.app-stack/` is edited.

Two related facts:
- A hook path is resolved from `app/config/`, so `app/hooks/batch.ts` is `../hooks/batch.ts#…`.
- Hooks run **after** validation and the field-write gate (`engine/execute.ts`), so a `patch` may
  set `readOnly` derived fields.
