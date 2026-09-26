# Persistence

One adapter, three engines, and an interface that deliberately exposes **no joins and no raw
predicates** — so the generic surface cannot be talked into arbitrary SQL, and a document store could
arrive later without the interface having lied.

```text
engine/execute.ts ──▶ DBAdapter (db/adapter.ts)
                        └── SqlAdapter (db/sql.ts) ──▶ Kysely ──▶ Bun.SQL
                              └── EngineProfile (db/engines.ts): sqlite · postgres · maria
```

## The seam

`DBAdapter` (`db/adapter.ts:54`) is the whole contract: `migrate`, `query`, `create`, `get`, `list`,
`count`, `aggregate`, `update`, `delete`, `reseal`, `existsWith`, `tx`, the four `system*` operations
and `close`.

Every tenant-facing method takes `(model, scope, …)`. The **scope is not optional and not
defaultable**: `#assertScoped` (`db/sql.ts:299`) throws `refusing an unscoped query` rather than
returning every tenant's rows. Forgetting the mechanism is a refusal, never a leak.

`query` is the one method that joins, and it is not an escape hatch: it takes an `ExecutableQuery`
the framework compiled from declared models and relations, carrying tables, columns and bound
values, plus one evaluated scope per participating table. An adapter reads no config and decides no
policy.

`system*` reaches the framework's own tables (`_users`, `_sessions`, `_orgs`, `_invites`, `_audits`,
`_migrations`). They are not tenant-scoped, and generic dispatch refuses any model whose name starts
with `_`, so they are unreachable from the API — live: `GET /v0/list/_users` → `404 unknown_model`.

## What keeps SQL safe

Four rules, all above the engine line, all identical on every engine:

1. **Identifiers resolve to the model's own strings** through `column` / `allowedColumn` before the
   builder sees them. A caller may *select* a field; a caller's string never becomes SQL text.
2. **Values are always bound**, never formatted into a statement.
3. **Operators and aggregate functions are framework enums** — `OPERATOR` and `AGGREGATE_FN`
   (`db/sql.ts:38`), never request text.
4. **Every statement is scoped**, per rule above.

`contains` compiles to `LIKE` with the search term made literal — `%`, `_` and the escape character
in a user's term match themselves — and the escape character is `!`, not a backslash, because
MySQL and MariaDB treat backslash as an escape inside string literals too and `ESCAPE '\\'` means
different things depending on a server setting.

## Three engines, one adapter

`EngineProfile` (`db/engines.ts:27`) is a record, not a second implementation. A fourth engine is a
fourth profile. What actually differs:

| | sqlite | PostgreSQL | MariaDB |
|---|---|---|---|
| `string` / `number` / `integer` / `boolean` | `text` / `real` / `integer` / `integer` | `text` / `double precision` / `integer` / `boolean` | `text` / `double` / `int` / `tinyint(1)` |
| Key columns (`id`, `orgId`) | `text` | `text` | `varchar(64)` — a `text` column cannot be indexed without a prefix length |
| Boolean storage | `0` / `1` | real boolean | `0` / `1` |
| `DELETE … RETURNING` | yes | yes | no — count affected rows |
| `CREATE INDEX IF NOT EXISTS` | yes | yes | no |
| Prepared plans survive DDL | yes | **no** — reopen the pool after an ALTER | yes |
| NULL ordering needs spelling out | no | **yes** — `NULLS LAST`/`FIRST` | no |
| Text collation | BINARY (default) | `"C"` | `utf8mb4_bin` |

Two of those were found by running, not reading. PostgreSQL caches a *plan* per prepared statement
and refuses to re-plan one whose result type changed, so `select *` on a table that has since gained
a column fails with `0A000 cached plan must not change result type` and goes on failing; the adapter
reopens the pool after a migration alters anything. And PostgreSQL sorts NULL above every value
while the other two sort it below — exactly inverted — so a report declared once in config would
show a different first page depending on the engine underneath.

