/**
 * Org-admin fixtures: authority limits, delegations and committees (ADM-05; FR-03; BR-06).
 *
 * Limits agree with the platform personas: `mpho.manager` BWP 2,000,000 and `keabetswe.approver` BWP 10,000,000
 * (AC-05). Supplier signing limits are `contract_signature` limits in the supplier tenant (SUP-04). Every
 * delegation stays within its delegator's limit; the one to the departed officer was revoked on deactivation.
 */
import type {
  AuthorityLimitsDecisionType,
  AuthorityLimitsSubjectType,
  CommitteeMembersMemberRole,
  CommitteesPurpose,
} from '../../../contracts/enums.js';
import { TENANT_IDS } from '../platform.js';
import { uid } from './refs.js';

export interface FixtureAuthorityLimit {
  readonly limitId: number;
  readonly tenantId: number;
  readonly subjectType: AuthorityLimitsSubjectType;
  /** User id, role code or committee id, per `subjectType`. */
  readonly subjectUserId: number | null;
  readonly subjectRoleCode: string | null;
  readonly subjectCommitteeId: number | null;
  readonly decisionType: AuthorityLimitsDecisionType;
  readonly maxAmount: string | null;
  readonly currency: string;
  readonly legalEntityId: number | null;
  readonly categoryId: number | null;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly approvedByUserId: number | null;
}

const userLimit = (
  limitId: number,
  tenantId: number,
  login: string | number,
  decisionType: AuthorityLimitsDecisionType,
  maxAmount: string | null,
  extra: Partial<FixtureAuthorityLimit> = {},
): FixtureAuthorityLimit => ({
  limitId,
  tenantId,
  subjectType: 'user',
  subjectUserId: typeof login === 'number' ? login : uid(login),
  subjectRoleCode: null,
  subjectCommitteeId: null,
  decisionType,
  maxAmount,
  currency: 'BWP',
  legalEntityId: null,
  categoryId: null,
  effectiveFrom: '2026-04-01T00:00:00Z',
  effectiveTo: null,
  approvedByUserId: uid('keabetswe.approver'),
  ...extra,
});

const KWU = TENANT_IDS.kwu;

export const AUTHORITY_LIMITS: readonly FixtureAuthorityLimit[] = Object.freeze([
  userLimit(1, KWU, 'mpho.manager', 'request_approval', '2000000.00'),
  userLimit(2, KWU, 'mpho.manager', 'release_approval', '2000000.00'),
  userLimit(3, KWU, 'mpho.manager', 'strategy_approval', '2000000.00'),
  userLimit(4, KWU, 'mpho.manager', 'qualification_decision', null, { categoryId: 1 }),
  userLimit(5, KWU, 'mpho.manager', 'change_approval', '2000000.00', { legalEntityId: 1, effectiveTo: '2027-03-31T23:59:59Z' }),
  userLimit(6, KWU, 'keabetswe.approver', 'award_approval', '10000000.00', { approvedByUserId: null }),
  userLimit(7, KWU, 'keabetswe.approver', 'request_approval', '10000000.00', { approvedByUserId: null }),
  userLimit(8, KWU, 'keabetswe.approver', 'contract_signature', '10000000.00', { approvedByUserId: null, legalEntityId: 1 }),
  userLimit(9, KWU, 'keabetswe.approver', 'contract_approval', '10000000.00', { approvedByUserId: null }),
  userLimit(10, KWU, 'onalenna.budget', 'funding_confirmation', '5000000.00'),
  userLimit(17, KWU, 'keabetswe.approver', 'change_approval', '10000000.00', { approvedByUserId: null }),
  {
    limitId: 11, tenantId: KWU, subjectType: 'role', subjectUserId: null, subjectRoleCode: 'procurement_officer', subjectCommitteeId: null,
    decisionType: 'change_approval', maxAmount: '250000.00', currency: 'BWP', legalEntityId: null, categoryId: null,
    effectiveFrom: '2026-04-01T00:00:00Z', effectiveTo: null, approvedByUserId: uid('keabetswe.approver'),
  },
  {
    limitId: 12, tenantId: KWU, subjectType: 'committee', subjectUserId: null, subjectRoleCode: null, subjectCommitteeId: 1,
    decisionType: 'award_approval', maxAmount: null, currency: 'BWP', legalEntityId: 1, categoryId: null,
    effectiveFrom: '2026-04-01T00:00:00Z', effectiveTo: null, approvedByUserId: uid('keabetswe.approver'),
  },
  userLimit(13, KWU, 'former.officer', 'request_approval', '250000.00', { effectiveFrom: '2025-11-03T00:00:00Z', effectiveTo: '2026-07-01T15:00:00Z' }),
  userLimit(14, KWU, 'mpho.manager', 'award_approval', '1500000.00', { effectiveFrom: '2025-04-01T00:00:00Z', effectiveTo: '2026-03-31T23:59:59Z' }),
  userLimit(15, TENANT_IDS.odc, 'officer.odc', 'request_approval', '500000.00', { approvedByUserId: uid('admin.odc'), effectiveFrom: '2026-03-01T00:00:00Z' }),
  userLimit(16, TENANT_IDS.odc, 113, 'funding_confirmation', '750000.00', { approvedByUserId: uid('admin.odc'), effectiveFrom: '2026-03-09T00:00:00Z' }),
  // Supplier signing limits (SUP-04)
  userLimit(21, TENANT_IDS.tsodilo, 'tsodilo.signatory', 'contract_signature', '5000000.00', { approvedByUserId: uid('tsodilo.admin'), effectiveFrom: '2026-02-12T00:00:00Z' }),
  userLimit(22, TENANT_IDS['chobe-pipe'], 'chobe-pipe.signatory', 'contract_signature', '2500000.00', { approvedByUserId: uid('chobe-pipe.admin'), effectiveFrom: '2026-02-13T00:00:00Z' }),
  userLimit(23, TENANT_IDS['serowe-ict'], 'serowe-ict.signatory', 'contract_signature', '3000000.00', { approvedByUserId: uid('serowe-ict.admin'), effectiveFrom: '2026-03-10T00:00:00Z' }),
  userLimit(24, TENANT_IDS['gaborone-meter'], 'gaborone-meter.signatory', 'contract_signature', '1500000.00', { approvedByUserId: uid('gaborone-meter.admin'), effectiveFrom: '2026-03-24T00:00:00Z', effectiveTo: '2027-03-23T23:59:59Z' }),
] satisfies FixtureAuthorityLimit[]);

