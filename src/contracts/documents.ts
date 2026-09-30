/**
 * Documents contract: metadata, versions, the two-step upload envelope, download URLs and redacted copies
 * (COM-07; PRD §14.1; brief §5.9; DD-12, DD-21; docs/technical/07-api.md §3.5).
 *
 * - `/api/v1/me/documents/:documentId` reads one document the caller may see in any of their organizations
 *   (DD-21). Access is inherited from the related record through the Stage B `documents/access-registry.ts`;
 *   an unregistered related type is denied.
 * - Uploads use the two-step envelope: create a `pending` version and receive a signed upload URL, PUT the bytes
 *   directly to storage, then confirm with the SHA-256 and size. Never-confirmed uploads are reaped by the
 *   `upload-reaper` job. The browser never uses the Supabase Storage client.
 * - Storage keys are `<owning-record tenant_id>/<related_type>/<related_id>/<document_id>/<version_no>-<name>`;
 *   the buyer tenant owns procurement records even for supplier uploads, and `ownerTenant` records who uploaded
 *   (DD-12).
 * - Released originals stay distinguishable from redacted copies (PRD §14.1, COM-07).
 * - Stage A returns contract-valid static responses: the mock upload URL is not a real storage location.
 */
import { z } from 'zod';

import {
  CalendarDate,
  Id,
  IdParam,
  Instant,
  LinkPath,
  OrganizationLabel,
  PersonRef,
  QueryBoolean,
  ReasonText,
  issue,
  pageOf,
  listQueryWithSort,
  queryList,
} from './common.js';
import { defineEndpoint } from './endpoint.js';
import type { EndpointPermission } from './endpoint.js';
import {
  DocumentVersionsUploadStatus,
  DocumentsClassification,
  DocumentsRelatedType,
  DocumentsStatus,
  EvidenceItemsVerificationStatus,
} from './enums.js';

/** Largest file accepted by an upload envelope (bytes). Buckets may set lower limits. */
export const MAX_UPLOAD_BYTES = 52_428_800;

/** Content types accepted for uploads. */
export const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
  'image/png',
  'image/jpeg',
  'application/zip',
] as const;
export const AllowedContentType = z.enum(ALLOWED_CONTENT_TYPES, {
  error: issue('CONTENT_TYPE_NOT_ALLOWED', 'This file type is not accepted.'),
});
export type AllowedContentType = z.infer<typeof AllowedContentType>;

/**
 * Audience breadth of each classification (wider audiences score higher). A redacted copy must be strictly wider
 * than its original (CLASSIFICATION_NOT_WIDER).
 */
export const DOCUMENT_CLASSIFICATION_BREADTH = {
  sealed: 0,
  restricted_assessment: 1,
  commercially_confidential: 1,
  supplier_private: 1,
  buyer_internal: 2,
  participating_suppliers: 3,
  public: 4,
} as const satisfies Record<z.infer<typeof DocumentsClassification>, number>;

/** A SHA-256 digest in lowercase hex. */
export const Sha256 = z.string().regex(/^[a-f0-9]{64}$/, issue('INVALID_HASH', 'Must be a SHA-256 hex digest.'));

/** A file name without path separators. */
export const FileName = z
  .string()
  .trim()
  .min(1, issue('FILE_NAME_REQUIRED', 'A file name is required.'))
  .max(255, issue('FILE_NAME_TOO_LONG', 'At most 255 characters.'))
  .refine((name) => !/[\\/]/.test(name) && name !== '.' && name !== '..', issue('INVALID_FILE_NAME', 'No path separators.'));

/** One edition of a document (`document_versions`). */
export const DocumentVersion = z.object({
  id: Id,
  documentId: Id,
  versionNo: z.number().int().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  sha256: Sha256,
  uploadStatus: DocumentVersionsUploadStatus,
  changeNote: z.string().nullable(),
  supersedesVersionId: Id.nullable(),
  createdAt: Instant,
  createdBy: PersonRef.nullable(),
  confirmedAt: Instant.nullable(),
});
export type DocumentVersion = z.infer<typeof DocumentVersion>;

