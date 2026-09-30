/**
 * Test kit of the supplier screens (supplier-org and supplier-directory): contract-valid records (parsed with the
 * contract schemas, so drift fails the test), a session with chosen permissions, and a router for the mocked `call`
 * of the API client module. Test data only; the application's data comes from the API.
 *
 * Each test file mocks the client module itself (hoisted):
 * `vi.mock('../../../api/client', async (original) => ({ ...(await original<object>()), call: vi.fn() }));`
 */
import type { ReactElement } from 'react';
import { vi } from 'vitest';

import type { AnyEndpoint } from '@contracts/endpoint';
import type { PermissionCode } from '@contracts/permissions';
import type { TenantKind } from '@contracts/common';
import {
  BANKING_NOT_COLLECTED_NOTICE,
  CategoryOption,
  ClaimInvitationView,
  DirectoryPage,
  DirectoryRow,
  DuplicateCandidate,
  DuplicateDetail,
  EvidenceDetail,
  EvidenceItem,
  EvidencePage,
  IdentityChange,
  MembershipRequestRow,
  MyMembershipRequest,
  OpsIdentityChangeDetail,
  OpsIdentityChangeRow,
  OpsRegistrationRow,
  OpsSupplierSummary,
  ReferenceOptions,
  RegistrationResult,
  RelationshipRecord,
  SharingBuyer,
  SupplierProfile,
  VerificationRequest,
} from '@contracts/suppliers';

import { ApiError, call } from '../../../api/client';
import { makeTenant, signedInSession } from '../../../test/fixtures';
import { renderWithProviders } from '../../../test/render';

// ---------------------------------------------------------------------------------------------------------
// Sessions and rendering
// ---------------------------------------------------------------------------------------------------------

export const SUPPLIER_ADMIN: PermissionCode[] = [
  'supplier.dashboard.view',
  'supplier.org.manage',
  'supplier.users.manage',
  'supplier.evidence.manage',
  'supplier.evidence.share',
];
export const SUPPLIER_FINANCE: PermissionCode[] = [
  'supplier.dashboard.view',
  'supplier.financial.view',
  'supplier.evidence.manage',
];
export const SUPPLIER_CONTRIBUTOR: PermissionCode[] = ['supplier.dashboard.view'];
export const BUYER_OFFICER: PermissionCode[] = [
  'dashboard.view',
  'supplier.directory.view',
  'supplier.relationship.manage',
  'supplier.duplicates.review',
];
export const BUYER_ASSESSOR: PermissionCode[] = ['dashboard.view', 'supplier.directory.view'];
export const OPERATOR: PermissionCode[] = ['ops.customers.manage'];

const TENANTS: Readonly<Record<TenantKind, { tenantId: number; name: string; slug: string }>> = {
  buyer: { tenantId: 2, name: 'Kalahari Water Utilities (Pilot)', slug: 'kwu' },
  supplier: { tenantId: 4, name: 'Tsodilo Engineering', slug: 'tsodilo' },
  operator: { tenantId: 1, name: 'TenderIQ Platform Operations', slug: 'tenderiq-ops' },
};

export function sessionAs(
  kind: TenantKind,
  permissions: readonly PermissionCode[],
  capacity = 'Administrator',
) {
  const tenant = TENANTS[kind];
  return signedInSession({
    activeTenant: makeTenant(
      { tenantId: tenant.tenantId, kind, name: tenant.name, slug: tenant.slug, capacity },
      permissions,
    ),
  });
}

export interface RenderPageOptions {
  readonly path: string;
  readonly route: string;
  readonly kind?: TenantKind;
  readonly permissions?: readonly PermissionCode[];
  /** Renders without a signed-in session (public pages). */
  readonly signedOut?: boolean;
}

export function renderPage(element: ReactElement, options: RenderPageOptions) {
  const session =
    options.signedOut === true
      ? undefined
      : sessionAs(options.kind ?? 'supplier', options.permissions ?? SUPPLIER_ADMIN);
  return renderWithProviders(element, {
    path: options.path,
    route: options.route,
    ...(session === undefined ? {} : { state: { session } }),
    routes: [{ path: '*', element: <p data-testid="elsewhere">elsewhere</p> }],
  });
}