export interface FixtureDelegation {
  readonly delegationId: number;
  readonly tenantId: number;
  readonly delegatorUserId: number;
  readonly delegateUserId: number;
  readonly decisionTypes: readonly AuthorityLimitsDecisionType[];
  readonly maxAmount: string | null;
  readonly currency: string;
  readonly legalEntityId: number | null;
  readonly categoryId: number | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reason: string;
  readonly revokedAt: string | null;
  readonly revokedByUserId: number | null;
}

export const DELEGATIONS: readonly FixtureDelegation[] = Object.freeze([
  {
    delegationId: 1, tenantId: KWU, delegatorUserId: uid('keabetswe.approver'), delegateUserId: uid('mpho.manager'),
    decisionTypes: ['change_approval'], maxAmount: '500000.00', currency: 'BWP', legalEntityId: null, categoryId: null,
    startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-20T22:00:00Z', reason: 'Chief Executive on leave 1–20 October 2026; contract changes up to BWP 500,000.00.', revokedAt: null, revokedByUserId: null,
  },
  {
    delegationId: 2, tenantId: KWU, delegatorUserId: uid('mpho.manager'), delegateUserId: uid('former.officer'),
    decisionTypes: ['request_approval'], maxAmount: '250000.00', currency: 'BWP', legalEntityId: null, categoryId: null,
    startsAt: '2026-05-01T06:00:00Z', endsAt: '2026-08-31T15:00:00Z', reason: 'Low-value request approvals during the planning peak.',
    revokedAt: '2026-07-01T15:00:00Z', revokedByUserId: uid('admin.kwu'),
  },
  {
    delegationId: 3, tenantId: KWU, delegatorUserId: uid('onalenna.budget'), delegateUserId: uid('lesego.finance'),
    decisionTypes: ['funding_confirmation'], maxAmount: '1000000.00', currency: 'BWP', legalEntityId: null, categoryId: null,
    startsAt: '2026-08-03T06:00:00Z', endsAt: '2026-08-14T15:00:00Z', reason: 'Budget owner at the regional finance workshop.', revokedAt: null, revokedByUserId: null,
  },
  {
    delegationId: 4, tenantId: KWU, delegatorUserId: uid('mpho.manager'), delegateUserId: uid('dineo.legal'),
    decisionTypes: ['release_approval'], maxAmount: '500000.00', currency: 'BWP', legalEntityId: null, categoryId: null,
    startsAt: '2026-09-28T06:00:00Z', endsAt: '2026-10-16T15:00:00Z', reason: 'Release approvals of low-value RFQs while the manager travels.', revokedAt: null, revokedByUserId: null,
  },
  {
    delegationId: 5, tenantId: TENANT_IDS.tsodilo, delegatorUserId: uid('tsodilo.signatory'), delegateUserId: uid('tsodilo.bidmanager'),
    decisionTypes: ['contract_signature'], maxAmount: '1000000.00', currency: 'BWP', legalEntityId: null, categoryId: null,
    startsAt: '2026-10-05T06:00:00Z', endsAt: '2026-10-30T15:00:00Z', reason: 'Managing Director travelling for the pump factory audit.', revokedAt: null, revokedByUserId: null,
  },
] satisfies FixtureDelegation[]);