/** A related document reference (redaction links). */
export const DocumentRef = z.object({
  documentId: Id,
  title: z.string().min(1),
  classification: DocumentsClassification,
  status: DocumentsStatus,
});
export type DocumentRef = z.infer<typeof DocumentRef>;

/** Evidence facts shown when the document substantiates an evidence item (PRD §14.1 "issuer, period, expiry"). */
export const DocumentEvidenceFacts = z.object({
  evidenceItemId: Id,
  issuer: z.string().nullable(),
  periodStart: CalendarDate.nullable(),
  periodEnd: CalendarDate.nullable(),
  validFrom: CalendarDate.nullable(),
  expiresAt: CalendarDate.nullable(),
  verificationStatus: EvidenceItemsVerificationStatus,
});
export type DocumentEvidenceFacts = z.infer<typeof DocumentEvidenceFacts>;

/** Why the caller may view the metadata but not download the file (COM-07 "download if permitted"). */
export const DOWNLOAD_BLOCK_REASONS = [
  /** Sealed submission content is never downloadable before the authorized opening (BR-17). */
  'sealed',
  /** The classification restricts the file to specific assigned users. */
  'classification_restricted',
  /** No confirmed version exists yet. */
  'no_confirmed_version',
  /** The document was withdrawn; only its history remains. */
  'withdrawn',
] as const;
export const DownloadBlockReason = z.enum(DOWNLOAD_BLOCK_REASONS);
export type DownloadBlockReason = z.infer<typeof DownloadBlockReason>;

/** What the caller may do with the document. */
export const DocumentCapabilities = z.object({
  canDownload: z.boolean(),
  canUploadVersion: z.boolean(),
  canCreateRedactedCopy: z.boolean(),
  /** Set when `canDownload` is false. */
  downloadBlockedReason: DownloadBlockReason.nullable().optional(),
});
export type DocumentCapabilities = z.infer<typeof DocumentCapabilities>;

/** A document row in a list (`documents` + current version). */
export const DocumentSummary = z.object({
  id: Id,
  title: z.string().min(1),
  purpose: z.string().nullable(),
  classification: DocumentsClassification,
  language: z.string().min(2),
  status: DocumentsStatus,
  relatedType: DocumentsRelatedType,
  relatedId: Id,
  precedence: z.number().int().nullable(),
  isRedactedCopy: z.boolean(),
  currentVersion: DocumentVersion.nullable(),
  updatedAt: Instant,
});
export type DocumentSummary = z.infer<typeof DocumentSummary>;

/** Everything COM-07 shows. */
export const DocumentDetail = DocumentSummary.extend({
  organization: OrganizationLabel,
  /** The tenant that uploaded the file (a supplier for supplier evidence mirrored into a procurement, DD-12). */
  ownerTenant: OrganizationLabel,
  owner: PersonRef.nullable(),
  relatedReference: z.string().nullable(),
  relatedLinkPath: LinkPath.nullable(),
  redactedFrom: DocumentRef.nullable(),
  redactedCopies: z.array(DocumentRef),
  evidence: DocumentEvidenceFacts.nullable(),
  versionCount: z.number().int().min(0),
  createdAt: Instant,
  capabilities: DocumentCapabilities,
});
export type DocumentDetail = z.infer<typeof DocumentDetail>;

export const DocumentParams = z.object({ documentId: IdParam });

/** A row of the caller's document list (`/me/documents`), labelled with its organization (DD-21). */
export const MyDocumentItem = DocumentSummary.extend({
  organization: OrganizationLabel,
  relatedReference: z.string().nullable(),
  canDownload: z.boolean(),
});
export type MyDocumentItem = z.infer<typeof MyDocumentItem>;

export const MY_DOCUMENT_SORT_FIELDS = ['title', 'updatedAt', 'classification', 'status'] as const;

