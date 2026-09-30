/**
 * Policy profiles and versions (ADM-06) for the demo buyers (docs/plan/demo-storyline.md).
 *
 * KWU:
 * - "Standard competitive tendering": v1 approved (frozen by T-0001, T-0003, T-0007), v2 approved and current
 *   (frozen by T-0008, proposed by T-0005 which awaits release approval, AC-06), v3 in review.
 * - "Consultancy and multi-stage selection": v1 current (T-0004 RFI, T-0009 restricted multi-stage), v2 in review.
 * - "Requests for quotation": v1 retired, v2 current (T-0002, T-0006, T-0010; proposed by the draft T-0012), v3
 *   draft (returned).
 * - "Emergency direct procurement (2024 interim)": retired profile.
 * ODC: "ODC procurement rules 2026", v1 current (T-2026-0011).
 *
 * Actors follow the permission model: the organization administrator is the only holder of `org.policy.manage`
 * and `org.policy.approve` in each buyer, so versions are created, submitted and approved by `admin.kwu` /
 * `admin.odc`. Each such self-approval relies on the documented alternative oversight in `./governance.ts`
 * (BR-07); the in-review versions are therefore approvable by the administrator, with the oversight shown.
 * `approvalRequestId` stays null: the approvals fixtures hold no `policy_profile` approval requests.
 */
import type { PolicyRulesInput, PolicyThresholdInput } from '../../../contracts/policy.js';
import type { PolicyProfileVersionsStatus, PolicyProfilesStatus } from '../../../contracts/enums.js';
import { TENANT_IDS } from '../platform.js';

export interface FixturePolicyUsage {
  readonly tenderId: number;
  /** Released under this version (frozen, BR-09); false = proposed by a tender still in preparation. */
  readonly frozen: boolean;
}

export interface FixtureStrategyUsage {
  readonly strategyId: number;
  readonly requestReference: string | null;
  readonly title: string;
  readonly status: 'draft' | 'awaiting_approval' | 'approved' | 'returned' | 'superseded';
}

export interface FixturePolicyVersion {
  readonly id: number;
  readonly tenantId: number;
  readonly profileId: number;
  readonly versionNo: number;
  readonly status: PolicyProfileVersionsStatus;
  readonly rules: PolicyRulesInput;
  readonly createdBy: number;
  readonly createdAt: string;
  readonly submittedBy: number | null;
  readonly submittedAt: string | null;
  readonly approvedBy: number | null;
  readonly approvedAt: string | null;
  readonly effectiveFrom: string | null;
  readonly retiredAt: string | null;
  readonly approvalRequestId: number | null;
  readonly returnedReason: string | null;
  readonly tenders: readonly FixturePolicyUsage[];
  readonly strategies: readonly FixtureStrategyUsage[];
}

export interface FixturePolicyProfile {
  readonly id: number;
  readonly tenantId: number;
  readonly name: string;
  readonly description: string;
  readonly status: PolicyProfilesStatus;
  readonly currentVersionId: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
  readonly retirementReason: string | null;
}

const kwu = TENANT_IDS.kwu;
const odc = TENANT_IDS.odc;

const ADMIN_KWU = 3;
const ADMIN_ODC = 22;

function band(procedure: PolicyThresholdInput['procedure'], minValue: string, maxValue: string | null, level: string, publicNotice: boolean): PolicyThresholdInput {
  return { procedure, minValue, maxValue, currency: 'BWP', requiredApprovalLevel: level, requiresPublicNotice: publicNotice };
}

