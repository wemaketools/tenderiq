/**
 * Contract-valid org-admin values for the SPA tests of the account, admin-org and admin-access features (test data
 * only; the application's data always comes from the API).
 */
import type { NotificationPreferences } from '@contracts/notifications';
import type {
  AccessFindingPage,
  AccessGrantRow,
  AccessRestrictionRow,
  AssignableTender,
  AuthorityLimitRow,
  CommitteeDetail,
  ConflictDeclarationDetail,
  DeactivationReview,
  DelegationRow,
  DepartmentRow,
  EffectiveAccess,
  GroupDetail,
  InvitationPreview,
  InvitationRow,
  LegalEntityRow,
  MemberDetail,
  MemberRow,
  MyAccessSummary,
  MyMembership,
  MyMembershipPage,
  MyProfile,
  OrganizationSettings,
  RoleCatalog,
  RoleDetail,
  RoleRow,
  SodPolicyRow,
  SupplierAuthorityRow,
  TenderAssignmentRow,
} from '@contracts/org-admin';
import { permissionsForTemplates } from '@contracts/permissions';
import type { PermissionCode } from '@contracts/permissions';

import type { SessionState } from '../../../app/slices/session';
import { makeMembership, makeTenant, makeUser, signedInSession } from '../../../test/fixtures';

export function page<T>(items: readonly T[]) {
  return { items: [...items], total: items.length, page: 1, pageSize: 25 };
}

export const ORG_ADMIN_PERMISSIONS: readonly PermissionCode[] = permissionsForTemplates([
  'org_admin',
]);

/** A KWU organization administrator (Lorato Kgosi). */
export function buyerAdminSession(
  permissions: readonly PermissionCode[] = ORG_ADMIN_PERMISSIONS,
): SessionState {
  return signedInSession({
    user: makeUser({ id: 3, email: 'admin.kwu@tenderiq.local', fullName: 'Lorato Kgosi' }),
    activeTenant: makeTenant({ capacity: 'Organization Administrator' }, permissions),
  });
}

/** The Tsodilo Engineering supplier administrator (Tumelo Sekgoma). */
export function supplierAdminSession(
  permissions: readonly PermissionCode[] = permissionsForTemplates(['supplier_admin']),
): SessionState {
  return signedInSession({
    user: makeUser({ id: 24, email: 'tsodilo.admin@tenderiq.local', fullName: 'Tumelo Sekgoma' }),
    memberships: [
      makeMembership({
        tenantId: 4,
        tenantKind: 'supplier',
        tenantName: 'Tsodilo Engineering',
        tenantSlug: 'tsodilo',
        capacity: 'Organization Administrator',
      }),
    ],
    activeTenant: makeTenant(
      {
        tenantId: 4,
        kind: 'supplier',
        name: 'Tsodilo Engineering',
        slug: 'tsodilo',
        capacity: 'Organization Administrator',
      },
      permissions,
    ),
  });
}

const role = {
  roleId: 5,
  code: 'procurement_officer',
  name: 'Procurement officer',
  templateCode: 'procurement_officer',
} as const;

export function memberRow(overrides: Partial<MemberRow> = {}): MemberRow {
  return {
    userId: 5,
    membershipId: 505,
    fullName: 'Tebogo Molefe',
    email: 'tebogo.officer@tenderiq.local',
    capacity: 'Procurement Officer',
    membershipStatus: 'active',
    userStatus: 'active',
    roles: [role],
    groups: [],
    joinedAt: '2026-04-01T06:00:00Z',
    lastSeenAt: '2026-09-28T07:00:00Z',
    openWorkCount: 2,
    activeDelegationCount: 0,
    invitation: null,
    supplierAuthority: null,
    ...overrides,
  };
}

export function deactivatedRow(): MemberRow {
  return memberRow({
    userId: 21,
    membershipId: 521,
    fullName: 'Gaone Letsholo',
    email: 'former.officer@tenderiq.local',
    capacity: 'Procurement Officer (departed)',
    membershipStatus: 'revoked',
    userStatus: 'deactivated',
    openWorkCount: 3,
  });
}

