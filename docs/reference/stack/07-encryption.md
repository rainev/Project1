# Field encryption

Encryption sits **above** the adapter, so behaviour is identical on every engine and ciphertext —
not plaintext — is what lands in every dump, backup and stolen disk image.

```text
validate → field-write policy → [encrypt] → store
store → [decrypt] → field-read projection → respond
```

Hooks and gates therefore see plaintext. The adapter only ever sees ciphertext.

## Declaring it

```yaml
adminOnlyNote:
  type: string
  x-encrypt: true                  # sealed; opaque to the database
searchableSecret:
  type: string
  x-encrypt: { search: exact }     # sealed, plus a blind index for equality
```

Only `type: string`, never transient. A `search: exact` field gets a framework-owned
`<field>_bidx` shadow column, added to `columns` and to `filterable` by the compiler
([02-models.md](02-models.md)).

## Keys

`createKeyProvider` (`crypto/keys.ts:32`) imports each master key for HKDF and derives, per
`(kid, orgId, usage)`, **two** keys:

| Usage | Derivation | Algorithm |
|---|---|---|
| `encrypt` | HKDF-SHA-256, salt `app-stack:encrypt`, info `org:<orgId>` | AES-GCM |
| `index` | HKDF-SHA-256, salt `app-stack:index`, info `org:<orgId>` | HMAC-SHA-256 |

Two consequences worth stating plainly. **One tenant's key leaking does not decrypt another's** —
the tenant id is the HKDF info. And **the blind-index key is a different key from the encryption
key**, so an index that leaks does not help anyone open ciphertext. Derived keys are cached per
`kid:orgId:usage`; master key material comes from the secret seam and never appears in config.

`activeKid` is the key new ciphertext is written under. Every envelope names the key that wrote it,
so rotation never orphans data — see [09-secrets.md](09-secrets.md) for `APP_DEK_ACTIVE`.

## The envelope

```text
v1:<kid>:<iv base64url>:<ciphertext+tag base64url>
```

AES-GCM, a fresh 12-byte IV per value, and **AAD = `<model>:<field>:<orgId>:<rowId>`**
(`crypto/field.ts:16`). The AAD is what makes a value non-portable: ciphertext cannot be moved
between columns, between rows, or between tenants, because AES-GCM authenticates it and a move makes
the tag fail.

That is why `create` mints the row id **before** the insert (`engine/execute.ts:252`): the AAD has
to bind to the row the value is about to live in.

## The blind index

```text
base64url( HMAC-SHA-256( indexKey(orgId), lower(trim(value)) ) )
```

Deterministic, so it leaks **equality and nothing else** — no ordering, no prefix, no length beyond
what a fixed-width MAC gives. Normalisation is `trim` then `lower`, so a lookup for `code-42 `
matches a value stored as `Code-42`.

The shadow column is framework bookkeeping and never leaves the server: `decryptRow` deletes every
`<field>_bidx` unconditionally, **after** its decryption loop, because the loop skips a field
holding no envelope (a null, or a value written before the field was encrypted) and those rows still
carry the column. There used to be a second delete inside the loop doing the same job for the subset
that did decrypt; it was dead, and removing the wrong one of the two would have leaked the column on
exactly the rows the loop skips (AUD-050).

## What ciphertext cannot do

Encrypted values are opaque to the database, so the framework refuses the impossible rather than
returning silently wrong answers. Most of it is caught at boot ([02-models.md](02-models.md)); these
are the runtime backstops:

| Attempt | Result |
|---|---|
| Any operator but `eq`, `ne`, `in` on an encrypted field | `400 <model>: "<field>" is encrypted and supports only equality lookup` |
| Equality on an encrypted field **without** a blind index | the same 400 |
| `x-unique` on an encrypted field without a blind index | `400 … is encrypted without a blind index and cannot be unique` |
| Grouping or measuring an encrypted field | `400 <model>: "<field>" is encrypted and cannot be aggregated or grouped` |
| Ciphertext that will not open | `500 {"error":"decryption_failed","requestId":"…"}` |

Equality *is* answered, by rewriting the filter onto the shadow column with the same HMAC applied to
the search term. Uniqueness compares blind indexes, never ciphertext.

A decryption failure is deliberately loud in one direction and silent in the other. Server-side:

```text
[<requestId>] DECRYPTION FAILURE model=note field=adminOnlyNote row=<id> — ciphertext moved, tampered, or wrong key
```

On the wire: a code and a request id. **Never serve a partial row** — fail, and say where, to the
operator only.

## Rotation

