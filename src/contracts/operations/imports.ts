/**
 * Imports, duplicate review and historical onboarding (ADM-16). Blueprint: `import_batches`, `import_records` [T].
 *
 * Rules the contract carries (Stage B enforces them):
 * - Nothing is created until a reviewer accepts a row; a row with unresolved quality issues (for example missing
 *   evidence) cannot be accepted without a recorded resolution (`QUALITY_ISSUES_UNRESOLVED`).
 * - A row with a duplicate candidate is accepted only with an explicit duplicate resolution (link to the existing
 *   organization or create a new one after review, BR-44, `DUPLICATE_REVIEW_REQUIRED`).
 * - Accepted records keep their original business date and provenance (origin, batch, row); the import never
 *   rewrites them as new activity.
 * - A batch is completed only when every row is decided (`RECORDS_PENDING`); the result is `accepted`,
 *   `partially_accepted` or `rejected`.
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CalendarDate,
  Id,
  IdParam,
  Instant,
  JsonObject,
  PersonRef,
  QueryBoolean,
  ReasonText,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import { IMPORT_BATCHES_RECORD_TYPE, ImportBatchesRecordType, ImportBatchesStatus, ImportRecordsDecision } from '../enums.js';
import { CustomerLabel, DuplicateResolution, ImportCreatedEntityType, NoteText, choice, titleText } from './shared.js';

/** Decision counts of a batch. */
export const ImportCounts = z.object({
  total: z.number().int().min(0),
  pending: z.number().int().min(0),
  accepted: z.number().int().min(0),
  rejected: z.number().int().min(0),
  withQualityIssues: z.number().int().min(0),
  withDuplicateCandidates: z.number().int().min(0),
});
export type ImportCounts = z.infer<typeof ImportCounts>;

/** One import batch (`import_batches`). */
export const ImportBatchRow = z.object({
  id: Id,
  origin: z.string().min(1),
  recordType: ImportBatchesRecordType,
  status: ImportBatchesStatus,
  sourceFileName: z.string().min(1),
  documentId: Id.nullable(),
  uploadedBy: PersonRef,
  uploadedAt: Instant,
  reviewedBy: PersonRef.nullable(),
  completedAt: Instant.nullable(),
  counts: ImportCounts,
});
export type ImportBatchRow = z.infer<typeof ImportBatchRow>;

export const IMPORT_SORT_FIELDS = ['uploadedAt', 'origin', 'recordType', 'status'] as const;
export const ImportBatchListQuery = listQueryWithSort(IMPORT_SORT_FIELDS).extend({
  recordType: queryList(ImportBatchesRecordType).optional(),
  status: queryList(ImportBatchesStatus).optional(),
  uploadedByUserId: IdParam.optional(),
  uploadedFrom: CalendarDate.optional(),
  uploadedTo: CalendarDate.optional(),
});
export type ImportBatchListQuery = z.input<typeof ImportBatchListQuery>;

/** The batch detail: provenance and the review rules shown to the reviewer. */
export const ImportBatchDetail = ImportBatchRow.extend({
  provenanceNote: z.string().min(1),
  reviewNote: z.string().nullable(),
  /** What an accepted row creates, and the rule that original dates are preserved. */
  acceptanceRule: z.string().min(1),
  capabilities: z.object({ canDecide: z.boolean(), canComplete: z.boolean() }),
});
export type ImportBatchDetail = z.infer<typeof ImportBatchDetail>;

/** One proposed record (`import_records`). */
export const ImportRecordRow = z.object({
  id: Id,
  batchId: Id,
  rowNo: z.number().int().min(1),
  /** A display name for the proposed record (legal name, contract title). */
  label: z.string().min(1),
  raw: JsonObject,
  originalBusinessDate: CalendarDate.nullable(),
  qualityIssues: z.array(z.string().min(1)),
  duplicateCandidate: CustomerLabel.nullable(),
  duplicateReason: z.string().nullable(),
  decision: ImportRecordsDecision,
  decidedBy: PersonRef.nullable(),
  decidedAt: Instant.nullable(),
  decisionReason: z.string().nullable(),
  createdEntityType: ImportCreatedEntityType.nullable(),
  createdEntityId: Id.nullable(),
  /** The in-app reference of what was created ("C-2025-0007"). */
  createdEntityLabel: z.string().nullable(),
  provenanceNote: z.string().nullable(),
});
export type ImportRecordRow = z.infer<typeof ImportRecordRow>;

export const ImportRecordListQuery = listQueryWithSort(['rowNo', 'label', 'decision'] as const).extend({
  decision: queryList(ImportRecordsDecision).optional(),
  hasQualityIssues: QueryBoolean.optional(),
  hasDuplicateCandidate: QueryBoolean.optional(),
});
export type ImportRecordListQuery = z.input<typeof ImportRecordListQuery>;

