/**
 * Contract-valid response bodies for the operations page tests (test data only: the application's data always comes
 * from the API). Every builder parses its result with the contract schema so a drift fails loudly. Shared by the
 * ops, help and admin-integrations tests.
 */
import {
  AccessReviewRow,
  Announcement,
  ConductCaseRow,
  CustomerDetail,
  CustomerRow,
  HelpArticleDetail,
  IncidentDetail,
  OffboardingPlanDetail,
  OnboardingView,
  OversightSummary,
  PlanCatalog,
  SubscriptionDetail,
  SupportCaseDetail,
  SupportGrant,
} from '@contracts/operations';
import type { PermissionCode } from '@contracts/permissions';

import {
  makeMembership,
  makeTenant,
  makeUser,
  signedInSession,
  stateWith,
} from '../../test/fixtures';

export const NALEDI = { userId: 1, fullName: 'Naledi Sebego' };
export const KITSO = { userId: 2, fullName: 'Kitso Ramotswa' };
export const LORATO = { userId: 3, fullName: 'Lorato Kgosi' };
export const WAME = { userId: 22, fullName: 'Wame Olebile' };
export const KWU = {
  tenantId: 2,
  slug: 'kwu',
  name: 'Kalahari Water Utilities (Pilot)',
  kind: 'buyer' as const,
};
export const ODC = {
  tenantId: 3,
  slug: 'odc',
  name: 'Okavango District Council',
  kind: 'buyer' as const,
};

export function pageOf<T>(items: readonly T[]) {
  return { items, total: items.length, page: 1, pageSize: 25 };
}

export const OPS_ALL: readonly PermissionCode[] = [
  'ops.customers.manage',
  'ops.subscriptions.manage',
  'ops.support.manage',
  'ops.incidents.manage',
  'ops.content.manage',
  'ops.oversight.view',
];
export const SUPPORT_AGENT: readonly PermissionCode[] = [
  'ops.support.manage',
  'ops.incidents.manage',
  'ops.content.manage',
];

export function opsState(permissions: readonly PermissionCode[] = OPS_ALL) {
  return stateWith(
    signedInSession({
      authUserEmail: 'ops.admin@tenderiq.local',
      user: makeUser({
        id: 1,
        fullName: 'Naledi Sebego',
        email: 'ops.admin@tenderiq.local',
        isPlatformOperator: true,
      }),
      memberships: [
        makeMembership({
          tenantId: 1,
          tenantKind: 'operator',
          tenantName: 'TenderIQ Platform Operations',
          tenantSlug: 'tenderiq-ops',
          capacity: 'Platform Operator',
        }),
      ],
      activeTenant: makeTenant(
        {
          tenantId: 1,
          kind: 'operator',
          name: 'TenderIQ Platform Operations',
          slug: 'tenderiq-ops',
          capacity: 'Platform Operator',
          defaultCurrency: null,
        },
        permissions,
      ),
    }),
  );
}

export const STAFF = [
  { userId: 2, fullName: 'Kitso Ramotswa', capacity: 'Support Agent' },
  { userId: 1, fullName: 'Naledi Sebego', capacity: 'Platform Operator' },
];

export function customerRow(overrides: Partial<CustomerRow> = {}) {
  return CustomerRow.parse({
    tenantId: 3,
    slug: 'odc',
    kind: 'buyer',
    name: 'Okavango District Council',
    legalName: 'Okavango District Council',
    status: 'offboarding',
    onboardingStage: 'offboarding',
    planCode: 'buyer_standard',
    subscriptionStatus: 'active',
    serviceOwner: NALEDI,
    administrators: [WAME],
    openSupportCases: 1,
    activeSupportGrants: 0,
    createdAt: '2025-03-01T08:00:00Z',
    ...overrides,
  });
}

const LIVE_EVENT = {
  tenderId: 11,
  reference: 'T-2026-0011',
  title: 'Maun road resurfacing',
  withheld: false,
  status: 'open',
  submissionDeadline: { at: '2026-10-20T10:00:00Z', timeZone: 'Africa/Gaborone' },
};
const LIVE_CONTRACT = {
  contractId: 4,
  reference: 'C-2025-0004',
  title: 'Refuse collection services',
  withheld: false,
  status: 'active',
  supplierName: 'Limpopo Environmental Services',
  termEnd: '2027-03-31',
};

