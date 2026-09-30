/**
 * Org-admin fixtures: every member of every organization (ADM-03, SUP-04) and their role assignments.
 *
 * - Persona memberships come from `platform.ts` (the single source of who can sign in). They are projected here with
 *   their directory data (joined, last seen, ended) and one organization-scoped role assignment per role.
 * - People who cannot sign in (invited newcomers, a dormant evaluator, a suspended assistant, a departed supplier
 *   bid coordinator) are added here with user ids from 101, so every lifecycle state is visible (FR-03, AC-04).
 * - Extra custom roles per tenant sit next to the platform's template copies; no persona holds them, so the
 *   permissions the mock API enforces are unchanged.
 * - Group-based and scoped role assignments only repeat roles the member already holds organization-wide, again so
 *   that effective permissions stay equal to what `/me/context` reports.
 */
import type { MembershipsStatus, RoleAssignmentsScopeType, UsersStatus } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { PERSONAS, TENANTS, TENANT_IDS, TENANT_ROLES } from '../platform.js';
import type { FixtureRole } from '../platform.js';
import { sessionProfileOf } from '../session.js';
import { uid } from './refs.js';

export interface FixtureMember {
  readonly tenantId: number;
  readonly userId: number;
  readonly membershipId: number;
  readonly fullName: string;
  readonly email: string;
  readonly capacity: string | null;
  readonly membershipStatus: MembershipsStatus;
  readonly userStatus: UsersStatus;
  readonly joinedAt: string | null;
  /** When the invitation or membership request was made (`invited`, `pending_approval`). */
  readonly requestedAt: string | null;
  readonly endedAt: string | null;
  readonly endReason: string | null;
  readonly lastSeenAt: string | null;
  readonly isPersona: boolean;
}

export interface FixtureRoleAssignment {
  readonly assignmentId: number;
  readonly tenantId: number;
  readonly userId: number | null;
  readonly groupId: number | null;
  readonly roleCode: string;
  readonly scopeType: RoleAssignmentsScopeType;
  readonly scopeId: number | null;
  readonly scopeLabel: string;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly grantedByUserId: number | null;
  readonly revokedAt: string | null;
  readonly reason: string | null;
}

interface ExtraPerson {
  readonly userId: number;
  readonly membershipId: number;
  readonly tenantId: number;
  readonly fullName: string;
  readonly email: string;
  readonly capacity: string;
  readonly roles: readonly string[];
  readonly membershipStatus: MembershipsStatus;
  readonly userStatus: UsersStatus;
  readonly joinedAt: string | null;
  readonly requestedAt: string | null;
  readonly endedAt: string | null;
  readonly endReason: string | null;
  readonly lastSeenAt: string | null;
}

