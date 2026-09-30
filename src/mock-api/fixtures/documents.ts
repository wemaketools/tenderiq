/**
 * Document fixtures (COM-07; PRD §14.1; DD-12): documents, their versions, evidence facts and the access rules the
 * mock applies in place of the Stage B access registry (`documents/access-registry.ts`).
 *
 * - `tenantId` is the tenant that owns the related record (the buyer for procurement records, even for supplier
 *   uploads); `ownerTenantId` is the tenant that uploaded the file (DD-12).
 * - `access` lists who may read the document: members of `tenantId` holding one of `anyOf` (or any member when
 *   `anyOf` is null; `'any'` = every signed-in person, for public documents). `download: false` keeps the file
 *   itself out of reach while the metadata stays visible.
 * - Sealed submission content is never downloadable (BR-17), and buyer personnel never see supplier drafts.
 */
import type { CalendarDate, Instant } from '../../contracts/common.js';
import type {
  DocumentVersionsUploadStatus,
  DocumentsClassification,
  DocumentsRelatedType,
  DocumentsStatus,
  EvidenceItemsVerificationStatus,
} from '../../contracts/enums.js';
import type { PermissionCode } from '../../contracts/permissions.js';
import { RECORDS, digest, tid, uid } from './approvals/world.js';

/** One access rule of a document. */
export interface DocumentAccessRule {
  /** The tenant whose members the rule admits, or `'any'` for every signed-in person (public documents). */
  readonly tenantId: number | 'any';
  /** Permissions of which the member must hold one; `null` = any active member. */
  readonly anyOf: readonly PermissionCode[] | null;
  /** False when the rule grants the metadata only (sealed, restricted). Defaults to true. */
  readonly download?: boolean;
}

export interface FixtureDocumentVersion {
  readonly id: number;
  readonly versionNo: number;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly uploadStatus: DocumentVersionsUploadStatus;
  readonly changeNote: string | null;
  readonly supersedesVersionId: number | null;
  readonly createdAt: Instant;
  readonly createdByUserId: number | null;
  readonly confirmedAt: Instant | null;
  /** For a pending version: whether the bytes reached storage (confirm answers UPLOAD_NOT_RECEIVED otherwise). */
  readonly bytesReceived?: boolean;
  /** For a pending version: when its signed upload URL expired. */
  readonly uploadExpiresAt?: Instant;
}

export interface FixtureEvidenceFacts {
  readonly evidenceItemId: number;
  readonly issuer: string | null;
  readonly periodStart: CalendarDate | null;
  readonly periodEnd: CalendarDate | null;
  readonly validFrom: CalendarDate | null;
  readonly expiresAt: CalendarDate | null;
  readonly verificationStatus: EvidenceItemsVerificationStatus;
}

export interface FixtureDocument {
  readonly id: number;
  readonly tenantId: number;
  readonly ownerTenantId: number;
  readonly ownerUserId: number | null;
  readonly title: string;
  readonly purpose: string | null;
  readonly classification: DocumentsClassification;
  readonly language: string;
  readonly status: DocumentsStatus;
  readonly relatedType: DocumentsRelatedType;
  readonly relatedId: number;
  readonly relatedReference: string | null;
  /** The buyer-side page of the related record. */
  readonly relatedLinkPath: string | null;
  /** The supplier-side page of the related record, when suppliers have one. */
  readonly supplierLinkPath: string | null;
  readonly precedence: number | null;
  readonly isRedactedCopy: boolean;
  readonly redactedFromDocumentId: number | null;
  readonly versions: readonly FixtureDocumentVersion[];
  readonly evidence: FixtureEvidenceFacts | null;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly access: readonly DocumentAccessRule[];
}

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

interface VersionSpec {
  readonly fileName: string;
  readonly contentType?: string;
  readonly sizeBytes: number;
  readonly at: Instant;
  readonly by: string | null;
  readonly note?: string;
  readonly status?: DocumentVersionsUploadStatus;
  readonly bytesReceived?: boolean;
  readonly uploadExpiresAt?: Instant;
}