Adding a key and pointing `APP_DEK_ACTIVE` at it makes the next boot a data migration:
`rotateEncryptedFields` walks every model, every tenant, re-seals each encrypted value under the
active key and re-seals uploaded files too, then records a ledger row. Re-sealing uses the adapter's
`reseal`, which rewrites framework-owned bytes **without touching `updatedAt`** — a rotation that
made every row look freshly edited would corrupt every "recently changed" sort and report above it.

Rotating, end to end — add the key, name it active, restart:

```sh
head -c 32 /dev/urandom | base64 | tr -d '\n' > .data/dek2.key
JWT_SECRET_FILE=.data/jwt.key APP_DEK_FILE=.data/dek.key \
  APP_DEK_K2_FILE=.data/dek2.key APP_DEK_ACTIVE=k2 bun run dev
# re-sealed 1 row(s) and 1 file(s) under key id "k2"
```

Afterwards the envelopes name `k2`, the shadow column has been recomputed, equality search still
matches (`?where=searchableSecret:eq:CODE-42` → the row, whose `adminOnlyNote` decrypts to
`top secret`), and `GET /v0/file/note/<id>/attachment` still returns the original bytes. The ledger
then holds both passes:

```text
rotate:kid:k1  rotate  re-sealed 0 row(s) and 0 file(s) under key id "k1"
rotate:kid:k2  rotate  re-sealed 1 row(s) and 1 file(s) under key id "k2"
```

Four facts that are easy to get wrong:

- **A rotation is not optional bookkeeping.** An active key nothing is sealed under means the old
  key cannot be retired *and* every blind index is stale, because the index key derives from the
  active kid. Rotating without re-indexing is silent: rows still decrypt, and equality search finds
  nothing. That is why it finishes **before** the server accepts a request, not in the background.
- **Scope is never emptied for it.** The pass iterates `_orgs` and issues one scoped read per
  tenant, so the adapter's refusal of an unscoped query stays exactly where it is. A framework job
  gets no cross-tenant shortcut.
- **Idempotence comes from the ledger.** A completed pass writes `rotate:kid:<active>`, and a boot
  that finds it reads nothing at all.
- **It is restartable, not resumable.** The ledger row is written when the whole pass finishes, so a
  crash half-way leaves correctly re-sealed rows (their envelopes already name the active kid, so
  they are skipped) and repeats the read next boot. In the backlog.

An envelope naming a kid with no key material stops the boot, from `dataKey`'s own `unknown key id`.
That is the right answer: rotation is the one place that reads every envelope, so it is where a key
retired too early is found — loudly, at boot, rather than on some request months later.

## How to verify this layer

Look at the disk, not at the API:

```sh
sqlite3 -header .data/showcase.sqlite \
  "select id, title, adminOnlyNote, searchableSecret, searchableSecret_bidx from notes limit 1;"
```

```text
id|title|adminOnlyNote|searchableSecret|searchableSecret_bidx
1fe2bab3-…|with attachment|v1:k2:KdQEoUqzLjXm7MQh:eOZ6LClpeUbb0Y0g-gngmqXlWtZuYTFsz9Q|v1:k2:-amUjOAMMenVpfxy:Gr9OJQqI4VJ5tmffRB9By6XuG-qcf60|RoMa_cLuvZ6hE0-hyeRKgr5-YiIsdygaK0gMy42pu1A
```

`title` is plaintext because it declares no `x-encrypt`. Both encrypted fields are `v1:k2:…`
envelopes with different IVs — `k2` because this database has been rotated, see below. The blind index is a bare base64url MAC, carrying no envelope and no
key id — it is not ciphertext and is never decrypted, only compared.

Then prove the index works and the refusals hold:

```sh
curl -s -b c.txt --get --data-urlencode 'where=searchableSecret:eq:code-42 ' localhost:3000/v0/list/note
# matches the row stored as "Code-42" — trim and lower are applied to both sides

curl -s -b c.txt 'localhost:3000/v0/list/note?where=searchableSecret:gt:a'
# 400 … is encrypted and supports only equality lookup

curl -s -b c.txt -X POST localhost:3000/v0/aggregate/note -H 'content-type: application/json' \
  -d '{"groupBy":["adminOnlyNote"],"measures":[{"op":"count","as":"n"}]}'
# 400 note: "adminOnlyNote" is encrypted and cannot be aggregated or grouped
```

## Related

[08-files.md](08-files.md) · [09-secrets.md](09-secrets.md) · [06-persistence.md](06-persistence.md) ·
[02-models.md](02-models.md) · `ARCHITECTURE.md` §8

---

_Checked against the code 2026-09-16_ — `packages/core/src/crypto/keys.ts`, `crypto/field.ts`,
`crypto/pipeline.ts`, `db/rotate.ts`, `engine/execute.ts`, `errors.ts`. The dump and every status
above were produced against `bun run dev` on port 3000 and its `.data/showcase.sqlite`.
