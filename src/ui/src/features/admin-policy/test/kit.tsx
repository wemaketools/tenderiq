/**
 * Test kit of the policy screens: contract-valid records (parsed with the contract schemas), a session with chosen
 * permissions, and a router for the mocked `call` of the API client module.
 *
 * Each test file mocks the client module itself (hoisted):
 * `vi.mock('../../../api/client', async (original) => ({ ...(await original<object>()), call: vi.fn() }));`
 */
import type { ReactElement } from 'react';
import { vi } from 'vitest';

import type { PermissionCode } from '@contracts/permissions';
import {
  CustomFieldDetail,
  CustomFieldForm,
  CustomFieldPage,
  PolicyProfileDetail,
  PolicyProfilePage,
  PolicyVersionComparison,
  PolicyVersionDetail,
  PortalPolicy,
  PublicPortalPolicy,
  TemplateAuthoringOptions,
  TemplateDetail,
  TemplatePage,
} from '@contracts/policy';
import type { AnyEndpoint } from '@contracts/endpoint';

import { ApiError, call } from '../../../api/client';
import { makeTenant, signedInSession } from '../../../test/fixtures';
import { renderWithProviders } from '../../../test/render';

export const ADMIN_PERMISSIONS: PermissionCode[] = [
  'org.settings.manage',
  'org.policy.manage',
  'org.policy.approve',
  'org.templates.manage',
  'org.templates.approve',
  'org.fields.manage',
  'org.portal.manage',
];

export function sessionWith(
  permissions: readonly PermissionCode[],
  capacity = 'Organization Administrator',
) {
  return signedInSession({ activeTenant: makeTenant({ capacity }, permissions) });
}

export interface RenderPageOptions {
  readonly path: string;
  readonly route: string;
  readonly permissions?: readonly PermissionCode[];
}

export function renderPage(element: ReactElement, options: RenderPageOptions) {
  return renderWithProviders(element, {
    path: options.path,
    route: options.route,
    state: { session: sessionWith(options.permissions ?? ADMIN_PERMISSIONS) },
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

// ---------------------------------------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------------------------------------

const lorato = { userId: 3, fullName: 'Lorato Kgosi' };
const mpho = { userId: 4, fullName: 'Mpho Dikgang' };

const rules = {
  permittedProcedures: ['open', 'restricted'],
  requiresReleaseApproval: true,
  stagedOpeningDefault: true,
  openingQuorum: 2,
  openingRequiresSecondPerson: true,
  independentEvaluation: true,
  negotiationPermitted: false,
  bafoPermitted: false,
  lateSubmissionPolicy: 'reject',
  questionDeadlineDaysBeforeClose: 10,
  minResponseDays: 28,
  standstillRequired: true,
  standstillLength: 10,
  standstillDayType: 'working',
  complaintWindowDays: 14,
  complaintRequiresIndependentReview: true,
  publicAwardNoticeRequired: true,
  approvalRouteNote: 'Procurement Manager up to BWP 2,000,000.00.',
  thresholds: [
    {
      id: 1,
      procedure: 'open',
      minValue: '0.00',
      maxValue: null,
      currency: 'BWP',
      requiredApprovalLevel: 'Procurement Manager',
      requiresPublicNotice: true,
    },
  ],
};

function versionSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: 2,
    profileId: 1,
    versionNo: 2,
    status: 'approved',
    isCurrent: true,
    createdBy: lorato,
    createdAt: '2026-06-02T08:00:00Z',
    submittedBy: lorato,
    submittedAt: '2026-06-10T08:00:00Z',
    approvedBy: mpho,
    approvedAt: '2026-06-24T08:00:00Z',
    effectiveFrom: '2026-07-01T00:00:00Z',
    retiredAt: null,
    usageCount: 4,
    ...overrides,
  };
}

export function profileSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Standard competitive tendering',
    description: 'Open and restricted tenders.',
    status: 'active',
    currentVersion: versionSummary(),
    pendingVersion: versionSummary({
      id: 3,
      versionNo: 3,
      status: 'in_review',
      isCurrent: false,
      approvedBy: null,
      approvedAt: null,
      effectiveFrom: null,
      usageCount: 0,
    }),
    versionCount: 3,
    permittedProcedures: ['open', 'restricted'],
    usageCount: 5,
    createdAt: '2025-11-03T08:00:00Z',
    updatedAt: '2026-09-22T08:00:00Z',
    ...overrides,
  };
}

