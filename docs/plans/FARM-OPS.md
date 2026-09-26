# Farm ops — hydroponic lettuce: batches, today's tasks, readings, dashboard

_Status checked against the code and the running app 2026-09-26: `app/config/models/` holds
`greenhouse`, `area` and `batch`; `app/hooks/batch.ts` exists; the kit demos are gone. **Phase 1
is built, and every item was driven live (evidence below). It is waiting on the owner's
confirmation**, so it is not closed. Phases 2–5 are not built. Gaps come from `docs/audit/01`–`05`._

**Done means, for every item:** the owner's flow works in the running app, driven in a browser the way
a staff member would (at phone width where the team uses it), with a screenshot or the real response as
evidence, **and the owner has confirmed it**. A boot that passes is not done.

**Fixed facts this plan builds on (owner, 2026-09-26):**
- Lettuce only. Seed on Wednesday (day 0); germination check on day 3, re-seeding in the same cell;
  transplant on day 17 (the check + 14); harvest once, on day 45–47 (transplant + 28–30).
- 3 greenhouses × 4 areas, with one batch per area, chosen at seeding.
- Harvest is recorded by weight only.
- Cells to sow = ⌈plant sites ÷ recent germination rate × 1.10⌉.
- pH and EC targets start at 5.6–6.0 and 1.2–1.8 mS/cm and can be edited in the app.
- Philippine time (Asia/Manila). One staff role plus an admin. English only.
- Sign-up is a temporary page plus owner-created accounts. The email reminder is deferred.

**Framework limits the design works around (all `✔` in the audit):**
- Config cannot add days to a date, divide, bucket by week, or know the time zone. So
  `app/hooks/*.ts` compute the dates, the percentages, `seedWeek` and the Manila date, and store them.
- A view cannot filter on "today". So tasks carry a `due` state that an hourly job sets, and Today
  filters on that state.
- A built-in schedule cannot mean "Wednesday" or be edited in the app. So routines are data, and one
  `1h` schedule runs a code action.

## NOW — Phase 1: the batch cycle, end to end — built, awaiting owner confirmation

The owner's priority is germination. This phase delivers it and proves the one mechanism everything
else leans on: a code hook computing and storing values.

| ID | What | Gap | Sev | Status |
|---|---|---|---|---|
| P1.1 | Strip the kit demos and make the app English only. Home is a short farm landing page. | G4.6, G5.3 | P1 | `✔` Boots with models `greenhouse, area, batch` and the system models only. Nav: Home, Batches, By stage, Greenhouses, Areas, Admin. Every label is literal, because with no `languages` block `t:` keys render raw. Evidence: `01-home.png` |
| P1.2 | `greenhouse` and `area` models, owner-maintained, each on its own page (`/setup/greenhouses`, `/setup/areas`, `/setup/areas/:id`). | G3.1, G3.6, G5.2 | P0 | `✔` A greenhouse and two areas were added through the forms (201 each); the area form's greenhouse is a lookup picker. As staff, the nav shows only Home, Batches and By stage; `POST /v0/create/area` → **403**; `/setup/areas` does not exist for them. Evidence: `03-areas.png`, `v05-staff-batches-390.png` |
| P1.3 | `batch` model: area (required), seeded date (defaults to today in Manila), cells sown, seeds per cell, lot code as `title`; stages `seeded → checked → transplanted → harvested` plus `lost`, each step requiring its count. | G1.1, G1.3, G1.5, G1.6, G4.8 | P0 | `✔` Every step was driven in the browser. check 90/8 → 200; transplant 85/5 → 200; harvest 12.5 kg → 200; mark lost with a note → 200. Check with 150 of 100 cells → **422 on the field**: "cannot be more than the 100 cells sown". Evidence: `v02-batches-after-check.png` |
| P1.4 | `app/hooks/batch.ts`: planned dates, `seedWeek`, lot code, germination % and transplanted %, the harvest window moved to the real transplant date, and no overlapping batches in an area. | G1.2, G3.4, G4.1 | P0 | `✔` Seeded Wed 2026-09-30 stored check **10-03**, transplant **10-17**, harvest **11-14 → 11-16**, week `2026-W40`, lot `2026-W40-GH1-AREA-1`. At the check: `germinationPct` 90. At transplant: `transplantPct` 85, and the window moved to transplant + 28/30. Steps are stamped with the Manila date. An overlapping seed (10-07) was refused on the Area field: "GH1 Area 1 is taken by batch 2026-W40-GH1-AREA-1 until 2026-11-16". After harvest the same seed was accepted. Evidence: `v01-overlap-refused.png` |
| P1.5 | Batch pages: a list, a by-stage view, and a detail page with history and the next step's form. | G1.3, G5.5 | P1 | `✔` The **By stage** page is tabs of grids with step dialogs (replacing `BoardScreen`, see below). As staff at 390px, the check was recorded from the detail page's form (`POST /v0/check/batch/<id>` → 200, 95%), and the form then became Transplant. Horizontal overflow at 390px is 0 on every staff page. Evidence: `v06-stages-*.png`, `v10-detail-checked-390.png`, `v04-detail.png` |

Evidence screenshots are in `docs/plans/evidence/farm-ops-phase1/`.

