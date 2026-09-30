/**
 * The mock report engine shared by the reporting and records handlers: permission checks, row selection over the
 * report fixtures, redaction (BR-43), the §15.2 safeguards (event vs lot, currency basis, completeness), export
 * manifests and the text rendering of csv and html exports.
 *
 * Commands that create an export return a synthetic id that encodes what was requested (kind, format, index), so a
 * later `get` or `download` of that id rebuilds the same export without anything being persisted.
 */
import { formatMoney, round, sum } from '../../../contracts/decimal.js';
import type { EnumName, ExportsExportType, ExportsFormat, ReportDefinitionsFamily, TendersEventType, TendersStatus } from '../../../contracts/enums.js';
import { EXPORTS_FORMAT, REPORT_DEFINITIONS_FAMILY, enumLabel } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import type {
  ExportManifest,
  ReportCell,
  ReportColumn,
  ReportCompleteness,
  ReportFilters,
  ReportHighlight,
  ReportRedaction,
  ReportResult,
  ReportRow,
} from '../../../contracts/reporting.js';
import { REPORT_FAMILIES, REPORT_ROWS, REPORTING_AS_OF, reportFamily, tenderFact } from '../../fixtures/reporting/index.js';
import type { FixtureReportFamily, FixtureReportRow } from '../../fixtures/reporting/index.js';

// ---------------------------------------------------------------------------------------------------------
// Permissions and small helpers
// ---------------------------------------------------------------------------------------------------------

export function hasAny(granted: readonly PermissionCode[], wanted: readonly PermissionCode[]): boolean {
  return wanted.some((code) => granted.includes(code));
}

export function containsText(haystack: string, q: string | undefined): boolean {
  if (q === undefined || q === '') {
    return true;
  }
  const text = haystack.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token !== '')
    .every((token) => text.includes(token));
}

export function compareValues(a: string | number | null, b: string | number | null): number {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b));
}

export function sortRows<T>(rows: readonly T[], key: ((row: T) => string | number | null) | null, dir: 'asc' | 'desc'): T[] {
  if (key === null) {
    return [...rows];
  }
  const factor = dir === 'desc' ? -1 : 1;
  return [...rows].sort((left, right) => factor * compareValues(key(left), key(right)));
}

/** The calendar date of an instant (UTC date is enough for the fixture dates). */
export function dateOf(instant: string): string {
  return instant.slice(0, 10);
}

// ---------------------------------------------------------------------------------------------------------
// Row selection
// ---------------------------------------------------------------------------------------------------------

export interface ReportSelection {
  readonly from: string | null;
  readonly to: string | null;
  readonly legalEntityIds: readonly number[];
  readonly departmentIds: readonly number[];
  readonly categoryIds: readonly number[];
  readonly ownerUserIds: readonly number[];
  readonly stages: readonly TendersStatus[];
  readonly eventTypes: readonly TendersEventType[];
  readonly level: 'both' | 'event' | 'lot';
  readonly q: string | undefined;
}

export function selectionFromFilters(filters: ReportFilters, q?: string): ReportSelection {
  return { ...filters, q };
}

function one(value: number | undefined): readonly number[] {
  return value === undefined ? [] : [value];
}

export function selectionFromQuery(query: {
  from?: string | undefined;
  to?: string | undefined;
  legalEntityId?: number | undefined;
  departmentId?: number | undefined;
  categoryId?: number | undefined;
  ownerUserId?: number | undefined;
  level: 'both' | 'event' | 'lot';
  q?: string | undefined;
}): ReportSelection {
  return {
    from: query.from ?? null,
    to: query.to ?? null,
    legalEntityIds: one(query.legalEntityId),
    departmentIds: one(query.departmentId),
    categoryIds: one(query.categoryId),
    ownerUserIds: one(query.ownerUserId),
    stages: [],
    eventTypes: [],
    level: query.level,
    q: query.q,
  };
}

function cellText(value: ReportCell): string {
  switch (value.kind) {
    case 'text':
    case 'decimal':
    case 'percent':
    case 'days':
    case 'date':
    case 'reference':
      return value.value;
    case 'count':
      return String(value.value);
    case 'money':
      return `${value.value.currency} ${value.value.amount}`;
    case 'status':
      return enumLabel(value.value.enum as EnumName, value.value.value);
    case 'missing':
    case 'restricted':
      return '';
  }
}

