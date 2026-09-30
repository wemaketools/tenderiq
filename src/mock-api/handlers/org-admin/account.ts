/**
 * Org-admin mock handlers, account part: COM-01 invitation preview and acceptance, COM-02 memberships, COM-03
 * profile and personal access (DD-21, DD-27). Commands answer with the outcome; nothing is stored.
 */
import {
  acceptInvitation,
  cancelContactChange,
  getMyAccessSummary,
  getMyProfile,
  leaveMembership,
  listMyMemberships,
  previewInvitation,
  requestContactChange,
  updateMyProfile,
  withdrawMembershipRequest,
} from '../../../contracts/org-admin.js';
import type { MyMembership, MyProfile } from '../../../contracts/org-admin.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  ACCESS_GRANTS,
  ACCESS_RESTRICTIONS,
  CONTACT_CHANGES,
  DELEGATIONS,
  INVITATIONS,
  MEMBERS,
  WORK_ITEMS,
  findTenantRoleByCode,
} from '../../fixtures/org-admin/index.js';
import type { FixtureMember } from '../../fixtures/org-admin/index.js';
import { TENANTS } from '../../fixtures/platform.js';
import { sessionProfileOf } from '../../fixtures/session.js';
import type { Persona } from '../../persona.js';
import {
  activeAdministrators,
  delegationRow,
  grantRow,
  invitationStatus,
  iso,
  matches,
  myMembership,
  person,
  restrictionRow,
  roleAssignmentRowsOf,
  sortRows,
} from './views.js';