/** The KWU competitive baseline; later versions override individual rules. */
const COMPETITIVE_V1: PolicyRulesInput = {
  permittedProcedures: ['open', 'restricted', 'invitation_only'],
  requiresReleaseApproval: true,
  stagedOpeningDefault: false,
  openingQuorum: 2,
  openingRequiresSecondPerson: true,
  independentEvaluation: true,
  negotiationPermitted: false,
  bafoPermitted: false,
  lateSubmissionPolicy: 'reject',
  questionDeadlineDaysBeforeClose: 7,
  minResponseDays: 21,
  standstillRequired: true,
  standstillLength: 10,
  standstillDayType: 'calendar',
  complaintWindowDays: 10,
  complaintRequiresIndependentReview: true,
  publicAwardNoticeRequired: true,
  approvalRouteNote: 'Release approval by the Procurement Manager up to BWP 2,000,000.00; above that by the Chief Executive.',
  thresholds: [
    band('invitation_only', '0.00', '1000000.00', 'Procurement Manager', false),
    band('restricted', '0.00', '5000000.00', 'Procurement Manager', true),
    band('open', '0.00', '2000000.00', 'Procurement Manager', true),
    band('open', '2000000.00', null, 'Chief Executive', true),
  ],
};

const COMPETITIVE_V2: PolicyRulesInput = {
  ...COMPETITIVE_V1,
  stagedOpeningDefault: true,
  questionDeadlineDaysBeforeClose: 10,
  minResponseDays: 28,
  standstillLength: 10,
  standstillDayType: 'working',
  approvalRouteNote:
    'Release approval by the Procurement Manager up to BWP 2,000,000.00; above that by the Chief Executive. A material scope or value change after release approval invalidates it (AC-06).',
};

const COMPETITIVE_V3: PolicyRulesInput = {
  ...COMPETITIVE_V2,
  lateSubmissionPolicy: 'exception_route',
  complaintWindowDays: 14,
  thresholds: [
    band('invitation_only', '0.00', '1500000.00', 'Procurement Manager', false),
    band('restricted', '0.00', '5000000.00', 'Procurement Manager', true),
    band('open', '0.00', '2000000.00', 'Procurement Manager', true),
    band('open', '2000000.00', null, 'Chief Executive', true),
  ],
};

const CONSULTANCY_V1: PolicyRulesInput = {
  permittedProcedures: ['rfi', 'restricted', 'multi_stage'],
  requiresReleaseApproval: true,
  stagedOpeningDefault: true,
  openingQuorum: 2,
  openingRequiresSecondPerson: true,
  independentEvaluation: true,
  negotiationPermitted: true,
  bafoPermitted: false,
  lateSubmissionPolicy: 'reject',
  questionDeadlineDaysBeforeClose: 10,
  minResponseDays: 30,
  standstillRequired: true,
  standstillLength: 10,
  standstillDayType: 'working',
  complaintWindowDays: 10,
  complaintRequiresIndependentReview: true,
  publicAwardNoticeRequired: true,
  approvalRouteNote: 'Shortlists and preferred-bidder decisions need Procurement Manager approval; awards follow authority limits.',
  thresholds: [
    band('rfi', '0.00', null, 'Procurement Officer', true),
    band('restricted', '0.00', '3000000.00', 'Procurement Manager', true),
    band('multi_stage', '0.00', null, 'Chief Executive', true),
  ],
};

const CONSULTANCY_V2: PolicyRulesInput = {
  ...CONSULTANCY_V1,
  bafoPermitted: true,
  approvalRouteNote:
    'Shortlists and preferred-bidder decisions need Procurement Manager approval. A best-and-final-offer round needs a negotiation mandate approved before invitations.',
};

const RFQ_V1: PolicyRulesInput = {
  permittedProcedures: ['open', 'invitation_only'],
  requiresReleaseApproval: false,
  stagedOpeningDefault: false,
  openingQuorum: 1,
  openingRequiresSecondPerson: false,
  independentEvaluation: false,
  negotiationPermitted: false,
  bafoPermitted: false,
  lateSubmissionPolicy: 'reject',
  questionDeadlineDaysBeforeClose: 3,
  minResponseDays: 7,
  standstillRequired: false,
  standstillLength: null,
  standstillDayType: null,
  complaintWindowDays: 5,
  complaintRequiresIndependentReview: false,
  publicAwardNoticeRequired: false,
  approvalRouteNote: null,
  thresholds: [band('open', '0.00', '500000.00', 'Procurement Officer', true), band('invitation_only', '0.00', '250000.00', 'Procurement Officer', false)],
};