export const MyDocumentListQuery = listQueryWithSort(MY_DOCUMENT_SORT_FIELDS).extend({
  classification: queryList(DocumentsClassification).optional(),
  status: queryList(DocumentsStatus).optional(),
  relatedType: queryList(DocumentsRelatedType).optional(),
  tenantId: IdParam.optional(),
  redactedCopy: QueryBoolean.optional(),
  updatedFrom: CalendarDate.optional(),
  updatedTo: CalendarDate.optional(),
});
export type MyDocumentListQuery = z.input<typeof MyDocumentListQuery>;

export const MyDocumentPage = pageOf(MyDocumentItem);
export type MyDocumentPage = z.infer<typeof MyDocumentPage>;

/** GET /api/v1/me/documents: documents the caller may read in any of their organizations (COM-07 index). */
export const listMyDocuments = defineEndpoint({
  id: 'me.documents.list',
  method: 'GET',
  path: '/api/v1/me/documents',
  audience: 'me',
  query: MyDocumentListQuery,
  response: MyDocumentPage,
  errors: [],
  screens: ['COM-07'],
  summary:
    'Documents of the records the caller may read, across every active membership. Sealed content appears as metadata only; totals count only visible rows (BR-43).',
});
export const DocumentVersionParams = z.object({ documentId: IdParam, versionId: IdParam });

/** GET /api/v1/me/documents/:documentId (COM-07). */
export const getMyDocument = defineEndpoint({
  id: 'me.documents.get',
  method: 'GET',
  path: '/api/v1/me/documents/:documentId',
  audience: 'me',
  params: DocumentParams,
  response: DocumentDetail,
  errors: ['DOCUMENT_NOT_FOUND'],
  screens: ['COM-07'],
  summary: 'A document the caller may read in any of their organizations; access follows the related record.',
});

export const DocumentVersionList = z.object({
  items: z.array(DocumentVersion),
});
export type DocumentVersionList = z.infer<typeof DocumentVersionList>;

/** GET /api/v1/me/documents/:documentId/versions: the change history, newest first (COM-07). */
export const listMyDocumentVersions = defineEndpoint({
  id: 'me.documents.versions',
  method: 'GET',
  path: '/api/v1/me/documents/:documentId/versions',
  audience: 'me',
  params: DocumentParams,
  response: DocumentVersionList,
  errors: ['DOCUMENT_NOT_FOUND'],
  screens: ['COM-07'],
});

/** A short-lived signed download URL (issued only after the domain authorizes the caller). */
export const DownloadLink = z.object({
  url: z.string().min(1),
  expiresAt: Instant,
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  sha256: Sha256,
});
export type DownloadLink = z.infer<typeof DownloadLink>;

/** GET /api/v1/me/documents/:documentId/versions/:versionId/download: a signed URL for one confirmed version. */
export const getDocumentDownloadLink = defineEndpoint({
  id: 'me.documents.download',
  method: 'GET',
  path: '/api/v1/me/documents/:documentId/versions/:versionId/download',
  audience: 'me',
  params: DocumentVersionParams,
  response: DownloadLink,
  errors: ['DOCUMENT_NOT_FOUND', 'VERSION_NOT_FOUND', 'VERSION_NOT_CONFIRMED', 'DOWNLOAD_NOT_PERMITTED'],
  screens: ['COM-07'],
  summary: 'Issues a signed download URL; the access is recorded (document_access_log for tender documents).',
});

// ---------------------------------------------------------------------------------------------------------
// Area routes: lists per related record, upload envelopes, redacted copies
// ---------------------------------------------------------------------------------------------------------

