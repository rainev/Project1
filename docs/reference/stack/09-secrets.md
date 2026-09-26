# Secrets

One seam. A caller names a variable; it never sees a file path, a vault client, or a default.

```ts
import { secret } from '@appstack/core';
const key = secret('JWT_SECRET');
```

## The rules

`secret(name)` (`packages/core/src/secrets.ts:30`) resolves from `NAME`, or from the file `NAME_FILE`
points at. The file form is the orchestrator convention (Docker, Kubernetes): the value is mounted,
so it never appears in the environment or in a process listing.

| Situation | Result |
|---|---|
| `NAME` set | that value |
| `NAME_FILE` set | the file's contents, with **one** trailing newline stripped |
| **Both** set | `both NAME and NAME_FILE are set; set exactly one` |
| `NAME_FILE` unreadable | `NAME_FILE points at <path>, which could not be read: <errno code>` |
| Neither set, or empty, or an empty file | `NAME is not set (provide NAME, or NAME_FILE pointing at a file containing it)` |

Four deliberate choices in that table:

- **Ambiguity is a deployment bug**, not something to silently resolve. Two sources is an error,
  never "the environment wins".
- **Empty is missing.** An empty variable and an empty file both fail rather than yielding an empty
  secret — the same stance the derived schema takes to a required empty string.
- **The error names the source, never the value.** An unreadable file reports its path and the errno
  code; nothing ever logs what it contains.
- **It throws at boot, not at first request.** Resolution happens during `createApp`, so a
  misconfigured deployment fails to start rather than failing the first user.

Values are cached per name, so a secret is read once. `{ optional: true }` returns `undefined`
instead of throwing — used by `DATABASE_URL`, which has a per-app default.

## What resolves through it

| Name | What it is |
|---|---|
| `APP_DEK` | Data-encryption key id `k1` ([07-encryption.md](07-encryption.md)) |
| `APP_DEK_<KID>` | A further data key — `APP_DEK_K2` is kid `k2` |
| `JWT_SECRET` | Signs sessions ([10-auth-and-sessions.md](10-auth-and-sessions.md)) |
| `DATABASE_URL` | A connection string with a password in it **is** a secret |
| Whatever a provider's `secretRef` names | A webhook signing key, an SMTP password (below) |

Each has its own `_FILE` form, `APP_DEK_K2_FILE` included.

`APP_DEK_ACTIVE` is **not** a secret and not resolved through this seam: it names a key id, it is
not one. Nor are the operational knobs in `limits.ts` — a page size is not confidential. Both are
plain environment variables, which is why `resolveDataKeys` explicitly skips `ACTIVE` and `FILE`
when scanning for `APP_DEK_*`.

## Development fallbacks

Outside production (`NODE_ENV !== 'production'`), a missing `APP_DEK` or `JWT_SECRET` boots on an
ephemeral random value with a warning that says exactly what it costs:

```text
WARNING: APP_DEK is not set. Using an ephemeral development data key — encrypted values will not
survive a restart. Production refuses to boot without it.
WARNING: JWT_SECRET is not set. Using an ephemeral development secret — every restart invalidates
all sessions. Production refuses to boot without it.
```

**Production refuses to boot without either.** For local work, keep real key files and point at
them — and keep them in `.data/`, not `.tmp/`, which Bun clears:

```sh
head -c 32 /dev/urandom | base64 | tr -d '\n' > .data/jwt.key
head -c 32 /dev/urandom | base64 | tr -d '\n' > .data/dek.key
JWT_SECRET_FILE=.data/jwt.key APP_DEK_FILE=.data/dek.key bun run dev
```

## Config names secrets; it never carries them

`assertNoLiteralSecrets` (`secrets.ts:75`) runs inside the shared config loader, on **every**
document of **every** family, before the meta-schema. It walks the parsed YAML and refuses any
string that looks like key material:

- a PEM block — `-----BEGIN … PRIVATE KEY-----`
- a run of 40 or more base64 characters

```text
SecretError: models/note.yaml.x-access.read: looks like literal secret material; use secretRef instead
```

### What config may carry, and what it may not

The guard above is a heuristic. **This rule is not**, and it is the one to hold an app to:

