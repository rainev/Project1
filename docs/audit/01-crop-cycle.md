# 01 — Crop cycle: seeding → germination check → transplant → harvest

_Audited 2026-09-26 against the kit at `d710747` and App-Stack 1.7.0 (`.app-stack/`, unpacked from
`vendor/`). Nothing farm-specific is built yet; this batch measures the brief against what exists
**and** against what the framework can express, so the roadmap does not plan something config
cannot say._

## 1. Reference

The owner's brief (2026-09-26, this session):

> Generally on Wednesdays we start seeding in our nursery; 3 days later we check if there are still
> seeds we need to plant; then after 2 weeks, those are planted in the production farm; after 28–30
> days they will be ready for harvest.

That gives one unit of work per sowing, with dates derived from the seeding date:

| Stage | When | What the team does |
|---|---|---|
| Seed | Wednesday (day 0) | Sow trays in the nursery |
| Germination check | day 0 + 3 (Saturday) | Count what came up; re-seed the gaps in the same cell |
| Transplant | check + 14 = **day 17** (owner, 2026-09-26) | Move plugs to the production farm |
| Harvest window | transplant + 28–30 = **day 45–47** | Harvest once (one cut), record |

Industry practice (web research this session; search summaries, pages not opened, so `⚠`):

- The unit is a **batch** or inventory group: one variety sown on one date, carrying a lot code.
  Agrilyst/Artemis, iUNU LUNA and Farmbrite all track by batch and generate that batch's tasks from its
  dates (farmbrite.com/help/planting-tasks, iunu.com/luna-ai). `⚠`
- Fields commonly kept: variety, seed lot, trays, cells, seeds per cell, germinated count, re-seeded
  count, transplanted count, losses per stage, harvest weight. `⚠`
- Scheduling works backward from a harvest date or forward from a seeding date. Upstart University
  gives 5–6 weeks from transplant to harvest for lettuce; the owner's 28–30 days is their own
  practice and is what applies here. `⚠`

**Owner's answers (2026-09-26):**
- **Crop.** Lettuce only for now.
- **Transplant date.** Transplant is 2 weeks after the *check*, not after seeding.
- **Counting and re-seeding.** Sowing is counted as seeds per cell. At the day-3 check the gaps are
  re-seeded **in the same cell**.
- **Harvest.** One cut per batch.
- **Team.** Everyone does everything, so there is one staff role.
- **Dashboard priority.** Germination comes first, because it feeds the inventory plan.

## 2. Ours today

- `app/config/models/` holds `article.yaml`, `topic.yaml`, `ticket.yaml`, the kit's demonstration
  models. There is **no** batch, crop, variety, tray or stage model. `✔`
- `app/` contains only `config/`, and there is no `app/hooks/` directory, so no application code
  exists. `✔`
- The running app (booted this session) lists models `article, topic, ticket, user, org, invite,
  session, audit, outbox, schedule`. `✔`

## 3. Reuse check

What the framework already provides for this, so we do not build it by hand:

| Need | Framework feature | Source | Tag |
|---|---|---|---|
| The four stages as named moves with their own access rules | `x-states` with `transitions` (`from`, `to`, `require`, `access`) | `docs/reference/stack/02-models.md` §Lifecycle | `✔` read |
| A lane view of batches by stage | `BoardScreen`, which needs a model with `x-states` | `13-screens.md` §BoardScreen | `✔` read |
| Recording the day-3 count *as part of* the move | a transition's `require: [germinatedCount]`, which gives the move a form | `02-models.md` §Lifecycle | `✔` read, not run |
| A per-batch history of who did what | `TimelineScreen` over the `history` op | `13-screens.md` §TimelineScreen | `✔` read |
| The variety as a pick-list | `x-lookup` to a `variety` model (as `article → topic`) | `app/config/models/ticket.yaml`, `02-models.md` | `✔` |
| Per-organisation isolation | `x-scope: { orgId: actor.orgId }` | `ticket.yaml` | `✔` |

## 4. Flow

Nursery lead on Wednesday → **New batch** (variety, trays, cells, seeds per cell) → the batch sits in
`seeded` → on day 3 someone opens **Today**, sees "Germination check — batch W39 lettuce", records the
germinated count and re-seeds → `checked` → on the transplant date "Transplant — W39" → records the
count moved and the losses → `transplanted` → from transplant + 28 days "Harvest window opens" →
records the weight → `harvested`.