/** People without a demo account (they cannot sign in). */
const EXTRA_PEOPLE: readonly ExtraPerson[] = [
  // Kalahari Water Utilities
  {
    userId: 101, membershipId: 501, tenantId: TENANT_IDS.kwu, fullName: 'Boipelo Sebina', email: 'boipelo.sebina@kwu.co.bw',
    capacity: 'Evaluator, Hydrology', roles: ['evaluator'], membershipStatus: 'active', userStatus: 'active',
    joinedAt: '2026-02-16T07:00:00Z', requestedAt: null, endedAt: null, endReason: null, lastSeenAt: '2026-05-02T13:20:00Z',
  },
  {
    userId: 102, membershipId: 502, tenantId: TENANT_IDS.kwu, fullName: 'Onkemetse Pilane', email: 'onkemetse.pilane@kwu.co.bw',
    capacity: 'Procurement Assistant', roles: ['procurement_officer'], membershipStatus: 'suspended', userStatus: 'active',
    joinedAt: '2026-03-02T07:00:00Z', requestedAt: null, endedAt: null, endReason: null, lastSeenAt: '2026-09-17T15:02:00Z',
  },
  {
    userId: 103, membershipId: 503, tenantId: TENANT_IDS.kwu, fullName: 'Naledi Moyo', email: 'naledi.moyo@kwu.co.bw',
    capacity: 'Procurement Officer', roles: ['procurement_officer'], membershipStatus: 'invited', userStatus: 'invited',
    joinedAt: null, requestedAt: '2026-09-25T08:30:00Z', endedAt: null, endReason: null, lastSeenAt: null,
  },
  {
    userId: 104, membershipId: 504, tenantId: TENANT_IDS.kwu, fullName: 'Kopano Dube', email: 'kopano.dube@kwu.co.bw',
    capacity: 'Evaluator, Hydrology', roles: ['evaluator'], membershipStatus: 'invited', userStatus: 'invited',
    joinedAt: null, requestedAt: '2026-09-06T09:00:00Z', endedAt: null, endReason: null, lastSeenAt: null,
  },
  {
    userId: 105, membershipId: 505, tenantId: TENANT_IDS.kwu, fullName: 'Tlotlo Ramasedi', email: 'tlotlo.ramasedi@kwu.co.bw',
    capacity: 'Budget Analyst', roles: ['budget_owner'], membershipStatus: 'invited', userStatus: 'invited',
    joinedAt: null, requestedAt: '2026-09-28T11:15:00Z', endedAt: null, endReason: null, lastSeenAt: null,
  },
  {
    userId: 106, membershipId: 506, tenantId: TENANT_IDS.kwu, fullName: 'Mothusi Kgari', email: 'mothusi.kgari@kwu.co.bw',
    capacity: 'Contract Administrator', roles: ['contract_manager'], membershipStatus: 'invited', userStatus: 'invited',
    joinedAt: null, requestedAt: '2026-08-20T10:00:00Z', endedAt: null, endReason: null, lastSeenAt: null,
  },
  {
    userId: 107, membershipId: 507, tenantId: TENANT_IDS.kwu, fullName: 'Lebogang Seane', email: 'lebogang.seane@consult.co.bw',
    capacity: 'External Technical Adviser', roles: ['evaluator'], membershipStatus: 'revoked', userStatus: 'invited',
    joinedAt: null, requestedAt: '2026-09-10T09:40:00Z', endedAt: '2026-09-12T08:00:00Z',
    endReason: 'Invitation revoked: the advisory engagement was not approved.', lastSeenAt: null,
  },
  {
    userId: 108, membershipId: 508, tenantId: TENANT_IDS.kwu, fullName: 'Kgomotso Mogapi', email: 'kgomotso.mogapi@kwu.co.bw',
    capacity: 'Records Officer', roles: ['records_officer'], membershipStatus: 'active', userStatus: 'active',
    joinedAt: '2026-09-01T07:00:00Z', requestedAt: null, endedAt: null, endReason: null, lastSeenAt: '2026-09-29T12:44:00Z',
  },
  {
    // A seconded evaluator whose membership ended with the secondment; the account stays active, so ADM-03 offers
    // "recover membership" (for example when the secondment is renewed).
    userId: 109, membershipId: 509, tenantId: TENANT_IDS.kwu, fullName: 'Refilwe Kebonang', email: 'refilwe.kebonang@kwu.co.bw',
    capacity: 'Evaluator, Water Quality (seconded)', roles: ['evaluator'], membershipStatus: 'revoked', userStatus: 'active',
    joinedAt: '2026-03-16T07:00:00Z', requestedAt: null, endedAt: '2026-08-28T15:00:00Z',
    endReason: 'Secondment from the Department of Water Affairs ended on 28 Aug 2026.', lastSeenAt: '2026-08-28T14:05:00Z',
  },
  // Okavango District Council
  {
    userId: 111, membershipId: 511, tenantId: TENANT_IDS.odc, fullName: 'Tumisang Letsweletse', email: 'tumisang.letsweletse@odc.gov.bw',
    capacity: 'Works Engineer', roles: ['requester'], membershipStatus: 'invited', userStatus: 'invited',
    joinedAt: null, requestedAt: '2026-09-23T07:45:00Z', endedAt: null, endReason: null, lastSeenAt: null,
  },
  {
    // A demo account invited into a second buyer (COM-01 acceptance is demonstrable signed in as dineo.legal).
    userId: uid('dineo.legal'), membershipId: 514, tenantId: TENANT_IDS.odc, fullName: 'Dineo Masire', email: 'dineo.legal@tenderiq.local',
    capacity: 'Legal Adviser (shared service)', roles: ['legal_reviewer'], membershipStatus: 'invited', userStatus: 'active',
    joinedAt: null, requestedAt: '2026-09-29T09:00:00Z', endedAt: null, endReason: null, lastSeenAt: '2026-09-29T14:20:00Z',
  },
  {
    // A temporary works supervisor whose membership ended with the project phase; recoverable on ADM-03.
    userId: 114, membershipId: 515, tenantId: TENANT_IDS.odc, fullName: 'Goitseone Mokgadi', email: 'goitseone.mokgadi@odc.gov.bw',
    capacity: 'Works Supervisor (fixed term)', roles: ['requester'], membershipStatus: 'revoked', userStatus: 'active',
    joinedAt: '2026-02-02T07:00:00Z', requestedAt: null, endedAt: '2026-07-31T15:00:00Z',
    endReason: 'Fixed-term appointment for the clinic extension ended on 31 Jul 2026.', lastSeenAt: '2026-07-31T13:40:00Z',
  },
  {
    userId: 113, membershipId: 513, tenantId: TENANT_IDS.odc, fullName: 'Oarabile Ntwayagae', email: 'oarabile.ntwayagae@odc.gov.bw',
    capacity: 'Finance Officer', roles: ['budget_owner'], membershipStatus: 'active', userStatus: 'active',
    joinedAt: '2026-03-09T07:00:00Z', requestedAt: null, endedAt: null, endReason: null, lastSeenAt: '2026-09-28T09:10:00Z',
  },
  // Suppliers
  {
    userId: 121, membershipId: 521, tenantId: TENANT_IDS.tsodilo, fullName: 'Kelebogile Tau', email: 'kelebogile.tau@tsodilo.co.bw',
    capacity: 'Bid Coordinator (departed)', roles: ['commercial_contributor'], membershipStatus: 'revoked', userStatus: 'deactivated',
    joinedAt: '2026-02-12T07:00:00Z', requestedAt: null, endedAt: '2026-09-26T16:00:00Z',
    endReason: 'Left the company on 26 Sep 2026.', lastSeenAt: '2026-09-26T15:31:00Z',
  },
  {
    userId: 122, membershipId: 522, tenantId: TENANT_IDS.tsodilo, fullName: 'Lorato Mosweu', email: 'lorato.mosweu@tsodilo.co.bw',
    capacity: 'Commercial Contributor', roles: ['commercial_contributor'], membershipStatus: 'invited', userStatus: 'invited',
    joinedAt: null, requestedAt: '2026-09-27T08:05:00Z', endedAt: null, endReason: null, lastSeenAt: null,
  },
  {
    userId: 123, membershipId: 523, tenantId: TENANT_IDS['chobe-pipe'], fullName: 'Dikeledi Phiri', email: 'dikeledi.phiri@chobepipe.co.bw',
    capacity: 'Finance Officer', roles: ['supplier_finance'], membershipStatus: 'invited', userStatus: 'invited',
    joinedAt: null, requestedAt: '2026-09-01T10:20:00Z', endedAt: null, endReason: null, lastSeenAt: null,
  },
  {
    userId: 124, membershipId: 524, tenantId: TENANT_IDS['gaborone-meter'], fullName: 'Thabiso Kgosana', email: 'thabiso.kgosana@gabmeter.co.bw',
    capacity: 'Commercial Contributor', roles: ['commercial_contributor'], membershipStatus: 'suspended', userStatus: 'active',
    joinedAt: '2026-04-06T07:00:00Z', requestedAt: null, endedAt: null, endReason: null, lastSeenAt: '2026-09-21T10:12:00Z',
  },
  {
    userId: 125, membershipId: 525, tenantId: TENANT_IDS.makgadikgadi, fullName: 'Masego Sebati', email: 'masego.sebati@makgadikgadi.co.bw',
    capacity: 'Finance Officer', roles: ['supplier_finance'], membershipStatus: 'invited', userStatus: 'invited',
    joinedAt: null, requestedAt: '2026-09-29T13:00:00Z', endedAt: null, endReason: null, lastSeenAt: null,
  },
];

