/**
 * Small helpers shared by the reporting features (dashboard, reports, records, search): query compaction, id parsing,
 * the quick date ranges of the filter bars and the permission sets of the reporting screens.
 */
import type { PermissionCode } from '@contracts/permissions';

/** Drops empty strings, `null` and `undefined` so the query string only carries what the user chose. */
export function compact<T extends Record<string, unknown>>(values: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(values) as [keyof T, T[keyof T]][]) {
    if (value === '' || value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    result[key] = value;
  }
  return result;
}

/** A positive integer id from a select value, or `undefined`. */
export function idOf(value: string): number | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  const id = Number(value);
  return id > 0 ? id : undefined;
}

/** Returns `value` when it is one of `allowed`, else `undefined`. */
export function oneOf<const T extends string>(value: string, allowed: readonly T[]): T | undefined {
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export const QUICK_RANGES = ['thisMonth', 'lastMonth', 'thisQuarter', 'thisYear'] as const;
export type QuickRange = (typeof QUICK_RANGES)[number];

function iso(year: number, monthIndex: number, day: number): string {
  const date = new Date(Date.UTC(year, monthIndex, day));
  return date.toISOString().slice(0, 10);
}

/** The calendar dates (`YYYY-MM-DD`) of a quick range around `today`. */
export function quickRangeDates(range: QuickRange, today: Date): { from: string; to: string } {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  switch (range) {
    case 'thisMonth':
      return { from: iso(year, month, 1), to: iso(year, month + 1, 0) };
    case 'lastMonth':
      return { from: iso(year, month - 1, 1), to: iso(year, month, 0) };
    case 'thisQuarter': {
      const start = month - (month % 3);
      return { from: iso(year, start, 1), to: iso(year, start + 3, 0) };
    }
    case 'thisYear':
      return { from: iso(year, 0, 1), to: iso(year, 11, 31) };
  }
}

/** Permissions that open the report catalog and report runs (REP-01). */
export const REPORT_READ: readonly [PermissionCode, ...PermissionCode[]] = [
  'report.view',
  'report.manage',
];
/** Permissions that open ADM-13 (report definitions and the export history). */
export const REPORT_ADMIN_READ: readonly [PermissionCode, ...PermissionCode[]] = [
  'report.view',
  'report.manage',
  'export.create',
  'audit.view',
];
/** Permissions that read the export history. */
export const EXPORT_READ: readonly [PermissionCode, ...PermissionCode[]] = [
  'export.create',
  'report.manage',
  'audit.view',
];
