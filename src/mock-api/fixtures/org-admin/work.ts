/**
 * Org-admin fixtures: outstanding work and attributed history (ADM-03 deactivation review, AC-04; BR-38), supplier
 * tender assignments (SUP-04, `pursuit_team_members`; AC-03) and personal contact changes (COM-03).
 *
 * - `former.officer` left KWU with open work still to reassign; their published notice, reviewed request and
 *   approvals stay attributed to them.
 * - Tsodilo's departed bid coordinator (Kelebogile Tau) keeps her submitted receipt on T-2026-0001, and her
 *   pricing assignment on T-2026-0006 still has to be reassigned.
 * - `tsodilo.contributor` is assigned sections without pricing or submission authority (AC-03).
 */
import type { PursuitTeamMembersResponsibility } from '../../../contracts/enums.js';
import type { AttributedRecordKind, WorkItemKind } from '../../../contracts/org-admin/shared.js';
import type { ContactChangeField, ContactChangeStatus } from '../../../contracts/org-admin/account.js';
import { TENANT_IDS } from '../platform.js';
import { uid } from './refs.js';

export interface FixtureWorkItem {
  readonly workItemId: number;
  readonly tenantId: number;
  readonly userId: number;
  readonly kind: WorkItemKind;
  readonly title: string;
  readonly reference: string | null;
  readonly dueAt: string | null;
  readonly requiresReassignment: boolean;
}

export const WORK_ITEMS: readonly FixtureWorkItem[] = Object.freeze([
  { workItemId: 1, tenantId: TENANT_IDS.kwu, userId: uid('former.officer'), kind: 'task', title: 'Answer supplier clarification on valve pressure ratings', reference: 'T-2026-0008', dueAt: '2026-09-20T15:00:00Z', requiresReassignment: true },
  { workItemId: 2, tenantId: TENANT_IDS.kwu, userId: uid('former.officer'), kind: 'record_owner', title: 'Owner of the deferred request for replacement chlorinators', reference: 'PR-2026-0009', dueAt: null, requiresReassignment: true },
  { workItemId: 3, tenantId: TENANT_IDS.kwu, userId: uid('former.officer'), kind: 'task', title: 'Reminder: refresh the supplier contact list', reference: null, dueAt: '2026-07-15T15:00:00Z', requiresReassignment: false },
  { workItemId: 4, tenantId: TENANT_IDS.kwu, userId: uid('tebogo.officer'), kind: 'tender_team', title: 'Tender owner', reference: 'T-2026-0002', dueAt: null, requiresReassignment: true },
  { workItemId: 5, tenantId: TENANT_IDS.kwu, userId: uid('tebogo.officer'), kind: 'tender_team', title: 'Tender owner (taken over)', reference: 'T-2026-0008', dueAt: null, requiresReassignment: true },
  { workItemId: 6, tenantId: TENANT_IDS.kwu, userId: uid('tebogo.officer'), kind: 'task', title: 'Prepare the evaluation report', reference: 'T-2026-0003', dueAt: '2026-10-16T15:00:00Z', requiresReassignment: true },
  { workItemId: 7, tenantId: TENANT_IDS.kwu, userId: uid('mpho.manager'), kind: 'approval_step', title: 'Approve release (returned after a scope and value change)', reference: 'T-2026-0005', dueAt: '2026-10-05T15:00:00Z', requiresReassignment: true },
  { workItemId: 8, tenantId: TENANT_IDS.kwu, userId: uid('sam.dual'), kind: 'evaluation_assignment', title: 'Evaluate technical criteria (on hold: conflict review)', reference: 'T-2026-0003', dueAt: '2026-10-09T15:00:00Z', requiresReassignment: true },
  { workItemId: 9, tenantId: TENANT_IDS.kwu, userId: 102, kind: 'task', title: 'Update supplier register entries for the Northern depots', reference: null, dueAt: '2026-09-25T15:00:00Z', requiresReassignment: true },
  { workItemId: 10, tenantId: TENANT_IDS.kwu, userId: uid('boitumelo.chair'), kind: 'committee_seat', title: 'Chair, SCADA Bid Evaluation Committee', reference: 'T-2026-0003', dueAt: null, requiresReassignment: true },
  { workItemId: 11, tenantId: TENANT_IDS.kwu, userId: uid('keabetswe.approver'), kind: 'approval_step', title: 'Approve award recommendation, Lot 3', reference: 'T-2026-0001', dueAt: '2026-10-21T15:00:00Z', requiresReassignment: true },
  { workItemId: 12, tenantId: TENANT_IDS.kwu, userId: uid('masego.contracts'), kind: 'task', title: 'Decide on the renewal option before the notice window closes', reference: 'C-2026-0001', dueAt: '2026-10-05T15:00:00Z', requiresReassignment: true },
  { workItemId: 13, tenantId: TENANT_IDS.odc, userId: uid('officer.odc'), kind: 'tender_team', title: 'Tender owner', reference: 'T-2026-0011', dueAt: null, requiresReassignment: true },
  { workItemId: 21, tenantId: TENANT_IDS.tsodilo, userId: 121, kind: 'pursuit_assignment', title: 'Pricing schedule', reference: 'T-2026-0006', dueAt: '2026-10-15T15:00:00Z', requiresReassignment: true },
  { workItemId: 22, tenantId: TENANT_IDS.tsodilo, userId: uid('tsodilo.contributor'), kind: 'pursuit_assignment', title: 'Technical specification and method statement', reference: 'T-2026-0006', dueAt: '2026-10-15T15:00:00Z', requiresReassignment: true },
  { workItemId: 23, tenantId: TENANT_IDS.tsodilo, userId: uid('sam.dual'), kind: 'pursuit_assignment', title: 'Dosing control panel section', reference: 'T-2026-0006', dueAt: '2026-10-15T15:00:00Z', requiresReassignment: true },
  { workItemId: 24, tenantId: TENANT_IDS.tsodilo, userId: uid('tsodilo.bidmanager'), kind: 'pursuit_assignment', title: 'Bid manager', reference: 'T-2026-0006', dueAt: '2026-10-20T15:00:00Z', requiresReassignment: true },
  { workItemId: 25, tenantId: TENANT_IDS['chobe-pipe'], userId: uid('chobe-pipe.contributor'), kind: 'pursuit_assignment', title: 'Meter specifications', reference: 'T-2026-0002', dueAt: '2026-10-12T15:00:00Z', requiresReassignment: true },
  { workItemId: 26, tenantId: TENANT_IDS['gaborone-meter'], userId: 124, kind: 'pursuit_assignment', title: 'Pricing schedule', reference: 'T-2026-0002', dueAt: '2026-10-10T15:00:00Z', requiresReassignment: true },
  { workItemId: 27, tenantId: TENANT_IDS['serowe-ict'], userId: uid('serowe-ict.contributor'), kind: 'pursuit_assignment', title: 'Telemetry design', reference: 'T-2026-0003', dueAt: null, requiresReassignment: false },
] satisfies FixtureWorkItem[]);

