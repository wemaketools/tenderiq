/**
 * Release review data of the demo tenders (BUY-13; BR-09, BR-10; AC-06): release checks per revision, release
 * approvals, material changes, correction requests, the package documents and the issued versions.
 *
 * AC-06 on T-2026-0005:
 * - approval 30 covered revision 1 and was returned (storage requirements to clarify);
 * - approval 31 covered revision 2 and was approved on 25 Sep 2026;
 * - on 28 Sep 2026 revision 3 added Lot 3 and raised the estimate from BWP 1,450,000.00 to BWP 1,920,000.00,
 *   which invalidated approval 31 and left the scope, funding and language checks to be reviewed again.
 * ODC's rules do not require a release approval, so T-2026-0011 has none. Released KWU tenders carry the
 * approval of their release revision (ids 201–210).
 */
import type { ReleaseChecksCheckArea } from '../../../contracts/enums.js';
import { RELEASE_CHECKS_CHECK_AREA } from '../../../contracts/enums.js';
import { TENANT_IDS } from '../platform.js';
import { USERS, revisionHash } from './reference.js';
import type {
  FxCorrection,
  FxMaterialChange,
  FxPackageDocument,
  FxReleaseApproval,
  FxReleaseCheck,
  FxTenderVersion,
} from './types.js';

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;

/** Who reviews each release area at KWU. */
const AREA_REVIEWERS: Record<ReleaseChecksCheckArea, number> = {
  scope: USERS.mpho,
  funding: USERS.lesego,
  terms: USERS.dineo,
  evaluation_readiness: USERS.boitumelo,
  dates: USERS.tebogo,
  accessibility: USERS.tebogo,
  languages: USERS.tebogo,
  supplier_burden: USERS.mpho,
  permissions: USERS.mpho,
  approval_authority: USERS.mpho,
};

function checks(
  tenderId: number,
  draftRevision: number,
  checkedAt: string,
  areas: readonly ReleaseChecksCheckArea[] = RELEASE_CHECKS_CHECK_AREA,
  tenantId: number = KWU,
): FxReleaseCheck[] {
  return areas.map((checkArea) => ({
    id: tenderId * 1000 + draftRevision * 20 + RELEASE_CHECKS_CHECK_AREA.indexOf(checkArea) + 1,
    tenantId,
    tenderId,
    checkArea,
    status: 'passed',
    reviewerUserId: tenantId === ODC ? USERS.officerOdc : AREA_REVIEWERS[checkArea],
    note: null,
    draftRevision,
    checkedAt,
  }));
}

export const RELEASE_CHECKS: readonly FxReleaseCheck[] = Object.freeze([
  ...checks(1, 2, '2026-06-12T10:00:00Z'),
  ...checks(2, 2, '2026-09-11T10:00:00Z'),
  ...checks(3, 2, '2026-07-16T10:00:00Z'),
  ...checks(4, 1, '2026-04-30T10:00:00Z'),
  ...checks(5, 1, '2026-09-15T08:00:00Z').map((check) =>
    check.checkArea === 'scope'
      ? { ...check, status: 'failed' as const, note: 'Storage requirements for HTH granules are unclear (REQ-T-02).' }
      : check,
  ),
  ...checks(5, 2, '2026-09-23T15:00:00Z'),
  ...checks(5, 3, '2026-09-28T10:00:00Z', [
    'terms',
    'evaluation_readiness',
    'dates',
    'accessibility',
    'supplier_burden',
    'permissions',
    'approval_authority',
  ]),
  ...checks(6, 2, '2026-09-17T10:00:00Z'),
  ...checks(7, 2, '2026-05-07T10:00:00Z'),
  ...checks(8, 2, '2026-08-20T10:00:00Z'),
  ...checks(9, 3, '2026-07-03T10:00:00Z'),
  ...checks(10, 2, '2026-02-26T10:00:00Z'),
  ...checks(11, 2, '2026-09-14T10:00:00Z', RELEASE_CHECKS_CHECK_AREA, ODC),
  ...checks(12, 1, '2026-09-24T09:00:00Z', ['supplier_burden', 'terms']),
  ...checks(12, 2, '2026-09-29T15:30:00Z', ['accessibility']).map((check) => ({
    ...check,
    status: 'failed' as const,
    note: 'The specification is a scanned image; provide an accessible text edition.',
  })),
]);

function released(
  approvalId: number,
  tenderId: number,
  subjectVersion: number,
  amount: string | null,
  requestedAt: string,
  decidedAt: string,
): FxReleaseApproval {
  return {
    approvalId,
    tenantId: KWU,
    tenderId,
    status: 'approved',
    subjectVersion,
    contentHash: revisionHash(tenderId, subjectVersion),
    amount,
    requestedBy: USERS.tebogo,
    requestedAt,
    decidedBy: USERS.mpho,
    decidedAt,
    invalidatedAt: null,
    invalidationReason: null,
  };
}