export function invitationRow(overrides: Partial<InvitationRow> = {}): InvitationRow {
  return {
    invitationId: 2,
    email: 'kopano.dube@kwu.co.bw',
    fullName: 'Kopano Dube',
    capacity: 'Evaluator, Hydrology',
    roles: [{ roleId: 9, code: 'evaluator', name: 'Evaluator', templateCode: 'evaluator' }],
    status: 'expired',
    expiresAt: '2026-09-20T15:00:00Z',
    sentCount: 2,
    invitedBy: { userId: 3, fullName: 'Lorato Kgosi' },
    createdAt: '2026-09-06T09:00:00Z',
    acceptedAt: null,
    reissuedFromId: null,
    reissuedToId: null,
    canReissue: true,
    canRevoke: false,
    ...overrides,
  };
}

export function grantRow(overrides: Partial<AccessGrantRow> = {}): AccessGrantRow {
  return {
    grantId: 1,
    user: { userId: 5, fullName: 'Tebogo Molefe' },
    capacity: 'Procurement Officer',
    permissionCode: 'tender.view',
    permissionDescription: 'View tenders',
    scope: { scopeType: 'organization', scopeId: null, scopeLabel: 'Whole organization' },
    reason: 'Cover for the tender register review.',
    owner: { userId: 4, fullName: 'Mpho Dikgang' },
    grantedBy: { userId: 3, fullName: 'Lorato Kgosi' },
    startsAt: '2026-09-01T06:00:00Z',
    expiresAt: '2026-10-20T15:00:00Z',
    revokedAt: null,
    revokedBy: null,
    status: 'expiring_soon',
    ...overrides,
  };
}

export function restrictionRow(
  overrides: Partial<AccessRestrictionRow> = {},
): AccessRestrictionRow {
  return {
    restrictionId: 1,
    user: { userId: 42, fullName: 'Sam Keitumetse' },
    capacity: 'Evaluator, Engineering',
    permissionCode: null,
    scope: { scopeType: 'tender', scopeId: 3, scopeLabel: 'T-2026-0003 SCADA telemetry upgrade' },
    restrictionType: 'conflict',
    reason: 'Declared a prior employment link with a bidder.',
    startsAt: '2026-09-02T08:00:00Z',
    endsAt: null,
    imposedBy: null,
    conflictDeclarationId: 7,
    status: 'active',
    ...overrides,
  };
}

export function delegationRow(overrides: Partial<DelegationRow> = {}): DelegationRow {
  return {
    delegationId: 1,
    delegator: { userId: 4, fullName: 'Mpho Dikgang' },
    delegate: { userId: 5, fullName: 'Tebogo Molefe' },
    decisionTypes: ['release_approval'],
    maxAmount: { amount: '500000.00', currency: 'BWP' },
    delegatorLimit: { amount: '2000000.00', currency: 'BWP' },
    legalEntity: null,
    category: null,
    startsAt: '2026-09-15T06:00:00Z',
    endsAt: '2026-10-31T15:00:00Z',
    reason: 'Leave cover.',
    revokedAt: null,
    revokedBy: null,
    status: 'active',
    ...overrides,
  };
}

export function assignableTender(overrides: Partial<AssignableTender> = {}): AssignableTender {
  return {
    tenderId: 2,
    reference: 'T-2026-0002',
    title: 'Smart water meter supply',
    buyerName: 'Kalahari Water Utilities (Pilot)',
    submissionDeadline: { at: '2026-10-14T10:00:00Z', timeZone: 'Africa/Gaborone' },
    ...overrides,
  };
}

export function tenderAssignment(
  overrides: Partial<TenderAssignmentRow> = {},
): TenderAssignmentRow {
  return {
    assignmentId: 1,
    member: { userId: 26, fullName: 'Ditiro Kebonang' },
    capacity: 'Technical Contributor',
    tender: assignableTender(),
    responsibility: 'contributor',
    sectionScope: ['Technical'],
    lotLabels: [],
    dueAt: '2026-10-10T15:00:00Z',
    canViewPricing: false,
    assignedAt: '2026-09-20T08:00:00Z',
    endedAt: null,
    active: true,
    ...overrides,
  };
}

