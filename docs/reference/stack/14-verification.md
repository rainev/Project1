# Verification

**A green `bun test` is necessary and never sufficient.** The rule this project runs on is that a
capability counts when it has been *exercised*, not when a unit test passes and a file exists — the
previous codebase reached "phases 1–10 complete" on unit tests and file existence and still rendered
a blank page.

Four apparatuses, each answering a different question:

| | Question | Cost |
|---|---|---|
| `bun test` | Do the parts behave? | ~2s, 607 tests |
| `bun run verify:browser` | Does the assembled thing work for a person? | ~2.5 min, 34 features |
| `bun run verify:parity` | Does the mirror match what it mirrors? | ~30s per page |
| `bun run verify:docs` | Do these documents still describe the code? | ~3s, 10 checks |
| A live probe | Did *this* change do what it claims? | seconds |

## The unit suite

```sh
TMPDIR=$PWD/.tmp bun test          # plain `bun install`/`bun test` can hit EPERM; see the traps index
```

**475 pass, 2 skip, 0 fail across 30 files.** The two skips are the server-engine bindings —
`packages/core/test/db-contract/postgres.test.ts` and `maria.test.ts` skip themselves unless a
`DATABASE_URL` for that engine is set.

The suite boots `createApp` against a temporary SQLite file and drives the **dispatcher**; it does
not start `Bun.serve`. That is the right level for most of it — the dispatcher is where policy
lives — and it is exactly why it is not sufficient: nothing in it proves a route is wired, a cookie
is set, a bundle renders, or a form submits.

Layout worth knowing:

- `db-contract/contract.ts` is one suite run against all three engines by `sqlite.test.ts`,
  `postgres.test.ts` and `maria.test.ts`, so a behaviour is asserted once and checked three times.
- `fixtures/boom.ts` is the handler that throws, for the after-hook failure path.
- The rest is one file per concern — `two-phase-gate`, `hooks-honesty`, `crypto-shadow-column`,
  `key-rotation`, `queries-cross-tenant`, and so on.

**A security test has to be proven to fail.** Reintroduce the hole, watch the test catch it, put the
hole back — otherwise the test proves only that the code runs.

## The browser gate

```sh
bun run build:web                       # the bundle the server serves
JWT_SECRET_FILE=.data/jwt.key APP_DEK_FILE=.data/dek.key bun run dev
bun run verify:browser                  # every feature
bun run verify:browser -- forms actions # some of them
```

It needs `CHROMIUM_EXECUTABLE` — the path to this machine's Chromium-family browser. **No browser
name or path is hardcoded in the repo**: the gate refuses to launch with a message naming the
variable rather than guessing. Copy `.env.example` to `.env` (gitignored; Bun loads it). Point it at
the **unwrapped** binary: the launcher on `PATH` is usually a shell script that injects the
desktop's `chrome-flags.conf` into a headless run, which got one run SIGKILLed.

`.env` also carries `PLATFORM_ADMINS`, which must be the address the server was started with — the
cross-tenant features need the reserved role, and no request can ask for it.

### Shape

```text
scripts/browser-check.ts     the runner: the browser, the seed, the tally
scripts/gate/harness.ts      identities, launch, withIdentity, shared selectors and helpers, crash detection
scripts/gate/seed.ts         everything the gate needs to exist, through the API, on a clean database
scripts/gate/features/*.ts   one file per feature; each owns its setup and its assertions
```

**No feature depends on another.** A feature that needs data creates it or reads it from the seed,
never from a check that happened to run earlier. That is what lets `verify:browser -- forms` run one
of them, and what lets two people add features to different files without colliding.

The seed establishes four identities, a second tenant, customers and around thirty notes —
**through the API**, so it works on an empty database. It used to rely on accounts that existed only
in one machine's `.data/showcase.sqlite`, which made the gate's score reproducible nowhere else
(AUD-057).

### What the runner does for you

