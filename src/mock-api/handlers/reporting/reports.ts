/**
 * REP-01, REP-02 and ADM-13 handlers: report families, report runs, report definitions (list, detail, create,
 * update, preview, activation, run now), recipient candidates, and controlled exports (list, detail, request,
 * download). Every command validates the fixture state and answers with a static, contract-valid outcome.
 */
import type { PersonRef } from '../../../contracts/common.js';
import type { ExportsFormat } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import type {
  ExportRecord,
  ReportDefinition,
  ReportDefinitionBody,
  ReportDefinitionRow,
  ReportRecipient,
  ReportRun,
  ReportSchedule,
} from '../../../contracts/reporting.js';
import {
  createReportDefinition,
  createReportExport,
  downloadExport,
  getExport,
  getReportDefinition,
  listExports,
  listRecipientCandidates,
  listReportDefinitions,
  listReportFamilies,
  previewReportDefinition,
  runReport,
  runReportDefinition,
  setReportDefinitionActive,
  updateReportDefinition,
} from '../../../contracts/reporting.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { PERSONAS } from '../../fixtures/platform.js';
import {
  EMPTY_FILTERS,
  EXPORTS,
  OFFICIAL_TIME_ZONE,
  REPORTING_AS_OF,
  REPORT_DEFINITIONS,
  REPORT_FAMILIES,
  REPORT_RUNS,
  reportFamily,
} from '../../fixtures/reporting/index.js';
import type { FixtureExport, FixtureReportDefinition } from '../../fixtures/reporting/index.js';
import { findPersonaById, personRef, resolveTenantAccess } from '../../persona.js';
import { decodeEvidencePackIndex, evidencePackManifest, evidencePackSubjectAt } from '../records/packs.js';
import type { TenantAccess } from '../../persona.js';
import {
  CONTENT_TYPES,
  buildReport,
  byteLength,
  columnsFor,
  completenessOf,
  containsText,
  currencyBasis,
  decodeSyntheticExportId,
  familyAt,
  familyIndex,
  familyRestricted,
  hasAny,
  redactionsFor,
  renderEvidencePack,
  renderReport,
  reportManifest,
  selectRows,
  selectionFromFilters,
  selectionFromQuery,
  sortRows,
  syntheticExportId,
  visibleRows,
} from './engine.js';

// ---------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------

/** Whether a person holds `permission` in `tenantId` today (recipient authorization, DD-19). */
export function recipientAuthorization(userId: number, tenantId: number, permission: PermissionCode, now: Date): ReportRecipient {
  const persona = findPersonaById(userId);
  const user: PersonRef = persona === undefined ? { userId, fullName: `User ${userId}` } : { userId, fullName: persona.fullName };
  if (persona === undefined) {
    return { user, authorized: false, reason: 'Unknown user.' };
  }
  const access = resolveTenantAccess(persona, tenantId, now, 'buyer');
  if (access === null) {
    return { user, authorized: false, reason: 'No active membership in this organization.' };
  }
  if (!access.permissions.includes(permission)) {
    return { user, authorized: false, reason: `Does not hold ${permission}.` };
  }
  return { user, authorized: true, reason: null };
}

function scheduleOf(definition: Pick<FixtureReportDefinition, 'scheduleCron' | 'scheduleDescription' | 'nextRunAt'>): ReportSchedule | null {
  if (definition.scheduleCron === null) {
    return null;
  }
  return {
    cron: definition.scheduleCron,
    description: definition.scheduleDescription ?? `Runs on the schedule "${definition.scheduleCron}" (${OFFICIAL_TIME_ZONE})`,
    timeZone: OFFICIAL_TIME_ZONE,
    nextRunAt: definition.nextRunAt,
  };
}

function describeCron(cron: string): string {
  const [minute = '0', hour = '0', dayOfMonth = '*', month = '*', dayOfWeek = '*'] = cron.split(/\s+/);
  const time = /^\d+$/.test(hour) && /^\d+$/.test(minute) ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : `${hour}:${minute}`;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (dayOfMonth === '*' && month === '*' && /^\d$/.test(dayOfWeek)) {
    return `Every ${days[Number(dayOfWeek)] ?? dayOfWeek} at ${time} (${OFFICIAL_TIME_ZONE})`;
  }
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `Every day at ${time} (${OFFICIAL_TIME_ZONE})`;
  }
  if (/^\d+$/.test(dayOfMonth) && month === '*') {
    return `On day ${dayOfMonth} of every month at ${time} (${OFFICIAL_TIME_ZONE})`;
  }
  return `On the schedule "${cron}" (${OFFICIAL_TIME_ZONE})`;
}

