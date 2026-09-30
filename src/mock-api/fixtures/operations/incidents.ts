/**
 * Operations fixtures: service incidents with impacts and timelines (OPS-05), privileged-access reviews and service
 * conduct cases (OPS-06).
 *
 * Storyline anchor: incident 1 is the resolved incident linked to T-2026-0002 ("one resolved service incident linked
 * to T-2026-0002"). KWU recorded its decision to keep the official deadline. Incident 2 is being monitored and still
 * awaits ODC's decision; incident 3 is resolved history without customer impact.
 */
import type { ServiceIncidentsStatus } from '../../../contracts/enums.js';
import type {
  AccessReviewOutcome,
  AccessReviewStatus,
  ConductCaseKind,
  ConductCaseStatus,
  ServiceIncidentSeverity,
} from '../../../contracts/operations.js';
import { TENANT_IDS } from '../platform.js';
import { OPS_USERS } from './users.js';

export interface FixtureServiceIncident {
  readonly id: number;
  readonly reference: string;
  readonly title: string;
  readonly description: string;
  readonly severity: ServiceIncidentSeverity;
  readonly startedAt: string;
  readonly resolvedAt: string | null;
  readonly status: ServiceIncidentsStatus;
  readonly customerNotice: string | null;
  /** Public notices omit customer and event detail. */
  readonly publicNotice: boolean;
}

/**
 * The window of INC-2026-007 (slow document uploads, 24 Sep 2026, 15:20 to 16:05 Africa/Gaborone). Gaborone
 * Metering's replacement upload on T-2026-0002 failed inside it (13:38 to 13:42 UTC), and the buyer's view of the
 * same incident on BUY-19 (bids fixtures) uses these instants.
 */
export const INCIDENT_SLOW_UPLOADS_WINDOW = Object.freeze({
  startedAt: '2026-09-24T13:20:00Z',
  resolvedAt: '2026-09-24T14:05:00Z',
});

export const SERVICE_INCIDENTS: readonly FixtureServiceIncident[] = Object.freeze([
  {
    id: 1,
    reference: 'INC-2026-007',
    title: 'Slow document uploads',
    description:
      'Uploads to submission storage were delayed for 45 minutes between 15:20 and 16:05 (UTC+02:00) because a storage node was degraded. Submissions already received were not affected; one replacement upload did not complete and the earlier receipt stayed effective.',
    severity: 'high',
    startedAt: INCIDENT_SLOW_UPLOADS_WINDOW.startedAt,
    resolvedAt: INCIDENT_SLOW_UPLOADS_WINDOW.resolvedAt,
    status: 'resolved',
    customerNotice:
      'Between 15:20 and 16:05 (UTC+02:00) on 24 Sep 2026 document uploads were slow. No submission was lost. Buyers with events open during this window have the timing evidence to decide whether any deadline change is needed.',
    publicNotice: true,
  },
  {
    id: 2,
    reference: 'INC-2026-008',
    title: 'Delayed e-mail notifications',
    description:
      'E-mail copies of notifications are delayed by up to 90 minutes because the SMTP relay is throttled. In-app notifications and formal notices are delivered on time.',
    severity: 'medium',
    startedAt: '2026-09-29T12:10:00Z',
    resolvedAt: null,
    status: 'monitoring',
    customerNotice:
      'E-mail copies of notifications may arrive up to 90 minutes late. Every notice is available on time in the notification centre, which remains the official record.',
    publicNotice: true,
  },
  {
    id: 3,
    reference: 'INC-2026-005',
    title: 'Search index rebuild (planned maintenance)',
    description: 'Global search returned incomplete results for 25 minutes during a planned index rebuild.',
    severity: 'low',
    startedAt: '2026-08-02T00:05:00Z',
    resolvedAt: '2026-08-02T00:30:00Z',
    status: 'resolved',
    customerNotice: 'Search results were incomplete between 02:05 and 02:30 (UTC+02:00) on 2 Aug 2026. No records were affected.',
    publicNotice: false,
  },
] satisfies FixtureServiceIncident[]);

export interface FixtureIncidentImpact {
  readonly id: number;
  readonly incidentId: number;
  readonly customerTenantId: number;
  readonly tenderId: number | null;
  readonly tenderReference: string | null;
  readonly impactNote: string;
  readonly buyerDecisionNote: string | null;
}