/** Buyer permissions that let a user read or add documents on some related record type. */
const BUYER_DOCUMENT_PERMISSIONS: EndpointPermission = [
  'request.create',
  'request.view_all',
  'strategy.manage',
  'tender.view',
  'tender.edit',
  'tender.clarifications.manage',
  'supplier.directory.view',
  'qualification.review',
  'qualification.financial_review',
  'evaluation.score',
  'evaluation.chair',
  'selection.manage',
  'award.recommend',
  'notice.issue',
  'complaint.manage',
  'contract.view',
  'contract.manage',
  'org.templates.manage',
  'org.policy.manage',
  'org.imports.manage',
  'export.create',
  'audit.view',
];

/** Supplier permissions that let a user read or add documents on some related record type. */
const SUPPLIER_DOCUMENT_PERMISSIONS: EndpointPermission = [
  'supplier.opportunities.view',
  'supplier.response.edit',
  'supplier.pricing.edit',
  'supplier.evidence.manage',
  'supplier.org.manage',
  'supplier.qualification.apply',
  'supplier.complaint.submit',
  'supplier.contract.participate',
];

/** Buyer permissions that may add documents (uploads and new versions). */
const BUYER_UPLOAD_PERMISSIONS: EndpointPermission = [
  'request.create',
  'strategy.manage',
  'tender.edit',
  'tender.clarifications.manage',
  'tender.sessions.manage',
  'qualification.review',
  'evaluation.chair',
  'selection.manage',
  'diligence.manage',
  'award.recommend',
  'notice.issue',
  'complaint.manage',
  'contract.prepare',
  'contract.manage',
  'org.templates.manage',
  'org.policy.manage',
  'org.imports.manage',
];

/** Supplier permissions that may add documents. */
const SUPPLIER_UPLOAD_PERMISSIONS: EndpointPermission = [
  'supplier.response.edit',
  'supplier.pricing.edit',
  'supplier.evidence.manage',
  'supplier.org.manage',
  'supplier.qualification.apply',
  'supplier.complaint.submit',
  'supplier.contract.participate',
];

export const DOCUMENT_SORT_FIELDS = ['title', 'updatedAt', 'precedence', 'status'] as const;

export const RelatedDocumentsQuery = listQueryWithSort(DOCUMENT_SORT_FIELDS).extend({
  relatedType: DocumentsRelatedType,
  relatedId: IdParam,
  classification: queryList(DocumentsClassification).optional(),
  status: queryList(DocumentsStatus).optional(),
});
export type RelatedDocumentsQuery = z.input<typeof RelatedDocumentsQuery>;

export const DocumentPage = pageOf(DocumentSummary);
export type DocumentPage = z.infer<typeof DocumentPage>;

const DOCUMENT_WIDGET_SCREENS = [
  'COM-07',
  'BUY-03',
  'BUY-06',
  'BUY-09',
  'BUY-17',
  'BUY-34',
  'BUY-29',
  'CON-01',
  'CON-03',
  'CON-05',
  'ADM-08',
] as const;

const SUPPLIER_DOCUMENT_SCREENS = ['COM-07', 'SUP-05', 'SUP-08', 'SUP-12', 'SUP-20', 'SUP-22', 'SUP-23'] as const;

/** GET /api/v1/buyer/documents: documents of one related record in the active buyer tenant. */
export const listBuyerDocuments = defineEndpoint({
  id: 'buyer.documents.list',
  method: 'GET',
  path: '/api/v1/buyer/documents',
  audience: 'buyer',
  permission: BUYER_DOCUMENT_PERMISSIONS,
  query: RelatedDocumentsQuery,
  response: DocumentPage,
  errors: ['RELATED_RECORD_NOT_FOUND', 'RELATED_TYPE_NOT_SUPPORTED'],
  screens: [...DOCUMENT_WIDGET_SCREENS],
  summary: 'The document panel of a record. Sealed and restricted documents appear only where the caller may read them.',
});

