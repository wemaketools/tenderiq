/**
 * Contract-valid response bodies for the buyer service page tests (test data only; the application's data always
 * comes from the API). Every builder parses its result with the contract schema.
 */
import {
  BuyerSubscriptionView,
  CustomerSupportGrant,
  ImportBatchDetail,
  ImportRecordRow,
  IntegrationDetail,
  IntegrationExceptionDetail,
} from '@contracts/operations';
import type { PermissionCode } from '@contracts/permissions';

import { makeTenant, signedInSession, stateWith } from '../../test/fixtures';
import { KWU, LORATO, offboardingPlan, subscriptionDetail, supportGrant } from '../ops/testData';

export { pageOf } from '../ops/testData';

const TEBOGO = { userId: 5, fullName: 'Tebogo Molefe' };

export const ADMIN: readonly PermissionCode[] = [
  'org.integrations.manage',
  'org.imports.manage',
  'org.subscription.view',
  'org.settings.manage',
  'org.support_access.authorize',
];

export function buyerState(permissions: readonly PermissionCode[] = ADMIN) {
  return stateWith(
    signedInSession({
      activeTenant: makeTenant({ capacity: 'Organization Administrator' }, permissions),
    }),
  );
}

export const PEOPLE = [
  { userId: 3, fullName: 'Lorato Kgosi', capacity: 'Organization Administrator' },
  { userId: 5, fullName: 'Tebogo Molefe', capacity: 'Procurement Officer' },
];

export function exceptionDetail(overrides: Partial<IntegrationExceptionDetail> = {}) {
  return IntegrationExceptionDetail.parse({
    id: 901,
    connectionId: 1,
    connectionName: 'Botswana Government Gazette e-Notices',
    systemType: 'notice_portal',
    recordType: 'publication',
    recordId: 2,
    recordLabel: 'T-2026-0002 version 2 (addendum 1), external notice',
    recordLink: '/buyer/tenders/2',
    description: 'External publication failed at the Gazette gateway.',
    status: 'open',
    owner: TEBOGO,
    openedAt: '2026-09-22T09:04:00Z',
    resolvedAt: null,
    resolution: null,
    unconfirmedEffect: 'T-2026-0002 is not advertised externally for its current version.',
    history: [
      {
        id: 1,
        at: '2026-09-22T09:04:00Z',
        actor: null,
        action: 'exception.opened',
        description: 'Gateway returned HTTP 413.',
      },
    ],
    manualFallback: 'Lodge the notice with the Gazette clerk and scan the stamped receipt.',
    capabilities: { canAssign: true, canResolve: true },
    ...overrides,
  });
}

export function integrationDetail(overrides: Partial<IntegrationDetail> = {}) {
  const exception = exceptionDetail();
  return IntegrationDetail.parse({
    id: 1,
    systemType: 'notice_portal',
    name: 'Botswana Government Gazette e-Notices',
    businessOwner: TEBOGO,
    purpose: 'Publish notices and receive publication references.',
    status: 'active',
    lastConfirmedAt: '2026-09-01T08:00:00Z',
    openExceptions: 1,
    hasManualFallback: true,
    informationScope: 'Notices, amendments and award notices; publication references back.',
    recordOwnership: 'KWU owns the notice; the Gazette owns the publication reference.',
    permittedRecipients: 'Public',
    expectedTimeliness: 'Same working day',
    manualFallback: exception.manualFallback,
    contacts: [{ role: 'Gazette desk', name: 'Gazette clerk', email: 'desk@gazette.example' }],
    confirmations: [
      {
        id: 1,
        confirmedAt: '2026-09-01T08:00:00Z',
        confirmedBy: LORATO,
        note: 'All notices matched.',
      },
    ],
    recentExceptions: [
      {
        id: exception.id,
        connectionId: exception.connectionId,
        connectionName: exception.connectionName,
        systemType: exception.systemType,
        recordType: exception.recordType,
        recordId: exception.recordId,
        recordLabel: exception.recordLabel,
        recordLink: exception.recordLink,
        description: exception.description,
        status: exception.status,
        owner: exception.owner,
        openedAt: exception.openedAt,
        resolvedAt: exception.resolvedAt,
        resolution: exception.resolution,
        unconfirmedEffect: exception.unconfirmedEffect,
      },
    ],
    createdAt: '2026-01-20T08:00:00Z',
    ...overrides,
  });
}