function lastRunOf(definitionId: number): string | null {
  const runs = REPORT_RUNS.filter((run) => run.definitionId === definitionId).map((run) => run.runAt).sort();
  return runs.at(-1) ?? null;
}

function definitionVisible(definition: FixtureReportDefinition, permissions: readonly PermissionCode[]): boolean {
  return permissions.includes('report.manage') || permissions.includes(definition.audiencePermission);
}

function toRow(definition: FixtureReportDefinition): ReportDefinitionRow {
  return {
    id: definition.id,
    name: definition.name,
    family: definition.family,
    owner: personRef(definition.ownerUserId),
    audiencePermission: definition.audiencePermission,
    currencyBasis: definition.currencyBasis,
    schedule: scheduleOf(definition),
    active: definition.active,
    recipientCount: definition.recipientUserIds.length,
    lastRunAt: lastRunOf(definition.id),
    updatedAt: definition.updatedAt,
  };
}

/** The run's export as the caller may see it: always named, linkable only when the caller may open it. */
function exportSummary(exportId: number | null, viewer: ExportViewer): ReportRun['export'] {
  if (exportId === null) {
    return null;
  }
  const record = EXPORTS.find((row) => row.id === exportId);
  return record === undefined
    ? null
    : {
        id: record.id,
        format: record.format,
        status: record.status,
        fileName: record.fileName,
        accessible: exportVisible(record, viewer.userId, viewer.permissions),
      };
}

/** Who reads a definition: the export links of its run history depend on it. */
interface ExportViewer {
  readonly userId: number;
  readonly permissions: readonly PermissionCode[];
}

function toDetail(definition: FixtureReportDefinition, now: Date, viewer: ExportViewer): ReportDefinition {
  return {
    ...toRow(definition),
    fields: [...definition.fields],
    filters: definition.filters,
    conversionDate: definition.conversionDate,
    recipients: definition.recipientUserIds.map((userId) => recipientAuthorization(userId, definition.tenantId, definition.audiencePermission, now)),
    runs: REPORT_RUNS.filter((run) => run.definitionId === definition.id)
      .sort((a, b) => b.runAt.localeCompare(a.runAt))
      .map((run) => ({
        id: run.id,
        definitionId: run.definitionId,
        runBy: run.runBy === null ? null : personRef(run.runBy),
        runAt: run.runAt,
        rowCount: run.rowCount,
        export: exportSummary(run.exportId, viewer),
        recipients: run.recipientUserIds.map((userId) => personRef(userId)),
        excludedRecipients: run.excluded.map((item) => ({ user: personRef(item.userId), reason: item.reason })),
      })),
    createdAt: definition.createdAt,
  };
}

function exportVisible(record: { requestedBy: number }, userId: number, permissions: readonly PermissionCode[]): boolean {
  return record.requestedBy === userId || hasAny(permissions, ['report.manage', 'audit.view']);
}

function toExportRecord(record: FixtureExport): ExportRecord {
  const { tenantId: _tenantId, requestedBy, ...rest } = record;
  return { ...rest, requestedBy: personRef(requestedBy) };
}

