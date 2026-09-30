/**
 * Contract-valid response builders for the workspace page tests (test data only; the application's data comes
 * from the API). Every builder takes overrides.
 */
import type { ApprovalDetail, MyApprovalItem } from '@contracts/approvals';
import type { CalendarDetail, CalendarSummary, DeadlinePolicy } from '@contracts/calendars';
import type { DocumentDetail, MyDocumentItem } from '@contracts/documents';
import type {
  DeliveryException,
  NotificationEventCatalogItem,
  NotificationRuleDetail,
  NotificationRuleSummary,
} from '@contracts/notification-rules';
import type {
  NotificationItem,
  NotificationPreferences,
  NotificationSummary,
} from '@contracts/notifications';
import type { TaskDetail, TaskItem, TaskSummary } from '@contracts/tasks';

export const KWU = {
  tenantId: 2,
  tenantName: 'Kalahari Water Utilities (Pilot)',
  tenantKind: 'buyer' as const,
};
export const TSODILO = {
  tenantId: 4,
  tenantName: 'Tsodilo Engineering',
  tenantKind: 'supplier' as const,
};
export const HASH = 'a'.repeat(64);

export function page<T>(items: readonly T[], total = items.length) {
  return { items: [...items], total, page: 1, pageSize: 25 };
}

export function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: 104,
    organization: KWU,
    title: 'Approve exclusion of Makgadikgadi Civil Works',
    taskType: 'approval',
    sourceType: 'approval_request',
    sourceId: 37,
    sourceReference: 'T-2026-0003',
    sourceLinkPath: '/me/approvals/37',
    dueAt: '2026-10-03T15:00:00Z',
    priority: 'high',
    status: 'open',
    isOverdue: true,
    assignee: { userId: 4, fullName: 'Mpho Dikgang' },
    assigneeGroup: null,
    delegatedFrom: null,
    createdAt: '2026-09-29T11:00:00Z',
    allowedActions: ['complete', 'return', 'reassign'],
    sourceOwner: { userId: 10, fullName: 'Boitumelo Kgari' },
    escalationTo: { userId: 18, fullName: 'Keabetswe Nkwe' },
    ...overrides,
  };
}

export function taskDetail(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    ...task(),
    description: 'Decide the exclusion recommended by the evaluation committee.',
    escalationUser: { userId: 18, fullName: 'Keabetswe Nkwe' },
    completedAt: null,
    completedBy: null,
    outcomeNote: null,
    history: [{ at: '2026-09-29T11:00:00Z', actor: null, status: 'open', note: 'Created' }],
    ...overrides,
  };
}

export function taskSummary(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    open: 8,
    overdue: 1,
    dueSoon: 2,
    byOrganization: [{ ...KWU, open: 8, overdue: 1 }],
    ...overrides,
  };
}

