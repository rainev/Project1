---
name: init-app-stack
description: Start a new App-Stack application from nothing — scaffold, first model, first page, first boot. Use when creating an app on App-Stack, or when adopting App-Stack in an empty or non-App-Stack directory.
---

Stand up a working App-Stack application from an empty directory.

**App-Stack is configuration-first.** An app declares models, views and queries in YAML; the
framework compiles them at boot and serves the database, HTTP API, policy gates and UI from those
declarations. Code is the escape hatch, not the medium.

**The framework is packaged, not vendored.** It arrives as a release tarball and is extracted into a
gitignored directory. There is no framework source to edit in an app, deliberately.

**Vocabulary:** the framework is **App-Stack**. BlitzPi is the agent and governance layer around it.
Config is App-Stack config; never call the framework BlitzPi.

---

## What you are producing

```
my-app/
├── app/
│   ├── config/              ← the application. All YAML.
│   │   ├── models/ views/ queries/
│   │   ├── theme.yaml  notifications.yaml  icons.yaml
│   │   └── assets/          ← the app's own images, served by route
│   └── hooks/               ← the code escape hatch, referenced as path#export
├── vendor/app-stack-<version>.tar.gz   ← the framework, opaque, committed
├── .app-stack/              ← extracted at build time. GITIGNORED.
├── .app-stack-version
├── README.md  AGENTS.md
├── package.json             ← four runtime deps, one start script
└── .env.example  .gitignore
```

## Phase 0 — Before scaffolding, ask what the app is

**Three questions, once, before any file.** Their answers decide the first model and the first
route, and guessing them costs a rewrite:

1. **What resource does this app manage?** That is the first model — the noun a row represents.
2. **Who uses it, and are any of them anonymous?** That decides `x-access` and whether a page is
   `anonymous: true`.
3. **What is the one journey that must work on day one?** Build that, end to end, before anything
   else.

If the directory already contains an app in another framework, **stop and use
`migrate-to-app-stack`** — a transfer maps journeys before writing config, and this skill does not.

## Phase 1 — Scaffold

Extract the release, write the shell, install.

```sh
tar xzf vendor/app-stack-<version>.tar.gz -C .app-stack --strip-components=1
bun install
```

`package.json` declares `.app-stack/packages/*` as workspaces and one script:

```
bun run .app-stack/packages/cli/src/run.ts app/config --dist .app-stack/dist
```

**Gitignore `.app-stack/`.** It is rebuilt from `vendor/` on every build, so an edit there is
invisible to the repository and gone next build. That is the mechanism that keeps the framework
un-patched; do not defeat it by committing it.

## Phase 2 — The first model

A model is a resource: a table, an API, the gates over it, and the schemas derived from it.

**`models/` must exist and produce at least one model, or boot fails with `no models found`.** Every
other family is optional — an app with no queries has no `queries/`.

**Gates deny by default.** Nothing is reachable until a rule says so, and a create whose `x-scope`
resolves to nothing is refused as an unscoped write — that catches anonymous creates in particular.

`.app-stack/docs/stack/02-models.md` is the property vocabulary;
`05-gates.md` is the gate vocabulary. `id`, `orgId`, `createdAt`, `updatedAt` are framework-owned and
may never be declared.

## Phase 3 — The first page, and first boot

One view: a route, a title, and a component tree. Then:

```sh
bun run start
```

**Config compiles at boot and only at boot.** A YAML edit with no restart changes nothing — a page
that looks unchanged is the expected result, not a clue. This is the single most common way an hour
disappears here.

**Write YAML in block style.** A comma inside a flow mapping ends the entry, an unquoted `#` starts
a comment, and a colon turns a list item into a mapping. Boot refuses all three by name, but they
remain easy to write; `.app-stack/docs/learnings/` has them one file each.

## Phase 4 — The project's own documents

**A scaffolded project states its own rules.** Write `README.md` and `AGENTS.md` covering: what is
owned (`app/config`) and what is packaged, that `.app-stack/` is never edited, that config compiles
at boot, how to bump the framework version, and how the app deploys.

Do not skip this because the app is small. A repository that does not say what it is leaves the next
reader — human or agent — to infer it from file layout, and they will infer wrong.

## Phase 5 — Prove the journey, not the page

Drive the day-one journey from phase 0 end to end, as its actor. Submit the form, reach the terminal
screen, read what the server recorded. **A page that renders is not a journey that completes.**

`.app-stack/docs/stack/14-verification.md` carries the method.

---

## When config is not enough

`x-hooks` and `x-actions` reference TypeScript the app owns, as `path#export` — configuration
pointing at code, and the supported way to add app-specific behaviour.

**A missing component, prop or keyword is a framework change.** Fix it in App-Stack, cut a release,
bump the version this app runs. There is no supported way to change the framework from inside an app
using it, and in a packaged project no possible way either.

## Definition of done

The app boots, the day-one journey completes as its actor against a real request, `README.md` and
`AGENTS.md` state the project's own rules, and the user has confirmed it.
