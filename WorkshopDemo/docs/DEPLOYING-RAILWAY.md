# Deploying to Railway

Written for a person and for the agent helping them. **The agent's job here is to ask four
questions, set the variables, and check four things** — not to guess at values that only the owner
can supply.

## What the application actually requires

Everything below was read from the framework this kit vendors, not from a deployment that happened
to work.

| Variable | Required? | What happens without it |
|---|---|---|
| `JWT_SECRET` | **yes** | Sessions cannot be signed. Also accepts `JWT_SECRET_FILE`. |
| `APP_DEK` | **yes** | The data-encryption key. Also accepts `APP_DEK_FILE`. |
| `DATABASE_URL` | **yes on Railway** | Falls back to SQLite under `.data/`, which a container filesystem throws away on every redeploy. |
| `PORT` | supplied by Railway | The server reads it; do not hardcode one. |
| `PLATFORM_ADMINS` | no | Only for the reserved cross-tenant role. |
| `SMTP_*`, `OPS_*` | **only if the app sends** | `notifications.yaml` is optional; delete it and none of these matter. |

**`APP_DEK` is the one that punishes a shortcut.** Rotate or lose it and every encrypted field
becomes unreadable and every blind index stops matching — the rows are still there and still wrong.
Set it once, keep it somewhere you can recover it, and never let a redeploy generate a new one.

## What the agent should ask before touching anything

1. **"Does this app need to send email or call a webhook?"** If no, delete `app/config/notifications.yaml`
   and skip every `SMTP_*` and `OPS_*` variable. Most workshop apps do not send.
2. **"Is this app multi-tenant, or one organisation?"** It changes nothing in deployment and
   everything in the config review — see `reference/stack/05-gates.md`.
3. **"Who is the first admin?"** The first account registered on an empty instance creates the
   first organisation and becomes its admin. Decide who does that before the URL is shared.
4. **"Is there data that must survive?"** If yes, Postgres and a kept `APP_DEK` are not optional.

**Never generate `JWT_SECRET` or `APP_DEK` into a file in the repository, a chat message, or a
commit.** Generate them in Railway's own variable editor, or have the owner paste them there.

## The steps

```sh
# 1. Postgres first, so DATABASE_URL exists before the app boots.
#    In Railway: New → Database → PostgreSQL. It publishes DATABASE_URL.

# 2. The service, from the fork.
#    New → GitHub Repo → <your fork>. Railway builds with Bun automatically.

# 3. Build and start commands.
#    Build:  bun run unpack && bun install
#    Start:  bun run start
```

**This is the only place the unpack step has to be thought about.** `.app-stack/` is built from the
tarball in `vendor/` rather than committed, so it does not exist on a fresh clone of the fork — the
build command is what creates it, once, on every deploy. Nobody types it again.

`bun run unpack` must come **before** `bun install`: it extracts the framework, and `bun install` is
what links the workspace to what it extracted. Reversing them gives
`Cannot find module '@blitzpi/core'` at boot, and it is the single most likely reason a first deploy
fails.

A `preinstall` hook cannot fold the two into one: Bun resolves the workspace list before
`preinstall` runs, so the unpack happens, nothing links to it, and a second `bun install` does not
repair it. Two commands, in that order.

### Putting those two commands in the repository

Typing them into the dashboard once is fine, and is what the steps above assume. If you would rather
the fork carry them:

**Do not add `railway.json` or `railway.toml`.** Railway deprecated Config as Code and those files
**stop being read on 2026-12-01**, a hard cutoff.

The replacement is Infrastructure as Code — a `.railway/railway.ts` evaluated by the Railway CLI
rather than at deploy time:

```ts
// .railway/railway.ts — needs `npm install railway`
import { defineRailway, project, service } from 'railway/iac';

export default defineRailway(() => {
  const web = service('web', {
    build: 'bun run unpack && bun install',
    start: 'bun run start',
    healthcheck: '/health',
  });
  return project('app-stack-kit', { resources: [web] });
});
```

`railway config plan` previews it; `railway config apply` commits it.

The shape above is from Railway's documentation and has not been run against a real project. Apply
it in your fork once `railway config plan` reports what you expect.

```sh
# 4. Variables. Reference Postgres rather than pasting its URL, so a rotated
#    database does not leave a stale literal behind:
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<generate>
APP_DEK=<generate>
NODE_ENV=production
```

**`NODE_ENV=production` tightens the framework**, it does not merely label the deploy: a notification
provider naming a `secretRef` that is not set refuses the boot instead of warning and sending
unsigned.

## What the agent should check, in this order

```sh
# 1. It answers at all.
curl -s -o /dev/null -w '%{http_code}\n' https://<app>.up.railway.app/health

# 2. The public page renders for someone with no account.
curl -s https://<app>.up.railway.app/ | head -c 200

# 3. Registration works, and the first account becomes an admin.
curl -s -X POST https://<app>.up.railway.app/v0/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"<owner>","password":"<theirs>"}'

# 4. The data survived a redeploy. Redeploy, then read the row back.
```

**Check 4 is the one people skip and the one that matters.** A service on SQLite passes the first
three every time and loses every row on the next deploy. If a row written before a redeploy is
readable after it, the database is real.

**Then read the logs once.** A boot that refuses says which file and which line; a boot that warns
about a `secretRef` is telling you production will refuse it later.

## When it will not boot

The failure is almost always one of four, and the log says which:

| Log says | It means |
|---|---|
| `Cannot find module '@blitzpi/core'` | `bun install` ran before `bun run unpack`, or not at all |
| `JWT_SECRET is not set` | the variable is missing, or set on the wrong service |
| `config error in models/….yaml: …` | your config, named precisely — fix the file, redeploy |
| `view error in views/….yaml: …` | same, for a page |

**Config compiles at boot and only at boot**, so a YAML fix needs a redeploy to take effect. A page
that looks unchanged after an edit is the expected result, not a clue.