/** Custom roles beyond the platform's template copies and KWU's "Opening witness". No persona holds them. */
export const EXTRA_ROLES: readonly (FixtureRole & { readonly description: string; readonly active: boolean; readonly deactivatedAt: string | null })[] =
  Object.freeze([
    {
      roleId: TENANT_IDS.kwu * 100 + 91,
      tenantId: TENANT_IDS.kwu,
      code: 'records_officer',
      name: 'Records officer',
      templateCode: null,
      description: 'Retention schedules, legal holds and audit trails for the records programme.',
      permissions: ['dashboard.view', 'report.view', 'audit.view', 'records.retention.manage', 'records.hold.manage'] satisfies PermissionCode[],
      active: true,
      deactivatedAt: null,
    },
    {
      roleId: TENANT_IDS.kwu * 100 + 92,
      tenantId: TENANT_IDS.kwu,
      code: 'tender_committee_2025',
      name: 'Tender committee member (2025)',
      templateCode: null,
      description: 'Former tender committee seat, replaced by the Tender Award Committee in 2026.',
      permissions: ['dashboard.view', 'tender.view', 'award.recommend'] satisfies PermissionCode[],
      active: false,
      deactivatedAt: '2026-01-31T15:00:00Z',
    },
  ]);

/** Descriptions and state of the platform roles (template copies and KWU's custom "Opening witness"). */
export const PLATFORM_ROLE_DESCRIPTIONS: Readonly<Record<string, string>> = Object.freeze({
  opening_witness: 'Witnesses bid openings for Internal Audit; no authority to open envelopes.',
});