export function importBatch(overrides: Partial<ImportBatchDetail> = {}) {
  return ImportBatchDetail.parse({
    id: 2,
    origin: 'Supplier list 2025',
    recordType: 'supplier',
    status: 'reviewing',
    sourceFileName: 'suppliers-2025.csv',
    documentId: 501,
    uploadedBy: LORATO,
    uploadedAt: '2026-09-10T08:00:00Z',
    reviewedBy: null,
    completedAt: null,
    counts: {
      total: 2,
      pending: 2,
      accepted: 0,
      rejected: 0,
      withQualityIssues: 1,
      withDuplicateCandidates: 1,
    },
    provenanceNote: 'Exported from the finance vendor master on 1 Sep 2026.',
    reviewNote: null,
    acceptanceRule:
      'Accepted rows create supplier records with their original dates and provenance.',
    capabilities: { canDecide: true, canComplete: true },
    ...overrides,
  });
}

export function importRecord(overrides: Partial<ImportRecordRow> = {}) {
  return ImportRecordRow.parse({
    id: 21,
    batchId: 2,
    rowNo: 1,
    label: 'Chobe Pipe and Valve',
    raw: { name: 'Chobe Pipe and Valve', registration: 'BW-00123' },
    originalBusinessDate: '2025-04-01',
    qualityIssues: [],
    duplicateCandidate: {
      tenantId: 5,
      slug: 'chobe-pipe',
      name: 'Chobe Pipe & Valve Supplies',
      kind: 'supplier',
    },
    duplicateReason: 'Same registration number.',
    decision: 'pending',
    decidedBy: null,
    decidedAt: null,
    decisionReason: null,
    createdEntityType: null,
    createdEntityId: null,
    createdEntityLabel: null,
    provenanceNote: null,
    ...overrides,
  });
}

export function buyerSubscription(overrides: Partial<BuyerSubscriptionView> = {}) {
  const detail = subscriptionDetail();
  const plan = offboardingPlan();
  return BuyerSubscriptionView.parse({
    subscriptionId: 2,
    planCode: 'buyer_standard',
    planName: 'Buyer Standard',
    status: 'active',
    startsAt: '2026-04-01T00:00:00Z',
    renewsAt: null,
    entitlements: detail.entitlements,
    serviceActions: detail.serviceActions,
    invoices: detail.invoices,
    optionalServices: ['Records migration'],
    contacts: [
      { role: 'Designated administrator', person: null, name: 'Wame Olebile', email: null },
    ],
    liveEvents: plan.liveEvents,
    liveContracts: plan.liveContracts,
    exportRequests: plan.exportRequest === null ? [] : [plan.exportRequest],
    offboardingPlan: plan,
    usageLimitRule: 'Usage limits never block an invited supplier’s submission.',
    capabilities: { canRequestOffboarding: false, canAgreePlan: true, canRequestExport: true },
    ...overrides,
  });
}

export function customerGrant(overrides: Partial<CustomerSupportGrant> = {}) {
  return CustomerSupportGrant.parse({
    ...supportGrant({
      status: 'requested',
      authorizedBy: null,
      startsAt: null,
      expiresAt: null,
      scope: 'specific_records',
      recordRefs: ['tender:T-2026-0003'],
    }),
    customer: KWU,
    caseReference: 'SC-2026-0001',
    caseSubject: 'Evaluator cannot see the technical criteria',
    requestedDays: 7,
    activity: [],
    ...overrides,
  });
}