// ---------------------------------------------------------------------------------------------------------
// The mocked client
// ---------------------------------------------------------------------------------------------------------

export interface RecordedCall {
  readonly id: string;
  readonly request: Record<string, unknown>;
}

type Handler = (request: Record<string, unknown>) => unknown;

/** Routes `call(endpoint, request)` by endpoint id; unrouted calls fail with 404. Returns the recorded calls. */
export function routeCalls(handlers: Record<string, Handler>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  vi.mocked(call).mockImplementation(((endpoint: AnyEndpoint, request: Record<string, unknown>) => {
    calls.push({ id: endpoint.id, request });
    const handler = handlers[endpoint.id];
    if (handler === undefined) {
      return Promise.reject(
        new ApiError({
          kind: 'not_found',
          status: 404,
          title: 'Not Found',
          endpointId: endpoint.id,
        }),
      );
    }
    try {
      return Promise.resolve(handler(request));
    } catch (error) {
      return Promise.reject(error);
    }
  }) as typeof call);
  return calls;
}

export function businessError(
  endpointId: string,
  code: string,
  status = 409,
  fieldErrors: { field: string; code: string; message: string }[] = [],
): ApiError {
  return new ApiError({
    kind: status === 422 ? 'validation' : status === 403 ? 'forbidden' : 'conflict',
    status,
    title: 'Request refused',
    code,
    detail: 'Server detail.',
    fieldErrors,
    correlationId: 'corr-1',
    endpointId,
  });
}

export function page<T>(items: readonly T[]) {
  return { items: [...items], total: items.length, page: 1, pageSize: 25 };
}

// ---------------------------------------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------------------------------------

const KWU = {
  tenantId: 2,
  tenantName: 'Kalahari Water Utilities (Pilot)',
  tenantKind: 'buyer',
} as const;
const ODC = { tenantId: 3, tenantName: 'Okavango District Council', tenantKind: 'buyer' } as const;
const TUMELO = { userId: 24, fullName: 'Tumelo Sekgoma' };
const PUMPS = {
  catalogCode: 'WTR-PUMP',
  name: 'Pumps and mechanical equipment',
  parentCode: 'WTR-INFRA',
};

export function categories() {
  return {
    items: [
      CategoryOption.parse({
        code: 'WTR-INFRA',
        name: 'Water infrastructure',
        parentCode: null,
        description: null,
      }),
      CategoryOption.parse({
        code: 'WTR-PUMP',
        name: 'Pumps and mechanical equipment',
        parentCode: 'WTR-INFRA',
        description: null,
      }),
    ],
  };
}

/** The reference lists the forms read from the API (countries, evidence currencies, default country). */
export function referenceOptions(): ReferenceOptions {
  return ReferenceOptions.parse({
    countries: [
      { code: 'BW', name: 'Botswana' },
      { code: 'ZA', name: 'South Africa' },
    ],
    currencies: [
      { code: 'BWP', name: 'Botswana pula' },
      { code: 'ZAR', name: 'South African rand' },
    ],
    defaultCountry: 'BW',
  });
}

/** Endpoint handlers for the public reference lists (categories and countries/currencies). */
export const REFERENCE_HANDLERS = {
  'public.suppliers.categoryOptions': () => categories(),
  'public.suppliers.referenceOptions': () => referenceOptions(),
} as const;

export function claimInvitation(overrides: Partial<ClaimInvitationView> = {}): ClaimInvitationView {
  return ClaimInvitationView.parse({
    state: 'pending',
    organization: {
      legalName: 'Kasane Borehole Drilling (Pty) Ltd',
      country: 'BW',
      registrationNumber: null,
      categories: [PUMPS],
    },
    invitedBy: KWU,
    contactName: 'Onkemetse Dube',
    emailHint: 'o•••@kasane-drilling.example',
    expiresAt: '2026-10-10T15:00:00Z',
    stateNote: null,
    qualificationStatus: 'not_assessed',
    bankingNotice: BANKING_NOT_COLLECTED_NOTICE,
    ...overrides,
  });
}