const RFQ_V2: PolicyRulesInput = {
  ...RFQ_V1,
  requiresReleaseApproval: true,
  openingQuorum: 2,
  openingRequiresSecondPerson: true,
  independentEvaluation: true,
  minResponseDays: 10,
  publicAwardNoticeRequired: true,
  approvalRouteNote: 'Release approval by the Procurement Manager for every quotation above BWP 100,000.00.',
  thresholds: [band('open', '0.00', '1500000.00', 'Procurement Manager', true), band('invitation_only', '0.00', '500000.00', 'Procurement Manager', false)],
};

const RFQ_V3: PolicyRulesInput = {
  ...RFQ_V2,
  standstillRequired: true,
  standstillLength: 5,
  standstillDayType: 'working',
};

const EMERGENCY_V1: PolicyRulesInput = {
  permittedProcedures: ['direct'],
  requiresReleaseApproval: true,
  stagedOpeningDefault: false,
  openingQuorum: 1,
  openingRequiresSecondPerson: false,
  independentEvaluation: false,
  negotiationPermitted: true,
  bafoPermitted: false,
  lateSubmissionPolicy: 'reject',
  questionDeadlineDaysBeforeClose: 1,
  minResponseDays: 2,
  standstillRequired: false,
  standstillLength: null,
  standstillDayType: null,
  complaintWindowDays: 5,
  complaintRequiresIndependentReview: true,
  publicAwardNoticeRequired: true,
  approvalRouteNote: 'Interim emergency rule adopted during the 2024 drought response.',
  thresholds: [band('direct', '0.00', '1000000.00', 'Chief Executive', false)],
};

const ODC_V1: PolicyRulesInput = {
  permittedProcedures: ['open', 'invitation_only', 'direct'],
  requiresReleaseApproval: true,
  stagedOpeningDefault: false,
  openingQuorum: 2,
  openingRequiresSecondPerson: true,
  independentEvaluation: true,
  negotiationPermitted: false,
  bafoPermitted: false,
  lateSubmissionPolicy: 'reject',
  questionDeadlineDaysBeforeClose: 5,
  minResponseDays: 14,
  standstillRequired: true,
  standstillLength: 7,
  standstillDayType: 'working',
  complaintWindowDays: 7,
  complaintRequiresIndependentReview: true,
  publicAwardNoticeRequired: true,
  approvalRouteNote: 'Council tender committee approves releases above BWP 500,000.00.',
  thresholds: [band('open', '0.00', null, 'Council Secretary', true), band('direct', '0.00', '100000.00', 'Council Secretary', false)],
};

export const POLICY_PROFILES: readonly FixturePolicyProfile[] = Object.freeze([
  {
    id: 1,
    tenantId: kwu,
    name: 'Standard competitive tendering',
    description: 'Open, restricted and invitation-only tenders for goods, works and services above quotation limits.',
    status: 'active',
    currentVersionId: 2,
    createdAt: '2025-11-03T08:00:00Z',
    updatedAt: '2026-09-22T09:40:00Z',
    retiredAt: null,
    retirementReason: null,
  },
  {
    id: 2,
    tenantId: kwu,
    name: 'Consultancy and multi-stage selection',
    description: 'Market consultations, restricted and multi-stage selections with shortlists, demonstrations and negotiation.',
    status: 'active',
    currentVersionId: 4,
    createdAt: '2025-11-03T08:30:00Z',
    updatedAt: '2026-09-14T13:10:00Z',
    retiredAt: null,
    retirementReason: null,
  },
  {
    id: 3,
    tenantId: kwu,
    name: 'Requests for quotation',
    description: 'Low- and medium-value quotations with a simplified timetable.',
    status: 'active',
    currentVersionId: 7,
    createdAt: '2025-11-04T07:30:00Z',
    updatedAt: '2026-09-26T11:05:00Z',
    retiredAt: null,
    retirementReason: null,
  },
  {
    id: 4,
    tenantId: kwu,
    name: 'Emergency direct procurement (2024 interim)',
    description: 'Interim rule for the 2024 drought response; replaced by the exception route of the standard profiles.',
    status: 'retired',
    currentVersionId: null,
    createdAt: '2024-08-12T08:00:00Z',
    updatedAt: '2025-12-31T15:00:00Z',
    retiredAt: '2025-12-31T15:00:00Z',
    retirementReason: 'Drought emergency declaration lapsed; emergencies now use the exception route of the standard profiles.',
  },
  {
    id: 5,
    tenantId: odc,
    name: 'ODC procurement rules 2026',
    description: 'Council procurement rules for quotations and open tenders.',
    status: 'active',
    currentVersionId: 11,
    createdAt: '2026-01-12T08:00:00Z',
    updatedAt: '2026-02-02T10:00:00Z',
    retiredAt: null,
    retirementReason: null,
  },
]);

