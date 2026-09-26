# 02 — Daily tasks and the schedule manager

_Audited 2026-09-26 against the kit at `8dd9b15` and App-Stack 1.7.0. Nothing is built; this batch
measures the brief against what the framework can express, checked in its source._

## 1. Reference

The owner's brief and answers (2026-09-26):

> There might be other scheduling items we need to remind the team. Ideally my team can come in and
> figure out what is their task for the day, and the things they need to update in the system during
> the day, so that our dashboard works. … Can we create some sort of schedule manager?
> Everyone does everything.

So there are two sources of tasks, and both land on one **Today** list:

| Source | Example | Who defines it |
|---|---|---|
| The crop cycle (batch 01) | Germination check for W39 on Saturday; transplant W39 on day 17 | Generated from the batch's dates |
| Routines, kept in the **schedule manager** | Daily pH/EC/water-temp reading; reservoir top-up; pest scouting twice a week; reservoir change every 7–14 days; Wednesday seeding | The owner, in the app, without a developer |

Industry practice (search summaries, `⚠`): Farmbrite creates Seed/Plant/Harvest tasks when a planting
is created and keeps task templates with repeating series (help.farmbrite.com/help/task-templates-and-series).
Croptracker assigns tasks from schedule templates to mobile workers. Daily pH, EC and top-up checks,
twice-weekly scouting, and a 7–14 day reservoir change are the common rhythm (see batch 03 for
targets).

## 2. Ours today

- No `task` or `routine` model, and no Today view. The only kit model with an assignee is
  `ticket.yaml` (`agentId` → `user`). `✔`
- No `app/hooks/`. `✔`

## 3. Reuse check

| Need | Framework feature | Source | Tag |
|---|---|---|---|
| Owner-editable routines | An ordinary model + `FormScreen` + `DataGrid` with edit/delete | `13-screens.md` | `✔` read |
| Task status with a **Done** button per row | `x-states` transition offered as a `DataGrid` `rowActions` entry, with `when: { state: … }` | `13-screens.md` §DataGrid | `✔` read |
| Recording a value while marking done (e.g. the pH reading) | a transition's `require`, drawn as a dialog | `02-models.md` §Lifecycle, `13-screens.md` §DataGrid | `⚠` doc-read, not run |
| A timer that generates tasks | `x-schedules` with `where` absent (runs the op once, no id) calling a code action | `02-models.md` §x-schedules | `✔` read |
| Code that creates and updates rows through the gates | a `path#export` handler using `ctx.call` (depth-capped at 5) | `04-dispatch-and-pipeline.md` §ctx.call | `✔` read |
| Who did a task, and when | `_audits` via `TimelineScreen`/`history` | `13-screens.md` §TimelineScreen | `✔` read |
| Email reminders | `notify` in `x-events` → SMTP provider in `notifications.yaml` | `17-capabilities.md` | `✔` read; SMS and push do not exist |

## 4. Flow

Staff member opens the app on a phone → **Today** → sees the tasks due today plus any overdue ones
(germination check W39, pH/EC reading, top-up) → taps **Done** on each, entering the value it asks
for → the task leaves the list, and the batch or reading it feeds updates the dashboard.

Owner → **Schedule manager** → adds "Pest scouting, Tue + Fri" → from the next day it appears on
Today on those days.

**Where it breaks:** the Today list cannot be filtered by date in the view (G2.1), and routines
cannot be turned into tasks by config alone (G2.3).

## 5. What backs it

- **A view cannot say "today".** `DataGrid.filter` is fixed equality (`13-screens.md` §DataGrid), and
  the only substitution is a whole-value `$param` from the matched route
  (`docs/stack/11-projection-and-frontend.md:151-154`). There is no `$actor` and no `$today`. `✔`
- **"Mine" is not needed.** Everyone does everything (owner), so Today is the farm's list, not a
  person's, and the missing `$actor` costs nothing here. `✔` owner-confirmed
