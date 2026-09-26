# Models

A model is one YAML document: a JSON Schema object plus `x-` keywords. It is the only place a
resource is described. The table, the API surface, the gates, the validation schemas, the audit
record and the UI facts are all derived from it — there is no second declaration to keep in step.

```yaml
$id: note                 # the model name, and the default table name
type: object
properties:
  title: { type: string, maxLength: 120 }
x-storage: { table: notes, notNull: [title] }
x-require: { create: [title] }
x-access:
  read: "'admin' in actor.roles || 'staff' in actor.roles"
  write: "'admin' in actor.roles"
x-scope: { orgId: actor.orgId }
```

`apps/showcase/config/models/note.yaml` is the worked example this document quotes throughout; it
exercises every keyword below.

## The document

`META_SCHEMA` (`packages/core/src/model.ts:119`) is closed — `additionalProperties: false` at the
document level and again per property. A keyword nothing consumes fails at boot rather than loading
silently, which is how a typo stops being a feature that quietly does nothing.

| Key | Required | Meaning |
|---|---|---|
| `$id` | ✔ | Model name. Must match `^[A-Za-z_][A-Za-z0-9_]*$`. Unique across the family |
| `type` | ✔ | Always the constant `object` |
| `properties` | ✔ | At least one. Each is a property definition (below) |
| `$schema`, `title`, `description` | | Carried, unused by the compiler |
| `required` | | Admitted **only so the compiler can refuse it** with a message naming `x-require` |
| `x-storage` | | `table`, `notNull`, `migrations` |
| `x-require` | | Operation → field names that become `required` in that operation's derived schema |
| `x-access` | | Permission → JEXL expression. Only `read` and `write` are consulted |
| `x-scope` | | Column → JEXL expression yielding a **value** bound into every query |
| `x-field-access` | | Field → `{ read, write, onDenied }` |
| `x-unique` | | Fields unique within the query scope |
| `x-query` | | `sortable` / `filterable` allowlists |
| `x-hooks` | | Lifecycle point → handlers, in declaration order |
| `x-actions` | | Custom operation name → its handler |
| `x-states` | | The record's lifecycle: `field`, `initial`, and a named `transitions` map |
| `x-events` | | Event name → handlers that run **after** the causing transaction commits |
| `x-schedules` | | Recurring work: an interval, an operation, and the authority it runs with |
| `x-guards` | | Capacity limits: a named, scoped count with a ceiling that refuses a write past it |

### A property

| Key | Meaning |
|---|---|
| `type` | **Required.** One of `string`, `number`, `integer`, `boolean`. Arrays and objects are refused at boot, deliberately (AUD-021) |
| `format` | Standard JSON Schema; `binary` marks an upload |
| Public JSON Schema keywords | `enum`, `const`, `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`, `items`, `minItems`, `maxItems`, `uniqueItems`, `title`, `description`, `default`, `examples`, `readOnly`, `writeOnly` — the `PUBLIC_KEYWORDS` set (`schema.ts:46`), which is also exactly what reaches the client |
| `x-dispatch` | `read` — generic dispatch may read this model and may not write it. The framework's `user` declares it: its writes are on the `/v0/auth/` routes, each re-deriving the actor, and `roles` is a writable column, so an ordinary `update` carrying it would be privilege escalation through the one door |
| `x-transient` | Accepted by the API, never persisted. `note.reason` is transient: an action requires it, no column holds it |
| `x-internal` | Persisted, and never read. The inverse of `x-transient`: a password hash, a token hash, an API key. Absent from every derived schema, dropped from every response, and unnameable in a query, a view, an `x-query` list or an `x-lookup` label. **Not policy** — `x-field-access` is an expression the app owns, so nothing an app writes can grant an internal field |
| `x-encrypt` | `true`, or `{ search: exact }` for a blind index |
| `x-lookup` | `{ model, label }` — a reference to another model's row |
| `x-upload` | `{ accept, maxSize }` — requires `format: binary` |