**Two changes from the plan, both forced by the framework (recorded in `.claude/goodbehavior/memory/`):**
- **No `BoardScreen`.** It sorts lanes by `title` and its move buttons send no payload, so every step
  failed from a card (`v03-board-after-move.png`). The **By stage** page does the same job, and its
  rows open dialogs that ask for the count.
- **Phone steps live on the detail page.** At 390px a grid's row dialog opens under the grid's
  pinned actions column, which covers Confirm (`v07-dialog-viewport-390.png`). So each step is also
  a full-width form on `/batches/:id`, shown only in the stage that admits it. On a phone: tap the
  lot, record the step.

**Design refinement:** an area is reserved from transplant to harvest, not from seeding, so the
next batch can be seeded into an area whose crop will be out before it arrives.

**Owner to confirm:** walk it yourself: add your 3 greenhouses and 12 areas with their real plant
sites, seed a batch, and record a check from your phone.

## NEXT — Phase 2: Today and the schedule manager

| ID | What | Gap | Sev | Verify |
|---|---|---|---|---|
| P2.1 | `task` model: title, kind (cycle/routine), `dueOn`, optional batch and routine lookups, states `upcoming → due → done / skipped`; one task per (routine, date) enforced with `x-unique`. | G2.1, G2.7 | P0 | Creating a duplicate (routine, date) through the API is refused |
| P2.2 | `routine` model, owner-maintained: title, instructions, every N days **or** seven weekday booleans, start date, active. Includes a schedule-manager page. | G2.4 | P0 | As admin, add "Pest scouting, Tue + Fri"; as staff it is read-only |
| P2.3 | `app/hooks/tasks.ts`: a code action on a `1h` `x-schedules` entry that, in Manila time, creates today's routine tasks and promotes `upcoming` tasks due today or earlier to `due`. It must be safe to run twice or late. | G2.3, G2.5, G2.7 | P0 | Run the action twice by hand and see no duplicates; watch the ticker fire and `_schedule.runs` rise |
| P2.4 | Cycle tasks: creating a batch creates its check, transplant and harvest tasks; each transition closes its own task. | G2.6 | P1 | Create a batch and see 3 `upcoming` tasks; do the check and its task becomes `done` |
| P2.5 | **Today** page: `DataGrid` with `filter: { status: due }`, a Done row action (which asks for a value where the task records one) and Skip. Cycle tasks link to their batch. | G2.2, G2.9 | P0 | As staff at 390px width, clear a due task and see it leave the list; an overdue task stays until done |
| P2.6 | Seed the owner's starting routines through the app: Wednesday seeding, daily readings per greenhouse, reservoir top-up. | G2.4 | P1 | They appear on Today on the right Manila days |

## LATER — Phase 3: readings and targets

| ID | What | Gap | Sev | Verify |
|---|---|---|---|---|
| P3.1 | `reading` model: greenhouse, Manila date (set by hook), pH, EC, water temperature, DO, air temperature, RH, topped up, note; one per greenhouse per day. | G3.2 | P0 | Enter today's reading from the Today task; a second one for the same greenhouse and day is refused |
| P3.2 | `target` model: min/max per reading kind, owner-editable, starting at pH 5.6–6.0 and EC 1.2–1.8. | G3.3 | P1 | Owner edits a target in the browser; the next reading is judged against the new value |
| P3.3 | Out-of-range flag, computed in `app/hooks/reading.ts` against the targets and stored with which reading tripped it. | G3.2 | P1 | A pH 6.4 reading shows the flag; 5.8 does not |

_To confirm while building P3.1: is there one reservoir per greenhouse, or one per area? That
decides whether readings attach to a greenhouse or an area._

## LATER — Phase 4: dashboard

| ID | What | Gap | Sev | Verify |
|---|---|---|---|---|
| P4.1 | Prove a `ContentStats` tile reading a declared query, before building the tile row. | G4.7 | P1 | One live tile shows the right count |
| P4.2 | Sowing plan: per area, ⌈plant sites ÷ 4-batch germination rate × 1.10⌉, computed in code, shown on the Wednesday seeding task and as the dashboard's lead tile. | G4.2, G1.9 | P0 | With seeded test batches at known rates, the number matches a hand calculation |
| P4.3 | Germination tiles (last batch, 4-batch average) and a line chart by `seedWeek`. | G4.3 | P0 | Matches the batches entered |
| P4.4 | Operations tiles: tasks due, done and overdue today, and readings out of range today. | G4.4 | P1 | Match the Today list and the readings |
| P4.5 | Batches by stage (bar) and harvest kg per batch (report with CSV). | G4.5 | P1 | CSV downloads with the right rows |

## LATER — Phase 5: team onboarding and going live

| ID | What | Gap | Sev | Verify |
|---|---|---|---|---|
| P5.1 | A temporary sign-up page (`LoginScreen mode: register`), opened for the team, then removed. The owner creates the rest of the accounts; Members is used to deactivate anyone unexpected. | G5.1 | P0 | A new account joins as `staff`; after removal `/register` has no page |
| P5.2 | Walk every staff page at 390px width: Today, readings, batch board, batch detail. | G5.5 | P1 | Screenshots at 390px with no control off-screen |
| P5.3 | Deploy to Railway per `docs/DEPLOYING-RAILWAY.md`: Postgres, kept `APP_DEK`, `NODE_ENV=production`, bun ≥ 1.4, one always-on instance. | G5.4 | P1 | The guide's four checks, including a row surviving a redeploy |

## Closed

_None yet._
