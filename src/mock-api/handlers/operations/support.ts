/**
 * Support handlers: the operator case queue and temporary access grants (OPS-04), the customer-side authorization
 * of support access (buyer administrators, DD-23) and the personal service cases and accommodation requests of
 * COM-09 (DD-21: a person sees only the cases they opened, labelled with the organization).
 *
 * Support is never impersonation and never a bid-submission channel (PRD §4.2, COM-09).
 */
import { BID_SUBMISSION_IN_TEXT, MAX_SUPPORT_GRANT_DAYS, isSealedRecordRef, operationsEndpoints as api } from '../../../contracts/operations.js';
import type { CustomerSupportGrant, MySupportCase, MySupportCaseDetail } from '../../../contracts/operations.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { SUPPORT_ACCESS_GRANTS, SUPPORT_ACTIVITY, SUPPORT_CASES } from '../../fixtures/operations/index.js';
import type { FixtureSupportAccessGrant, FixtureSupportCase } from '../../fixtures/operations/index.js';
import { organizationLabel, personRef } from '../../persona.js';
import {
  activityView,
  caseDetail,
  caseMessages,
  caseRow,
  customerLabel,
  findCase,
  grantStatusAt,
  grantView,
  isActiveMember,
  isCaseClosed,
  isOperatorUser,
  isoNow,
  matchesText,
  sortRows,
  withinDates,
} from './views.js';

const DAY_MS = 86_400_000;

function customerGrantView(grant: FixtureSupportAccessGrant, now: Date): CustomerSupportGrant {
  const supportCase = findCase(grant.caseId);
  return {
    ...grantView(grant, now),
    caseSubject: supportCase?.subject ?? 'Support case',
    requestedDays: grant.requestedDays,
    activity: SUPPORT_ACTIVITY.filter((entry) => entry.grantId === grant.id)
      .map(activityView)
      .sort((a, b) => a.at.localeCompare(b.at)),
  };
}

function myCaseRow(row: FixtureSupportCase): MySupportCase {
  return {
    id: row.id,
    reference: row.reference,
    organization: organizationLabel(row.customerTenantId),
    category: row.category,
    subject: row.subject,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    closedAt: row.closedAt,
  };
}

function myCaseDetail(row: FixtureSupportCase, now: Date): MySupportCaseDetail {
  return {
    ...myCaseRow(row),
    description: row.description,
    resolution: row.resolution,
    routedTo: row.routedToTenantId === null ? null : customerLabel(row.routedToTenantId),
    messages: caseMessages(row.id, false),
    grants: SUPPORT_ACCESS_GRANTS.filter((grant) => grant.caseId === row.id && grant.customerTenantId === row.customerTenantId).map(
      (grant) => grantView(grant, now),
    ),
  };
}

