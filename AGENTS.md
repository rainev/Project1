# App-Stack Kit — working agreement

You are working on an **App-Stack application**. `README.md` describes what it is and how to run it.
This file is what an agent must not get wrong.

## Read the reference before writing config

**[`docs/reference/stack/17-capabilities.md`](docs/reference/stack/17-capabilities.md) first.** It
indexes the framework by what you need it for, and states what it does **not** do.

**A keyword that is not in that reference does not exist.** There is no `x-webhook`, no `x-cron`, no
`x-permissions`. If a capability seems missing, say so rather than inventing a spelling for it.

## The rules

1. **`bun run unpack && bun install` before anything runs.** `.app-stack/` is built from the tarball
   in `vendor/`, not committed, so `bun run start` fails on a fresh clone until it has.
   `Cannot find module '@appstack/core'` means this step was skipped.
2. **Never edit `.app-stack/`.** It is gitignored and rebuilt from `vendor/` on every build, so an
   edit there cannot ship. If the framework is wrong, stop and say so: the fix is a new App-Stack
   release and a version bump here.
3. **Restart after every config change.** Config compiles at boot. A YAML edit with no restart
   changes nothing, and an unchanged page is the expected result.
4. **Let boot be the first test.** A misspelt prop, state, field, icon or model refuses startup and
   names the alternatives. Read the message rather than guessing.
5. **Write YAML in block style.** A comma inside a flow mapping ends the entry, an unquoted `#`
   starts a comment, and a colon turns a list item into a mapping. Boot refuses all three by name.
6. **Drive the journey, not the page.** Sign in as the actor who will use it and complete the flow.

## What belongs in config

| In config | Never in config |
|---|---|
| Role names — `'admin' in actor.roles` | Credentials of any kind |
| Policy — `x-access`, `x-scope`, `x-field-access` | Account identities — a username, a login, an address |
| Model and field names, states, transitions | Anything that differs per deployment — host, port, URL |

The test: **would this value be different on someone else's deployment?** If yes it belongs in the
environment. Secrets resolve through `secretRef`; a notification provider's host, port, account and
endpoint through `{ env: NAME }`.

## Two rules for design

**An app with a sign-in needs the administration of identity, not only the domain object.** Who may
join, what they may be, who changes it. The framework ships `_users`, `_orgs`, `_invites` and the
`MembersScreen` / `OrgScreen` pair; `app/config/views/admin.yaml` adopts them in four lines. Without
it an app authenticates and cannot be operated, and no test fails, because what is missing is a
surface rather than a behaviour.

**Never keep two fields that mean one thing.** A lifecycle state and a visibility flag are one fact:
scope the visitor to the state. Two fields drift, and the drift is silent — the state moves, the
flag does not, and the page a visitor sees stops matching what the grid says.

## Where this project's own record lives

| | |
|---|---|
| [`docs/plans/ROADMAP.md`](docs/plans/ROADMAP.md) | the initiatives that are live, one line each |
| `docs/plans/<INITIATIVE>.md` | one file per initiative, phased |
| [`docs/audit/00-index.md`](docs/audit/00-index.md) | the gap register |
| `.claude/goodbehavior/memory/` | traps this project hit, one fact per file |

All four start empty. **They are yours** — nothing in them is inherited, and nothing about how the
framework was built belongs in them. The framework's own traps ship separately, under
[`docs/reference/learnings/`](docs/reference/learnings/), and are read rather than added to.

## Verifying

`.claude/skills/` carries the method: `/audit-goodbehavior` to find gaps, `/roadmap-goodbehavior` to
sequence them, `/gate-build-goodbehavior` to work through them, `/verify-goodbehavior` to prove one
is done.

This project runs the `development` profile: the real thing is the running app, verifying is driving
the flow as its user, evidence is observed runtime behaviour. For work that is not software, choose
from [`.claude/goodbehavior/profiles/INDEX.md`](.claude/goodbehavior/profiles/INDEX.md) — a project
may take different slots from different profiles, and none of them fitting is not a reason to skip
the discipline.

**Done means the real thing worked, driven the way its user would drive it, with evidence, and the
owner confirmed it.** A passing boot is not done.