export function profilePage(items: unknown[] = [profileSummary()]): PolicyProfilePage {
  return PolicyProfilePage.parse({ items, total: items.length, page: 1, pageSize: 25 });
}

export function profileDetail(overrides: Record<string, unknown> = {}): PolicyProfileDetail {
  const summary = profileSummary();
  return PolicyProfileDetail.parse({
    ...summary,
    versions: [summary.pendingVersion, summary.currentVersion],
    retiredAt: null,
    retirementReason: null,
    capabilities: { canDraftVersion: false, canRetire: false },
    ...overrides,
  });
}

export function versionDetail(overrides: Record<string, unknown> = {}): PolicyVersionDetail {
  return PolicyVersionDetail.parse({
    ...versionSummary({
      id: 3,
      versionNo: 3,
      status: 'in_review',
      isCurrent: false,
      approvedBy: null,
      approvedAt: null,
      effectiveFrom: null,
      usageCount: 1,
      submittedBy: mpho,
    }),
    profileName: 'Standard competitive tendering',
    profileStatus: 'active',
    rules,
    approvalRequestId: null,
    returnedReason: null,
    tenders: [
      {
        tenderId: 3,
        reference: 'T-2026-0003',
        title: 'SCADA telemetry upgrade',
        status: 'under_assessment',
        frozen: true,
        releasedAt: '2026-06-15T07:00:00Z',
      },
      {
        tenderId: 5,
        reference: 'T-2026-0005',
        title: 'Water treatment chemicals framework',
        status: 'awaiting_release_approval',
        frozen: false,
        releasedAt: null,
      },
    ],
    strategies: [],
    capabilities: {
      canEdit: false,
      canSubmit: false,
      canApprove: true,
      canReturn: true,
      canRetire: false,
      approvalBlockedReason: null,
      alternativeOversightNote: null,
    },
    ...overrides,
  });
}

export function comparison(): PolicyVersionComparison {
  return PolicyVersionComparison.parse({
    profileId: 1,
    base: versionSummary(),
    target: versionSummary({ id: 3, versionNo: 3, status: 'in_review', isCurrent: false }),
    changes: [{ rule: 'Minimum response period (days)', before: '21', after: '28' }],
  });
}

export function fieldSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: 2,
    entityType: 'procurement_request',
    key: 'is_emergency',
    label: 'Emergency procurement',
    purpose: 'Flags a request raised under an emergency.',
    fieldType: 'boolean',
    allowedValues: [],
    requiredMode: 'optional',
    requiredConditionField: null,
    requiredConditionValue: null,
    audience: 'buyer_internal',
    sortOrder: 1,
    includeInReports: true,
    active: true,
    valueCount: 10,
    issuedRecordCount: 4,
    updatedAt: '2026-09-01T08:00:00Z',
    updatedBy: lorato,
    ...overrides,
  };
}

export const JUSTIFICATION = fieldSummary({
  id: 3,
  key: 'emergency_justification',
  label: 'Emergency justification',
  purpose: 'Records why the need cannot wait.',
  fieldType: 'text',
  requiredMode: 'conditional',
  requiredConditionField: 'is_emergency',
  requiredConditionValue: 'true',
  sortOrder: 2,
  issuedRecordCount: 0,
});

export function fieldPage(items: unknown[] = [fieldSummary(), JUSTIFICATION]): CustomFieldPage {
  return CustomFieldPage.parse({ items, total: items.length, page: 1, pageSize: 25 });
}