export interface FixtureAttributedRecord {
  readonly tenantId: number;
  readonly userId: number;
  readonly kind: AttributedRecordKind;
  readonly reference: string;
  readonly description: string;
  readonly occurredAt: string;
  readonly capacity: string | null;
}

export const ATTRIBUTED_HISTORY: readonly FixtureAttributedRecord[] = Object.freeze([
  { tenantId: TENANT_IDS.kwu, userId: uid('former.officer'), kind: 'request', reference: 'PR-2026-0004', description: 'Reviewed and forwarded the request for approval', occurredAt: '2026-03-12T09:40:00Z', capacity: 'Procurement Officer' },
  { tenantId: TENANT_IDS.kwu, userId: uid('former.officer'), kind: 'approval_decision', reference: 'PR-2026-0002', description: 'Approved under delegation from the procurement manager (BWP 180,000.00)', occurredAt: '2026-05-19T11:05:00Z', capacity: 'Procurement Officer, acting for Mpho Dikgang' },
  { tenantId: TENANT_IDS.kwu, userId: uid('former.officer'), kind: 'publication', reference: 'T-2026-0008', description: 'Published the tender notice', occurredAt: '2026-06-02T07:00:00Z', capacity: 'Procurement Officer' },
  { tenantId: TENANT_IDS.kwu, userId: uid('former.officer'), kind: 'evaluation_score', reference: 'T-2026-0007', description: 'Submitted technical scores (metadata only)', occurredAt: '2026-06-24T13:30:00Z', capacity: 'Evaluator, Technical' },
  { tenantId: TENANT_IDS.kwu, userId: uid('tebogo.officer'), kind: 'publication', reference: 'T-2026-0002', description: 'Published the tender notice', occurredAt: '2026-09-01T07:00:00Z', capacity: 'Procurement Officer' },
  { tenantId: TENANT_IDS.kwu, userId: uid('keabetswe.approver'), kind: 'contract_signature', reference: 'C-2026-0001', description: 'Signed the contract for the buyer', occurredAt: '2026-06-01T09:00:00Z', capacity: 'Chief Executive (Award Approver)' },
  { tenantId: TENANT_IDS.kwu, userId: uid('oratile.opener'), kind: 'opening_record', reference: 'T-2026-0003', description: 'Opened the technical envelopes', occurredAt: '2026-08-28T10:30:00Z', capacity: 'Bid Opening Officer' },
  { tenantId: TENANT_IDS.tsodilo, userId: 121, kind: 'bid_submission', reference: 'T-2026-0001', description: 'Submitted the response for Lot 1 (receipt RCPT-2026-000003)', occurredAt: '2026-07-14T08:52:00Z', capacity: 'Bid Coordinator' },
  { tenantId: TENANT_IDS.tsodilo, userId: uid('tsodilo.signatory'), kind: 'bid_submission', reference: 'T-2026-0003', description: 'Submitted the SCADA response (receipt RCPT-2026-000011)', occurredAt: '2026-08-27T14:10:00Z', capacity: 'Managing Director' },
  { tenantId: TENANT_IDS['gaborone-meter'], userId: 124, kind: 'bid_submission', reference: 'T-2026-0002', description: 'Prepared the priced schedule of the submitted response', occurredAt: '2026-09-18T12:00:00Z', capacity: 'Commercial Contributor' },
] satisfies FixtureAttributedRecord[]);

