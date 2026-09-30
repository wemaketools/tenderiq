/**
 * Operator handlers: service incidents and continuity (OPS-05) and platform oversight (OPS-06). Incidents record
 * timing and affected actions as evidence; buyers make the deadline decisions. Oversight shows aggregate usage and
 * service conduct only.
 */
import { operationsEndpoints as api } from '../../../contracts/operations.js';
import type { IncidentDetail, UsageRow } from '../../../contracts/operations.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  ACCESS_REVIEWS,
  CONDUCT_CASES,
  SERVICE_INCIDENTS,
  SERVICE_INCIDENT_IMPACTS,
  SUPPORT_ACCESS_GRANTS,
  customerProfileOf,
} from '../../fixtures/operations/index.js';
import type { FixtureAccessReview, FixtureConductCase } from '../../fixtures/operations/index.js';
import { personRef } from '../../persona.js';
import {
  CONTENT_ACCESS_NOTE,
  INCIDENT_DECISION_RULE,
  activeContractUsage,
  activeGrantCount,
  activeUserCount,
  allCustomers,
  customerLabel,
  findIncident,
  grantStatusAt,
  incidentDetail,
  incidentRow,
  isoNow,
  liveEventsOf,
  matchesText,
  openCaseCount,
  personOrNull,
  sortRows,
  withinDates,
} from './views.js';

const SEVERITY_ORDER = { low: 1, medium: 2, high: 3, critical: 4 } as const;
const DAY_MS = 86_400_000;

function accessReviewView(review: FixtureAccessReview) {
  return {
    id: review.id,
    subject: personRef(review.subjectUserId),
    capacity: review.capacity,
    privileges: [...review.privileges],
    grantsLast90Days: review.grantsLast90Days,
    status: review.status,
    dueOn: review.dueOn,
    reviewer: personOrNull(review.reviewerUserId),
    reviewedAt: review.reviewedAt,
    outcome: review.outcome,
    note: review.note,
  };
}

function conductView(row: FixtureConductCase) {
  return {
    id: row.id,
    reference: row.reference,
    kind: row.kind,
    customer: row.customerTenantId === null ? null : customerLabel(row.customerTenantId),
    summary: row.summary,
    status: row.status,
    reportedAt: row.reportedAt,
    owner: personOrNull(row.ownerUserId),
    outcome: row.outcome,
    closedAt: row.closedAt,
  };
}