Text collation is pinned for the same reason: left to their defaults the three sort text three
different ways, and byte order is the one reading all three can guarantee. The cost is real and
named — ordering is case-sensitive and not locale-aware, so "Zebra" precedes "apple" — and an
`x-storage.collation` keyword is in `PRODUCTION-BACKLOG.md`.

The URL scheme picks the profile, and it is the only thing a URL decides:
`sqlite://`, `postgres://`, `postgresql://`, `mysql://`, `mariadb://`. Anything else is
`unsupported database url: <scheme>// (expected one of …)`. The URL itself resolves through the
secret seam, so `DATABASE_URL_FILE` works — a connection string with a password in it is a secret.

## Paging

Keyset, never offset. `list` clamps the caller's limit into `[1, LIST_MAX_LIMIT]` and defaults to
`LIST_DEFAULT_LIMIT` (`db/sql.ts:402`) — **the server clamps, the server mints every cursor**, and a
component that may not fetch more can only ask for less.

A cursor is base64url over `{ sort, dir, value, id }`: the sort value plus the row id as
tie-breaker. A cursor presented against a different sort order is
`<model>: cursor does not match this sort order`; a cursor that will not decode is `invalid cursor`.
Both are 400s.

**A known hole:** a cursor compares `col > :value`, and where `:value` is NULL that comparison is
NULL and never true — so paging a report sorted on a nullable column stops at the first NULL and
silently drops the rest. Engine-independent, pre-existing, and in `PRODUCTION-BACKLOG.md`.

## Schema evolution

`CREATE TABLE IF NOT EXISTS` plus a boot drift check is what this replaced: correct, and useless,
because the only remedy it named was "drop the database".

| Change | What happens |
|---|---|
| A new table | Created, with `id`, `orgId`, `createdAt`, `updatedAt` then every persisted property, plus an index on `(orgId, createdAt)` |
| A new **nullable** property | `ALTER TABLE … ADD COLUMN` on the next boot. Rows written before it read back `null` |
| A new **NOT NULL** property | **Refused.** sqlite cannot add one without a default, and on a populated table neither can the others without inventing a value |
| A property that vanished | **Refused**, naming both declarations that would authorise it — a rename or a drop |
| A type change | **Refused.** It needs a per-engine cast and is not declarable |
| A nullability change | **Refused** |
| A declared `rename` / `drop` | Applied, in order, **before** the additive diff — because a rename looks exactly like "one column appeared and another vanished" until it has run |

The diff is computed against the **database**, by introspection, never against the ledger. A ledger
that disagreed with the schema would be believed, and this project has already paid once for
believing a record over the running thing. `_migrations` is therefore history, not state:
idempotence comes from the schema itself — a rename whose source column is gone is a no-op because
the column is gone, not because a row says so. A `CREATE TABLE` writes no ledger row; an `ALTER` and
a key rotation do.

A migration step names a column the model no longer declares, so it cannot resolve through
`column()`. Two things stand in: the meta-schema admits only `[A-Za-z_][A-Za-z0-9_]*`, and every
name reaching DDL is matched against the set the **introspector** just reported — so the string in
`ALTER TABLE` is one the database itself named.

Driven on a scratch database, four boots in a row:

```text
1. first boot — the table is created
    columns: id, orgId, createdAt, updatedAt, name, reference, email, since, contractEndsAt
2. a property added — additive, applies itself
    columns: … contractEndsAt, phone
3. that property removed again — refused
    REFUSED: model "customer" (table "customers") asks for a change the framework will not make:
      - drop column "phone", which the model no longer declares — Declare x-storage.migrations: [{ drop: phone }] to remove it.
    The database was left untouched.
4. the drop declared — applied
    columns: id, orgId, createdAt, updatedAt, name, reference, email, since, contractEndsAt

_migrations ledger:
    customers:add:phone          add     phone text
    customers:drop:phone         drop    phone
```

## Declared queries

