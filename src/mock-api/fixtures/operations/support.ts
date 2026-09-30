/**
 * Operations fixtures: support cases, case messages, support access grants and the support activity history
 * (OPS-04, COM-09).
 *
 * Storyline anchors: case 1 (KWU) carries the authorized, time-limited, metadata-only grant that the platform
 * fixture `SUPPORT_GRANTS` gives `support.agent` (grant 1). Grant 1 is repeated here with the same parties, scope
 * and start; its window is capped at the 14 days requested (`MAX_SUPPORT_GRANT_DAYS`, until 2026-10-12T07:00:00Z),
 * so the seeded grant obeys the rule the authorize endpoint enforces (a fixture test checks every window). The other cases show every status and category the screens
 * filter on: a supplier's receipt question, a procurement-merits request routed to the buyer (support never decides
 * deadlines), an accessibility accommodation, ODC's exit export question with a grant awaiting ODC's
 * authorization, and closed history with an expired and a revoked grant.
 */
import type { SupportAccessGrantsScope, SupportAccessGrantsStatus, SupportCasesCategory, SupportCasesStatus } from '../../../contracts/enums.js';
import { MAX_SUPPORT_GRANT_DAYS } from '../../../contracts/operations/support.js';
import { SUPPORT_GRANTS, TENANT_IDS } from '../platform.js';
import { OPS_USERS } from './users.js';

export interface FixtureSupportCase {
  readonly id: number;
  readonly reference: string;
  readonly customerTenantId: number;
  readonly openedByUserId: number;
  readonly category: SupportCasesCategory;
  readonly subject: string;
  readonly description: string;
  readonly status: SupportCasesStatus;
  readonly assignedOperatorUserId: number | null;
  readonly routedToTenantId: number | null;
  readonly resolution: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly closedAt: string | null;
}