/** The release approval invalidated by the material edit of T-2026-0005 (AC-06). */
export const AC06_APPROVAL_ID = 31;

export const RELEASE_APPROVALS: readonly FxReleaseApproval[] = Object.freeze([
  released(201, 1, 2, '4850000.00', '2026-06-12T11:00:00Z', '2026-06-13T09:00:00Z'),
  released(202, 2, 2, '1280000.00', '2026-09-11T11:00:00Z', '2026-09-12T08:30:00Z'),
  released(203, 3, 2, '125000.00', '2026-07-16T11:00:00Z', '2026-07-17T09:00:00Z'),
  released(204, 4, 1, null, '2026-04-30T11:00:00Z', '2026-05-01T08:00:00Z'),
  {
    approvalId: 30,
    tenantId: KWU,
    tenderId: 5,
    status: 'returned',
    subjectVersion: 1,
    contentHash: revisionHash(5, 1),
    amount: '1450000.00',
    requestedBy: USERS.tebogo,
    requestedAt: '2026-09-15T09:00:00Z',
    decidedBy: USERS.mpho,
    decidedAt: '2026-09-18T11:30:00Z',
    invalidatedAt: null,
    invalidationReason: null,
  },
  {
    approvalId: AC06_APPROVAL_ID,
    tenantId: KWU,
    tenderId: 5,
    status: 'invalidated',
    subjectVersion: 2,
    contentHash: revisionHash(5, 2),
    amount: '1450000.00',
    requestedBy: USERS.tebogo,
    requestedAt: '2026-09-24T08:30:00Z',
    decidedBy: USERS.mpho,
    decidedAt: '2026-09-25T12:10:00Z',
    invalidatedAt: '2026-09-28T09:14:00Z',
    invalidationReason:
      'Material change in revision 3: Lot 3 (polyelectrolyte flocculant) added and the estimated value raised from BWP 1,450,000.00 to BWP 1,920,000.00.',
  },
  released(206, 6, 2, '640000.00', '2026-09-17T11:00:00Z', '2026-09-18T08:00:00Z'),
  released(207, 7, 2, '7400000.00', '2026-05-07T11:00:00Z', '2026-05-08T09:00:00Z'),
  released(208, 8, 2, '2350000.00', '2026-08-20T11:00:00Z', '2026-08-21T09:00:00Z'),
  released(209, 9, 3, '3100000.00', '2026-07-03T11:00:00Z', '2026-07-04T08:00:00Z'),
  // Requested by the departed officer, who owned T-2026-0010 at the time (AC-04 history).
  { ...released(210, 10, 2, '2850000.00', '2026-02-26T11:00:00Z', '2026-02-27T09:00:00Z'), requestedBy: USERS.former },
]);

export const MATERIAL_CHANGES: readonly FxMaterialChange[] = Object.freeze([
  {
    id: 50,
    tenantId: KWU,
    tenderId: 5,
    changedAt: '2026-09-21T09:00:00Z',
    changedBy: USERS.amantle,
    section: 'requirements',
    summary: 'REQ-T-02 now states the storage requirements for HTH granules (correction from the first review).',
    fromValue: 'Calcium hypochlorite available chlorine (65–70 %)',
    toValue: 'Calcium hypochlorite available chlorine (65–70 %) and storage requirements',
    draftRevision: 2,
    invalidatedApprovalId: null,
  },
  {
    id: 51,
    tenantId: KWU,
    tenderId: 5,
    changedAt: '2026-09-28T09:12:00Z',
    changedBy: USERS.tebogo,
    section: 'lots',
    summary: 'Lot 3 — Polyelectrolyte flocculant added, with requirement REQ-T-03 and its pricing schedule.',
    fromValue: '2 lots',
    toValue: '3 lots',
    draftRevision: 3,
    invalidatedApprovalId: AC06_APPROVAL_ID,
  },
  {
    id: 52,
    tenantId: KWU,
    tenderId: 5,
    changedAt: '2026-09-28T09:14:00Z',
    changedBy: USERS.tebogo,
    section: 'overview',
    summary: 'Estimated framework value increased.',
    fromValue: 'BWP 1,450,000.00',
    toValue: 'BWP 1,920,000.00',
    draftRevision: 3,
    invalidatedApprovalId: AC06_APPROVAL_ID,
  },
  {
    id: 60,
    tenantId: KWU,
    tenderId: 12,
    changedAt: '2026-09-29T14:20:00Z',
    changedBy: USERS.tebogo,
    section: 'lots',
    summary: 'Lot 2 — Standby generators split out of Lot 1.',
    fromValue: '1 lot',
    toValue: '2 lots',
    draftRevision: 2,
    invalidatedApprovalId: null,
  },
]);