export function approvalDetail(overrides: Partial<ApprovalDetail> = {}): ApprovalDetail {
  return {
    id: 33,
    subjectType: 'procurement_request',
    subjectId: 2,
    subjectReference: 'PR-2026-0002',
    subjectVersion: 1,
    contentHash: HASH,
    title: 'Approve PR-2026-0002 Chlorine analyser replacement',
    status: 'pending',
    amount: { amount: '420000.00', currency: 'BWP' },
    requestedBy: { userId: 6, fullName: 'Kagiso Phiri' },
    requestedAt: '2026-10-01T09:00:00Z',
    dueAt: '2026-10-08T15:00:00Z',
    expiresAt: null,
    decidedAt: null,
    routeMode: 'sequential',
    currentStep: null,
    isOverdue: false,
    organization: KWU,
    summary: 'Replace two chlorine analysers.',
    justification: 'The analysers are beyond repair.',
    legalEntity: null,
    category: null,
    subjectLinkPath: '/buyer/requests/2',
    currentSubjectVersion: 1,
    conditions: null,
    invalidatedReason: null,
    invalidatedAt: null,
    committee: null,
    steps: [
      {
        id: 331,
        sequence: 1,
        approver: { userId: 4, fullName: 'Mpho Dikgang' },
        committee: null,
        requiredDecisionType: 'request_approval',
        status: 'pending',
        decidedBy: null,
        actingFor: null,
        delegationId: null,
        decisionReason: null,
        conditions: null,
        decidedAt: null,
        authorityCheckedAmount: null,
      },
    ],
    evidence: [
      {
        documentId: 204,
        versionId: 2041,
        title: 'Business case',
        classification: 'buyer_internal',
        versionNo: 1,
        latestVersionNo: 2,
        isRedactedCopy: false,
      },
    ],
    decisionPermission: 'request.approve',
    conflict: {
      declarationRequired: false,
      declared: false,
      hasConflict: null,
      disposition: null,
      blocksDecision: false,
    },
    sod: { rule: null, mode: null, blocked: false, alternativeOversightNote: null },
    authority: {
      decisionType: 'request_approval',
      amount: { amount: '420000.00', currency: 'BWP' },
      sufficient: true,
      basis: 'authority_limit',
      limit: { amount: '2000000.00', currency: 'BWP' },
      delegatedFrom: null,
      conversion: null,
      missingExchangeRate: false,
      routedToNextLevel: false,
    },
    myStep: {
      stepId: 331,
      sequence: 1,
      status: 'pending',
      requiredDecisionType: 'request_approval',
      actingFor: null,
      canDecide: true,
      blockers: [],
    },
    allowedDecisions: ['approve', 'approve_with_conditions', 'reject', 'return'],
    conditionsPermitted: true,
    versionSnapshot: {
      subjectVersion: 1,
      contentHash: HASH,
      capturedAt: '2026-10-01T09:00:00Z',
      facts: [
        {
          key: 'estimatedValue',
          label: 'Estimated value',
          value: 'BWP 420,000.00',
          changedSince: false,
        },
      ],
    },
    routing: null,
    invalidation: null,
    relatedApprovals: [],
    ...overrides,
  };
}

export function myApproval(overrides: Partial<MyApprovalItem> = {}): MyApprovalItem {
  const detail = approvalDetail();
  return {
    id: detail.id,
    subjectType: detail.subjectType,
    subjectId: detail.subjectId,
    subjectReference: detail.subjectReference,
    subjectVersion: detail.subjectVersion,
    contentHash: detail.contentHash,
    title: detail.title,
    status: detail.status,
    amount: detail.amount,
    requestedBy: detail.requestedBy,
    requestedAt: detail.requestedAt,
    dueAt: detail.dueAt,
    expiresAt: null,
    decidedAt: null,
    routeMode: 'sequential',
    currentStep: detail.steps[0] ?? null,
    isOverdue: false,
    organization: KWU,
    myStep: detail.myStep,
    involvement: 'approver',
    subjectLinkPath: '/buyer/requests/2',
    ...overrides,
  };
}

export function notification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 601,
    organization: TSODILO,
    eventType: 'invitation_received',
    category: 'formal_notice',
    title: 'Invitation to respond: T-2026-0006',
    body: 'You are invited to respond.',
    sourceType: 'tender',
    sourceId: 6,
    sourceReference: 'T-2026-0006',
    linkPath: '/supplier/opportunities/6',
    mandatory: true,
    requiresAcknowledgment: true,
    createdAt: '2026-10-01T08:00:00Z',
    readAt: null,
    acknowledgedAt: null,
    noticeRecipientId: 12,
    deliveries: [
      {
        channel: 'in_app',
        status: 'delivered',
        attemptedAt: '2026-10-01T08:00:00Z',
        failureReason: null,
      },
    ],
    hasTerms: true,
    termsAcceptedAt: null,
    acknowledgedBy: null,
    deadline: { at: '2026-10-21T10:00:00Z', timeZone: 'Africa/Gaborone' },
    canAcknowledge: true,
    acknowledgeBlockedReason: null,
    ...overrides,
  };
}