/** An invitation-only event as an operator sees it: reference, status and deadline, title withheld (PRD §4.3). */
const LIVE_EVENT_WITHHELD = {
  tenderId: 6,
  reference: 'T-2026-0006',
  title: null,
  withheld: true,
  status: 'open',
  submissionDeadline: { at: '2026-10-14T10:00:00Z', timeZone: 'Africa/Gaborone' },
};
/** A contract as an operator sees it without a support grant: reference, status and term end only. */
const LIVE_CONTRACT_WITHHELD = {
  contractId: 1,
  reference: 'C-2026-0001',
  title: null,
  withheld: true,
  status: 'active',
  supplierName: null,
  termEnd: '2028-06-30',
};

export function customerDetail(overrides: Partial<CustomerDetail> = {}) {
  return CustomerDetail.parse({
    ...customerRow(),
    tradingName: null,
    country: 'BW',
    registrationNumber: 'BW-LG-0031',
    officialTimeZone: 'Africa/Gaborone',
    defaultCurrency: 'BWP',
    workingLanguages: ['en'],
    usage: {
      activeUsers: 2,
      publishedEventsYtd: 4,
      liveEvents: 1,
      activeContracts: 1,
      storageUsedGb: '3.40',
      lastActivityAt: '2026-09-28T09:00:00Z',
    },
    liveEvents: [LIVE_EVENT, LIVE_EVENT_WITHHELD],
    liveContracts: [LIVE_CONTRACT_WITHHELD],
    subscriptionId: 2,
    offboardingPlanId: 1,
    contentAccessNote:
      'Operators see service metadata only; tender content stays with the customer.',
    ...overrides,
  });
}

export function onboardingView(overrides: Partial<OnboardingView> = {}) {
  return OnboardingView.parse({
    customer: {
      tenantId: 2,
      slug: 'kwu',
      name: 'Kalahari Water Utilities (Pilot)',
      kind: 'buyer',
      status: 'active',
    },
    stage: 'pilot',
    nextStage: 'live',
    serviceOwner: NALEDI,
    administrators: [LORATO],
    items: [
      {
        id: 31,
        area: 'setup',
        title: 'Service agreement signed',
        detail: null,
        status: 'done',
        owner: NALEDI,
        dueDate: '2026-02-01',
        blocking: true,
        resolvedAt: '2026-01-20T08:00:00Z',
        note: null,
      },
      {
        id: 32,
        area: 'issue',
        title: 'Publication portal connection unconfirmed',
        detail: 'External notice feed failed once.',
        status: 'blocked',
        owner: LORATO,
        dueDate: '2026-10-15',
        blocking: true,
        resolvedAt: null,
        note: 'Waiting for the portal operator.',
      },
    ],
    readiness: [
      {
        id: 'items',
        label: 'Blocking checklist items done',
        detail: '1 blocking item open',
        status: 'blocking',
      },
      { id: 'admins', label: 'Two administrators designated', detail: null, status: 'warning' },
    ],
    ...overrides,
  });
}

export function offboardingPlan(overrides: Partial<OffboardingPlanDetail> = {}) {
  return OffboardingPlanDetail.parse({
    id: 1,
    customer: {
      tenantId: 3,
      slug: 'odc',
      name: 'Okavango District Council',
      kind: 'buyer',
      status: 'offboarding',
    },
    status: 'draft',
    activeEventsCount: 1,
    activeContractsCount: 1,
    serviceEndDate: '2027-03-31',
    agreedByCustomerAt: null,
    owner: NALEDI,
    updatedAt: '2026-09-28T10:00:00Z',
    reason: 'Council moves procurement to a regional shared service.',
    continuityPlan: 'T-2026-0011 runs to award on the platform.',
    supplierAccessPlan:
      'Suppliers keep access to their bids and receipts until award plus 90 days.',
    retentionResponsibilities: 'ODC keeps the records for 7 years after export.',
    disposalTimetable: 'Platform copies disposed 90 days after the final export.',
    liveEvents: [LIVE_EVENT],
    liveContracts: [LIVE_CONTRACT],
    exportRequest: {
      id: 71,
      format: 'xlsx',
      status: 'ready',
      requestedAt: '2026-09-20T08:00:00Z',
      requestedBy: WAME,
      completedAt: '2026-09-21T08:00:00Z',
      contents: ['Tender records and notices', 'Contract register and obligations'],
      omissions: ['Unopened sealed bids'],
    },
    readiness: [
      {
        id: 'agreement',
        label: 'Customer agreement recorded',
        detail: 'ODC has not agreed yet.',
        status: 'blocking',
      },
      { id: 'export', label: 'Exit export ready', detail: null, status: 'passed' },
    ],
    nextStatus: 'agreed',
    createdAt: '2026-09-18T08:00:00Z',
    ...overrides,
  });
}