export function verificationRequest(
  overrides: Partial<VerificationRequest> = {},
): VerificationRequest {
  return VerificationRequest.parse({
    id: 2,
    status: 'open',
    reason: 'The certificate of incorporation does not show the current directors.',
    evidenceTypes: ['registration', 'declaration'],
    dueDate: '2026-10-09',
    requestedBy: 'TenderIQ platform operations',
    requestedAt: '2026-09-21T09:00:00Z',
    response: null,
    ...overrides,
  });
}

export function registrationResult(
  overrides: Partial<RegistrationResult> = {},
): RegistrationResult {
  return RegistrationResult.parse({
    registrationId: 901,
    legalName: 'Mahalapye Pumps (Pty) Ltd',
    organizationStatus: 'pending',
    verificationStatus: 'unverified',
    userStatus: 'invited',
    membershipStatus: 'invited',
    verificationEmailStatus: 'pending',
    qualificationStatus: 'not_assessed',
    duplicateReviewRaised: false,
    bankingCollected: false,
    nextSteps: ['Open the verification e-mail and set your password.'],
    submittedAt: '2026-09-30T08:00:00Z',
    ...overrides,
  });
}

export function myRequest(overrides: Partial<MyMembershipRequest> = {}): MyMembershipRequest {
  return MyMembershipRequest.parse({
    id: 3,
    organizationName: null,
    status: 'pending',
    message: 'I work on the telemetry team.',
    decisionNote: null,
    decidedAt: null,
    createdAt: '2026-09-25T09:00:00Z',
    ...overrides,
  });
}

export function membershipRow(overrides: Partial<MembershipRequestRow> = {}): MembershipRequestRow {
  return MembershipRequestRow.parse({
    id: 1,
    requester: { userId: 71, fullName: 'Lebo Kgotla', email: 'lebo@tsodilo.example' },
    message: 'New estimator in Gaborone.',
    status: 'pending',
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: '2026-09-24T09:00:00Z',
    ...overrides,
  });
}

export function profile(overrides: Partial<SupplierProfile> = {}): SupplierProfile {
  return SupplierProfile.parse({
    tenantId: 4,
    slug: 'tsodilo',
    legalName: 'Tsodilo Engineering (Pty) Ltd',
    tradingName: 'Tsodilo Engineering',
    country: 'BW',
    registrationJurisdiction: 'Botswana — CIPA',
    registrationNumber: 'BW00001234567',
    taxIdentifier: 'P03512345678',
    defaultCurrency: 'BWP',
    officialTimeZone: 'Africa/Gaborone',
    statuses: {
      registration: 'active',
      verification: 'identity_verified',
      isProvisional: false,
      qualification: {
        qualifiedBuyerCount: 1,
        pendingApplicationCount: 2,
        note: 'Registration is not qualification.',
      },
    },
    tradingNames: ['Tsodilo Engineering'],
    website: 'https://tsodilo.example',
    description: 'Mechanical and electrical contractor.',
    yearEstablished: 2009,
    employeeCountBand: '51–200',
    annualTurnoverBand: 'BWP 20M–50M',
    capacityOverview: 'Four installation crews.',
    ownershipDisclosure: 'Motsamai Tsodilo 60%, Boago Moremi 40%.',
    ultimateParentName: null,
    serviceAreas: ['South-East District'],
    preferredLanguages: ['en', 'tn'],
    primaryContact: TUMELO,
    locations: [
      {
        id: 401,
        name: 'Head office',
        address: 'Plot 54368, Gaborone',
        region: 'South-East',
        country: 'BW',
        isRegisteredOffice: true,
      },
    ],
    categories: [PUMPS],
    legalNameHistory: [
      {
        legalName: 'Tsodilo Engineering Services (Pty) Ltd',
        validFrom: '2009-03-02',
        validTo: '2026-03-31',
      },
      { legalName: 'Tsodilo Engineering (Pty) Ltd', validFrom: '2026-04-01', validTo: null },
    ],
    pendingIdentityChangeCount: 0,
    verificationRequests: [],
    memberOptions: [TUMELO, { userId: 25, fullName: 'Boago Moremi' }],
    buyerSharing: [{ buyer: KWU, sharedItemCount: 8 }],
    bankingCollected: false,
    bankingNotice: BANKING_NOT_COLLECTED_NOTICE,
    updatedAt: '2026-07-15T09:20:00Z',
    ...overrides,
  });
}

