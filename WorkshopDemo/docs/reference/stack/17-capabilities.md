# What you can build, by what you need

Every other document here explains a layer, and [16-building-a-feature.md](16-building-a-feature.md)
walks one example across all of them. **This page is the index you read when you know what the app
has to do and not yet which layer does it.**

## If you are an agent working on an app built from this framework

**Check a capability here before writing config for it.** This framework is configuration-first,
which makes it unusually easy to write YAML that reads correctly, means nothing, and fails at boot —
or worse, passes boot and does nothing. The second table on this page exists for exactly that: it
names what the framework does **not** do, so a plausible keyword is not invented to fill a gap.

Three rules that save the most time:

- **A keyword that is not in this document does not exist.** The model keywords below are the
  complete set the compiler reads (`packages/core/src/model.ts`). There is no `x-webhook`, no
  `x-cron`, no `x-permissions`.
- **Boot is the error surface.** Almost every mistake here is refused at startup with the file, the
  path and the valid alternatives in the message. If an app boots, the config is structurally sound;
  if it does not, read the message rather than guessing.
- **The app cannot change the framework.** App-Stack is vendored as a release. A capability that is
  missing is a framework change and a version bump, never an edit inside `.app-stack/`.

## What it does

Each row is a requirement, not a layer. **Where** links the document that carries the detail.

### Data and behaviour

| You need | It does | Where |
|---|---|---|
| A resource — table, API, gates, schemas | One model document. Nine built-in operations: `create`, `get`, `list`, `update`, `delete`, `schema`, `count`, `aggregate`, `history` | [02](02-models.md) |
| A lifecycle — states and legal moves | `x-states`: the field, the initial state, named transitions with `from`/`to` and their own access | [02](02-models.md) |
| An operation that is not CRUD | `x-actions` — declared (`call`, `batch`) or a `path#export` escape hatch. `x-require` names what it asks for | [02](02-models.md) |
| Something to happen around a write | `x-hooks` at `before`/`after` each operation. Declared forms: `call`, `batch`, `set`, `deny`, `skip` | [02](02-models.md) |
| Something to happen **after** the commit | `x-events` — same grammar plus `notify`. Runs on its own transaction, so a failure leaves the committed write alone | [02](02-models.md) |
| Work on a timer | `x-schedules` | [02](02-models.md) |
| Joins, filters, measures, grouping | A query document: `from`, `select`, `join`, `where`, `groupBy`, `measures`, `orderBy`. `x-cross-tenant` widens scope for the reserved `platform` role only | [06](06-persistence.md) |
| Several writes as one transaction | `POST /v0/batch` — all elements pass every gate, all or nothing | [04](04-dispatch-and-pipeline.md) |
| Uniqueness, computed-in, non-stored fields | `x-unique`, `x-transient`, `x-fields` | [02](02-models.md) |

### Who may do what

| You need | It does | Where |
|---|---|---|
| Sign-in, sessions, refresh, revocation | Built in. Two `HttpOnly` cookies, one-time rotating refresh, family revocation | [10](10-auth-and-sessions.md) |
| Users, invites, orgs, roles, audit | Five system models ship — `_users`, `_sessions`, `_orgs`, `_invites`, `_audits` — with routes under `/v0/auth/` | [10](10-auth-and-sessions.md) |
| An admin surface to operate them | `MembersScreen` and `OrgScreen`. **An app adopts this; it does not build it** | [10](10-auth-and-sessions.md), [13](13-screens.md) |
| Row-level rules | `x-access` (JEXL over `actor`, `row`, `input`, `now`), deny by default | [05](05-gates.md) |
| Per-field read/write rules | `x-field-access` — an unreadable field is **absent**, not blank | [05](05-gates.md) |
| Multi-tenancy | `x-scope` — server-injected, bound in SQL, never from the request | [05](05-gates.md) |
| Encryption at rest, searchable | `x-encrypt` with a blind index for equality search | [07](07-encryption.md) |
| Credentials and deployment values | `secretRef` for secrets; `{ env: NAME }` on notification providers for what sits beside them | [09](09-secrets.md) |

### What a person sees

| You need | It does | Where |
|---|---|---|
| Pages, routes, navigation | View documents. Nav and routes are projected **per actor** — a page you may not see does not exist in your document | [11](11-projection-and-frontend.md) |
| A table with server-side sort, filter, paging | `DataGrid` — keyset paging, row actions, bulk operations | [13](13-screens.md) |
| Forms | `FormScreen`, built from the derived schema, with server errors landing on fields | [12](12-forms.md) |
| Kanban, wizard, detail, timeline, report, chart | `BoardScreen`, `WizardScreen`, `DetailScreen`, `TimelineScreen`, `ReportScreen`, `ChartScreen` | [13](13-screens.md) |
| Marketing and content pages | `PageShell` plus the `Content*` family; public models and SEO tags with a sitemap | [13](13-screens.md) |
| Look and feel | `theme.yaml` tokens, `icons.yaml` drawings. **Both optional** | [13](13-screens.md) |
| File upload and gated download | `x-upload` — staged, gates run before bytes are read, downloads gated per request | [08](08-files.md) |
| A terminal, a file tree, an editor | `x-channels` with the `pty`, `files` and `browse` runners | [13](13-screens.md) |