export const POLICY_VERSIONS: readonly FixturePolicyVersion[] = Object.freeze([
  {
    id: 1, tenantId: kwu, profileId: 1, versionNo: 1, status: 'approved', rules: COMPETITIVE_V1,
    createdBy: ADMIN_KWU, createdAt: '2025-11-03T08:00:00Z', submittedBy: ADMIN_KWU, submittedAt: '2025-11-10T09:00:00Z',
    approvedBy: ADMIN_KWU, approvedAt: '2025-11-20T12:00:00Z', effectiveFrom: '2025-12-01T00:00:00Z', retiredAt: null,
    approvalRequestId: null, returnedReason: null,
    tenders: [{ tenderId: 1, frozen: true }, { tenderId: 3, frozen: true }, { tenderId: 7, frozen: true }, { tenderId: 14, frozen: true }],
    strategies: [],
  },
  {
    id: 2, tenantId: kwu, profileId: 1, versionNo: 2, status: 'approved', rules: COMPETITIVE_V2,
    createdBy: ADMIN_KWU, createdAt: '2026-06-02T08:00:00Z', submittedBy: ADMIN_KWU, submittedAt: '2026-07-10T09:30:00Z',
    approvedBy: ADMIN_KWU, approvedAt: '2026-07-24T14:00:00Z', effectiveFrom: '2026-08-01T00:00:00Z', retiredAt: null,
    approvalRequestId: null, returnedReason: null,
    tenders: [{ tenderId: 8, frozen: true }, { tenderId: 5, frozen: false }, { tenderId: 12, frozen: false }],
    strategies: [{ strategyId: 505, requestReference: null, title: 'Water treatment chemicals framework', status: 'approved' }],
  },
  {
    id: 3, tenantId: kwu, profileId: 1, versionNo: 3, status: 'in_review', rules: COMPETITIVE_V3,
    createdBy: ADMIN_KWU, createdAt: '2026-09-15T08:00:00Z', submittedBy: ADMIN_KWU, submittedAt: '2026-09-22T09:40:00Z',
    approvedBy: null, approvedAt: null, effectiveFrom: null, retiredAt: null, approvalRequestId: null, returnedReason: null,
    tenders: [], strategies: [],
  },
  {
    id: 4, tenantId: kwu, profileId: 2, versionNo: 1, status: 'approved', rules: CONSULTANCY_V1,
    createdBy: ADMIN_KWU, createdAt: '2025-11-03T08:30:00Z', submittedBy: ADMIN_KWU, submittedAt: '2025-11-10T09:10:00Z',
    approvedBy: ADMIN_KWU, approvedAt: '2025-11-20T12:10:00Z', effectiveFrom: '2025-12-01T00:00:00Z', retiredAt: null,
    approvalRequestId: null, returnedReason: null,
    tenders: [{ tenderId: 4, frozen: true }, { tenderId: 9, frozen: true }],
    strategies: [{ strategyId: 504, requestReference: null, title: 'Acoustic leak detection services', status: 'approved' }],
  },
  {
    id: 5, tenantId: kwu, profileId: 2, versionNo: 2, status: 'in_review', rules: CONSULTANCY_V2,
    createdBy: ADMIN_KWU, createdAt: '2026-09-01T10:00:00Z', submittedBy: ADMIN_KWU, submittedAt: '2026-09-14T13:10:00Z',
    approvedBy: null, approvedAt: null, effectiveFrom: null, retiredAt: null, approvalRequestId: null, returnedReason: null,
    tenders: [], strategies: [],
  },
  {
    id: 6, tenantId: kwu, profileId: 3, versionNo: 1, status: 'retired', rules: RFQ_V1,
    createdBy: ADMIN_KWU, createdAt: '2025-11-04T07:30:00Z', submittedBy: ADMIN_KWU, submittedAt: '2025-11-10T09:20:00Z',
    approvedBy: ADMIN_KWU, approvedAt: '2025-11-20T12:20:00Z', effectiveFrom: '2025-12-01T00:00:00Z', retiredAt: '2026-01-04T15:00:00Z',
    approvalRequestId: null, returnedReason: null, tenders: [], strategies: [],
  },
  {
    id: 7, tenantId: kwu, profileId: 3, versionNo: 2, status: 'approved', rules: RFQ_V2,
    createdBy: ADMIN_KWU, createdAt: '2025-12-01T08:00:00Z', submittedBy: ADMIN_KWU, submittedAt: '2025-12-05T08:00:00Z',
    approvedBy: ADMIN_KWU, approvedAt: '2025-12-18T11:00:00Z', effectiveFrom: '2026-01-05T00:00:00Z', retiredAt: null,
    approvalRequestId: null, returnedReason: null,
    tenders: [{ tenderId: 10, frozen: true }, { tenderId: 2, frozen: true }, { tenderId: 6, frozen: true }],
    strategies: [],
  },
  {
    id: 8, tenantId: kwu, profileId: 3, versionNo: 3, status: 'draft', rules: RFQ_V3,
    createdBy: ADMIN_KWU, createdAt: '2026-09-11T08:00:00Z', submittedBy: ADMIN_KWU, submittedAt: '2026-09-18T10:00:00Z',
    approvedBy: null, approvedAt: null, effectiveFrom: null, retiredAt: null, approvalRequestId: null,
    returnedReason: 'Add the standstill period for quotations above BWP 500,000.00 before resubmitting.',
    tenders: [], strategies: [],
  },
  {
    id: 9, tenantId: kwu, profileId: 4, versionNo: 1, status: 'retired', rules: EMERGENCY_V1,
    createdBy: ADMIN_KWU, createdAt: '2024-08-12T08:00:00Z', submittedBy: ADMIN_KWU, submittedAt: '2024-08-12T09:00:00Z',
    approvedBy: ADMIN_KWU, approvedAt: '2024-08-13T08:00:00Z', effectiveFrom: '2024-08-14T00:00:00Z', retiredAt: '2025-12-31T15:00:00Z',
    approvalRequestId: null, returnedReason: null, tenders: [], strategies: [],
  },
  {
    id: 11, tenantId: odc, profileId: 5, versionNo: 1, status: 'approved', rules: ODC_V1,
    createdBy: ADMIN_ODC, createdAt: '2026-01-12T08:00:00Z', submittedBy: ADMIN_ODC, submittedAt: '2026-01-19T08:00:00Z',
    approvedBy: ADMIN_ODC, approvedAt: '2026-02-02T10:00:00Z', effectiveFrom: '2026-02-02T10:00:00Z', retiredAt: null,
    approvalRequestId: null, returnedReason: null, tenders: [{ tenderId: 11, frozen: true }, { tenderId: 13, frozen: false }], strategies: [],
  },
]);
