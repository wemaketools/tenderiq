/**
 * Notification fixtures (COM-06; PRD §14.3; BR-41, BR-42; DD-11, DD-42, DD-44): the notifications of every
 * persona, in the RECIPIENT's tenant (a supplier user's formal notices live in the supplier tenant, DD-11), with
 * their delivery attempts, plus the personal delivery preferences of a few personas.
 *
 * Reading, acknowledging and accepting terms are separate facts (BR-41): several formal notices are read but not
 * acknowledged, one carries terms accepted separately, and one email delivery failed without any deadline change
 * (BR-42).
 */
import type { Instant } from '../../contracts/common.js';
import type {
  NotificationDeliveriesStatus,
  NotificationRulesEventType,
  UserNotificationPreferencesDigest,
} from '../../contracts/enums.js';
import { isMandatoryNotificationEvent } from '../../contracts/enums.js';
import { LINKS, OFFICIAL_ZONE, RECORDS, tid, uid } from './approvals/world.js';
import type { TenantSlug } from './platform.js';
import { categoryOf } from './notification-rules.js';
import type { NotificationsCategory } from '../../contracts/enums.js';

export interface FixtureNotificationDelivery {
  readonly channel: 'in_app' | 'email';
  readonly status: NotificationDeliveriesStatus;
  readonly attemptedAt: Instant | null;
  readonly failureReason: string | null;
}

export interface FixtureNotification {
  readonly id: number;
  readonly tenantId: number;
  readonly recipientUserId: number;
  readonly eventType: NotificationRulesEventType;
  readonly category: NotificationsCategory;
  readonly title: string;
  readonly body: string;
  readonly sourceType: string | null;
  readonly sourceId: number | null;
  readonly sourceReference: string | null;
  readonly linkPath: string | null;
  readonly mandatory: boolean;
  readonly requiresAcknowledgment: boolean;
  readonly createdAt: Instant;
  readonly readAt: Instant | null;
  readonly acknowledgedAt: Instant | null;
  readonly acknowledgedByUserId: number | null;
  readonly noticeRecipientId: number | null;
  readonly deliveries: readonly FixtureNotificationDelivery[];
  readonly hasTerms: boolean;
  readonly termsAcceptedAt: Instant | null;
  readonly deadline: { at: Instant; timeZone: string } | null;
}

interface NotificationSpec {
  readonly id: number;
  readonly to: string;
  readonly tenant: TenantSlug;
  readonly event: NotificationRulesEventType;
  readonly title: string;
  readonly body: string;
  readonly source?: { type: string; id: number | null; reference: string | null };
  readonly link?: string;
  readonly at: Instant;
  readonly readAt?: Instant;
  readonly ack?: boolean;
  readonly acknowledgedAt?: Instant;
  readonly acknowledgedBy?: string;
  readonly noticeRecipientId?: number;
  readonly emailFailed?: string;
  readonly hasTerms?: boolean;
  readonly termsAcceptedAt?: Instant;
  readonly deadline?: Instant;
}