export function memberDetail(overrides: Partial<MemberDetail> = {}): MemberDetail {
  return {
    ...memberRow(),
    endedAt: null,
    endReason: null,
    roleAssignments: [
      {
        assignmentId: 11,
        role,
        scope: { scopeType: 'organization', scopeId: null, scopeLabel: 'Whole organization' },
        viaGroup: null,
        startsAt: '2026-04-01T06:00:00Z',
        endsAt: null,
        grantedBy: { userId: 3, fullName: 'Lorato Kgosi' },
        revokedAt: null,
        reason: 'Tender owner for the pilot.',
        status: 'active',
      },
    ],
    directGrants: [grantRow()],
    restrictions: [],
    delegationsGiven: [],
    delegationsReceived: [delegationRow()],
    authorityLimits: [],
    openWork: [
      {
        workItemId: 31,
        kind: 'tender_team',
        title: 'Tender owner of Pipeline valves bulk supply',
        reference: 'T-2026-0008',
        dueAt: '2026-10-05T15:00:00Z',
        isOverdue: false,
        requiresReassignment: true,
      },
      {
        workItemId: 32,
        kind: 'task',
        title: 'Reminder to review supplier questions',
        reference: null,
        dueAt: null,
        isOverdue: false,
        requiresReassignment: false,
      },
    ],
    invitations: [],
    tenderAssignments: [],
    attributedHistory: [
      {
        kind: 'publication',
        reference: 'T-2026-0002',
        description: 'Published the smart water meter tender',
        occurredAt: '2026-09-10T08:00:00Z',
        capacity: 'Procurement Officer',
      },
    ],
    availableActions: ['edit', 'assignRole', 'suspend', 'deactivate', 'reassignWork'],
    ...overrides,
  };
}

export function deactivationReview(): DeactivationReview {
  const detail = memberDetail();
  return {
    member: memberRow(),
    openWork: detail.openWork,
    delegationsGiven: [],
    delegationsReceived: [delegationRow()],
    activeGrants: [grantRow()],
    activeRoleAssignments: 1,
    tenderAssignments: [],
    attributedHistory: detail.attributedHistory,
    blockers: [],
    candidates: [{ userId: 4, fullName: 'Mpho Dikgang', capacity: 'Procurement Manager' }],
  };
}

export function roleRow(overrides: Partial<RoleRow> = {}): RoleRow {
  return {
    roleId: 30,
    code: 'site_inspector',
    name: 'Site inspector',
    description: 'Inspects works on site.',
    templateCode: null,
    isSystem: false,
    active: true,
    deactivatedAt: null,
    permissionCount: 1,
    activeAssignmentCount: 0,
    ...overrides,
  };
}

export function roleDetail(overrides: Partial<RoleDetail> = {}): RoleDetail {
  return {
    ...roleRow(),
    permissions: [{ code: 'tender.view', category: 'Tenders', description: 'View tenders' }],
    holders: [],
    sodWarnings: [],
    ...overrides,
  };
}

export function roleCatalog(): RoleCatalog {
  return {
    templates: [
      {
        code: 'procurement_officer',
        name: 'Procurement officer',
        description: 'Runs tenders.',
        permissionCodes: ['tender.view', 'tender.edit'],
      },
    ],
    permissions: [
      { code: 'tender.view', category: 'Tenders', description: 'View tenders' },
      { code: 'tender.edit', category: 'Tenders', description: 'Edit tenders' },
      { code: 'tender.release_approve', category: 'Tenders', description: 'Approve release' },
    ],
  };
}

export function groupDetail(overrides: Partial<GroupDetail> = {}): GroupDetail {
  return {
    groupId: 3,
    name: 'Bid opening panel',
    description: 'Opening officers and witnesses.',
    active: true,
    memberCount: 1,
    roles: [{ roleId: 12, code: 'opening_witness', name: 'Opening witness', templateCode: null }],
    createdAt: '2026-03-01T08:00:00Z',
    members: [
      {
        userId: 15,
        fullName: 'Oratile Baitse',
        capacity: 'Bid Opening Officer',
        addedAt: '2026-03-02T08:00:00Z',
        addedBy: { userId: 3, fullName: 'Lorato Kgosi' },
      },
    ],
    roleAssignments: [
      {
        assignmentId: 40,
        role: { roleId: 12, code: 'opening_witness', name: 'Opening witness', templateCode: null },
        scope: { scopeType: 'organization', scopeId: null, scopeLabel: 'Whole organization' },
        status: 'active',
      },
    ],
    deactivatedAt: null,
    ...overrides,
  };
}