Four property names are framework-owned and may never be declared: **`id`, `orgId`, `createdAt`,
`updatedAt`** (`config/system-fields.ts`).

## What compilation derives

`compileModel` (`model.ts:273`) returns a typed `Model`. The fields worth knowing, because the rest
of the framework reads them rather than the YAML:

| Derived | From |
|---|---|
| `columns` | Declared properties minus transient ones, plus a `<field>_bidx` shadow column for every `x-encrypt: {search: exact}` field |
| `notNull` | `x-storage.notNull`, checked against `columns` |
| `sortable` | `x-query.sortable`, or by default every **plaintext** column plus `createdAt`, `updatedAt`, `id` |
| `filterable` | `x-query.filterable`, or by default every plaintext column — **plus `id` and every lookup field, always**, whatever the author wrote, plus each blind-index shadow column |
| `require` | `x-require`, keyed by operation |
| `access`, `scope`, `fieldAccess` | The raw expressions; `compileGates` compiles them at boot |
| `unique`, `encrypted`, `lookups`, `uploads`, `hooks`, `actions`, `migrations` | The corresponding keyword |
| `schema` | The raw document, which `deriveSchema` projects per actor and operation |

Encrypted columns are opaque to the database, so they are **not** sortable or filterable by default;
naming one explicitly is a boot error unless it carries a blind index. `id` and every lookup field
are force-added to `filterable` because both are opaque identifiers whose only use is equality —
resolving a relation fetches a known set in one call, and "notes for this customer" is the entire
point of having a relation. Sorting is not force-added.

## Relations — `x-lookup`

```yaml
customerId:
  type: string
  title: Customer
  x-lookup: { model: customer, label: name }
```

The field stores a plain id. **There is no join.** The picker and the label both resolve through
generic dispatch, so the referenced model's own gates and scope apply — a relation cannot be used to
see something you may not read. `label` defaults to `id` and must be a plaintext column (or a system
field) of the target model.

## Encryption — `x-encrypt`

`true` seals the value; `{ search: exact }` also maintains a framework-owned `<field>_bidx` shadow
column carrying a blind index, which is what makes equality search and uniqueness possible over
ciphertext. Encrypted fields must be `type: string` and must not be transient. See
[07-encryption.md](07-encryption.md).

## Uploads — `x-upload`

Requires `format: binary`. `accept` is a list of media types; `maxSize` is `digits` + `B|KB|MB|GB`.
A declared size always wins; `UPLOAD_DEFAULT_MAX_SIZE` (50MB) answers only for a property that
declared none. See [08-files.md](08-files.md).

## Behaviour — `x-hooks` and `x-actions`

A handler is either a `path#namedExport` reference to code or a **declaration** the framework runs
itself. The engine cannot tell which it got, which is what stops "declarative" from becoming a
second execution path with its own security posture. A declaration is *not* trusted code: every
operation it performs goes back through `ctx.call` and therefore through the gates.

Five declared forms (`handlers/declare.ts`):

| Form | Shape | Notes |
|---|---|---|
| `call` | `{ op, model, id?, data? }` | One operation through `ctx.call`. Omit `id` for `create` |
| `batch` | `[ call, … ]` | Several, in order, in the same transaction — never partial |
| `set` | `{ field: value, … }` | Patch the pending write (or the result, after commit). Only fields of the owning model |
| `deny` | `{ when, reason }` | Refuse when the condition holds |
| `skip` | `{ when }` | Stop the rest of this point's chain |

In `set` and in a call's `data`, **a string is an expression, never a literal** — `"'todo'"` is the
literal string `todo`, `input.status` reads the payload. Booleans, numbers and `null` are taken
literally. An expression yielding `undefined` writes nothing; a literal `null` is an instruction.