/** GET /api/v1/supplier/documents: documents of one related record visible to the active supplier tenant. */
export const listSupplierDocuments = defineEndpoint({
  id: 'supplier.documents.list',
  method: 'GET',
  path: '/api/v1/supplier/documents',
  audience: 'supplier',
  permission: SUPPLIER_DOCUMENT_PERMISSIONS,
  query: RelatedDocumentsQuery,
  response: DocumentPage,
  errors: ['RELATED_RECORD_NOT_FOUND', 'RELATED_TYPE_NOT_SUPPORTED'],
  screens: [...SUPPLIER_DOCUMENT_SCREENS],
});

export const CreateUploadBody = z.object({
  /** Existing document for a new version; omitted to create a new document. */
  documentId: Id.optional(),
  relatedType: DocumentsRelatedType,
  relatedId: Id,
  title: z.string().trim().min(1, issue('TITLE_REQUIRED', 'A title is required.')).max(300),
  purpose: z.string().trim().max(1000).optional(),
  classification: DocumentsClassification,
  language: z.string().min(2).max(10).default('en'),
  fileName: FileName,
  contentType: AllowedContentType,
  sizeBytes: z
    .number()
    .int()
    .min(1, issue('EMPTY_FILE', 'The file is empty.'))
    .max(MAX_UPLOAD_BYTES, issue('FILE_TOO_LARGE', 'The file is larger than 50 MB.')),
  sha256: Sha256,
  changeNote: z.string().trim().max(1000).optional(),
});
export type CreateUploadBody = z.input<typeof CreateUploadBody>;

/** The signed upload target: the client PUTs the bytes to `url` with `headers`, then confirms. */
export const UploadTarget = z.object({
  url: z.string().min(1),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  expiresAt: Instant,
});
export type UploadTarget = z.infer<typeof UploadTarget>;

export const UploadEnvelope = z.object({
  document: DocumentSummary,
  version: DocumentVersion,
  upload: UploadTarget,
});
export type UploadEnvelope = z.infer<typeof UploadEnvelope>;

const UPLOAD_ERRORS = [
  'RELATED_RECORD_NOT_FOUND',
  'RELATED_TYPE_NOT_SUPPORTED',
  'DOCUMENT_NOT_FOUND',
  'DOCUMENT_NOT_EDITABLE',
  'CLASSIFICATION_NOT_PERMITTED',
  'FILE_TOO_LARGE',
  'CONTENT_TYPE_NOT_ALLOWED',
  'HOLD_BLOCKS_ACTION',
] as const;

/** POST /api/v1/buyer/documents/uploads: creates a pending version and returns a signed upload URL. */
export const createBuyerUpload = defineEndpoint({
  id: 'buyer.documents.createUpload',
  method: 'POST',
  path: '/api/v1/buyer/documents/uploads',
  audience: 'buyer',
  permission: BUYER_UPLOAD_PERMISSIONS,
  body: CreateUploadBody,
  response: UploadEnvelope,
  idempotent: true,
  errors: [...UPLOAD_ERRORS],
  screens: [...DOCUMENT_WIDGET_SCREENS],
});

/** POST /api/v1/supplier/documents/uploads: the supplier-side upload envelope. */
export const createSupplierUpload = defineEndpoint({
  id: 'supplier.documents.createUpload',
  method: 'POST',
  path: '/api/v1/supplier/documents/uploads',
  audience: 'supplier',
  permission: SUPPLIER_UPLOAD_PERMISSIONS,
  body: CreateUploadBody,
  response: UploadEnvelope,
  idempotent: true,
  errors: [...UPLOAD_ERRORS, 'SUBMISSION_ALREADY_RECEIVED'],
  screens: [...SUPPLIER_DOCUMENT_SCREENS],
});

export const ConfirmUploadParams = z.object({ versionId: IdParam });

export const ConfirmUploadBody = z.object({
  sha256: Sha256,
  sizeBytes: z.number().int().min(1),
});
export type ConfirmUploadBody = z.infer<typeof ConfirmUploadBody>;

export const ConfirmedUpload = z.object({
  document: DocumentSummary,
  version: DocumentVersion,
});
export type ConfirmedUpload = z.infer<typeof ConfirmedUpload>;

