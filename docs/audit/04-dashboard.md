# 04 — Dashboard: germination first, then the rest

_Audited 2026-09-26 against the kit at `dda0e8e` and App-Stack 1.7.0. Nothing is built._

## 1. Reference

Owner's answers (2026-09-26): **germination is the priority metric**, because it drives the
inventory plan, and **the inventory plan is how many cells to sow**. The other metrics follow.

Candidate metrics (research, `⚠`; Agrilyst reporting, iUNU LUNA): harvest vs plan, loss by stage,
yield per plant or tray, days-to-harvest variance, readings out of range, and task completion.

The plan:

> cells to sow for a location = ⌈ plant sites ÷ recent germination rate × 1.10 ⌉ — **owner-confirmed 2026-09-26, with a 10% safety margin**

## 2. Ours today

`app/config/views/insights.yaml` draws one query (`articlesByTopic`) as a report and a chart. There
is no farm metric, and no query over batches, readings or tasks. `✔`

## 3. Reuse check

| Need | Framework feature | Source | Tag |
|---|---|---|---|
| A tiled page | `Dashboard` (grid; each tile gated independently) | `13-screens.md` §Dashboard | `✔` read |
| KPI number tiles | `ContentStats`, whose tile value "is either authored in config or read from a declared query" | `13-screens.md:699` | `✔` read, not run |
| Trend and breakdown charts | `ChartScreen` `kind: bar/line/pie` over a query, with an accessible table | `13-screens.md` §ChartScreen | `✔` read; kit's `/insights` renders one |
| Tables with CSV export | `ReportScreen` with `exportable` | `13-screens.md` §ReportScreen | `✔` read |
| Grouping and measures | query `groupBy` + `count/sum/avg/min/max` | `06-persistence.md:156` | `✔` read |

## 4. Flow

Owner opens **Dashboard** → the top row reads *germination % last batch*, *4-batch average*, *cells to
sow next Wednesday*, *tasks due / done today*, *readings out of range today* → below that, germination
by week (line), batches by stage (bar), and harvest by batch (table, exportable).

## 5. What backs it

- **No ratio measure.** Measures are `count`, `sum`, `avg`, `min`, `max` only (`06-persistence.md:156`),
  so germination % (germinated ÷ sown) cannot be a query. The batch's check hook computes it and stores
  it on the batch, and then `avg` works over it. `✔`
- **No date bucketing.** The query grammar has no date functions, so "by week" needs a stored
  `seedWeek` (e.g. `2026-W39`, Manila time) set by the batch hook. `✔` (grammar read in full)
- **Cells to sow** needs the recent rate and each location's plant sites. "Last 4 batches" needs a
  query row limit, which the grammar table does not list. The plan is therefore computed in code (the
  hourly job or the Wednesday seeding routine) and written somewhere a tile can read it. `⚠` limit
  absence inferred from the key table
- Every figure is only as good as the counts recorded at each transition (G1.6) and the daily reading
  (G3.2). The dashboard adds nothing that the Today flow did not capture. `✔`

## 6. Gaps

| ID | Gap | Sev | Tag |
|---|---|---|---|
| G4.1 | Stored derived fields on `batch`: `germinationPct` (at check), `seedWeek`, `survivalPct` (at transplant), computed in the batch hook because queries cannot divide or bucket dates. | P0 | `✔` |
| G4.2 | **Sowing plan**: cells to sow per location for next Wednesday = ⌈plant sites ÷ recent germination rate × 1.10⌉. Computed in code, stored (e.g. on the seeding task or a `sowingPlan` row), shown as the dashboard's lead tile and on the Wednesday seeding task itself. | P0 | `✔` need owner-confirmed; formula owner-confirmed (+10%) |
| G4.3 | Germination tiles and trend: last batch, 4-batch average, and a by-week line chart. | P0 | `✔` absent |
| G4.4 | Operations tiles: tasks due/done/overdue today, and readings out of range today. | P1 | `✔` absent |
| G4.5 | Batches by stage (bar), and harvest per batch (report, CSV). | P1 | `✔` absent |
| G4.6 | Replace the kit's `/insights`, `/articles` and `/board` demo pages and the `article`/`topic`/`ticket` models, so the navigation shows only the farm. | P1 | `✔` |
| G4.7 | `ContentStats` reading a query is documented, not yet driven. Prove one tile live before building the row. | P1 | `⚠` |
| G4.8 | Harvest is recorded as **weight only** (owner, 2026-09-26): `harvestKg` is required on the harvest transition, and yield is kg per batch and kg per plant site. | P1 | `✔` owner-confirmed |
