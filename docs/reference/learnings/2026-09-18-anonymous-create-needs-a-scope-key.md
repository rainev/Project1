---
name: anonymous-create-needs-a-scope-key
description: A create whose x-scope resolves to nothing is refused as "refusing an unscoped query"; an anonymous create must be bound by some key, because orgId resolves null for a visitor
metadata: { type: gotcha }
---
An anonymous create returned 500 and the log said

```
error: participant: refusing an unscoped query
  at #assertScoped (packages/core/src/db/adapter.ts:301)
```

`resolveScope` drops a null, so `orgId: "'anonymous' in actor.roles ? null : actor.orgId"` binds
nothing for a visitor. With no other key that resolves on `create`, the scope was `{}` and the
adapter refused rather than write an unscoped row. The message names neither `create` nor the
resolution, so it reads as an adapter fault rather than a config one.

This is what `enquiry`'s `handled: false` is doing. Its comment calls it "both a valid scope and the
right initial value", which reads as convenience; the scope half is load-bearing, and removing it
breaks every anonymous create on the model.

The lifecycle field cannot serve as that key. `x-states` owns it, so it is set from `initial` and a
scope that wrote it would be writing a framework-owned column.

**How to apply:** when a model admits an anonymous `create`, give `x-scope` one key that resolves on
create and names what the visitor is permitted to do. `participant` binds
`workshopDate: "'anonymous' in actor.roles && op == 'create' ? '2026-09-26' : null"`, which is the
cohort they may register for. Pair it with the `createdAt: ''` branch that keeps every other
operation empty, per [[2026-09-18-anonymous-create-needs-a-scope-key]]'s sibling pattern in
`apps/showcase/config/models/enquiry.yaml`.
