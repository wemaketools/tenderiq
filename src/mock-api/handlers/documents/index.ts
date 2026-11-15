/**
 * Mock handlers of the documents contract (`src/contracts/documents.ts`; COM-07, PRD §14.1, DD-12, DD-21).
 *
 * - `/me/documents*` reads through the caller's memberships (`access.ts`); a document the caller may not read is
 *   simply not found. Sealed content is never downloadable (BR-17).
 * - Buyer and supplier document panels list the documents of one related record visible in the active tenant.
 * - Downloads return a prototype-storage link under `/api/v1/public/prototype-storage/…` (`prototype-storage.ts`):
 *   opening it re-checks access and serves an honestly labelled prototype copy of the exact version.
 * - Uploads return a contract-valid envelope. The pending version is remembered in memory (bounded) only so that
 *   the confirm step can answer with the same document; nothing is added to the fixtures, and the next GET still
 *   returns them unchanged.
 */
import { sha256Hex } from '../../sha256.js';

import type { DocumentSummary, DocumentVersion, MyDocumentItem, UploadEnvelope } from '../../../contracts/documents.js';
import {
  confirmBuyerUpload,
  confirmSupplierUpload,
  createBuyerUpload,
  createRedactedCopy,
  createSupplierUpload,
  getDocumentDownloadLink,
  getMyDocument,
  listBuyerDocuments,
  listMyDocumentVersions,
  listMyDocuments,
  listSupplierDocuments,
} from '../../../contracts/documents.js';
import type { DocumentsClassification, DocumentsRelatedType } from '../../../contracts/enums.js';
import { mockRoute } from '../../app.js';
import type { MockApp, MockHandlerContext } from '../../app.js';
import { WORKSPACE_AS_OF, storylineInstant, storylineNow } from '../../fixtures/approvals/world.js';
import { DOCUMENTS, RECEIVED_BID_REVISIONS, findFixtureDocument } from '../../fixtures/documents.js';
import type { FixtureDocument } from '../../fixtures/documents.js';
import { personRef } from '../../persona.js';
import {
  CLASSIFICATION_BREADTH,
  capabilitiesOf,
  downloadBlock,
  grantIn,
  grantOrganization,
  isHeld,
  personaGrant,
  toDetail,
  toSummary,
  toVersion,
} from './access.js';
import type { AccessScope } from './access.js';
import {
  PROTOTYPE_COPY_CONTENT_TYPE,
  PROTOTYPE_LINK_TTL_MS,
  downloadPrototypeCopy,
  issueToken,
  openLink,
  prototypeCopy,
  prototypeCopyFileName,
  prototypeCopyText,
} from './prototype-storage.js';

/** Related types whose documents are served elsewhere (help content, export files). */
const UNSUPPORTED_EVERYWHERE: readonly DocumentsRelatedType[] = ['help_article', 'export'];

/** Buyer-internal related types that never have a supplier-side document panel. */
const BUYER_ONLY_TYPES: readonly DocumentsRelatedType[] = [
  'procurement_request',
  'procurement_project',
  'procurement_strategy',
  'opening_session',
  'assessment_session',
  'due_diligence_case',
  'import_batch',
  'template',
  'policy_profile',
];

const BUYER_UPLOAD_CLASSIFICATIONS: readonly DocumentsClassification[] = [
  'public',
  'participating_suppliers',
  'buyer_internal',
  'restricted_assessment',
  'commercially_confidential',
];

const SUPPLIER_UPLOAD_CLASSIFICATIONS: readonly DocumentsClassification[] = [
  'supplier_private',
  'commercially_confidential',
  'participating_suppliers',
];

const UPLOAD_TTL_MS = 15 * 60 * 1000;

/** Record times are stamped on the storyline clock (never before the fixtures' "as of" instant). */
function iso(date: Date): string {
  return storylineInstant(date);
}

/** A validity window shown to the user: starts at the storyline "now" (the link itself expires on the real clock). */
function windowEnd(now: Date, ttlMs: number): string {
  return storylineInstant(new Date(storylineNow(now).getTime() + ttlMs));
}

function contains(haystack: string | null, needle: string): boolean {
  return haystack !== null && haystack.toLowerCase().includes(needle.toLowerCase());
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base' });
}

function sorted<T>(rows: T[], compare: (a: T, b: T) => number, dir: 'asc' | 'desc'): T[] {
  const factor = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => factor * compare(a, b));
}