export function notificationSummary(
  overrides: Partial<NotificationSummary> = {},
): NotificationSummary {
  return { unread: 1, requiresAcknowledgment: 1, byOrganization: [], ...overrides };
}

export function preferences(
  overrides: Partial<NotificationPreferences> = {},
): NotificationPreferences {
  return {
    emailEnabled: true,
    items: [
      { eventType: 'tender_issued', mandatory: true, inApp: true, email: true, digest: 'none' },
      {
        eventType: 'closing_approaching',
        mandatory: false,
        inApp: true,
        email: false,
        digest: 'none',
      },
    ],
    ...overrides,
  };
}

export function ruleSummary(
  overrides: Partial<NotificationRuleSummary> = {},
): NotificationRuleSummary {
  return {
    id: 16,
    eventType: 'closing_approaching',
    category: 'reminder',
    recipientRoles: ['interested_supplier_users'],
    mandatory: false,
    mandatoryLocked: false,
    subjectTemplate: '{{recordReference}} closes on {{officialDeadline}}',
    reminderOffsetsHours: [168, 48],
    escalateAfterHours: null,
    escalationRole: null,
    active: true,
    updatedAt: '2026-04-01T07:00:00Z',
    updatedBy: { userId: 3, fullName: 'Lorato Kgosi' },
    ...overrides,
  };
}

export function ruleDetail(
  overrides: Partial<NotificationRuleDetail> = {},
): NotificationRuleDetail {
  return {
    ...ruleSummary(),
    bodyTemplate: 'Reminder: {{recordReference}} closes on {{officialDeadline}}.',
    placeholders: [
      { name: 'recordReference', description: 'Reference of the record.', example: 'T-2026-0002' },
      { name: 'officialDeadline', description: 'The official deadline.', example: '14 Oct 2026' },
    ],
    allowedRecipientRoles: [
      'interested_supplier_users',
      'supplier_bid_manager',
      'escalation_owner',
    ],
    channels: ['in_app', 'email'],
    deliveryStats: { sent: 36, delivered: 35, failed: 1, notConfigured: 0 },
    createdAt: '2026-01-01T07:00:00Z',
    ...overrides,
  };
}

export function catalogItem(
  overrides: Partial<NotificationEventCatalogItem> = {},
): NotificationEventCatalogItem {
  return {
    eventType: 'closing_approaching',
    category: 'reminder',
    description: 'Closing approaching: official deadline and readiness reminder.',
    mandatory: false,
    defaultRecipientRoles: ['interested_supplier_users'],
    allowedRecipientRoles: ['interested_supplier_users', 'supplier_bid_manager'],
    placeholders: ruleDetail().placeholders,
    supportsReminders: true,
    ruleId: 16,
    ...overrides,
  };
}

export function deliveryException(overrides: Partial<DeliveryException> = {}): DeliveryException {
  return {
    id: 1,
    eventType: 'addendum_issued',
    title: 'Addendum 2 issued for T-2026-0002',
    channel: 'email',
    recipient: { userId: 29, fullName: 'Bakang Chobe' },
    recipientOrganization: 'Chobe Pipe & Valve Supplies',
    attemptedAt: '2026-10-02T10:00:00Z',
    failureReason: 'Mailbox unavailable',
    sourceReference: 'T-2026-0002',
    linkPath: '/buyer/tenders/2',
    deadline: { at: '2026-10-20T10:00:00Z', timeZone: 'Africa/Gaborone' },
    state: 'open',
    exceptionTaskId: 150,
    exceptionTaskStatus: 'open',
    owner: { userId: 5, fullName: 'Tebogo Molefe' },
    resolutionNote: null,
    ...overrides,
  };
}