export function fieldDetail(overrides: Record<string, unknown> = {}): CustomFieldDetail {
  return CustomFieldDetail.parse({
    ...fieldSummary(),
    createdAt: '2026-01-10T08:00:00Z',
    createdBy: lorato,
    dependents: [
      {
        id: 3,
        key: 'emergency_justification',
        label: 'Emergency justification',
        requiredConditionValue: 'true',
      },
    ],
    history: [{ at: '2026-09-01T08:00:00Z', by: lorato, summary: 'Included in reports.' }],
    capabilities: {
      canEdit: true,
      structureLocked: true,
      canDeactivate: true,
      canReactivate: false,
    },
    ...overrides,
  });
}

export function requestForm(): CustomFieldForm {
  const strip = (field: Record<string, unknown>) => {
    const {
      includeInReports: _reports,
      active: _active,
      valueCount: _values,
      issuedRecordCount: _issued,
      updatedAt: _updatedAt,
      updatedBy: _updatedBy,
      ...definition
    } = field;
    return definition;
  };
  return CustomFieldForm.parse({
    entityType: 'procurement_request',
    fields: [strip(fieldSummary()), strip(JUSTIFICATION)],
    coreConditionSources: ['category_code', 'procedure', 'value_band'],
  });
}

function templateVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    templateId: 3,
    versionNo: 1,
    versionStatus: 'approved',
    isCurrent: true,
    changeNote: 'First issue.',
    createdBy: lorato,
    createdAt: '2025-11-15T08:00:00Z',
    submittedBy: mpho,
    submittedAt: '2025-11-20T08:00:00Z',
    approvedBy: lorato,
    approvedAt: '2025-12-01T08:00:00Z',
    ...overrides,
  };
}

export function templateSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    kind: 'criteria_set',
    name: 'Weighted technical and price criteria (70/30)',
    procedure: 'open',
    category: null,
    audience: 'supplier_visible',
    owner: { userId: 10, fullName: 'Boitumelo Kgari' },
    status: 'approved',
    effectiveFrom: '2025-12-01T08:00:00Z',
    reviewDate: '2026-12-31',
    reviewOverdue: false,
    currentVersionNo: 1,
    pendingVersionNo: 2,
    usageCount: 2,
    selectable: true,
    updatedAt: '2026-09-21T08:00:00Z',
    ...overrides,
  };
}

export function templatePage(items: unknown[] = [templateSummary()]): TemplatePage {
  return TemplatePage.parse({ items, total: items.length, page: 1, pageSize: 25 });
}

export function templateDetail(overrides: Record<string, unknown> = {}): TemplateDetail {
  const pending = templateVersion({
    id: 6,
    versionNo: 2,
    versionStatus: 'in_review',
    isCurrent: false,
    changeNote: 'Adds a local content criterion.',
    approvedBy: null,
    approvedAt: null,
  });
  return TemplateDetail.parse({
    ...templateSummary(),
    sourceTenderId: null,
    createdAt: '2025-11-15T08:00:00Z',
    retiredAt: null,
    retirementReason: null,
    versions: [pending, templateVersion()],
    focusVersion: {
      ...pending,
      bodyMarkdown: '# Evaluation criteria\n\n1. Technical approach\n2. Price',
      checklistItems: [],
      returnedReason: null,
      approvalRequestId: null,
    },
    usage: [
      {
        recordType: 'tender',
        recordId: 3,
        reference: 'T-2026-0003',
        title: 'SCADA telemetry upgrade',
        adoptedVersionNo: 1,
        adoptedAt: '2026-05-22T09:00:00Z',
      },
    ],
    capabilities: {
      canEdit: true,
      canDraftVersion: false,
      canSubmit: false,
      canApprove: true,
      canReturn: true,
      canRetire: true,
      approvalBlockedReason: null,
      alternativeOversightNote: null,
    },
    ...overrides,
  });
}