**Where it breaks:** nothing puts "day 3", "day 17" or "day 45–47" on a row, because the framework
cannot add days to a date in config (G1.2). Without those dates, "what is due today" has nothing to
compare against, and batches 02 (tasks) and 04 (dashboard) both depend on it.

## 5. What backs it

- **Date arithmetic.** Declared expressions are JEXL over `{ actor, op, model, input, row, now }`.
  `now` is an ISO timestamp *string*, and the only transforms are `trim`, `collapseWhitespace` and
  `lower` (`.app-stack/packages/core/src/expressions.ts:25-32`). No date parsing, no addition. `✔`
- **Code escape hatch.** A hook or event may be `./hooks/<file>.ts#<export>` instead of a declaration
  (`02-models.md` §Behaviour, §x-events). A `beforeCreate` hook can compute the stage dates from
  `seededOn`, and a `before<transition>` hook can recompute harvest dates from the real transplant
  date. `✔` read; not yet run in this app.
- **Recurring work.** `x-schedules.<name>.every` must match `^[1-9][0-9]*[smhd]$`
  (`core/src/model.ts:475`), meaning an interval and not a weekday. The next run is computed from
  *now* (`schedule/ticker.ts:151`). After downtime a run fires once, late, and the timing does not
  re-align (`04-dispatch-and-pipeline.md` §Schedules). `✔`
- **Dates as strings.** Stored ISO dates (`YYYY-MM-DD`) compare correctly as text, so a query `where
  dueOn lte now` works without date functions. `⚠` inferred from the query grammar (`06-persistence.md`
  §where: value is JEXL over `{ params, actor, now }`), not yet run.

## 6. Gaps

| ID | Gap | Sev | Tag |
|---|---|---|---|
| G1.1 | No `batch` model: seeded date, cells, seeds per cell, lot code, stage. A `variety` pick-list can wait (lettuce only), but a `crop` text field keeps room for it. | P0 | `✔` |
| G1.2 | Stage due dates (check day 3, transplant day 17 = check + 14, harvest window transplant + 28–30 = day 45–47) **cannot be computed in declared config**. They need `app/hooks/batch.ts` with a `beforeCreate` hook, plus a hook on the transplant transition to recompute harvest from the real date. That is the app's first TypeScript. | P0 | `✔` |
| G1.3 | No lifecycle: `x-states` `seeded → checked → transplanted → harvested`, plus a way to record a batch lost or discarded at any stage. Each transition should `require` the count it records. | P0 | `✔` absent; fit `✔` read |
| G1.4 | **Lens contradiction (coverage vs wiring).** Coverage says "recurring work → `x-schedules`, covered". Wiring says a schedule cannot mean *Wednesday* or *08:00*: `every: 7d` starts from the first boot and drifts after downtime. A weekly seeding reminder needs either a daily `1d` schedule whose code hook checks the weekday, or a person pressing **Start this week's seeding**. | P1 | `✔` |
| G1.5 | Harvest is a window (28–30 days), not a date; one cut, so a batch ends at `harvested`. Store `harvestFrom`/`harvestTo` so "ready" and "overdue" are separate states on the dashboard. | P1 | `✔` absent |
| G1.6 | Counts per stage are the inputs to every dashboard ratio. The owner's priority KPI is germination, so the check transition must `require` **cells sown, seeds per cell, cells germinated and cells re-seeded**, and germination % = germinated ÷ sown must be computable from stored fields. Re-seeding happens in the same cell, so a re-seed does **not** add cells. Transplanted, lost and harvest weight follow. | **P0** (raised: owner priority) | `✔` owner-confirmed |
| G1.9 | Inventory plan: germinated cells, plus the re-seeds that take, give the expected plants for transplant, which give the expected harvest on day 45–47. No field or query projects this forward yet. | P1 | `✔` owner-confirmed need |
| G1.7 | No lot code. Harvest records are commonly tied to a traceability lot (for example FSMA 204 in the US for leafy greens). Whether any rule applies here depends on your jurisdiction and buyers. | P2 | `⚠` relayed, unconfirmed for this farm |
| G1.8 | Mobile use in the nursery: `DataGrid` scrolls sideways on narrow screens by design (`13-screens.md` §DataGrid, AUD-200), so batch pages meant for a phone should favour `FormScreen`/`BoardScreen` over wide grids. | P2 | `⚠` doc-read, not driven at phone width |

## Not checked in this batch

Daily tasks and reminders (02), readings and data entry (03), the dashboard (04), and roles,
onboarding and deployment (05). A `path#export` hook has not been run in this app yet, so G1.2's fix
is supported by the docs but not yet proven here.
