/**
 * Document access and projections of the mock API (stands in for the Stage B `documents/access-registry.ts`):
 * who may read a document, whether the file may be downloaded, and the contract shapes COM-07 and the document
 * panels receive. Access is decided per membership, so a person with several memberships only sees a document
 * through a membership that is entitled to it (BR-02, BR-43).
 */
import type { OrganizationLabel } from '../../../contracts/common.js';
import { DOCUMENT_CLASSIFICATION_BREADTH } from '../../../contracts/documents.js';
import type {
  DocumentCapabilities,
  DocumentDetail,
  DocumentRef,
  DocumentSummary,
  DocumentVersion,
  DownloadBlockReason,
} from '../../../contracts/documents.js';
import type { DocumentsClassification } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { DOCUMENTS, HELD_RECORDS, findFixtureDocument } from '../../fixtures/documents.js';
import type { DocumentAccessRule, FixtureDocument, FixtureDocumentVersion } from '../../fixtures/documents.js';
import { activeMemberships, findTenantById, membershipPermissions, organizationLabel, personRef } from '../../persona.js';
import type { Persona } from '../../persona.js';

/** The tenant a caller acts in and the permissions held there. */
export interface AccessScope {
  readonly tenantId: number;
  readonly permissions: readonly PermissionCode[];
}

/** How a scope reaches a document. */
export interface DocumentGrant {
  readonly scope: AccessScope;
  readonly rule: DocumentAccessRule;
}