export function registerIncidents(app: MockApp): void {
  // ---------------------------------------------------------------------------------------------------
  // Incidents (OPS-05)
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.listIncidents, ({ query, fixtures }) => {
    const rows = SERVICE_INCIDENTS.filter(
      (incident) =>
        query.customerTenantId === undefined ||
        SERVICE_INCIDENT_IMPACTS.some((impact) => impact.incidentId === incident.id && impact.customerTenantId === query.customerTenantId),
    )
      .filter((incident) => matchesText(query.q, incident.reference, incident.title, incident.description))
      .map(incidentRow)
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.severity === undefined || query.severity.includes(row.severity))
      .filter((row) => withinDates(row.startedAt, query.startedFrom, query.startedTo));
    const sort = query.sort ?? 'startedAt';
    const sorted = sortRows(
      rows,
      (row) => (sort === 'severity' ? SEVERITY_ORDER[row.severity] : row[sort]),
      query.sort === undefined ? 'desc' : query.dir,
    );
    return fixtures.page(sorted);
  });

  mockRoute(app, api.getIncident, ({ params, notFound }) => {
    const incident = findIncident(params.incidentId);
    if (incident === undefined) return notFound();
    return incidentDetail(incident);
  });

  mockRoute(app, api.createIncident, ({ body, requirePersona, now, fail }) => {
    if (Date.parse(body.startedAt) > now.getTime()) {
      fail(422, 'START_IN_FUTURE', 'An incident cannot start in the future.');
    }
    const at = isoNow(now);
    const detail: IncidentDetail = {
      id: 900,
      reference: 'INC-2026-900',
      title: body.title,
      severity: body.severity,
      status: 'investigating',
      startedAt: body.startedAt,
      resolvedAt: null,
      affectedCustomers: 0,
      affectedEvents: 0,
      pendingBuyerDecisions: 0,
      description: body.description,
      customerNotice: body.customerNotice ?? null,
      impacts: [],
      timeline: [
        { id: 9000, at, actor: personRef(requirePersona().userId), action: 'status.investigating', description: 'Incident opened.' },
      ],
      decisionRule: INCIDENT_DECISION_RULE,
    };
    return detail;
  });

  mockRoute(app, api.updateIncident, ({ params, body, requirePersona, now, notFound, fail }) => {
    const incident = findIncident(params.incidentId);
    if (incident === undefined) return notFound();
    if (incident.status === 'resolved') fail(409, 'INCIDENT_ALREADY_RESOLVED', 'This incident is resolved. Open a new incident for a recurrence.');
    if (body.status === 'resolved' && body.resolvedAt === undefined) {
      fail(422, 'RESOLVED_AT_REQUIRED', 'Record when service was restored.');
    }
    if (body.resolvedAt !== undefined && Date.parse(body.resolvedAt) < Date.parse(incident.startedAt)) {
      fail(422, 'RESOLVED_BEFORE_START', 'Service cannot be restored before the incident started.');
    }
    const detail = incidentDetail({
      ...incident,
      status: body.status,
      resolvedAt: body.status === 'resolved' ? (body.resolvedAt ?? null) : null,
      customerNotice: body.customerNotice ?? incident.customerNotice,
    });
    return {
      ...detail,
      timeline: [
        ...detail.timeline,
        { id: 9000, at: isoNow(now), actor: personRef(requirePersona().userId), action: `status.${body.status}`, description: body.note },
      ],
    };
  });

  mockRoute(app, api.addIncidentImpact, ({ params, body, notFound, fail }) => {
    const incident = findIncident(params.incidentId);
    if (incident === undefined) return notFound();
    const customer = allCustomers().find((tenant) => tenant.id === body.customerTenantId);
    if (customer === undefined) return notFound();
    let tenderId: number | null = null;
    if (body.tenderReference !== undefined) {
      const event = [...liveEventsOf(customer.id)].find((row) => row.reference === body.tenderReference);
      if (event === undefined) {
        return fail(422, 'IMPACT_TENDER_NOT_FOUND', `${body.tenderReference} is not a live event of ${customer.name}.`);
      }
      tenderId = event.tenderId;
    }
    if (
      SERVICE_INCIDENT_IMPACTS.some(
        (impact) =>
          impact.incidentId === incident.id &&
          impact.customerTenantId === customer.id &&
          impact.tenderReference === (body.tenderReference ?? null),
      )
    ) {
      fail(409, 'IMPACT_DUPLICATE', 'This impact is already recorded.');
    }
    const detail = incidentDetail(incident);
    const impacts = [
      ...detail.impacts,
      {
        id: 900,
        customer: customerLabel(customer.id),
        tenderId,
        tenderReference: body.tenderReference ?? null,
        impactNote: body.impactNote,
        buyerDecisionNote: null,
      },
    ];
    return {
      ...detail,
      impacts,
      affectedCustomers: new Set(impacts.map((impact) => impact.customer.tenantId)).size,
      affectedEvents: impacts.filter((impact) => impact.tenderId !== null).length,
      pendingBuyerDecisions: impacts.filter((impact) => impact.tenderId !== null && impact.buyerDecisionNote === null).length,
    };
  });

  // ---------------------------------------------------------------------------------------------------
  // Oversight (OPS-06)
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.getOversightSummary, ({ now }) => {
    const customers = allCustomers();
    const usage: UsageRow[] = customers.map((tenant) => {
      const profile = customerProfileOf(tenant.id);
      return {
        customer: customerLabel(tenant.id),
        activeUsers: activeUserCount(tenant.id),
        publishedEventsYtd: profile?.publishedEventsYtd ?? 0,
        submissionsReceivedYtd: profile?.submissionsReceivedYtd ?? 0,
        activeContracts: activeContractUsage(tenant),
        storageUsedGb: profile?.storageUsedGb ?? '0',
        openSupportCases: openCaseCount(tenant.id),
        lastActivityAt: profile?.lastActivityAt ?? null,
      };
    });
    const ninetyDaysAgo = now.getTime() - 90 * DAY_MS;
    return {
      asOf: isoNow(now),
      customers: {
        buyers: customers.filter((tenant) => tenant.kind === 'buyer').length,
        suppliers: customers.filter((tenant) => tenant.kind === 'supplier').length,
      },
      activeSupportGrants: customers.reduce((total, tenant) => total + activeGrantCount(tenant.id, now), 0),
      supportGrantsLast90Days: SUPPORT_ACCESS_GRANTS.filter(
        (grant) => grant.startsAt !== null && Date.parse(grant.startsAt) >= ninetyDaysAgo && grantStatusAt(grant, now) !== 'denied',
      ).length,
      accessReviewsDue: ACCESS_REVIEWS.filter((review) => review.status !== 'completed').length,
      openConductCases: CONDUCT_CASES.filter((row) => row.status !== 'closed').length,
      openIncidents: SERVICE_INCIDENTS.filter((incident) => incident.status !== 'resolved').length,
      usage,
      confidentialityNote: CONTENT_ACCESS_NOTE,
    };
  });

  mockRoute(app, api.listAccessReviews, ({ query, fixtures }) => {
    const rows = ACCESS_REVIEWS.map(accessReviewView)
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.subjectUserId === undefined || row.subject.userId === query.subjectUserId)
      .filter((row) => matchesText(query.q, row.subject.fullName, row.capacity));
    const sort = query.sort ?? 'dueOn';
    const sorted = sortRows(rows, (row) => (sort === 'subject' ? row.subject.fullName : row[sort]), query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.completeAccessReview, ({ params, body, requirePersona, now, notFound, fail }) => {
    const review = ACCESS_REVIEWS.find((row) => row.id === params.reviewId);
    if (review === undefined) return notFound();
    const persona = requirePersona();
    if (review.subjectUserId === persona.userId) {
      fail(409, 'SELF_REVIEW_BLOCKED', 'A privileged-access review must be completed by someone other than the person reviewed.');
    }
    if (review.status === 'completed') fail(409, 'REVIEW_ALREADY_COMPLETED', 'This review is already completed.');
    return {
      ...accessReviewView(review),
      status: 'completed',
      reviewer: personRef(persona.userId),
      reviewedAt: isoNow(now),
      outcome: body.outcome,
      note: body.note,
    };
  });

  mockRoute(app, api.listConductCases, ({ query, fixtures }) => {
    const rows = CONDUCT_CASES.map(conductView)
      .filter((row) => query.kind === undefined || query.kind.includes(row.kind))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => withinDates(row.reportedAt, query.reportedFrom, query.reportedTo))
      .filter((row) => matchesText(query.q, row.reference, row.summary, row.customer?.name));
    const sort = query.sort ?? 'reportedAt';
    const sorted = sortRows(rows, (row) => row[sort], query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.reviewConductCase, ({ params, body, requirePersona, now, notFound, fail }) => {
    const row = CONDUCT_CASES.find((candidate) => candidate.id === params.conductCaseId);
    if (row === undefined) return notFound();
    if (row.status === 'closed') fail(409, 'CONDUCT_CASE_CLOSED', 'This case is closed.');
    const outcome = body.outcome ?? row.outcome;
    if (body.status === 'closed' && (outcome === null || outcome.trim().length === 0)) {
      fail(422, 'OUTCOME_REQUIRED', 'Record the outcome before closing the case.');
    }
    return {
      ...conductView(row),
      status: body.status,
      owner: row.ownerUserId === null ? personRef(requirePersona().userId) : personRef(row.ownerUserId),
      outcome,
      closedAt: body.status === 'closed' ? isoNow(now) : null,
    };
  });
}
