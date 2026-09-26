# Derived schemas

The base schema in a model file is never used to validate anything. The framework mints a **plain,
standard JSON Schema per operation and per actor** and validates against that. `x-require` is
therefore the *source* of standard `required` rather than a competing keyword, and the same document
that Ajv validates is the one a JSON Schema form renderer renders.

That single derivation is what lets the server be authoritative and the form be accurate at the same
time: there is no client copy of the rules to drift.

## `deriveSchema`

`deriveSchema(model, op, { readable, writable, row })` (`packages/core/src/schema.ts`):

1. **Copy each property through an allowlist.** `PUBLIC_KEYWORDS` (`schema.ts:46`) is the complete
   set of keywords that may reach a client — `type`, `format`, `enum`, `const`, the string, number
   and array facets, `title`, `description`, `default`, `examples`, `readOnly`, `writeOnly`. A
   keyword absent from that list is absent from the wire. It is an allowlist on purpose: the
   previous shape copied everything and skipped `x-`-prefixed keys, which holds only while every
   framework keyword happens to be `x-` prefixed and leaks the first time one is not (§19).
2. **Drop what this actor may not read.** An unreadable property is *absent*, not nulled.
3. **Mark what this actor may not write** `readOnly: true` — a field their policy denies, and the
   **lifecycle field** of a model that declares `x-states`, which no operation accepts in a payload
   ([02-models.md](02-models.md)). `FormScreen` does not submit a `readOnly` property, so a form
   never sends a value the server would refuse.
4. **Inject `required`** from `requirementSet(model, op, row)`: `x-require[op]` — or the
   transition's own `require` ([02-models.md](02-models.md)) — falling back to `x-require.create`
   **only for `create`**. `update` therefore has no `required` at all — PATCH semantics, because a
   partial update is not an incomplete record. **With a `row`, a requirement the stored row already
   satisfies is dropped**: that is §5's state axis, and it is why "a note may only be finished once
   it has a customer" is one rule whether the customer arrives with this request or an earlier one.
5. **Force `minLength: 1` on required strings** that declare no `minLength`. A required string with
   no minimum is satisfied by `""`, which is never what an author means by "required" — the same
   stance the secret resolver takes: empty is missing.

The result always carries `additionalProperties: false` and `$id: <model>.<op>`.

## Reading it over the wire

`GET /v0/schema/<model>?op=<op>` returns the actor's own schema. `op` defaults to `create`.
`GET /v0/schema/<model>/<id>?op=<op>` returns the one for **that row** — an ordinary scoped read, so
another tenant's id is a `404`, and the phase-two gate runs before the row informs anything. Live:

```text
POST /v0/finish/note/$ID  {}                → 422 [{"path":"/customerId","keyword":"required",…}]
GET  /v0/schema/note/$ID?op=finish          → {"$id":"note.finish","required":["customerId"], …}
GET  /v0/schema/note/$WITH_CUSTOMER?op=finish → {"$id":"note.finish", …}   # no `required` key
POST /v0/finish/note/$WITH_CUSTOMER  {}     → 200 {"status":"done", …}
```

As **admin**, `note` at `op=create` — eleven properties, `required: ["title"]`, and `title` has picked
up `minLength: 1` it never declared:

```json
{ "$id": "note.create", "type": "object", "additionalProperties": false,
  "properties": {
    "reason":     { "type": "string", "minLength": 1 },
    "title":      { "type": "string", "maxLength": 120, "minLength": 1 },
    "body":       { "type": "string" },
    "pinned":     { "type": "boolean" },
    "status":     { "type": "string", "enum": ["todo", "doing", "done"], "readOnly": true },
    "priority":   { "type": "string", "enum": ["low", "normal", "high"] },
    "customerId": { "type": "string", "title": "Customer" },
    "adminOnlyNote":    { "type": "string" },
    "searchableSecret": { "type": "string" },
    "attachment": { "type": "string", "format": "binary" },
    "draftNote":  { "type": "string" }
  },
  "required": ["title"] }
```

Three things that document does **not** contain, though the model declares them: `x-lookup` on
`customerId`, `x-encrypt` on `adminOnlyNote` and `searchableSecret`, `x-transient` on `reason` and
`draftNote`. The allowlist stopped all of them. What survives from `customerId` is `title:
"Customer"` — standard JSON Schema, which is how the form gets a label instead of deriving
"Customer Id" from the property name.

`status` carries `readOnly: true` for every actor and every operation: `note` declares `x-states`,
so that field moves through a transition and no other way ([02-models.md](02-models.md)). `priority`
is an ordinary enum beside it and carries no such mark — the contrast is the point.

