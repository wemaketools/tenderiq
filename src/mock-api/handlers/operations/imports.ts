/**
 * Buyer handlers: imports, duplicate review and historical onboarding (ADM-16). Batches belong to the active buyer
 * tenant; accepted rows keep their original business date and provenance.
 */
import type { ImportBatchesStatus } from '../../../contracts/enums.js';
import { operationsEndpoints as api } from '../../../contracts/operations.js';
import type { ImportBatchDetail, ImportBatchRow, ImportCounts, ImportRecordRow } from '../../../contracts/operations.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { IMPORT_BATCHES, IMPORT_RECORDS } from '../../fixtures/operations/index.js';
import type { FixtureImportBatch, FixtureImportRecord } from '../../fixtures/operations/index.js';
import { personRef } from '../../persona.js';
import { customerLabel, isoNow, matchesText, personOrNull, sortRows, withinDates } from './views.js';

const CLOSED_BATCH_STATUSES: readonly ImportBatchesStatus[] = ['accepted', 'partially_accepted', 'rejected'];

const ACCEPTANCE_RULES: Readonly<Record<FixtureImportBatch['recordType'], string>> = {
  supplier:
    'An accepted supplier row creates a provisional supplier organization, or links to an existing organization after duplicate review. Qualification is never implied by an import.',
  contract: 'An accepted contract row creates a contract record with its original dates and the origin of the import; it is marked as imported.',
  tender_history:
    'An accepted history row creates a historical event record for reporting with its original dates; it is never reopened as a live competition.',
};

function countsOf(records: readonly Pick<ImportRecordRow, 'decision' | 'qualityIssues' | 'duplicateCandidate'>[]): ImportCounts {
  return {
    total: records.length,
    pending: records.filter((row) => row.decision === 'pending').length,
    accepted: records.filter((row) => row.decision === 'accepted').length,
    rejected: records.filter((row) => row.decision === 'rejected').length,
    withQualityIssues: records.filter((row) => row.qualityIssues.length > 0).length,
    withDuplicateCandidates: records.filter((row) => row.duplicateCandidate !== null).length,
  };
}

function recordRow(row: FixtureImportRecord): ImportRecordRow {
  return {
    id: row.id,
    batchId: row.batchId,
    rowNo: row.rowNo,
    label: row.label,
    raw: { ...row.raw },
    originalBusinessDate: row.originalBusinessDate,
    qualityIssues: [...row.qualityIssues],
    duplicateCandidate: row.duplicateCandidateTenantId === null ? null : customerLabel(row.duplicateCandidateTenantId),
    duplicateReason: row.duplicateReason,
    decision: row.decision,
    decidedBy: personOrNull(row.decidedByUserId),
    decidedAt: row.decidedAt,
    decisionReason: row.decisionReason,
    createdEntityType: row.createdEntityType,
    createdEntityId: row.createdEntityId,
    createdEntityLabel: row.createdEntityLabel,
    provenanceNote: row.provenanceNote,
  };
}

function recordsOf(batchId: number): ImportRecordRow[] {
  return IMPORT_RECORDS.filter((row) => row.batchId === batchId).map(recordRow);
}

function batchRow(batch: FixtureImportBatch, records: readonly ImportRecordRow[] = recordsOf(batch.id)): ImportBatchRow {
  return {
    id: batch.id,
    origin: batch.origin,
    recordType: batch.recordType,
    status: batch.status,
    sourceFileName: batch.sourceFileName,
    documentId: batch.documentId,
    uploadedBy: personRef(batch.uploadedByUserId),
    uploadedAt: batch.uploadedAt,
    reviewedBy: personOrNull(batch.reviewedByUserId),
    completedAt: batch.completedAt,
    counts: countsOf(records),
  };
}

function batchDetail(batch: FixtureImportBatch, records: readonly ImportRecordRow[] = recordsOf(batch.id)): ImportBatchDetail {
  const open = !CLOSED_BATCH_STATUSES.includes(batch.status);
  return {
    ...batchRow(batch, records),
    provenanceNote: batch.provenanceNote,
    reviewNote: batch.reviewNote,
    acceptanceRule: `${ACCEPTANCE_RULES[batch.recordType]} Original business dates and provenance are preserved.`,
    capabilities: {
      canDecide: open && records.some((row) => row.decision === 'pending'),
      canComplete: open && records.every((row) => row.decision !== 'pending'),
    },
  };
}

