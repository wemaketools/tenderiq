import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  APPROVAL_AUTHORITY_DECISION_TYPES,
  APPROVAL_DECISION_PERMISSIONS,
  APPROVAL_REQUEST_PERMISSIONS,
  ApprovalDetail,
  DecideApprovalBody,
  MyApprovalItem,
  RequestApprovalBody,
  approvalEndpoints,
} from './approvals.js';
import { AuditEntry, EntityHistoryParams, auditEndpoints } from './audit.js';
import { AddHolidayBody, CalendarDetail, CalendarImpact, CreateCalendarBody, calendarEndpoints } from './calendars.js';
import { splitIssueMessage } from './common.js';
import {
  ConfirmUploadBody,
  CreateUploadBody,
  DocumentDetail,
  UploadEnvelope,
  documentEndpoints,
} from './documents.js';
import { endpointPermissions, validateEndpointDefinition } from './endpoint.js';
import type { AnyEndpoint } from './endpoint.js';
import { APPROVAL_REQUESTS_SUBJECT_TYPE, AUTHORITY_LIMITS_DECISION_TYPE } from './enums.js';
import {
  NotificationItem,
  NotificationSummary,
  UpdateNotificationPreferencesBody,
  notificationEndpoints,
} from './notifications.js';
import { ROLE_TEMPLATES, isPermissionCode, permissionTenantKind } from './permissions.js';
import { SessionContext, SessionContextQuery, sessionEndpoints } from './session.js';
import { TaskItem, TaskListQuery, TaskSummary, taskEndpoints } from './tasks.js';

const ENDPOINT_MAPS = {
  session: sessionEndpoints,
  tasks: taskEndpoints,
  notifications: notificationEndpoints,
  approvals: approvalEndpoints,
  documents: documentEndpoints,
  audit: auditEndpoints,
  calendars: calendarEndpoints,
} as const;

const ALL: AnyEndpoint[] = Object.values(ENDPOINT_MAPS).flatMap((map) => Object.values(map) as AnyEndpoint[]);

function codes(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => splitIssueMessage(i.message).code);
}

/** Two templates collide when a request path could match both (a static segment facing a parameter). */
function ambiguous(a: string, b: string): boolean {
  const left = a.split('/');
  const right = b.split('/');
  if (left.length !== right.length || a === b) {
    return false;
  }
  return left.every((segment, index) => {
    const other = right[index] ?? '';
    return segment === other || segment.startsWith(':') || other.startsWith(':');
  });
}

const org = { tenantId: 2, tenantName: 'Kalahari Water Utilities (Pilot)', tenantKind: 'buyer' } as const;
const tebogo = { userId: 12, fullName: 'Tebogo Officer' };
const hash = 'a'.repeat(64);

