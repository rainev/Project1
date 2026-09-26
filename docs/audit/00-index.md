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
dashboard of the business's metrics, germination first because it drives the inventory plan. Owner's answers (same day): lettuce only; transplant = check + 14 days (day 17); re-seed in the same cell; one cut; everyone does everything; wants a schedule manager; Philippine time; readings daily; one batch per greenhouse location; inventory plan = how many cells to sow; email reminder deferred; cells to sow +10% margin; location chosen at seeding; 3 greenhouses × 4 areas, one batch per area; harvest by weight only; pH/EC targets start at recommended values, editable in the app; temporary sign-up page plus owner-created accounts; English only. Industry practice was researched the same day (search summaries
only, so `⚠`); sources are cited in each batch.

## Batches

| # | Area | Reference | Status |
|---|---|---|---|
| 01 | [Crop cycle — seed → check → transplant → harvest](01-crop-cycle.md) | brief §cycle + owner answers | open → planned in `plans/FARM-OPS.md` |
| 02 | [Daily tasks and the schedule manager](02-daily-tasks.md) | brief §team + owner answers | open → planned in `plans/FARM-OPS.md` |
| 03 | [Readings and locations](03-readings.md) | owner answers + research | open → planned in `plans/FARM-OPS.md` |
| 04 | [Dashboard — germination first](04-dashboard.md) | owner answers + research | open → planned in `plans/FARM-OPS.md` |
| 05 | [Roles, onboarding, deployment](05-roles-onboarding-deploy.md) | AGENTS.md §design, DEPLOYING-RAILWAY.md | open → planned in `plans/FARM-OPS.md` |


## Real surface (what exists today)

| Kind | Units |
|---|---|
| Models | `article`, `topic`, `ticket` (kit demos) + system `user`, `org`, `invite`, `session`, `audit`, `outbox`, `schedule` |
| Views | `home`, `login`, `articles`, `article-detail`, `board`, `insights`, `admin` |
| Queries | `articles-by-topic` |
| Hooks | none (`app/hooks/` does not exist) |