function rowMatches(row: FixtureReportRow, selection: ReportSelection): boolean {
  if (selection.from !== null && row.date < selection.from) {
    return false;
  }
  if (selection.to !== null && row.date > selection.to) {
    return false;
  }
  if (selection.level === 'event' && row.level === 'lot') {
    return false;
  }
  if (selection.level === 'lot' && row.level !== 'lot') {
    return false;
  }
  const dimensional =
    selection.legalEntityIds.length + selection.departmentIds.length + selection.categoryIds.length + selection.ownerUserIds.length + selection.stages.length + selection.eventTypes.length > 0;
  if (dimensional) {
    if (row.tenderId === null) {
      return false;
    }
    const tender = tenderFact(row.tenderId);
    if (selection.legalEntityIds.length > 0 && !selection.legalEntityIds.includes(tender.legalEntityId)) return false;
    if (selection.departmentIds.length > 0 && !selection.departmentIds.includes(tender.departmentId)) return false;
    if (selection.categoryIds.length > 0 && !selection.categoryIds.includes(tender.categoryId)) return false;
    if (selection.ownerUserIds.length > 0 && !selection.ownerUserIds.includes(tender.ownerUserId)) return false;
    if (selection.stages.length > 0 && !selection.stages.includes(tender.status)) return false;
    if (selection.eventTypes.length > 0 && !selection.eventTypes.includes(tender.eventType)) return false;
  }
  if (selection.q !== undefined && selection.q !== '') {
    const text = Object.values(row.cells).map(cellText).join(' ');
    if (!containsText(text, selection.q)) {
      return false;
    }
  }
  return true;
}

export function selectRows(tenantId: number, family: ReportDefinitionsFamily, selection: ReportSelection): FixtureReportRow[] {
  return REPORT_ROWS.filter((row) => row.tenantId === tenantId && row.family === family && rowMatches(row, selection));
}

// ---------------------------------------------------------------------------------------------------------
// Building a report result
// ---------------------------------------------------------------------------------------------------------

export function familyRestricted(family: FixtureReportFamily, permissions: readonly PermissionCode[]): boolean {
  return !hasAny(permissions, family.runWith);
}

export function redactionsFor(family: FixtureReportFamily, permissions: readonly PermissionCode[], fields: readonly string[] | null): ReportRedaction[] {
  return family.fields
    .filter((item) => (fields === null || fields.includes(item.key)) && item.restrictedTo !== null && !hasAny(permissions, item.restrictedTo))
    .map((item) => ({
      field: item.label,
      reason: `Visible only to holders of ${(item.restrictedTo ?? []).join(' or ')} (BR-43).`,
    }));
}

export function columnsFor(family: FixtureReportFamily, fields: readonly string[] | null): ReportColumn[] {
  return family.fields
    .filter((item) => fields === null || fields.includes(item.key))
    .map((item) => ({
      key: item.key,
      label: item.label,
      kind: item.kind,
      numeric: ['count', 'money', 'decimal', 'percent', 'days'].includes(item.kind),
    }));
}

/** The rows as the caller may see them: restricted fields redacted, drill-through only when permitted. */
export function visibleRows(
  family: FixtureReportFamily,
  rows: readonly FixtureReportRow[],
  permissions: readonly PermissionCode[],
  fields: readonly string[] | null,
): ReportRow[] {
  return rows.map((row) => {
    const cells: Record<string, ReportCell> = {};
    for (const item of family.fields) {
      if (fields !== null && !fields.includes(item.key)) {
        continue;
      }
      const value = row.cells[item.key];
      if (value === undefined) {
        cells[item.key] = { kind: 'missing', reason: 'Not recorded for this row.' };
      } else if (item.restrictedTo !== null && !hasAny(permissions, item.restrictedTo)) {
        cells[item.key] = { kind: 'restricted', reason: 'You are not authorized to see this value.' };
      } else if (value.kind === 'reference' && value.to !== null && !hasAny(permissions, row.drillWith)) {
        cells[item.key] = { kind: 'reference', value: value.value, to: null };
      } else {
        cells[item.key] = value;
      }
    }
    return {
      id: row.id,
      level: row.level,
      parentId: row.parentId,
      cells,
      drillThrough: hasAny(permissions, row.drillWith) ? row.drillThrough : null,
    };
  });
}