export const SUPPORT_CASES: readonly FixtureSupportCase[] = Object.freeze([
  {
    id: 1,
    reference: 'SC-2026-0001',
    customerTenantId: TENANT_IDS.kwu,
    openedByUserId: OPS_USERS.adminKwu,
    category: 'access',
    subject: 'Evaluator cannot see the assigned criteria on T-2026-0003',
    description:
      'Kabo Ntsima reports that the technical criteria assigned to him on T-2026-0003 do not appear in his evaluation workspace. Other evaluators see theirs. Please check the assignment metadata.',
    status: 'in_progress',
    assignedOperatorUserId: OPS_USERS.supportAgent,
    routedToTenantId: null,
    resolution: null,
    createdAt: '2026-09-27T08:10:00Z',
    updatedAt: '2026-09-29T11:45:00Z',
    closedAt: null,
  },
  {
    id: 2,
    reference: 'SC-2026-0002',
    customerTenantId: TENANT_IDS.tsodilo,
    openedByUserId: OPS_USERS.tsodiloBidManager,
    category: 'submission_evidence',
    subject: 'Confirm the receipt time of our T-2026-0002 submission',
    description:
      'Our submission receipt shows 14:02 but our internal log says we pressed submit at 13:58. Which time is official?',
    status: 'resolved',
    assignedOperatorUserId: OPS_USERS.supportAgent,
    routedToTenantId: null,
    resolution:
      'The receipt time is the official time the platform accepted the complete submission (14:02 (UTC+02:00) Africa/Gaborone). The platform log shows the upload finished at 14:01:57. No buyer decision was needed.',
    createdAt: '2026-09-15T12:20:00Z',
    updatedAt: '2026-09-16T09:05:00Z',
    closedAt: null,
  },
  {
    id: 3,
    reference: 'SC-2026-0003',
    customerTenantId: TENANT_IDS['chobe-pipe'],
    openedByUserId: OPS_USERS.chobeBidManager,
    category: 'procurement_merits',
    subject: 'Request more time after our late attempt on T-2026-0002',
    description:
      'Our upload started before the addendum supplement deadline but was recorded late. We ask for an extension so our response can be accepted.',
    status: 'routed_to_buyer',
    assignedOperatorUserId: OPS_USERS.supportAgent,
    routedToTenantId: TENANT_IDS.kwu,
    resolution:
      'Support cannot extend a deadline or accept a late submission. The request was routed to the KWU procurement owner, who applies the published submission rule.',
    createdAt: '2026-09-23T10:40:00Z',
    updatedAt: '2026-09-23T15:10:00Z',
    closedAt: null,
  },
  {
    id: 4,
    reference: 'SC-2026-0004',
    customerTenantId: TENANT_IDS['limpopo-env'],
    openedByUserId: OPS_USERS.limpopoAdmin,
    category: 'accessibility',
    subject: 'Screen-reader accessible copy of the T-2026-0007 debriefing letter',
    description:
      'Accommodation request (screen reader document): our managing director uses a screen reader and the debriefing letter PDF is a scanned image. Please provide an accessible version before the debriefing meeting.',
    status: 'awaiting_customer',
    assignedOperatorUserId: OPS_USERS.supportAgent,
    routedToTenantId: null,
    resolution: null,
    createdAt: '2026-09-25T07:30:00Z',
    updatedAt: '2026-09-26T08:15:00Z',
    closedAt: null,
  },
  {
    id: 5,
    reference: 'SC-2026-0005',
    customerTenantId: TENANT_IDS.odc,
    openedByUserId: OPS_USERS.adminOdc,
    category: 'usage',
    subject: 'Contents of the exit export package',
    description:
      'Before we agree the offboarding plan we need to confirm the exit export includes the contract obligations and the opening records. Please check the export manifest.',
    status: 'open',
    assignedOperatorUserId: OPS_USERS.supportAgent,
    routedToTenantId: null,
    resolution: null,
    createdAt: '2026-09-28T09:00:00Z',
    updatedAt: '2026-09-28T09:25:00Z',
    closedAt: null,
  },
  {
    id: 6,
    reference: 'SC-2026-0006',
    customerTenantId: TENANT_IDS.kwu,
    openedByUserId: OPS_USERS.tebogoOfficer,
    category: 'usage',
    subject: 'Scheduled release did not show the notice on the portal',
    description: 'T-2026-0009 was scheduled for 07:00 but the public portal showed it only at 07:20.',
    status: 'closed',
    assignedOperatorUserId: OPS_USERS.supportAgent,
    routedToTenantId: null,
    resolution:
      'The portal cache refreshed 20 minutes late; the official publication time recorded on the tender is 07:00 and is unaffected. Cache refresh now runs every minute.',
    createdAt: '2026-07-20T07:35:00Z',
    updatedAt: '2026-07-23T10:00:00Z',
    closedAt: '2026-07-23T10:00:00Z',
  },
  {
    id: 7,
    reference: 'SC-2026-0007',
    customerTenantId: TENANT_IDS['serowe-ict'],
    openedByUserId: OPS_USERS.seroweAdmin,
    category: 'qualification',
    subject: 'How to renew ISO 27001 certificate evidence',
    description: 'Our certificate was renewed. How do we replace the evidence without losing the earlier version?',
    status: 'closed',
    assignedOperatorUserId: OPS_USERS.supportAgent,
    routedToTenantId: null,
    resolution:
      'Add the new certificate as a new version of the evidence item; earlier versions remain as submitted with past applications.',
    createdAt: '2026-08-11T13:00:00Z',
    updatedAt: '2026-08-12T08:30:00Z',
    closedAt: '2026-08-12T08:30:00Z',
  },
  {
    id: 8,
    reference: 'SC-2026-0008',
    customerTenantId: TENANT_IDS['gaborone-meter'],
    openedByUserId: OPS_USERS.gaboroneMeterBidManager,
    category: 'contract_performance',
    subject: 'Where to upload the final meter reading files for C-2025-0007',
    description:
      'The legacy meter reading contract has expired but the warranty obligation remains. Where do we upload the data files?',
    status: 'open',
    assignedOperatorUserId: null,
    routedToTenantId: null,
    resolution: null,
    createdAt: '2026-09-29T14:15:00Z',
    updatedAt: '2026-09-29T14:15:00Z',
    closedAt: null,
  },
] satisfies FixtureSupportCase[]);

export interface FixtureCaseMessage {
  readonly id: number;
  readonly caseId: number;
  readonly authorUserId: number;
  readonly body: string;
  readonly internal: boolean;
  readonly createdAt: string;
}