/** Builds versions with ids `documentId * 10 + versionNo`, each superseding the previous one. */
function versions(documentId: number, specs: readonly VersionSpec[]): FixtureDocumentVersion[] {
  return specs.map((spec, index) => {
    const versionNo = index + 1;
    const status = spec.status ?? 'confirmed';
    return {
      id: documentId * 10 + versionNo,
      versionNo,
      fileName: spec.fileName,
      contentType: spec.contentType ?? PDF,
      sizeBytes: spec.sizeBytes,
      sha256: digest(`document:${documentId}:v${versionNo}:${spec.fileName}`),
      uploadStatus: status,
      changeNote: spec.note ?? null,
      supersedesVersionId: index === 0 ? null : documentId * 10 + index,
      createdAt: spec.at,
      createdByUserId: spec.by === null ? null : uid(spec.by),
      confirmedAt: status === 'confirmed' ? spec.at : null,
      ...(spec.bytesReceived === undefined ? {} : { bytesReceived: spec.bytesReceived }),
      ...(spec.uploadExpiresAt === undefined ? {} : { uploadExpiresAt: spec.uploadExpiresAt }),
    };
  });
}

const KWU = tid('kwu');
const ODC = tid('odc');
const TSODILO = tid('tsodilo');
const CHOBE = tid('chobe-pipe');
const MAKGADIKGADI = tid('makgadikgadi');
const SEROWE = tid('serowe-ict');
const LIMPOPO = tid('limpopo-env');
const GABORONE = tid('gaborone-meter');

const PUBLIC: DocumentAccessRule = { tenantId: 'any', anyOf: null };
const KWU_TENDER_TEAM: DocumentAccessRule = { tenantId: KWU, anyOf: ['tender.view', 'tender.edit'] };
const supplierReaders = (tenantId: number): DocumentAccessRule => ({
  tenantId,
  anyOf: ['supplier.opportunities.view', 'supplier.response.edit', 'supplier.evidence.manage'],
});

/** Supplier organizations taking part in each KWU tender (for supplier-audience documents). */
export const TENDER_PARTICIPANTS: Readonly<Record<number, readonly number[]>> = {
  1: [TSODILO, CHOBE, MAKGADIKGADI],
  2: [GABORONE, CHOBE, SEROWE],
  3: [SEROWE, TSODILO, MAKGADIKGADI],
  6: [TSODILO, CHOBE],
  7: [LIMPOPO, MAKGADIKGADI, TSODILO],
  8: [CHOBE, TSODILO],
  9: [SEROWE, LIMPOPO, TSODILO],
};

/** Records under a legal hold: no new document versions (BR-40). */
export const HELD_RECORDS: readonly { relatedType: DocumentsRelatedType; relatedId: number }[] = [
  { relatedType: 'contract', relatedId: RECORDS.c7.id },
];

/** Bid revisions with an official receipt: nothing more may be uploaded to them (BR-18). */
export const RECEIVED_BID_REVISIONS: readonly number[] = [801, 802, 203, 204];