export const ImportBatchParams = z.object({ batchId: IdParam });
export const ImportRecordParams = z.object({ batchId: IdParam, recordId: IdParam });

export const CreateImportBatchBody = z.object({
  origin: titleText('ORIGIN_REQUIRED', 200),
  recordType: choice(IMPORT_BATCHES_RECORD_TYPE, 'INVALID_RECORD_TYPE', 'Choose suppliers, contracts or tender history.'),
  /** The confirmed upload (documents contract) holding the source file. */
  documentId: Id,
  sourceFileName: z
    .string({ error: issue('FILE_REQUIRED', 'Upload the source file.') })
    .trim()
    .min(1, issue('FILE_REQUIRED', 'Upload the source file.'))
    .max(255, issue('TEXT_TOO_LONG', 'At most 255 characters.')),
  provenanceNote: z
    .string({ error: issue('PROVENANCE_REQUIRED', 'Describe where the data comes from.') })
    .trim()
    .min(10, issue('PROVENANCE_REQUIRED', 'Describe where the data comes from.'))
    .max(2000, issue('TEXT_TOO_LONG', 'At most 2000 characters.')),
});
export type CreateImportBatchBody = z.infer<typeof CreateImportBatchBody>;

export const DecideImportRecordBody = z.object({
  decision: z.enum(['accepted', 'rejected'], { error: issue('INVALID_DECISION', 'Accept or reject the row.') }),
  reason: ReasonText,
  /** Required to accept a row with a duplicate candidate. */
  duplicateResolution: DuplicateResolution.optional(),
  /** Required to accept a row with quality issues: how each issue was resolved. */
  issuesResolution: NoteText.optional(),
  provenanceNote: NoteText.optional(),
});
export type DecideImportRecordBody = z.infer<typeof DecideImportRecordBody>;

export const CompleteImportBatchBody = z.object({
  note: NoteText.optional(),
});
export type CompleteImportBatchBody = z.infer<typeof CompleteImportBatchBody>;

export const listImportBatches = defineEndpoint({
  id: 'buyer.operations.imports.list',
  method: 'GET',
  path: '/api/v1/buyer/imports',
  audience: 'buyer',
  permission: 'org.imports.manage',
  query: ImportBatchListQuery,
  response: pageOf(ImportBatchRow),
  errors: [],
  screens: ['ADM-16'],
});

export const getImportBatch = defineEndpoint({
  id: 'buyer.operations.imports.get',
  method: 'GET',
  path: '/api/v1/buyer/imports/:batchId',
  audience: 'buyer',
  permission: 'org.imports.manage',
  params: ImportBatchParams,
  response: ImportBatchDetail,
  errors: [],
  screens: ['ADM-16'],
});

export const listImportRecords = defineEndpoint({
  id: 'buyer.operations.imports.records',
  method: 'GET',
  path: '/api/v1/buyer/imports/:batchId/records',
  audience: 'buyer',
  permission: 'org.imports.manage',
  params: ImportBatchParams,
  query: ImportRecordListQuery,
  response: pageOf(ImportRecordRow),
  errors: [],
  screens: ['ADM-16'],
});

export const createImportBatch = defineEndpoint({
  id: 'buyer.operations.imports.create',
  method: 'POST',
  path: '/api/v1/buyer/imports',
  audience: 'buyer',
  permission: 'org.imports.manage',
  body: CreateImportBatchBody,
  response: ImportBatchDetail,
  idempotent: true,
  errors: ['UNSUPPORTED_FILE_TYPE'],
  screens: ['ADM-16'],
});

export const decideImportRecord = defineEndpoint({
  id: 'buyer.operations.imports.decideRecord',
  method: 'POST',
  path: '/api/v1/buyer/imports/:batchId/records/:recordId/decide',
  audience: 'buyer',
  permission: 'org.imports.manage',
  params: ImportRecordParams,
  body: DecideImportRecordBody,
  response: ImportRecordRow,
  errors: ['BATCH_CLOSED', 'RECORD_ALREADY_DECIDED', 'QUALITY_ISSUES_UNRESOLVED', 'DUPLICATE_REVIEW_REQUIRED'],
  screens: ['ADM-16'],
});

export const completeImportBatch = defineEndpoint({
  id: 'buyer.operations.imports.complete',
  method: 'POST',
  path: '/api/v1/buyer/imports/:batchId/complete',
  audience: 'buyer',
  permission: 'org.imports.manage',
  params: ImportBatchParams,
  body: CompleteImportBatchBody,
  response: ImportBatchDetail,
  errors: ['BATCH_CLOSED', 'RECORDS_PENDING'],
  screens: ['ADM-16'],
});

export const importRoutes = {
  listImportBatches,
  getImportBatch,
  listImportRecords,
  createImportBatch,
  decideImportRecord,
  completeImportBatch,
} as const;