export const SERVICE_INCIDENT_IMPACTS: readonly FixtureIncidentImpact[] = Object.freeze([
  {
    id: 11,
    incidentId: 1,
    customerTenantId: TENANT_IDS.kwu,
    tenderId: 2,
    tenderReference: 'T-2026-0002',
    impactNote:
      'T-2026-0002 was open (deadline 21 Oct 2026). One supplier replacement upload started at 15:38 did not complete; the earlier receipt stayed effective and no receipt was lost.',
    buyerDecisionNote:
      'KWU decision (25 Sep 2026, Mpho Dikgang): the official deadline stays 21 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone. The incident was four weeks before closing and every affected supplier could resubmit.',
  },
  {
    id: 12,
    incidentId: 1,
    customerTenantId: TENANT_IDS.odc,
    tenderId: 11,
    tenderReference: 'T-2026-0011',
    impactNote: 'T-2026-0011 was open; no upload attempts were recorded during the incident window.',
    buyerDecisionNote: 'ODC decision (25 Sep 2026): no change to the deadline.',
  },
  {
    id: 21,
    incidentId: 2,
    customerTenantId: TENANT_IDS.kwu,
    tenderId: null,
    tenderReference: null,
    impactNote: 'E-mail copies of 46 notifications delayed; all in-app notices delivered on time.',
    buyerDecisionNote: null,
  },
  {
    id: 22,
    incidentId: 2,
    customerTenantId: TENANT_IDS.odc,
    tenderId: 11,
    tenderReference: 'T-2026-0011',
    impactNote: 'E-mail copies of the T-2026-0011 clarification notice delayed by 75 minutes; the in-app notice was on time.',
    buyerDecisionNote: null,
  },
] satisfies FixtureIncidentImpact[]);

export interface FixtureIncidentUpdate {
  readonly id: number;
  readonly incidentId: number;
  readonly at: string;
  readonly authorUserId: number;
  readonly action: string;
  readonly description: string;
}

export const SERVICE_INCIDENT_UPDATES: readonly FixtureIncidentUpdate[] = Object.freeze([
  { id: 6001, incidentId: 1, at: '2026-09-24T13:28:00Z', authorUserId: OPS_USERS.supportAgent, action: 'status.investigating', description: 'Upload latency alerts; investigating the storage tier.' },
  { id: 6002, incidentId: 1, at: '2026-09-24T13:45:00Z', authorUserId: OPS_USERS.opsAdmin, action: 'status.identified', description: 'Degraded storage node identified and removed from rotation.' },
  { id: 6003, incidentId: 1, at: '2026-09-24T13:50:00Z', authorUserId: OPS_USERS.opsAdmin, action: 'notice.published', description: 'Customer notice published to affected buyers.' },
  { id: 6004, incidentId: 1, at: INCIDENT_SLOW_UPLOADS_WINDOW.resolvedAt, authorUserId: OPS_USERS.opsAdmin, action: 'status.resolved', description: 'Upload times back to normal; timing evidence exported for affected buyers.' },
  { id: 6005, incidentId: 1, at: '2026-09-25T09:30:00Z', authorUserId: OPS_USERS.opsAdmin, action: 'buyer.decision_recorded', description: 'KWU and ODC recorded their deadline decisions.' },
  { id: 6011, incidentId: 2, at: '2026-09-29T12:25:00Z', authorUserId: OPS_USERS.supportAgent, action: 'status.investigating', description: 'Queue of outgoing e-mail growing.' },
  { id: 6012, incidentId: 2, at: '2026-09-29T13:00:00Z', authorUserId: OPS_USERS.opsAdmin, action: 'status.identified', description: 'The SMTP relay throttles the sending account; limit increase requested.' },
  { id: 6013, incidentId: 2, at: '2026-09-29T15:30:00Z', authorUserId: OPS_USERS.opsAdmin, action: 'status.monitoring', description: 'Limit raised; queue draining. Monitoring for 24 hours.' },
  { id: 6021, incidentId: 3, at: '2026-08-02T00:05:00Z', authorUserId: OPS_USERS.opsAdmin, action: 'status.investigating', description: 'Planned index rebuild started.' },
  { id: 6022, incidentId: 3, at: '2026-08-02T00:30:00Z', authorUserId: OPS_USERS.opsAdmin, action: 'status.resolved', description: 'Rebuild complete.' },
] satisfies FixtureIncidentUpdate[]);