export function planCatalog() {
  return PlanCatalog.parse({
    plans: [
      {
        code: 'pilot',
        name: 'Pilot',
        description: 'A limited pilot for one contracting entity.',
        annualFee: { amount: '0.00', currency: 'BWP' },
        entitlements: [
          { featureCode: 'named_users', label: 'Named users', limitValue: 25, unit: 'users' },
          {
            featureCode: 'published_events_per_year',
            label: 'Published events per year',
            limitValue: 10,
            unit: 'events',
          },
        ],
        optionalServices: ['Onboarding workshop'],
        customers: 1,
      },
    ],
    supplierAccessNote: 'Suppliers never pay to view notices or take part.',
  });
}

export function subscriptionDetail(overrides: Partial<SubscriptionDetail> = {}) {
  return SubscriptionDetail.parse({
    id: 1,
    customer: {
      tenantId: 2,
      slug: 'kwu',
      name: 'Kalahari Water Utilities (Pilot)',
      kind: 'buyer',
      status: 'active',
    },
    planCode: 'pilot',
    status: 'active',
    startsAt: '2026-01-15T08:00:00Z',
    renewsAt: '2027-01-15T08:00:00Z',
    commercialContact: 'Lorato Kgosi',
    commercialContactEmail: 'finance@kwu.example',
    openServiceActions: 1,
    disputedInvoices: 0,
    notes: null,
    entitlements: [
      {
        featureCode: 'published_events_per_year',
        label: 'Published events per year',
        unit: 'events',
        limitValue: 10,
        usageValue: 11,
        limitReached: true,
      },
    ],
    serviceActions: [
      {
        id: 41,
        featureCode: 'published_events_per_year',
        description: 'Published events exceeded the pilot limit.',
        status: 'open',
        owner: NALEDI,
        raisedAt: '2026-09-10T08:00:00Z',
        resolvedAt: null,
        resolution: null,
        blocksSubmissions: false,
      },
    ],
    invoices: [
      {
        id: 51,
        number: 'INV-2026-0007',
        periodLabel: 'Pilot 2026',
        issuedOn: '2026-01-15',
        dueOn: '2026-02-14',
        amount: { amount: '0.00', currency: 'BWP' },
        status: 'paid',
        disputeNote: null,
      },
    ],
    optionalServices: [],
    entitlementRule: 'Entitlements never change competition results or supplier eligibility.',
    ...overrides,
  });
}

export function supportGrant(overrides: Partial<SupportGrant> = {}) {
  return SupportGrant.parse({
    id: 1,
    caseId: 1,
    caseReference: 'SC-2026-0001',
    customer: KWU,
    operator: KITSO,
    authorizedBy: LORATO,
    businessNeed: 'Check the evaluator assignment metadata of T-2026-0003.',
    scope: 'metadata_only',
    recordRefs: [],
    requestedAt: '2026-09-27T09:00:00Z',
    startsAt: '2026-09-28T07:00:00Z',
    expiresAt: '2026-10-05T07:00:00Z',
    revokedAt: null,
    status: 'active',
    statusReason: null,
    limits: ['Read-only', 'No sealed bids, drafts or scores'],
    ...overrides,
  });
}

export function supportCase(overrides: Partial<SupportCaseDetail> = {}) {
  return SupportCaseDetail.parse({
    id: 1,
    reference: 'SC-2026-0001',
    customer: KWU,
    openedBy: LORATO,
    category: 'access',
    subject: 'Evaluator cannot see the technical criteria',
    status: 'in_progress',
    assignedOperator: KITSO,
    routedTo: null,
    activeGrant: true,
    createdAt: '2026-09-27T08:10:00Z',
    updatedAt: '2026-09-29T11:45:00Z',
    closedAt: null,
    description: 'Kabo sees the tender but the Technical section shows no criteria.',
    resolution: null,
    messages: [
      {
        id: 1001,
        author: LORATO,
        authorSide: 'customer',
        body: 'Kabo sees the tender but the Technical section shows no criteria.',
        internal: false,
        createdAt: '2026-09-27T08:10:00Z',
      },
      {
        id: 1004,
        author: KITSO,
        authorSide: 'operator',
        body: 'Escalated to engineering.',
        internal: true,
        createdAt: '2026-09-29T11:45:00Z',
      },
    ],
    grants: [supportGrant()],
    activity: [
      {
        id: 5005,
        at: '2026-09-27T09:00:00Z',
        actor: KITSO,
        action: 'grant.requested',
        description: 'Access requested: metadata only, 14 days.',
      },
    ],
    capabilities: { canRequestAccess: false, canRouteToBuyer: true, canResolve: true },
    ...overrides,
  });
}