- **Buffers a feature's checks** and prints them when it finishes, so an attempt abandoned by a
  browser crash can be discarded whole rather than counted twice.
- **Retries a crashed attempt once**, on a fresh browser — and **never retries an assertion**.
  Telling the two apart is the whole point: `isBrowserCrash` matches Playwright transport strings
  (`Target crashed`, `frame was detached`, …) and deliberately **excludes bare `ERR_ABORTED`**,
  because a feature racing the page against itself produces exactly that, and retrying it away would
  hide the defect.
- **Fails a feature that throws** and keeps going, so one broken feature does not hide the others.
- **Watches the console.** Every uncaught exception fails the run, and so does any console error
  that is not one of the statuses the gate provokes on purpose (400, 403, 404, 422).
- **One context per feature** — three live at once crashed Chromium.

## Adding a feature

Four steps, and the fourth is the one that makes it real.

**1. Write the file.** `scripts/gate/features/<name>.ts`, exporting a `Feature`:

```ts
import type { Feature } from '../harness.ts';
import { BASE } from '../harness.ts';

export const chart: Feature = {
  name: 'chart',            // what `verify:browser -- chart` selects
  identity: 'admin',        // admin | staff | other | platform | anonymous
  async run(page, ctx) {
    await page.goto(`${BASE}/notes`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="chart-screen"][data-state="ready"]');
    ctx.check('chart exposes an accessible data table', rows.length >= 2, JSON.stringify(rows));
  },
};
```

**2. Register it** in `scripts/browser-check.ts` — the import and the `FEATURES` array. An unknown
name on the command line exits 2 and lists the known ones, so a typo is not a silent no-op.

**3. Follow the rules the existing features follow:**

- **One identity per feature.** Signing out mid-feature fights `withIdentity` for the session; two
  actors means two features. The refusal features are named `…Refusal` for exactly this reason.
- **Wait for what the interaction *caused*, not for what it returned.** These screens carry
  `data-state="ready"` and the last query they issued in `data-query`. A predicate quantifying over
  a node list must require a non-empty one first: `[].every(…)` is `true`, and a wait that passes on
  an empty DOM reads a stale page.
- **A container appearing is not its contents appearing.** A dialog that fetches its schema after it
  opens will be empty for a tick. This is what `choose(page, scope, label)` and
  `comboOptions(page, scope)` exist for: the enum and relation controls are comboboxes, not
  `<select>`, so `selectOption` does not apply — and both helpers wait for an **option** rather than
  for the listbox, because a relation searches the server and the box opening says nothing about
  whether the rows have arrived.
- **Scope a selector to the row that carries your value.** A feature that passes alone and fails in
  a full run is a targeting bug, not a flake.
- **Seed every tenant with its own rows** and assert the positive and the negative together. An
  empty tenant proves nothing.
- **`ctx.check` never throws.** A feature records and continues; the runner tallies.

**4. Run it, and run the whole gate.** A feature that passes alone and breaks the run is not done.

```sh
bun run verify:browser -- <name>
bun run verify:browser
```

Then **prove it can fail.** Break the thing it asserts, watch the check go red, put it back. A check
that has only ever been green is not evidence that it measures anything.

`scripts/gate/features/projection.ts` was written by following these four steps and is the worked
example: it asserts the two caching headers on the per-actor document, that no rule-shaped keyword
reaches the browser, and that a page whose policy excludes this actor is absent rather than hidden —
three §19/§22 invariants that are invisible from a rendered page and would otherwise fail silently.
Changing `assets.ts` to send `public, max-age=60` turns its first check red and leaves the other six
green, which is what a check proving one thing looks like.

## Parity against a reference

When a page exists to mirror something — a site being rebuilt as config — "it looks right" is the
claim that fails most often and is defended worst. `bun run verify:parity` compares the two pages in
one browser and prints a per-section delta:

```sh
CHROMIUM_EXECUTABLE=<a chromium binary> bun run verify:parity \
  https://<deployed>/ https://<reference>/ \
  --ours 'header ++ .page-hero, main > div > [data-testid=page-content] > *' \
  --ref  'main > section, main > footer'
```

Every rule below was bought by a wrong reading this project acted on.

**Compare the deployed page, never localhost.** The vendored copy under `deploy/` is what ships, and
it has rendered differently from its app-stack original — a localhost run is evidence about a page
nobody visits.

**Cache-bust each load.** A mirror is checked right after a deploy, which is exactly when a CDN is
most likely to hand back the build you just replaced. The script appends a query string for you.

**Diff boxes, not computed styles.** A computed style is a property you thought to ask about; a box
is the whole element. When a section is *missing*, there is no property to disagree with, so a
style-by-style sweep reports parity across a hole in the page.

**Disable transitions before reading any colour.** A transitioned property reports its start value
until the transition advances, and in a backgrounded tab it never advances — it reports the old value
forever, and convincingly. Two non-existent focus-ring defects were written up before this was
understood.

**Use `++` when the markup diverges.** A mirror reproduces geometry, not nesting: the reference wraps
its header inside the hero section, we render it as a sibling. `'header ++ .page-hero'` compares them
as one box. Without it the run reports a difference that exists only in the markup.

**Resize the viewport; do not scale the page.** The narrow sweep at 320/390/640/768 loads each width
as its own viewport, because a scaled screenshot shows a layout that no breakpoint produced.

**A zero-delta table covers the page at rest, and nothing else.** Each journey still has to be driven
as its actor — the states behind `when:` never reach the browser for a visitor who cannot see them,
so a section absent from both pages is invisible to any comparison of the two.

## Live probes

For anything narrower than a feature, probe the running server directly. This is what "exercised"
means for a one-line change:

```sh
# an API change
curl -s -b c.txt -X POST localhost:3000/v0/create/note \
  -H 'content-type: application/json' -d '{"title":"probe"}'

# a config change — config compiles at boot, so restart first
JWT_SECRET_FILE=.data/jwt.key APP_DEK_FILE=.data/dek.key bun run dev

# a persistence change
sqlite3 .data/showcase.sqlite '.schema notes'

# what the server recorded
bun -e 'import {Database} from "bun:sqlite";
  const db = new Database(".data/showcase.sqlite", {readonly:true});
  console.log(db.query("select op,model,outcome,status,detail from _audits order by at desc limit 5").all())'
```

A security fix needs the **attack re-run and refused**, not a test that would have caught it.

## The documentation's own gates

The documents in this directory carry claims that cannot be checked by reading, so they are checked
by running. **`bun run verify:docs` runs all ten and exits non-zero if any fails:**

```sh
bun docs/stack/checks/config-error-coverage.ts   # every ConfigError in model.ts appears in 02
bun docs/stack/checks/engine-order.ts            # 04's per-op table matches engine/execute.ts
bun docs/stack/checks/auth-routes.ts             # 10 names every auth route and error code
bun docs/stack/checks/screen-props.ts            # 13 names every component and every prop
bun docs/stack/checks/links.ts                   # every relative link in this directory resolves
bun docs/stack/checks/component-names.ts         # registry.ts and component-names.ts agree
bun docs/stack/checks/comment-register.ts        # no session narrative in the shipped source
bun docs/stack/checks/mirroring-props.ts         # 15's table names props that exist
```

Each was proven to **fail** on a deliberately drifted document before being trusted. A check that has
never been seen red is not evidence — and for five of these that was once literally true: they
printed their findings and exited 0, so nothing they reported ever failed anything.

## Another platform

```sh
bun run verify:platform          # the newest release in dist/
bun run verify:platform 1.5.0
```

Boots a built release inside `oven/bun:1` against a minimal generated app and asks for `/health`.
**Everything else here runs on the developer's machine**, so a failure that happens only elsewhere is
invisible to all of it: one was — a `dlopen` of a macOS-only library at module scope, on an import
path every application takes, which killed a Linux deployment at startup while the full gate stayed
green.