export function findingPage(): AccessFindingPage {
  return {
    ...page([
      {
        findingId: 1,
        type: 'sod_conflict',
        severity: 'critical',
        user: { userId: 4, fullName: 'Mpho Dikgang' },
        capacity: 'Procurement Manager',
        title: 'Can draft and approve the release of the same tender',
        detail: 'Holds tender.edit and tender.release_approve.',
        ruleCode: 'draft_vs_final_approval',
        relatedId: null,
        dueAt: null,
      },
      {
        findingId: 2,
        type: 'pending_conflict_review',
        severity: 'warning',
        user: { userId: 42, fullName: 'Sam Keitumetse' },
        capacity: 'Evaluator, Engineering',
        title: 'Conflict declaration awaiting review',
        detail: 'T-2026-0003 SCADA telemetry upgrade.',
        ruleCode: null,
        relatedId: 7,
        dueAt: '2026-10-02T15:00:00Z',
      },
    ]),
    summary: {
      sodConflicts: 1,
      expiringGrants: 1,
      dormantAccounts: 0,
      activeRestrictions: 2,
      pendingConflictReviews: 1,
      generatedAt: '2026-09-30T06:00:00Z',
    },
  };
}

export function effectiveAccess(): EffectiveAccess {
  return {
    user: { userId: 4, fullName: 'Mpho Dikgang' },
    capacity: 'Procurement Manager',
    membershipStatus: 'active',
    permissions: [
      {
        code: 'tender.edit',
        category: 'Tenders',
        description: 'Edit tenders',
        effective: true,
        sources: [
          {
            kind: 'role',
            label: 'Procurement manager',
            scope: { scopeType: 'organization', scopeId: null, scopeLabel: 'Whole organization' },
            expiresAt: null,
          },
        ],
        restrictedBy: [],
      },
    ],
    restrictions: [],
    sodBreaches: [
      {
        ruleCode: 'draft_vs_final_approval',
        mode: 'enforced',
        permissions: ['tender.edit', 'tender.release_approve'],
      },
    ],
  };
}

export function conflictDetail(
  overrides: Partial<ConflictDeclarationDetail> = {},
): ConflictDeclarationDetail {
  return {
    declarationId: 7,
    declarant: { userId: 42, fullName: 'Sam Keitumetse' },
    capacity: 'Evaluator, Engineering',
    subject: {
      subjectType: 'tender',
      subjectId: 3,
      reference: 'T-2026-0003',
      title: 'SCADA telemetry upgrade',
    },
    supplierName: 'Tsodilo Engineering',
    hasConflict: true,
    nature: 'prior_employment',
    declaredAt: '2026-09-02T08:00:00Z',
    disposition: 'pending_review',
    reviewedBy: null,
    reviewedAt: null,
    holdsSupplierMemberships: true,
    accessBlocked: true,
    details: 'Worked at Tsodilo Engineering until 2025.',
    reviewNote: null,
    supplierMemberships: [
      {
        organizationName: 'Tsodilo Engineering',
        capacity: 'Technical Contributor',
        status: 'active',
      },
    ],
    restriction: restrictionRow(),
    history: [
      {
        at: '2026-09-02T08:00:00Z',
        actor: { userId: 42, fullName: 'Sam Keitumetse' },
        action: 'Declared',
        note: null,
      },
    ],
    allowedDispositions: ['cleared', 'mitigated', 'recused', 'reassigned'],
    ...overrides,
  };
}

export function supplierAuthorityRow(
  overrides: Partial<SupplierAuthorityRow> = {},
): SupplierAuthorityRow {
  return {
    member: { userId: 26, fullName: 'Ditiro Kebonang' },
    capacity: 'Technical Contributor',
    membershipStatus: 'active',
    canPrepare: true,
    canPrice: false,
    canApprove: false,
    canSubmit: false,
    submissionSource: 'none',
    submissionTenders: [],
    signingLimit: null,
    delegationsReceived: 0,
    activeAssignments: 2,
    availableActions: ['changeSubmission'],
    blockedBy: 'no_submission_authority',
    ...overrides,
  };
}