export interface FixtureTenderAssignment {
  readonly assignmentId: number;
  readonly tenantId: number;
  readonly userId: number;
  readonly tenderId: number;
  readonly responsibility: PursuitTeamMembersResponsibility;
  readonly sectionScope: readonly string[];
  readonly lotLabels: readonly string[];
  readonly dueAt: string | null;
  readonly canViewPricing: boolean;
  readonly assignedAt: string;
  readonly endedAt: string | null;
}

const assignment = (
  assignmentId: number,
  tenantId: number,
  login: string | number,
  tenderId: number,
  responsibility: PursuitTeamMembersResponsibility,
  extra: Partial<FixtureTenderAssignment> = {},
): FixtureTenderAssignment => ({
  assignmentId,
  tenantId,
  userId: typeof login === 'number' ? login : uid(login),
  tenderId,
  responsibility,
  sectionScope: [],
  lotLabels: [],
  dueAt: null,
  canViewPricing: false,
  assignedAt: '2026-09-01T07:00:00Z',
  endedAt: null,
  ...extra,
});

const TSODILO = TENANT_IDS.tsodilo;
const CHOBE = TENANT_IDS['chobe-pipe'];
const SEROWE = TENANT_IDS['serowe-ict'];
const GABMETER = TENANT_IDS['gaborone-meter'];

