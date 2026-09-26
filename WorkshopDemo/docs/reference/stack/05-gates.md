# Gates

Three gates, evaluated in one place, **deny by default**. They are the reason a model can be nothing
but a declaration: authorization is not something each operation implements, it is something the
engine applies before any operation runs.

| Gate | Keyword | Question | Answer shape |
|---|---|---|---|
| Access | `x-access` | May this actor do this at all? | A boolean expression |
| Scope | `x-scope` | Which rows is this actor's world? | **Values** bound into every statement |
| Field | `x-field-access` | Which fields may they read, which may they write? | A boolean expression per field, per direction |

All three are JEXL, compiled once at boot (`gates.ts:29`) so a broken expression fails startup
rather than a request, and evaluated against frozen plain data.

## The view

Every expression sees the same value, and only this (`gates.ts:56`, `makeView`):

```ts
{
  actor: { id, roles: string[], orgId },   // server-assigned, frozen
  op:    string,                            // 'create', 'list', 'pin', …
  model: { name },
  input: Record<string, unknown>,           // this request's data
  row?:  Record<string, unknown>,           // only in phase two
  now:   string,                            // ISO timestamp
}
```

`Object.freeze` at every level, and plain data throughout: no functions, no transaction, no `call`.
An expression can read what it needs and **cannot do anything**. Declarative hooks use the same
language over the same view plus `id` and `result` — deliberately, so there is one grammar and one
place where "what an expression may do" is decided ([02-models.md](02-models.md)).

`actor.orgId` and `actor.roles` come from the session the server issued. They are not readable from
a request body at any point in the stack, which is what makes `x-scope: { orgId: actor.orgId }` a
tenancy boundary rather than a suggestion.

## Access — deny by default

```yaml
x-access:
  read:  "'admin' in actor.roles || 'staff' in actor.roles"
  write: "'admin' in actor.roles"
```

`allowsAction` (`gates.ts:73`) resolves one of two permissions — `read` for `get`, `list`, `count`,
`aggregate`, `schema` and `query`; `write` for everything else, **including every custom action** —
and refuses unless the expression evaluates to exactly `true`. A missing expression refuses. A
non-boolean result refuses. An expression that throws refuses.

`apps/showcase/config/models/unpoliced.yaml` exists to prove it: it declares no `x-access`, so
nobody can read or write it. Live, as an admin: `GET /v0/list/unpoliced` → `403 forbidden`.

There are exactly two permission names. Per-operation permissions do not exist, so "may this actor
`pin`?" is answered by `write` (AUD-061).

### Two phases

Phase one runs before anything else in the engine, with **no row loaded**. Phase two re-evaluates
the same expressions once a row has been loaded *within scope*, with `row` populated
(`execute.ts:130`):

```yaml
x-access:
  write: "'admin' in actor.roles && row.status != 'locked'"
```

Phase two **narrows and never widens**: reaching it means phase one already allowed the read, and a
caller who fails phase one never gets there. It fires on `update`, `delete`, `get`, a custom action
that names an id, and `schema` when one is named. A refusal there is `403 forbidden_for_this_row`,
distinct from phase one's `forbidden`, so the two are distinguishable in the audit record.

A declared **transition** is decided in the same place, because it asks the same question: is this
legal *for this row*? `x-states.transitions.<name>.from` is checked inside the phase-two gate, on
the row it already loaded, before any hook or handler runs. Its refusal carries the reason rather
than a bare code, because it is a workflow fact about a row the caller may already write:

```text
POST /v0/start/note/$ID   # the row is already `doing`
403 {"error":"forbidden","detail":"\"start\" moves note from todo, but this row is doing"}
```

A transition's own `access` composes with `x-access.write` in `allowsAction` — **both, never
either** — so `restart: { access: "'admin' in actor.roles" }` stops staff reopening a closed note
while leaving every other write they had. Live, as staff: `POST /v0/restart/note/$ID` → `403
forbidden`, and the move is absent from that actor's projection, so a board never offers it.

The ordering is the invariant, not an implementation detail: **no persistence read, hook, render,
export or side effect happens before the gate.** Loading a row to decide whether the caller may load
it is the inversion §16 forbids.

## Scope — values, never predicates

```yaml
x-scope:
  orgId: actor.orgId
```

`resolveScope` (`gates.ts:88`) evaluates each expression to a **value** and hands the map to the
adapter, which binds it into every statement it builds — `SELECT`, `COUNT`, `UPDATE … WHERE`,
`DELETE … WHERE`, the aggregate, the uniqueness probe, the keyset page. An expression yielding
`null` or `undefined` contributes nothing rather than a `NULL` comparison.

They are values and not predicates on purpose. A post-fetch filter would break pagination (a page of
25 becomes a page of 9 after filtering), corrupt counts and aggregates, and leak through any path
that does not remember to apply it. Binding the value into the statement means there is nothing to
remember.