export function organizationSettings(): OrganizationSettings {
  const person = { userId: 4, fullName: 'Mpho Dikgang' };
  return {
    identity: {
      tenantId: 2,
      slug: 'kwu',
      kind: 'buyer',
      legalName: 'Kalahari Water Utilities Corporation',
      tradingName: 'Kalahari Water',
      status: 'active',
      country: 'BW',
      registrationJurisdiction: 'Botswana',
      registrationNumber: 'BW-PE-2004-0117',
      taxIdentifier: 'C01234567',
      defaultCurrency: 'BWP',
      officialTimeZone: 'Africa/Gaborone',
      workingLanguages: ['en'],
      verificationStatus: 'identity_verified',
      onboardingStage: 'pilot',
      planCode: 'buyer-professional',
    },
    settings: {
      acceptedCurrencies: ['BWP', 'ZAR'],
      defaultCalendar: { id: 1, name: 'Botswana Public Holidays 2026' },
      responsibilities: {
        procurementOwner: person,
        administrator: { userId: 3, fullName: 'Lorato Kgosi' },
        budgetApprovalOwner: null,
        publicationOwner: null,
        complaintsOwner: null,
        recordsOwner: null,
        contractOwner: null,
        supportContact: null,
      },
      brandingDisplayName: 'Kalahari Water Utilities',
      publicPortalEnabled: true,
      portalIntro: null,
      sodAlternativeOversightNote: null,
    },
    policyProfile: { name: 'KWU Standard Procurement Policy', versionNo: 2 },
    legalEntityCount: 2,
    readiness: [
      { id: 'owner', label: 'Procurement owner', status: 'passed', detail: null },
      {
        id: 'complaints',
        label: 'Complaints owner',
        status: 'warning',
        detail: 'Nobody is responsible yet.',
      },
    ],
    updatedAt: '2026-09-14T09:12:00Z',
    updatedBy: { userId: 3, fullName: 'Lorato Kgosi' },
  };
}

const usage = { referenceCount: 4, openTenders: 1, activeContracts: 0 };

export function departmentRow(overrides: Partial<DepartmentRow> = {}): DepartmentRow {
  return {
    id: 1,
    name: 'Operations',
    code: 'OPS',
    parent: null,
    legalEntity: null,
    head: { userId: 7, fullName: 'Onalenna Tau' },
    active: true,
    deactivatedAt: null,
    usage,
    createdAt: '2026-01-05T08:00:00Z',
    ...overrides,
  };
}

export function legalEntityRow(overrides: Partial<LegalEntityRow> = {}): LegalEntityRow {
  return {
    id: 1,
    name: 'Kalahari Water Utilities Corporation',
    registrationNumber: 'BW-PE-2004-0117',
    country: 'BW',
    address: 'Plot 1, Gaborone',
    isContractingEntity: true,
    active: true,
    deactivatedAt: null,
    usage,
    createdAt: '2026-01-05T08:00:00Z',
    ...overrides,
  };
}

export function limitRow(overrides: Partial<AuthorityLimitRow> = {}): AuthorityLimitRow {
  return {
    limitId: 1,
    subjectType: 'user',
    subject: { id: 4, name: 'Mpho Dikgang' },
    decisionType: 'release_approval',
    maxAmount: { amount: '2000000.00', currency: 'BWP' },
    legalEntity: null,
    category: null,
    effectiveFrom: '2026-01-05T08:00:00Z',
    effectiveTo: null,
    approvedBy: { userId: 3, fullName: 'Lorato Kgosi' },
    status: 'active',
    ...overrides,
  };
}

export function committeeDetail(overrides: Partial<CommitteeDetail> = {}): CommitteeDetail {
  return {
    committeeId: 1,
    name: 'Tender evaluation committee',
    purpose: 'evaluation',
    quorum: 2,
    legalEntity: null,
    active: true,
    chair: { userId: 10, fullName: 'Boitumelo Kgari' },
    activeMemberCount: 3,
    votingMemberCount: 2,
    alternateCount: 1,
    quorumMet: true,
    members: [
      {
        memberId: 1,
        person: { userId: 10, fullName: 'Boitumelo Kgari' },
        capacity: 'Evaluation Chair',
        memberRole: 'chair',
        startsAt: '2026-01-05T08:00:00Z',
        endsAt: null,
        status: 'active',
      },
    ],
    authorityLimits: [
      limitRow({
        subjectType: 'committee',
        subject: { id: 1, name: 'Tender evaluation committee' },
      }),
    ],
    deactivatedAt: null,
    ...overrides,
  };
}