export const SUPPORT_CASE_MESSAGES: readonly FixtureCaseMessage[] = Object.freeze([
  { id: 1001, caseId: 1, authorUserId: OPS_USERS.adminKwu, body: 'Kabo sees the tender but the Technical section shows no criteria.', internal: false, createdAt: '2026-09-27T08:10:00Z' },
  { id: 1002, caseId: 1, authorUserId: OPS_USERS.supportAgent, body: 'To check the assignment we need metadata-only access to your organization. I have requested it; please authorize it in Administration > Support access.', internal: false, createdAt: '2026-09-27T09:02:00Z' },
  { id: 1003, caseId: 1, authorUserId: OPS_USERS.adminKwu, body: 'Authorized for 14 days, until 12 Oct, for metadata only. The earlier request naming the evaluation records was revoked: support must not see scores.', internal: false, createdAt: '2026-09-28T07:05:00Z' },
  { id: 1004, caseId: 1, authorUserId: OPS_USERS.supportAgent, body: 'Assignment metadata shows Kabo assigned to criteria group TECH-2 on version 1 of the plan; the plan was amended to version 2. Escalated to engineering.', internal: true, createdAt: '2026-09-29T11:45:00Z' },
  { id: 1011, caseId: 2, authorUserId: OPS_USERS.tsodiloBidManager, body: 'Receipt RCPT-2026-000031 attached for reference.', internal: false, createdAt: '2026-09-15T12:20:00Z' },
  { id: 1012, caseId: 2, authorUserId: OPS_USERS.supportAgent, body: 'The receipt time is when the last file finished uploading and the submission was accepted. That time is official.', internal: false, createdAt: '2026-09-16T09:05:00Z' },
  { id: 1021, caseId: 3, authorUserId: OPS_USERS.chobeBidManager, body: 'Please accept our response; we started before the deadline.', internal: false, createdAt: '2026-09-23T10:40:00Z' },
  { id: 1022, caseId: 3, authorUserId: OPS_USERS.supportAgent, body: 'Support cannot extend deadlines or accept submissions. I have routed your request to Kalahari Water Utilities, which decides under the published rule.', internal: false, createdAt: '2026-09-23T15:10:00Z' },
  { id: 1023, caseId: 3, authorUserId: OPS_USERS.supportAgent, body: 'Platform log confirms the upload began at 11:59:40 and completed at 12:03:12 (UTC+02:00). Shared with KWU on request only.', internal: true, createdAt: '2026-09-23T15:12:00Z' },
  { id: 1031, caseId: 4, authorUserId: OPS_USERS.limpopoAdmin, body: 'The debriefing is on 6 Oct. A tagged PDF or Word version is fine.', internal: false, createdAt: '2026-09-25T07:30:00Z' },
  { id: 1032, caseId: 4, authorUserId: OPS_USERS.supportAgent, body: 'KWU has agreed to issue a tagged PDF. Please confirm the e-mail address the accessible copy should be sent to.', internal: false, createdAt: '2026-09-26T08:15:00Z' },
  { id: 1041, caseId: 5, authorUserId: OPS_USERS.adminOdc, body: 'We need the obligations of C-2025-0004 and the opening record of T-2026-0011 once it closes.', internal: false, createdAt: '2026-09-28T09:00:00Z' },
  { id: 1042, caseId: 5, authorUserId: OPS_USERS.supportAgent, body: 'Requested read-only access to the export and contract metadata so I can compare the manifest. Awaiting your authorization.', internal: false, createdAt: '2026-09-28T09:25:00Z' },
  { id: 1051, caseId: 6, authorUserId: OPS_USERS.supportAgent, body: 'Cache refresh fixed; the tender record kept 07:00 as its publication time.', internal: false, createdAt: '2026-07-23T10:00:00Z' },
  { id: 1061, caseId: 7, authorUserId: OPS_USERS.supportAgent, body: 'Use "Add new version" on the evidence item.', internal: false, createdAt: '2026-08-12T08:30:00Z' },
  { id: 1071, caseId: 8, authorUserId: OPS_USERS.gaboroneMeterBidManager, body: 'Files are ready (18,400 readings).', internal: false, createdAt: '2026-09-29T14:15:00Z' },
] satisfies FixtureCaseMessage[]);