export function identityChange(overrides: Partial<IdentityChange> = {}): IdentityChange {
  return IdentityChange.parse({
    id: 1,
    changeType: 'legal_name',
    previousValue: 'Tsodilo Engineering Services (Pty) Ltd',
    proposedValue: 'Tsodilo Engineering (Pty) Ltd',
    reason: 'Change of name registered with CIPA.',
    evidenceDocument: { documentId: 5101, fileName: 'CIPA-change-of-name.pdf', versionNo: 1 },
    status: 'approved',
    submittedBy: TUMELO,
    submittedAt: '2026-03-05T09:10:00Z',
    reviewedBy: { userId: 1, fullName: 'Naledi Sebego' },
    reviewedAt: '2026-03-15T10:00:00Z',
    effectiveAt: '2026-04-01T00:00:00Z',
    decisionNote: 'Confirmed against CIPA.',
    ...overrides,
  });
}

export function evidenceItem(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return EvidenceItem.parse({
    id: 105,
    evidenceType: 'insurance',
    title: 'Public liability insurance 2025/26',
    issuer: 'Botswana Insurance Company',
    referenceNumber: 'BIC-PL-25-5521/E1',
    periodStart: null,
    periodEnd: null,
    reportingCurrency: null,
    isConsolidated: null,
    coverage: { amount: '5000000.00', currency: 'BWP' },
    validFrom: '2025-11-01',
    expiresAt: '2026-10-31',
    status: 'current',
    freshness: 'expiring_soon',
    verificationStatus: 'independently_verified',
    sensitivity: 'general',
    editionNo: 2,
    replacesId: 104,
    replacedById: null,
    document: { documentId: 4105, fileName: 'Public-liability-E1.pdf', versionNo: 1 },
    activeShares: [{ shareId: 5, buyer: KWU, sharedAt: '2026-07-15T09:20:00Z' }],
    submissionCount: 1,
    createdBy: TUMELO,
    createdAt: '2026-07-15T09:20:00Z',
    updatedAt: '2026-07-15T09:20:00Z',
    ...overrides,
  });
}

export function evidencePage(
  items: readonly EvidenceItem[] = [evidenceItem()],
  financialRestricted = false,
): EvidencePage {
  return EvidencePage.parse({
    ...page(items),
    financialRestricted,
    summary: { current: 7, expiringSoon: 1, expired: 0, withdrawn: 1 },
  });
}

export function evidenceDetail(overrides: Partial<EvidenceDetail> = {}): EvidenceDetail {
  const item = evidenceItem();
  return EvidenceDetail.parse({
    ...item,
    editions: [
      {
        id: 105,
        editionNo: 2,
        status: 'current',
        validFrom: '2025-11-01',
        expiresAt: '2026-10-31',
        document: item.document,
        createdAt: '2026-07-15T09:20:00Z',
      },
      {
        id: 104,
        editionNo: 1,
        status: 'replaced',
        validFrom: '2025-11-01',
        expiresAt: '2026-10-31',
        document: { documentId: 4104, fileName: 'Public-liability.pdf', versionNo: 1 },
        createdAt: '2026-02-11T10:50:00Z',
      },
    ],
    shares: [
      {
        id: 5,
        buyer: KWU,
        sharedAt: '2026-07-15T09:20:00Z',
        sharedBy: TUMELO,
        withdrawnAt: null,
        withdrawnBy: null,
      },
    ],
    submissions: [
      {
        id: 1,
        evidenceItemId: 104,
        editionNo: 1,
        buyer: KWU,
        contextType: 'bid_revision',
        contextId: 12,
        contextReference: 'T-2026-0001',
        contextTitle: 'Borehole pump replacement programme — submitted response',
        submittedAt: '2026-05-18T09:30:00Z',
      },
    ],
    ...overrides,
  });
}

