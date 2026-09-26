# Audit — the gap register

What is missing, measured against something: a design, a spec, a competitor, the app's own intent.
`/audit-goodbehavior` writes one file per batch here; `/roadmap-goodbehavior` turns the gaps into a
sequenced plan.

## Verification tags

`✔` confirmed firsthand — a request against the running app, a page driven in a browser, the source
line read this session. `⚠` relayed or inferred, still to confirm. **A `⚠` finding is a lead, not a
fact**, and never goes into a plan as settled.

## Reference

**Hydroponic farm operations app** — the owner's brief of 2026-09-26: weekly Wednesday seeding in the
nursery, a germination check 3 days later, transplant to production 2 weeks later, harvest 28–30 days
after that; a team that signs in to see the day's tasks and record what the dashboard needs; a
dashboard of the business's metrics. Industry practice was researched the same day (search summaries
only, so `⚠`); sources are cited in each batch.

## Batches

| # | Area | Reference | Status |
|---|---|---|---|
| 01 | [Crop cycle — seed → check → transplant → harvest](01-crop-cycle.md) | brief §cycle | open — 8 gaps (3 P0) |
| 02 | Daily tasks and reminders — "what do I do today" | brief §team | not started |
| 03 | Readings and daily data entry — pH, EC, temperature, top-ups, scouting | research | not started |
| 04 | Dashboard — KPIs and charts | brief §dashboard | not started |
| 05 | Roles, onboarding, deployment | AGENTS.md §design, DEPLOYING-RAILWAY.md | not started |

**Leads for batch 02, not yet findings:** `DataGrid.filter` is fixed equality only, with `$id` from
the route (`13-screens.md` §DataGrid). So a grid of *my* tasks due *today* may not be expressible;
a query can filter on `actor` and `now` but `ReportScreen` has no row actions for marking a task done.
`⚠` doc-read, not run.

## Real surface (what exists today)

| Kind | Units |
|---|---|
| Models | `article`, `topic`, `ticket` (kit demos) + system `user`, `org`, `invite`, `session`, `audit`, `outbox`, `schedule` |
| Views | `home`, `login`, `articles`, `article-detail`, `board`, `insights`, `admin` |
| Queries | `articles-by-topic` |
| Hooks | none (`app/hooks/` does not exist) |