It needs Docker or Podman, and **exits non-zero when it finds neither** rather than passing quietly:
"not run" and "passed" are different claims.

| Platform | How it is covered |
|---|---|
| **macOS** | natively — the unit suite, the browser gate, `verify:parity` |
| **Linux** | `verify:platform`, which is the deployment target |
| **Windows** | **not verified.** No Windows container runs on the machines this is developed on. Nothing in the framework is knowingly Windows-specific — Bun, SQLite, `fetch` and the config layers are platform-neutral — and the one native path, the `pty` channel runner, names its libc candidates per platform and fails with a message rather than at import. That is reasoning, not evidence |

**A release carries compiled native helpers for one platform** (`libwinsize.dylib`, `spawn-helper`),
so a `pty` channel works only where those were built. Every other capability is platform-neutral, and
`verify:platform` is what proves the rest of a release survives without them.

## The traps index

Environment and tooling behaviour that costs real time is recorded one fact per file. In a release
those travel as `docs/learnings/`; in the framework's own repository they are the project memory.
**Check them before debugging anything that looks like environment weirdness.** The ones that bite
most often:

| Trap | Shape |
|---|---|
| Bun tempdir EPERM | `bun install` / `bun test` fail; use `TMPDIR=$PWD/.tmp` |
| `.tmp` is not durable | Bun clears the TMPDIR it is given; dev keys and data belong in `.data/` |
| Config compiles at boot | Editing YAML does nothing until the process restarts |
| Chromium refuses a long temp dir | "Socket path too long"; use `TMPDIR=$PWD/.tmp/pw` |
| The Chrome launcher injects desktop flags | Point at the unwrapped binary |
| A killed tool call stalls the gate | Detach long runs — `setsid nohup`, or `(nohup … & disown)` on macOS |
| `pkill -f` self-match | Kills the calling shell; stop servers by port |
| Stale live server ports | A dead probe can leave an old server answering later requests |
| Chromium crashes a page under load | About once per full run; the runner retries a crash and never an assertion |
| An empty DOM satisfies `every` | Wait for the request, not for the rows |
| Argon2 default cost vs. timeouts | Tests and local runs lower it deliberately |

## Limits worth knowing

- **The unit suite never starts a server.** Route wiring, cookies and the bundle are only covered by
  the gate and by live probes.
- **PostgreSQL and MariaDB skip by default.** Their contract runs need a `DATABASE_URL` each,
  usually a disposable container.
- **The gate is one browser.** It proves behaviour, not cross-browser rendering.
- **Count checks with `grep -c '^PASS'`, not `grep -c PASS`.** The runner's closing line is
  `ALL CHECKS PASSED`, which the loose pattern matches — every figure counted that way is exactly
  one too high. Three documents carried an inflated number for a day because of it.
- **Current gate result: 34 features, 279 checks, all passing** — 2026-09-18, on `wp06-phase3`, from a clean
  database. A red gate is reported, never rounded down.

## Related

[13-screens.md](13-screens.md) · [01-configuration-and-boot.md](01-configuration-and-boot.md) ·
[04-dispatch-and-pipeline.md](04-dispatch-and-pipeline.md) · `CLAUDE.md` · `docs/audit/00-index.md`

---

_Checked against the code 2026-09-24_ — `scripts/browser-check.ts`, `scripts/parity-check.ts`,
`scripts/verify-docs.ts`, `scripts/gate/harness.ts`, `scripts/gate/seed.ts`, `scripts/gate/features/`,
`packages/core/test/`, `docs/stack/checks/`, `package.json`, `.env.example`. `bun run verify:docs`
prints 10 checks, 0 failing; `bun test` prints 653 pass, 2 skip, 0 fail; `bun run verify:browser`
prints 1027 pass, 0 fail against a freshly reset database.