export function sharingBuyers() {
  return {
    items: [
      SharingBuyer.parse({ buyer: KWU, slug: 'kwu', sharedItemCount: 8, hasParticipated: true }),
      SharingBuyer.parse({ buyer: ODC, slug: 'odc', sharedItemCount: 2, hasParticipated: false }),
    ],
  };
}

// Buyer side ---------------------------------------------------------------------------------------------

const RELATIONSHIP = {
  id: 2,
  status: 'active',
  riskRating: 'medium',
  owner: { userId: 5, fullName: 'Tebogo Molefe' },
  restrictionNote: null,
  firstEngagedAt: '2026-02-18T09:00:00Z',
  updatedAt: '2026-09-29T07:30:00Z',
} as const;

export function directoryRow(overrides: Partial<DirectoryRow> = {}): DirectoryRow {
  return DirectoryRow.parse({
    supplierTenantId: 5,
    legalName: 'Chobe Pipe & Valve Supplies (Pty) Ltd',
    tradingName: 'Chobe Pipe',
    slug: 'chobe-pipe',
    country: 'BW',
    registrationStatus: 'active',
    verificationStatus: 'identity_verified',
    isProvisional: false,
    categories: [
      { catalogCode: 'WTR-PIPE', name: 'Pipes, valves and fittings', parentCode: 'WTR-INFRA' },
    ],
    relationship: RELATIONSHIP,
    primaryContact: {
      name: 'Chedza Ramokate',
      email: 'chedza@chobe.example',
      phone: '+267 625 0201',
    },
    qualification: [
      {
        programId: 11,
        programName: 'Water Infrastructure Suppliers — Category A',
        effectiveStatus: 'qualified_with_conditions',
        scopeCategory: null,
        scopeMaxValue: { amount: '5000000.00', currency: 'BWP' },
        scopeGeography: 'Botswana',
        effectiveFrom: '2026-05-04',
        effectiveTo: '2028-05-03',
        conditions: 'Keep public liability insurance in force.',
      },
    ],
    contractCount: 0,
    evidence: {
      sharedCount: 6,
      expiringSoonCount: 1,
      expiredCount: 0,
      nextExpiry: '2026-10-08',
      worst: 'expiring_soon',
    },
    duplicateFlagged: false,
    ...overrides,
  });
}

export function directoryPage(rows: readonly DirectoryRow[] = [directoryRow()]): DirectoryPage {
  return DirectoryPage.parse({
    ...page(rows),
    ownerOptions: [
      { userId: 4, fullName: 'Mpho Dikgang' },
      { userId: 5, fullName: 'Tebogo Molefe' },
    ],
    summary: { active: 4, qualified: 3, restrictedOrSuspended: 1, evidenceExpiring: 4 },
  });
}