- **A query can say "today"**, because its `where` value is JEXL over `{ params, actor, now }`
  (`06-persistence.md:155`). But `ReportScreen` has no row actions, so a report can show the list and
  cannot complete a task. `✔` doc-read
- **A schedule's `where` is static text** (`field:op:value`, `02-models.md:448`), so a schedule
  cannot select "due on or before now" either. `✔`
- **The framework has no time-zone handling.** A search for `timezone`/`Intl`/`TZ` across
  `packages/core/src` finds nothing, and `now` is an ISO timestamp in UTC. "Today" and "Wednesday"
  must be computed in code against the farm's own time zone. `✔`
- **Properties cannot be arrays** (`02-models.md:54`), so a routine's weekdays are seven booleans or
  a string, not a list. `✔`

**What fits, then:** store a task's state as `upcoming → due → done` (with `skipped` for "did not
apply today"). One code action on a `1h` schedule does three things in the farm's time zone:
promotes `upcoming` tasks dated today or earlier to `due`, creates today's tasks from active
routines, and keeps both idempotent so a late or repeated run creates nothing twice. Today is then
a `DataGrid` with the static `filter: { status: due }`, which the view *can* express. Overdue tasks
stay `due`, so nothing silently disappears. `⚠` design inferred from the pieces above, not yet run.

## 6. Gaps

| ID | Gap | Sev | Tag |
|---|---|---|---|
| G2.1 | No `task` model: title, kind (cycle / routine), due date, optional `batchId` and `routineId` lookups, state `upcoming → due → done / skipped`, done-by and done-at from the audit. | P0 | `✔` |
| G2.2 | No **Today** view. The view cannot filter by date (`11-projection-and-frontend.md:151`), so Today must filter on the `due` state that the schedule sets, not on the date. | P0 | `✔` |
| G2.3 | **Lens contradiction (coverage vs wiring).** "Recurring reminders → `x-schedules`" reads as covered, but a schedule is a fixed interval declared in YAML that no one in the app can edit, and it cannot mean a weekday (`model.ts:475`). A **schedule manager** the owner edits must be data (a `routine` model), turned into tasks by an app code action on a `1h` schedule. | P0 | `✔` |
| G2.4 | No `routine` model: title, instructions, rhythm (every N days *or* chosen weekdays as seven booleans), start date, active flag, and what it records (e.g. "reading" → batch 03). Owner-only write, staff read. | P0 | `✔` absent |
| G2.5 | Farm time zone: "today" and "Wednesday" are wrong for part of the day unless code computes them in the farm's zone. That zone has to be decided and written in one place; the framework carries no setting for it. | P1 | `✔` |
| G2.6 | Crop-cycle tasks must be created when a batch is created (check day 3, transplant day 17, harvest day 45–47), and closed when the batch moves (the check transition closes the check task), or Today and the batch disagree. That needs a code hook or event on the batch, since a declared `call` has no way to find the task's id. | P1 | `⚠` inferred |
| G2.7 | Generation must be idempotent: the ticker fires once, late, after downtime (`04-dispatch-and-pipeline.md` §Schedules), and a restart must not duplicate today's routine tasks. Use one task per (routine, date), enforced with `x-unique`. | P1 | `⚠` `x-unique` read, not run |
| G2.8 | Reminders outside the app: the only channels are email (SMTP) and a webhook. There is no SMS or push. If the team needs a morning nudge, that means a daily email, or a webhook into a chat tool, and a decision on who receives it. | P2 | `✔` `17-capabilities.md` |
| G2.9 | Completing a task that records a value (pH reading, germination count) should capture the value **at** the tap, through a transition's `require` dialog, not as a separate edit someone forgets. | P1 | `⚠` dialog from `require` not yet driven |

## Not checked in this batch

The dialog a transition's `require` produces on a `DataGrid` row, `x-unique` on a pair of fields,
and a code action run by a schedule. All three are doc-read, and the first build phase should prove
them live before anything is built on top of them.
