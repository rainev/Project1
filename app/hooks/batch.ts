/**
 * The batch's calendar and its ratios — the part config cannot say.
 *
 * Declared expressions have no date arithmetic, no division into a stored
 * value and no time zone (docs/audit/01-crop-cycle.md G1.2), so this file owns
 * them. Everything else about a batch — its fields, its lifecycle, who may move
 * it — stays in app/config/models/batch.yaml.
 *
 * Cycle (owner, 2026-09-26): check on day 3, transplant 14 days after the check
 * (day 17), harvest 28–30 days after transplant.
 */

// A refusal the person can act on is a field error: FormScreen and the row
// dialogs put a 422's message beside the field, while a plain deny reaches the
// form as the bare word "forbidden". The class is the framework's own, imported
// from the unpacked release (never edited) so `instanceof` matches.
import { ValidationFailure } from '../../.app-stack/packages/core/src/errors.ts';

type Row = Record<string, unknown>;

interface HookContext {
  data: Row;
  row?: Row;
  call(op: string, model: string, input?: { id?: string; data?: Row; query?: unknown }): Promise<unknown>;
}

type HookResult = void | { patch?: Row };

const refuse = (field: string, message: string): never => {
  throw new ValidationFailure([{ path: `/${field}`, keyword: 'farm', message }]);
};

export const CHECK_DAY = 3;
export const TRANSPLANT_DAY = CHECK_DAY + 14;
export const HARVEST_AFTER_TRANSPLANT = { from: 28, to: 30 };

/** Batches that still hold, or will hold, their area. */
const ACTIVE = ['seeded', 'checked', 'transplanted'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date on the farm. The server runs in UTC; the farm does not. */
export function manilaToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO-8601 week, e.g. 2026-W40. */
export function isoWeek(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function plannedDates(seededOn: string) {
  const transplantOn = addDays(seededOn, TRANSPLANT_DAY);
  return {
    checkOn: addDays(seededOn, CHECK_DAY),
    transplantOn,
    harvestFrom: addDays(transplantOn, HARVEST_AFTER_TRANSPLANT.from),
    harvestTo: addDays(transplantOn, HARVEST_AFTER_TRANSPLANT.to),
  };
}

const pct = (part: number, whole: number) => Math.round((part / whole) * 1000) / 10;

const slug = (text: string) => text.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase();

/**
 * An area holds one batch from transplant to harvest. Two batches clash when
 * those windows overlap, so the next batch can be seeded into an area whose
 * crop will be out before the new one arrives.
 */
async function clash(ctx: HookContext, areaId: string, window: { transplantOn: string; harvestTo: string }, selfId?: string) {
  const page = (await ctx.call('list', 'batch', {
    query: { limit: 100, filters: [
      { field: 'areaId', op: 'eq', value: areaId },
      { field: 'status', op: 'in', value: ACTIVE },
    ] },
  })) as { rows: Row[] };
  return page.rows.find((b) => b.id !== selfId
    && String(b.transplantOn) <= window.harvestTo
    && window.transplantOn <= String(b.harvestTo));
}

export async function beforeCreate(ctx: HookContext): Promise<HookResult> {
  const seededOn = (ctx.data.seededOn as string | undefined) ?? manilaToday();
  if (!ISO_DATE.test(seededOn)) refuse('seededOn', 'must be a date like 2026-09-30');

  const area = (await ctx.call('get', 'area', { id: String(ctx.data.areaId) })) as Row;
  if (area.active === false) refuse('areaId', `${area.name} is not active`);

  const dates = plannedDates(seededOn);
  const other = await clash(ctx, String(ctx.data.areaId), dates);
  if (other) refuse('areaId', `${area.name} is taken by batch ${other.title} until ${other.harvestTo}`);

  const seedWeek = isoWeek(seededOn);
  return {
    patch: {
      ...dates,
      seededOn,
      seedWeek,
      crop: (ctx.data.crop as string | undefined) || 'Lettuce',
      title: `${seedWeek}-${slug(String(area.name))}`,
    },
  };
}

export async function beforeUpdate(ctx: HookContext): Promise<HookResult> {
  const row = ctx.row ?? {};
  const next = { ...row, ...ctx.data };
  const sown = Number(next.cellsSown);
  const today = manilaToday();

  switch (ctx.data.status) {
    case 'checked': {
      const germinated = Number(next.germinatedCells);
      if (germinated > sown) refuse('germinatedCells', `cannot be more than the ${sown} cells sown`);
      return { patch: { checkedOn: today, germinationPct: pct(germinated, sown) } };
    }
    case 'transplanted': {
      const moved = Number(next.transplantedCount);
      if (moved > sown) refuse('transplantedCount', `cannot be more than the ${sown} cells sown`);
      return {
        patch: {
          transplantedOn: today,
          transplantPct: pct(moved, sown),
          harvestFrom: addDays(today, HARVEST_AFTER_TRANSPLANT.from),
          harvestTo: addDays(today, HARVEST_AFTER_TRANSPLANT.to),
        },
      };
    }
    case 'harvested':
      return { patch: { harvestedOn: today } };
  }

  // A plain edit: keep what was derived from the edited fields true.
  const patch: Row = {};
  if (ctx.data.germinatedCells !== undefined || ctx.data.cellsSown !== undefined) {
    if (next.germinatedCells !== undefined && next.germinatedCells !== null) {
      patch.germinationPct = pct(Number(next.germinatedCells), sown);
    }
  }
  if ((ctx.data.seededOn !== undefined || ctx.data.areaId !== undefined) && next.status === 'seeded') {
    const seededOn = String(next.seededOn);
    if (!ISO_DATE.test(seededOn)) refuse('seededOn', 'must be a date like 2026-09-30');
    const dates = plannedDates(seededOn);
    const other = await clash(ctx, String(next.areaId), dates, String(row.id));
    if (other) refuse('seededOn', `clashes with batch ${other.title} in the same area`);
    Object.assign(patch, dates, { seedWeek: isoWeek(seededOn) });
  }
  return Object.keys(patch).length ? { patch } : undefined;
}