export function completenessOf(rows: readonly FixtureReportRow[]): ReportCompleteness {
  const reasons = new Set<string>();
  for (const row of rows) {
    for (const value of Object.values(row.cells)) {
      if (value.kind === 'missing') {
        reasons.add(value.reason);
      }
    }
  }
  const withMissing = rows.filter((row) => row.missingData).length;
  const notes = [...reasons].slice(0, 6);
  if (withMissing > 0) {
    notes.unshift('Missing values are shown as missing, never as zero (PRD §15.2).');
  }
  return { complete: withMissing === 0, recordsIncluded: rows.length, recordsWithMissingData: withMissing, notes };
}

/**
 * Totals over event and record rows only (lot values are never added to their event). Fields marked `distinct`
 * (per-event unique organizations) are never summed: their total is the number of DISTINCT organizations across the
 * visible event rows, taken from the fixture rows' `distinctOrgs` (AC-34). Fields marked `none` get no total.
 */
export function totalsOf(
  family: FixtureReportFamily,
  rows: readonly ReportRow[],
  fixtureRows: readonly FixtureReportRow[],
): Record<string, ReportCell> | null {
  const topRows = rows.filter((row) => row.level !== 'lot');
  const fixtureById = new Map(fixtureRows.map((row) => [row.id, row]));
  const totals: Record<string, ReportCell> = {};
  let any = false;
  for (const item of family.fields) {
    const values = topRows.map((row) => row.cells[item.key]).filter((value): value is ReportCell => value !== undefined);
    if (values.length === 0) {
      continue;
    }
    if (item.total === 'none') {
      continue;
    }
    if (values.every((value) => value.kind === 'restricted')) {
      if (item.kind === 'count' || item.kind === 'money') {
        totals[item.key] = { kind: 'restricted', reason: 'You are not authorized to see this value.' };
        any = true;
      }
      continue;
    }
    if (item.total === 'distinct') {
      const organizations = new Set(topRows.flatMap((row) => fixtureById.get(row.id)?.distinctOrgs[item.key] ?? []));
      totals[item.key] = { kind: 'count', value: organizations.size };
      any = true;
    } else if (item.kind === 'count') {
      totals[item.key] = {
        kind: 'count',
        value: values.reduce((total, value) => total + (value.kind === 'count' ? value.value : 0), 0),
      };
      any = true;
    } else if (item.kind === 'money') {
      const amounts = values.flatMap((value) => (value.kind === 'money' ? [value.value.amount] : []));
      const currency = values.find((value) => value.kind === 'money');
      totals[item.key] = {
        kind: 'money',
        value: { amount: amounts.length === 0 ? '0.00' : round(sum(amounts), 2), currency: currency?.kind === 'money' ? currency.value.currency : 'BWP' },
      };
      any = true;
    }
  }
  if (!any) {
    return null;
  }
  const first = family.fields[0];
  if (first !== undefined && totals[first.key] === undefined) {
    totals[first.key] = { kind: 'text', value: `Total (${topRows.length} ${topRows.length === 1 ? 'row' : 'rows'}, lots excluded)` };
  }
  return totals;
}

export function highlightsOf(family: FixtureReportFamily, rows: readonly FixtureReportRow[], visible: readonly ReportRow[], totals: Record<string, ReportCell> | null): ReportHighlight[] {
  const eventRows = rows.filter((row) => row.level !== 'lot');
  const lotRows = rows.filter((row) => row.level === 'lot');
  const highlights: ReportHighlight[] = [
    { key: 'rows', label: eventRows.some((row) => row.level === 'record') ? 'Records' : 'Events', cell: { kind: 'count', value: eventRows.length } },
  ];
  if (lotRows.length > 0) {
    highlights.push({ key: 'lots', label: 'Lot rows (shown separately)', cell: { kind: 'count', value: lotRows.length } });
  }
  if (family.family === 'participation') {
    const distinct = new Set(eventRows.flatMap((row) => row.bidderTenantIds));
    highlights.push({ key: 'distinctBidders', label: 'Distinct bidding organizations (all events)', cell: { kind: 'count', value: distinct.size } });
  }
  for (const item of family.fields) {
    if (highlights.length >= 4) {
      break;
    }
    const total = totals?.[item.key];
    if (total !== undefined && (total.kind === 'money' || total.kind === 'count' || total.kind === 'restricted') && item.kind !== 'text') {
      highlights.push({ key: `total_${item.key}`, label: `Total ${item.label.toLowerCase()}`, cell: total });
    }
  }
  return visible.length === 0 ? highlights.slice(0, 1) : highlights;
}