The third config family (`config/queries/*.yaml`) and the only thing that joins. A query joins along
relations **the models already declare** (`x-lookup`), filters on values, groups, and measures.
There is no free-text SQL and no way to name a table: `from` and `via` resolve through the model
registry, so every identifier reaching a statement is one the codebase owns.

| Key | Meaning |
|---|---|
| `$id` | The query's name, and its URL: `/v0/query/<$id>` |
| `from` | The root model |
| `join` | `inner` or `left`, along a declared `x-lookup` |
| `select` | Columns, with an output `key` and an optional `label` |
| `where` | `field`, `op` from the same operator enum the generic surface uses, and a JEXL `value` over `{ params, actor, now }` — evaluated per request and **bound** |
| `groupBy`, `measures`, `orderBy` | `count`, `sum`, `avg`, `min`, `max` |
| `params` | Declared types, `required`, `default`. A parameter used in a `where` and never declared is a boot error |
| `x-access.read` | The query's own gate |
| `x-cross-tenant` | Marks a read that spans tenants (§22.1) |

Running one follows the same order §16 fixes for every other read: the query's own `x-access.read`,
then the read gate of **every participating model** (a join is never a way into a model the actor may
not list), then parameters validated against their declared types, then each model's `x-scope` bound
— the root's into `WHERE`, a joined model's into its `JOIN` condition — then the statement, then
`x-field-access.read` per column on the way out.

Live: `GET /v0/query/notesByStatus` returns rows plus a `columns` array a grid renders from;
`/v0/query/notesByStatus.csv` streams the same read; `GET /v0/query/notesAcrossOrgs` as a tenant
actor is `403 forbidden` and is audited as `op: query:cross-tenant`.

A cross-tenant scope is `{ orgId: { in: […] } }` — a **bound list**, not an emptied scope. Scope is
never emptied to widen it, so the unscoped-query refusal stays exactly as it was, and write paths
refuse a list outright: there is no such thing as creating a row in several tenants at once.

## Limits worth knowing

- **No offset paging, by design.** Every page is a keyset page and every cursor is server-minted.
- **The NULL-cursor truncation above.**
- **`x-storage.collation` does not exist yet**, so text ordering is byte order everywhere.
- **A type change and a new NOT NULL column are named carve-outs**, both in the backlog.

## How to verify this layer

The at-rest shape is the thing to check, and `sqlite3` is enough:

```sh
sqlite3 .data/showcase.sqlite '.schema notes'
```

```sql
CREATE TABLE IF NOT EXISTS "notes" ("id" text primary key, "orgId" text not null,
  "createdAt" text not null, "updatedAt" text not null, "title" text not null, "body" text,
  "pinned" integer, "status" text, "customerId" text, "adminOnlyNote" text,
  "searchableSecret" text, "attachment" text, "searchableSecret_bidx" text);
CREATE INDEX "notes_org_created" on "notes" ("orgId", "createdAt");
```

Read it against `apps/showcase/config/models/note.yaml`: the four framework-owned columns, then
every persisted property, with `reason` and `draftNote` **absent** because they are transient, and
`searchableSecret_bidx` present because that field declared `x-encrypt: { search: exact }`. `pinned`
is an `integer` because this is sqlite.

The contract suite `packages/core/test/db-contract` runs the same assertions against all three
engines; `.env` points the PostgreSQL and MariaDB runs at disposable containers.

## Related

[07-encryption.md](07-encryption.md) · [04-dispatch-and-pipeline.md](04-dispatch-and-pipeline.md) ·
[02-models.md](02-models.md) · `ARCHITECTURE.md` §7, §7.1, §22

---

_Checked against the code 2026-09-16_ — `packages/core/src/db/adapter.ts`, `sql.ts`, `engines.ts`,
`factory.ts`, `migrate.ts`, `queries/compile.ts`, `queries/execute.ts`, `limits.ts`. The schema dump
is `sqlite3 .data/showcase.sqlite '.schema notes'` on a database the running showcase had just
created; the four migration boots were driven on a scratch sqlite file.