export const TENDER_ASSIGNMENTS: readonly FixtureTenderAssignment[] = Object.freeze([
  assignment(1, TSODILO, 'tsodilo.bidmanager', 6, 'bid_manager', { canViewPricing: true, dueAt: '2026-10-20T15:00:00Z', assignedAt: '2026-09-14T07:00:00Z' }),
  assignment(2, TSODILO, 'tsodilo.contributor', 6, 'contributor', { sectionScope: ['Technical specification', 'Method statement'], dueAt: '2026-10-15T15:00:00Z', assignedAt: '2026-09-14T07:00:00Z' }),
  assignment(3, TSODILO, 'sam.dual', 6, 'contributor', { sectionScope: ['Dosing control panel'], dueAt: '2026-10-15T15:00:00Z', assignedAt: '2026-09-14T07:00:00Z' }),
  assignment(4, TSODILO, 'tsodilo.signatory', 6, 'signatory', { canViewPricing: true, dueAt: '2026-10-21T15:00:00Z', assignedAt: '2026-09-14T07:00:00Z' }),
  assignment(5, TSODILO, 121, 6, 'commercial_contributor', { sectionScope: ['Pricing schedule'], canViewPricing: true, dueAt: '2026-10-15T15:00:00Z', assignedAt: '2026-09-14T07:00:00Z' }),
  assignment(6, TSODILO, 'tsodilo.bidmanager', 3, 'bid_manager', { canViewPricing: true, assignedAt: '2026-07-20T07:00:00Z' }),
  assignment(7, TSODILO, 'tsodilo.contributor', 3, 'contributor', { sectionScope: ['SCADA architecture'], assignedAt: '2026-07-20T07:00:00Z' }),
  assignment(8, TSODILO, 'tsodilo.bidmanager', 1, 'bid_manager', { canViewPricing: true, lotLabels: ['Lot 1', 'Lot 3'], assignedAt: '2026-05-11T07:00:00Z', endedAt: '2026-08-30T15:00:00Z' }),
  assignment(9, CHOBE, 'chobe-pipe.bidmanager', 2, 'bid_manager', { canViewPricing: true, dueAt: '2026-10-13T15:00:00Z' }),
  assignment(10, CHOBE, 'chobe-pipe.contributor', 2, 'contributor', { sectionScope: ['Meter specifications'], dueAt: '2026-10-12T15:00:00Z' }),
  assignment(11, CHOBE, 'sam.dual', 8, 'contributor', { sectionScope: ['Valve datasheets'], assignedAt: '2026-08-10T07:00:00Z' }),
  assignment(12, CHOBE, 'chobe-pipe.signatory', 8, 'signatory', { canViewPricing: true, assignedAt: '2026-08-10T07:00:00Z' }),
  assignment(13, CHOBE, 'chobe-pipe.bidmanager', 6, 'bid_manager', { canViewPricing: true, dueAt: '2026-10-20T15:00:00Z', assignedAt: '2026-09-15T07:00:00Z' }),
  assignment(14, SEROWE, 'serowe-ict.bidmanager', 3, 'bid_manager', { canViewPricing: true, assignedAt: '2026-07-22T07:00:00Z' }),
  assignment(15, SEROWE, 'serowe-ict.contributor', 3, 'contributor', { sectionScope: ['Telemetry design'], assignedAt: '2026-07-22T07:00:00Z' }),
  assignment(16, SEROWE, 'serowe-ict.bidmanager', 2, 'bid_manager', { canViewPricing: true, dueAt: '2026-10-13T15:00:00Z' }),
  assignment(17, SEROWE, 'serowe-ict.signatory', 2, 'approver', { canViewPricing: true, dueAt: '2026-10-13T15:00:00Z' }),
  assignment(18, GABMETER, 'gaborone-meter.bidmanager', 2, 'bid_manager', { canViewPricing: true }),
  assignment(19, GABMETER, 'gaborone-meter.contributor', 2, 'contributor', { sectionScope: ['Meter data platform'] }),
  assignment(20, GABMETER, 124, 2, 'commercial_contributor', { sectionScope: ['Pricing schedule'], canViewPricing: true, dueAt: '2026-10-10T15:00:00Z' }),
  assignment(21, TENANT_IDS.makgadikgadi, 'makgadikgadi.admin', 3, 'bid_manager', { canViewPricing: true, assignedAt: '2026-07-25T07:00:00Z' }),
  assignment(22, TENANT_IDS['limpopo-env'], 'limpopo-env.admin', 7, 'bid_manager', { canViewPricing: true, assignedAt: '2026-05-18T07:00:00Z' }),
  assignment(23, TENANT_IDS['limpopo-env'], 'limpopo-env.admin', 4, 'bid_manager', { assignedAt: '2026-04-20T07:00:00Z', endedAt: '2026-06-12T15:00:00Z' }),
] satisfies FixtureTenderAssignment[]);

/** Pursuits of each supplier that can receive assignments (tender ids). */
export const ASSIGNABLE_TENDER_IDS: Readonly<Record<number, readonly number[]>> = Object.freeze({
  [TSODILO]: [6, 3],
  [CHOBE]: [2, 6, 8],
  [SEROWE]: [3, 2],
  [GABMETER]: [2],
  [TENANT_IDS.makgadikgadi]: [3],
  [TENANT_IDS['limpopo-env']]: [7, 4],
});

export interface FixtureContactChange {
  readonly changeId: number;
  readonly userId: number;
  readonly field: ContactChangeField;
  readonly newValueMasked: string;
  readonly status: ContactChangeStatus;
  readonly requestedAt: string;
  readonly expiresAt: string;
  readonly confirmationSentTo: string;
}

export const CONTACT_CHANGES: readonly FixtureContactChange[] = Object.freeze([
  {
    changeId: 1, userId: uid('tebogo.officer'), field: 'phone', newValueMasked: '+267 7• ••• 902', status: 'pending_confirmation',
    requestedAt: '2026-09-29T07:12:00Z', expiresAt: '2026-10-13T07:12:00Z', confirmationSentTo: '+267 7• ••• 902',
  },
  {
    changeId: 2, userId: uid('sam.dual'), field: 'email', newValueMasked: 's***@keitumetse.co.bw', status: 'pending_confirmation',
    requestedAt: '2026-09-28T18:40:00Z', expiresAt: '2026-10-12T18:40:00Z', confirmationSentTo: 's***@keitumetse.co.bw',
  },
  {
    changeId: 3, userId: uid('sam.dual'), field: 'phone', newValueMasked: '+267 7• ••• 118', status: 'confirmed',
    requestedAt: '2026-06-02T08:00:00Z', expiresAt: '2026-06-16T08:00:00Z', confirmationSentTo: '+267 7• ••• 118',
  },
] satisfies FixtureContactChange[]);