export function chartOf(family: FixtureReportFamily, visible: readonly ReportRow[]): ReportResult['chart'] {
  if (family.chart === null) {
    return null;
  }
  const { valueField, labelField, title } = family.chart;
  const items = visible
    .filter((row) => row.level !== 'lot')
    .flatMap((row) => {
      const value = row.cells[valueField];
      const label = row.cells[labelField];
      if (value === undefined || label === undefined) {
        return [];
      }
      const labelText = label.kind === 'reference' || label.kind === 'text' ? label.value : row.id;
      if (value.kind === 'count') {
        return [{ id: row.id, label: labelText, value: value.value, display: String(value.value) }];
      }
      if (value.kind === 'money') {
        return [{ id: row.id, label: labelText, value: Number(value.value.amount), display: formatMoney(value.value.amount, value.value.currency) }];
      }
      if (value.kind === 'days') {
        return [{ id: row.id, label: labelText, value: Number(value.value), display: `${value.value} days` }];
      }
      return [];
    });
  return items.length === 0 ? null : { title, items };
}

export const LEVEL_NOTES = {
  both: 'Event rows and lot rows are labelled; totals and highlights use event rows only.',
  event: 'Event-level rows only; lot rows are hidden.',
  lot: 'Lot-level rows only; they are never added to their event totals.',
} as const;

export function buildReport(
  tenantId: number,
  currency: string,
  family: FixtureReportFamily,
  selection: ReportSelection,
  permissions: readonly PermissionCode[],
  fields: readonly string[] | null,
): ReportResult {
  const rows = selectRows(tenantId, family.family, selection);
  const visible = visibleRows(family, rows, permissions, fields);
  const totals = totalsOf(family, visible, rows);
  return {
    family: family.family,
    title: family.title,
    description: family.description,
    asOf: REPORTING_AS_OF,
    period: { from: selection.from, to: selection.to },
    levelBasis: { level: selection.level, note: selection.level === 'both' ? family.levelNote : `${LEVEL_NOTES[selection.level]} ${family.levelNote}` },
    currencyBasis: currencyBasis(currency),
    countingBasis: family.countingBasis.map((item) => ({ ...item })),
    completeness: completenessOf(rows),
    highlights: highlightsOf(family, rows, visible, totals),
    columns: columnsFor(family, fields),
    rows: visible,
    totals: visible.length === 0 ? null : totals,
    chart: chartOf(family, visible),
    redactions: redactionsFor(family, permissions, fields),
  };
}

