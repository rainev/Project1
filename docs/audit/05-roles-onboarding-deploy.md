# 05 — Roles, onboarding, deployment

_Audited 2026-09-26 against the kit at `0351ec2` and App-Stack 1.7.0: `app/config/views/login.yaml`,
`views/admin.yaml`, the shipped UI bundle `.app-stack/dist/assets/index-*.js`, and the boot and
browser run earlier this session._

## 1. Reference

- **Roles.** Everyone does everything (owner, 2026-09-26), so there are two roles: **admin** (the
  owner) and **staff** (the team). The owner maintains routines, targets and locations; staff do the
  day's tasks, readings and batch moves.
- **Identity.** An app with a sign-in needs the administration of identity (who may join, as what,
  who changes it), not just the domain objects (`AGENTS.md` §design).
- **Deployment.** Railway, per `docs/DEPLOYING-RAILWAY.md`: Postgres, `JWT_SECRET`, a kept `APP_DEK`,
  `NODE_ENV=production`.
- **Reminders.** An email reminder is deferred (owner, 2026-09-26).

## 2. Ours today

- `/admin` adopts `OrgScreen` + `MembersScreen` and is admin-only (`views/admin.yaml`). It rendered
  this session with one member, and its invite form offers roles `staff`/`admin`, with new members
  defaulting to `staff`. `✔` driven in a browser
- `/login` has `LoginScreen` in sign-in mode only, with the hint "An account is created for you by an
  invite, or by the org's join code" (`views/login.yaml`). `✔`
- The first account was created this session through `POST /v0/auth/register` and became `admin`
  (response `201 … "roles":"admin"`). `✔`

## 3. Reuse check

| Need | Framework feature | Tag |
|---|---|---|
| Invite, deactivate, change role | `MembersScreen` (adopted) | `✔` driven |
| Join code, default role for new members | `OrgScreen` (adopted) | `✔` driven |
| A page where someone creates an account | `LoginScreen mode: register` | `✔` exists; see G5.1 for what it cannot send |
| Admin-only writes on routines, targets and locations | `x-access.write: "'admin' in actor.roles"` | `✔` pattern read in `ticket.yaml`/`05-gates.md` |

## 4. Flow

Owner deploys → registers first and becomes admin → invites each team member from **Admin** →
**team member opens the invite and creates an account** → signs in on a phone → **Today**.

**Where it breaks:** the bold step. The admin receives an invite token (shown once), but no screen
accepts it.

## 5. What backs it

- `LoginScreen` in register mode posts **email and password only**: the bundle's `LoginScreen` calls
  its register function with `(email, password)` and has no field for `inviteToken` or `joinCode`
  (`.app-stack/dist/assets/index-CJpM3Nmr.js`, the `LoginScreen` component). The API accepts both
  (`10-auth-and-sessions.md:38`). `✔`
- A register call without a token or code joins the **default org** with the org's `defaultRole`,
  after the founder rule (`10-auth-and-sessions.md:81`). For a single-farm app that is the right org,
  which means an open register page lets **anyone who finds the URL join the farm as staff**. `✔`
- Schedules and the outbox run inside the one app process, and the outbox assumes a single worker
  (`17-capabilities.md` §does not do). The hourly task generator only runs while the service is
  awake, so the Railway service must not sleep. `✔` read; Railway sleep behaviour `⚠` not checked
- Bun: this session the kit's `bun.lock` (lockfileVersion 2) was unreadable by bun 1.3.11 and
  installed cleanly with bun 1.4.2. `✔` observed

## 6. Gaps

| ID | Gap | Sev | Tag |
|---|---|---|---|
| G5.1 | **No in-app way for an invited person to join.** `LoginScreen` cannot send an invite token or join code. **Owner decision (2026-09-26): a sign-up page that is open only while the team registers, then removed; plus accounts the owner creates directly.** Anyone unexpected is deactivated from Members. The framework option (an invite field on `LoginScreen`) stays a request for a future App-Stack release. | P0 | `✔` owner-decided |
| G5.2 | Admin-only write on `routine`, `target` and `location`; staff write on `task`, `reading` and `batch` transitions; delete admin-only everywhere. | P1 | `✔` absent |
| G5.3 | **Owner decision: English only.** Remove the `languages` block from `app.yaml` and `locales/fil.yaml`, so no farm label needs a second string. | P1 | `✔` owner-decided |
| G5.4 | Railway: the service must stay awake for schedules, run as a single instance, use Postgres, keep `APP_DEK`, and build with bun ≥ 1.4. Network access from this cloud environment to Railway is blocked. | P1 | `✔` bun and blocked network observed; sleep `⚠` |
| G5.5 | The phone is the team's device, and the Today, reading and batch pages have not been driven at phone width. | P1 | `⚠` |
| G5.6 | Email reminder deferred by the owner. | — | `✔` deferred |