export const CORRECTIONS: readonly FxCorrection[] = Object.freeze([
  {
    id: 71,
    tenantId: KWU,
    tenderId: 5,
    section: 'requirements',
    lotId: 502,
    note: 'Clarify the storage requirements for HTH granules in REQ-T-02.',
    assigneeUserId: USERS.amantle,
    requestedBy: USERS.mpho,
    requestedAt: '2026-09-18T11:30:00Z',
    status: 'resolved',
    resolvedAt: '2026-09-21T09:00:00Z',
  },
  {
    id: 72,
    tenantId: KWU,
    tenderId: 5,
    section: 'documents',
    lotId: null,
    note: 'Add the Setswana edition of the notice summary before release; Setswana is an accepted language.',
    assigneeUserId: USERS.tebogo,
    requestedBy: USERS.dineo,
    requestedAt: '2026-09-29T08:20:00Z',
    status: 'open',
    resolvedAt: null,
  },
  {
    id: 73,
    tenantId: KWU,
    tenderId: 12,
    section: 'evaluation_plan',
    lotId: null,
    note: 'Weights total 95. Agree the missing 5 points with the evaluation chair before the plan goes for approval.',
    assigneeUserId: USERS.tebogo,
    requestedBy: USERS.mpho,
    requestedAt: '2026-09-29T15:00:00Z',
    status: 'open',
    resolvedAt: null,
  },
]);

type DocSpec = readonly [n: number, title: string, fileName: string, classification: FxPackageDocument['classification'], options?: Partial<FxPackageDocument>];

function documents(tenderId: number, reference: string, updatedAt: string, specs: readonly DocSpec[], tenantId: number = KWU): FxPackageDocument[] {
  return specs.map(([n, title, fileName, classification, options = {}]) => ({
    documentId: 7000 + tenderId * 10 + n,
    tenantId,
    tenderId,
    title,
    fileName: `${reference}-${fileName}`,
    classification,
    language: 'en',
    precedence: null,
    versionNo: 1,
    relatedTo: 'tender',
    lotId: null,
    editionOf: null,
    updatedAt,
    ...options,
  }));
}

function standardPackage(tenderId: number, reference: string, updatedAt: string, noticeClassification: FxPackageDocument['classification'] = 'public'): FxPackageDocument[] {
  return documents(tenderId, reference, updatedAt, [
    [1, 'Notice summary', 'notice.pdf', noticeClassification],
    [2, 'Instructions to tenderers', 'instructions.pdf', 'participating_suppliers', { precedence: 2 }],
    [3, 'Specification', 'specification.pdf', 'participating_suppliers', { precedence: 3 }],
    [4, 'Draft contract', 'draft-contract.pdf', 'participating_suppliers', { precedence: 5, relatedTo: 'tender_term' }],
    [5, 'Pricing schedule workbook', 'pricing.xlsx', 'participating_suppliers', { precedence: 4 }],
    [6, 'Internal cost estimate', 'cost-estimate.xlsx', 'buyer_internal'],
  ]);
}

