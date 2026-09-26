# 03 — Readings and locations

_Audited 2026-09-26 against the kit at `dda0e8e` and App-Stack 1.7.0. Nothing is built._

## 1. Reference

Owner's answers (2026-09-26):
- **Readings.** Taken **daily**.
- **Layout.** **One batch per greenhouse location.**
- **Time.** The farm runs on **Philippine time** (Asia/Manila, UTC+8, no daylight saving).

Typical daily readings and targets for hydroponic lettuce (search summaries, so `⚠`; the owner has
not yet confirmed their own targets):

| Reading | Target | Source |
|---|---|---|
| pH | 5.6–6.0 (5.8 best) | Cornell CEA Lettuce Handbook |
| EC | 1.2–1.8 mS/cm | producegrower.com lettuce guide |
| Water temperature | 18–22 °C | UF/IFAS HS1422 |
| Dissolved oxygen | ≥ 4 ppm, ~8 ideal | Cornell handbook |
| Air temperature / RH | 24 °C day, 19 °C night; RH 50–70% | Cornell handbook |
| Reservoir level / top-up | daily check | gardenandgreenhouse.net checklist |

These are temperate-greenhouse figures. A Philippine greenhouse will often read warmer, so the
targets must be the owner's own, editable in the app, rather than fixed in config.

## 2. Ours today

No `location`, `reading` or `target` model. `✔`

## 3. Reuse check

| Need | Framework feature | Tag |
|---|---|---|
| A greenhouse pick-list on batches and readings | `x-lookup` to a `location` model | `✔` read |
| One active batch per location, refused by the server | `x-guards` (`where` of field: expression, ANDed, with a `max`) — `02-models.md` §Capacity | `⚠` equality only, so it cannot say "status is not harvested" (G3.4) |
| Number fields with sane bounds (pH 0–14) | `type: number` + `minimum`/`maximum` | `✔` read |
| The daily reading as a Today task | a routine per location (batch 02) whose Done opens the reading form | `⚠` design |

## 4. Flow

Morning → **Today** shows "Readings — Greenhouse A" → staff enter pH, EC, water temperature, DO, air
temperature/RH, and whether they topped up → saved → any value outside that location's targets is
flagged, and it appears on the dashboard as "out of range today".

## 5. What backs it

- Flagging needs the reading compared to a **different model's row** (the target). A declared `set`
  or `deny` sees `input`, `row`, `actor` and `now`, not another model, so the flag is computed in a
  code hook (`./hooks/reading.ts`). `✔` (the expression view is documented in `02-models.md:137`)
- The reading's day must be the Manila date, not the UTC date: between 00:00 and 08:00 Manila time,
  UTC is still on yesterday. The code sets it. `✔` (framework has no time-zone handling, batch 02)

## 6. Gaps

| ID | Gap | Sev | Tag |
|---|---|---|---|
| G3.1 | No `greenhouse` model (name, 3 rows) and no `area` model (greenhouse lookup, name, **plant sites**, active; 4 per greenhouse). `batch.areaId` and `reading.greenhouseId` look them up. The nursery is a separate place in the flow, not an area. | P0 | `✔` |
| G3.2 | No `reading` model: location, Manila date, pH, EC, water temperature, DO, air temperature, RH, topped up (yes/no), note; plus an out-of-range flag and which reading tripped it. One per location per day (`x-unique` on location + date). | P0 | `✔` |
| G3.3 | No `target` model the owner edits: a min/max per reading kind. Owner decision: **start pH and EC at the recommended values (pH 5.6–6.0, EC 1.2–1.8 mS/cm) and keep them editable in the app**. Other readings are recorded without a target until the owner sets one. | P1 | `✔` owner-confirmed |
| G3.4 | "One batch per location" cannot be fully enforced by `x-guards`, whose `where` is equality only. Use a code check in the batch's `beforeCreate` hook, or accept a guard on the `seeded` state alone. | P2 | `⚠` read, not run |
| G3.5 | A batch's greenhouse location is **chosen at seeding** (owner, 2026-09-26), so `locationId` is required at create, and the one-batch-per-location check runs at create. The farm has **3 greenhouses × 4 areas**; a batch is placed in an area, and each area's plant-site count is owner-maintained in the app (see G3.6). | P0 | `✔` owner-confirmed |
| G3.6 | **Resolved (owner, 2026-09-26): each of the 3 greenhouses has 4 areas, so 12 areas in all.** A batch goes to an **area**, one batch per area, which leaves room for the 4–5 batches in production at once. So `location` is two levels: greenhouse → area. Plant sites are kept per area, readings per greenhouse (one reservoir question to confirm while building). | P1 | `✔` owner-confirmed |