The expression language is JEXL over the declaration view — `actor`, `op`, `model`, `input`, `row`,
`now`, plus `id`, plus `result` after commit — the same language the gates use. Three transforms
exist: **`trim`, `collapseWhitespace`, `lower`** (`expressions.ts:32`). An unknown transform is a
boot error naming the available ones, because JEXL resolves transforms at evaluation time and would
otherwise throw on the first request that reached it.

**Hook points.** `before`/`after` × `create`, `update`, `delete`, and × every declared action —
`beforeCreate`, `afterPin`, and so on (`ops.ts`). **There are no hooks around reads.** A point that
is never fired is a boot error, because the file and the export both resolve at boot, so an unfired
hook looks wired and is silent forever.

**Actions** must be `call`, `batch`, or a `path#namedExport`: an action *is* the operation and must
produce a result, so `set`, `deny` and `skip` are refused there. An action is a **write** as far as
`x-access` is concerned.

## Lifecycle — `x-states`

```yaml
x-states:
  field: status           # a plaintext `type: string` property carrying an `enum`
  initial: todo           # what a row is created in when the caller names no state
  transitions:
    start:  { from: [todo],  to: doing }
    finish: { from: [doing], to: done, require: [customerId] }
    restart: { from: [done], to: todo, access: "'admin' in actor.roles" }
```

**A transition is a custom action.** The compiler synthesises exactly the `call` declaration an
author would otherwise have written — `x-actions.start: { call: { op: update, model: note, id: id,
data: { status: "'doing'" } } }` — so `POST /v0/start/note/<id>` is an ordinary write on the generic
surface, with `before<Name>`/`after<Name>` hook points and `x-access.write` like any other. There is
no second dispatcher and no second grammar.

Three things the engine consults by name:

| Key | Read by | Meaning |
|---|---|---|
| `from` | the **phase-two gate** (`engine/execute.ts`, `withRow`) | The move is legal only from these states. A refusal is a 403 whose `detail` names the legal states and the one the row is actually in |
| `require` | `deriveSchema` | Fields that must be on the row **once the move is done** — satisfied by the stored row or by the payload. This is §5's state axis ([03-derived-schemas.md](03-derived-schemas.md)) |
| `access` | `allowsAction` | Narrows `x-access.write` for this move alone. Required **as well**, never instead: a transition can never widen who may write |

**The state field belongs to the lifecycle.** Once `x-states` names it, it is framework-owned in the
same sense `id` and `orgId` are: writing it through `create`, `update` or any non-transition action
is a `422` naming the field and listing the moves that exist.

```text
POST /v0/update/note/<id> {"status":"todo"}
422 {"errors":[{"path":"/status","keyword":"state",
     "message":"\"status\" changes only through a transition — start, finish, restart"}]}
```

That refusal is the whole point of the keyword, not a nicety. A transition carries `from`, `require`
and `access`; a plain `update` carries none of them and is gated only by `x-access.write`. So before
this existed, a transition's `access` was worth exactly as much as the weakest way to write the same
column — and there is always an update path. Found live on the showcase: `restart` was admin-only
and the `reopen` action moved the same field through `update`, so staff were refused one and
allowed the other.

It is enforced in the framework rather than per model with `x-field-access` because every lifecycle
would otherwise have to remember, and one that forgot would look identical to one that had decided
not to. It is a refusal and not a silent drop, because dropping it would answer `200` while doing
something else. A transition authorises exactly one write — this model, this row, this target state
— for the length of its own handler, so neither a hook on that action nor a sibling in the same
batch can borrow it.

The derived schema marks the field `readOnly`, which is the same word the framework already uses for
"you may see this and may not write it", so a form renders it without offering an input and
`FormScreen` leaves it out of the payload.

The initial state is assigned **after** the write gate, because it is the framework's value like the
minted id — an actor who may not write the state field still gets a row in the initial state; what
they cannot do is choose which one. A `require` field is forwarded from the payload into the write,
because a requirement a caller can satisfy whose value is then discarded would be a lie.

`x-require` may not name a transition: its requirements are declared once, on the transition.