export const PACKAGE_DOCUMENTS: readonly FxPackageDocument[] = Object.freeze([
  ...standardPackage(1, 'T-2026-0001', '2026-07-03T08:00:00Z').map((doc) => (doc.title === 'Specification' ? { ...doc, versionNo: 2 } : doc)),
  ...standardPackage(2, 'T-2026-0002', '2026-09-24T08:00:00Z'),
  ...documents(2, 'T-2026-0002', '2026-09-24T08:00:00Z', [
    [7, 'Addendum 1 — data security declaration form', 'addendum-1.pdf', 'participating_suppliers', { precedence: 1 }],
  ]),
  ...standardPackage(3, 'T-2026-0003', '2026-07-16T08:00:00Z'),
  ...documents(4, 'T-2026-0004', '2026-04-30T08:00:00Z', [
    [1, 'Notice summary', 'notice.pdf', 'public'],
    [2, 'Request for information', 'rfi.pdf', 'public', { precedence: 1 }],
  ]),
  ...standardPackage(5, 'T-2026-0005', '2026-09-28T09:14:00Z').map((doc) =>
    doc.title === 'Specification' || doc.title === 'Pricing schedule workbook' ? { ...doc, versionNo: 3 } : doc,
  ),
  ...documents(5, 'T-2026-0005', '2026-09-28T09:14:00Z', [
    [7, 'Lot 3 product specification', 'lot-3-specification.pdf', 'participating_suppliers', { precedence: 3, relatedTo: 'lot', lotId: 503 }],
  ]),
  ...standardPackage(6, 'T-2026-0006', '2026-09-17T08:00:00Z', 'participating_suppliers'),
  ...standardPackage(7, 'T-2026-0007', '2026-05-07T08:00:00Z'),
  ...standardPackage(8, 'T-2026-0008', '2026-08-20T08:00:00Z'),
  ...standardPackage(9, 'T-2026-0009', '2026-07-03T08:00:00Z'),
  ...standardPackage(10, 'T-2026-0010', '2026-02-26T08:00:00Z'),
  ...documents(
    11,
    'T-2026-0011',
    '2026-09-14T08:00:00Z',
    [
      [1, 'Notice summary', 'notice.pdf', 'public'],
      [2, 'Request for quotation', 'rfq.pdf', 'participating_suppliers', { precedence: 1 }],
      [5, 'Price schedule', 'prices.xlsx', 'participating_suppliers', { precedence: 2 }],
    ],
    ODC,
  ),
  ...documents(12, 'T-2026-0012', '2026-09-29T14:20:00Z', [
    [1, 'Notice summary', 'notice.pdf', 'public'],
    [3, 'Specification (scanned)', 'specification-scan.pdf', 'participating_suppliers', { precedence: 3 }],
    [6, 'Internal cost estimate', 'cost-estimate.xlsx', 'buyer_internal', { precedence: 4 }],
  ]),
]);

export const TENDER_VERSIONS: readonly FxTenderVersion[] = Object.freeze([
  { tenantId: KWU, tenderId: 1, versionNo: 1, issuedAt: '2026-06-15T07:00:00Z', issuedBy: USERS.tebogo, changeSummary: 'Initial release.', addendumId: null },
  {
    tenantId: KWU,
    tenderId: 1,
    versionNo: 2,
    issuedAt: '2026-07-03T08:00:00Z',
    issuedBy: USERS.tebogo,
    changeSummary: 'Addendum 1: corrected pump duty points for Lot 1.',
    addendumId: 11,
  },
  { tenantId: KWU, tenderId: 2, versionNo: 1, issuedAt: '2026-09-14T07:00:00Z', issuedBy: USERS.tebogo, changeSummary: 'Initial release.', addendumId: null },
  {
    tenantId: KWU,
    tenderId: 2,
    versionNo: 2,
    issuedAt: '2026-09-24T08:00:00Z',
    issuedBy: USERS.tebogo,
    changeSummary:
      'Addendum 1: new mandatory OIML R49 type-approval certificate (Q-05) and submission deadline moved to 21 Oct 2026; acknowledgment and a supplement required.',
    addendumId: 21,
  },
  ...[3, 4, 6, 7, 8, 9, 10].map((tenderId) => ({
    tenantId: KWU,
    tenderId,
    versionNo: 1,
    issuedAt: {
      3: '2026-07-20T07:00:00Z',
      4: '2026-05-04T07:00:00Z',
      6: '2026-09-21T07:00:00Z',
      7: '2026-05-11T07:00:00Z',
      8: '2026-08-24T07:00:00Z',
      9: '2026-07-06T07:00:00Z',
      10: '2026-03-02T07:00:00Z',
    }[tenderId] as string,
    issuedBy: USERS.tebogo,
    changeSummary: 'Initial release.',
    addendumId: null,
  })),
  {
    tenantId: KWU,
    tenderId: 3,
    versionNo: 2,
    issuedAt: '2026-08-05T09:30:00Z',
    issuedBy: USERS.tebogo,
    changeSummary: 'Addendum 1: sites using IEC 60870-5-104; acknowledgment required.',
    addendumId: 31,
  },
  { tenantId: KWU, tenderId: 14, versionNo: 1, issuedAt: '2026-07-15T07:00:00Z', issuedBy: USERS.tebogo, changeSummary: 'Initial release.', addendumId: null },
  { tenantId: ODC, tenderId: 11, versionNo: 1, issuedAt: '2026-09-16T07:00:00Z', issuedBy: USERS.officerOdc, changeSummary: 'Initial release.', addendumId: null },
  {
    tenantId: ODC,
    tenderId: 11,
    versionNo: 2,
    issuedAt: '2026-09-20T07:00:00Z',
    issuedBy: USERS.officerOdc,
    changeSummary: 'Addendum 1: revised floor plan and submission deadline moved to 23 Oct 2026.',
    addendumId: 111,
  },
]);