export interface FixtureSupportAccessGrant {
  readonly id: number;
  readonly caseId: number;
  readonly customerTenantId: number;
  readonly operatorUserId: number;
  readonly authorizedByUserId: number | null;
  readonly businessNeed: string;
  readonly scope: SupportAccessGrantsScope;
  readonly recordRefs: readonly string[];
  readonly requestedAt: string;
  readonly requestedDays: number;
  readonly startsAt: string | null;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly status: SupportAccessGrantsStatus;
  readonly statusReason: string | null;
}

const PLATFORM_GRANT = SUPPORT_GRANTS[0];
if (PLATFORM_GRANT === undefined) {
  throw new Error('The platform fixture must define support grant 1.');
}

const DAY_MS = 86_400_000;
/** Days requested for grant 1 (metadata only, case SC-2026-0001). */
const PLATFORM_GRANT_REQUESTED_DAYS = 14;

/** The end of a window: the requested days after the start, never more than `MAX_SUPPORT_GRANT_DAYS` (PRD §4.2). */
function cappedExpiry(startsAt: string, requestedDays: number, expiresAt: string): string {
  const cap = new Date(new Date(startsAt).getTime() + Math.min(requestedDays, MAX_SUPPORT_GRANT_DAYS) * DAY_MS);
  return new Date(expiresAt) < cap ? expiresAt : cap.toISOString().replace('.000Z', 'Z');
}

export const SUPPORT_ACCESS_GRANTS: readonly FixtureSupportAccessGrant[] = Object.freeze([
  {
    id: PLATFORM_GRANT.grantId,
    caseId: PLATFORM_GRANT.caseId,
    customerTenantId: PLATFORM_GRANT.customerTenantId,
    operatorUserId: PLATFORM_GRANT.operatorUserId,
    authorizedByUserId: PLATFORM_GRANT.authorizedByUserId,
    businessNeed: 'Check the evaluator assignment metadata on T-2026-0003 (case SC-2026-0001). No scores or bid content.',
    scope: PLATFORM_GRANT.scope,
    recordRefs: [],
    requestedAt: '2026-09-27T09:00:00Z',
    requestedDays: PLATFORM_GRANT_REQUESTED_DAYS,
    startsAt: PLATFORM_GRANT.startsAt,
    expiresAt: cappedExpiry(PLATFORM_GRANT.startsAt, PLATFORM_GRANT_REQUESTED_DAYS, PLATFORM_GRANT.expiresAt),
    revokedAt: PLATFORM_GRANT.revokedAt,
    status: 'active',
    statusReason: null,
  },
  {
    id: 2,
    caseId: 5,
    customerTenantId: TENANT_IDS.odc,
    operatorUserId: OPS_USERS.supportAgent,
    authorizedByUserId: null,
    businessNeed: 'Compare the exit export manifest with the contract and tender metadata (case SC-2026-0005).',
    scope: 'specific_records',
    recordRefs: ['contract:C-2025-0004', 'tender:T-2026-0011'],
    requestedAt: '2026-09-28T09:20:00Z',
    requestedDays: 5,
    startsAt: null,
    expiresAt: null,
    revokedAt: null,
    status: 'requested',
    statusReason: null,
  },
  {
    id: 3,
    caseId: 6,
    customerTenantId: TENANT_IDS.kwu,
    operatorUserId: OPS_USERS.supportAgent,
    authorizedByUserId: OPS_USERS.adminKwu,
    businessNeed: 'Compare the scheduled and actual publication times of T-2026-0009 (case SC-2026-0006).',
    scope: 'specific_records',
    recordRefs: ['tender:T-2026-0009'],
    requestedAt: '2026-07-20T08:00:00Z',
    requestedDays: 3,
    startsAt: '2026-07-20T09:00:00Z',
    expiresAt: '2026-07-23T09:00:00Z',
    revokedAt: null,
    status: 'expired',
    statusReason: null,
  },
  {
    id: 4,
    caseId: 1,
    customerTenantId: TENANT_IDS.kwu,
    operatorUserId: OPS_USERS.supportAgent,
    authorizedByUserId: OPS_USERS.adminKwu,
    businessNeed: 'Inspect the evaluator workspace of T-2026-0003 (case SC-2026-0001).',
    scope: 'specific_records',
    recordRefs: ['tender:T-2026-0003', 'user:12'],
    requestedAt: '2026-09-27T08:30:00Z',
    requestedDays: 7,
    startsAt: '2026-09-27T08:45:00Z',
    expiresAt: '2026-10-04T08:45:00Z',
    revokedAt: '2026-09-28T07:00:00Z',
    status: 'revoked',
    statusReason: 'Scope too broad: the evaluator workspace shows score entry. Replaced by a metadata-only grant.',
  },
  {
    id: 5,
    caseId: 4,
    customerTenantId: TENANT_IDS.kwu,
    operatorUserId: OPS_USERS.supportAgent,
    authorizedByUserId: OPS_USERS.adminKwu,
    businessNeed: 'Open the T-2026-0007 debriefing letter to prepare an accessible copy for the supplier (case SC-2026-0004).',
    scope: 'specific_records',
    recordRefs: ['document:14801'],
    requestedAt: '2026-09-25T08:00:00Z',
    requestedDays: 2,
    startsAt: null,
    expiresAt: null,
    revokedAt: null,
    status: 'denied',
    statusReason: 'KWU prepares the accessible copy itself; the letter is a formal notice.',
  },
] satisfies FixtureSupportAccessGrant[]);