/** Buyer permissions that may add documents (mirrors the contract's upload permission list). */
const BUYER_UPLOAD: readonly PermissionCode[] = [
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

const SUPPLIER_UPLOAD: readonly PermissionCode[] = [
  'supplier.response.edit',
  'supplier.pricing.edit',
  'supplier.evidence.manage',
  'supplier.org.manage',
  'supplier.qualification.apply',
  'supplier.complaint.submit',
  'supplier.contract.participate',
];

/** Permissions that may register a redacted disclosure copy (the contract's list). */
export const REDACTION_PERMISSIONS: readonly PermissionCode[] = [
  'notice.issue',
  'complaint.manage',
  'tender.clarifications.manage',
  'contract.manage',
  'export.create',
];

/** Classification breadth: a redacted copy must have a wider audience than its original. */
export const CLASSIFICATION_BREADTH: Readonly<Record<DocumentsClassification, number>> =
  DOCUMENT_CLASSIFICATION_BREADTH;

/** Statuses in which a document may receive a new version. */
const EDITABLE_STATUSES = new Set(['draft', 'approved', 'published']);

function ruleAdmits(rule: DocumentAccessRule, scope: AccessScope): boolean {
  if (rule.tenantId !== 'any' && rule.tenantId !== scope.tenantId) {
    return false;
  }
  return rule.anyOf === null || rule.anyOf.some((code) => scope.permissions.includes(code));
}

/** The best grant of `scope` on `document` (a downloadable rule first), or `null`. */
export function grantIn(document: FixtureDocument, scope: AccessScope): DocumentGrant | null {
  const admitted = document.access.filter((rule) => ruleAdmits(rule, scope));
  if (admitted.length === 0) {
    return null;
  }
  const rule = admitted.find((candidate) => candidate.download !== false) ?? admitted[0];
  return rule === undefined ? null : { scope, rule };
}

/** Every active membership of the persona as an access scope (the `/me` scope, DD-21). */
export function personaScopes(persona: Persona): AccessScope[] {
  return activeMemberships(persona).map((membership) => ({
    tenantId: membership.tenantId,
    permissions: membershipPermissions(membership),
  }));
}

/**
 * The persona's grant on a document across memberships: the owning tenant first, then the uploading tenant, then
 * any other; within those, a downloadable grant wins.
 */
export function personaGrant(document: FixtureDocument, persona: Persona): DocumentGrant | null {
  const grants = personaScopes(persona)
    .map((scope) => grantIn(document, scope))
    .filter((grant): grant is DocumentGrant => grant !== null);
  const rank = (grant: DocumentGrant): number =>
    (grant.rule.download === false ? 10 : 0) +
    (grant.scope.tenantId === document.tenantId ? 0 : grant.scope.tenantId === document.ownerTenantId ? 1 : 2);
  return [...grants].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/** True when the grant's scope may read the document at all. */
export function canRead(document: FixtureDocument, scope: AccessScope): boolean {
  return grantIn(document, scope) !== null;
}

export function confirmedVersions(document: FixtureDocument): FixtureDocumentVersion[] {
  return document.versions.filter((version) => version.uploadStatus === 'confirmed');
}

export function latestConfirmed(document: FixtureDocument): FixtureDocumentVersion | null {
  const confirmed = confirmedVersions(document);
  return confirmed[confirmed.length - 1] ?? null;
}

/** Why the file cannot be downloaded through this grant, or `null` when it can. */
export function downloadBlock(document: FixtureDocument, grant: DocumentGrant): DownloadBlockReason | null {
  if (document.classification === 'sealed') {
    return 'sealed';
  }
  if (grant.rule.download === false) {
    return 'classification_restricted';
  }
  if (document.status === 'withdrawn') {
    return 'withdrawn';
  }
  if (latestConfirmed(document) === null) {
    return 'no_confirmed_version';
  }
  return null;
}

export function isHeld(document: Pick<FixtureDocument, 'relatedType' | 'relatedId'>): boolean {
  return HELD_RECORDS.some((held) => held.relatedType === document.relatedType && held.relatedId === document.relatedId);
}

/** What the grant's scope may do with the document. */
export function capabilitiesOf(document: FixtureDocument, grant: DocumentGrant): DocumentCapabilities {
  const block = downloadBlock(document, grant);
  const tenantKind = findTenantById(grant.scope.tenantId)?.kind;
  const uploadCodes = tenantKind === 'supplier' ? SUPPLIER_UPLOAD : BUYER_UPLOAD;
  const canUploadVersion =
    grant.scope.tenantId === document.ownerTenantId &&
    uploadCodes.some((code) => grant.scope.permissions.includes(code)) &&
    EDITABLE_STATUSES.has(document.status) &&
    !document.isRedactedCopy &&
    document.classification !== 'sealed' &&
    !isHeld(document);
  const canCreateRedactedCopy =
    tenantKind === 'buyer' &&
    grant.scope.tenantId === document.tenantId &&
    REDACTION_PERMISSIONS.some((code) => grant.scope.permissions.includes(code)) &&
    !document.isRedactedCopy &&
    document.classification !== 'sealed' &&
    document.classification !== 'public' &&
    block !== 'classification_restricted';
  return {
    canDownload: block === null,
    canUploadVersion,
    canCreateRedactedCopy,
    downloadBlockedReason: block,
  };
}

export function toVersion(document: FixtureDocument, version: FixtureDocumentVersion): DocumentVersion {
  return {
    id: version.id,
    documentId: document.id,
    versionNo: version.versionNo,
    fileName: version.fileName,
    contentType: version.contentType,
    sizeBytes: version.sizeBytes,
    sha256: version.sha256,
    uploadStatus: version.uploadStatus,
    changeNote: version.changeNote,
    supersedesVersionId: version.supersedesVersionId,
    createdAt: version.createdAt,
    createdBy: version.createdByUserId === null ? null : personRef(version.createdByUserId),
    confirmedAt: version.confirmedAt,
  };
}

export function toSummary(document: FixtureDocument): DocumentSummary {
  const current = latestConfirmed(document);
  return {
    id: document.id,
    title: document.title,
    purpose: document.purpose,
    classification: document.classification,
    language: document.language,
    status: document.status,
    relatedType: document.relatedType,
    relatedId: document.relatedId,
    precedence: document.precedence,
    isRedactedCopy: document.isRedactedCopy,
    currentVersion: current === null ? null : toVersion(document, current),
    updatedAt: document.updatedAt,
  };
}

function toRef(document: FixtureDocument): DocumentRef {
  return { documentId: document.id, title: document.title, classification: document.classification, status: document.status };
}

/** The organization a grant reads the document through (the owning tenant for public documents). */
export function grantOrganization(document: FixtureDocument, grant: DocumentGrant): OrganizationLabel {
  return organizationLabel(grant.rule.tenantId === 'any' ? document.tenantId : grant.scope.tenantId);
}

/** The related-record page for the grant's side (supplier pages for supplier members). */
export function relatedLinkFor(document: FixtureDocument, grant: DocumentGrant): string | null {
  return findTenantById(grant.scope.tenantId)?.kind === 'supplier' ? document.supplierLinkPath : document.relatedLinkPath;
}

/** COM-07: everything the viewer may see about the document through `grant`. */
export function toDetail(document: FixtureDocument, grant: DocumentGrant): DocumentDetail {
  const original = document.redactedFromDocumentId === null ? undefined : findFixtureDocument(document.redactedFromDocumentId);
  const copies = DOCUMENTS.filter((candidate) => candidate.redactedFromDocumentId === document.id);
  return {
    ...toSummary(document),
    organization: grantOrganization(document, grant),
    ownerTenant: organizationLabel(document.ownerTenantId),
    owner: document.ownerUserId === null ? null : personRef(document.ownerUserId),
    relatedReference: document.relatedReference,
    relatedLinkPath: relatedLinkFor(document, grant),
    redactedFrom: original !== undefined && canRead(original, grant.scope) ? toRef(original) : null,
    redactedCopies: copies.filter((copy) => canRead(copy, grant.scope)).map(toRef),
    evidence: document.evidence,
    versionCount: document.versions.length,
    createdAt: document.createdAt,
    capabilities: capabilitiesOf(document, grant),
  };
}