function scopeOf(context: { requireTenant(): { tenant: { id: number }; permissions: readonly string[] } }): AccessScope {
  const access = context.requireTenant();
  return { tenantId: access.tenant.id, permissions: access.permissions as AccessScope['permissions'] };
}

// ---------------------------------------------------------------------------------------------------------
// Pending upload envelopes (bounded, in memory: the confirm step answers for the version it issued)
// ---------------------------------------------------------------------------------------------------------

interface IssuedUpload {
  readonly tenantId: number;
  readonly document: DocumentSummary;
  readonly version: DocumentVersion;
  readonly expiresAt: number;
}

const issuedUploads = new Map<number, IssuedUpload>();
let nextVersionId = 9001;
const MAX_ISSUED = 500;

function remember(upload: IssuedUpload): void {
  issuedUploads.set(upload.version.id, upload);
  if (issuedUploads.size > MAX_ISSUED) {
    const oldest = issuedUploads.keys().next().value;
    if (oldest !== undefined) {
      issuedUploads.delete(oldest);
    }
  }
}

function storageKey(tenantId: number, relatedType: string, relatedId: number, documentId: number, versionNo: number, fileName: string): string {
  const sanitized = fileName.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${tenantId}/${relatedType}/${relatedId}/${documentId}/${versionNo}-${sanitized}`;
}

type UploadContext = MockHandlerContext<typeof createBuyerUpload> | MockHandlerContext<typeof createSupplierUpload>;

function createUpload(context: UploadContext, side: 'buyer' | 'supplier'): UploadEnvelope {
  const { body, now, fail } = context;
  const scope = scopeOf(context);
  if (UNSUPPORTED_EVERYWHERE.includes(body.relatedType) || (side === 'supplier' && BUYER_ONLY_TYPES.includes(body.relatedType))) {
    return fail(422, 'RELATED_TYPE_NOT_SUPPORTED', 'Documents of this record type are not managed here.');
  }
  const allowed = side === 'buyer' ? BUYER_UPLOAD_CLASSIFICATIONS : SUPPLIER_UPLOAD_CLASSIFICATIONS;
  if (!allowed.includes(body.classification)) {
    return fail(422, 'CLASSIFICATION_NOT_PERMITTED', 'This classification cannot be chosen for an upload from this side.');
  }
  if (isHeld({ relatedType: body.relatedType, relatedId: body.relatedId })) {
    return fail(409, 'HOLD_BLOCKS_ACTION', 'A legal hold on the related record prevents new documents.');
  }
  if (side === 'supplier' && body.relatedType === 'bid_revision' && RECEIVED_BID_REVISIONS.includes(body.relatedId)) {
    return fail(409, 'SUBMISSION_ALREADY_RECEIVED', 'This response revision has an official receipt; prepare a replacement instead.');
  }
  const createdBy = personRef(context.requirePersona().userId);
  const versionId = nextVersionId++;
  let document: DocumentSummary;
  let versionNo = 1;
  let supersedes: number | null = null;
  if (body.documentId !== undefined) {
    const existing = findFixtureDocument(body.documentId);
    const grant = existing === undefined ? null : grantIn(existing, scope);
    if (existing === undefined || grant === null) {
      return fail(404, 'DOCUMENT_NOT_FOUND');
    }
    if (existing.relatedType !== body.relatedType || existing.relatedId !== body.relatedId) {
      return fail(404, 'DOCUMENT_NOT_FOUND', 'The document does not belong to this record.');
    }
    if (!capabilitiesOf(existing, grant).canUploadVersion) {
      return fail(409, 'DOCUMENT_NOT_EDITABLE', 'This document cannot receive a new version in its current status.');
    }
    const latest = existing.versions[existing.versions.length - 1];
    versionNo = (latest?.versionNo ?? 0) + 1;
    supersedes = latest?.id ?? null;
    document = { ...toSummary(existing), updatedAt: iso(now) };
  } else {
    document = {
      id: 900 + (versionId % 1000),
      title: body.title,
      purpose: body.purpose ?? null,
      classification: body.classification,
      language: body.language,
      status: 'draft',
      relatedType: body.relatedType,
      relatedId: body.relatedId,
      precedence: null,
      isRedactedCopy: false,
      currentVersion: null,
      updatedAt: iso(now),
    };
  }
  const version: DocumentVersion = {
    id: versionId,
    documentId: document.id,
    versionNo,
    fileName: body.fileName,
    contentType: body.contentType,
    sizeBytes: body.sizeBytes,
    sha256: body.sha256,
    uploadStatus: 'pending',
    changeNote: body.changeNote ?? null,
    supersedesVersionId: supersedes,
    createdAt: iso(now),
    createdBy,
    confirmedAt: null,
  };
  const expiresAt = now.getTime() + UPLOAD_TTL_MS;
  remember({ tenantId: scope.tenantId, document, version, expiresAt });
  const key = storageKey(scope.tenantId, body.relatedType, body.relatedId, document.id, versionNo, body.fileName);
  return {
    document,
    version,
    upload: {
      url: `/prototype-storage/upload/${key}?token=${version.id}`,
      method: 'PUT',
      headers: { 'content-type': body.contentType, 'x-upsert': 'false' },
      expiresAt: windowEnd(now, UPLOAD_TTL_MS),
    },
  };
}

type ConfirmContext = MockHandlerContext<typeof confirmBuyerUpload> | MockHandlerContext<typeof confirmSupplierUpload>;

function confirmUpload(context: ConfirmContext): { document: DocumentSummary; version: DocumentVersion } {
  const { params, body, now, fail } = context;
  const scope = scopeOf(context);
  const fixtureDocument = DOCUMENTS.find((document) => document.versions.some((version) => version.id === params.versionId));
  if (fixtureDocument !== undefined) {
    const version = fixtureDocument.versions.find((candidate) => candidate.id === params.versionId);
    if (version === undefined || grantIn(fixtureDocument, scope) === null || fixtureDocument.ownerTenantId !== scope.tenantId) {
      return fail(404, 'UPLOAD_NOT_FOUND');
    }
    if (version.uploadStatus === 'confirmed') {
      return fail(409, 'UPLOAD_ALREADY_CONFIRMED');
    }
    if (version.uploadExpiresAt !== undefined && Date.parse(version.uploadExpiresAt) < Date.parse(WORKSPACE_AS_OF)) {
      return fail(410, 'UPLOAD_EXPIRED', 'The signed upload URL expired before the file was received; upload the file again.');
    }
    if (version.bytesReceived === false) {
      return fail(409, 'UPLOAD_NOT_RECEIVED', 'Storage has not received the file.');
    }
    if (version.sha256 !== body.sha256) {
      return fail(422, 'UPLOAD_HASH_MISMATCH');
    }
    if (version.sizeBytes !== body.sizeBytes) {
      return fail(422, 'UPLOAD_SIZE_MISMATCH');
    }
    const confirmed = { ...toVersion(fixtureDocument, version), uploadStatus: 'confirmed' as const, confirmedAt: iso(now) };
    return { document: { ...toSummary(fixtureDocument), currentVersion: confirmed, updatedAt: iso(now) }, version: confirmed };
  }
  const issued = issuedUploads.get(params.versionId);
  if (issued === undefined || issued.tenantId !== scope.tenantId) {
    return fail(404, 'UPLOAD_NOT_FOUND');
  }
  if (issued.expiresAt < now.getTime()) {
    return fail(410, 'UPLOAD_EXPIRED', 'The signed upload URL expired; upload the file again.');
  }
  if (issued.version.sha256 !== body.sha256) {
    return fail(422, 'UPLOAD_HASH_MISMATCH', 'The file digest differs from the one announced when the upload was created.');
  }
  if (issued.version.sizeBytes !== body.sizeBytes) {
    return fail(422, 'UPLOAD_SIZE_MISMATCH', 'The file size differs from the one announced when the upload was created.');
  }
  issuedUploads.delete(params.versionId);
  const version: DocumentVersion = { ...issued.version, uploadStatus: 'confirmed', confirmedAt: iso(now) };
  return { document: { ...issued.document, currentVersion: version, updatedAt: iso(now) }, version };
}

type ListContext = MockHandlerContext<typeof listBuyerDocuments> | MockHandlerContext<typeof listSupplierDocuments>;

function listRelated(context: ListContext, side: 'buyer' | 'supplier') {
  const { query, fixtures, fail } = context;
  if (UNSUPPORTED_EVERYWHERE.includes(query.relatedType) || (side === 'supplier' && BUYER_ONLY_TYPES.includes(query.relatedType))) {
    return fail(422, 'RELATED_TYPE_NOT_SUPPORTED', 'Documents of this record type are not listed here.');
  }
  const scope = scopeOf(context);
  const rows = DOCUMENTS.filter(
    (document) =>
      document.relatedType === query.relatedType &&
      document.relatedId === query.relatedId &&
      grantIn(document, scope) !== null &&
      (query.classification === undefined || query.classification.includes(document.classification)) &&
      (query.status === undefined || query.status.includes(document.status)) &&
      (query.q === undefined || contains(document.title, query.q) || contains(document.purpose, query.q)),
  );
  const compare = (a: FixtureDocument, b: FixtureDocument): number => {
    switch (query.sort) {
      case 'title':
        return compareText(a.title, b.title);
      case 'status':
        return compareText(a.status, b.status);
      case 'updatedAt':
        return Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
      default:
        return (a.precedence ?? 99) - (b.precedence ?? 99) || compareText(a.title, b.title);
    }
  };
  return fixtures.page(sorted(rows, compare, query.dir).map(toSummary));
}

export function register(app: MockApp): void {
  mockRoute(app, listMyDocuments, ({ requirePersona, query, fixtures }) => {
    const persona = requirePersona();
    const rows: MyDocumentItem[] = [];
    for (const document of DOCUMENTS) {
      const grant = personaGrant(document, persona);
      if (grant === null) {
        continue;
      }
      rows.push({
        ...toSummary(document),
        organization: grantOrganization(document, grant),
        relatedReference: document.relatedReference,
        canDownload: downloadBlock(document, grant) === null,
      });
    }
    const filtered = rows.filter((row) => {
      if (query.q !== undefined && !contains(row.title, query.q) && !contains(row.purpose, query.q) && !contains(row.relatedReference, query.q)) {
        return false;
      }
      if (query.classification !== undefined && !query.classification.includes(row.classification)) {
        return false;
      }
      if (query.status !== undefined && !query.status.includes(row.status)) {
        return false;
      }
      if (query.relatedType !== undefined && !query.relatedType.includes(row.relatedType)) {
        return false;
      }
      if (query.tenantId !== undefined && row.organization.tenantId !== query.tenantId) {
        return false;
      }
      if (query.redactedCopy !== undefined && row.isRedactedCopy !== query.redactedCopy) {
        return false;
      }
      const day = row.updatedAt.slice(0, 10);
      if (query.updatedFrom !== undefined && day < query.updatedFrom) {
        return false;
      }
      return !(query.updatedTo !== undefined && day > query.updatedTo);
    });
    const sortKey = query.sort ?? 'updatedAt';
    const dir = query.sort === undefined ? 'desc' : query.dir;
    const compare = (a: MyDocumentItem, b: MyDocumentItem): number => {
      switch (sortKey) {
        case 'title':
          return compareText(a.title, b.title);
        case 'classification':
          return compareText(a.classification, b.classification);
        case 'status':
          return compareText(a.status, b.status);
        default:
          return Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
      }
    };
    return fixtures.page(sorted(filtered, compare, dir));
  });

  mockRoute(app, getMyDocument, ({ requirePersona, params, fail }) => {
    const document = findFixtureDocument(params.documentId);
    const grant = document === undefined ? null : personaGrant(document, requirePersona());
    if (document === undefined || grant === null) {
      return fail(404, 'DOCUMENT_NOT_FOUND');
    }
    return toDetail(document, grant);
  });

  mockRoute(app, listMyDocumentVersions, ({ requirePersona, params, fail }) => {
    const document = findFixtureDocument(params.documentId);
    if (document === undefined || personaGrant(document, requirePersona()) === null) {
      return fail(404, 'DOCUMENT_NOT_FOUND');
    }
    return { items: [...document.versions].reverse().map((version) => toVersion(document, version)) };
  });

  mockRoute(app, getDocumentDownloadLink, ({ requirePersona, params, now, fail }) => {
    const document = findFixtureDocument(params.documentId);
    const grant = document === undefined ? null : personaGrant(document, requirePersona());
    if (document === undefined || grant === null) {
      return fail(404, 'DOCUMENT_NOT_FOUND');
    }
    const version = document.versions.find((candidate) => candidate.id === params.versionId);
    if (version === undefined) {
      return fail(404, 'VERSION_NOT_FOUND');
    }
    if (version.uploadStatus !== 'confirmed') {
      return fail(409, 'VERSION_NOT_CONFIRMED', 'This version was never confirmed and has no file.');
    }
    const block = downloadBlock(document, grant);
    if (block !== null && block !== 'no_confirmed_version') {
      return fail(
        403,
        'DOWNLOAD_NOT_PERMITTED',
        block === 'sealed'
          ? 'Sealed content cannot be downloaded before the authorized opening.'
          : 'Your access to this document does not include the file.',
      );
    }
    // Stage A: the link serves the prototype copy of this version (see prototype-storage.ts), described here
    // exactly as the browser will save it.
    const persona = requirePersona();
    const token = issueToken(document.id, version.id, persona.userId, now.getTime() + PROTOTYPE_LINK_TTL_MS);
    const text = prototypeCopyText(prototypeCopy(document, version));
    return {
      url: `${downloadPrototypeCopy.path.replace(':token', token)}`,
      expiresAt: windowEnd(now, PROTOTYPE_LINK_TTL_MS),
      fileName: prototypeCopyFileName(version.fileName),
      contentType: PROTOTYPE_COPY_CONTENT_TYPE,
      sizeBytes: new TextEncoder().encode(text).length,
      sha256: sha256Hex(text),
    };
  });

  mockRoute(app, downloadPrototypeCopy, ({ params, now, fail }) => {
    const opened = openLink(params.token, now.getTime());
    if (!opened.ok) {
      return fail(opened.status, opened.code, opened.detail);
    }
    return opened.copy;
  });

  mockRoute(app, listBuyerDocuments, (context) => listRelated(context, 'buyer'));
  mockRoute(app, listSupplierDocuments, (context) => listRelated(context, 'supplier'));
  mockRoute(app, createBuyerUpload, (context) => createUpload(context, 'buyer'));
  mockRoute(app, createSupplierUpload, (context) => createUpload(context, 'supplier'));
  mockRoute(app, confirmBuyerUpload, (context) => confirmUpload(context));
  mockRoute(app, confirmSupplierUpload, (context) => confirmUpload(context));

  mockRoute(app, createRedactedCopy, (context) => {
    const { params, body, now, fail } = context;
    const scope = scopeOf(context);
    const original = findFixtureDocument(params.documentId);
    const grant = original === undefined ? null : grantIn(original, scope);
    if (original === undefined || grant === null || original.tenantId !== scope.tenantId) {
      return fail(404, 'DOCUMENT_NOT_FOUND');
    }
    if (original.isRedactedCopy) {
      return fail(409, 'DOCUMENT_IS_REDACTED_COPY', 'Redact the controlled original, not a copy.');
    }
    if (original.classification === 'sealed') {
      return fail(409, 'SEALED_CONTENT_NOT_REDACTABLE', 'Sealed content cannot be disclosed before the authorized opening.');
    }
    if (CLASSIFICATION_BREADTH[body.classification] <= CLASSIFICATION_BREADTH[original.classification]) {
      return fail(422, 'CLASSIFICATION_NOT_WIDER', 'A disclosure copy must be for a wider audience than the original.');
    }
    const versionId = nextVersionId++;
    const documentId = 900 + (versionId % 1000);
    const document: DocumentSummary = {
      id: documentId,
      title: body.title,
      purpose: body.reason,
      classification: body.classification,
      language: original.language,
      status: 'redacted',
      relatedType: original.relatedType,
      relatedId: original.relatedId,
      precedence: null,
      isRedactedCopy: true,
      currentVersion: null,
      updatedAt: iso(now),
    };
    const version: DocumentVersion = {
      id: versionId,
      documentId,
      versionNo: 1,
      fileName: body.fileName,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      sha256: body.sha256,
      uploadStatus: 'pending',
      changeNote: `Redacted copy of document ${original.id}: ${body.reason}`,
      supersedesVersionId: null,
      createdAt: iso(now),
      createdBy: personRef(context.requirePersona().userId),
      confirmedAt: null,
    };
    const expiresAt = now.getTime() + UPLOAD_TTL_MS;
    remember({ tenantId: scope.tenantId, document, version, expiresAt });
    const key = storageKey(original.tenantId, original.relatedType, original.relatedId, documentId, 1, body.fileName);
    return {
      document,
      version,
      upload: {
        url: `/prototype-storage/upload/${key}?token=${versionId}`,
        method: 'PUT' as const,
        headers: { 'content-type': body.contentType, 'x-upsert': 'false' },
        expiresAt: windowEnd(now, UPLOAD_TTL_MS),
      },
    };
  });
}
