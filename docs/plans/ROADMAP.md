# Roadmap — active initiatives

A thin index. One line per live initiative, pointing at its own file in this directory. Never the
plans themselves: a single growing roadmap becomes mostly finished work, and then the file everyone
opens first is the least current thing in the project.

**Drop an initiative's line when it closes.**

## Active

- [FARM-OPS.md](FARM-OPS.md) — hydroponic lettuce: batches, Today and the schedule manager, readings, dashboard. NOW: Phase 1, the batch cycle. Nothing built (checked 2026-09-26: `app/hooks/` absent, only kit demo models). Deferred items: [PRODUCTION-BACKLOG.md](PRODUCTION-BACKLOG.md).

## The initiative file pattern

Each initiative gets its own `docs/plans/<INITIATIVE>.md`:

```md
# <Initiative>

_Status checked YYYY-MM-DD against <artifact/command>: <what is actually built>._

## NOW — Phase N
- [ ] **A1** — <one line> · (gap <id>) · P0 · verify: <how you will prove it live>

## NEXT
## LATER
```

**A status line is a claim.** Carry the date it was last checked against the code and name what backs
it — a file, a command's output. A date with no artefact is just a newer-looking claim.

**Done means the real thing worked**, driven the way its user would drive it, with evidence, and the
owner confirmed it. Never "the tests pass".