export function incidentDetail(overrides: Partial<IncidentDetail> = {}) {
  return IncidentDetail.parse({
    id: 1,
    reference: 'INC-2026-007',
    title: 'Slow document uploads',
    severity: 'high',
    status: 'resolved',
    startedAt: '2026-09-24T07:45:00Z',
    resolvedAt: '2026-09-24T08:25:00Z',
    affectedCustomers: 2,
    affectedEvents: 1,
    pendingBuyerDecisions: 1,
    description: 'Uploads took up to four minutes.',
    customerNotice: 'Uploads were slow between 09:45 and 10:25.',
    impacts: [
      {
        id: 11,
        customer: KWU,
        tenderId: 2,
        tenderReference: 'T-2026-0002',
        impactNote: 'Two suppliers reported slow uploads.',
        buyerDecisionNote: 'Deadline kept: all bids arrived on time.',
      },
      {
        id: 12,
        customer: ODC,
        tenderId: null,
        tenderReference: null,
        impactNote: 'Staff uploads delayed.',
        buyerDecisionNote: null,
      },
    ],
    timeline: [
      {
        id: 6001,
        at: '2026-09-24T07:48:00Z',
        actor: KITSO,
        action: 'status.investigating',
        description: 'Upload latency alerts; investigating the storage tier.',
      },
    ],
    decisionRule: 'The responsible buyer decides any deadline extension or restart.',
    ...overrides,
  });
}

export function oversightSummary() {
  return OversightSummary.parse({
    asOf: '2026-09-30T06:00:00Z',
    customers: { buyers: 2, suppliers: 6 },
    activeSupportGrants: 1,
    supportGrantsLast90Days: 4,
    accessReviewsDue: 1,
    openConductCases: 1,
    openIncidents: 1,
    usage: [
      {
        customer: KWU,
        activeUsers: 19,
        publishedEventsYtd: 11,
        submissionsReceivedYtd: 37,
        activeContracts: 6,
        storageUsedGb: '12.50',
        openSupportCases: 2,
        lastActivityAt: '2026-09-30T05:00:00Z',
      },
    ],
    confidentialityNote: 'Oversight shows counts only; never tender, bid or evaluation content.',
  });
}

export function accessReview(overrides: Partial<AccessReviewRow> = {}) {
  return AccessReviewRow.parse({
    id: 1,
    subject: KITSO,
    capacity: 'Support Agent',
    privileges: ['ops.support.manage'],
    grantsLast90Days: 4,
    status: 'due',
    dueOn: '2026-10-05',
    reviewer: null,
    reviewedAt: null,
    outcome: null,
    note: null,
    ...overrides,
  });
}

export function conductCase(overrides: Partial<ConductCaseRow> = {}) {
  return ConductCaseRow.parse({
    id: 1,
    reference: 'CC-2026-001',
    kind: 'service_complaint',
    customer: KWU,
    summary: 'Slow response to a support case during a submission period.',
    status: 'open',
    reportedAt: '2026-09-20T08:00:00Z',
    owner: NALEDI,
    outcome: null,
    closedAt: null,
    ...overrides,
  });
}

export function announcement(overrides: Partial<Announcement> = {}) {
  return Announcement.parse({
    id: 1,
    audience: 'all',
    title: 'Planned maintenance on 12 October',
    body: 'The service is read-only between 22:00 and 23:00.',
    language: 'en',
    status: 'draft',
    publishedAt: null,
    publishedBy: null,
    updatedAt: '2026-09-28T08:00:00Z',
    updatedBy: KITSO,
    ...overrides,
  });
}

export function helpArticle(overrides: Partial<HelpArticleDetail> = {}) {
  return HelpArticleDetail.parse({
    id: 1,
    slug: 'how-to-submit',
    title: 'How to submit a response',
    topic: 'submission',
    audience: 'supplier',
    language: 'en',
    status: 'published',
    excerpt: 'Prepare, check and submit before the official deadline.',
    publishedAt: '2026-06-01T08:00:00Z',
    updatedAt: '2026-06-01T08:00:00Z',
    updatedBy: NALEDI,
    bodyMarkdown: '## Before you start\n\nRead the tender.\n\n- Check the deadline\n- Upload files',
    ...overrides,
  });
}