This is why another tenant's id returns `404 not_found` rather than `403`: the scoped read simply
misses, and a miss is not a lie about what exists.

## Field policy — read and write, separately

```yaml
x-field-access:
  adminOnlyNote:
    read:  "'admin' in actor.roles"
    write: "'admin' in actor.roles"
  reference:
    read: "'admin' in actor.roles"      # on customer: readable by admins only
```

**Outbound**, `projectRead` (`gates.ts:132`) drops every field whose `read` expression is not `true`.
It runs on every value that leaves: a `get`, each row of a `list`, the result of a `create`, an
`update` or a custom action, and — through `deriveSchema`'s `readable` predicate — the schema the
form is built from. A field an actor may not read is **absent**, never nulled, so nothing downstream
has to know it exists.

Live: `GET /v0/get/note/<id>` as admin carries `adminOnlyNote`; the same row as staff has no such
key. On `customer`, staff loses `reference` the same way, in a row, in a list and in a report.

**Inbound**, `filterWrite` (`gates.ts:108`) removes every field whose `write` expression is not
`true`, before hooks and before persistence, and the model says what a refusal means:

| `onDenied` | Effect |
|---|---|
| `drop` (default) | The field is dropped, the rest of the write proceeds, and the names are returned in `meta.denied` and recorded in the audit row's `detail` |
| `reject` | The whole request fails `422` naming the field — for a field where silently continuing would be worse than failing. The showcase declares none, so this branch is proven by `packages/core/test/hooks-honesty.test.ts` |

Live, as staff: `POST /v0/create/note {"title":"denied demo","adminOnlyNote":"nope"}` → `201`, a row
with no `adminOnlyNote`, and

```json
"meta": { "requestId": "…", "source": "http", "denied": ["adminOnlyNote"] }
```

with `detail: "denied fields: adminOnlyNote"` in `_audits`. That visibility was itself a finding
(AUD-059): the drop used to be silent, and a caller had to infer it from a 201 and a missing value.

Denied names are collected across the whole request, **including from inside a `ctx.call`** — a
hook's write being trimmed is exactly as invisible as the caller's own.

## Per-row policy without per-row access

A `list` evaluates field policy **per row**, because a `read` expression may mention `row`. It does
**not** re-check access per row. Which rows a caller may see was decided by scope, inside the
statement; dropping rows afterwards is the post-fetch filtering this design rules out.

## The escape hatch is closed

A handler — code or declaration — reaches persistence through `ctx.call`, which re-enters
`execute` and therefore phase one, scope, validation and field policy, on the same transaction and
with the depth cap. A declaration can do nothing the actor who triggered it could not do by hand.

The proof is a fixture: `packages/core/test/hooks-declarative.test.ts` declares an `escalate` action
whose body creates a row on the ungated `unpoliced` model, and asserts it is refused. It used to
live in the showcase's own config; an application should not have to carry the framework's
escalation proof (AUD-048).

## Limits worth knowing

- **Two permissions, not one per op.** `x-access.write` covers every write including custom actions
  (AUD-061).
- **A requirement set now reads `row` too**, but only for presence
  ([03-derived-schemas.md](03-derived-schemas.md), AUD-005 closed by WP-06). A condition over a
  value is still a gate expression.
- **A throwing expression denies.** `allowsAction` catches and refuses — safe, but it means a typo
  that survives boot compilation reads as a policy decision. The transform check and the boot
  compile exist to make that rare.
- **Validation uses the full property set.** An unwritable field is a policy decision made here, not
  a shape error.

## How to verify this layer

Two actors, one row, the same request:

```sh
curl -s -b admin.txt localhost:3000/v0/get/note/$ID | jq '.data | has("adminOnlyNote")'   # true
curl -s -b staff.txt localhost:3000/v0/get/note/$ID | jq '.data | has("adminOnlyNote")'   # false

curl -s -b staff.txt -X POST localhost:3000/v0/create/customer \
  -H 'content-type: application/json' -d '{"name":"Nope"}'        # 403 forbidden
curl -s -b admin.txt localhost:3000/v0/list/unpoliced             # 403 forbidden — no x-access at all
```

A security fix in this layer needs the attack re-run and refused, not a passing test: see
`packages/core/test/two-phase-gate.test.ts`, `gates-schema.test.ts`, `hooks-declarative.test.ts`,
and the cross-tenant features under `scripts/gate/features/`.

## Related

[04-dispatch-and-pipeline.md](04-dispatch-and-pipeline.md) · [02-models.md](02-models.md) ·
[03-derived-schemas.md](03-derived-schemas.md) · `ARCHITECTURE.md` §11, §16, §19, §22

---

_Checked against the code 2026-09-16_ — `packages/core/src/gates.ts`, `expressions.ts`,
`engine/execute.ts`, `http/intake.ts`, `schema.ts`, `apps/showcase/config/models/`. Every status and
body quoted above was produced against `bun run dev` on port 3000.
