# Uploads and files

Uploaded bytes go through the same key path as fields, so ciphertext — not plaintext — is what lands
in every dump, backup and stolen disk image. Filesystems are not transactional, so bytes are
**staged** and only promoted once the database transaction commits.

## Declaring it

```yaml
attachment:
  type: string
  format: binary
  x-upload:
    accept: [text/plain, application/pdf, image/png]
    maxSize: 1MB
```

`format: binary` is what marks the property; `x-upload` only refines it. `accept` is a list of media
types (empty means any); `maxSize` is digits plus `B`, `KB`, `MB` or `GB`. A declared size always
wins — `UPLOAD_DEFAULT_MAX_SIZE` (50MB) answers only for a property that declared none. The property
must not be transient.

## Two ways in, one thing the engine accepts

**Staged first** — `POST /v0/stage/<model>/<property>` with one file part, which is what a form
does: the row does not exist yet.

```json
{ "ref": "stage:0506dbdd-…", "name": "upload.txt", "size": 25, "contentType": "text/plain;charset=utf-8" }
```

**Multipart in one shot** — `POST /v0/create/<model>` as `multipart/form-data`. Each file part is
staged the same way, and the intake puts the same `stage:<id>` reference into the data.

Both paths hand the engine **a reference and nothing else**. A caller may not send a descriptor: its
`name`, `size` and `contentType` are what every later download reports, and its `id` is what the
download route reads bytes by — so a descriptor sent whole would let a caller dress one file up as
another, or point a row they may write at a file belonging to a row they may not read. The engine
looks the descriptor up from the adapter's own copy (`execute.ts:226`) and refuses anything else:

- `"<property>" must be an upload reference from /v0/stage/<model>/<property>`
- `"<property>" references a staged upload that is not available` — expired, already used, or
  somebody else's

The row stores the descriptor as JSON:

```json
{"id":"0506dbdd-…","name":"upload.txt","size":25,"contentType":"text/plain;charset=utf-8",
 "checksum":"4176e710…","kid":"k2"}
```

`size` and `checksum` (SHA-256) describe the **original**: the caller asked about their file, not
about our envelope. `kid` is the key the bytes were sealed with, playing the same role it plays in a
field's envelope so rotation never orphans a file.

## Gates first, always

Writing bytes to disk is a side effect, so the gates run before the body is read
(`http/intake.ts:194`):

1. The **model-level** access gate, with no row — staging precedes the record it will belong to. It
   runs before the property is even looked at, because which of a model's fields take a file is part
   of the shape projected per actor, not public.
2. Then `canWrite` for the property.
3. Then `content-length` against twice `maxSize`, so an honest sender is rejected before buffering.
4. Then the part itself: `size` against `maxSize`, and the media type against `accept` — compared
   after stripping parameters, because browsers send `text/plain;charset=utf-8` and the allowlist is
   about the type.
5. Then **the bytes**, against the type the caller declared.

## The bytes decide, not the caller (AUD-069)

`File.type` on a multipart part is whatever the client put in the part's `Content-Type` header, so
until WP-11 `accept` was an allowlist matched against a string the *attacker chose*. A payload
announced as `image/png` passed the allowlist, was staged under that type, and was later **served**
under it, because the descriptor records the declared type and `GET /v0/file/…` streams it back as
that `Content-Type`.

`files/signature.ts` reads the leading bytes — 32 of them, so the cost does not scale with the
upload — and refuses a file whose content contradicts what it claims to be. Two directions, and both
are needed:

1. The declared type **has** a known signature: the bytes must carry it. A PNG announced as
   `application/pdf` has no `%PDF-`, so it is refused.
2. The declared type has **no** known signature — a textual type the table cannot pin down: the bytes
   must not carry some *other* format's. PNG bytes announced as `text/plain` are refused, because the
   content is demonstrably a format the declaration denies.

A type the table does not know, carrying bytes it cannot identify, is accepted. The table's job is to
prove a contradiction, not to become a second allowlist — `accept` remains the allowlist. Types that
genuinely share a signature agree: every OOXML document is a zip, so a `.docx` whose bytes begin
`PK\x03\x04` is not a mismatch.

**The check runs before `stage`, on both paths.** That is what makes "a refused upload leaves nothing
staged" true by construction rather than by a cleanup path that might not run.

## On disk

```text
<filesDir>/.staging/<orgId>/<id>        staged bytes, sealed
<filesDir>/.staging/<orgId>/<id>.json   the descriptor, the server's own copy
<filesDir>/<orgId>/<id>                 promoted after commit
```

