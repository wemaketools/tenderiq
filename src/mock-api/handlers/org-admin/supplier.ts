/**
 * Org-admin mock handlers, supplier users and authority (SUP-04; AC-03): tender assignments, explicit submission
 * authority and signing limits. Everything is scoped to the caller's supplier tenant; an administrator never raises
 * their own authority, and approver or signatory responsibilities need the matching authority.
 */
import {
  createTenderAssignment,
  endTenderAssignment,
  listAssignableTenders,
  listSupplierAuthority,
  listTenderAssignments,
  setSigningLimit,
  setSubmissionAuthority,
} from '../../../contracts/org-admin.js';
import type { SupplierAuthorityRow } from '../../../contracts/org-admin.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { MEMBERS, TENDER_ASSIGNMENTS, tenderRef } from '../../fixtures/org-admin/index.js';
import {
  assignableTender,
  assignableTenderIds,
  assignmentRow,
  heldPermissionsOf,
  iso,
  matches,
  memberOfTenant,
  person,
  sortRows,
  supplierAuthorityRow,
} from './views.js';

export function registerSupplier(app: MockApp): void {
  mockRoute(app, listAssignableTenders, ({ requireTenant }) => ({
    items: assignableTenderIds(requireTenant().tenant.id).map(assignableTender),
  }));

  mockRoute(app, listTenderAssignments, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = TENDER_ASSIGNMENTS.filter((assignment) => assignment.tenantId === tenant.id)
      .map(assignmentRow)
      .filter((row) => query.userId === undefined || row.member.userId === query.userId)
      .filter((row) => query.tenderId === undefined || row.tender.tenderId === query.tenderId)
      .filter((row) => query.responsibility === undefined || query.responsibility.includes(row.responsibility))
      .filter((row) => query.active === undefined || row.active === query.active)
      .filter((row) => matches(query.q, row.member.fullName, row.tender.reference, row.tender.title, ...row.sectionScope));
    return fixtures.page(
      sortRows(
        rows,
        query.sort,
        query.dir,
        {
          dueAt: (row) => row.dueAt,
          member: (row) => row.member.fullName,
          tender: (row) => row.tender.reference,
          responsibility: (row) => row.responsibility,
        },
        'dueAt',
      ),
    );
  });

  mockRoute(app, createTenderAssignment, ({ requireTenant, requirePersona, body, fail, now }) => {
    const { tenant } = requireTenant();
    const member = memberOfTenant(tenant.id, body.userId);
    if (member === undefined || member.membershipStatus !== 'active' || member.userStatus !== 'active') {
      return fail(409, 'USER_NOT_ACTIVE', 'Only active members can be assigned.');
    }
    if (!assignableTenderIds(tenant.id).includes(body.tenderId)) {
      return fail(422, 'TENDER_NOT_AVAILABLE', 'Choose one of this organization’s active pursuits.');
    }
    const permissions = heldPermissionsOf(tenant.id, member.userId, now);
    const needs: Record<string, string | undefined> = {
      approver: 'supplier.response.approve',
      signatory: 'supplier.response.submit',
      bid_manager: 'supplier.pursuit.manage',
    };
    const required = needs[body.responsibility];
    const caller = requirePersona();
    if (required !== undefined && !permissions.includes(required as (typeof permissions)[number])) {
      if (member.userId === caller.userId) {
        return fail(403, 'SELF_GRANT_FORBIDDEN', 'You cannot give yourself a responsibility you do not hold authority for.');
      }
      return fail(409, 'RESPONSIBILITY_REQUIRES_AUTHORITY', `${member.fullName} does not hold the authority this responsibility needs.`);
    }
    if (body.canViewPricing && !permissions.includes('supplier.pricing.edit') && body.responsibility !== 'signatory' && body.responsibility !== 'approver') {
      return fail(409, 'PRICING_REQUIRES_PERMISSION', `${member.fullName} is not a pricing contributor; pricing stays hidden.`);
    }
    if (
      TENDER_ASSIGNMENTS.some(
        (assignment) =>
          assignment.tenantId === tenant.id &&
          assignment.userId === member.userId &&
          assignment.tenderId === body.tenderId &&
          assignment.responsibility === body.responsibility &&
          assignment.endedAt === null,
      )
    ) {
      return fail(409, 'ALREADY_ASSIGNED', `${member.fullName} already has this responsibility on ${tenderRef(body.tenderId).reference}.`);
    }
    return {
      assignmentId: 900,
      member: person(member.userId),
      capacity: member.capacity,
      tender: assignableTender(body.tenderId),
      responsibility: body.responsibility,
      sectionScope: body.sectionScope,
      lotLabels: [],
      dueAt: body.dueAt,
      canViewPricing: body.canViewPricing,
      assignedAt: iso(now),
      endedAt: null,
      active: true,
    };
  });

  mockRoute(app, endTenderAssignment, ({ requireTenant, params, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const assignment = TENDER_ASSIGNMENTS.find((candidate) => candidate.tenantId === tenant.id && candidate.assignmentId === params.assignmentId);
    if (assignment === undefined) {
      return notFound();
    }
    if (assignment.endedAt !== null) {
      return fail(409, 'ASSIGNMENT_ALREADY_ENDED', 'This assignment has already ended.');
    }
    return { ...assignmentRow(assignment), endedAt: iso(now), active: false };
  });

  mockRoute(app, listSupplierAuthority, ({ requireTenant, requirePersona, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    const caller = requirePersona();
    const rows = MEMBERS.filter((member) => member.tenantId === tenant.id && member.membershipStatus !== 'invited')
      .map((member) => supplierAuthorityRow(member, now, caller.userId))
      .filter((row) => query.canSubmit === undefined || row.canSubmit === query.canSubmit)
      .filter((row) => query.canApprove === undefined || row.canApprove === query.canApprove)
      .filter((row) => matches(query.q, row.member.fullName, row.capacity));
    return fixtures.page(
      sortRows(rows, query.sort, query.dir, { member: (row) => row.member.fullName, capacity: (row) => row.capacity }, 'member'),
    );
  });

  mockRoute(app, setSigningLimit, ({ requireTenant, requirePersona, params, body, fail, now }) => {
    const { tenant } = requireTenant();
    const member = memberOfTenant(tenant.id, params.userId);
    if (member === undefined || member.membershipStatus !== 'active') {
      return fail(409, 'USER_NOT_ACTIVE', 'Signing limits apply to active members only.');
    }
    if (member.userId === requirePersona().userId) {
      return fail(403, 'SELF_GRANT_FORBIDDEN', 'Nobody can set their own signing limit.');
    }
    if (body.maxAmount.currency !== (tenant.defaultCurrency ?? 'BWP')) {
      return fail(422, 'CURRENCY_NOT_ACCEPTED', `Signing limits are set in ${tenant.defaultCurrency ?? 'BWP'}.`);
    }
    const row = supplierAuthorityRow(member, now, requirePersona().userId);
    if (!row.canSubmit) {
      return fail(409, 'SIGNING_LIMIT_REQUIRES_SIGNATORY', 'Give submission authority first; only signatories have a signing limit.');
    }
    return {
      ...row,
      signingLimit: {
        limitId: row.signingLimit?.limitId ?? 900,
        maxAmount: body.maxAmount,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo,
        status: Date.parse(body.effectiveFrom) > now.getTime() ? 'scheduled' : 'active',
      },
    };
  });

  mockRoute(app, setSubmissionAuthority, ({ requireTenant, requirePersona, params, body, fail, now }) => {
    const { tenant } = requireTenant();
    const member = memberOfTenant(tenant.id, params.userId);
    if (member === undefined || member.membershipStatus !== 'active') {
      return fail(409, 'USER_NOT_ACTIVE', 'Submission authority applies to active members only.');
    }
    if (member.userId === requirePersona().userId) {
      return fail(403, 'SELF_GRANT_FORBIDDEN', 'Nobody can change their own submission authority.');
    }
    const tenderId = body.scope.scopeType === 'tender' ? body.scope.scopeId : null;
    if (tenderId !== null && !assignableTenderIds(tenant.id).includes(tenderId)) {
      return fail(422, 'TENDER_NOT_AVAILABLE', 'Choose one of this organization’s active pursuits.');
    }
    const row = supplierAuthorityRow(member, now, requirePersona().userId);
    const alreadyThere =
      body.granted === row.canSubmit &&
      (tenderId === null ? row.submissionSource !== 'tender_role' : row.submissionTenders.some((tender) => tender.tenderId === tenderId));
    if (alreadyThere || (!body.granted && !row.canSubmit)) {
      return fail(409, 'SUBMISSION_AUTHORITY_UNCHANGED', 'The member already has this submission authority.');
    }
    if (!body.granted) {
      return {
        ...row,
        canSubmit: false,
        submissionSource: 'none',
        submissionTenders: [],
        signingLimit: null,
        availableActions: ['changeSubmission'],
        blockedBy: 'no_submission_authority',
      };
    }
    const signatory: Pick<SupplierAuthorityRow, 'availableActions' | 'blockedBy'> = {
      availableActions: ['changeSubmission', 'setSigningLimit'],
      blockedBy: null,
    };
    return tenderId === null
      ? { ...row, ...signatory, canSubmit: true, canApprove: true, submissionSource: 'organization_role', submissionTenders: [] }
      : {
          ...row,
          ...signatory,
          canSubmit: true,
          canApprove: true,
          submissionSource: row.submissionSource === 'organization_role' ? 'organization_role' : 'tender_role',
          submissionTenders: [...row.submissionTenders, { tenderId, reference: tenderRef(tenderId).reference }],
        };
  });
}
