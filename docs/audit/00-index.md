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
dashboard of the business's metrics, germination first because it drives the inventory plan. Owner's answers (same day): lettuce only; transplant = check + 14 days (day 17); re-seed in the same cell; one cut; everyone does everything; wants a schedule manager. Industry practice was researched the same day (search summaries
only, so `⚠`); sources are cited in each batch.

## Batches

| # | Area | Reference | Status |
|---|---|---|---|
| 01 | [Crop cycle — seed → check → transplant → harvest](01-crop-cycle.md) | brief §cycle + owner answers | open — 9 gaps (4 P0) |
| 02 | [Daily tasks and the schedule manager](02-daily-tasks.md) | brief §team + owner answers | open — 9 gaps (4 P0) |
| 03 | Readings and daily data entry — pH, EC, temperature, top-ups, scouting | research | not started |
| 04 | Dashboard — KPIs and charts | brief §dashboard | not started |
| 05 | Roles, onboarding, deployment | AGENTS.md §design, DEPLOYING-RAILWAY.md | not started |


## Real surface (what exists today)

| Kind | Units |
|---|---|
| Models | `article`, `topic`, `ticket` (kit demos) + system `user`, `org`, `invite`, `session`, `audit`, `outbox`, `schedule` |
| Views | `home`, `login`, `articles`, `article-detail`, `board`, `insights`, `admin` |
| Queries | `articles-by-topic` |
| Hooks | none (`app/hooks/` does not exist) |