export function relationshipRecord(
  overrides: Partial<RelationshipRecord> = {},
): RelationshipRecord {
  return RelationshipRecord.parse({
    supplierTenantId: 5,
    legalName: 'Chobe Pipe & Valve Supplies (Pty) Ltd',
    tradingNames: ['Chobe Pipe'],
    slug: 'chobe-pipe',
    country: 'BW',
    registrationJurisdiction: 'Botswana — CIPA',
    registrationNumber: 'BW00002345678',
    registrationStatus: 'active',
    verificationStatus: 'identity_verified',
    isProvisional: false,
    createdByThisBuyer: false,
    claimInvitation: null,
    website: 'https://chobe.example',
    description: 'Pipes and valves.',
    yearEstablished: 2012,
    ownershipDisclosure: 'Chobe Holdings 75%.',
    ultimateParentName: 'Chobe Holdings (Pty) Ltd',
    serviceAreas: ['Chobe'],
    locations: [
      {
        id: 501,
        name: 'Registered office',
        address: 'Kasane',
        region: null,
        country: 'BW',
        isRegisteredOffice: true,
      },
    ],
    categories: [
      { catalogCode: 'WTR-PIPE', name: 'Pipes, valves and fittings', parentCode: 'WTR-INFRA' },
    ],
    legalNameHistory: [
      {
        legalName: 'Chobe Pipe & Valve Supplies (Pty) Ltd',
        validFrom: '2012-08-14',
        validTo: null,
      },
    ],
    identityChanges: [
      identityChange({
        id: 2,
        changeType: 'ownership',
        status: 'submitted',
        proposedValue: 'Okavango Industrial 60%',
      }),
    ],
    relationship: { ...RELATIONSHIP, internalNotes: 'Chase the insurance renewal.' },
    contacts: [
      {
        id: 3,
        name: 'Chedza Ramokate',
        email: 'chedza@chobe.example',
        phone: '+267 625 0201',
        roleLabel: 'Organization administrator',
        isPrimary: true,
        active: true,
      },
    ],
    qualification: directoryRow().qualification,
    requestablePrograms: [{ programId: 13, name: 'Metering Equipment Suppliers', category: null }],
    contracts: [
      {
        contractId: 6,
        reference: 'C-2025-0005',
        title: 'Network valve maintenance call-out services',
        status: 'suspended',
        performance: {
          reviewId: 14793,
          periodStart: '2026-04-01',
          periodEnd: '2026-06-30',
          status: 'finalized',
          overallRating: 'does_not_meet',
          supplierResponded: true,
          supplierDisputes: false,
          reviewCount: 1,
        },
      },
    ],
    sharedEvidence: [
      {
        evidenceItemId: 202,
        evidenceType: 'insurance',
        sensitivity: 'general',
        restricted: false,
        title: 'Public liability insurance 2025/26',
        issuer: 'Botswana Insurance Company',
        referenceNumber: 'BIC-PL-25-10931',
        periodStart: null,
        periodEnd: null,
        reportingCurrency: null,
        coverage: { amount: '5000000.00', currency: 'BWP' },
        validFrom: '2025-10-09',
        expiresAt: '2026-10-08',
        status: 'current',
        freshness: 'expiring_soon',
        verificationStatus: 'independently_verified',
        editionNo: 1,
        document: { documentId: 4202, fileName: 'Public-liability.pdf', versionNo: 1 },
        sharedAt: '2026-02-18T09:00:00Z',
      },
      {
        evidenceItemId: 302,
        evidenceType: 'financial_statement',
        sensitivity: 'financial',
        restricted: true,
        title: 'Financial evidence (restricted to financial reviewers)',
        issuer: null,
        referenceNumber: null,
        periodStart: null,
        periodEnd: null,
        reportingCurrency: null,
        coverage: null,
        validFrom: null,
        expiresAt: null,
        status: 'current',
        freshness: 'no_expiry',
        verificationStatus: 'supplier_provided',
        editionNo: 1,
        document: null,
        sharedAt: '2026-08-12T15:10:00Z',
      },
    ],
    evidence: {
      sharedCount: 2,
      expiringSoonCount: 1,
      expiredCount: 0,
      nextExpiry: '2026-10-08',
      worst: 'expiring_soon',
    },
    duplicateFlags: [],
    history: [
      {
        id: 9,
        at: '2026-09-02T11:00:00Z',
        eventType: 'owner_changed',
        summary: 'Owner set to Tebogo Molefe.',
        actor: { userId: 4, fullName: 'Mpho Dikgang' },
      },
    ],
    ownerOptions: [
      { userId: 4, fullName: 'Mpho Dikgang' },
      { userId: 5, fullName: 'Tebogo Molefe' },
    ],
    segregationNotice:
      'Only your organization’s relationship is shown. Other buyers’ assessments are never shown.',
    ...overrides,
  });
}

// Operator side ------------------------------------------------------------------------------------------