export function sodPolicy(overrides: Partial<SodPolicyRow> = {}): SodPolicyRow {
  return {
    ruleCode: 'draft_vs_final_approval',
    permissions: ['tender.edit', 'tender.release_approve'],
    mode: 'enforced',
    configured: true,
    alternativeOversightNote: null,
    approvedBy: { userId: 3, fullName: 'Lorato Kgosi' },
    effectiveFrom: '2026-01-05T08:00:00Z',
    holdersOfBoth: 1,
    ...overrides,
  };
}

export function myMembership(overrides: Partial<MyMembership> = {}): MyMembership {
  return {
    membershipId: 11,
    organization: {
      tenantId: 2,
      tenantName: 'Kalahari Water Utilities (Pilot)',
      tenantKind: 'buyer',
    },
    organizationSlug: 'kwu',
    capacity: 'Evaluator, Engineering',
    status: 'active',
    roleNames: ['Evaluator'],
    joinedAt: '2026-04-01T06:55:00Z',
    requestedAt: null,
    endedAt: null,
    explanation: null,
    canWithdraw: false,
    canLeave: true,
    ...overrides,
  };
}

export function myMembershipPage(): MyMembershipPage {
  return {
    ...page([
      myMembership(),
      myMembership({
        membershipId: 12,
        organization: { tenantId: 7, tenantName: 'Serowe ICT Solutions', tenantKind: 'supplier' },
        organizationSlug: 'serowe-ict',
        capacity: 'Technical Contributor',
        status: 'pending_approval',
        roleNames: ['Contributor'],
        joinedAt: null,
        requestedAt: '2026-09-24T08:00:00Z',
        explanation: 'Your request is waiting for the organization’s administrator.',
        canWithdraw: true,
        canLeave: false,
      }),
    ]),
    summary: { active: 1, pending: 1, suspendedOrEnded: 0, holdsBuyerAndSupplierMemberships: true },
  };
}

export function myProfile(): MyProfile {
  return {
    userId: 3,
    email: 'admin.kwu@tenderiq.local',
    fullName: 'Lorato Kgosi',
    phone: null,
    locale: 'en-BW',
    displayTimeZone: null,
    status: 'active',
    lastSeenAt: '2026-09-28T14:05:00Z',
    pendingContactChanges: [],
    officialTimeZones: [
      {
        organization: {
          tenantId: 2,
          tenantName: 'Kalahari Water Utilities (Pilot)',
          tenantKind: 'buyer',
        },
        timeZone: 'Africa/Gaborone',
      },
    ],
  };
}

export function myAccess(): MyAccessSummary {
  return {
    organizations: [
      {
        organization: {
          tenantId: 2,
          tenantName: 'Kalahari Water Utilities (Pilot)',
          tenantKind: 'buyer',
        },
        capacity: 'Organization Administrator',
        roles: memberDetail().roleAssignments,
        directGrants: [],
        restrictions: [],
        delegationsGiven: [],
        delegationsReceived: [],
      },
    ],
  };
}

export function notificationPreferences(): NotificationPreferences {
  return {
    emailEnabled: true,
    items: [
      { eventType: 'tender_issued', mandatory: true, inApp: true, email: true, digest: 'none' },
      { eventType: 'task_assigned', mandatory: false, inApp: true, email: true, digest: 'none' },
    ],
  };
}

export function invitationPreview(overrides: Partial<InvitationPreview> = {}): InvitationPreview {
  return {
    organizationName: 'Okavango District Council',
    organizationKind: 'buyer',
    capacity: 'Legal Adviser (shared service)',
    roleNames: ['Legal or compliance reviewer'],
    invitedBy: 'Wame Olebile',
    emailMasked: 'd***@tenderiq.local',
    status: 'pending',
    expiresAt: '2026-12-15T15:00:00Z',
    officialTimeZone: 'Africa/Gaborone',
    ...overrides,
  };
}