| Config may carry | Config may not carry |
|---|---|
| **Role names** — `roles: [admin]`, `'staff' in actor.roles` | **Credentials** — a password, token, key, or connection string |
| **Policy** — `x-access`, `x-scope`, `x-field-access` | **Account identities** — a username, a login, a specific person's address |
| **Model and field names**, states, transitions | **Anything that differs per environment** — a host, a port, an endpoint URL |
| **Expressions that read a row** — `to: row.email` | **A literal that stands in for a row** — `to: [someone@example.com]` |

The left column is the application's own vocabulary: it is the same in every environment, it is
meaningless to an attacker who has the repository, and it is exactly what a reader needs to see to
understand what the app does. **The right column is deployment, and deployment belongs in the
environment.**

The distinction that catches people is **identity versus role**. `'admin' in actor.roles` names a
capability and belongs in config forever. `user: app-stack` names an account, and an account has a
password, an owner, and a lifecycle — it belongs in the environment even though it is not itself
secret. A reviewer asking "would this value be different on someone else's deployment?" gets the
right answer every time.

### `secretRef` — the consumer arrived

`secretRef` was reserved as the eventual spelling for "this config field NAMES a secret", and this
document said in as many words that nothing consumed it. **Notification providers are what needed it** (WP-06
W-120): a webhook signing key and an SMTP password are exactly the material the guard above refuses
to let an author paste into YAML, so the config carries the variable's NAME and the framework
resolves it here.

```yaml
# config/notifications.yaml
providers:
  ops-webhook:
    type: webhook
    url: http://127.0.0.1:47331/hooks/note
    secretRef: WEBHOOK_SIGNING_SECRET     # the NAME. Never the value
```

It resolves through `secret()` at **boot**, so `WEBHOOK_SIGNING_SECRET_FILE` works exactly as
`JWT_SECRET_FILE` does, with the same table of outcomes above. What the provider does with it is
what makes it a real consumer rather than a stored string: the webhook sender signs the exact bytes
of each request, `x-appstack-signature: sha256=…`, and the browser gate's own receiver verifies it
with the sender's `sign` function.

Three rules it inherits from the seam, and one it adds:

- **Resolved once, at boot** — a provider whose variable is missing fails startup in production.
- **Outside production it warns and sends unsigned**, in the same words and for the same reason
  `APP_DEK` and `JWT_SECRET` do: a developer machine has no signing key, and the warning says what
  it costs. Production refuses, because a webhook that quietly stops being signed is worse than one
  that does not send — a receiver cannot tell "unsigned" from "forged" unless somebody decided in
  advance it would always be signed.
- **The value never leaves the process**: not into the projection, not into an expression, not into
  an error. A provider that cannot resolve its secret names itself and the variable it wanted.
- **Nor into a message about a failure.** SMTP's `AUTH LOGIN` sends the password as its own
  protocol line, so a rejected login would have put it in an error string and from there into
  `_outbox.lastError` and an audit row. Every command that carries a credential is labelled, and
  `packages/core/test/notify.test.ts` asserts the error does not contain the credential just sent —
  which is how that leak was found rather than shipped.

### `{ env: NAME }` — for what sits beside the secret

A provider is the one part of config that describes **deployment** rather than the application: a
host, a port, the account to authenticate as, the address operations watch, the URL a webhook posts
to. `secretRef` covers the password. This covers the rest, which is why `user: app-stack` used to sit
in a file every fork of the repository carried — it was not secret, so it had nowhere else to go.

```yaml
# config/notifications.yaml
providers:
  mailer:
    type: email
    host: { env: SMTP_HOST, default: 127.0.0.1 }   # default: local convenience
    port: { env: SMTP_PORT, default: 2525 }        # arrives as a number
    user: { env: SMTP_USER }                       # no default: an account
    secretRef: SMTP_PASSWORD                       # the credential, as before
```

| | |
|---|---|
| **Unset, with a `default`** | the default, so a fresh checkout boots with nothing set |
| **Unset, no `default`** | `providers.mailer.host reads SMTP_HOST from the environment, which is not set (set SMTP_HOST, or give this field a `default`)` |
| **Set to an empty string** | **unset** — the same stance `secret()` takes |
| **A field wanting a number** | converted; `"587"` becomes `587`, and `"not-a-port"` is refused where it was read |
| **Anything beside `env` and `default`** | refused — the form is closed, like every other here |

Three choices worth naming:

- **It refuses at boot rather than defaulting to empty.** Trading a hardcoded value for a silent
  empty one is worse: a mailer with no host fails at the first send, to nobody, long after the
  deploy that caused it.