`filesDir` defaults to `.data/files` relative to the process cwd. Layout inside a file is
`iv (12 bytes) || ciphertext+tag`, AES-GCM, **AAD = `file:<orgId>:<id>`** — so bytes cannot be
swapped for another tenant's by moving them on disk, exactly as a field's AAD binds a value to its
row. Bytes are sealed *before* they touch the disk, so even a crash between stage and finalise
leaves ciphertext behind.

Staging is a directory **per tenant**. It used to be flat, and `finalise(orgId, id)` renamed out of
it using whichever org asked — unreachable while staging and finalising happened inside one request
under one identity, but `POST /v0/stage` splits them across two requests. An id that leaked to
another tenant would then have let them finalise bytes they did not stage: they could not read them
(the AAD binds to the staging tenant) but they could take them, and the owner's upload would vanish.
Scoping the directory removes the move rather than relying on the id staying secret.

## The transaction decides

| Outcome | Bytes |
|---|---|
| The request threw | every staged file is **discarded** |
| The request committed | staged files are **finalised** (renamed into place), and files belonging to deleted rows are **removed** |
| Neither — a crash | the leftovers are **swept** at the next boot |

A delete queues its removals during the operation and performs them only after commit: a rollback
must leave the file exactly where the row is.

## Downloading

`GET /v0/file/<model>/<id>/<property>` runs the **full read path first** — a real engine `get`, so
access, scope and field-read policy all apply before a byte is streamed. A property the actor may
not read is already absent from the projection, and absent is indistinguishable from "no file":
both are `404 not_found`.

```text
HTTP/1.1 200 OK
Content-Type: text/plain;charset=utf-8
Content-Disposition: attachment; filename="upload.txt"
Cache-Control: private, no-store
Content-Length: 25

hello from a real upload
```

Bytes are read and decrypted **whole**, not streamed, because AES-GCM authenticates over the entire
message: the tag cannot be checked until the last byte, and streaming plaintext before that would be
serving unverified data. That is fine at the sizes `x-upload.maxSize` permits; chunked framing is
what large files would need. A tag that fails is a `DecryptionFailure` — loud server-side, a code
and a request id on the wire, never partial bytes.

## Limits worth knowing

- **The janitor runs once, at boot.** `files.sweep(0)` in `createApp`. There is no ongoing sweep, so
  a long-running server accumulates the stages of every request that died between `POST /v0/stage`
  and its create (AUD-063).
- **Whole-file read.** See above; it bounds practical upload size well below `maxSize`'s ceiling.
- **One adapter.** `FileLocalImpl` writes to the local filesystem. The seam mirrors `DBAdapter`, so
  object storage is a second implementation rather than a change here.
- **Signatures, not parsing.** The byte check proves the leading bytes contradict the declaration. It
  is not a validator: a well-formed header on a corrupt or hostile file still passes, and a format
  with no fixed signature (SVG, CSV, JSON) can only be caught in the second direction above. Treat it
  as removing the cheapest lie, not as making an upload safe to render — the `Content-Disposition:
  attachment` on the download path is still what stops a browser executing one.

## How to verify this layer

Stage, attach, download, then look at the disk:

```sh
echo "hello from a real upload" > /tmp/upload.txt
REF=$(curl -s -b c.txt -X POST localhost:3000/v0/stage/note/attachment \
        -F "file=@/tmp/upload.txt;type=text/plain" | jq -r .data.ref)
curl -s -b c.txt -X POST localhost:3000/v0/create/note -H 'content-type: application/json' \
  -d "{\"title\":\"with attachment\",\"attachment\":\"$REF\"}" | jq -r .data.attachment
curl -s -D- -b c.txt localhost:3000/v0/file/note/<id>/attachment

find .data/files -type f
head -c 32 .data/files/<orgId>/<fileId> | xxd
```

The last two are the point: one file per tenant directory, and its first bytes are the random IV
followed by ciphertext — `grep` for the plaintext finds nothing.

## Related

[07-encryption.md](07-encryption.md) · [04-dispatch-and-pipeline.md](04-dispatch-and-pipeline.md) ·
[02-models.md](02-models.md) · `ARCHITECTURE.md` §9

---

_Checked against the code 2026-09-16_ — `packages/core/src/files/adapter.ts`, `files/local.ts`,
`http/intake.ts`, `engine/execute.ts`, `limits.ts`, `app.ts`. The descriptor, the response headers
and the on-disk bytes above were produced against `bun run dev` on port 3000.
