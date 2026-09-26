# Forking this kit, and keeping it current

This repository is a **starter**, not a dependency. You fork it once, and from then on it is your
application: your models, your pages, your history. Nothing you build here is sent back upstream.

## Fork it

Two ways, and they differ in one thing: **whose commits your log carries.**

### Keep the kit's history

Simplest. Fork on GitHub, or re-point a clone:

```sh
git clone git@github.com:<org>/AppKit.git my-app
cd my-app
git remote rename origin upstream
git remote set-url --push upstream no-pushing     # you pull from it, never push to it
gh repo create my-app --private --source=. --remote=origin
git push -u origin main
```

Your log starts with the kit's commits. Every later `git merge upstream/main` is an ordinary merge,
conflicting only where you and the kit changed the same file.

### Start your own history

Your log starts at your first commit and the kit's never appears:

```sh
git clone git@github.com:<org>/AppKit.git my-app
cd my-app
git remote rename origin upstream
git remote set-url --push upstream no-pushing

git checkout --orphan main-clean                  # a branch with no parent
git add -A
git commit -m "Start from App-Stack Kit"
git branch -D main && git branch -m main          # replace the old branch

gh repo create my-app --private --source=. --remote=origin
git push -u origin main
```

**The first upstream merge costs something, and only the first.** With no shared ancestor, git
compares file by file: anything identical merges silently, anything that differs conflicts as
`add/add`. Measured on this kit — one upstream change, one local change — **2 conflicted files of
80**, both of them files that genuinely differed.

```sh
git fetch upstream
git merge upstream/main --allow-unrelated-histories
# resolve, commit
```

That merge joins the two histories. **Every merge after it is an ordinary one** — no flag, no
conflicts beyond the usual. Measured: the second upstream change merged clean.

### Which

**Start your own history** unless you have a reason not to. The one-time cost is an afternoon's
worst case; the alternative is a permanent log of someone else's work above your own, and every
`git log` and `git blame` reading through it.

**`git remote set-url --push upstream no-pushing` is the whole policy.** `git push upstream` then
fails with a message instead of opening a pull request nobody asked for.

## Make it yours

```sh
bun run unpack && bun install
cp .env.example .env
bun run start
```

Then start deleting. The showcase app exists to be read once and replaced:

| Delete when you don't need it | What it was demonstrating |
|---|---|
| `app/config/models/article.yaml`, `topic.yaml` | a lifecycle, a relation, field policy, an upload |
| `app/config/views/board.yaml` | the same lifecycle drawn as lanes |
| `app/config/views/insights.yaml`, `app/config/queries/` | a declared query, drawn as a report |
| `app/config/views/home.yaml` | a page a visitor may see |

**Keep `app/config/views/admin.yaml`.** It is four lines of config and it is the surface most apps
discover they needed six months late — see `reference/stack/10-auth-and-sessions.md`.

## Take the kit's improvements later

The kit keeps moving: new framework releases, new reference documentation, fixes to the starter
config. Pulling those is an ordinary merge.

```sh
git fetch upstream
git merge upstream/main
```

`--allow-unrelated-histories` is needed once, and only if you started your own history — see above.

**What conflicts, and what does not.** Your app lives in `app/config/**`; the kit's improvements are
usually elsewhere, so most merges touch nothing you wrote:

| Path | Yours or the kit's | On merge |
|---|---|---|
| `app/config/**`, `app/hooks/**` | **yours** | conflicts only where you edited a file the kit also changed — usually because you kept a showcase file |
| `vendor/`, `.app-stack-version` | the kit's | take the kit's, then `bun run unpack && bun install && bun run sync-reference` |
| `.claude/skills/**`, `docs/**` | the kit's | take the kit's. `reference/**` is generated — never resolve it by hand, re-run `sync-reference` |
| `.env.example` | the kit's | take the kit's, then reconcile your own `.env` |

**After any merge that moved `.app-stack-version`:**

```sh
bun run unpack && bun install && bun run sync-reference && bun run start
```

`bun install` is not optional there. `unpack` replaces `.app-stack/` wholesale, which breaks the
workspace links — and `bun install` repairs them while reporting "no changes", so the reassuring
message is not evidence that it did nothing.

## Upgrading the framework on your own schedule

A framework release is a file in `vendor/` and a line in `.app-stack-version`. To move without
merging the whole kit:

```sh
cp ~/Downloads/app-stack-<version>.tar.gz vendor/
echo <version> > .app-stack-version
bun run unpack && bun install
bun run sync-reference              # the committed docs now describe the version you run
bun run start                       # boot is the test: config compiles or it refuses
```

**Read `reference/stack/` after upgrading, not before.** It ships inside the release, so it
describes the version you now run rather than the one you used to.