## After the commit — `x-events`

```yaml
x-events:
  # A declaration, run as the actor who caused the event.
  note.finish:
    - call: { op: pin, model: note, id: input.id, data: { reason: "'finished'" } }
  # Or code, for the case a declaration is deliberately not trying to reach.
  note.start:
    - ./hooks/note.ts#announceStart
```

Same grammar as `x-hooks`, same registry, same boot binding — a missing file or
export fails startup. What differs is **when**, and what a failure means:

| | `x-hooks` | `x-events` |
|---|---|---|
| Runs | inside the operation's transaction | after that transaction has committed |
| A failure | rolls the request back | retries; the write is already durable |
| Ordering | before/after one operation | at-least-once, eventually |

A key is `<model>.<event>`, because an event is something that happened to a row
of a model and a listener may live on a different model. Both halves are checked
at boot: the model must exist, and the event must be something that model
actually emits — `created`, `updated`, `deleted`, or one of its **actions**
(which includes every transition, since a transition is an action). A listener
bound to an event nothing fires is refused for the same reason a hook bound to
an unfired point is.

**An event nobody listens for is never written.** A row in `_outbox` per create
in the system, so that a worker could discover there is nothing to do, is cost
with no consumer. `ctx.emit(name, payload)` from code is different and always
writes: that one is an instruction, not a derivation.

