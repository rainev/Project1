# Building a feature

Every other document here explains one layer. This one crosses them once, in the order you actually
work, so that "add a thing to the app" has a path rather than a reading list.

**Nothing below requires reading framework source.** Where a step needs a detail this page does not
carry, it names the document that does.

The worked example is a waitlist: a visitor leaves their name and email, staff see the list, ops get
an email, and the admin dashboard shows a count. It touches every config family.

## 1. Decide what the thing *is* — a model

A model is a resource: a table, an API, the gates over it, and the schemas derived from it. One
document per model in `models/`.

```yaml
# models/waitlist.yaml
$schema: https://json-schema.org/draft/2020-12/schema
$id: waitlist               # the model name, and the default table name. Required.
title: Waitlist
type: object
properties:
  name:  { type: string, minLength: 1, maxLength: 120 }
  email: { type: string, format: email }
  note:  { type: string, maxLength: 500 }
x-storage:
  table: waitlist
  notNull: [name, email]
x-require:
  create: [name, email]
```

**Block style, always.** A comma inside a `{ }` ends the entry and an unquoted `#` starts a comment —
boot refuses both by name, along with a colon that turns a list item into a mapping, but they are
still easy to write. See [`01-configuration-and-boot.md`](01-configuration-and-boot.md).

`id`, `orgId`, `createdAt` and `updatedAt` are framework-owned: never declare them.

**Full property vocabulary:** [`02-models.md`](02-models.md) — types, formats, `x-encrypt`,
`x-lookup`, `x-upload`, `x-transient`, and what compilation derives from each.

## 2. Decide who may do what — gates

Deny by default. Nothing is reachable until a rule says so.

```yaml
x-access:
  create: "true"                     # anyone, including an anonymous visitor
  read:   "'staff' in actor.roles || 'admin' in actor.roles"
  list:   "'staff' in actor.roles || 'admin' in actor.roles"
  update: "'admin' in actor.roles"
x-scope:
  orgId: actor.orgId
```

**An anonymous create still needs a scope that resolves to something** — a create whose `x-scope`
resolves to nothing is refused as an unscoped write. That trap is in
`docs/learnings/2026-09-18-anonymous-create-needs-a-scope-key.md`.

**Field-level policy is separate from row-level**, and the two failure modes differ: reject what the
actor cannot read, drop what they can. Getting that backwards produces a 422 on a form that
round-trips a field it was shown.

**Full gate vocabulary:** [`05-gates.md`](05-gates.md) — the two phases, scope as values never
predicates, `x-field-access`, and per-row policy.

## 3. Give it a page — a view

A view is a route and a tree of components. The tree is composed from primitives; reach for a
composite only when the same arrangement repeats.

```yaml
# views/waitlist-join.yaml
id: waitlist-join
route: /waitlist
title: Join the waitlist
anonymous: true
node:
  type: PageShell
  props:
    title: Join the waitlist
  children:
    - type: FormScreen
      props:
        model: waitlist
        op: create
        title: Join the waitlist
        submitLabel: Join
        fields: [name, email, note]
```

**A panel only some actors should see is gated with `when:`**, which is evaluated on the server — an
absent panel never reaches the browser, so it cannot be found in the page source either.

**Full component catalogue:** [`13-screens.md`](13-screens.md) — 38 components and every prop each
accepts, checked against the code by a gate. [`12-forms.md`](12-forms.md) covers what a form derives
from the model and how controls are chosen.

## 4. Make it look like the app — theme and icons

Never a colour, radius or font in a component prop: those are tokens.

```yaml
# theme.yaml
colors:
  accent: "#ff8c2e"       # quote every hex — an unquoted # truncates the value
radius:
  control: 0.5rem
```

**Reference:** [`01-configuration-and-boot.md`](01-configuration-and-boot.md#themeyaml--design-tokens)
and [`#iconsyaml--the-icon-vocabulary`](01-configuration-and-boot.md#iconsyaml--the-icon-vocabulary).

## 5. Tell someone — events and notifications

Where a message goes is a provider; when and what it says is a model keyword.

```yaml
# models/waitlist.yaml
x-events:
  afterCreate:
    - notify:
        provider: ops-mail
        subject: "New waitlist signup — {name}"
        body: "{name} <{email}> joined."
```

```yaml
# notifications.yaml
providers:
  ops-mail:
    type: email
    host: smtp.example.com
    from: ops@example.com
    to: [ops@example.com]
    tls: true
    secretRef: SMTP_PASSWORD      # the NAME of an env var. Never the value
```

Delivery goes through a transactional outbox: the row commits, then the message sends. **A network
call never happens inside the transaction.**

**Reference:** [`02-models.md`](02-models.md#notifications--x-events-and-notify) for the model side,
[`01-configuration-and-boot.md`](01-configuration-and-boot.md#notificationsyaml--delivery-providers)
for provider shapes.

## 6. Count it — a query

```yaml
# queries/waitlist-total.yaml
name: waitlist-total
model: waitlist
measures:
  - { name: total, kind: count }
```

Queries are scoped like everything else: a query cannot widen what a gate narrowed.

**Reference:** [`06-persistence.md`](06-persistence.md#declared-queries).

## 7. Run it, and prove it

**Config compiles at boot and only at boot.** A YAML edit with no restart changes nothing — a page
that looks unchanged is the expected result, not a clue.

```sh
bun run start
```

Then exercise it the way its consumer will:

- **Drive the journey as its actor** — an anonymous visitor submits, staff sees the row, ops gets
  the mail. A page that renders is not a journey that completes.
- **Check what the server recorded**, not what the page said.
- **A panel behind `when:` is invisible to page comparison** — that is exactly why the journey is
  driven rather than only measured.

**Reference:** [`14-verification.md`](14-verification.md).

## When config is not enough

Some behaviour genuinely has no configuration: a new component, a new keyword, a new engine. **That
is a framework change, not a local patch.** Change App-Stack, cut a release, bump the version this
app runs. A packaged framework is deliberately not editable from the app that uses it.

`x-hooks` and `x-actions` are the supported escape hatch for app-specific *behaviour* — TypeScript
this app owns, referenced as `path#export` — and they are configuration pointing at code, not a
framework modification. See [`02-models.md`](02-models.md#behaviour--x-hooks-and-x-actions).

## Every layer, if you need it

Looking for a capability rather than a layer — "does it do background jobs, file uploads, an
external API call?" — [17-capabilities.md](17-capabilities.md) is that index, including the list of
what the framework does **not** do.

| | |
|---|---|
| [00](00-overview.md) overview · [01](01-configuration-and-boot.md) config and boot | what exists and when it compiles |
| [02](02-models.md) models · [03](03-derived-schemas.md) derived schemas | what a resource is |
| [04](04-dispatch-and-pipeline.md) dispatch · [05](05-gates.md) gates | what happens to a request |
| [06](06-persistence.md) persistence · [07](07-encryption.md) encryption · [08](08-files.md) files | what is stored |
| [09](09-secrets.md) secrets · [10](10-auth-and-sessions.md) auth | who is asking |
| [11](11-projection-and-frontend.md) projection · [12](12-forms.md) forms · [13](13-screens.md) screens | what is rendered |
| [14](14-verification.md) verification · [15](15-mirroring.md) mirroring | how it is proved |