export function authoringOptions(): TemplateAuthoringOptions {
  return TemplateAuthoringOptions.parse({
    owners: [
      { userId: 3, fullName: 'Lorato Kgosi', capacity: 'Organization Administrator' },
      { userId: 5, fullName: 'Tebogo Molefe', capacity: 'Procurement Officer' },
    ],
    categories: [{ categoryId: 1, code: 'WTR-INFRA', name: 'Water infrastructure' }],
  });
}

const NOTICE_FIELDS = [
  ['reference', 'Reference', true],
  ['title', 'Title', true],
  ['buyer_name', 'Buying organization', true],
  ['procedure', 'Procedure and participation', true],
  ['official_deadline', 'Official deadline with time zone', true],
  ['document_access', 'How to obtain the documents', true],
  ['clarification_route', 'Clarification route and question deadline', true],
  ['summary', 'Summary of scope', false],
  ['category', 'Category', false],
  ['lots', 'Lots', false],
  ['estimated_value', 'Estimated value', false],
  ['site_visits', 'Briefings and site visits', false],
  ['contact_person', 'Named contact person', false],
  ['evaluation_summary', 'Evaluation method summary', false],
] as const;

function settings(overrides: Record<string, unknown> = {}) {
  return {
    publicPortalEnabled: true,
    brandingDisplayName: 'Kalahari Water Utilities',
    portalIntro: 'We buy pumps, pipes and meters.',
    guidanceMarkdown: '## Taking part\n\n1. Register\n2. Submit',
    showAdvanceNotices: true,
    showAwards: true,
    showBidderCounts: false,
    discloseBidderIdentities: 'after_award',
    publicDocumentPolicy: 'registered',
    languages: ['en'],
    noticeFields: NOTICE_FIELDS.map(([key, label, mandatory]) => ({
      key,
      label,
      mandatory,
      visible: mandatory || key === 'summary',
    })),
    channels: [
      { channel: 'portal', enabled: true, mandatory: true, description: null },
      { channel: 'external_notice', enabled: false, mandatory: false, description: null },
    ],
    ...overrides,
  };
}

export function portalPolicy(overrides: Record<string, unknown> = {}): PortalPolicy {
  return PortalPolicy.parse({
    tenantId: 2,
    buyerSlug: 'kwu',
    approved: settings(),
    approvedBy: lorato,
    approvedAt: '2026-05-12T09:00:00Z',
    proposal: {
      id: 7,
      status: 'in_review',
      settings: settings({ showBidderCounts: true, discloseBidderIdentities: 'after_opening' }),
      changeNote: 'Show bid counts as recommended by internal audit.',
      proposedBy: lorato,
      proposedAt: '2026-09-18T08:30:00Z',
      submittedAt: '2026-09-18T08:31:00Z',
      returnedReason: null,
      changedSettings: ['Bidder counts', 'Bidder identities'],
    },
    impact: { publicTenderCount: 7, publishedAwardCount: 2, advanceNoticeCount: 2 },
    history: [
      {
        id: 1,
        outcome: 'approved',
        summary: 'Portal launched.',
        proposedBy: lorato,
        by: lorato,
        at: '2025-12-01T08:00:00Z',
        underAlternativeOversight: true,
      },
    ],
    capabilities: {
      canPropose: true,
      canSubmit: false,
      canApprove: true,
      canReturn: true,
      canWithdraw: true,
      approvalBlockedReason: null,
      alternativeOversightNote: null,
    },
    ...overrides,
  });
}

export function publicPortal(): PublicPortalPolicy {
  return PublicPortalPolicy.parse({
    buyerSlug: 'kwu',
    buyerName: 'Kalahari Water Utilities (Pilot)',
    publicPortalEnabled: true,
    brandingDisplayName: 'Kalahari Water Utilities',
    portalIntro: '',
    guidanceMarkdown: '',
    showAdvanceNotices: true,
    showAwards: true,
    showBidderCounts: false,
    discloseBidderIdentities: 'after_award',
    publicDocumentPolicy: 'registered',
    languages: ['en'],
    visibleNoticeFields: ['reference', 'title'],
    channels: ['portal'],
    approvedAt: '2026-05-12T09:00:00Z',
  });
}
