# App-Stack Kit

A working application you fork to start your own. **Everything this app does, it declares in
`app/config`.** There is no application source here; App-Stack arrives as a versioned release in
`vendor/`, which `bun run unpack` extracts into a gitignored `.app-stack/`.

```sh
bun run unpack && bun install     # required first — extract the framework, link the workspace
cp .env.example .env
bun run start                      # http://localhost:3000
```

Register the first account: it creates the first organisation and becomes its admin.

## What is here

| Page | Shows |
|---|---|
| `/` | a page a visitor may see, with no account and no session |
| `/articles` | a form and a grid — server sort, filter, paging, a relation column, row actions |
| `/board` | the same lifecycle drawn as lanes |
| `/articles/:id` | a detail page and the row's audit history |
| `/insights` | a declared query, drawn as a report and a chart |
| `/admin` | the organisation, its members and its invitations |

Two models carry it: `article` — a lifecycle, a relation, a field only editors may read, an upload —
and `topic`, the relation's target.

```
app/config/
  models/*.yaml      resources — storage, API, gates, schemas
  views/*.yaml       routes and component trees
  queries/*.yaml     declared joins, filters, measures
  theme.yaml         design tokens
  icons.yaml         this app's drawings
app/hooks/*.ts       the code escape hatch, referenced as path#export
vendor/              the framework, packaged
```

## Documentation

| | |
|---|---|
| [`docs/FORKING.md`](docs/FORKING.md) | Fork it, strip it back, take later improvements |
| [`docs/DEPLOYING-RAILWAY.md`](docs/DEPLOYING-RAILWAY.md) | What to set, what to ask, what to check |
| [`docs/reference/stack/17-capabilities.md`](docs/reference/stack/17-capabilities.md) | What the framework does, indexed by need — and what it does not |
| [`docs/reference/stack/16-building-a-feature.md`](docs/reference/stack/16-building-a-feature.md) | One feature across every layer, in the order you work |
| [`docs/reference/stack/`](docs/reference/stack/) | The full reference, for the version this app runs |
| [`docs/reference/learnings/`](docs/reference/learnings/) | The traps that bite an app author |

`docs/reference/` is committed and readable on a fresh clone. `bun run sync-reference` regenerates
it from `vendor/` whenever the framework version changes.

## Two rules

**Config compiles at boot and only at boot.** A YAML edit does nothing until the process restarts,
and an unchanged page after an edit is the expected result.

**`.app-stack/` is rebuilt from `vendor/` on every build.** An edit there cannot ship and is gone at
the next unpack. A missing component, prop or keyword is a framework change: fix it in App-Stack, cut
a release, drop the tarball in `vendor/`, bump `.app-stack-version`.

## Tracking your own work

`docs/plans/ROADMAP.md`, `docs/audit/` and `.claude/goodbehavior/memory/` start empty and are yours to
fill. The skills below write into them: audit finds the gaps, roadmap sequences them, gate-build
works through them one at a time, and each records what it learned where the next session will look.

## Skills and profiles

`.claude/skills/` carries the GoodBehavior method and the App-Stack skills, project-scoped and yours
to edit.

`.claude/goodbehavior/profiles/` carries four profiles, and this kit runs `development`. A profile
fixes what "done" means for a kind of work — the real thing, what verifying is, what counts as
evidence. For a fork whose output is a dataset, research, or something written for an audience,
choose from [`INDEX.md`](.claude/goodbehavior/profiles/INDEX.md) instead.