/** Every role of a tenant: platform roles (all active) and the extra custom roles. */
export function tenantRoles(tenantId: number): Array<FixtureRole & { description: string | null; active: boolean; deactivatedAt: string | null }> {
  return [
    ...TENANT_ROLES.filter((role) => role.tenantId === tenantId).map((role) => ({
      ...role,
      description: PLATFORM_ROLE_DESCRIPTIONS[role.code] ?? null,
      active: true,
      deactivatedAt: null,
    })),
    ...EXTRA_ROLES.filter((role) => role.tenantId === tenantId).map((role) => ({ ...role })),
  ];
}

export function findTenantRoleByCode(tenantId: number, code: string) {
  return tenantRoles(tenantId).find((role) => role.code === code);
}

export function findTenantRoleById(tenantId: number, roleId: number) {
  return tenantRoles(tenantId).find((role) => role.roleId === roleId);
}

/** The administrator of each organization, who granted the initial roles. */
const ADMINISTRATOR_OF: Readonly<Record<number, string>> = {
  [TENANT_IDS['tenderiq-ops']]: 'ops.admin',
  [TENANT_IDS.kwu]: 'admin.kwu',
  [TENANT_IDS.odc]: 'admin.odc',
  [TENANT_IDS.tsodilo]: 'tsodilo.admin',
  [TENANT_IDS['chobe-pipe']]: 'chobe-pipe.admin',
  [TENANT_IDS.makgadikgadi]: 'makgadikgadi.admin',
  [TENANT_IDS['serowe-ict']]: 'serowe-ict.admin',
  [TENANT_IDS['limpopo-env']]: 'limpopo-env.admin',
  [TENANT_IDS['gaborone-meter']]: 'gaborone-meter.admin',
};

export function administratorOf(tenantId: number): number {
  const login = ADMINISTRATOR_OF[tenantId];
  if (login === undefined) {
    throw new Error(`No administrator for tenant ${tenantId}.`);
  }
  return uid(login);
}

/** Directory data of persona memberships that the platform fixture does not carry. */
const PERSONA_MEMBERSHIP_DETAILS: Readonly<Record<string, Partial<Pick<FixtureMember, 'joinedAt' | 'requestedAt' | 'endedAt' | 'endReason'>>>> = {
  'former.officer@kwu': {
    joinedAt: '2025-11-03T07:00:00Z',
    endedAt: '2026-07-01T15:00:00Z',
    endReason: 'Left Kalahari Water Utilities on 30 Jun 2026 (resignation).',
  },
  'sam.dual@serowe-ict': { requestedAt: '2026-09-24T09:15:00Z' },
  'sam.dual@kwu': { joinedAt: '2026-04-01T07:00:00Z' },
  'sam.dual@tsodilo': { joinedAt: '2026-04-10T07:00:00Z' },
  'sam.dual@chobe-pipe': { joinedAt: '2026-05-04T07:00:00Z' },
  'tsodilo.contributor@tsodilo': { joinedAt: '2026-03-02T07:00:00Z' },
};

function personaMembers(): FixtureMember[] {
  return PERSONAS.flatMap((persona) =>
    persona.memberships.map((membership) => {
      const tenant = TENANTS.find((candidate) => candidate.id === membership.tenantId);
      const key = `${persona.email.split('@')[0] ?? ''}@${tenant?.slug ?? ''}`;
      const details = PERSONA_MEMBERSHIP_DETAILS[key] ?? {};
      return {
        tenantId: membership.tenantId,
        userId: persona.userId,
        membershipId: membership.membershipId,
        fullName: persona.fullName,
        email: persona.email,
        capacity: membership.capacity,
        membershipStatus: membership.status,
        userStatus: persona.status,
        joinedAt: details.joinedAt ?? membership.joinedAt,
        requestedAt: details.requestedAt ?? null,
        endedAt: details.endedAt ?? null,
        endReason: details.endReason ?? null,
        lastSeenAt: sessionProfileOf(persona.email).lastSeenAt,
        isPersona: true,
      };
    }),
  );
}