function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.charAt(0)}***@${domain}`;
}

function membersOfPersona(persona: Persona): FixtureMember[] {
  return MEMBERS.filter((member) => member.userId === persona.userId);
}

function profileOf(persona: Persona): MyProfile {
  const profile = sessionProfileOf(persona.email);
  const activeTenants = persona.memberships
    .filter((membership) => membership.status === 'active')
    .flatMap((membership) => {
      const tenant = TENANTS.find((candidate) => candidate.id === membership.tenantId);
      return tenant === undefined ? [] : [tenant];
    });
  return {
    userId: persona.userId,
    email: persona.email,
    fullName: persona.fullName,
    phone: profile.phone,
    locale: profile.locale,
    displayTimeZone: profile.displayTimeZone,
    status: persona.status,
    lastSeenAt: profile.lastSeenAt,
    pendingContactChanges: CONTACT_CHANGES.filter(
      (change) => change.userId === persona.userId && change.status === 'pending_confirmation',
    ).map(({ userId: _userId, ...change }) => change),
    officialTimeZones: activeTenants.map((tenant) => ({
      organization: { tenantId: tenant.id, tenantName: tenant.name, tenantKind: tenant.kind },
      timeZone: tenant.officialTimeZone,
    })),
  };
}

export function registerAccount(app: MockApp): void {
  mockRoute(app, previewInvitation, ({ params, notFound, now }) => {
    const invitation = INVITATIONS.find((candidate) => candidate.token === params.token);
    if (invitation === undefined) {
      return notFound('This invitation link is not valid.');
    }
    const tenant = TENANTS.find((candidate) => candidate.id === invitation.tenantId);
    if (tenant === undefined) {
      return notFound();
    }
    return {
      organizationName: tenant.name,
      organizationKind: tenant.kind,
      capacity: invitation.capacity,
      roleNames: invitation.roleCodes.map((code) => findTenantRoleByCode(tenant.id, code)?.name ?? code),
      invitedBy: person(invitation.invitedByUserId).fullName,
      emailMasked: maskEmail(invitation.email),
      status: invitationStatus(invitation, now),
      expiresAt: invitation.expiresAt,
      officialTimeZone: tenant.officialTimeZone,
    };
  });

  mockRoute(app, acceptInvitation, ({ params, requirePersona, notFound, fail, now }) => {
    const persona = requirePersona();
    const invitation = INVITATIONS.find((candidate) => candidate.token === params.token);
    if (invitation === undefined) {
      return notFound('This invitation link is not valid.');
    }
    const status = invitationStatus(invitation, now);
    if (status === 'expired') {
      return fail(409, 'INVITATION_EXPIRED', 'This invitation has expired. Ask the organization to reissue it.');
    }
    if (status === 'revoked') {
      return fail(409, 'INVITATION_REVOKED', 'This invitation was withdrawn by the organization.');
    }
    if (status === 'accepted') {
      return fail(409, 'INVITATION_ALREADY_ACCEPTED', 'This invitation has already been accepted.');
    }
    if (status === 'reissued') {
      return fail(409, 'INVITATION_SUPERSEDED', 'A newer invitation replaced this link. Use the latest e-mail.');
    }
    if (invitation.email.toLowerCase() !== persona.email.toLowerCase()) {
      return fail(403, 'INVITATION_EMAIL_MISMATCH', 'This invitation is addressed to a different account.');
    }
    const tenant = TENANTS.find((candidate) => candidate.id === invitation.tenantId);
    if (tenant === undefined) {
      return notFound();
    }
    const membership: MyMembership = {
      membershipId: invitation.membershipId ?? 900,
      organization: { tenantId: tenant.id, tenantName: tenant.name, tenantKind: tenant.kind },
      organizationSlug: tenant.slug,
      capacity: invitation.capacity,
      status: 'active',
      roleNames: invitation.roleCodes.map((code) => findTenantRoleByCode(tenant.id, code)?.name ?? code),
      joinedAt: iso(now),
      requestedAt: invitation.createdAt,
      endedAt: null,
      explanation: null,
      canWithdraw: false,
      canLeave: true,
    };
    return { invitationId: invitation.invitationId, membership, userActivated: persona.status === 'invited' };
  });

  mockRoute(app, listMyMemberships, ({ requirePersona, query, fixtures, now }) => {
    const persona = requirePersona();
    const rows = membersOfPersona(persona).map((member) => myMembership(member, now));
    const filtered = rows
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.kind === undefined || query.kind.includes(row.organization.tenantKind))
      .filter((row) => matches(query.q, row.organization.tenantName, row.capacity));
    const sorted = sortRows(
      filtered,
      query.sort,
      query.dir,
      {
        organization: (row) => row.organization.tenantName,
        status: (row) => row.status,
        joinedAt: (row) => row.joinedAt,
      },
      'organization',
    );
    const kinds = new Set(
      rows.filter((row) => row.status === 'active').map((row) => row.organization.tenantKind),
    );
    return {
      ...fixtures.page(sorted),
      summary: {
        active: rows.filter((row) => row.status === 'active').length,
        pending: rows.filter((row) => row.status === 'invited' || row.status === 'pending_approval').length,
        suspendedOrEnded: rows.filter((row) => row.status === 'suspended' || row.status === 'revoked').length,
        holdsBuyerAndSupplierMemberships: kinds.has('buyer') && kinds.has('supplier'),
      },
    };
  });

  mockRoute(app, withdrawMembershipRequest, ({ requirePersona, params, notFound, fail, now }) => {
    const persona = requirePersona();
    const member = membersOfPersona(persona).find((candidate) => candidate.membershipId === params.membershipId);
    if (member === undefined) {
      return notFound();
    }
    if (member.membershipStatus !== 'pending_approval' && member.membershipStatus !== 'invited') {
      return fail(409, 'MEMBERSHIP_NOT_PENDING', 'Only a pending request or an open invitation can be withdrawn.');
    }
    return {
      ...myMembership(member, now),
      status: 'revoked',
      endedAt: iso(now),
      explanation: 'You withdrew this request. You can ask to join again at any time.',
      canWithdraw: false,
      canLeave: false,
    };
  });

  mockRoute(app, leaveMembership, ({ requirePersona, params, notFound, fail, now }) => {
    const persona = requirePersona();
    const member = membersOfPersona(persona).find((candidate) => candidate.membershipId === params.membershipId);
    if (member === undefined) {
      return notFound();
    }
    if (member.membershipStatus !== 'active') {
      return fail(409, 'MEMBERSHIP_NOT_ACTIVE', 'Only an active membership can be ended.');
    }
    const admins = activeAdministrators(member.tenantId, now);
    if (admins.length === 1 && admins[0] === persona.userId) {
      return fail(409, 'LAST_ADMINISTRATOR', 'You are the only administrator. Appoint another administrator first.');
    }
    if (WORK_ITEMS.some((item) => item.tenantId === member.tenantId && item.userId === persona.userId && item.requiresReassignment)) {
      return fail(409, 'OPEN_WORK_EXISTS', 'Formal work is still assigned to you. Ask an administrator to reassign it first.');
    }
    return {
      ...myMembership(member, now),
      status: 'revoked',
      endedAt: iso(now),
      explanation: 'This membership has ended. Your past actions stay attributed to you.',
      canWithdraw: false,
      canLeave: false,
    };
  });

  mockRoute(app, getMyProfile, ({ requirePersona }) => profileOf(requirePersona()));

  mockRoute(app, updateMyProfile, ({ requirePersona, body }) => ({
    ...profileOf(requirePersona()),
    fullName: body.fullName,
    locale: body.locale,
    displayTimeZone: body.displayTimeZone,
  }));

  mockRoute(app, requestContactChange, ({ requirePersona, body, fail, now }) => {
    const persona = requirePersona();
    const profile = sessionProfileOf(persona.email);
    const current = body.field === 'email' ? persona.email : profile.phone;
    if (current !== null && current.replace(/\s/g, '').toLowerCase() === body.newValue.replace(/\s/g, '').toLowerCase()) {
      return fail(409, 'SAME_AS_CURRENT', 'The new value is the same as the current one.');
    }
    if (CONTACT_CHANGES.some((change) => change.userId === persona.userId && change.field === body.field && change.status === 'pending_confirmation')) {
      return fail(409, 'CONTACT_CHANGE_PENDING', 'A change of this detail is already waiting for confirmation. Cancel it first.');
    }
    if (body.field === 'email' && MEMBERS.some((member) => member.email.toLowerCase() === body.newValue.toLowerCase())) {
      return fail(409, 'EMAIL_IN_USE', 'This e-mail address belongs to another account.');
    }
    const masked = body.field === 'email' ? maskEmail(body.newValue) : `${body.newValue.slice(0, 6)}• ••• ${body.newValue.slice(-3)}`;
    return {
      changeId: 900,
      field: body.field,
      newValueMasked: masked,
      status: 'pending_confirmation',
      requestedAt: iso(now),
      expiresAt: iso(new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)),
      confirmationSentTo: masked,
    };
  });

  mockRoute(app, cancelContactChange, ({ requirePersona, params, notFound, fail }) => {
    const persona = requirePersona();
    const change = CONTACT_CHANGES.find((candidate) => candidate.changeId === params.changeId && candidate.userId === persona.userId);
    if (change === undefined) {
      return notFound();
    }
    if (change.status !== 'pending_confirmation') {
      return fail(409, 'CONTACT_CHANGE_NOT_PENDING', 'Only a change waiting for confirmation can be cancelled.');
    }
    const { userId: _userId, ...row } = change;
    return { ...row, status: 'cancelled' };
  });

  mockRoute(app, getMyAccessSummary, ({ requirePersona, now }) => {
    const persona = requirePersona();
    const organizations = membersOfPersona(persona)
      .filter((member) => member.membershipStatus === 'active')
      .flatMap((member) => {
        const tenant = TENANTS.find((candidate) => candidate.id === member.tenantId);
        if (tenant === undefined || tenant.status !== 'active') {
          return [];
        }
        const tenantId = tenant.id;
        return [
          {
            organization: { tenantId, tenantName: tenant.name, tenantKind: tenant.kind },
            capacity: member.capacity,
            roles: roleAssignmentRowsOf(tenantId, persona.userId, now),
            directGrants: ACCESS_GRANTS.filter((grant) => grant.tenantId === tenantId && grant.userId === persona.userId).map((grant) => {
              const row = grantRow(grant, now);
              return {
                id: row.grantId,
                description: row.permissionDescription,
                permissionCode: row.permissionCode,
                scope: row.scope,
                startsAt: row.startsAt,
                endsAt: row.expiresAt,
                status: row.status,
                counterpart: row.owner,
              };
            }),
            restrictions: ACCESS_RESTRICTIONS.filter(
              (restriction) => restriction.tenantId === tenantId && restriction.userId === persona.userId,
            ).map((restriction) => {
              const row = restrictionRow(restriction, now);
              return {
                id: row.restrictionId,
                description: row.reason,
                permissionCode: row.permissionCode,
                scope: row.scope,
                startsAt: row.startsAt,
                endsAt: row.endsAt,
                status: row.status,
                counterpart: row.imposedBy,
              };
            }),
            delegationsGiven: DELEGATIONS.filter(
              (delegation) => delegation.tenantId === tenantId && delegation.delegatorUserId === persona.userId,
            ).map((delegation) => {
              const row = delegationRow(delegation, now);
              return {
                id: row.delegationId,
                description: row.reason,
                permissionCode: null,
                scope: null,
                startsAt: row.startsAt,
                endsAt: row.endsAt,
                status: row.status,
                counterpart: row.delegate,
              };
            }),
            delegationsReceived: DELEGATIONS.filter(
              (delegation) => delegation.tenantId === tenantId && delegation.delegateUserId === persona.userId,
            ).map((delegation) => {
              const row = delegationRow(delegation, now);
              return {
                id: row.delegationId,
                description: row.reason,
                permissionCode: null,
                scope: null,
                startsAt: row.startsAt,
                endsAt: row.endsAt,
                status: row.status,
                counterpart: row.delegator,
              };
            }),
          },
        ];
      });
    return { organizations };
  });
}