describe('shared-surface endpoints', () => {
  it('defines a non-trivial surface', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(40);
  });

  it.each(ALL.map((e) => [e.id, e] as const))('%s is a valid contract', (_id, endpoint) => {
    expect(validateEndpointDefinition(endpoint)).toEqual([]);
  });

  it('uses unique ids and unique method + path pairs', () => {
    const ids = ALL.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const routes = ALL.map((e) => `${e.method} ${e.path}`);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('has no ambiguous routes (a static segment where another route has a parameter)', () => {
    const collisions: string[] = [];
    for (const a of ALL) {
      for (const b of ALL) {
        if (a !== b && a.method === b.method && ambiguous(a.path, b.path)) {
          collisions.push(`${a.method} ${a.path} ~ ${b.path}`);
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it('declares only catalog permissions of the audience tenant kind', () => {
    for (const endpoint of ALL) {
      for (const code of endpointPermissions(endpoint)) {
        expect(isPermissionCode(code), `${endpoint.id}: ${code}`).toBe(true);
        const expected = { buyer: 'buyer', supplier: 'supplier', ops: 'operator', me: null, public: null }[
          endpoint.audience
        ];
        if (expected !== null) {
          expect(permissionTenantKind(code), `${endpoint.id}: ${code}`).toBe(expected);
        }
      }
    }
  });

  it('never lets an operator support grant (support.view) reach a command (OPS-04)', () => {
    for (const endpoint of ALL.filter((e) => e.method !== 'GET')) {
      expect(endpointPermissions(endpoint), endpoint.id).not.toContain('support.view');
    }
  });

  it('marks /me row actions as POST commands carrying the row tenant (DD-21)', () => {
    const rowActions = ALL.filter((e) => e.rowTenant === true);
    expect(rowActions.map((e) => e.id).sort()).toEqual(
      [
        'me.approvals.decide',
        'me.notifications.acknowledge',
        'me.notifications.markRead',
        'me.tasks.complete',
        'me.tasks.reassign',
        'me.tasks.return',
      ].sort(),
    );
    for (const endpoint of rowActions) {
      expect(endpoint.method).toBe('POST');
      expect(endpoint.audience).toBe('me');
    }
  });

  it('marks record-creating commands as idempotent (DD-39)', () => {
    const idempotent = ALL.filter((e) => e.idempotent === true).map((e) => e.id);
    expect(idempotent).toEqual(
      expect.arrayContaining([
        'buyer.approvals.request',
        'buyer.documents.createUpload',
        'supplier.documents.createUpload',
        'buyer.documents.createRedactedCopy',
        'buyer.calendars.create',
        'buyer.calendars.addHoliday',
      ]),
    );
  });
});

describe('session contract (DD-43)', () => {
  const context = {
    user: {
      id: 12,
      email: 'tebogo.officer@tenderiq.local',
      fullName: 'Tebogo Officer',
      phone: null,
      locale: 'en',
      displayTimeZone: 'Africa/Gaborone',
      theme: 'light',
      status: 'active',
      isPlatformOperator: false,
      lastSeenAt: null,
    },
    memberships: [
      {
        membershipId: 30,
        tenantId: 2,
        tenantKind: 'buyer',
        tenantName: 'Kalahari Water Utilities (Pilot)',
        tenantSlug: 'kwu',
        tenantStatus: 'active',
        capacity: 'Procurement Officer',
        status: 'active',
        joinedAt: '2026-01-05T08:00:00Z',
        roles: [
          {
            roleId: 5,
            code: 'procurement_officer',
            name: 'Procurement officer',
            templateCode: 'procurement_officer',
            scopeType: 'organization',
            scopeId: null,
            scopeLabel: null,
          },
        ],
      },
    ],
    activeTenant: {
      tenantId: 2,
      kind: 'buyer',
      name: 'Kalahari Water Utilities (Pilot)',
      slug: 'kwu',
      officialTimeZone: 'Africa/Gaborone',
      defaultCurrency: 'BWP',
      workingLanguages: ['en'],
      capacity: 'Procurement Officer',
      access: 'membership',
      supportGrant: null,
      permissions: [...ROLE_TEMPLATES.procurement_officer.permissions],
    },
    environment: { mode: 'prototype', appEnv: 'local' },
    serverTime: '2026-09-29T10:00:00Z',
  };

  it('parses a prototype boot context with memberships and active-tenant permissions', () => {
    expect(SessionContext.parse(context)).toEqual(context);
  });

  it('accepts the live mode for Stage B and rejects unknown modes', () => {
    expect(SessionContext.safeParse({ ...context, environment: { mode: 'live', appEnv: 'production' } }).success).toBe(
      true,
    );
    expect(SessionContext.safeParse({ ...context, environment: { mode: 'mock', appEnv: 'local' } }).success).toBe(false);
  });

  it('rejects unknown permission codes in the active tenant', () => {
    const bad = { ...context, activeTenant: { ...context.activeTenant, permissions: ['tender.fly'] } };
    expect(SessionContext.safeParse(bad).success).toBe(false);
  });

  it('parses ?tenantId= from the query string', () => {
    expect(SessionContextQuery.parse({ tenantId: '2' })).toEqual({ tenantId: 2 });
    expect(SessionContextQuery.parse({})).toEqual({});
  });
});

describe('tasks contract (COM-04)', () => {
  const task = {
    id: 101,
    organization: org,
    title: 'Approve PR-2026-0003',
    taskType: 'approval',
    sourceType: 'approval_request',
    sourceId: 44,
    sourceReference: 'PR-2026-0003',
    sourceLinkPath: '/me/approvals/44',
    dueAt: '2026-10-02T10:00:00Z',
    priority: 'high',
    status: 'open',
    isOverdue: false,
    assignee: tebogo,
    assigneeGroup: null,
    delegatedFrom: null,
    createdAt: '2026-09-28T10:00:00Z',
    allowedActions: ['return', 'reassign'],
  };

  it('parses a task labelled with its organization', () => {
    expect(TaskItem.parse(task)).toEqual(task);
    expect(TaskItem.safeParse({ ...task, organization: undefined }).success).toBe(false);
  });

  it('parses list filters from the query string', () => {
    expect(TaskListQuery.parse({ status: 'open', overdue: 'true', tenantId: '2', sort: 'dueAt' })).toMatchObject({
      status: ['open'],
      overdue: true,
      tenantId: 2,
      sort: 'dueAt',
      page: 1,
    });
  });

  it('carries open and overdue counts in the summary', () => {
    const summary = { open: 4, overdue: 1, dueSoon: 2, byOrganization: [{ ...org, open: 4, overdue: 1 }] };
    expect(TaskSummary.parse(summary)).toEqual(summary);
  });
});

describe('notifications contract (COM-06, BR-41)', () => {
  const notification = {
    id: 9001,
    organization: { tenantId: 5, tenantName: 'Tsodilo Engineering (Pty) Ltd', tenantKind: 'supplier' },
    eventType: 'addendum_issued',
    category: 'formal_notice',
    title: 'Addendum 1 to T-2026-0002',
    body: 'A new mandatory requirement was added.',
    sourceType: 'addendum',
    sourceId: 3,
    sourceReference: 'T-2026-0002',
    linkPath: '/supplier/opportunities/2',
    mandatory: true,
    requiresAcknowledgment: true,
    createdAt: '2026-09-20T09:00:00Z',
    readAt: '2026-09-20T10:00:00Z',
    acknowledgedAt: null,
    noticeRecipientId: 77,
    deliveries: [
      { channel: 'in_app', status: 'delivered', attemptedAt: '2026-09-20T09:00:01Z', failureReason: null },
      { channel: 'email', status: 'failed', attemptedAt: '2026-09-20T09:00:02Z', failureReason: 'Mailbox unavailable' },
    ],
  };

  it('keeps read and acknowledged as separate facts', () => {
    const parsed = NotificationItem.parse(notification);
    expect(parsed.readAt).not.toBeNull();
    expect(parsed.acknowledgedAt).toBeNull();
  });

  it('summarizes unread and awaiting acknowledgment', () => {
    const summary = { unread: 3, requiresAcknowledgment: 1, byOrganization: [] };
    expect(NotificationSummary.parse(summary)).toEqual(summary);
  });

  it('requires at least one preference in an update', () => {
    expect(UpdateNotificationPreferencesBody.safeParse({ items: [] }).success).toBe(false);
    expect(
      UpdateNotificationPreferencesBody.safeParse({
        items: [{ eventType: 'closing_approaching', inApp: true, email: false, digest: 'daily' }],
      }).success,
    ).toBe(true);
  });
});

describe('approvals contract (COM-05, DD-24)', () => {
  it('maps every approval subject type to an existing buyer decision permission and request permission', () => {
    for (const subject of APPROVAL_REQUESTS_SUBJECT_TYPE) {
      const decide = APPROVAL_DECISION_PERMISSIONS[subject];
      const request = APPROVAL_REQUEST_PERMISSIONS[subject];
      expect(permissionTenantKind(decide), subject).toBe('buyer');
      expect(permissionTenantKind(request), subject).toBe('buyer');
      const authority = APPROVAL_AUTHORITY_DECISION_TYPES[subject];
      if (authority !== null) {
        expect(AUTHORITY_LIMITS_DECISION_TYPE).toContain(authority);
      }
    }
  });

  it('uses every authority decision type for some subject', () => {
    const used = new Set(Object.values(APPROVAL_AUTHORITY_DECISION_TYPES));
    for (const decisionType of AUTHORITY_LIMITS_DECISION_TYPE) {
      expect(used.has(decisionType), decisionType).toBe(true);
    }
  });

  it('lets each decision permission be held together with approval.decide by some template', () => {
    const templates = Object.values(ROLE_TEMPLATES).map((t) => new Set<string>(t.permissions));
    for (const permission of new Set(Object.values(APPROVAL_DECISION_PERMISSIONS))) {
      const holder = templates.some((t) => t.has('approval.decide') && t.has(permission));
      const orgAdminApproval = permission.startsWith('org.');
      expect(holder || orgAdminApproval, permission).toBe(true);
    }
  });

  it('requires a reason to reject or return and conditions to approve with conditions', () => {
    const base = { subjectVersion: 2, contentHash: hash };
    expect(codes(DecideApprovalBody, { ...base, decision: 'approve' })).toEqual([]);
    expect(codes(DecideApprovalBody, { ...base, decision: 'reject' })).toEqual(['REASON_REQUIRED']);
    expect(codes(DecideApprovalBody, { ...base, decision: 'return', reason: 'Scope unclear' })).toEqual([]);
    expect(codes(DecideApprovalBody, { ...base, decision: 'approve_with_conditions', reason: 'OK' })).toEqual([
      'CONDITIONS_REQUIRED',
    ]);
    expect(codes(DecideApprovalBody, { ...base, decision: 'approve', conditions: 'x' })).toEqual([
      'CONDITIONS_NOT_EXPECTED',
    ]);
    expect(codes(DecideApprovalBody, { ...base, decision: 'approve', contentHash: 'abc' })).toEqual(['INVALID_HASH']);
  });

  it('targets an exact version with a hash, and a justification, when requesting', () => {
    const body = {
      subjectType: 'procurement_request',
      subjectId: 3,
      subjectVersion: 1,
      contentHash: hash,
      title: 'PR-2026-0003 approval',
      amount: { amount: '2500000.00', currency: 'BWP' },
      justification: 'Borehole pumps at end of life.',
    };
    expect(RequestApprovalBody.safeParse(body).success).toBe(true);
    expect(codes(RequestApprovalBody, { ...body, justification: ' ' })).toEqual(['REASON_REQUIRED']);
    expect(RequestApprovalBody.safeParse({ ...body, amount: { amount: 2500000, currency: 'BWP' } }).success).toBe(false);
  });

  it('parses a decision screen with authority routed to the next level (AC-05)', () => {
    const step = {
      id: 1,
      sequence: 1,
      approver: { userId: 20, fullName: 'Keabetswe Approver' },
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
    };
    const detail = {
      id: 44,
      subjectType: 'procurement_request',
      subjectId: 3,
      subjectReference: 'PR-2026-0003',
      subjectVersion: 1,
      contentHash: hash,
      title: 'PR-2026-0003 approval',
      status: 'pending',
      amount: { amount: '2500000.00', currency: 'BWP' },
      requestedBy: { userId: 15, fullName: 'Kagiso Requester' },
      requestedAt: '2026-09-25T08:00:00Z',
      dueAt: '2026-10-02T15:00:00Z',
      expiresAt: null,
      decidedAt: null,
      routeMode: 'sequential',
      currentStep: step,
      isOverdue: false,
      organization: org,
      summary: 'Replacement of borehole pumps.',
      justification: 'End of life.',
      legalEntity: { legalEntityId: 1, name: 'Kalahari Water Utilities Corporation' },
      category: { categoryId: 4, name: 'Pumps' },
      subjectLinkPath: '/buyer/requests/3',
      currentSubjectVersion: 1,
      conditions: null,
      invalidatedReason: null,
      invalidatedAt: null,
      committee: null,
      steps: [step],
      evidence: [],
      decisionPermission: 'request.approve',
      conflict: { declarationRequired: false, declared: false, hasConflict: null, disposition: null, blocksDecision: false },
      sod: { rule: 'requester_vs_request_approval', mode: 'enforced', blocked: false, alternativeOversightNote: null },
      authority: {
        decisionType: 'request_approval',
        amount: { amount: '2500000.00', currency: 'BWP' },
        sufficient: true,
        basis: 'authority_limit',
        limit: { amount: '10000000.00', currency: 'BWP' },
        delegatedFrom: null,
        conversion: null,
        missingExchangeRate: false,
        routedToNextLevel: true,
      },
      myStep: {
        stepId: 1,
        sequence: 1,
        status: 'pending',
        requiredDecisionType: 'request_approval',
        actingFor: null,
        canDecide: true,
        blockers: [],
      },
      allowedDecisions: ['approve', 'approve_with_conditions', 'reject', 'return'],
    };
    expect(ApprovalDetail.parse(detail)).toEqual(detail);
    expect(MyApprovalItem.safeParse(detail).success).toBe(true);
    expect(ApprovalDetail.safeParse({ ...detail, decisionPermission: 'request.fly' }).success).toBe(false);
  });
});

describe('documents contract (COM-07)', () => {
  const version = {
    id: 501,
    documentId: 50,
    versionNo: 2,
    fileName: 'tender-package-v2.pdf',
    contentType: 'application/pdf',
    sizeBytes: 482113,
    sha256: hash,
    uploadStatus: 'confirmed',
    changeNote: 'Addendum 1 applied',
    supersedesVersionId: 500,
    createdAt: '2026-09-18T08:00:00Z',
    createdBy: tebogo,
    confirmedAt: '2026-09-18T08:00:05Z',
  };
  const summary = {
    id: 50,
    title: 'Tender package',
    purpose: 'Issued tender documents',
    classification: 'participating_suppliers',
    language: 'en',
    status: 'published',
    relatedType: 'tender',
    relatedId: 2,
    precedence: 1,
    isRedactedCopy: false,
    currentVersion: version,
    updatedAt: '2026-09-18T08:00:05Z',
  };

  it('parses a document with owner, classification, versions and redaction links', () => {
    const detail = {
      ...summary,
      organization: org,
      ownerTenant: org,
      owner: tebogo,
      relatedReference: 'T-2026-0002',
      relatedLinkPath: '/buyer/tenders/2',
      redactedFrom: null,
      redactedCopies: [{ documentId: 51, title: 'Tender package (public)', classification: 'public', status: 'published' }],
      evidence: null,
      versionCount: 2,
      createdAt: '2026-09-01T08:00:00Z',
      capabilities: { canDownload: true, canUploadVersion: true, canCreateRedactedCopy: true },
    };
    expect(DocumentDetail.parse(detail)).toEqual(detail);
  });

  it('validates the upload envelope request', () => {
    const body = {
      relatedType: 'bid_revision',
      relatedId: 900,
      title: 'Method statement',
      classification: 'sealed',
      fileName: 'method.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      sha256: hash,
    };
    expect(CreateUploadBody.parse(body)).toMatchObject({ language: 'en' });
    expect(codes(CreateUploadBody, { ...body, fileName: '../etc/passwd' })).toContain('INVALID_FILE_NAME');
    expect(codes(CreateUploadBody, { ...body, contentType: 'application/x-msdownload' })).toContain(
      'CONTENT_TYPE_NOT_ALLOWED',
    );
    expect(codes(CreateUploadBody, { ...body, sizeBytes: 0 })).toContain('EMPTY_FILE');
    expect(codes(CreateUploadBody, { ...body, sizeBytes: 60_000_000 })).toContain('FILE_TOO_LARGE');
    expect(ConfirmUploadBody.safeParse({ sha256: hash, sizeBytes: 1024 }).success).toBe(true);
  });

  it('returns a pending version with a PUT upload target', () => {
    const envelope = {
      document: { ...summary, currentVersion: null, status: 'draft' },
      version: { ...version, uploadStatus: 'pending', confirmedAt: null },
      upload: { url: '/storage/v1/object/upload/sign/x', method: 'PUT', headers: {}, expiresAt: '2026-09-18T08:15:00Z' },
    };
    expect(UploadEnvelope.parse(envelope)).toEqual(envelope);
    expect(UploadEnvelope.safeParse({ ...envelope, upload: { ...envelope.upload, method: 'POST' } }).success).toBe(false);
  });
});

describe('audit contract (DD-31)', () => {
  it('parses a redacted restricted entry without before/after state', () => {
    const entry = {
      id: 1,
      occurredAt: '2026-09-21T10:00:00Z',
      actor: { userId: 30, fullName: 'Thato Evaluator', capacity: 'Evaluator' },
      actorCapacity: 'Evaluator',
      onBehalfOf: null,
      delegationId: null,
      supportGrantId: null,
      action: 'evaluation_score.submitted',
      entityType: 'evaluation_score',
      entityId: 77,
      reason: null,
      beforeState: null,
      afterState: null,
      correlationId: 'corr-1',
      sensitivity: 'restricted',
      redacted: true,
    };
    expect(AuditEntry.parse(entry)).toEqual(entry);
  });

  it('keeps JSON before/after snapshots for normal entries', () => {
    const entry = AuditEntry.parse({
      id: 2,
      occurredAt: '2026-09-21T10:00:00Z',
      actor: null,
      actorCapacity: null,
      onBehalfOf: null,
      delegationId: null,
      supportGrantId: null,
      action: 'tender.published',
      entityType: 'tender',
      entityId: 2,
      reason: null,
      beforeState: { status: 'ready' },
      afterState: { status: 'open', version: 1 },
      correlationId: null,
      sensitivity: 'normal',
      redacted: false,
    });
    expect(entry.afterState).toEqual({ status: 'open', version: 1 });
  });

  it('validates entity types in the path', () => {
    expect(EntityHistoryParams.parse({ entityType: 'tender', entityId: '2' })).toEqual({ entityType: 'tender', entityId: 2 });
    expect(codes(EntityHistoryParams, { entityType: 'Tender;DROP', entityId: '2' })).toContain('INVALID_ENTITY_TYPE');
  });
});

describe('calendars contract (ADM-10, BR-12)', () => {
  it('validates working days and time zones on create', () => {
    expect(CreateCalendarBody.safeParse({ name: 'Botswana Public Holidays 2026', timeZone: 'Africa/Gaborone', workingDays: [1, 2, 3, 4, 5] }).success).toBe(true);
    expect(codes(CreateCalendarBody, { name: 'X', timeZone: 'Africa/Gaborone', workingDays: [] })).toContain(
      'WORKING_DAYS_REQUIRED',
    );
    expect(codes(CreateCalendarBody, { name: 'X', timeZone: 'Africa/Gaborone', workingDays: [1, 8] })).toContain(
      'INVALID_WEEKDAY',
    );
    expect(codes(CreateCalendarBody, { name: 'X', timeZone: 'Africa/Gaborone', workingDays: [1, 1] })).toContain(
      'DUPLICATE_WEEKDAY',
    );
    expect(codes(CreateCalendarBody, { name: 'X', timeZone: 'GMT+2', workingDays: [1] })).toContain('INVALID_TIME_ZONE');
  });

  it('defaults the impact-review confirmation to false when adding a holiday', () => {
    expect(AddHolidayBody.parse({ date: '2026-12-26', name: 'Family Day' })).toEqual({
      date: '2026-12-26',
      name: 'Family Day',
      impactReviewed: false,
    });
  });

  it('parses a calendar with holidays, usage and an impact review with official deadlines', () => {
    const detail = {
      id: 1,
      name: 'Botswana Public Holidays 2026',
      timeZone: 'Africa/Gaborone',
      workingDays: [1, 2, 3, 4, 5],
      isDefault: true,
      active: true,
      status: 'approved',
      approvedBy: tebogo,
      approvedAt: '2026-01-10T08:00:00Z',
      holidayCount: 1,
      activeEventCount: 1,
      updatedAt: '2026-01-10T08:00:00Z',
      holidays: [{ id: 1, date: '2026-09-30', name: 'Botswana Day' }],
      usedBy: [{ tenderId: 2, reference: 'T-2026-0002', title: 'Smart water meter supply', status: 'open' }],
      capabilities: { canEdit: true, canApprove: false, canRetire: false, canSetDefault: false },
    };
    expect(CalendarDetail.parse(detail)).toEqual(detail);
    const impact = {
      calendarId: 1,
      requiresReview: true,
      items: [
        {
          tenderId: 2,
          reference: 'T-2026-0002',
          title: 'Smart water meter supply',
          status: 'open',
          lotId: null,
          milestone: 'submission_deadline',
          deadline: { at: '2026-10-14T10:00:00Z', timeZone: 'Africa/Gaborone' },
          workingDaysBefore: 10,
          workingDaysAfter: 9,
          fallsOnNonWorkingDay: false,
        },
      ],
    };
    expect(CalendarImpact.parse(impact)).toEqual(impact);
  });
});