export interface FixtureCommitteeMember {
  readonly memberId: number;
  readonly userId: number;
  readonly memberRole: CommitteeMembersMemberRole;
  readonly startsAt: string;
  readonly endsAt: string | null;
}

export interface FixtureCommittee {
  readonly committeeId: number;
  readonly tenantId: number;
  readonly name: string;
  readonly purpose: CommitteesPurpose;
  readonly quorum: number;
  readonly legalEntityId: number | null;
  readonly active: boolean;
  readonly deactivatedAt: string | null;
  /** Open evaluations or decisions the committee still has to close (blocks deactivation). */
  readonly openWork: readonly string[];
  readonly members: readonly FixtureCommitteeMember[];
}

const seat = (memberId: number, login: string | number, memberRole: CommitteeMembersMemberRole, startsAt: string, endsAt: string | null = null) => ({
  memberId,
  userId: typeof login === 'number' ? login : uid(login),
  memberRole,
  startsAt,
  endsAt,
});

export const COMMITTEES: readonly FixtureCommittee[] = Object.freeze([
  {
    committeeId: 1, tenantId: KWU, name: 'Tender Award Committee', purpose: 'award', quorum: 3, legalEntityId: 1, active: true, deactivatedAt: null,
    openWork: ['T-2026-0001 award recommendation, Lot 3'],
    members: [
      seat(1, 'keabetswe.approver', 'chair', '2026-04-01T00:00:00Z'),
      seat(2, 'mpho.manager', 'member', '2026-04-01T00:00:00Z'),
      seat(3, 'dineo.legal', 'member', '2026-04-01T00:00:00Z'),
      seat(4, 'onalenna.budget', 'alternate', '2026-04-01T00:00:00Z'),
      seat(5, 'tebogo.officer', 'secretary', '2026-04-01T00:00:00Z'),
    ],
  },
  {
    committeeId: 2, tenantId: KWU, name: 'SCADA Bid Evaluation Committee (T-2026-0003)', purpose: 'evaluation', quorum: 3, legalEntityId: 1, active: true, deactivatedAt: null,
    openWork: ['T-2026-0003 technical and commercial evaluation'],
    members: [
      seat(6, 'boitumelo.chair', 'chair', '2026-08-31T07:00:00Z'),
      seat(7, 'thato.eval', 'member', '2026-08-31T07:00:00Z'),
      seat(8, 'kabo.eval', 'member', '2026-08-31T07:00:00Z'),
      seat(9, 'amantle.eval', 'member', '2026-08-31T07:00:00Z'),
      seat(10, 'sam.dual', 'member', '2026-08-31T07:00:00Z', '2026-09-16T08:00:00Z'),
      seat(11, 101, 'alternate', '2026-09-16T08:00:00Z'),
    ],
  },
  {
    committeeId: 3, tenantId: KWU, name: 'Bid Opening Panel', purpose: 'opening', quorum: 2, legalEntityId: null, active: true, deactivatedAt: null,
    openWork: ['T-2026-0008 bid opening'],
    members: [seat(12, 'oratile.opener', 'chair', '2026-04-01T00:00:00Z'), seat(13, 'goitse.witness', 'member', '2026-04-01T00:00:00Z')],
  },
  {
    committeeId: 4, tenantId: KWU, name: 'Complaints Review Panel', purpose: 'complaints', quorum: 3, legalEntityId: 1, active: true, deactivatedAt: null,
    openWork: [],
    members: [
      seat(14, 'dineo.legal', 'chair', '2026-04-01T00:00:00Z'),
      seat(15, 108, 'member', '2026-09-01T07:00:00Z'),
      seat(16, 'boitumelo.chair', 'member', '2026-04-01T00:00:00Z', '2026-08-28T12:00:00Z'),
    ],
  },
  {
    committeeId: 5, tenantId: KWU, name: 'Tender Committee 2025', purpose: 'award', quorum: 3, legalEntityId: 3, active: false, deactivatedAt: '2026-01-31T15:00:00Z',
    openWork: [],
    members: [
      seat(17, 'mpho.manager', 'chair', '2025-02-01T00:00:00Z', '2026-01-31T15:00:00Z'),
      seat(18, 'dineo.legal', 'member', '2025-02-01T00:00:00Z', '2026-01-31T15:00:00Z'),
      seat(19, 'former.officer', 'secretary', '2025-11-03T00:00:00Z', '2026-01-31T15:00:00Z'),
    ],
  },
] satisfies FixtureCommittee[]);