**39 components, 26 with prop schemas** enforced at boot. [13](13-screens.md) names every one and
every prop; a prop not in that document is not a prop.

### Running it

| You need | It does | Where |
|---|---|---|
| A database | SQLite, PostgreSQL or MariaDB, chosen by `DATABASE_URL` | [06](06-persistence.md) |
| Schema changes | Migrations derived from the model; no migration files to write | [06](06-persistence.md) |
| Outbound notification | `notifications.yaml` providers — `webhook` (HMAC-signed) and `email` (SMTP), delivered after commit through an outbox with retry and backoff | [09](09-secrets.md) |
| Paging and export ceilings | `LIST_DEFAULT_LIMIT`, `LIST_MAX_LIMIT`, and an export ceiling, from the environment | [06](06-persistence.md) |
| Proof it works | `bun test`, then `bun run verify:browser` driving the real app at three viewports | [14](14-verification.md) |

## What it does not do

**Read this before designing around a capability.** Each line was checked against the source on
2026-09-24; none of these is a keyword waiting to be discovered.

| You may want | Today | The nearest thing |
|---|---|---|
| **Call an external API and use the answer** | **No.** `notify` posts to a webhook and **discards the response** — it checks the status and nothing else | A `path#export` hook in the app's own TypeScript, which can `fetch` freely. Backlogged as a declared form |
| **Receive a webhook from another system** | **No inbound receiver.** There is no signed-endpoint route | The external system calls the gated `/v0/…` API with credentials, like any other client |
| GraphQL, gRPC, MCP, Kafka, AMQP, NATS clients | **None.** Runtime dependencies are four: `ajv`, `ajv-formats`, `jexl`, `kysely` | GraphQL is a POST; a hook can make one. The rest are framework changes |
| Redis or S3 | **The framework uses neither**, though the Bun runtime ships clients for both | A hook can use `Bun.redis` / `Bun.s3` directly |
| `{ env: … }` anywhere in config | **Notification providers only** — no other family carries a deployment value | `secretRef` for secrets; literals elsewhere, because they are the same on every deployment |
| More than one app process | **The outbox claims work assuming a single worker** and would double-deliver if two ran | Run one process until this is addressed |
| OAuth / social sign-in | **No.** Email and password, with invites and join codes | — |

## Best practice, by what you are building

**A public site or landing page.** Public models must be scoped — the framework refuses at boot
otherwise. Use `PageShell` and the `Content*` family, declare `theme.yaml`, and let the SEO tags and
sitemap come from the projection. Nothing else is needed; `notifications.yaml` and `icons.yaml` can
be absent entirely.

**Anything with a sign-in.** Model the domain object **and** adopt the identity layer — an admin view
carrying `MembersScreen` and `OrgScreen`, invites rather than hand-made accounts, roles changed
through the route rather than written into a seed. Building only the first is the common mistake and
it passes every test you would think to write, because what is missing is a surface, not a behaviour
([10](10-auth-and-sessions.md)).

**Anything multi-tenant.** `x-scope` on every model, and never accept an org or a role from a
request. Prove it by signing in as the other tenant and asking for a row by id: the answer must be a
404, not an empty list.

**Anything that sends.** Put the provider's host, port, account and endpoint in the environment with
`{ env: … }`; put the credential in `secretRef`. A `default` is for local development and must never
be a credential. `notify` belongs in `x-events`, never in `x-hooks` — there is no unsend for a write
that then rolls back.

**Anything that integrates.** Reach for a declared `call` first: it goes back through the one door
and is therefore gated, so it can do nothing the triggering actor could not do by hand. Drop to a
`path#export` hook only for what genuinely leaves the process, and know that you are writing trusted
in-process code when you do.

**Anything at all.** Let boot be the test. Misspell a prop, a state, an icon, a field or a model and
the server refuses to start and names the alternatives. An app that boots has structurally sound
config; the browser gate is what proves it behaves.

## Limits worth knowing

- **This page is an index, not a contract.** Where it and a layer document disagree, the layer
  document is right and this one is a defect — say which.
- **It carries no version.** It describes the framework in this release. A capability added later
  appears here when it is added, not in a "since" column.

## Related

| | |
|---|---|
| [16-building-a-feature.md](16-building-a-feature.md) | The same ground as one worked example, in the order you work |
| [README.md](README.md) | The layer map, and the gates that keep these documents true |
| `ARCHITECTURE.md` | The config-family matrix, the decision ledger, the security invariants. In the app-stack repository, not in a release |
| `PRODUCTION-BACKLOG.md` | Everything in "what it does not do" that is parked rather than rejected. Same — it belongs to the framework's own repository |

_Checked against the code 2026-09-24: `model.ts` (19 `x-` keywords), `ops.ts` (9 built-in
operations), `handlers/declare.ts` (five declared forms plus `notify`), `notify/providers.ts` (two
provider types, `{ env: … }`), `queries/compile.ts`, `auth/system-models.ts` (five system models),
`channels/runners.ts` (three runners), `db/` (three engines), `component-names.ts` (39 components,
26 prop schemas), and a grep for GraphQL, gRPC, MCP, Kafka, AMQP, NATS, Redis and S3 across
`packages/*/src`, which returns nothing._