export function currencyBasis(currency: string): ReportResult['currencyBasis'] {
  return {
    currency,
    conversionDate: null,
    note: `All amounts are in ${currency} as recorded; no currency conversion was needed or applied.`,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Exports: manifests, synthetic ids and rendering
// ---------------------------------------------------------------------------------------------------------

export function reportManifest(family: FixtureReportFamily, rows: readonly FixtureReportRow[], redactions: readonly ReportRedaction[], versionLabel: string | null): ExportManifest {
  const completeness = completenessOf(rows);
  return {
    contents: [{ label: family.title, description: `${LEVEL_NOTES.both} ${family.levelNote}`, recordCount: rows.length }],
    versions: versionLabel === null ? [] : [{ label: 'Report definition', reference: versionLabel, version: 'current' }],
    omissions: completeness.complete
      ? []
      : [{ label: 'Missing values', reason: `${completeness.recordsWithMissingData} rows have missing values; they are marked, never shown as zero.` }],
    redactions: [...redactions],
  };
}

/** Kinds of export the mock can rebuild from a synthetic id. */
export type SyntheticExportKind = 'family' | 'definition' | 'evidence';
const KIND_CODES: Record<SyntheticExportKind, number> = { family: 1, definition: 2, evidence: 3 };

/** `9KFIII`: kind K, format F, index III (ids ≥ 900 000 never collide with fixtures). */
export function syntheticExportId(kind: SyntheticExportKind, format: ExportsFormat, index: number): number {
  return 900_000 + KIND_CODES[kind] * 10_000 + EXPORTS_FORMAT.indexOf(format) * 1_000 + index;
}

export function decodeSyntheticExportId(id: number): { kind: SyntheticExportKind; format: ExportsFormat; index: number } | null {
  if (id < 900_000 || id >= 940_000) {
    return null;
  }
  const rest = id - 900_000;
  const kindCode = Math.floor(rest / 10_000);
  const formatIndex = Math.floor((rest % 10_000) / 1_000);
  const index = rest % 1_000;
  const kind = (Object.keys(KIND_CODES) as SyntheticExportKind[]).find((key) => KIND_CODES[key] === kindCode);
  const format = EXPORTS_FORMAT[formatIndex];
  if (kind === undefined || format === undefined) {
    return null;
  }
  return { kind, format, index };
}

export function familyIndex(family: ReportDefinitionsFamily): number {
  return REPORT_DEFINITIONS_FAMILY.indexOf(family);
}

export function familyAt(index: number): FixtureReportFamily | undefined {
  const name = REPORT_DEFINITIONS_FAMILY[index];
  return name === undefined ? undefined : REPORT_FAMILIES.find((row) => row.family === name);
}

export const CONTENT_TYPES: Record<ExportsFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  html: 'text/html; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function csvCell(text: string): string {
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function exportCellText(value: ReportCell | undefined): string {
  if (value === undefined) {
    return '';
  }
  if (value.kind === 'missing') {
    return `[missing: ${value.reason}]`;
  }
  if (value.kind === 'restricted') {
    return '[restricted]';
  }
  return cellText(value);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderReport(format: 'csv' | 'html', title: string, columns: readonly ReportColumn[], rows: readonly ReportRow[], manifest: ExportManifest): string {
  if (format === 'csv') {
    const header = ['Level', ...columns.map((column) => column.label)].map(csvCell).join(',');
    const lines = rows.map((row) => [row.level, ...columns.map((column) => exportCellText(row.cells[column.key]))].map(csvCell).join(','));
    return [header, ...lines].join('\r\n');
  }
  const head = ['Level', ...columns.map((column) => column.label)].map((label) => `<th>${escapeHtml(label)}</th>`).join('');
  const body = rows
    .map((row) => `<tr><td>${row.level}</td>${columns.map((column) => `<td>${escapeHtml(exportCellText(row.cells[column.key]))}</td>`).join('')}</tr>`)
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><h1>${escapeHtml(title)}</h1><p>Data as of ${REPORTING_AS_OF}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${renderManifestHtml(manifest)}</body></html>`;
}

export function renderManifestHtml(manifest: ExportManifest): string {
  const list = (title: string, items: readonly string[]): string =>
    items.length === 0 ? '' : `<h2>${escapeHtml(title)}</h2><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  return [
    list('Contents', manifest.contents.map((item) => `${item.label}: ${item.description}${item.recordCount === null ? '' : ` (${item.recordCount})`}`)),
    list('Versions', manifest.versions.map((item) => `${item.label}${item.reference === null ? '' : ` ${item.reference}`}: ${item.version}`)),
    list('Omissions', manifest.omissions.map((item) => `${item.label}: ${item.reason}`)),
    list('Redactions', manifest.redactions.map((item) => `${item.field}: ${item.reason}`)),
  ].join('');
}

export function renderEvidencePack(format: 'csv' | 'html', title: string, manifest: ExportManifest): string {
  if (format === 'csv') {
    const lines = [
      ['Section', 'Item', 'Detail', 'Count'].join(','),
      ...manifest.contents.map((item) => ['Contents', item.label, item.description, item.recordCount === null ? '' : String(item.recordCount)].map(csvCell).join(',')),
      ...manifest.versions.map((item) => ['Version', item.label, `${item.reference ?? ''} ${item.version}`.trim(), ''].map(csvCell).join(',')),
      ...manifest.omissions.map((item) => ['Omission', item.label, item.reason, ''].map(csvCell).join(',')),
      ...manifest.redactions.map((item) => ['Redaction', item.field, item.reason, ''].map(csvCell).join(',')),
    ];
    return lines.join('\r\n');
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><h1>${escapeHtml(title)}</h1>${renderManifestHtml(manifest)}</body></html>`;
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function exportTypeLabel(type: ExportsExportType): string {
  return enumLabel('exports.export_type', type);
}

export { reportFamily };