The mechanics — the `_outbox` table, the transaction boundary, the retry, the
audit trail — are in
[04-dispatch-and-pipeline.md](04-dispatch-and-pipeline.md#events-and-the-outbox).

## Recurring work — `x-schedules`

```yaml
x-schedules:
  sweep-todo:
    every: 5s                # digits + s|m|h|d. Not cron — see the limits below
    op: start                # an action or a transition on THIS model
    where: ["title:contains:sweep-me", "status:eq:todo"]   # optional
    limit: 25                # most rows one run will touch. Default 100
    roles: [admin]           # the authority the run acts with
```

A **keyword, not a fourth config family**: every schedule so far is *about* a
model's rows, a family is for things there are many of, and a keyword can be
promoted later if something unattached to a model ever needs one. Promotion is
cheap; an unused directory is the breadth CLAUDE.md's failure list names.

`where` absent means run the operation once with no id — how a schedule that
creates something is written. Present, it lists matching rows **through the
engine** and runs the operation for each, so org scope is injected and the
filter resolves against the model's own `filterable` allowlist.

**A scheduled run has no session, so it declares its authority.** `roles` is
server configuration in the same sense `PLATFORM_ADMINS` is — it is codebase-owned
config, not something a request can ask for — and the gates then judge the run
exactly as they would a person holding those roles. It may not name the reserved
role: that is granted in one place and this is not it.

The mechanics — `_schedule`, the one ticker, and the **missed-run policy** —
are in [04-dispatch-and-pipeline.md](04-dispatch-and-pipeline.md#schedules).

## Notifications — `x-events` and `notify`

```yaml
x-events:
  note.restart:
    - notify:
        provider: ops-webhook       # named in config/notifications.yaml
        data: { id: input.id, reopenedBy: actor.id }
```

`notify` is the **sixth declared form** ([the grammar](#behaviour--x-hooks-and-x-actions)),
and the only one that reaches outside the process. It is admitted in `x-events`
and refused in `x-hooks`, because there is no unsend: a hook that notified would
be sending for a write that can still roll back. It throws on failure, so the
outbox counts the attempt and retries — a receiver being down is not a reason to
lose the event.

### Naming the recipient and the body

```yaml
x-events:
  participant.confirm:
    - notify:
        provider: mailer
        to: row.email                      # an expression, evaluated at delivery
        data:
          name: row.name
          reference: row.paymentReference
        subject: '{name}, your seat is confirmed — {reference}'
        text: |
          Hi {name}, your reference is {reference}.
        html: |
          <p>Hi {name}, your reference is <b>{reference}</b>.</p>
```

`to` is an expression yielding an address or a list of them, and it **overrides** the provider's
`to` for this message only — a declaration that names none still reaches the operator address in the
config, so a webhook or an operator mailbox declared beside this one is unchanged.

`subject`, `text` and `html` are **templates, not expressions**: `{name}` names a key of `data`,
which is already expressions. A second expression language inside a subject line would mean the same
value could be computed two ways and drift. Boot refuses a placeholder `data` does not produce, so a
typo is a config error rather than something somebody reads in their inbox. Declaring `html` sends a
`multipart/alternative` with both halves; declaring none leaves the message exactly the shape it had
before.

**The row is read at delivery time**, through `ctx.call('get', …)`, because a listener's context
carries the event's payload and no row — and `_outbox.payload` holds ids and names, never row
values. The gates re-apply on that fetch, so what may be mailed is what the actor who caused the
event may read. A declaration that does not mention `row` does not pay for the fetch.

Providers themselves are declared in `config/notifications.yaml`, which is where
`secretRef` finally has a consumer — see [09-secrets.md](09-secrets.md). **A recipient may come from
a row; a credential never may**: `host`, `port`, `from`, `user` and `secretRef` are provider keys and
the `notify` schema is closed against them.

## Capacity — `x-guards`

```yaml
x-query:
  filterable: [paymentStatus, workshopDate]   # a guard counts through this list

x-guards:
  seats:
    on: [update]                  # the operations it guards
    where:
      paymentStatus: "'confirmed'"  # field: expression, ANDed
      workshopDate: row.workshopDate
    max: 30
    reason: workshop_full
```

A gate expression sees `{ actor, op, model, input, row, now }` and no aggregate, so "refuse when 30
seats are already confirmed" could not be written in `x-access`, `x-scope`, `deny.when` or
`skip.when`. `x-guards` is the keyword that can ask a counting question, and it is deliberately
**not** an expression: putting a database handle into the expression context would give every
expression in the system the ability to query, to answer one question.

**A guard is a scoped equality count with a ceiling.** The key of `where` is a **filterable** field
of this model, resolved to a column from the model definition; the value is an expression evaluated
against the same view a gate sees, and bound as a parameter. The adapter adds the tenant's own scope
on top, so a count can never reach across a tenant — `where` only narrows it further, which is what
makes "this cohort's 30" different from "the table's 30".

**It is evaluated inside the operation's own transaction, after the write and before the commit.**
That ordering is the point. A guard that counts and *then* writes leaves a window two writers both
fit through, and two admins confirming the thirtieth and thirty-first seat at the same moment would
both pass. Counting after the write inside the same transaction makes the count and the write it
judges one atomic act: a count over the ceiling throws, and the throw rolls both back. Checking after
also keeps a full cohort editable — a write that does not join the counted set does not move the
count, so a row at the ceiling can still be corrected.

`on` names the writes: `create`, `update`, and any declared action, which includes every transition,
since a transition is an action. Not the reads — "refuse a read because 30 rows exist" is an access
rule, and `x-access` already expresses it. Not `delete`, which can only make a count smaller.

A term whose expression resolves to nothing means the guard has no cohort to count, so it does not
fire; counting the whole table instead would refuse writes that have nothing to do with each other.

The refusal is a `Denied` carrying `reason`, so it reaches a caller as `403 forbidden` with that
detail — a workflow fact about a row this caller may already write, like a transition's refusal.

> **Contention is not a refusal.** Proving a limit under two writers exposed the other half: a
> transient store conflict was reaching callers as a failure, and with sqlite refusing the second
> writer before the guard was ever consulted, a boundary test passed with the guard *removed*. A
> writing request now retries its whole transaction on a transient store conflict
> (`packages/core/src/engine/retry.ts`) and never on an answer — a `Denied`, a validation failure or
> a unique-index conflict is thrown as it is.

## Cross-model checks

Checks that need every model compiled run in `loadModels` (`model.ts:530`), not per document, so a
lookup or a call naming a model that loads later is not a failure of directory order: every
`x-lookup` target, every declarative `call`'s model and op.

## Every refusal

The message is always `config error in <source>: <detail>`. `<source>` is `models/<file>.yaml`, or
the model name for the cross-model checks, or the directory for the family-wide ones.

| Condition | Detail |
|---|---|
| A renamed keyword | `"x-fields" has been renamed to "x-field-access"` |
| The meta-schema fails | Ajv's list — `<path> <message>; …` |
| Property name is not an identifier | `property "<key>" is not a safe identifier` |
| Declaring a system field | `"<key>" is framework-owned and cannot be declared` |
| `x-storage.notNull` names something unknown or transient | `x-storage.notNull references unknown or transient field "<field>"` |
| A migration step names a system field | `x-storage.migrations names "<field>", which is framework-owned` |
| A rename to itself | `x-storage.migrations renames "<from>" to itself` |
| Renaming a field that is still declared | `x-storage.migrations renames "<from>", which is still declared as a property — remove it, or rename a different field` |
| Renaming to a target that is not a property | `x-storage.migrations renames "<from>" to "<to>", which is not a persisted property of "<model>"` |
| Dropping a field that is still declared | `x-storage.migrations drops "<field>", which is still declared as a property` |
| `x-require` names an unknown field | `x-require.<op> references unknown field "<field>"` |
| `required` on the base schema | ``base schema must not carry `required` — use x-require (ARCHITECTURE §5)`` |
| `x-scope` names an unknown field | `x-scope references unknown field "<col>"` |
| `x-unique` names something unknown or transient | `x-unique references unknown or transient field "<field>"` |
| `x-encrypt` on a non-string | `x-encrypt on "<key>" requires type string` |
| `x-encrypt` on a transient property | `"<key>" is transient and is never stored, so x-encrypt is meaningless` |
| `x-lookup` on a non-string | `x-lookup on "<key>" requires type string — it holds an id` |
| `x-lookup` on a transient property | `"<key>" is transient, so a lookup on it would reference nothing stored` |
| `x-lookup` on an encrypted property | `"<key>" is encrypted and cannot be a lookup — the id must be readable to resolve` |
| `x-upload` without `format: binary` | `x-upload on "<key>" requires format: binary` |
| `x-upload` on a transient property | `"<key>" is transient, so it cannot hold an uploaded file` |
| A malformed size | `x-upload.maxSize on "<field>" must look like "10MB"` |
| `x-query` names something unknown or transient | `x-query.<sortable\|filterable> references unknown or transient field "<field>"` |
| An encrypted field declared sortable | `"<field>" is encrypted and cannot be sortable — ciphertext does not order` |
| An encrypted field declared filterable without a blind index | `"<field>" is encrypted and cannot be filterable without x-encrypt.search: exact (a blind index)` |
| An encrypted field declared unique without a blind index | `"<field>" is encrypted and cannot be unique without x-encrypt.search: exact (a blind index)` |
| `x-field-access` names an unknown field | `x-field-access references unknown field "<name>"` |
| `x-states.field` names something unknown or transient | `x-states.field references unknown or transient field "<field>"` |
| The state field is not a string | `x-states.field "<field>" must be type string — a state is a named value` |
| The state field is encrypted | `"<field>" is encrypted and cannot be the state field — a lane is a filter, and ciphertext does not compare` |
| The state field names no states | `x-states.field "<field>" declares no enum — a lifecycle needs its states named, as enum: [...]` |
| `x-states.initial` is not one of them | `x-states.initial "<state>" is not a value of "<field>" — valid states are <every state>` |
| A transition named for a builtin | `x-states.transitions."<name>" is a builtin operation — a transition may be named anything but <every builtin>` |
| A transition colliding with an action | `x-states.transitions."<name>" is already declared as x-actions.<name> — a transition IS an action, so rename one of them` |
| `x-guards.on` names no such operation | `x-guards."<name>".on names "<op>", which is not an operation this model has — valid operations are <every guardable op>` |
| `x-guards.where` counts on a field that is not filterable | `x-guards."<name>".where counts on "<field>", which is not filterable — add it to x-query.filterable, or count on one of <every filterable field>` |
| `x-guards.where` counts on an encrypted field | `x-guards."<name>".where counts on "<field>", which is encrypted — a count is a filter, and ciphertext does not compare` |
| A transition to a state that is not one | `x-states.transitions.<name>.to "<state>" is not a value of "<field>" — valid states are <every state>` |
| A transition from a state that is not one | `x-states.transitions.<name>.from names "<state>", which is not a value of "<field>" — valid states are <every state>` |
| A transition requiring an unknown field | `x-states.transitions.<name>.require references unknown field "<field>"` |
| A transition requiring its own state field | `x-states.transitions.<name>.require names "<field>", which the transition writes itself` |
| `x-require` naming a transition | `x-require."<name>" names transition "<name>" — declare its requirements as x-states.transitions.<name>.require` |
| `x-events` naming an unknown model | `x-events."<name>" names unknown model "<model>" — known: <every model>` |
| `x-schedules` naming an operation this model does not have | `x-schedules.<name> runs "<op>", which is not an operation of this model — declared: <every action>` |
| A malformed filter | `x-schedules.<name>.where[<i>] is "<filter>" — expected field:op:value, where op is one of eq, ne, gt, gte, lt, lte, contains, in` |
| A filter on a field that is not filterable | `x-schedules.<name>.where[<i>] filters on "<field>", which is not filterable — filterable: <every filterable field>` |
| A schedule with no authority | `x-schedules.<name> declares no roles — a scheduled run has no session, so it must say what authority it acts with` |
| A schedule naming the reserved role | `x-schedules.<name>.roles names the reserved role "<role>" — it is granted by server configuration (PLATFORM_ADMINS) and nowhere else` |
| `x-channels` naming a runner the framework does not supply | `x-channels.<name> names runner "<run>", which the framework does not supply — available: pty, files, browse` |
| `x-channels.root` or `.provider` naming no property of this model | `x-channels.<name>.<key> is "<value>", which is not a property of this model — declared: <every property>` (`root: $base` is the exception: the server's `--workspace-base`, which no row can name) |
| A channel naming the reserved role | `x-channels.<name>.roles names the reserved role "<role>" — it is granted by server configuration (PLATFORM_ADMINS) and nowhere else` |
| A channel missing a direction | `x-channels.<name> declares no <in\|out> message — a duplex channel needs both directions` |
| A message schema that is not a schema | `x-channels.<name>.messages.<message>.schema is not a valid schema: <why>` |
| `x-events` naming an event nothing emits | `x-events."<name>" names an event "<model>" never emits — it emits <created, updated, deleted, and every action>` |
| A handler declaration that will not compile | the collected problems, joined by `; ` — see below |
| A hook bound to a point nothing fires | `x-hooks."<point>" is never fired — valid points are <every valid point>` |
| `x-require` keyed by a non-operation | `x-require."<op>" names no operation — valid keys are create, update, <actions>` |
| A property both `x-internal` and `x-transient` | `"<field>" is both x-internal and x-transient — the first is stored and never read, the second is neither` |
| `x-query.sortable`/`filterable` naming an internal field | `x-query.<key> references "<field>", which is x-internal — ordering or filtering by it would answer questions about a value nothing may read` |
| `x-lookup` labelled by an internal field | `x-lookup on "<field>" labels by "<label>", which is x-internal on "<target>" — a label is rendered wherever the relation is drawn` |
| A model named as one the framework registers | `"<name>" is a model the framework registers — choose another name for this one` |
| A model named with a leading `_` | `model "<name>" starts with "_", which names the framework's own tables — choose a name without it` |
| Two models with the same `$id` | `duplicate model "<name>"` |
| An empty or absent models directory | `no models found` |
| A declarative call naming an unknown model or op | the collected problems, joined by `; ` — see below |
| `x-lookup` to an unknown model | `x-lookup on "<field>" names unknown model "<model>" — known: <every model>` |
| `x-lookup` to its own model | `x-lookup on "<field>" points at its own model` |
| `x-lookup` labelled by a field the target lacks | `x-lookup on "<field>" labels by "<label>", which "<target>" does not have` |
| `x-lookup` labelled by an encrypted field | `x-lookup on "<field>" labels by "<label>", which is encrypted on "<target>" — a picker cannot sort or search it` |

Declaration problems are collected and reported **together**, prefixed by the path an author can go
and edit (`x-hooks.beforeCreate[1]`, `x-actions.pin`), because an author fixing a config wants every
problem in it, not the first one:

- `handler "<ref>" must be of the form path#namedExport`
- `an action must produce a result, so it is "call", "batch" or a path#namedExport — "<kind>" only means something as a hook`
- `"<model>" has no property "<field>" — declare it, or set a different field`
- `<where>: invalid expression "<expr>" — <parser message>`
- `<where>: expression "<expr>" uses unknown transform "<name>" — available: trim, collapseWhitespace, lower`
- `<model>.<where>: calls unknown model "<model>" — known: <every model>`
- `<model>.<where>: calls "<op>" on "<target>", which has no such operation — builtin: create, get, list, update, delete, schema, count, aggregate[; declared: <actions>]`

## Limits worth knowing

- **Four scalar types.** Arrays and objects are refused at boot (AUD-021, deliberate).
- **`x-access` has two keys that matter.** The gate consults `read` and `write` only
  (`gates.ts`); a custom action is a *write*. Per-operation permissions do not exist (AUD-061).
- **A state axis, only through a lifecycle.** A requirement set reads the stored row when the
  operation names one (`x-states`, AUD-005). What it reads is presence — "this field is already on
  the row" — not a condition over its value; a rule about the value is a gate expression.
- **Gates deny by default.** A model with no `x-access` refuses everything —
  `apps/showcase/config/models/unpoliced.yaml` exists to prove exactly that.

## How to verify this layer

Change one thing in a model and watch the whole stack move, which is the claim the model spine
makes:

```sh
# Add `maxLength: 10` to note.title, restart, and the derived schema, the form
# validation and the API's 422 all change together.
curl -s 'localhost:3000/v0/schema/note?op=create' -b cookies.txt | jq .properties.title
```

For the refusals, break one keyword at a time against a copy of the config and read what boot says —
the recipe is in [01-configuration-and-boot.md](01-configuration-and-boot.md#how-to-verify-this-layer).
`packages/core/test/model.test.ts` holds the same cases as unit tests; the boot run is what proves
the message reaches an author.

That the table above is still **complete** is itself checkable:

```sh
bun docs/stack/checks/config-error-coverage.ts
# 37 ConfigError sites: 34 with static text (0 missing from docs/stack), 3 computed.
```

It extracts every `new ConfigError(...)` in `model.ts`, splits each message at its interpolations,
and fails on any static run of ten or more characters that this directory does not contain. A new
refusal added to the compiler and not to this table shows up as a miss.

## Related

[01-configuration-and-boot.md](01-configuration-and-boot.md) ·
[03-derived-schemas.md](03-derived-schemas.md) · [05-gates.md](05-gates.md) ·
[06-persistence.md](06-persistence.md) · `ARCHITECTURE.md` §3.1, §5, §11, §12, §13

---

_Checked against the code 2026-09-16_ — `packages/core/src/model.ts`, `ops.ts`, `schema.ts`,
`expressions.ts`, `gates.ts`, `limits.ts`, `config/system-fields.ts`, `handlers/declare.ts`,
`handlers/index.ts`, `apps/showcase/config/models/note.yaml`.