export const DOCUMENTS: readonly FixtureDocument[] = Object.freeze([
  {
    id: 201,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('tebogo.officer'),
    title: 'Tender package — Smart water meter supply',
    purpose: 'Instructions, specification, pricing schedule and conditions of contract for T-2026-0002.',
    classification: 'public',
    language: 'en',
    status: 'published',
    relatedType: 'tender',
    relatedId: RECORDS.t2.id,
    relatedReference: RECORDS.t2.reference,
    relatedLinkPath: RECORDS.t2.buyerLink,
    supplierLinkPath: RECORDS.t2.supplierLink,
    precedence: 1,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(201, [
      { fileName: 'T-2026-0002-tender-package.pdf', sizeBytes: 2_481_920, at: '2026-09-01T07:30:00Z', by: 'tebogo.officer' },
      {
        fileName: 'T-2026-0002-tender-package-v2.pdf',
        sizeBytes: 2_530_114,
        at: '2026-09-15T09:00:00Z',
        by: 'tebogo.officer',
        note: 'Addendum 1 incorporated: revised delivery lots and meter data format.',
      },
    ]),
    evidence: null,
    createdAt: '2026-09-01T07:30:00Z',
    updatedAt: '2026-09-15T09:00:00Z',
    access: [PUBLIC],
  },
  {
    id: 202,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('tebogo.officer'),
    title: 'Addendum 1 — OIML R49 type-approval certificate and deadline extension',
    purpose: 'Adds mandatory requirement Q-05, moves the submission deadline to 21 Oct 2026 and asks every participant to acknowledge and supplement.',
    classification: 'participating_suppliers',
    language: 'en',
    status: 'published',
    relatedType: 'addendum',
    relatedId: 21,
    relatedReference: `${RECORDS.t2.reference} Addendum 1`,
    relatedLinkPath: RECORDS.t2.buyerLink,
    supplierLinkPath: RECORDS.t2.supplierLink,
    precedence: 2,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(202, [
      { fileName: 'T-2026-0002-addendum-1.pdf', sizeBytes: 312_448, at: '2026-09-24T08:00:00Z', by: 'tebogo.officer' },
    ]),
    evidence: null,
    createdAt: '2026-09-24T08:00:00Z',
    updatedAt: '2026-09-24T08:00:00Z',
    access: [KWU_TENDER_TEAM, ...(TENDER_PARTICIPANTS[2] ?? []).map(supplierReaders)],
  },
  {
    id: 203,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('tebogo.officer'),
    title: 'Technical specification — Water treatment chemicals framework',
    purpose: 'Scope, product list and delivery conditions of the framework under release approval.',
    classification: 'buyer_internal',
    language: 'en',
    status: 'draft',
    relatedType: 'tender',
    relatedId: RECORDS.t5.id,
    relatedReference: RECORDS.t5.reference,
    relatedLinkPath: RECORDS.t5.buyerLink,
    supplierLinkPath: null,
    precedence: 1,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(203, [
      { fileName: 'T-2026-0005-specification-v1.docx', contentType: DOCX, sizeBytes: 402_110, at: '2026-09-08T08:00:00Z', by: 'tebogo.officer' },
      {
        fileName: 'T-2026-0005-specification-v2.docx',
        contentType: DOCX,
        sizeBytes: 415_902,
        at: '2026-09-21T09:00:00Z',
        by: 'amantle.eval',
        note: 'REQ-T-02 states the storage requirements for HTH granules (correction requested on 18 Sep). Submitted for release approval as revision 2.',
      },
      {
        fileName: 'T-2026-0005-specification-v3.docx',
        contentType: DOCX,
        sizeBytes: 451_337,
        at: '2026-09-28T09:12:00Z',
        by: 'tebogo.officer',
        note: 'Revision 3: Lot 3 — polyelectrolyte flocculant added with REQ-T-03; estimated value BWP 1,920,000.00.',
      },
    ]),
    evidence: null,
    createdAt: '2026-09-08T08:00:00Z',
    updatedAt: '2026-09-28T09:12:00Z',
    access: [{ tenantId: KWU, anyOf: ['tender.view', 'tender.edit', 'tender.release_approve'] }],
  },
  {
    id: 204,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('kagiso.requester'),
    title: `Business case — ${RECORDS.pr3.title}`,
    purpose: `Need, options considered, risks and funding source for ${RECORDS.pr3.reference}.`,
    classification: 'buyer_internal',
    language: 'en',
    status: 'submitted',
    relatedType: 'procurement_request',
    relatedId: RECORDS.pr3.id,
    relatedReference: RECORDS.pr3.reference,
    relatedLinkPath: RECORDS.pr3.buyerLink,
    supplierLinkPath: null,
    precedence: null,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(204, [
      { fileName: 'PR-2026-0003-business-case.pdf', sizeBytes: 684_032, at: '2026-09-12T09:20:00Z', by: 'kagiso.requester' },
    ]),
    evidence: null,
    createdAt: '2026-09-12T09:20:00Z',
    updatedAt: '2026-09-12T09:20:00Z',
    access: [
      { tenantId: KWU, anyOf: ['request.create', 'request.view_all', 'request.approve', 'request.funding_confirm'] },
    ],
  },
  {
    id: 205,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('kagiso.requester'),
    title: 'Engineer’s estimate — Northern wellfield pipeline extension',
    purpose: 'August 2026 engineer’s estimate behind the estimated value: 2026 HDPE prices and 2025 civil works rates (not offers).',
    classification: 'buyer_internal',
    language: 'en',
    status: 'submitted',
    relatedType: 'procurement_request',
    relatedId: RECORDS.pr3.id,
    relatedReference: RECORDS.pr3.reference,
    relatedLinkPath: RECORDS.pr3.buyerLink,
    supplierLinkPath: null,
    precedence: null,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(205, [
      { fileName: 'PR-2026-0003-engineers-estimate.xlsx', contentType: XLSX, sizeBytes: 58_880, at: '2026-09-12T09:25:00Z', by: 'kagiso.requester' },
    ]),
    evidence: null,
    createdAt: '2026-09-12T09:25:00Z',
    updatedAt: '2026-09-12T09:25:00Z',
    access: [
      { tenantId: KWU, anyOf: ['request.create', 'request.view_all', 'request.approve', 'request.funding_confirm'] },
    ],
  },
  {
    id: 206,
    tenantId: KWU,
    ownerTenantId: TSODILO,
    ownerUserId: uid('tsodilo.bidmanager'),
    title: 'Commercial offer — Pipeline valves bulk supply',
    purpose: 'Priced schedule of Tsodilo Engineering’s submission (sealed until the commercial opening).',
    classification: 'sealed',
    language: 'en',
    status: 'submitted',
    relatedType: 'bid_revision',
    relatedId: 801,
    relatedReference: `${RECORDS.t8.reference} / Tsodilo Engineering`,
    relatedLinkPath: RECORDS.t8.buyerLink,
    supplierLinkPath: `${RECORDS.t8.supplierLink ?? '/supplier'}/response`,
    precedence: null,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(206, [
      { fileName: 'tsodilo-t-2026-0008-commercial.pdf', sizeBytes: 1_204_224, at: '2026-09-29T13:41:00Z', by: 'tsodilo.bidmanager' },
    ]),
    evidence: null,
    createdAt: '2026-09-29T13:41:00Z',
    updatedAt: '2026-09-29T13:41:00Z',
    access: [
      { tenantId: TSODILO, anyOf: ['supplier.response.edit', 'supplier.response.approve', 'supplier.response.submit'], download: false },
      { tenantId: KWU, anyOf: ['bid.monitor', 'bid.open'], download: false },
    ],
  },
  {
    id: 207,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('boitumelo.chair'),
    title: 'Evaluation report — Reservoir rehabilitation works',
    purpose: 'Committee evaluation, scores and recommendation for T-2026-0007 (controlled original).',
    classification: 'restricted_assessment',
    language: 'en',
    status: 'approved',
    relatedType: 'evaluation_report',
    relatedId: 7,
    relatedReference: RECORDS.t7.reference,
    relatedLinkPath: RECORDS.t7.buyerLink,
    supplierLinkPath: null,
    precedence: null,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(207, [
      { fileName: 'T-2026-0007-evaluation-report.pdf', sizeBytes: 1_842_176, at: '2026-09-10T14:00:00Z', by: 'boitumelo.chair' },
    ]),
    evidence: null,
    createdAt: '2026-09-10T14:00:00Z',
    updatedAt: '2026-09-10T14:00:00Z',
    access: [
      { tenantId: KWU, anyOf: ['evaluation.chair', 'award.recommend', 'award.approve', 'complaint.manage'] },
      { tenantId: KWU, anyOf: ['audit.view'], download: false },
    ],
  },
  {
    id: 208,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('tebogo.officer'),
    title: 'Evaluation report — Reservoir rehabilitation works (redacted for debrief)',
    purpose: 'Disclosure copy for debriefs: other bidders’ prices, scores and personal data removed.',
    classification: 'participating_suppliers',
    language: 'en',
    status: 'redacted',
    relatedType: 'evaluation_report',
    relatedId: 7,
    relatedReference: RECORDS.t7.reference,
    relatedLinkPath: RECORDS.t7.buyerLink,
    supplierLinkPath: RECORDS.t7.supplierLink,
    precedence: null,
    isRedactedCopy: true,
    redactedFromDocumentId: 207,
    versions: versions(208, [
      { fileName: 'T-2026-0007-evaluation-report-redacted.pdf', sizeBytes: 902_144, at: '2026-09-25T08:30:00Z', by: 'tebogo.officer' },
    ]),
    evidence: null,
    createdAt: '2026-09-25T08:30:00Z',
    updatedAt: '2026-09-25T08:30:00Z',
    access: [KWU_TENDER_TEAM, ...(TENDER_PARTICIPANTS[7] ?? []).map(supplierReaders)],
  },
  {
    id: 209,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('masego.contracts'),
    title: 'Signed contract — Fleet vehicle maintenance',
    purpose: 'Executed agreement C-2026-0001 with schedules and service levels.',
    classification: 'commercially_confidential',
    language: 'en',
    status: 'signed',
    relatedType: 'contract',
    relatedId: RECORDS.c1.id,
    relatedReference: RECORDS.c1.reference,
    relatedLinkPath: RECORDS.c1.buyerLink,
    supplierLinkPath: null,
    precedence: 1,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(209, [
      { fileName: 'C-2026-0001-signed.pdf', sizeBytes: 3_311_616, at: '2026-07-01T09:00:00Z', by: 'masego.contracts' },
    ]),
    evidence: null,
    createdAt: '2026-07-01T09:00:00Z',
    updatedAt: '2026-07-01T09:00:00Z',
    access: [{ tenantId: KWU, anyOf: ['contract.view', 'contract.manage'] }],
  },
  {
    id: 210,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('masego.contracts'),
    title: 'Q3 service report — review outcome',
    purpose: 'Milestone evidence review: rejected, with remediation required by 2026-10-20.',
    classification: 'buyer_internal',
    language: 'en',
    status: 'approved',
    relatedType: 'obligation',
    relatedId: 13,
    relatedReference: `${RECORDS.c1.reference} / Q3 service report`,
    relatedLinkPath: RECORDS.c1.buyerLink,
    supplierLinkPath: null,
    precedence: null,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(210, [
      { fileName: 'C-2026-0001-q3-review.pdf', sizeBytes: 211_968, at: '2026-10-03T11:00:00Z', by: 'masego.contracts' },
    ]),
    evidence: null,
    createdAt: '2026-10-03T11:00:00Z',
    updatedAt: '2026-10-03T11:00:00Z',
    access: [{ tenantId: KWU, anyOf: ['contract.view', 'contract.manage'] }],
  },
  {
    id: 211,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('masego.contracts'),
    title: 'Contract for signature — Borehole pumps Lot 1',
    purpose: 'Agreement prepared for signature by Tsodilo Engineering and KWU.',
    classification: 'commercially_confidential',
    language: 'en',
    status: 'draft',
    relatedType: 'contract',
    relatedId: RECORDS.c2.id,
    relatedReference: RECORDS.c2.reference,
    relatedLinkPath: RECORDS.c2.buyerLink,
    supplierLinkPath: RECORDS.c2.supplierLink,
    precedence: 1,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(211, [
      { fileName: 'C-2026-0002-for-signature-v1.pdf', sizeBytes: 2_004_992, at: '2026-09-22T10:00:00Z', by: 'masego.contracts' },
      {
        fileName: 'C-2026-0002-for-signature-v2.pdf',
        sizeBytes: 2_019_328,
        at: '2026-09-30T15:20:00Z',
        by: 'masego.contracts',
        note: 'Delivery period extended to 16 weeks and price adjusted (differs from the award).',
      },
    ]),
    evidence: null,
    createdAt: '2026-09-22T10:00:00Z',
    updatedAt: '2026-09-30T15:20:00Z',
    access: [
      { tenantId: KWU, anyOf: ['contract.view', 'contract.approve'] },
      { tenantId: TSODILO, anyOf: ['supplier.contract.participate'] },
    ],
  },
  {
    id: 212,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('masego.contracts'),
    title: 'Award-to-contract difference statement — Lot 1',
    purpose: 'Differences between the approved award and the contract for signature (AC-28).',
    classification: 'buyer_internal',
    language: 'en',
    status: 'approved',
    relatedType: 'contract',
    relatedId: RECORDS.c2.id,
    relatedReference: RECORDS.c2.reference,
    relatedLinkPath: RECORDS.c2.buyerLink,
    supplierLinkPath: null,
    precedence: null,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(212, [
      { fileName: 'C-2026-0002-difference-statement.pdf', sizeBytes: 148_480, at: '2026-10-01T08:00:00Z', by: 'masego.contracts' },
    ]),
    evidence: null,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
    access: [{ tenantId: KWU, anyOf: ['contract.view', 'contract.approve'] }],
  },
  {
    id: 213,
    tenantId: CHOBE,
    ownerTenantId: CHOBE,
    ownerUserId: uid('chobe-pipe.admin'),
    title: 'Public liability insurance certificate 2025–2026',
    purpose: 'Insurance evidence for the Water Infrastructure Suppliers — Category A qualification.',
    classification: 'supplier_private',
    language: 'en',
    status: 'approved',
    relatedType: 'evidence_item',
    relatedId: 504,
    relatedReference: 'Insurance — public liability',
    relatedLinkPath: '/buyer/qualification',
    supplierLinkPath: '/supplier/evidence',
    precedence: null,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(213, [
      { fileName: 'chobe-public-liability-2025.pdf', sizeBytes: 388_096, at: '2025-10-16T08:00:00Z', by: 'chobe-pipe.admin' },
    ]),
    evidence: {
      evidenceItemId: 504,
      issuer: 'Botswana Insurance Company Ltd',
      periodStart: '2025-10-15',
      periodEnd: '2026-10-14',
      validFrom: '2025-10-15',
      expiresAt: '2026-10-08',
      verificationStatus: 'independently_verified',
    },
    createdAt: '2025-10-16T08:00:00Z',
    updatedAt: '2025-10-16T08:00:00Z',
    access: [
      { tenantId: CHOBE, anyOf: null },
      { tenantId: KWU, anyOf: ['qualification.review', 'qualification.decide'] },
    ],
  },
  {
    id: 214,
    tenantId: MAKGADIKGADI,
    ownerTenantId: MAKGADIKGADI,
    ownerUserId: uid('makgadikgadi.admin'),
    title: 'Financial statements FY2025 (unaudited)',
    purpose: 'Financial evidence of qualification application QA-2026-0003; the reviewer asked for clarification.',
    classification: 'commercially_confidential',
    language: 'en',
    status: 'submitted',
    relatedType: 'evidence_item',
    relatedId: 602,
    relatedReference: 'QA-2026-0003 financial evidence',
    relatedLinkPath: '/buyer/qualification',
    supplierLinkPath: '/supplier/evidence',
    precedence: null,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(214, [
      { fileName: 'makgadikgadi-fs-2025.pdf', sizeBytes: 1_020_928, at: '2026-09-12T10:10:00Z', by: 'makgadikgadi.admin' },
    ]),
    evidence: {
      evidenceItemId: 602,
      issuer: 'Makgadikgadi Civil Works (management accounts)',
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
      validFrom: null,
      expiresAt: null,
      verificationStatus: 'supplier_provided',
    },
    createdAt: '2026-09-12T10:10:00Z',
    updatedAt: '2026-09-12T10:10:00Z',
    access: [
      { tenantId: MAKGADIKGADI, anyOf: null },
      { tenantId: KWU, anyOf: ['qualification.financial_review'] },
    ],
  },
  {
    id: 215,
    tenantId: KWU,
    ownerTenantId: MAKGADIKGADI,
    ownerUserId: uid('makgadikgadi.admin'),
    title: 'Quality management declaration (REQ-Q-03)',
    purpose: 'Makgadikgadi’s answer to REQ-Q-03: a declaration instead of the required ISO 9001 certificate.',
    classification: 'restricted_assessment',
    language: 'en',
    status: 'submitted',
    relatedType: 'bid_revision',
    relatedId: 303,
    relatedReference: `${RECORDS.t3.reference} / Makgadikgadi Civil Works`,
    relatedLinkPath: RECORDS.t3.buyerLink,
    supplierLinkPath: `${RECORDS.t3.supplierLink ?? '/supplier'}/response`,
    precedence: null,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(215, [
      { fileName: 'makgadikgadi-quality-declaration.pdf', sizeBytes: 96_256, at: '2026-08-28T09:00:00Z', by: 'makgadikgadi.admin' },
    ]),
    evidence: null,
    createdAt: '2026-08-28T09:00:00Z',
    updatedAt: '2026-08-28T09:00:00Z',
    access: [
      { tenantId: KWU, anyOf: ['compliance.assess', 'exclusion.approve', 'evaluation.chair'] },
      { tenantId: MAKGADIKGADI, anyOf: null },
    ],
  },
  {
    id: 216,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('masego.contracts'),
    title: 'Change request CR-0003 — Maintenance of 6 heavy tanker trucks',
    purpose: 'Scope and price of the third change to C-2026-0001; cumulative changes now exceed the officer’s authority.',
    classification: 'buyer_internal',
    language: 'en',
    status: 'submitted',
    relatedType: 'change_request',
    relatedId: 3,
    relatedReference: `${RECORDS.c1.reference} CR-0003`,
    relatedLinkPath: RECORDS.c1.buyerLink,
    supplierLinkPath: null,
    precedence: null,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(216, [
      { fileName: 'C-2026-0001-CR-0003.pdf', sizeBytes: 174_080, at: '2026-10-01T12:00:00Z', by: 'masego.contracts' },
    ]),
    evidence: null,
    createdAt: '2026-10-01T12:00:00Z',
    updatedAt: '2026-10-01T12:00:00Z',
    access: [{ tenantId: KWU, anyOf: ['contract.view', 'contract.change.approve'] }],
  },
  {
    id: 217,
    tenantId: ODC,
    ownerTenantId: ODC,
    ownerUserId: uid('officer.odc'),
    title: 'Tender package — Office cleaning services',
    purpose: 'Scope, site list and pricing schedule of T-2026-0011.',
    classification: 'public',
    language: 'en',
    status: 'published',
    relatedType: 'tender',
    relatedId: RECORDS.t11.id,
    relatedReference: RECORDS.t11.reference,
    relatedLinkPath: RECORDS.t11.buyerLink,
    supplierLinkPath: RECORDS.t11.supplierLink,
    precedence: 1,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(217, [
      { fileName: 'T-2026-0011-tender-package.pdf', sizeBytes: 1_310_720, at: '2026-09-21T07:00:00Z', by: 'officer.odc' },
    ]),
    evidence: null,
    createdAt: '2026-09-21T07:00:00Z',
    updatedAt: '2026-09-21T07:00:00Z',
    access: [PUBLIC],
  },
  {
    id: 218,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('tebogo.officer'),
    title: 'Award recommendation report — Borehole pumps Lot 1',
    purpose: 'Recommendation approved for Lot 1 (Tsodilo Engineering).',
    classification: 'restricted_assessment',
    language: 'en',
    status: 'approved',
    relatedType: 'award_recommendation',
    relatedId: 14902,
    relatedReference: `${RECORDS.t1.reference} Lot 1`,
    relatedLinkPath: RECORDS.t1.buyerLink,
    supplierLinkPath: null,
    precedence: null,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(218, [
      { fileName: 'T-2026-0001-lot1-recommendation.pdf', sizeBytes: 640_000, at: '2026-07-27T08:00:00Z', by: 'tebogo.officer' },
    ]),
    evidence: null,
    createdAt: '2026-07-27T08:00:00Z',
    updatedAt: '2026-07-27T08:00:00Z',
    access: [
      { tenantId: KWU, anyOf: ['award.recommend', 'award.approve', 'evaluation.chair'] },
      { tenantId: KWU, anyOf: ['audit.view'], download: false },
    ],
  },
  {
    id: 219,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('tebogo.officer'),
    title: 'Tender package — Chlorine dosing equipment',
    purpose: 'Invitation-only package for the invited suppliers of T-2026-0006.',
    classification: 'participating_suppliers',
    language: 'en',
    status: 'published',
    relatedType: 'tender',
    relatedId: RECORDS.t6.id,
    relatedReference: RECORDS.t6.reference,
    relatedLinkPath: RECORDS.t6.buyerLink,
    supplierLinkPath: RECORDS.t6.supplierLink,
    precedence: 1,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(219, [
      { fileName: 'T-2026-0006-tender-package.pdf', sizeBytes: 1_572_864, at: '2026-09-24T08:00:00Z', by: 'tebogo.officer' },
    ]),
    evidence: null,
    createdAt: '2026-09-24T08:00:00Z',
    updatedAt: '2026-09-24T08:00:00Z',
    access: [KWU_TENDER_TEAM, ...(TENDER_PARTICIPANTS[6] ?? []).map(supplierReaders)],
  },
  {
    id: 220,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('tebogo.officer'),
    title: 'Clarification annex — meter data interface (draft)',
    purpose: 'Draft annex for the answer to question Q-0007; the upload was never confirmed.',
    classification: 'buyer_internal',
    language: 'en',
    status: 'draft',
    relatedType: 'tender',
    relatedId: RECORDS.t2.id,
    relatedReference: RECORDS.t2.reference,
    relatedLinkPath: RECORDS.t2.buyerLink,
    supplierLinkPath: null,
    precedence: null,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(220, [
      {
        fileName: 'T-2026-0002-interface-annex.docx',
        contentType: DOCX,
        sizeBytes: 88_064,
        at: '2026-10-02T15:00:00Z',
        by: 'tebogo.officer',
        status: 'pending',
        bytesReceived: false,
        uploadExpiresAt: '2026-10-02T15:15:00Z',
      },
    ]),
    evidence: null,
    createdAt: '2026-10-02T15:00:00Z',
    updatedAt: '2026-10-02T15:00:00Z',
    access: [KWU_TENDER_TEAM],
  },
  {
    id: 221,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('tebogo.officer'),
    title: 'Delivery schedule — Smart water meter supply (withdrawn)',
    purpose: 'Withdrawn by Addendum 1; kept for the history of the tender.',
    classification: 'public',
    language: 'en',
    status: 'withdrawn',
    relatedType: 'tender',
    relatedId: RECORDS.t2.id,
    relatedReference: RECORDS.t2.reference,
    relatedLinkPath: RECORDS.t2.buyerLink,
    supplierLinkPath: RECORDS.t2.supplierLink,
    precedence: 3,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(221, [
      { fileName: 'T-2026-0002-delivery-schedule.pdf', sizeBytes: 120_832, at: '2026-09-01T07:35:00Z', by: 'tebogo.officer' },
    ]),
    evidence: null,
    createdAt: '2026-09-01T07:35:00Z',
    updatedAt: '2026-09-15T09:00:00Z',
    access: [PUBLIC],
  },
  {
    id: 222,
    tenantId: KWU,
    ownerTenantId: SEROWE,
    ownerUserId: uid('serowe-ict.bidmanager'),
    title: 'Technical response — Smart water meter supply (draft, not submitted)',
    purpose: 'Serowe ICT’s response, approved internally but not submitted: no receipt exists (AC-11).',
    classification: 'supplier_private',
    language: 'en',
    status: 'draft',
    relatedType: 'bid_revision',
    relatedId: 202,
    relatedReference: `${RECORDS.t2.reference} / Serowe ICT Solutions`,
    relatedLinkPath: null,
    supplierLinkPath: `${RECORDS.t2.supplierLink ?? '/supplier'}/response`,
    precedence: null,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(222, [
      { fileName: 'serowe-t-2026-0002-technical-v1.docx', contentType: DOCX, sizeBytes: 702_464, at: '2026-09-30T08:00:00Z', by: 'serowe-ict.contributor' },
      {
        fileName: 'serowe-t-2026-0002-technical-v2.docx',
        contentType: DOCX,
        sizeBytes: 715_776,
        at: '2026-10-03T16:40:00Z',
        by: 'serowe-ict.bidmanager',
        note: 'Internal approval comments addressed.',
      },
    ]),
    evidence: null,
    createdAt: '2026-09-30T08:00:00Z',
    updatedAt: '2026-10-03T16:40:00Z',
    access: [{ tenantId: SEROWE, anyOf: ['supplier.response.edit', 'supplier.response.approve', 'supplier.response.submit'] }],
  },
  {
    id: 223,
    tenantId: TSODILO,
    ownerTenantId: TSODILO,
    ownerUserId: uid('tsodilo.admin'),
    title: 'ISO 9001:2015 certificate',
    purpose: 'Quality management certification for pumps and mechanical works.',
    classification: 'supplier_private',
    language: 'en',
    status: 'approved',
    relatedType: 'evidence_item',
    relatedId: 403,
    relatedReference: 'Quality certification',
    relatedLinkPath: '/buyer/qualification',
    supplierLinkPath: '/supplier/evidence',
    precedence: null,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(223, [
      { fileName: 'tsodilo-iso9001-2024.pdf', sizeBytes: 254_976, at: '2024-07-01T08:00:00Z', by: 'tsodilo.admin' },
      {
        fileName: 'tsodilo-iso9001-2025.pdf',
        sizeBytes: 261_120,
        at: '2025-07-02T08:00:00Z',
        by: 'tsodilo.admin',
        note: 'Surveillance audit 2025 passed; renewed certificate.',
      },
    ]),
    evidence: {
      evidenceItemId: 403,
      issuer: 'SGS Botswana',
      periodStart: null,
      periodEnd: null,
      validFrom: '2025-07-01',
      expiresAt: '2027-06-30',
      verificationStatus: 'independently_verified',
    },
    createdAt: '2024-07-01T08:00:00Z',
    updatedAt: '2025-07-02T08:00:00Z',
    access: [
      { tenantId: TSODILO, anyOf: null },
      { tenantId: KWU, anyOf: ['qualification.review', 'qualification.decide'] },
    ],
  },
  {
    id: 224,
    tenantId: KWU,
    ownerTenantId: KWU,
    ownerUserId: uid('masego.contracts'),
    title: 'Meter reading services agreement (legacy import)',
    purpose: 'Imported from “Legacy spreadsheet 2025”; under legal hold.',
    classification: 'commercially_confidential',
    language: 'en',
    status: 'signed',
    relatedType: 'contract',
    relatedId: RECORDS.c7.id,
    relatedReference: RECORDS.c7.reference,
    relatedLinkPath: RECORDS.c7.buyerLink,
    supplierLinkPath: null,
    precedence: 1,
    isRedactedCopy: false,
    redactedFromDocumentId: null,
    versions: versions(224, [
      { fileName: 'C-2025-0007-agreement.pdf', sizeBytes: 1_998_848, at: '2026-04-10T08:00:00Z', by: 'masego.contracts' },
    ]),
    evidence: null,
    createdAt: '2026-04-10T08:00:00Z',
    updatedAt: '2026-04-10T08:00:00Z',
    access: [{ tenantId: KWU, anyOf: ['contract.view', 'records.hold.manage'] }],
  },
] satisfies FixtureDocument[]);

/** The document with `id`, or `undefined`. */
export function findFixtureDocument(id: number): FixtureDocument | undefined {
  return DOCUMENTS.find((document) => document.id === id);
}