const CONFIRM_ERRORS = [
  'UPLOAD_NOT_FOUND',
  'UPLOAD_ALREADY_CONFIRMED',
  'UPLOAD_EXPIRED',
  'UPLOAD_NOT_RECEIVED',
  'UPLOAD_HASH_MISMATCH',
  'UPLOAD_SIZE_MISMATCH',
] as const;

/** POST /api/v1/buyer/documents/uploads/:versionId/confirm: verifies hash and size, marks the version confirmed. */
export const confirmBuyerUpload = defineEndpoint({
  id: 'buyer.documents.confirmUpload',
  method: 'POST',
  path: '/api/v1/buyer/documents/uploads/:versionId/confirm',
  audience: 'buyer',
  permission: BUYER_UPLOAD_PERMISSIONS,
  params: ConfirmUploadParams,
  body: ConfirmUploadBody,
  response: ConfirmedUpload,
  errors: [...CONFIRM_ERRORS],
  screens: [...DOCUMENT_WIDGET_SCREENS],
});

/** POST /api/v1/supplier/documents/uploads/:versionId/confirm. */
export const confirmSupplierUpload = defineEndpoint({
  id: 'supplier.documents.confirmUpload',
  method: 'POST',
  path: '/api/v1/supplier/documents/uploads/:versionId/confirm',
  audience: 'supplier',
  permission: SUPPLIER_UPLOAD_PERMISSIONS,
  params: ConfirmUploadParams,
  body: ConfirmUploadBody,
  response: ConfirmedUpload,
  errors: [...CONFIRM_ERRORS],
  screens: [...SUPPLIER_DOCUMENT_SCREENS],
});

export const CreateRedactedCopyBody = z.object({
  title: z.string().trim().min(1, issue('TITLE_REQUIRED', 'A title is required.')).max(300),
  /** The audience of the copy; it must be wider than the original's (for example `public`). */
  classification: DocumentsClassification,
  reason: ReasonText,
  fileName: FileName,
  contentType: AllowedContentType,
  sizeBytes: z
    .number()
    .int()
    .min(1, issue('EMPTY_FILE', 'The file is empty.'))
    .max(MAX_UPLOAD_BYTES, issue('FILE_TOO_LARGE', 'The file is larger than 50 MB.')),
  sha256: Sha256,
});
export type CreateRedactedCopyBody = z.infer<typeof CreateRedactedCopyBody>;

/**
 * POST /api/v1/buyer/documents/:documentId/redacted-copies: registers an audience-specific disclosure copy of a
 * controlled original and returns its upload envelope; the original stays unchanged (PRD §14.1).
 */
export const createRedactedCopy = defineEndpoint({
  id: 'buyer.documents.createRedactedCopy',
  method: 'POST',
  path: '/api/v1/buyer/documents/:documentId/redacted-copies',
  audience: 'buyer',
  permission: ['notice.issue', 'complaint.manage', 'tender.clarifications.manage', 'contract.manage', 'export.create'],
  params: DocumentParams,
  body: CreateRedactedCopyBody,
  response: UploadEnvelope,
  idempotent: true,
  errors: [
    'DOCUMENT_NOT_FOUND',
    'DOCUMENT_IS_REDACTED_COPY',
    'CLASSIFICATION_NOT_WIDER',
    'SEALED_CONTENT_NOT_REDACTABLE',
    'FILE_TOO_LARGE',
    'CONTENT_TYPE_NOT_ALLOWED',
  ],
  screens: ['COM-07', 'BUY-28', 'BUY-29'],
});

/** The documents endpoint map. */
export const documentEndpoints = {
  listMyDocuments,
  getMyDocument,
  listMyDocumentVersions,
  getDocumentDownloadLink,
  listBuyerDocuments,
  listSupplierDocuments,
  createBuyerUpload,
  createSupplierUpload,
  confirmBuyerUpload,
  confirmSupplierUpload,
  createRedactedCopy,
} as const;