export function registerImports(app: MockApp): void {
  function tenantBatch(tenantId: number, batchId: number): FixtureImportBatch | undefined {
    return IMPORT_BATCHES.find((batch) => batch.id === batchId && batch.tenantId === tenantId);
  }

  mockRoute(app, api.listImportBatches, ({ query, requireTenant, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = IMPORT_BATCHES.filter((batch) => batch.tenantId === tenant.id)
      .map((batch) => batchRow(batch))
      .filter((row) => query.recordType === undefined || query.recordType.includes(row.recordType))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.uploadedByUserId === undefined || row.uploadedBy.userId === query.uploadedByUserId)
      .filter((row) => withinDates(row.uploadedAt, query.uploadedFrom, query.uploadedTo))
      .filter((row) => matchesText(query.q, row.origin, row.sourceFileName));
    const sort = query.sort ?? 'uploadedAt';
    const sorted = sortRows(rows, (row) => row[sort], query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.getImportBatch, ({ params, requireTenant, notFound }) => {
    const batch = tenantBatch(requireTenant().tenant.id, params.batchId);
    if (batch === undefined) return notFound();
    return batchDetail(batch);
  });

  mockRoute(app, api.listImportRecords, ({ params, query, requireTenant, fixtures, notFound }) => {
    const batch = tenantBatch(requireTenant().tenant.id, params.batchId);
    if (batch === undefined) return notFound();
    const rows = recordsOf(batch.id)
      .filter((row) => query.decision === undefined || query.decision.includes(row.decision))
      .filter((row) => query.hasQualityIssues === undefined || (row.qualityIssues.length > 0) === query.hasQualityIssues)
      .filter((row) => query.hasDuplicateCandidate === undefined || (row.duplicateCandidate !== null) === query.hasDuplicateCandidate)
      .filter((row) => matchesText(query.q, row.label, ...row.qualityIssues));
    const sort = query.sort ?? 'rowNo';
    const sorted = sortRows(rows, (row) => row[sort], query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.createImportBatch, ({ body, requireTenant, requirePersona, now, fail }) => {
    if (!/\.(csv|xlsx)$/i.test(body.sourceFileName)) {
      fail(422, 'UNSUPPORTED_FILE_TYPE', 'Upload a CSV or XLSX file.');
    }
    return batchDetail(
      {
        id: 900,
        tenantId: requireTenant().tenant.id,
        origin: body.origin,
        recordType: body.recordType,
        status: 'uploaded',
        sourceFileName: body.sourceFileName,
        documentId: body.documentId,
        uploadedByUserId: requirePersona().userId,
        uploadedAt: isoNow(now),
        reviewedByUserId: null,
        completedAt: null,
        provenanceNote: body.provenanceNote,
        reviewNote: null,
      },
      [],
    );
  });

  mockRoute(app, api.decideImportRecord, ({ params, body, requireTenant, requirePersona, now, notFound, fail }) => {
    const batch = tenantBatch(requireTenant().tenant.id, params.batchId);
    if (batch === undefined) return notFound();
    const record = IMPORT_RECORDS.find((row) => row.id === params.recordId && row.batchId === batch.id);
    if (record === undefined) return notFound();
    if (CLOSED_BATCH_STATUSES.includes(batch.status)) fail(409, 'BATCH_CLOSED', 'This batch is completed.');
    if (record.decision !== 'pending') fail(409, 'RECORD_ALREADY_DECIDED', 'This row is already decided.');
    if (body.decision === 'accepted') {
      if (record.qualityIssues.length > 0 && (body.issuesResolution === undefined || body.issuesResolution.trim().length === 0)) {
        fail(422, 'QUALITY_ISSUES_UNRESOLVED', `Record how each issue was resolved: ${record.qualityIssues.join('; ')}.`);
      }
      if (record.duplicateCandidateTenantId !== null && body.duplicateResolution === undefined) {
        fail(
          409,
          'DUPLICATE_REVIEW_REQUIRED',
          `This row may duplicate ${customerLabel(record.duplicateCandidateTenantId).name}. Link it to the existing organization or confirm a new record.`,
        );
      }
    }
    const linkExisting = body.duplicateResolution === 'link_existing' && record.duplicateCandidateTenantId !== null;
    const accepted = body.decision === 'accepted';
    const createdEntityType = !accepted
      ? null
      : batch.recordType === 'supplier'
        ? 'supplier_tenant'
        : batch.recordType === 'contract'
          ? 'contract'
          : 'historical_tender';
    const createdEntityId = !accepted ? null : linkExisting ? record.duplicateCandidateTenantId : 900;
    const provenance =
      body.provenanceNote ??
      `Imported from "${batch.origin}", row ${record.rowNo}; original business date ${record.originalBusinessDate ?? 'not recorded'}.`;
    return recordRow({
      ...record,
      decision: body.decision,
      decidedByUserId: requirePersona().userId,
      decidedAt: isoNow(now),
      decisionReason: body.issuesResolution === undefined ? body.reason : `${body.reason} Issues resolved: ${body.issuesResolution}`,
      createdEntityType,
      createdEntityId,
      createdEntityLabel: !accepted ? null : linkExisting ? `Linked to ${customerLabel(record.duplicateCandidateTenantId ?? 0).name}` : record.label,
      provenanceNote: accepted ? provenance : null,
    });
  });

  mockRoute(app, api.completeImportBatch, ({ params, body, requireTenant, requirePersona, now, notFound, fail }) => {
    const batch = tenantBatch(requireTenant().tenant.id, params.batchId);
    if (batch === undefined) return notFound();
    if (CLOSED_BATCH_STATUSES.includes(batch.status)) fail(409, 'BATCH_CLOSED', 'This batch is completed.');
    const records = recordsOf(batch.id);
    const pending = records.filter((row) => row.decision === 'pending').length;
    if (pending > 0) fail(409, 'RECORDS_PENDING', `${pending} row(s) still need a decision.`);
    const accepted = records.filter((row) => row.decision === 'accepted').length;
    const status: ImportBatchesStatus = accepted === 0 ? 'rejected' : accepted === records.length ? 'accepted' : 'partially_accepted';
    return batchDetail(
      { ...batch, status, reviewedByUserId: requirePersona().userId, completedAt: isoNow(now), reviewNote: body.note ?? batch.reviewNote },
      records,
    );
  });
}