function secondsLater(at: Instant, seconds: number): Instant {
  return new Date(Date.parse(at) + seconds * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function notification(spec: NotificationSpec): FixtureNotification {
  const category = categoryOf(spec.event);
  const mandatory = isMandatoryNotificationEvent(spec.event);
  const deliveries: FixtureNotificationDelivery[] = [
    { channel: 'in_app', status: 'delivered', attemptedAt: spec.at, failureReason: null },
  ];
  if (category !== 'promotional') {
    deliveries.push(
      spec.emailFailed === undefined
        ? { channel: 'email', status: 'delivered', attemptedAt: secondsLater(spec.at, 40), failureReason: null }
        : { channel: 'email', status: 'failed', attemptedAt: secondsLater(spec.at, 40), failureReason: spec.emailFailed },
    );
  }
  return {
    id: spec.id,
    tenantId: tid(spec.tenant),
    recipientUserId: uid(spec.to),
    eventType: spec.event,
    category,
    title: spec.title,
    body: spec.body,
    sourceType: spec.source?.type ?? null,
    sourceId: spec.source?.id ?? null,
    sourceReference: spec.source?.reference ?? null,
    linkPath: spec.link ?? null,
    mandatory,
    requiresAcknowledgment: spec.ack ?? false,
    createdAt: spec.at,
    readAt: spec.readAt ?? null,
    acknowledgedAt: spec.acknowledgedAt ?? null,
    acknowledgedByUserId: spec.acknowledgedBy === undefined ? (spec.acknowledgedAt === undefined ? null : uid(spec.to)) : uid(spec.acknowledgedBy),
    noticeRecipientId: spec.noticeRecipientId ?? null,
    deliveries,
    hasTerms: spec.hasTerms ?? false,
    termsAcceptedAt: spec.termsAcceptedAt ?? null,
    deadline: spec.deadline === undefined ? null : { at: spec.deadline, timeZone: OFFICIAL_ZONE },
  };
}

const approval = (id: number, reference: string) => ({ type: 'approval_request', id, reference });
const record = (key: keyof typeof RECORDS) => ({ type: RECORDS[key].type, id: RECORDS[key].id, reference: RECORDS[key].reference });

/** T-2026-0002's official submission deadline after Addendum 1 (21 Oct 2026, 12:00 Africa/Gaborone). */
const T2_DEADLINE = '2026-10-21T10:00:00Z';
const T6_DEADLINE = '2026-10-14T10:00:00Z';
const T7_STANDSTILL = '2026-10-08T15:00:00Z';

export const NOTIFICATIONS: readonly FixtureNotification[] = Object.freeze([
  // ---------------------------------------------------------------- KWU
  notification({ id: 501, to: 'mpho.manager', tenant: 'kwu', event: 'approval_needed', title: 'Approval needed: strategy for the emergency pump motor replacement (BWP 320,000.00)', body: 'Please decide on the direct-award strategy “Emergency replacement of failed pump motors — Letlhakane”, revision 1, by 6 Oct 2026.', source: approval(328, 'Emergency replacement of failed pump motors — Letlhakane'), link: '/me/approvals/328', at: '2026-09-29T15:00:10Z' }),
  notification({ id: 502, to: 'mpho.manager', tenant: 'kwu', event: 'approval_needed', title: 'Approval needed: exclusion on T-2026-0003', body: 'Please decide on the exclusion of Makgadikgadi Civil Works from T-2026-0003 by 3 Oct 2026.', source: approval(37, 'T-2026-0003'), link: '/me/approvals/37', at: '2026-09-29T11:00:10Z', readAt: '2026-09-29T12:14:00Z' }),
  notification({ id: 503, to: 'mpho.manager', tenant: 'kwu', event: 'task_overdue', title: 'Overdue: exclusion decision on T-2026-0003', body: 'Your approval task was due on 3 Oct 2026. It escalates to Keabetswe Nkwe after 48 hours.', source: approval(37, 'T-2026-0003'), link: '/me/approvals/37', at: '2026-10-03T15:15:00Z' }),
  notification({ id: 504, to: 'mpho.manager', tenant: 'kwu', event: 'approval_needed', title: 'Approval needed: CR-0003 to C-2026-0001 (acting for Keabetswe Nkwe)', body: 'You hold a delegation for contract changes up to BWP 500,000.00 until 20 Oct 2026.', source: approval(36, 'C-2026-0001 CR-0003'), link: '/me/approvals/36', at: '2026-10-01T12:05:10Z' }),
  notification({ id: 505, to: 'mpho.manager', tenant: 'kwu', event: 'authority_change', title: 'Delegation received from Keabetswe Nkwe', body: 'Contract changes up to BWP 500,000.00, from 1 Oct to 20 Oct 2026.', source: { type: 'delegation', id: 7, reference: 'Delegation 7' }, link: '/me/profile', at: '2026-09-30T16:00:00Z', readAt: '2026-10-01T06:50:00Z' }),
  notification({ id: 506, to: 'mpho.manager', tenant: 'kwu', event: 'approval_needed', title: 'Approval needed: late submission exception on T-2026-0002', body: 'Your conflict declaration on Chobe Pipe & Valve Supplies is pending review; the decision is blocked until it is cleared.', source: approval(43, 'T-2026-0002'), link: '/me/approvals/43', at: '2026-10-03T09:00:10Z' }),
  notification({ id: 507, to: 'mpho.manager', tenant: 'kwu', event: 'evaluation_overdue', title: 'Evaluation overdue: T-2026-0003 criterion T4', body: 'Kabo Ntsima has not scored criterion T4. The assessment stays incomplete.', source: record('t3'), link: LINKS.evaluation(3), at: '2026-10-05T06:00:00Z' }),
  notification({ id: 508, to: 'mpho.manager', tenant: 'kwu', event: 'approval_needed', title: 'Approval needed: Addendum 3 to T-2026-0002', body: 'You drafted this addendum; an independent approver is required.', source: approval(44, 'T-2026-0002 Addendum 3'), link: '/me/approvals/44', at: '2026-10-05T07:00:10Z', readAt: '2026-10-05T07:30:00Z' }),
  notification({ id: 509, to: 'keabetswe.approver', tenant: 'kwu', event: 'approval_needed', title: 'Approval needed: PR-2026-0003 (BWP 5,120,000.00) — routed to you', body: 'The total commitment exceeds the procurement manager’s authority of BWP 2,000,000.00. Please decide by 7 Oct 2026.', source: approval(305, 'PR-2026-0003'), link: '/me/approvals/305', at: '2026-09-23T08:15:10Z' }),
  notification({ id: 510, to: 'keabetswe.approver', tenant: 'kwu', event: 'authority_change', title: 'Your delegation to Mpho Dikgang is in force', body: 'Contract changes up to BWP 500,000.00 from 1 to 20 Oct 2026.', source: { type: 'delegation', id: 7, reference: 'Delegation 7' }, link: '/me/profile', at: '2026-09-30T16:00:00Z', readAt: '2026-09-30T16:20:00Z' }),
  notification({ id: 511, to: 'tebogo.officer', tenant: 'kwu', event: 'approval_returned', title: 'Release approval invalidated: T-2026-0005', body: 'Revision 3 added Lot 3 (polyelectrolyte flocculant) and raised the estimated value to BWP 1,920,000.00. Request approval of revision 3 before release.', source: approval(31, 'T-2026-0005'), link: '/me/approvals/31', at: '2026-09-28T09:14:05Z' }),
  notification({ id: 512, to: 'tebogo.officer', tenant: 'kwu', event: 'delivery_exception', title: 'Delivery exception: Addendum 1 email to Chobe Pipe & Valve Supplies', body: 'The email to Bakang Chobe failed (mailbox full); the in-app notice was delivered. The failure does not change the deadline.', source: { type: 'notice', id: 7021, reference: 'T-2026-0002 Addendum 1' }, link: '/me/tasks', at: '2026-09-24T08:07:00Z', deadline: T2_DEADLINE }),
  notification({ id: 513, to: 'tebogo.officer', tenant: 'kwu', event: 'task_assigned', title: 'New question Q-206 on T-2026-0002', body: 'A participant asked whether part of the domestic meters may be delivered to the Maun depot. Answer by 5 Oct 2026.', source: { type: 'question', id: 206, reference: 'T-2026-0002 Q-206' }, link: LINKS.buyerQuestion(206), at: '2026-09-29T11:20:05Z' }),
  notification({ id: 514, to: 'tebogo.officer', tenant: 'kwu', event: 'complaint_update', title: 'Complaint CMP-2026-0001 on T-2026-0007 received', body: 'A blocking hold applies: no award or contract action until the complaint is decided.', source: record('t7'), link: '/buyer/tenders/7', at: '2026-09-29T09:00:00Z', readAt: '2026-09-29T09:30:00Z', deadline: T7_STANDSTILL }),
  notification({ id: 515, to: 'tebogo.officer', tenant: 'kwu', event: 'task_assigned', title: 'Ownership of T-2026-0008 reassigned to you', body: 'Gaone Letsholo left the organization; the tender and its open work are yours.', source: record('t8'), link: '/buyer/tenders/8', at: '2026-09-22T08:00:05Z', readAt: '2026-09-22T08:40:00Z' }),
  notification({ id: 516, to: 'kagiso.requester', tenant: 'kwu', event: 'task_assigned', title: 'Information requested on PR-2026-0004', body: 'Tebogo Molefe asks whether the analysers must integrate with the laboratory information system, and for the two price lists behind the estimate. Reply by 8 Oct 2026.', source: record('pr4'), link: RECORDS.pr4.buyerLink, at: '2026-09-24T10:05:05Z', readAt: '2026-09-24T11:00:00Z' }),
  notification({ id: 517, to: 'kagiso.requester', tenant: 'kwu', event: 'approval_expired', title: 'Funding approval expired: PR-2026-0011', body: 'The funding confirmation was not decided before 17 Jun 2026. Request it again when the resilience grant is decided.', source: approval(45, 'PR-2026-0011'), link: RECORDS.pr11.buyerLink, at: '2026-06-17T15:05:00Z', readAt: '2026-06-18T07:00:00Z' }),
  notification({ id: 518, to: 'kagiso.requester', tenant: 'kwu', event: 'request_submitted', title: 'PR-2026-0003 routed to the Chief Executive', body: 'Mpho Dikgang escalated it: the total commitment of BWP 5,120,000.00 exceeds his authority. Keabetswe Nkwe decides.', source: record('pr3'), link: RECORDS.pr3.buyerLink, at: '2026-09-23T08:15:10Z', readAt: '2026-09-23T09:00:00Z' }),
  notification({ id: 519, to: 'onalenna.budget', tenant: 'kwu', event: 'approval_needed', title: 'Funding confirmation needed: PR-2026-0008 (BWP 840,000.00)', body: 'Confirm the funding of the protective clothing and PPE supply by 9 Oct 2026; the requester marked it as indicative.', source: approval(34, 'PR-2026-0008'), link: '/me/approvals/34', at: '2026-09-28T08:30:10Z' }),
  notification({ id: 520, to: 'neo.assessor', tenant: 'kwu', event: 'task_assigned', title: 'Assess QA-2026-0006 (Makgadikgadi Civil Works)', body: 'Due 14 Oct 2026.', source: { type: 'qualification_application', id: 503, reference: 'QA-2026-0006' }, link: '/buyer/qualification/applications/503', at: '2026-09-15T08:00:05Z', readAt: '2026-09-15T09:00:00Z' }),
  notification({ id: 521, to: 'lesego.finance', tenant: 'kwu', event: 'task_overdue', title: 'Overdue: financial review of QA-2026-0006', body: 'The review was due on 2 Oct 2026; the supplier’s clarification is still awaited.', source: { type: 'qualification_application', id: 503, reference: 'QA-2026-0006' }, link: '/buyer/qualification/applications/503', at: '2026-10-02T15:15:00Z' }),
  notification({ id: 522, to: 'boitumelo.chair', tenant: 'kwu', event: 'evaluation_overdue', title: 'Evaluation overdue: criterion T4 on T-2026-0003', body: 'Kabo Ntsima’s assessment is incomplete; missing scores are never treated as zero.', source: record('t3'), link: LINKS.evaluation(3), at: '2026-10-03T15:15:00Z' }),
  notification({ id: 523, to: 'thato.eval', tenant: 'kwu', event: 'evaluation_assigned', title: 'Evaluation assigned: T-2026-0003', body: 'Score the technical criteria by 1 Oct 2026. Declare conflicts first.', source: record('t3'), link: LINKS.evaluation(3), at: '2026-09-20T08:00:05Z', readAt: '2026-09-20T09:00:00Z' }),
  notification({ id: 524, to: 'kabo.eval', tenant: 'kwu', event: 'evaluation_overdue', title: 'Evaluation overdue: T-2026-0003', body: 'Criterion T4 for one bidder is not scored. It escalates to the chair.', source: record('t3'), link: LINKS.evaluation(3), at: '2026-10-01T15:15:00Z' }),
  notification({ id: 525, to: 'amantle.eval', tenant: 'kwu', event: 'evaluation_assigned', title: 'Evaluation assigned: T-2026-0009', body: 'Sign the confidentiality undertaking before the material opens.', source: record('t9'), link: LINKS.evaluation(9), at: '2026-10-02T08:00:05Z' }),
  notification({ id: 526, to: 'refilwe.commercial', tenant: 'kwu', event: 'task_assigned', title: 'Review arithmetic corrections on T-2026-0003', body: 'Due 9 Oct 2026.', source: record('t3'), link: LINKS.evaluation(3), at: '2026-10-02T08:00:05Z' }),
  notification({ id: 527, to: 'oratile.opener', tenant: 'kwu', event: 'task_assigned', title: 'Opening scheduled: T-2026-0008', body: 'Open the envelopes on 7 Oct 2026 at 12:00 with a witness.', source: record('t8'), link: '/buyer/tenders/8', at: '2026-10-01T12:00:05Z' }),
  notification({ id: 528, to: 'goitse.witness', tenant: 'kwu', event: 'task_assigned', title: 'Witness the opening of T-2026-0008', body: '7 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone.', source: record('t8'), link: '/buyer/tenders/8', at: '2026-10-01T12:00:05Z', readAt: '2026-10-01T13:00:00Z' }),
  notification({ id: 529, to: 'dineo.legal', tenant: 'kwu', event: 'approval_needed', title: 'Legal review needed: C-2026-0002 differs from the award', body: 'Review before the Chief Executive decides; due 8 Oct 2026.', source: approval(42, 'C-2026-0002'), link: '/me/approvals/42', at: '2026-10-01T08:10:10Z' }),
  notification({ id: 530, to: 'dineo.legal', tenant: 'kwu', event: 'complaint_update', title: 'Complaint CMP-2026-0001 on T-2026-0007', body: 'Your advice is requested by 12 Oct 2026.', source: record('t7'), link: '/buyer/tenders/7', at: '2026-09-30T08:00:05Z', readAt: '2026-09-30T10:00:00Z', deadline: T7_STANDSTILL }),
  notification({ id: 531, to: 'masego.contracts', tenant: 'kwu', event: 'renewal_window', title: 'Renewal window for C-2026-0001 opens on 5 Oct 2026', body: 'A renewal decision is required. Nothing renews automatically.', source: record('c1'), link: '/buyer/contracts/1', at: '2026-09-30T02:40:00Z' }),
  notification({ id: 532, to: 'masego.contracts', tenant: 'kwu', event: 'contract_milestone_due', title: 'Q3 service report rejected — remediation due 20 Oct', body: 'The supplier must remediate the report; acceptance and payment readiness are not implied.', source: record('c1'), link: '/buyer/contracts/1', at: '2026-10-03T11:00:05Z', readAt: '2026-10-03T11:30:00Z' }),
  notification({ id: 533, to: 'pule.auditor', tenant: 'kwu', event: 'product_announcement', title: 'New: evidence pack export history', body: 'Audit users can now see who exported which evidence pack.', at: '2026-09-28T06:00:00Z' }),
  notification({ id: 534, to: 'admin.kwu', tenant: 'kwu', event: 'authority_change', title: 'Gaone Letsholo deactivated — 1 open item to reassign', body: 'Past approvals and submissions remain attributed to her.', source: { type: 'user', id: uid('former.officer'), reference: 'Gaone Letsholo' }, link: LINKS.buyerUser(uid('former.officer')), at: '2026-09-22T08:00:05Z', readAt: '2026-09-22T08:10:00Z' }),
  notification({ id: 535, to: 'admin.kwu', tenant: 'kwu', event: 'approval_needed', title: 'Calendar “Botswana Public Holidays 2027” awaits approval', body: 'Drafted by Mpho Dikgang. Review the holidays before approving.', source: { type: 'calendar', id: 2, reference: 'Botswana Public Holidays 2027' }, link: '/buyer/admin/calendars/2', at: '2026-10-02T09:00:05Z' }),
  notification({ id: 536, to: 'admin.kwu', tenant: 'kwu', event: 'service_incident', title: 'Service incident INC-2026-007 resolved', body: 'Large document uploads were slow on 24 Sep 2026 between 09:40 and 10:25 (UTC+02:00). No submission was lost; any deadline decision stays with KWU.', source: { type: 'service_incident', id: 1, reference: 'INC-2026-007' }, link: '/service-status', at: '2026-09-24T08:30:00Z', readAt: '2026-09-24T09:00:00Z' }),
  notification({ id: 537, to: 'sam.dual', tenant: 'kwu', event: 'evaluation_assigned', title: 'Declare conflicts before evaluating T-2026-0003', body: 'Your memberships at Tsodilo Engineering and Chobe Pipe & Valve Supplies are routed to the chair for review.', source: record('t3'), link: LINKS.evaluation(3), at: '2026-10-01T08:00:05Z' }),
  // ---------------------------------------------------------------- ODC
  notification({ id: 551, to: 'officer.odc', tenant: 'odc', event: 'task_assigned', title: 'New question Q-302 on T-2026-0011', body: 'A participant asked whether weekend cleaning is required at the Maun council chambers during council sessions. Answer by 5 Oct 2026.', source: { type: 'question', id: 302, reference: 'T-2026-0011 Q-302' }, link: LINKS.buyerQuestion(302), at: '2026-09-28T10:30:05Z' }),
  notification({ id: 552, to: 'admin.odc', tenant: 'odc', event: 'task_assigned', title: 'Review the draft offboarding plan', body: 'The plan must preserve access and obligations for T-2026-0011 and the cleaning contract.', source: { type: 'offboarding_plan', id: 1, reference: 'ODC offboarding plan' }, link: LINKS.buyerSubscription, at: '2026-10-01T08:00:05Z', readAt: '2026-10-01T09:00:00Z' }),
  // ---------------------------------------------------------------- Tsodilo
  notification({ id: 601, to: 'tsodilo.bidmanager', tenant: 'tsodilo', event: 'invitation_received', title: 'Invitation to respond: T-2026-0006 Chlorine dosing equipment', body: 'Kalahari Water Utilities invites Tsodilo Engineering to respond. Official deadline: 21 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone.', source: record('t6'), link: '/supplier/opportunities/6', at: '2026-09-24T08:05:00Z', readAt: '2026-09-24T09:00:00Z', ack: true, acknowledgedAt: '2026-09-24T09:02:00Z', noticeRecipientId: 3601, deadline: T6_DEADLINE }),
  notification({ id: 602, to: 'tsodilo.admin', tenant: 'tsodilo', event: 'invitation_received', title: 'Invitation to respond: T-2026-0006 Chlorine dosing equipment', body: 'Acknowledged for Tsodilo Engineering by Boago Moremi.', source: record('t6'), link: '/supplier/opportunities/6', at: '2026-09-24T08:05:00Z', readAt: '2026-09-25T07:00:00Z', ack: true, acknowledgedAt: '2026-09-24T09:02:00Z', acknowledgedBy: 'tsodilo.bidmanager', noticeRecipientId: 3601, deadline: T6_DEADLINE }),
  notification({ id: 603, to: 'tsodilo.signatory', tenant: 'tsodilo', event: 'award_decided', title: 'Award decision for T-2026-0001 Lot 1: awarded to Tsodilo Engineering', body: 'Kalahari Water Utilities awards Lot 1. Contract C-2026-0002 follows; acknowledge the notice and, separately, accept the award conditions.', source: record('t1'), link: '/supplier/opportunities/1', at: '2026-09-12T08:00:00Z', readAt: '2026-09-12T09:15:00Z', ack: true, hasTerms: true, noticeRecipientId: 3602 }),
  notification({ id: 604, to: 'tsodilo.bidmanager', tenant: 'tsodilo', event: 'closing_approaching', title: 'T-2026-0006 closes on 21 Oct 2026', body: 'Only an official receipt establishes a submission.', source: record('t6'), link: '/supplier/opportunities/6/response', at: '2026-10-05T10:00:00Z', deadline: T6_DEADLINE }),
  notification({ id: 605, to: 'tsodilo.contributor', tenant: 'tsodilo', event: 'task_assigned', title: 'Complete technical answers section B (T-2026-0006)', body: 'Assigned by Boago Moremi; due 12 Oct 2026.', source: record('t6'), link: '/supplier/opportunities/6/response', at: '2026-09-25T08:00:05Z', readAt: '2026-09-25T08:30:00Z' }),
  notification({ id: 606, to: 'tsodilo.admin', tenant: 'tsodilo', event: 'evidence_expiring', title: 'Tax clearance certificate expires on 31 Dec 2026', body: 'Renew it to keep the qualification with Kalahari Water Utilities current.', source: { type: 'evidence_item', id: 418, reference: 'Tax clearance certificate' }, link: '/supplier/evidence', at: '2026-10-01T02:10:00Z', readAt: '2026-10-01T07:00:00Z' }),
  notification({ id: 607, to: 'sam.dual', tenant: 'tsodilo', event: 'task_assigned', title: 'Proofread the method statement (T-2026-0006)', body: 'Assigned by Boago Moremi.', source: record('t6'), link: '/supplier/opportunities/6/response', at: '2026-10-03T09:00:05Z' }),
  // ---------------------------------------------------------------- Chobe
  notification({ id: 611, to: 'chobe-pipe.bidmanager', tenant: 'chobe-pipe', event: 'addendum_issued', title: 'Addendum 1 issued for T-2026-0002 — action required', body: 'A new mandatory requirement (OIML R49 type-approval certificate) applies. Acknowledge the addendum and supplement your response. The official deadline moves to 21 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone.', source: { type: 'notice', id: 7021, reference: 'T-2026-0002 Addendum 1' }, link: '/supplier/opportunities/2', at: '2026-09-24T08:06:00Z', readAt: '2026-10-01T12:30:00Z', ack: true, noticeRecipientId: 3611, emailFailed: '552 Mailbox full (remote server)', deadline: T2_DEADLINE }),
  notification({ id: 612, to: 'chobe-pipe.bidmanager', tenant: 'chobe-pipe', event: 'submission_failed', title: 'Replacement NOT accepted for T-2026-0008 (late)', body: 'Your replacement completed at 10:00:38 on 25 Sep 2026, 38 seconds after the deadline, and was rejected. The attempt time is recorded; receipt RCPT-2026-000024 of revision 1 remains effective.', source: record('t8'), link: '/supplier/opportunities/8', at: '2026-09-25T08:00:40Z', readAt: '2026-09-25T08:20:00Z' }),
  notification({ id: 613, to: 'chobe-pipe.admin', tenant: 'chobe-pipe', event: 'evidence_expiring', title: 'Public liability insurance expires on 8 Oct 2026', body: 'Kalahari Water Utilities relies on it for your “Category A” qualification. Upload the renewed certificate.', source: { type: 'evidence_item', id: 504, reference: 'Insurance — public liability' }, link: '/supplier/evidence', at: '2026-10-04T02:10:00Z' }),
  notification({ id: 614, to: 'chobe-pipe.admin', tenant: 'chobe-pipe', event: 'addendum_issued', title: 'Addendum 1 issued for T-2026-0002 — action required', body: 'Acknowledge the addendum for Chobe Pipe & Valve Supplies and supplement the response.', source: { type: 'notice', id: 7021, reference: 'T-2026-0002 Addendum 1' }, link: '/supplier/opportunities/2', at: '2026-09-24T08:06:00Z', ack: true, noticeRecipientId: 3611, deadline: T2_DEADLINE }),
  notification({ id: 615, to: 'chobe-pipe.contributor', tenant: 'chobe-pipe', event: 'addendum_issued', title: 'Addendum 1 issued for T-2026-0002', body: 'For information: the bid manager acknowledges formal notices for the organization.', source: { type: 'notice', id: 7021, reference: 'T-2026-0002 Addendum 1' }, link: '/supplier/opportunities/2', at: '2026-09-24T08:06:00Z', ack: true, noticeRecipientId: 3611, deadline: T2_DEADLINE }),
  notification({ id: 616, to: 'chobe-pipe.signatory', tenant: 'chobe-pipe', event: 'invitation_received', title: 'Invitation to respond: T-2026-0006 Chlorine dosing equipment', body: 'Official deadline: 21 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone.', source: record('t6'), link: '/supplier/opportunities/6', at: '2026-09-24T08:05:00Z', readAt: '2026-09-24T11:00:00Z', ack: true, acknowledgedAt: '2026-09-24T11:05:00Z', noticeRecipientId: 3616, emailFailed: '550 Recipient address rejected', deadline: T6_DEADLINE }),
  notification({ id: 617, to: 'sam.dual', tenant: 'chobe-pipe', event: 'addendum_issued', title: 'Addendum 1 issued for T-2026-0002', body: 'For information: the bid manager acknowledges formal notices for the organization.', source: { type: 'notice', id: 7021, reference: 'T-2026-0002 Addendum 1' }, link: '/supplier/opportunities/2', at: '2026-09-24T08:06:00Z', ack: true, noticeRecipientId: 3611, deadline: T2_DEADLINE }),
  notification({ id: 618, to: 'sam.dual', tenant: 'chobe-pipe', event: 'task_assigned', title: 'Check the pressure ratings table (T-2026-0006)', body: 'Assigned by Bakang Chobe.', source: record('t6'), link: '/supplier/opportunities/6/response', at: '2026-10-03T08:00:05Z', readAt: '2026-10-03T12:00:00Z' }),
  // ---------------------------------------------------------------- Serowe ICT
  notification({ id: 621, to: 'serowe-ict.bidmanager', tenant: 'serowe-ict', event: 'closing_approaching', title: 'T-2026-0002 closes on 21 Oct 2026 — your response is NOT submitted', body: 'Internal approval does not establish a submission. Submit to receive an official receipt.', source: record('t2'), link: '/supplier/opportunities/2/response', at: '2026-10-05T10:00:00Z', deadline: T2_DEADLINE }),
  notification({ id: 622, to: 'serowe-ict.bidmanager', tenant: 'serowe-ict', event: 'addendum_issued', title: 'Addendum 1 issued for T-2026-0002 — action required', body: 'A new mandatory requirement applies.', source: { type: 'notice', id: 7021, reference: 'T-2026-0002 Addendum 1' }, link: '/supplier/opportunities/2', at: '2026-09-24T08:06:00Z', readAt: '2026-10-01T10:30:00Z', ack: true, acknowledgedAt: '2026-10-01T10:31:00Z', noticeRecipientId: 3622, deadline: T2_DEADLINE }),
  notification({ id: 623, to: 'serowe-ict.signatory', tenant: 'serowe-ict', event: 'task_assigned', title: 'Response approved internally — not yet submitted', body: 'Otsile Serowe must still submit it before 21 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone.', source: record('t2'), link: '/supplier/opportunities/2/response', at: '2026-10-03T16:41:00Z', readAt: '2026-10-03T17:00:00Z' }),
  notification({ id: 624, to: 'serowe-ict.contributor', tenant: 'serowe-ict', event: 'task_assigned', title: 'Complete the integration section (T-2026-0002)', body: 'Assigned by Otsile Serowe.', source: record('t2'), link: '/supplier/opportunities/2/response', at: '2026-09-25T08:00:05Z', readAt: '2026-09-25T08:10:00Z' }),
  notification({ id: 625, to: 'serowe-ict.admin', tenant: 'serowe-ict', event: 'user_invitation', title: 'Sam Keitumetse requested membership', body: 'Approve or decline the pending membership request.', source: { type: 'user', id: uid('sam.dual'), reference: 'Sam Keitumetse' }, link: LINKS.supplierUsers, at: '2026-09-29T08:00:00Z' }),
  // ---------------------------------------------------------------- Gaborone Metering
  notification({ id: 631, to: 'gaborone-meter.bidmanager', tenant: 'gaborone-meter', event: 'submission_failed', title: 'Supplement NOT received for T-2026-0002 — receipt RCPT-2026-000021 stays effective', body: 'Your supplement upload of 24 Sep 2026 did not complete during a service incident. The earlier submission remains effective; no new receipt was issued.', source: record('t2'), link: '/supplier/opportunities/2/response', at: '2026-09-24T13:43:00Z' }),
  notification({ id: 632, to: 'gaborone-meter.bidmanager', tenant: 'gaborone-meter', event: 'submission_succeeded', title: 'Receipt RCPT-2026-000021 — submission received for T-2026-0002', body: 'Received 18 Sep 2026, 11:12 (UTC+02:00) Africa/Gaborone.', source: record('t2'), link: '/supplier/opportunities/2/response', at: '2026-09-18T09:12:49Z', readAt: '2026-09-18T09:20:00Z' }),
  notification({ id: 633, to: 'gaborone-meter.bidmanager', tenant: 'gaborone-meter', event: 'addendum_issued', title: 'Addendum 1 issued for T-2026-0002 — action required', body: 'Acknowledge the addendum and supplement your response.', source: { type: 'notice', id: 7021, reference: 'T-2026-0002 Addendum 1' }, link: '/supplier/opportunities/2', at: '2026-09-24T08:06:00Z', readAt: '2026-10-01T11:00:00Z', ack: true, acknowledgedAt: '2026-10-01T11:01:00Z', noticeRecipientId: 3633, deadline: T2_DEADLINE }),
  notification({ id: 634, to: 'gaborone-meter.admin', tenant: 'gaborone-meter', event: 'submission_succeeded', title: 'Receipt RCPT-2026-000021 for T-2026-0002', body: 'Submitted by Kagiso Metsi.', source: record('t2'), link: '/supplier/opportunities/2', at: '2026-09-18T09:12:49Z', readAt: '2026-09-18T10:00:00Z' }),
  notification({ id: 635, to: 'gaborone-meter.contributor', tenant: 'gaborone-meter', event: 'task_assigned', title: 'Attach the OIML R49 type-approval certificates', body: 'Assigned by Kagiso Metsi; due 8 Oct 2026.', source: record('t2'), link: '/supplier/opportunities/2/response', at: '2026-10-01T11:00:05Z' }),
  notification({ id: 636, to: 'gaborone-meter.signatory', tenant: 'gaborone-meter', event: 'task_assigned', title: 'Approve the replacement response internally', body: 'Due 10 Oct 2026.', source: record('t2'), link: '/supplier/opportunities/2/response', at: '2026-10-03T15:20:05Z' }),
  // ---------------------------------------------------------------- Makgadikgadi, Limpopo
  notification({ id: 641, to: 'makgadikgadi.admin', tenant: 'makgadikgadi', event: 'clarification_requested', title: 'Clarification requested on QA-2026-0006', body: 'Provide audited FY2025 statements or an accountant’s letter stating the reporting currency by 10 Oct 2026.', source: { type: 'qualification_application', id: 503, reference: 'QA-2026-0006' }, link: '/supplier/qualification/applications/503', at: '2026-09-22T11:00:05Z', readAt: '2026-09-22T14:00:00Z' }),
  notification({ id: 642, to: 'makgadikgadi.admin', tenant: 'makgadikgadi', event: 'product_announcement', title: 'Tip: renew evidence once for every buyer', body: 'Evidence you renew is offered to each buyer you share it with.', at: '2026-09-28T06:00:00Z' }),
  notification({ id: 651, to: 'limpopo-env.admin', tenant: 'limpopo-env', event: 'intent_to_award', title: 'Decision notice for T-2026-0007: intent to award — you were not selected', body: 'The standstill period ends on 8 Oct 2026, 17:00 (UTC+02:00) Africa/Gaborone. A debrief is available on request.', source: record('t7'), link: '/supplier/opportunities/7', at: '2026-09-22T12:00:00Z', readAt: '2026-09-22T13:00:00Z', ack: true, acknowledgedAt: '2026-09-22T13:05:00Z', noticeRecipientId: 3651, deadline: T7_STANDSTILL }),
  notification({ id: 652, to: 'limpopo-env.admin', tenant: 'limpopo-env', event: 'complaint_update', title: 'Complaint CMP-2026-0001 received — hold in place', body: 'Your complaint was received on 29 Sep 2026. No contract may be signed until it is decided.', source: record('t7'), link: '/supplier/opportunities/7', at: '2026-09-29T09:00:00Z' }),
  notification({ id: 653, to: 'limpopo-env.admin', tenant: 'limpopo-env', event: 'standstill_changed', title: 'Standstill for T-2026-0007 extended while the complaint is decided', body: 'The waiting period ends on 8 Oct 2026, 17:00 (UTC+02:00) Africa/Gaborone or when the complaint is decided, whichever is later.', source: record('t7'), link: '/supplier/opportunities/7', at: '2026-09-30T08:00:00Z', ack: true, noticeRecipientId: 3653, deadline: T7_STANDSTILL }),
  // ---------------------------------------------------------------- Operator
  notification({ id: 661, to: 'ops.admin', tenant: 'tenderiq-ops', event: 'service_incident', title: 'INC-2026-007 resolved: slow document uploads on 24 Sep', body: 'Post-incident review due 9 Oct 2026.', source: { type: 'service_incident', id: 1, reference: 'INC-2026-007' }, link: LINKS.opsIncident(1), at: '2026-09-24T08:25:00Z', readAt: '2026-09-24T08:40:00Z' }),
  notification({ id: 662, to: 'ops.admin', tenant: 'tenderiq-ops', event: 'task_assigned', title: 'ODC offboarding plan drafted', body: 'Coordinate live-event obligations with Okavango District Council.', source: { type: 'offboarding_plan', id: 1, reference: 'ODC offboarding plan' }, link: LINKS.opsOffboardingPlan(1), at: '2026-10-01T08:00:05Z' }),
  notification({ id: 663, to: 'support.agent', tenant: 'tenderiq-ops', event: 'authority_change', title: 'Support access to KWU authorized until 31 Dec 2026', body: 'Case SC-2026-0001: metadata only; no content access.', source: { type: 'support_case', id: 1, reference: 'SC-2026-0001' }, link: LINKS.opsSupportCase(1), at: '2026-09-28T07:05:05Z', readAt: '2026-09-28T07:30:00Z' }),
  notification({ id: 664, to: 'support.agent', tenant: 'tenderiq-ops', event: 'task_assigned', title: 'Support case SC-2026-0001 assigned to you', body: 'Evaluator cannot see the assigned criteria on T-2026-0003 (Kalahari Water Utilities).', source: { type: 'support_case', id: 1, reference: 'SC-2026-0001' }, link: LINKS.opsSupportCase(1), at: '2026-09-27T08:15:00Z' }),
] satisfies FixtureNotification[]);

/** The notification with `id` in `tenantId` (ids are unique per tenant only). */
export function findFixtureNotification(tenantId: number, id: number): FixtureNotification | undefined {
  return NOTIFICATIONS.find((row) => row.tenantId === tenantId && row.id === id);
}

// ---------------------------------------------------------------------------------------------------------
// Preferences (user_notification_preferences): only the rows a persona changed; others take the defaults
// ---------------------------------------------------------------------------------------------------------

export interface FixturePreference {
  readonly userId: number;
  readonly eventType: NotificationRulesEventType;
  readonly inApp: boolean;
  readonly email: boolean;
  readonly digest: UserNotificationPreferencesDigest;
}

export const PREFERENCES: readonly FixturePreference[] = Object.freeze([
  { userId: uid('mpho.manager'), eventType: 'task_assigned', inApp: true, email: false, digest: 'daily' },
  { userId: uid('mpho.manager'), eventType: 'product_announcement', inApp: false, email: false, digest: 'none' },
  { userId: uid('tebogo.officer'), eventType: 'question_answered', inApp: true, email: false, digest: 'none' },
  { userId: uid('tebogo.officer'), eventType: 'closing_approaching', inApp: true, email: true, digest: 'none' },
  { userId: uid('pule.auditor'), eventType: 'product_announcement', inApp: true, email: false, digest: 'weekly' },
  { userId: uid('tsodilo.bidmanager'), eventType: 'closing_approaching', inApp: true, email: true, digest: 'none' },
  { userId: uid('tsodilo.bidmanager'), eventType: 'task_assigned', inApp: true, email: false, digest: 'daily' },
  { userId: uid('chobe-pipe.admin'), eventType: 'evidence_expiring', inApp: true, email: true, digest: 'none' },
  { userId: uid('sam.dual'), eventType: 'task_assigned', inApp: true, email: false, digest: 'weekly' },
] satisfies FixturePreference[]);

/** Default preference of an optional event: in-app and email, no digest (promotional: in-app only). */
export function defaultPreference(eventType: NotificationRulesEventType): { inApp: boolean; email: boolean; digest: UserNotificationPreferencesDigest } {
  return eventType === 'product_announcement'
    ? { inApp: true, email: false, digest: 'none' }
    : { inApp: true, email: true, digest: 'none' };
}