The same request as **staff** returns ten properties: `adminOnlyNote` is gone, because
`x-field-access.adminOnlyNote.read` names `admin`. On `customer`, staff loses `reference` the same
way. The property is absent, so a form cannot render it and a response cannot carry it.

An **action** gets its own requirement set. `op=pin` returns `required: ["reason"]` — and `title`
loses the `minLength: 1` it had under `create`, because that was injected by the requirement, not
declared:

```json
{ "$id": "note.pin", "required": ["reason"], "properties": { "reason": { "type": "string", "minLength": 1 }, … } }
```

`op=update` returns **no `required` key at all**.

## Validation and its error shape

`validate(model, op, data)` (`schema.ts:125`) runs the compiled validator and maps Ajv's errors to
`{ path, keyword, message }`, where `path` is a **JSON Pointer** — which is how form renderers
address a control, so an error can be attached to the field that caused it rather than to the form.

Live, against the showcase:

| Request | Response |
|---|---|
| `POST /v0/create/note {"body":"x"}` | `422 {"error":"validation_failed","errors":[{"path":"/title","keyword":"required","message":"must have required property 'title'"}]}` |
| `POST /v0/create/note {"title":""}` | `422 … [{"path":"/title","keyword":"minLength","message":"must NOT have fewer than 1 characters"}]` |
| `POST /v0/create/note {"title":"ok","nope":1}` | `422 … [{"path":"/","keyword":"additionalProperties","message":"must NOT have additional properties"}]` |

The second of those is the `minLength: 1` injection doing its job: `note.title` declares only
`maxLength: 120`, and an empty title is still refused.

## Caching

Validators are cached in a `WeakMap` keyed by the **`Model` object**, not by its name
(`schema.ts:34`), then by op. A name-keyed cache would make two models sharing an `$id` share a
compiled validator. That is impossible inside one app — `loadModels` rejects duplicates — but not
across two `createApp` instances in one process, and the consequence would be one app validating
against another's schema: with `additionalProperties: false` that both rejects valid fields and
admits foreign ones. `gates.ts` and `handlers/declare.ts` key their caches the same way for the same
reason.

Validation uses the **full** property set, not the actor-projected one. An unwritable field is a
policy decision made by the gate, not a shape error — see [05-gates.md](05-gates.md).

## Limits worth knowing

- **The state axis reads presence, not values.** `deriveSchema(model, op, { row })` drops a
  requirement the stored row already carries, which is how "a note may only be finished once it has a
  customer" is expressed (AUD-005, closed by WP-06). Empty is missing: `null`, `undefined` and `""`
  all leave the requirement standing. A rule about a value — "only while the total is under 100" —
  is a gate expression, not a requirement set.
- **A row only reaches it where there is one.** `GET /v0/schema/<model>?op=<op>` has no row and
  therefore carries the whole set; `GET /v0/schema/<model>/<id>?op=<op>` carries that row's.
- **An unknown `op` does not fail.** `?op=nonsense` returns a schema named `note.nonsense` with no
  `required`, because `requirementSet` falls back to an empty set. Filed as a papercut in
  `docs/plans/PRODUCTION-BACKLOG.md`; it grants nothing, since the gate — not the schema route —
  decides whether an operation may run.
- **Field policy is evaluated per request.** The schema an actor fetches and the schema the server
  validates their write against are derived from the same expressions at the same moment.

## How to verify this layer

```sh
# as admin
curl -s -b cookies.txt 'localhost:3000/v0/schema/note?op=create' | jq '.data.required, (.data.properties|keys)'
# as staff — adminOnlyNote is absent
curl -s -b staff.txt  'localhost:3000/v0/schema/note?op=create' | jq '.data.properties|has("adminOnlyNote")'
# the requirement set moves with the op
curl -s -b cookies.txt 'localhost:3000/v0/schema/note?op=pin'    | jq '.data.required'
```

Unit coverage: `packages/core/test/gates-schema.test.ts` (`projects per role: unreadable absent,
unwritable readOnly`). The reference app declares no field that is readable but not writable, so the
`readOnly` branch is proven by that test rather than by a showcase screen.

## Related

[02-models.md](02-models.md) · [05-gates.md](05-gates.md) · [12-forms.md](12-forms.md) ·
`ARCHITECTURE.md` §5, §19

---

_Checked against the code 2026-09-16_ — `packages/core/src/schema.ts`, `model.ts`, `gates.ts`,
`engine/execute.ts`, `http/intake.ts`, `apps/showcase/config/models/note.yaml`,
`apps/showcase/config/models/customer.yaml`. Every request and response above was run against
`bun run dev` on port 3000 and pasted from its output.