export interface FixtureSupportActivity {
  readonly id: number;
  readonly caseId: number;
  readonly grantId: number | null;
  readonly customerTenantId: number;
  readonly at: string;
  readonly actorUserId: number | null;
  readonly action: string;
  readonly description: string;
}

export const SUPPORT_ACTIVITY: readonly FixtureSupportActivity[] = Object.freeze([
  { id: 5001, caseId: 1, grantId: null, customerTenantId: TENANT_IDS.kwu, at: '2026-09-27T08:10:00Z', actorUserId: OPS_USERS.adminKwu, action: 'case.opened', description: 'Case opened by the KWU administrator.' },
  { id: 5002, caseId: 1, grantId: 4, customerTenantId: TENANT_IDS.kwu, at: '2026-09-27T08:30:00Z', actorUserId: OPS_USERS.supportAgent, action: 'grant.requested', description: 'Access requested: specific records T-2026-0003 and user 12, 7 days.' },
  { id: 5003, caseId: 1, grantId: 4, customerTenantId: TENANT_IDS.kwu, at: '2026-09-27T08:45:00Z', actorUserId: OPS_USERS.adminKwu, action: 'grant.authorized', description: 'Access authorized until 4 Oct 2026.' },
  { id: 5004, caseId: 1, grantId: 4, customerTenantId: TENANT_IDS.kwu, at: '2026-09-28T07:00:00Z', actorUserId: OPS_USERS.adminKwu, action: 'grant.revoked', description: 'Access revoked by the customer: scope too broad.' },
  { id: 5005, caseId: 1, grantId: 1, customerTenantId: TENANT_IDS.kwu, at: '2026-09-27T09:00:00Z', actorUserId: OPS_USERS.supportAgent, action: 'grant.requested', description: 'Access requested: metadata only, 14 days.' },
  { id: 5006, caseId: 1, grantId: 1, customerTenantId: TENANT_IDS.kwu, at: '2026-09-28T07:00:00Z', actorUserId: OPS_USERS.adminKwu, action: 'grant.authorized', description: 'Access authorized: metadata only, 14 days, until 12 Oct 2026.' },
  { id: 5007, caseId: 1, grantId: 1, customerTenantId: TENANT_IDS.kwu, at: '2026-09-29T11:30:00Z', actorUserId: OPS_USERS.supportAgent, action: 'support.viewed', description: 'Viewed evaluation assignment metadata of T-2026-0003 (no scores, no bid content).' },
  { id: 5011, caseId: 2, grantId: null, customerTenantId: TENANT_IDS.tsodilo, at: '2026-09-15T12:20:00Z', actorUserId: OPS_USERS.tsodiloBidManager, action: 'case.opened', description: 'Case opened by Tsodilo Engineering.' },
  { id: 5012, caseId: 2, grantId: null, customerTenantId: TENANT_IDS.tsodilo, at: '2026-09-16T09:05:00Z', actorUserId: OPS_USERS.supportAgent, action: 'case.resolved', description: 'Resolved from the platform log; no customer access needed.' },
  { id: 5021, caseId: 3, grantId: null, customerTenantId: TENANT_IDS['chobe-pipe'], at: '2026-09-23T10:40:00Z', actorUserId: OPS_USERS.chobeBidManager, action: 'case.opened', description: 'Case opened by Chobe Pipe & Valve Supplies.' },
  { id: 5022, caseId: 3, grantId: null, customerTenantId: TENANT_IDS['chobe-pipe'], at: '2026-09-23T15:10:00Z', actorUserId: OPS_USERS.supportAgent, action: 'case.routed_to_buyer', description: 'Procurement-merits request routed to Kalahari Water Utilities.' },
  { id: 5031, caseId: 4, grantId: null, customerTenantId: TENANT_IDS['limpopo-env'], at: '2026-09-25T07:30:00Z', actorUserId: OPS_USERS.limpopoAdmin, action: 'case.opened', description: 'Accommodation request opened by Limpopo Environmental Services.' },
  { id: 5032, caseId: 4, grantId: 5, customerTenantId: TENANT_IDS.kwu, at: '2026-09-25T08:00:00Z', actorUserId: OPS_USERS.supportAgent, action: 'grant.requested', description: 'Access requested: document 14801, 2 days.' },
  { id: 5033, caseId: 4, grantId: 5, customerTenantId: TENANT_IDS.kwu, at: '2026-09-25T11:20:00Z', actorUserId: OPS_USERS.adminKwu, action: 'grant.denied', description: 'Access denied: KWU prepares the accessible copy itself.' },
  { id: 5041, caseId: 5, grantId: null, customerTenantId: TENANT_IDS.odc, at: '2026-09-28T09:00:00Z', actorUserId: OPS_USERS.adminOdc, action: 'case.opened', description: 'Case opened by the ODC administrator.' },
  { id: 5042, caseId: 5, grantId: 2, customerTenantId: TENANT_IDS.odc, at: '2026-09-28T09:20:00Z', actorUserId: OPS_USERS.supportAgent, action: 'grant.requested', description: 'Access requested: contract C-2025-0004 and tender T-2026-0011 metadata, 5 days.' },
  { id: 5051, caseId: 6, grantId: 3, customerTenantId: TENANT_IDS.kwu, at: '2026-07-20T09:00:00Z', actorUserId: OPS_USERS.adminKwu, action: 'grant.authorized', description: 'Access authorized until 23 Jul 2026.' },
  { id: 5052, caseId: 6, grantId: 3, customerTenantId: TENANT_IDS.kwu, at: '2026-07-20T09:40:00Z', actorUserId: OPS_USERS.supportAgent, action: 'support.viewed', description: 'Viewed the publication schedule of T-2026-0009.' },
  { id: 5053, caseId: 6, grantId: 3, customerTenantId: TENANT_IDS.kwu, at: '2026-07-23T09:00:00Z', actorUserId: null, action: 'grant.expired', description: 'Access expired automatically.' },
  { id: 5054, caseId: 6, grantId: null, customerTenantId: TENANT_IDS.kwu, at: '2026-07-23T10:00:00Z', actorUserId: OPS_USERS.supportAgent, action: 'case.closed', description: 'Case closed with resolution.' },
  { id: 5061, caseId: 7, grantId: null, customerTenantId: TENANT_IDS['serowe-ict'], at: '2026-08-12T08:30:00Z', actorUserId: OPS_USERS.supportAgent, action: 'case.closed', description: 'Answered from the help centre; no access needed.' },
  { id: 5071, caseId: 8, grantId: null, customerTenantId: TENANT_IDS['gaborone-meter'], at: '2026-09-29T14:15:00Z', actorUserId: OPS_USERS.gaboroneMeterBidManager, action: 'case.opened', description: 'Case opened by Gaborone Metering Co.' },
] satisfies FixtureSupportActivity[]);

/** The standing limits of every support grant (PRD §4.2, OPS-04). */
export const SUPPORT_GRANT_LIMITS: readonly string[] = Object.freeze([
  'Read-only: support cannot submit, score, approve, sign or change settings.',
  'No sealed bid content, supplier drafts or evaluator scores.',
  'Every view is recorded in the customer’s audit trail.',
  'Access ends automatically at the expiry, or earlier when the customer revokes it.',
]);