/**
 * Every membership of every organization (personas first, then people without a demo account). A persona membership
 * that this file describes in more detail (dineo.legal's ODC invitation) is listed once, with those details.
 */
export const MEMBERS: readonly FixtureMember[] = Object.freeze([
  ...personaMembers().filter((member) => !EXTRA_PEOPLE.some((person) => person.membershipId === member.membershipId)),
  ...EXTRA_PEOPLE.map((person) => ({
    tenantId: person.tenantId,
    userId: person.userId,
    membershipId: person.membershipId,
    fullName: person.fullName,
    email: person.email,
    capacity: person.capacity,
    membershipStatus: person.membershipStatus,
    userStatus: person.userStatus,
    joinedAt: person.joinedAt,
    requestedAt: person.requestedAt,
    endedAt: person.endedAt,
    endReason: person.endReason,
    lastSeenAt: person.lastSeenAt,
    isPersona: PERSONAS.some((persona) => persona.userId === person.userId),
  })),
]);

/** The name and e-mail of any user id that appears in the fixtures. */
export function personName(userId: number): string {
  const member = MEMBERS.find((candidate) => candidate.userId === userId);
  if (member === undefined) {
    throw new Error(`Unknown user ${userId}.`);
  }
  return member.fullName;
}

export function memberOf(tenantId: number, userId: number): FixtureMember | undefined {
  return MEMBERS.find((member) => member.tenantId === tenantId && member.userId === userId);
}

// ---------------------------------------------------------------------------------------------------------
// Role assignments
// ---------------------------------------------------------------------------------------------------------

const ORGANIZATION_LABEL = 'Whole organization';

/**
 * An invitation or a membership request grants nothing before acceptance or approval (FR-03): the roles it proposes
 * travel with the invitation, and approval creates the assignments.
 */
function grantsNothingYet(status: MembershipsStatus): boolean {
  return status === 'invited' || status === 'pending_approval';
}

function roleAssignmentsOfMembers(): FixtureRoleAssignment[] {
  const rows: FixtureRoleAssignment[] = [];
  for (const persona of PERSONAS) {
    for (const membership of persona.memberships) {
      if (grantsNothingYet(membership.status)) {
        continue;
      }
      membership.roles.forEach((role, index) => {
        const member = MEMBERS.find((candidate) => candidate.membershipId === membership.membershipId);
        const revoked = membership.status === 'revoked';
        rows.push({
          assignmentId: membership.membershipId * 10 + index + 1,
          tenantId: membership.tenantId,
          userId: persona.userId,
          groupId: null,
          roleCode: role.roleCode,
          scopeType: role.scopeType,
          scopeId: role.scopeId,
          scopeLabel: role.scopeLabel ?? ORGANIZATION_LABEL,
          startsAt: member?.joinedAt ?? member?.requestedAt ?? '2026-04-01T07:00:00Z',
          endsAt: null,
          grantedByUserId: persona.userId === administratorOf(membership.tenantId) ? null : administratorOf(membership.tenantId),
          revokedAt: revoked ? (member?.endedAt ?? '2026-07-01T15:00:00Z') : null,
          reason: null,
        });
      });
    }
  }
  for (const person of EXTRA_PEOPLE) {
    if (grantsNothingYet(person.membershipStatus)) {
      continue;
    }
    person.roles.forEach((roleCode, index) => {
      const ended = person.membershipStatus === 'revoked';
      rows.push({
        assignmentId: person.membershipId * 10 + index + 1,
        tenantId: person.tenantId,
        userId: person.userId,
        groupId: null,
        roleCode,
        scopeType: 'organization',
        scopeId: null,
        scopeLabel: ORGANIZATION_LABEL,
        startsAt: person.joinedAt ?? person.requestedAt ?? '2026-09-01T07:00:00Z',
        endsAt: null,
        grantedByUserId: administratorOf(person.tenantId),
        revokedAt: ended ? person.endedAt : null,
        reason: null,
      });
    });
  }
  return rows;
}