export function opsSupplier(overrides: Partial<OpsSupplierSummary> = {}): OpsSupplierSummary {
  return OpsSupplierSummary.parse({
    tenantId: 4,
    legalName: 'Tsodilo Engineering (Pty) Ltd',
    slug: 'tsodilo',
    status: 'active',
    verificationStatus: 'identity_verified',
    isProvisional: false,
    createdBy: null,
    country: 'BW',
    registrationNumber: 'BW00001234567',
    emailDomain: 'tsodilo.example',
    memberCount: 5,
    createdAt: '2026-02-10T08:00:00Z',
    ...overrides,
  });
}

export function duplicateCandidate(
  overrides: Partial<DuplicateCandidate> = {},
): DuplicateCandidate {
  return DuplicateCandidate.parse({
    id: 1,
    tenantA: opsSupplier(),
    tenantB: opsSupplier({
      tenantId: 52,
      legalName: 'Tsodilo Engineering Services (Pty) Ltd',
      slug: 'tsodilo-services',
      status: 'pending',
      verificationStatus: 'unverified',
      registrationNumber: 'BW00007788990',
      memberCount: 1,
    }),
    detectedReason: 'similar_name',
    status: 'open',
    raisedBy: null,
    reviewedBy: null,
    reviewedAt: null,
    note: 'Name matches the former legal name.',
    createdAt: '2026-09-20T14:05:00Z',
    ...overrides,
  });
}

export function duplicateDetail(overrides: Partial<DuplicateDetail> = {}): DuplicateDetail {
  return DuplicateDetail.parse({
    ...duplicateCandidate(),
    merge: null,
    comparison: [
      {
        field: 'Registration number',
        valueA: 'BW00001234567',
        valueB: 'BW00007788990',
        matches: false,
      },
      { field: 'Country', valueA: 'BW', valueB: 'BW', matches: true },
    ],
    guidance: 'A similar name is not enough to merge.',
    ...overrides,
  });
}

export function registrationRow(overrides: Partial<OpsRegistrationRow> = {}): OpsRegistrationRow {
  return OpsRegistrationRow.parse({
    tenantId: 52,
    legalName: 'Tsodilo Engineering Services (Pty) Ltd',
    country: 'BW',
    registrationNumber: 'BW00007788990',
    registrant: { fullName: 'Kopano Moeng', email: 'kopano@tsodilo-services.example' },
    status: 'pending',
    verificationStatus: 'contact_verified',
    verificationEmailStatus: 'send_failed',
    verificationEmailSentCount: 1,
    possibleDuplicate: true,
    categories: [PUMPS],
    evidenceRequest: null,
    createdAt: '2026-09-20T14:05:00Z',
    lastActivityAt: '2026-09-20T14:05:00Z',
    ...overrides,
  });
}

export function opsChange(overrides: Partial<OpsIdentityChangeRow> = {}): OpsIdentityChangeRow {
  return OpsIdentityChangeRow.parse({
    ...identityChange({
      id: 2,
      changeType: 'ownership',
      previousValue: 'Chobe Holdings 75%',
      proposedValue: 'Okavango Industrial 60%',
      status: 'submitted',
      reviewedBy: null,
      reviewedAt: null,
      effectiveAt: null,
      decisionNote: null,
    }),
    supplier: {
      tenantId: 5,
      legalName: 'Chobe Pipe & Valve Supplies (Pty) Ltd',
      slug: 'chobe-pipe',
      status: 'active',
    },
    ...overrides,
  });
}

export function opsChangeDetail(
  overrides: Partial<OpsIdentityChangeDetail> = {},
): OpsIdentityChangeDetail {
  return OpsIdentityChangeDetail.parse({
    ...opsChange(),
    legalNameHistory: [
      {
        legalName: 'Chobe Pipe & Valve Supplies (Pty) Ltd',
        validFrom: '2012-08-14',
        validTo: null,
      },
    ],
    otherChanges: [],
    historicSubmissionCount: 3,
    consequence: 'Approval changes the ownership declaration from the effective date.',
    ...overrides,
  });
}