function fileStem(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** The export a synthetic id stands for, requested by `userId` (see `syntheticExportId`). */
export function syntheticExport(id: number, tenant: TenantAccess, userId: number, now: Date): ExportRecord | null {
  const decoded = decodeSyntheticExportId(id);
  if (decoded === null) {
    return null;
  }
  const ready = decoded.format !== 'xlsx';
  const requestedAt = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const base = {
    id,
    format: decoded.format,
    status: ready ? ('ready' as const) : ('queued' as const),
    requestedBy: personRef(userId),
    requestedAt,
    completedAt: ready ? requestedAt : null,
    error: null,
    documentId: null,
    sizeBytes: null,
  };
  if (decoded.kind === 'family' || decoded.kind === 'definition') {
    const definition = decoded.kind === 'definition' ? REPORT_DEFINITIONS.find((row) => row.id === decoded.index && row.tenantId === tenant.tenant.id) : undefined;
    const family = decoded.kind === 'family' ? familyAt(decoded.index) : definition === undefined ? undefined : reportFamily(definition.family);
    if (family === undefined || (decoded.kind === 'definition' && definition === undefined)) {
      return null;
    }
    const fields = definition === undefined ? null : definition.fields;
    const rows = selectRows(tenant.tenant.id, family.family, selectionFromFilters(definition?.filters ?? EMPTY_FILTERS));
    const label = definition?.name ?? family.title;
    return {
      ...base,
      exportType: 'report',
      scopeDescription: `${label} — requested ${requestedAt.slice(0, 10)}`,
      subjectType: definition === undefined ? null : 'report_definition',
      subjectId: definition?.id ?? null,
      subjectLabel: definition?.name ?? null,
      reportFamily: family.family,
      definitionId: definition?.id ?? null,
      fileName: ready ? `${fileStem(label)}.${decoded.format}` : null,
      manifest: ready ? reportManifest(family, rows, redactionsFor(family, tenant.permissions, fields), definition?.name ?? null) : null,
    };
  }
  const pack = decodeEvidencePackIndex(decoded.index);
  const subject = evidencePackSubjectAt(pack.subjectIndex);
  if (subject === undefined || subject.tenantId !== tenant.tenant.id) {
    return null;
  }
  const label = `${subject.reference ?? ''} ${subject.label}`.trim();
  return {
    ...base,
    exportType: 'evidence_pack',
    scopeDescription: `Evidence pack — ${label}`,
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    subjectLabel: label,
    reportFamily: null,
    definitionId: null,
    fileName: ready ? `evidence-pack-${fileStem(subject.reference ?? subject.label)}.${decoded.format}` : null,
    manifest: ready ? evidencePackManifest(subject, pack.includeAuditTrail, pack.includeRestrictedMetadata) : null,
  };
}

/** The downloadable text of a ready export. */
function exportContent(record: ExportRecord, tenant: TenantAccess): string {
  const format = record.format === 'html' ? 'html' : 'csv';
  const manifest = record.manifest ?? { contents: [], versions: [], omissions: [], redactions: [] };
  if (record.exportType === 'report' && record.reportFamily !== null) {
    const family = reportFamily(record.reportFamily);
    const definition = record.definitionId === null ? undefined : REPORT_DEFINITIONS.find((row) => row.id === record.definitionId);
    const fields = definition === undefined ? null : definition.fields;
    const rows = selectRows(tenant.tenant.id, family.family, selectionFromFilters(definition?.filters ?? EMPTY_FILTERS));
    return renderReport(format, record.scopeDescription, columnsFor(family, fields), visibleRows(family, rows, tenant.permissions, fields), manifest);
  }
  return renderEvidencePack(format, record.scopeDescription, manifest);
}

/** Validation shared by create, update and preview. */
function validateDefinition(body: ReportDefinitionBody, tenantCurrency: string, fail: (status: number, code: string, detail?: string) => never): void {
  const family = reportFamily(body.family);
  const unknown = body.fields.filter((key) => !family.fields.some((item) => item.key === key));
  if (unknown.length > 0) {
    fail(422, 'FIELD_NOT_IN_FAMILY', `Not a field of ${family.title}: ${unknown.join(', ')}.`);
  }
  if (body.currencyBasis !== tenantCurrency) {
    fail(422, 'CURRENCY_BASIS_UNAVAILABLE', `No approved exchange rates are recorded; use ${tenantCurrency}.`);
  }
  if (body.scheduleCron !== null && body.recipientUserIds.length === 0) {
    fail(422, 'SCHEDULE_REQUIRES_RECIPIENTS', 'A scheduled report needs at least one recipient.');
  }
}

function definitionFromBody(id: number, tenantId: number, ownerUserId: number, body: ReportDefinitionBody, createdAt: string, updatedAt: string, active: boolean): FixtureReportDefinition {
  return {
    id,
    tenantId,
    name: body.name,
    family: body.family,
    fields: body.fields,
    filters: body.filters,
    currencyBasis: body.currencyBasis,
    conversionDate: body.conversionDate,
    audiencePermission: body.audiencePermission,
    scheduleCron: body.scheduleCron,
    scheduleDescription: body.scheduleCron === null ? null : describeCron(body.scheduleCron),
    nextRunAt: null,
    ownerUserId,
    active,
    recipientUserIds: body.recipientUserIds,
    createdAt,
    updatedAt,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------------------------

export function registerReports(app: MockApp): void {
  mockRoute(app, listReportFamilies, ({ requireTenant }) => {
    const { tenant, permissions } = requireTenant();
    return {
      asOf: REPORTING_AS_OF,
      currency: tenant.defaultCurrency ?? 'BWP',
      families: REPORT_FAMILIES.map((family) => {
        const restricted = familyRestricted(family, permissions);
        return {
          family: family.family,
          title: family.title,
          description: family.description,
          questions: family.questions,
          dimensions: [...family.dimensions],
          fields: family.fields.map((item) => ({
            key: item.key,
            label: item.label,
            kind: item.kind,
            description: item.description,
            sensitivity: item.restrictedTo === null ? ('normal' as const) : ('restricted' as const),
            redactionRule: item.restrictedTo === null ? null : `Redacted for viewers without ${item.restrictedTo.join(' or ')}.`,
          })),
          restricted,
          restrictionReason: restricted ? family.restrictionReason : null,
          lastRunAt: family.lastRunAt,
          savedDefinitions: REPORT_DEFINITIONS.filter((row) => row.tenantId === tenant.id && row.family === family.family && definitionVisible(row, permissions)).length,
        };
      }),
    };
  });

  mockRoute(app, runReport, ({ requireTenant, params, query, fail }) => {
    const { tenant, permissions } = requireTenant();
    const family = reportFamily(params.family);
    if (familyRestricted(family, permissions)) {
      fail(403, 'REPORT_FAMILY_RESTRICTED', family.restrictionReason);
    }
    if (query.from !== undefined && query.to !== undefined && query.from > query.to) {
      fail(422, 'INVALID_DATE_RANGE', 'The start date must be on or before the end date.');
    }
    const currency = tenant.defaultCurrency ?? 'BWP';
    if (query.currency !== undefined && query.currency !== currency) {
      fail(422, 'CURRENCY_BASIS_UNAVAILABLE', `No approved exchange rates are recorded for ${query.currency}; reports use ${currency}.`);
    }
    return buildReport(tenant.id, currency, family, selectionFromQuery(query), permissions, null);
  });

  mockRoute(app, listReportDefinitions, ({ requireTenant, query, fixtures }) => {
    const { tenant, permissions } = requireTenant();
    const rows = REPORT_DEFINITIONS.filter((row) => row.tenantId === tenant.id && definitionVisible(row, permissions))
      .filter((row) => containsText(row.name, query.q))
      .filter((row) => query.family === undefined || query.family.includes(row.family))
      .filter((row) => query.active === undefined || row.active === query.active)
      .filter((row) => query.scheduled === undefined || (row.scheduleCron !== null) === query.scheduled)
      .filter((row) => query.ownerUserId === undefined || row.ownerUserId === query.ownerUserId)
      .filter((row) => query.updatedFrom === undefined || row.updatedAt.slice(0, 10) >= query.updatedFrom)
      .filter((row) => query.updatedTo === undefined || row.updatedAt.slice(0, 10) <= query.updatedTo)
      .map(toRow);
    const keys = {
      name: (row: ReportDefinitionRow) => row.name,
      family: (row: ReportDefinitionRow) => row.family,
      updatedAt: (row: ReportDefinitionRow) => row.updatedAt,
      lastRunAt: (row: ReportDefinitionRow) => row.lastRunAt,
    } as const;
    return fixtures.page(sortRows(rows, query.sort === undefined ? keys.name : keys[query.sort], query.dir));
  });

  mockRoute(app, getReportDefinition, ({ requireTenant, requirePersona, params, now, notFound }) => {
    const { tenant, permissions } = requireTenant();
    const viewer = { userId: requirePersona().userId, permissions };
    const definition = REPORT_DEFINITIONS.find((row) => row.id === params.definitionId && row.tenantId === tenant.id);
    if (definition === undefined || !definitionVisible(definition, permissions)) {
      return notFound('No such report definition.');
    }
    return toDetail(definition, now, viewer);
  });

  mockRoute(app, createReportDefinition, ({ requireTenant, requirePersona, body, now, fail }) => {
    const { tenant, permissions } = requireTenant();
    const persona = requirePersona();
    validateDefinition(body, tenant.defaultCurrency ?? 'BWP', fail);
    if (REPORT_DEFINITIONS.some((row) => row.tenantId === tenant.id && row.name.toLowerCase() === body.name.toLowerCase())) {
      fail(409, 'DUPLICATE_REPORT_NAME', 'A report definition with this name already exists.');
    }
    const unauthorized = body.recipientUserIds
      .map((userId) => recipientAuthorization(userId, tenant.id, body.audiencePermission, now))
      .filter((recipient) => !recipient.authorized);
    if (unauthorized.length > 0) {
      fail(422, 'RECIPIENT_NOT_AUTHORIZED', `Not authorized for ${body.audiencePermission}: ${unauthorized.map((item) => item.user.fullName).join(', ')}.`);
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return toDetail(definitionFromBody(900, tenant.id, persona.userId, body, at, at, true), now, { userId: persona.userId, permissions });
  });

  mockRoute(app, updateReportDefinition, ({ requireTenant, requirePersona, params, body, now, fail, notFound }) => {
    const { tenant, permissions } = requireTenant();
    const viewer = { userId: requirePersona().userId, permissions };
    const existing = REPORT_DEFINITIONS.find((row) => row.id === params.definitionId && row.tenantId === tenant.id);
    if (existing === undefined || !definitionVisible(existing, permissions)) {
      return notFound('No such report definition.');
    }
    if (!existing.active) {
      fail(409, 'DEFINITION_INACTIVE', 'Reactivate the definition before changing it.');
    }
    validateDefinition(body, tenant.defaultCurrency ?? 'BWP', fail);
    if (REPORT_DEFINITIONS.some((row) => row.tenantId === tenant.id && row.id !== existing.id && row.name.toLowerCase() === body.name.toLowerCase())) {
      fail(409, 'DUPLICATE_REPORT_NAME', 'A report definition with this name already exists.');
    }
    const unauthorized = body.recipientUserIds
      .map((userId) => recipientAuthorization(userId, tenant.id, body.audiencePermission, now))
      .filter((recipient) => !recipient.authorized);
    if (unauthorized.length > 0) {
      fail(422, 'RECIPIENT_NOT_AUTHORIZED', `Not authorized for ${body.audiencePermission}: ${unauthorized.map((item) => item.user.fullName).join(', ')}.`);
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return toDetail(definitionFromBody(existing.id, tenant.id, existing.ownerUserId, body, existing.createdAt, at, true), now, viewer);
  });

  mockRoute(app, previewReportDefinition, ({ requireTenant, body, now, fail }) => {
    const { tenant, permissions } = requireTenant();
    const currency = tenant.defaultCurrency ?? 'BWP';
    validateDefinition(body, currency, fail);
    const family = reportFamily(body.family);
    const rows = selectRows(tenant.id, family.family, selectionFromFilters(body.filters));
    const visible = visibleRows(family, rows, permissions, body.fields);
    const redactions = redactionsFor(family, permissions, body.fields);
    const omissions = [
      'Records you are not authorized to read are excluded and not counted (BR-43).',
      'Each recipient receives only the rows they may read when the report is issued (DD-19).',
    ];
    if (family.family === 'participation') {
      omissions.push('Bid contents of sealed events are never included; only receipt metadata is counted.');
    }
    return {
      family: family.family,
      scopeDescription: `${family.title}: ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} for ${tenant.name}${body.filters.from === null ? '' : ` from ${body.filters.from}`}${body.filters.to === null ? '' : ` to ${body.filters.to}`}.`,
      estimatedRowCount: rows.length,
      fields: family.fields.map((item) => {
        const included = body.fields.includes(item.key);
        const redacted = included && item.restrictedTo !== null && !hasAny(permissions, item.restrictedTo);
        return {
          key: item.key,
          label: item.label,
          included,
          redacted,
          reason: item.restrictedTo === null ? null : `Visible only to holders of ${item.restrictedTo.join(' or ')}.`,
        };
      }),
      columns: columnsFor(family, body.fields),
      sampleRows: visible.slice(0, 5),
      redactions,
      omissions,
      recipients: body.recipientUserIds.map((userId) => recipientAuthorization(userId, tenant.id, body.audiencePermission, now)),
      currencyBasis: { ...currencyBasis(currency), conversionDate: body.conversionDate },
      completeness: completenessOf(rows),
      schedule:
        body.scheduleCron === null
          ? null
          : { cron: body.scheduleCron, description: describeCron(body.scheduleCron), timeZone: OFFICIAL_TIME_ZONE, nextRunAt: null },
    };
  });

  mockRoute(app, setReportDefinitionActive, ({ requireTenant, requirePersona, params, body, now, fail, notFound }) => {
    const { tenant, permissions } = requireTenant();
    const viewer = { userId: requirePersona().userId, permissions };
    const existing = REPORT_DEFINITIONS.find((row) => row.id === params.definitionId && row.tenantId === tenant.id);
    if (existing === undefined) {
      return notFound('No such report definition.');
    }
    if (existing.active === body.active) {
      fail(409, 'DEFINITION_ALREADY_IN_STATE', body.active ? 'The definition is already active.' : 'The definition is already inactive.');
    }
    return toDetail({ ...existing, active: body.active, updatedAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z') }, now, viewer);
  });

  mockRoute(app, runReportDefinition, ({ requireTenant, requirePersona, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const persona = requirePersona();
    const definition = REPORT_DEFINITIONS.find((row) => row.id === params.definitionId && row.tenantId === tenant.id);
    if (definition === undefined) {
      return notFound('No such report definition.');
    }
    if (!definition.active) {
      fail(409, 'DEFINITION_INACTIVE', 'Reactivate the definition before running it.');
    }
    if (body.deliverToRecipients && definition.recipientUserIds.length === 0) {
      fail(422, 'SCHEDULE_REQUIRES_RECIPIENTS', 'This definition has no recipients to deliver to.');
    }
    const recipients = body.deliverToRecipients
      ? definition.recipientUserIds.map((userId) => recipientAuthorization(userId, tenant.id, definition.audiencePermission, now))
      : [];
    const rows = selectRows(tenant.id, definition.family, selectionFromFilters(definition.filters));
    const exportId = syntheticExportId('definition', body.format, definition.id);
    return {
      id: 900,
      definitionId: definition.id,
      runBy: personRef(persona.userId),
      runAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      rowCount: rows.length,
      export: { id: exportId, format: body.format, status: body.format === 'xlsx' ? 'queued' : 'ready', fileName: body.format === 'xlsx' ? null : `${fileStem(definition.name)}.${body.format}`, accessible: true },
      recipients: recipients.filter((item) => item.authorized).map((item) => item.user),
      excludedRecipients: recipients.filter((item) => !item.authorized).map((item) => ({ user: item.user, reason: item.reason ?? 'Not authorized.' })),
    };
  });

  mockRoute(app, listRecipientCandidates, ({ requireTenant, query, now, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = PERSONAS.filter((persona) => persona.memberships.some((membership) => membership.tenantId === tenant.id && membership.status === 'active'))
      .filter((persona) => containsText(persona.fullName, query.q))
      .map((persona) => {
        const membership = persona.memberships.find((item) => item.tenantId === tenant.id);
        const check = recipientAuthorization(persona.userId, tenant.id, query.audiencePermission, now);
        return { user: check.user, capacity: membership?.capacity ?? null, authorized: check.authorized, reason: check.reason };
      })
      .sort((a, b) => Number(b.authorized) - Number(a.authorized) || a.user.fullName.localeCompare(b.user.fullName));
    return fixtures.page(rows);
  });

  mockRoute(app, listExports, ({ requireTenant, requirePersona, query, fixtures }) => {
    const { tenant, permissions } = requireTenant();
    const persona = requirePersona();
    const rows = EXPORTS.filter((row) => row.tenantId === tenant.id && exportVisible(row, persona.userId, permissions))
      .filter((row) => containsText(`${row.scopeDescription} ${row.subjectLabel ?? ''} ${row.fileName ?? ''}`, query.q))
      .filter((row) => query.exportType === undefined || query.exportType.includes(row.exportType))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.format === undefined || query.format.includes(row.format))
      .filter((row) => query.requestedBy === undefined || row.requestedBy === query.requestedBy)
      .filter((row) => query.from === undefined || row.requestedAt.slice(0, 10) >= query.from)
      .filter((row) => query.to === undefined || row.requestedAt.slice(0, 10) <= query.to)
      .map(toExportRecord);
    const keys = {
      requestedAt: (row: ExportRecord) => row.requestedAt,
      status: (row: ExportRecord) => row.status,
      exportType: (row: ExportRecord) => row.exportType,
    } as const;
    const sorted = sortRows(rows, keys[query.sort ?? 'requestedAt'], query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, getExport, ({ requireTenant, requirePersona, params, now, notFound }) => {
    const tenant = requireTenant();
    const persona = requirePersona();
    const record = EXPORTS.find((row) => row.id === params.exportId && row.tenantId === tenant.tenant.id);
    if (record !== undefined && exportVisible(record, persona.userId, tenant.permissions)) {
      return toExportRecord(record);
    }
    const synthetic = syntheticExport(params.exportId, tenant, persona.userId, now);
    return synthetic ?? notFound('No such export.');
  });

  mockRoute(app, createReportExport, ({ requireTenant, requirePersona, body, now, fail, notFound }) => {
    const tenant = requireTenant();
    const persona = requirePersona();
    const currency = tenant.tenant.defaultCurrency ?? 'BWP';
    let exportId: number;
    if (body.source.kind === 'family') {
      const family = reportFamily(body.source.family);
      if (familyRestricted(family, tenant.permissions) || !hasAny(tenant.permissions, ['report.view', 'report.manage'])) {
        fail(403, 'REPORT_FAMILY_RESTRICTED', family.restrictionReason);
      }
      if (body.source.currency !== currency) {
        fail(422, 'CURRENCY_BASIS_UNAVAILABLE', `No approved exchange rates are recorded; use ${currency}.`);
      }
      exportId = syntheticExportId('family', body.format, familyIndex(family.family));
    } else {
      const { definitionId } = body.source;
      const definition = REPORT_DEFINITIONS.find((row) => row.id === definitionId && row.tenantId === tenant.tenant.id);
      if (definition === undefined || !definitionVisible(definition, tenant.permissions)) {
        return notFound('No such report definition.');
      }
      if (!definition.active) {
        fail(409, 'DEFINITION_INACTIVE', 'Reactivate the definition before exporting it.');
      }
      exportId = syntheticExportId('definition', body.format, definition.id);
    }
    const record = syntheticExport(exportId, tenant, persona.userId, now);
    return record ?? notFound('No such export.');
  });

  mockRoute(app, downloadExport, ({ requireTenant, requirePersona, params, now, fail, notFound }) => {
    const tenant = requireTenant();
    const persona = requirePersona();
    const fixture = EXPORTS.find((row) => row.id === params.exportId && row.tenantId === tenant.tenant.id);
    const record =
      fixture !== undefined && exportVisible(fixture, persona.userId, tenant.permissions)
        ? toExportRecord(fixture)
        : syntheticExport(params.exportId, tenant, persona.userId, now);
    if (record === null) {
      return notFound('No such export.');
    }
    if (record.status === 'failed') {
      fail(409, 'EXPORT_FAILED', record.error ?? 'The export failed. Request it again.');
    }
    if (record.status !== 'ready' || record.format === 'xlsx') {
      fail(409, 'EXPORT_NOT_READY', 'The export is still being produced. Try again shortly.');
    }
    const content = exportContent(record, tenant);
    const format: ExportsFormat = record.format;
    return {
      exportId: record.id,
      fileName: record.fileName ?? `export-${record.id}.${format}`,
      contentType: CONTENT_TYPES[format],
      sizeBytes: byteLength(content),
      delivery: { kind: 'inline', content },
    };
  });
}