export function documentDetail(overrides: Partial<DocumentDetail> = {}): DocumentDetail {
  return {
    id: 203,
    title: 'Technical specification',
    purpose: 'Scope of the framework.',
    classification: 'buyer_internal',
    language: 'en',
    status: 'draft',
    relatedType: 'tender',
    relatedId: 5,
    precedence: 1,
    isRedactedCopy: false,
    currentVersion: {
      id: 2034,
      documentId: 203,
      versionNo: 4,
      fileName: 'spec-v4.docx',
      contentType: 'application/pdf',
      sizeBytes: 451337,
      sha256: HASH,
      uploadStatus: 'confirmed',
      changeNote: null,
      supersedesVersionId: null,
      createdAt: '2026-10-02T13:10:00Z',
      createdBy: { userId: 5, fullName: 'Tebogo Molefe' },
      confirmedAt: '2026-10-02T13:10:00Z',
    },
    updatedAt: '2026-10-02T13:10:00Z',
    organization: KWU,
    ownerTenant: KWU,
    owner: { userId: 5, fullName: 'Tebogo Molefe' },
    relatedReference: 'T-2026-0005',
    relatedLinkPath: '/buyer/tenders/5',
    redactedFrom: null,
    redactedCopies: [],
    evidence: null,
    versionCount: 4,
    createdAt: '2026-09-08T08:00:00Z',
    capabilities: {
      canDownload: true,
      canUploadVersion: true,
      canCreateRedactedCopy: true,
      downloadBlockedReason: null,
    },
    ...overrides,
  };
}

export function myDocument(overrides: Partial<MyDocumentItem> = {}): MyDocumentItem {
  const detail = documentDetail();
  return {
    id: detail.id,
    title: detail.title,
    purpose: detail.purpose,
    classification: detail.classification,
    language: 'en',
    status: detail.status,
    relatedType: detail.relatedType,
    relatedId: detail.relatedId,
    precedence: 1,
    isRedactedCopy: false,
    currentVersion: detail.currentVersion,
    updatedAt: detail.updatedAt,
    organization: KWU,
    relatedReference: 'T-2026-0005',
    canDownload: true,
    ...overrides,
  };
}

export function calendarSummary(overrides: Partial<CalendarSummary> = {}): CalendarSummary {
  return {
    id: 1,
    name: 'Botswana Public Holidays 2026',
    timeZone: 'Africa/Gaborone',
    workingDays: [1, 2, 3, 4, 5],
    isDefault: true,
    active: true,
    status: 'approved',
    approvedBy: { userId: 4, fullName: 'Mpho Dikgang' },
    approvedAt: '2025-11-20T09:00:00Z',
    holidayCount: 1,
    activeEventCount: 2,
    updatedAt: '2025-11-20T09:00:00Z',
    createdBy: { userId: 3, fullName: 'Lorato Kgosi' },
    coverageFrom: '2026-01-01',
    coverageTo: '2026-12-28',
    ...overrides,
  };
}

export function calendarDetail(overrides: Partial<CalendarDetail> = {}): CalendarDetail {
  return {
    ...calendarSummary(),
    holidays: [{ id: 101, date: '2026-12-25', name: 'Christmas Day' }],
    usedBy: [
      { tenderId: 2, reference: 'T-2026-0002', title: 'Smart water meter supply', status: 'open' },
    ],
    capabilities: {
      canEdit: true,
      canApprove: false,
      canRetire: false,
      canSetDefault: false,
      approveBlockedReason: 'not_draft',
    },
    ...overrides,
  };
}

export function deadlinePolicy(overrides: Partial<DeadlinePolicy> = {}): DeadlinePolicy {
  return {
    officialTimeZone: 'Africa/Gaborone',
    defaultCalendar: calendarSummary(),
    reminders: [
      {
        eventType: 'closing_approaching',
        ruleId: 16,
        mandatory: false,
        active: true,
        reminderOffsetsHours: [168, 48],
        escalateAfterHours: null,
        escalationRole: null,
      },
    ],
    noticePeriodStartBasis: 'publication',
    minimumAddendumResponseWorkingDays: 5,
    calendarChangesMoveDeadlines: false,
    ...overrides,
  };
}