export function registerSupport(app: MockApp): void {
  // ---------------------------------------------------------------------------------------------------
  // Operator case queue (OPS-04)
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.listSupportCases, ({ query, fixtures, now }) => {
    const rows = SUPPORT_CASES.map((row) => caseRow(row, now))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.category === undefined || query.category.includes(row.category))
      .filter((row) => query.customerTenantId === undefined || row.customer.tenantId === query.customerTenantId)
      .filter((row) => query.assignedOperatorUserId === undefined || row.assignedOperator?.userId === query.assignedOperatorUserId)
      .filter((row) => query.unassigned === undefined || (row.assignedOperator === null) === query.unassigned)
      .filter((row) => withinDates(row.createdAt, query.createdFrom, query.createdTo))
      .filter((row) => matchesText(query.q, row.reference, row.subject, row.customer.name, row.openedBy.fullName));
    const sort = query.sort ?? 'updatedAt';
    const sorted = sortRows(rows, (row) => (sort === 'customer' ? row.customer.name : row[sort]), query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.getSupportCase, ({ params, now, notFound }) => {
    const row = findCase(params.caseId);
    if (row === undefined) return notFound();
    return caseDetail(row, now);
  });

  mockRoute(app, api.createSupportCase, ({ body, requirePersona, now, fail, notFound }) => {
    const customer = customerLabel(body.customerTenantId);
    if (customer.kind === 'operator') return notFound();
    if (!isActiveMember(body.openedByUserId, body.customerTenantId)) {
      fail(422, 'CUSTOMER_CONTACT_NOT_MEMBER', 'The reporting contact must be an active member of the customer organization.');
    }
    if (BID_SUBMISSION_IN_TEXT.test(body.description)) {
      fail(422, 'SUPPORT_NOT_SUBMISSION_CHANNEL', 'Support cannot receive bids. Direct the customer to the official submission route.');
    }
    const at = isoNow(now);
    return caseDetail(
      {
        id: 900,
        reference: 'SC-2026-0900',
        customerTenantId: body.customerTenantId,
        openedByUserId: body.openedByUserId,
        category: body.category,
        subject: body.subject,
        description: body.description,
        status: 'open',
        assignedOperatorUserId: requirePersona().userId,
        routedToTenantId: null,
        resolution: null,
        createdAt: at,
        updatedAt: at,
        closedAt: null,
      },
      now,
    );
  });

  mockRoute(app, api.assignSupportCase, ({ params, body, now, notFound, fail }) => {
    const row = findCase(params.caseId);
    if (row === undefined) return notFound();
    if (isCaseClosed(row)) fail(409, 'CASE_CLOSED', 'This case is closed.');
    if (!isOperatorUser(body.operatorUserId)) fail(422, 'ASSIGNEE_NOT_OPERATOR', 'Cases are assigned to platform operators only.');
    return caseDetail({ ...row, assignedOperatorUserId: body.operatorUserId, updatedAt: isoNow(now) }, now);
  });

  mockRoute(app, api.transitionSupportCase, ({ params, body, now, notFound, fail }) => {
    const row = findCase(params.caseId);
    if (row === undefined) return notFound();
    if (isCaseClosed(row)) fail(409, 'CASE_CLOSED', 'This case is closed.');
    if (row.status === body.status) fail(409, 'CASE_TRANSITION_INVALID', `The case is already ${body.status.replace('_', ' ')}.`);
    if (row.category === 'procurement_merits' && body.status === 'resolved') {
      fail(
        409,
        'BUSINESS_DISPUTE_MUST_ROUTE',
        'Support cannot decide deadlines, awards or other procurement merits. Route the case to the responsible buyer.',
      );
    }
    const resolution = body.resolution ?? row.resolution;
    if ((body.status === 'resolved' || body.status === 'closed') && (resolution === null || resolution.trim().length === 0)) {
      fail(422, 'RESOLUTION_REQUIRED', 'Record the resolution before resolving or closing the case.');
    }
    const at = isoNow(now);
    return caseDetail({ ...row, status: body.status, resolution, updatedAt: at, closedAt: body.status === 'closed' ? at : null }, now);
  });

  mockRoute(app, api.addSupportCaseMessage, ({ params, body, requirePersona, now, notFound, fail }) => {
    const row = findCase(params.caseId);
    if (row === undefined) return notFound();
    if (isCaseClosed(row)) fail(409, 'CASE_CLOSED', 'This case is closed.');
    return {
      id: 9000,
      author: personRef(requirePersona().userId),
      authorSide: 'operator',
      body: body.body,
      internal: body.internal,
      createdAt: isoNow(now),
    };
  });

  mockRoute(app, api.routeSupportCaseToBuyer, ({ params, body, now, notFound, fail }) => {
    const row = findCase(params.caseId);
    if (row === undefined) return notFound();
    if (isCaseClosed(row)) fail(409, 'CASE_CLOSED', 'This case is closed.');
    const target = customerLabel(body.buyerTenantId);
    if (target.kind !== 'buyer') fail(422, 'ROUTE_TARGET_NOT_BUYER', 'Route the case to the buyer responsible for the procurement.');
    return caseDetail(
      {
        ...row,
        status: 'routed_to_buyer',
        routedToTenantId: body.buyerTenantId,
        resolution: `Routed to ${target.name}: ${body.note}`,
        updatedAt: isoNow(now),
      },
      now,
    );
  });

  // ---------------------------------------------------------------------------------------------------
  // Access grants (OPS-04)
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.requestSupportGrant, ({ params, body, requirePersona, now, notFound, fail }) => {
    const row = findCase(params.caseId);
    if (row === undefined) return notFound();
    if (isCaseClosed(row)) fail(409, 'CASE_CLOSED', 'This case is closed.');
    if (
      SUPPORT_ACCESS_GRANTS.some(
        (grant) => grant.caseId === row.id && ['active', 'requested', 'authorized'].includes(grantStatusAt(grant, now)),
      )
    ) {
      fail(409, 'GRANT_ALREADY_ACTIVE', 'This case already has an active or pending access grant.');
    }
    if (body.requestedDays > MAX_SUPPORT_GRANT_DAYS) {
      fail(422, 'GRANT_DURATION_TOO_LONG', `Support access lasts at most ${MAX_SUPPORT_GRANT_DAYS} days.`);
    }
    const refs = body.recordRefs;
    if (body.scope === 'specific_records' && refs.length === 0) {
      fail(422, 'RECORD_REFS_REQUIRED', 'Name the records support needs to read.');
    }
    if (refs.some(isSealedRecordRef)) {
      fail(422, 'SEALED_CONTENT_NOT_GRANTABLE', 'Bids and evaluation records can never be opened to support.');
    }
    return grantView(
      {
        id: 900,
        caseId: row.id,
        customerTenantId: row.customerTenantId,
        operatorUserId: requirePersona().userId,
        authorizedByUserId: null,
        businessNeed: body.businessNeed,
        scope: body.scope,
        recordRefs: body.scope === 'metadata_only' ? [] : refs,
        requestedAt: isoNow(now),
        requestedDays: body.requestedDays,
        startsAt: null,
        expiresAt: null,
        revokedAt: null,
        status: 'requested',
        statusReason: null,
      },
      now,
    );
  });

  mockRoute(app, api.listSupportGrants, ({ query, fixtures, now }) => {
    const rows = SUPPORT_ACCESS_GRANTS.map((grant) => grantView(grant, now))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.customerTenantId === undefined || row.customer.tenantId === query.customerTenantId)
      .filter((row) => query.operatorUserId === undefined || row.operator.userId === query.operatorUserId)
      .filter((row) => query.caseId === undefined || row.caseId === query.caseId)
      .filter((row) => matchesText(query.q, row.businessNeed, row.customer.name, ...row.recordRefs));
    const sort = query.sort ?? 'requestedAt';
    const sorted = sortRows(rows, (row) => row[sort], query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.endSupportGrant, ({ params, body, now, notFound, fail }) => {
    const grant = SUPPORT_ACCESS_GRANTS.find((row) => row.id === params.grantId);
    if (grant === undefined) return notFound();
    if (grantStatusAt(grant, now) !== 'active') fail(409, 'GRANT_NOT_ACTIVE', 'Only an active grant can be ended.');
    const at = isoNow(now);
    return grantView({ ...grant, status: 'revoked', revokedAt: at, statusReason: `Ended by support: ${body.reason}` }, now);
  });

  // ---------------------------------------------------------------------------------------------------
  // Customer authorization (buyer administrators)
  // ---------------------------------------------------------------------------------------------------
  function customerGrant(tenantId: number, grantId: number): FixtureSupportAccessGrant | undefined {
    return SUPPORT_ACCESS_GRANTS.find((grant) => grant.id === grantId && grant.customerTenantId === tenantId);
  }

  mockRoute(app, api.listCustomerSupportGrants, ({ query, requireTenant, fixtures, now }) => {
    const { tenant } = requireTenant();
    const rows = SUPPORT_ACCESS_GRANTS.filter((grant) => grant.customerTenantId === tenant.id)
      .map((grant) => customerGrantView(grant, now))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => matchesText(query.q, row.caseReference, row.caseSubject, row.businessNeed, row.operator.fullName));
    const sort = query.sort ?? 'requestedAt';
    const sorted = sortRows(rows, (row) => row[sort], query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.getCustomerSupportGrant, ({ params, requireTenant, now, notFound }) => {
    const grant = customerGrant(requireTenant().tenant.id, params.grantId);
    if (grant === undefined) return notFound();
    return customerGrantView(grant, now);
  });

  mockRoute(app, api.authorizeSupportGrant, ({ params, body, requireTenant, requirePersona, now, notFound, fail }) => {
    const grant = customerGrant(requireTenant().tenant.id, params.grantId);
    if (grant === undefined) return notFound();
    if (grantStatusAt(grant, now) !== 'requested') fail(409, 'GRANT_NOT_REQUESTED', 'Only a pending request can be authorized.');
    const expires = Date.parse(body.expiresAt);
    if (expires <= now.getTime()) fail(422, 'GRANT_EXPIRY_IN_PAST', 'Choose an expiry in the future.');
    if (expires - now.getTime() > MAX_SUPPORT_GRANT_DAYS * DAY_MS) {
      fail(422, 'GRANT_DURATION_TOO_LONG', `Support access lasts at most ${MAX_SUPPORT_GRANT_DAYS} days.`);
    }
    if (body.scope === 'specific_records' && grant.scope === 'metadata_only') {
      fail(422, 'GRANT_SCOPE_WIDENED', 'The customer may narrow a request to metadata only, never widen it.');
    }
    const scope = body.scope ?? grant.scope;
    const at = isoNow(now);
    return customerGrantView(
      {
        ...grant,
        status: 'active',
        scope,
        recordRefs: scope === 'metadata_only' ? [] : grant.recordRefs,
        authorizedByUserId: requirePersona().userId,
        startsAt: at,
        expiresAt: body.expiresAt,
      },
      now,
    );
  });

  mockRoute(app, api.denySupportGrant, ({ params, body, requireTenant, requirePersona, now, notFound, fail }) => {
    const grant = customerGrant(requireTenant().tenant.id, params.grantId);
    if (grant === undefined) return notFound();
    if (grantStatusAt(grant, now) !== 'requested') fail(409, 'GRANT_NOT_REQUESTED', 'Only a pending request can be denied.');
    return customerGrantView({ ...grant, status: 'denied', authorizedByUserId: requirePersona().userId, statusReason: body.reason }, now);
  });

  mockRoute(app, api.revokeSupportGrant, ({ params, body, requireTenant, now, notFound, fail }) => {
    const grant = customerGrant(requireTenant().tenant.id, params.grantId);
    if (grant === undefined) return notFound();
    if (grantStatusAt(grant, now) !== 'active') fail(409, 'GRANT_NOT_ACTIVE', 'Only an active grant can be revoked.');
    return customerGrantView({ ...grant, status: 'revoked', revokedAt: isoNow(now), statusReason: body.reason }, now);
  });

  // ---------------------------------------------------------------------------------------------------
  // Personal service cases (COM-09)
  // ---------------------------------------------------------------------------------------------------
  function myCases(userId: number, tenantIds: readonly number[]): FixtureSupportCase[] {
    return SUPPORT_CASES.filter((row) => row.openedByUserId === userId && tenantIds.includes(row.customerTenantId));
  }

  mockRoute(app, api.listMySupportCases, ({ query, requirePersona, fixtures }) => {
    const tenantIds = fixtures.activeMemberships().map((membership) => membership.tenantId);
    const rows = myCases(requirePersona().userId, tenantIds)
      .map(myCaseRow)
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.category === undefined || query.category.includes(row.category))
      .filter((row) => query.tenantId === undefined || row.organization.tenantId === query.tenantId)
      .filter((row) => matchesText(query.q, row.reference, row.subject, row.organization.tenantName));
    const sort = query.sort ?? 'updatedAt';
    const sorted = sortRows(rows, (row) => row[sort], query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.getMySupportCase, ({ params, requirePersona, fixtures, now, notFound }) => {
    const tenantIds = fixtures.activeMemberships().map((membership) => membership.tenantId);
    const row = myCases(requirePersona().userId, tenantIds).find((candidate) => candidate.id === params.caseId);
    if (row === undefined) return notFound();
    return myCaseDetail(row, now);
  });

  mockRoute(app, api.openMySupportCase, ({ body, requirePersona, requireTenant, now, fail }) => {
    const access = requireTenant();
    if (access.access !== 'membership') fail(403, 'FORBIDDEN', 'Support access cannot open cases on behalf of a customer.');
    if (BID_SUBMISSION_IN_TEXT.test(body.description) || BID_SUBMISSION_IN_TEXT.test(body.subject)) {
      fail(
        422,
        'SUPPORT_NOT_SUBMISSION_CHANNEL',
        'Support cannot receive bids or responses. Submit through the opportunity workspace before the official deadline.',
      );
    }
    const at = isoNow(now);
    return myCaseDetail(
      {
        id: 900,
        reference: 'SC-2026-0900',
        customerTenantId: access.tenant.id,
        openedByUserId: requirePersona().userId,
        category: body.category,
        subject: body.subject,
        description: body.description,
        status: 'open',
        assignedOperatorUserId: null,
        routedToTenantId: null,
        resolution: null,
        createdAt: at,
        updatedAt: at,
        closedAt: null,
      },
      now,
    );
  });

  mockRoute(app, api.replyMySupportCase, ({ params, body, requirePersona, requireTenant, now, notFound, fail }) => {
    const access = requireTenant();
    if (access.access !== 'membership') fail(403, 'FORBIDDEN', 'Support access cannot reply on behalf of a customer.');
    const persona = requirePersona();
    const row = myCases(persona.userId, [access.tenant.id]).find((candidate) => candidate.id === params.caseId);
    if (row === undefined) return notFound();
    if (isCaseClosed(row)) fail(409, 'CASE_CLOSED', 'This case is closed. Open a new case if you still need help.');
    if (BID_SUBMISSION_IN_TEXT.test(body.body)) {
      fail(422, 'SUPPORT_NOT_SUBMISSION_CHANNEL', 'Support cannot receive bids or responses. Use the official submission route.');
    }
    return { id: 9000, author: personRef(persona.userId), authorSide: 'customer', body: body.body, internal: false, createdAt: isoNow(now) };
  });

  mockRoute(app, api.requestAccommodation, ({ body, requirePersona, requireTenant, now, fail }) => {
    const access = requireTenant();
    if (access.access !== 'membership') fail(403, 'FORBIDDEN', 'Support access cannot open requests on behalf of a customer.');
    if (body.neededBy !== undefined && body.neededBy < now.toISOString().slice(0, 10)) {
      fail(422, 'NEEDED_BY_IN_PAST', 'Choose today or a later date.');
    }
    const at = isoNow(now);
    const related = body.relatedReference === undefined ? '' : ` for ${body.relatedReference}`;
    const neededBy = body.neededBy === undefined ? '' : ` Needed by ${body.neededBy}.`;
    return myCaseDetail(
      {
        id: 901,
        reference: 'SC-2026-0901',
        customerTenantId: access.tenant.id,
        openedByUserId: requirePersona().userId,
        category: 'accessibility',
        subject: `Accommodation request (${body.format.replaceAll('_', ' ')})${related}`,
        description: `${body.need}${neededBy} Preferred contact: ${body.contactPreference.replace('_', '-')}.`,
        status: 'open',
        assignedOperatorUserId: null,
        routedToTenantId: null,
        resolution: null,
        createdAt: at,
        updatedAt: at,
        closedAt: null,
      },
      now,
    );
  });
}