- **It resolves before the meta-schema runs**, so the schema validates the resolved document and
  knows nothing about this form. That is why a port arrives as an integer rather than the schema
  being loosened to accept a string.
- **A `default` is for local development and must never be a credential.** The literal-secret guard
  runs over the document as written, before anything resolves, so a default cannot be key material —
  and the rule above is what covers the rest. **A field naming an account should not carry one.**

### A recipient may come from a row; a credential never may

WP-11 let a `notify` declaration name **who** a message is for, from the row it is about
(`to: row.email`) — which is the whole of AUD-067, since a confirmation has to reach the participant
rather than the operator. That is a per-message value and it is data.

It draws a line this document is the place to state. What a declaration may name is the
**recipient** and the **body**. What it may never name is anything that decides *where the message
goes* or *what we authenticate as*: `host`, `port`, `from`, `user` and `secretRef` stay in
`config/notifications.yaml`, fixed at boot, and the `notify` schema is closed against all five —
asserted by test, not merely by convention. A row that could set `secretRef` would be choosing which
secret to spend; a row that could set `host` would be choosing where to spend it.

Two consequences worth naming:

- **The provider's `to` remains the default.** A declaration that names no recipient still sends to
  the operator address in the config, so an operator webhook or mailbox is unchanged by this
  existing, and a template that resolves to nothing loses nothing.
- **A recipient is read at delivery time, through the gates.** `_outbox.payload` holds ids and names,
  never row values — an address written there would be plaintext sitting beside the ciphertext of
  the field it came from. So the row is fetched when the message is sent, via `ctx.call('get', …)`,
  which re-applies access, scope and field-read as the actor who caused the event. A field that
  actor may not read is absent, and therefore cannot be mailed anywhere.
- **A row value reaching a header is an injection surface.** CR and LF are refused in an address and
  in a subject — at the declaration and again at the socket — rather than stripped, because silently
  sending a subject other than the one declared is its own defect.

## Limits worth knowing

- **No vault integration.** The `_FILE` convention is the integration point: whatever mounts the
  file — Docker secrets, a Kubernetes projected volume, a sidecar — is outside this seam by design.
- **The literal-secret guard is a heuristic.** It catches PEM blocks and long base64 runs; a short
  password in config passes it. Measured 2026-09-24: a plain password, a Stripe `sk_live_…` key, a
  GitHub `ghp_…` token, a JWT and a `postgres://user:pass@host/db` URL all pass it, because each
  carries a character outside the base64 class or falls under 40 characters. It is a papercut guard,
  not a boundary, and the rule above is what actually holds.
- **Env references are a provider keyword, not a config-wide one.** `{ env: NAME }` works on
  notification providers and nowhere else, because that is the only place any config family carries
  a deployment value — checked across every app and example on 2026-09-24. Generalising it if a
  second family ever needs one is a smaller change than un-generalising it.
- **Cached for the process lifetime.** Rotating `JWT_SECRET` means a restart. Rotating `APP_DEK`
  means a restart *and* a data migration ([07-encryption.md](07-encryption.md)).

## How to verify this layer

```sh
# both forms set — refuses
JWT_SECRET=x JWT_SECRET_FILE=.data/jwt.key bun -e \
  'import {secret} from "./packages/core/src/secrets.ts"; try { secret("JWT_SECRET") } catch (e) { console.log(e.message) }'
# both JWT_SECRET and JWT_SECRET_FILE are set; set exactly one

# an empty file is missing
: > /tmp/empty.key
JWT_SECRET_FILE=/tmp/empty.key bun -e \
  'import {secret} from "./packages/core/src/secrets.ts"; try { secret("JWT_SECRET") } catch (e) { console.log(e.message) }'
# JWT_SECRET is not set (provide JWT_SECRET, or JWT_SECRET_FILE pointing at a file containing it)
```

`packages/core/test/secrets.test.ts` covers the same table as unit tests; the runs above are what
prove the message reaches an operator.

## Related

[01-configuration-and-boot.md](01-configuration-and-boot.md) · [07-encryption.md](07-encryption.md) ·
[10-auth-and-sessions.md](10-auth-and-sessions.md) · `ARCHITECTURE.md` §10

---

_Checked against the code 2026-09-16_ — `packages/core/src/secrets.ts`, `app.ts`,
`config/loader.ts`, `db/factory.ts`, `limits.ts`.