// ---------------------------------------------------------------------------------------------------------
// Oversight (OPS-06)
// ---------------------------------------------------------------------------------------------------------

export interface FixtureAccessReview {
  readonly id: number;
  readonly subjectUserId: number;
  readonly capacity: string;
  readonly privileges: readonly string[];
  readonly grantsLast90Days: number;
  readonly status: AccessReviewStatus;
  readonly dueOn: string;
  readonly reviewerUserId: number | null;
  readonly reviewedAt: string | null;
  readonly outcome: AccessReviewOutcome | null;
  readonly note: string | null;
}

export const ACCESS_REVIEWS: readonly FixtureAccessReview[] = Object.freeze([
  {
    id: 1,
    subjectUserId: OPS_USERS.opsAdmin,
    capacity: 'Platform Operator',
    privileges: ['ops.customers.manage', 'ops.subscriptions.manage', 'ops.support.manage', 'ops.incidents.manage', 'ops.content.manage', 'ops.oversight.view'],
    grantsLast90Days: 0,
    status: 'due',
    dueOn: '2026-10-05',
    reviewerUserId: null,
    reviewedAt: null,
    outcome: null,
    note: null,
  },
  {
    id: 2,
    subjectUserId: OPS_USERS.supportAgent,
    capacity: 'Support Agent',
    privileges: ['ops.support.manage', 'ops.incidents.manage', 'ops.content.manage', 'support grants (customer-authorized)'],
    grantsLast90Days: 5,
    status: 'overdue',
    dueOn: '2026-09-20',
    reviewerUserId: null,
    reviewedAt: null,
    outcome: null,
    note: null,
  },
  {
    id: 3,
    subjectUserId: OPS_USERS.supportAgent,
    capacity: 'Support Agent',
    privileges: ['ops.support.manage', 'ops.incidents.manage', 'ops.content.manage'],
    grantsLast90Days: 2,
    status: 'completed',
    dueOn: '2026-06-20',
    reviewerUserId: OPS_USERS.opsAdmin,
    reviewedAt: '2026-06-18T10:00:00Z',
    outcome: 'retain',
    note: 'Both grants were customer-authorized, metadata only and ended on time.',
  },
] satisfies FixtureAccessReview[]);

export interface FixtureConductCase {
  readonly id: number;
  readonly reference: string;
  readonly kind: ConductCaseKind;
  readonly customerTenantId: number | null;
  readonly summary: string;
  readonly status: ConductCaseStatus;
  readonly reportedAt: string;
  readonly ownerUserId: number | null;
  readonly outcome: string | null;
  readonly closedAt: string | null;
}

export const CONDUCT_CASES: readonly FixtureConductCase[] = Object.freeze([
  {
    id: 1,
    reference: 'CC-2026-003',
    kind: 'service_complaint',
    customerTenantId: TENANT_IDS.odc,
    summary: 'ODC complains that its exit export question waited two working days for a first response.',
    status: 'under_review',
    reportedAt: '2026-09-29T08:00:00Z',
    ownerUserId: OPS_USERS.opsAdmin,
    outcome: null,
    closedAt: null,
  },
  {
    id: 2,
    reference: 'CC-2026-002',
    kind: 'misuse',
    customerTenantId: TENANT_IDS['gaborone-meter'],
    summary: 'A supplier attached bid documents for T-2026-0002 to a support message instead of submitting them.',
    status: 'closed',
    reportedAt: '2026-09-10T10:00:00Z',
    ownerUserId: OPS_USERS.opsAdmin,
    outcome:
      'The attachments were deleted from the case without being opened or forwarded to the buyer. The supplier was directed to the official submission route; support is not a submission channel.',
    closedAt: '2026-09-10T15:30:00Z',
  },
  {
    id: 3,
    reference: 'CC-2026-001',
    kind: 'misuse',
    customerTenantId: null,
    summary: 'Repeated failed sign-ins against supplier administrator accounts from one network.',
    status: 'open',
    reportedAt: '2026-09-28T22:15:00Z',
    ownerUserId: OPS_USERS.opsAdmin,
    outcome: null,
    closedAt: null,
  },
] satisfies FixtureConductCase[]);