/** Scoped, time-limited, historical and group role assignments. */
const EXTRA_ROLE_ASSIGNMENTS: readonly FixtureRoleAssignment[] = [
  // KWU: the SCADA evaluation panel holds the evaluator role for T-2026-0003 through its group.
  {
    assignmentId: 9001, tenantId: TENANT_IDS.kwu, userId: null, groupId: 1, roleCode: 'evaluator',
    scopeType: 'tender', scopeId: 3, scopeLabel: 'T-2026-0003 SCADA telemetry upgrade',
    startsAt: '2026-08-31T07:00:00Z', endsAt: '2026-12-18T15:00:00Z', grantedByUserId: uid('admin.kwu'), revokedAt: null,
    reason: 'Evaluation panel appointed by the procurement manager for T-2026-0003.',
  },
  {
    assignmentId: 9002, tenantId: TENANT_IDS.kwu, userId: null, groupId: 2, roleCode: 'opening_witness',
    scopeType: 'organization', scopeId: null, scopeLabel: ORGANIZATION_LABEL,
    startsAt: '2026-04-01T07:00:00Z', endsAt: null, grantedByUserId: uid('admin.kwu'), revokedAt: null,
    reason: 'Standing bid opening panel.',
  },
  {
    assignmentId: 9003, tenantId: TENANT_IDS.kwu, userId: null, groupId: 3, roleCode: 'contract_manager',
    scopeType: 'contract', scopeId: 1, scopeLabel: 'C-2026-0001 Fleet maintenance',
    startsAt: '2026-06-01T07:00:00Z', endsAt: null, grantedByUserId: uid('admin.kwu'), revokedAt: null,
    reason: 'Contract management team for the fleet maintenance contract.',
  },
  {
    assignmentId: 9004, tenantId: TENANT_IDS.kwu, userId: null, groupId: 4, roleCode: 'tender_committee_2025',
    scopeType: 'organization', scopeId: null, scopeLabel: ORGANIZATION_LABEL,
    startsAt: '2025-02-01T07:00:00Z', endsAt: '2026-01-31T15:00:00Z', grantedByUserId: uid('admin.kwu'), revokedAt: null,
    reason: 'Tender committee 2025 term.',
  },
  // KWU: a historic evaluator appointment of the departed officer and a revoked second role.
  {
    assignmentId: 9005, tenantId: TENANT_IDS.kwu, userId: uid('former.officer'), groupId: null, roleCode: 'evaluator',
    scopeType: 'tender', scopeId: 7, scopeLabel: 'T-2026-0007 Reservoir rehabilitation works',
    startsAt: '2026-05-04T07:00:00Z', endsAt: '2026-08-31T15:00:00Z', grantedByUserId: uid('admin.kwu'),
    revokedAt: '2026-07-01T15:00:00Z', reason: 'Technical evaluator for the reservoir works.',
  },
  {
    assignmentId: 9006, tenantId: TENANT_IDS.kwu, userId: uid('tebogo.officer'), groupId: null, roleCode: 'procurement_officer',
    scopeType: 'tender', scopeId: 8, scopeLabel: 'T-2026-0008 Pipeline valves bulk supply',
    startsAt: '2026-07-01T15:00:00Z', endsAt: null, grantedByUserId: uid('admin.kwu'), revokedAt: null,
    reason: 'Took over T-2026-0008 from the departed tender owner (AC-04).',
  },
  // Tsodilo: the SCADA bid team holds the contributor role for T-2026-0003.
  {
    assignmentId: 9011, tenantId: TENANT_IDS.tsodilo, userId: null, groupId: 6, roleCode: 'contributor',
    scopeType: 'tender', scopeId: 3, scopeLabel: 'T-2026-0003 SCADA telemetry upgrade',
    startsAt: '2026-07-20T07:00:00Z', endsAt: null, grantedByUserId: uid('tsodilo.admin'), revokedAt: null,
    reason: 'SCADA bid team.',
  },
  {
    assignmentId: 9012, tenantId: TENANT_IDS['chobe-pipe'], userId: null, groupId: 8, roleCode: 'contributor',
    scopeType: 'tender', scopeId: 8, scopeLabel: 'T-2026-0008 Pipeline valves bulk supply',
    startsAt: '2026-08-10T07:00:00Z', endsAt: null, grantedByUserId: uid('chobe-pipe.admin'), revokedAt: null,
    reason: 'Valves bid team.',
  },
];

export const ROLE_ASSIGNMENTS: readonly FixtureRoleAssignment[] = Object.freeze([
  ...roleAssignmentsOfMembers(),
  ...EXTRA_ROLE_ASSIGNMENTS,
]);
