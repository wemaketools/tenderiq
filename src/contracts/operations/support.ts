/**
 * Support cases and temporary support access (OPS-04), the customer-side authorization of support access (buyer
 * organization administrators, `org.support_access.authorize`, DD-23) and the personal service cases and
 * accessibility accommodation requests of COM-09. Blueprint: `support_cases`, `support_case_messages`,
 * `support_access_grants` (all [G], `customer_tenant_id` per DD-04).
 *
 * Rules the contract carries (Stage B enforces them):
 * - Support access is never impersonation: an operator enters a customer tenant only under an active,
 *   customer-authorized, time-limited grant, read-only (`support.view`), never sealed content, drafts or scores,
 *   and never submits, scores, approves or signs (PRD §4.2, OPS-04, ADR 0013).
 * - A grant lasts at most `MAX_SUPPORT_GRANT_DAYS`; `specific_records` grants name their records; records that are
 *   sealed or scored (bids, evaluation) cannot be named (`SEALED_CONTENT_NOT_GRANTABLE`).
 * - Support is never a bid-submission channel (COM-09): a case that tries to deliver a bid is refused
 *   (`SUPPORT_NOT_SUBMISSION_CHANNEL`), and procurement-merits questions (deadlines, awards) are routed to the
 *   responsible buyer, never decided by support (PRD §21.2, `BUSINESS_DISPUTE_MUST_ROUTE`).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CalendarDate,
  Id,
  IdParam,
  Instant,
  OrganizationLabel,
  PersonRef,
  QueryBoolean,
  ReasonText,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import {
  SUPPORT_ACCESS_GRANTS_SCOPE,
  SUPPORT_CASES_CATEGORY,
  SupportAccessGrantsScope,
  SupportAccessGrantsStatus,
  SupportCasesCategory,
  SupportCasesStatus,
} from '../enums.js';
import { ActivityEntry, CustomerLabel, NoteText, bodyText, choice, confirmation, optionalText, titleText } from './shared.js';

/** Grant scope in a request body, with a coded error. */
const GrantScopeInput = choice(SUPPORT_ACCESS_GRANTS_SCOPE, 'INVALID_SCOPE', 'Choose metadata only or specific records.');

// ---------------------------------------------------------------------------------------------------------
// Constants and rules
// ---------------------------------------------------------------------------------------------------------

/** Longest support access window a customer may authorize. */
export const MAX_SUPPORT_GRANT_DAYS = 14;

/**
 * A record reference a `specific_records` grant may name: `<type>:<reference>`, for example `tender:T-2026-0002`
 * (metadata of that record), `contract:C-2025-0004`, `user:12`, `notice:88`.
 */
export const SUPPORT_RECORD_TYPES = ['tender', 'contract', 'user', 'notice', 'document', 'integration', 'import', 'bid', 'evaluation'] as const;
/** Record types a grant can never name: sealed or scored content (PRD §4.3). */
export const SEALED_SUPPORT_RECORD_TYPES = ['bid', 'evaluation'] as const;

export const SupportRecordRef = z
  .string()
  .trim()
  .regex(
    /^(tender|contract|user|notice|document|integration|import|bid|evaluation):[A-Za-z0-9-]{1,40}$/,
    issue('INVALID_RECORD_REF', 'Name a record as type:reference, for example tender:T-2026-0002.'),
  );

/** Whether a record reference names sealed or scored content. */
export function isSealedRecordRef(ref: string): boolean {
  const type = ref.split(':')[0] ?? '';
  return (SEALED_SUPPORT_RECORD_TYPES as readonly string[]).includes(type);
}

/**
 * Text that tries to deliver a bid through support (COM-09). Stage B applies the same test; the UI warns before
 * sending.
 */
export const BID_SUBMISSION_IN_TEXT =
  /\b(please\s+(submit|forward|upload)\s+(our|my|the)\s+(bid|tender|offer|response|submission)|attached\s+(is\s+)?(our|my)\s+(bid|offer|submission|tender\s+response))\b/i;

/** Categories that concern a buyer's procurement decision: support routes them to the buyer (PRD §21.2). */
export const BUYER_ROUTED_CATEGORIES = ['procurement_merits'] as const;

// ---------------------------------------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------------------------------------

/** One support access grant (`support_access_grants`). */
export const SupportGrant = z.object({
  id: Id,
  caseId: Id,
  /** The case reference shown wherever the grant is listed (for example SC-2026-0001). */
  caseReference: z.string().regex(/^SC-\d{4}-\d{4}$/),
  customer: CustomerLabel,
  operator: PersonRef,
  authorizedBy: PersonRef.nullable(),
  businessNeed: z.string().min(1),
  scope: SupportAccessGrantsScope,
  recordRefs: z.array(z.string().min(1)),
  requestedAt: Instant,
  startsAt: Instant.nullable(),
  expiresAt: Instant.nullable(),
  revokedAt: Instant.nullable(),
  status: SupportAccessGrantsStatus,
  /** Why a grant was denied or revoked. */
  statusReason: z.string().nullable(),
  /** Standing limits of every grant (read-only; no sealed content; no submit, score, approve or sign). */
  limits: z.array(z.string().min(1)),
});
export type SupportGrant = z.infer<typeof SupportGrant>;

/** One message of a case (`support_case_messages`). */
export const SupportCaseMessage = z.object({
  id: Id,
  author: PersonRef,
  /** The author's side: the customer's organization or the operator. */
  authorSide: z.enum(['customer', 'operator']),
  body: z.string().min(1),
  /** Internal operator notes are never shown to the customer. */
  internal: z.boolean(),
  createdAt: Instant,
});
export type SupportCaseMessage = z.infer<typeof SupportCaseMessage>;

/** One row of the operator case queue. */
export const SupportCaseRow = z.object({
  id: Id,
  reference: z.string().regex(/^SC-\d{4}-\d{4}$/),
  customer: CustomerLabel,
  openedBy: PersonRef,
  category: SupportCasesCategory,
  subject: z.string().min(1),
  status: SupportCasesStatus,
  assignedOperator: PersonRef.nullable(),
  /** The buyer a procurement-merits case was routed to. */
  routedTo: CustomerLabel.nullable(),
  activeGrant: z.boolean(),
  createdAt: Instant,
  updatedAt: Instant,
  closedAt: Instant.nullable(),
});
export type SupportCaseRow = z.infer<typeof SupportCaseRow>;

export const SUPPORT_CASE_SORT_FIELDS = ['reference', 'customer', 'category', 'status', 'createdAt', 'updatedAt'] as const;
export const SupportCaseListQuery = listQueryWithSort(SUPPORT_CASE_SORT_FIELDS).extend({
  status: queryList(SupportCasesStatus).optional(),
  category: queryList(SupportCasesCategory).optional(),
  customerTenantId: IdParam.optional(),
  assignedOperatorUserId: IdParam.optional(),
  unassigned: QueryBoolean.optional(),
  createdFrom: CalendarDate.optional(),
  createdTo: CalendarDate.optional(),
});
export type SupportCaseListQuery = z.input<typeof SupportCaseListQuery>;

/** The operator case detail with messages, grants and the support activity history. */
export const SupportCaseDetail = SupportCaseRow.extend({
  description: z.string().min(1),
  resolution: z.string().nullable(),
  messages: z.array(SupportCaseMessage),
  grants: z.array(SupportGrant),
  activity: z.array(ActivityEntry),
  /** What the operator may do next. */
  capabilities: z.object({
    canRequestAccess: z.boolean(),
    canRouteToBuyer: z.boolean(),
    canResolve: z.boolean(),
  }),
});
export type SupportCaseDetail = z.infer<typeof SupportCaseDetail>;

export const SupportCaseParams = z.object({ caseId: IdParam });
export const SupportGrantParams = z.object({ grantId: IdParam });

const CaseSubject = titleText('SUBJECT_REQUIRED', 200);
const CaseDescription = bodyText('DESCRIPTION_REQUIRED', 8000);

/** An operator logs a case reported by a customer contact. */
export const CreateSupportCaseBody = z.object({
  customerTenantId: Id,
  openedByUserId: Id,
  category: choice(SUPPORT_CASES_CATEGORY, 'INVALID_CATEGORY', 'Choose what the case is about.'),
  subject: CaseSubject,
  description: CaseDescription,
});
export type CreateSupportCaseBody = z.infer<typeof CreateSupportCaseBody>;

export const AssignSupportCaseBody = z.object({
  operatorUserId: Id,
});
export type AssignSupportCaseBody = z.infer<typeof AssignSupportCaseBody>;

/** Operator status changes (routing to a buyer has its own command). */
export const SUPPORT_CASE_STATUS_TARGETS = ['in_progress', 'awaiting_customer', 'resolved', 'closed'] as const;
export const SupportCaseStatusTarget = z.enum(SUPPORT_CASE_STATUS_TARGETS, {
  error: issue('INVALID_STATUS', 'Choose in progress, awaiting customer, resolved or closed.'),
});

export const TransitionSupportCaseBody = z.object({
  status: SupportCaseStatusTarget,
  resolution: NoteText.optional(),
});
export type TransitionSupportCaseBody = z.infer<typeof TransitionSupportCaseBody>;

export const AddCaseMessageBody = z.object({
  body: bodyText('MESSAGE_REQUIRED', 8000),
  internal: z.boolean({ error: issue('INVALID_FLAG', 'Choose whether the message is internal.') }).default(false),
});
export type AddCaseMessageBody = z.input<typeof AddCaseMessageBody>;

export const RouteToBuyerBody = z.object({
  buyerTenantId: Id,
  note: ReasonText,
});
export type RouteToBuyerBody = z.infer<typeof RouteToBuyerBody>;

/** The operator requests time-limited access; the customer authorizes it. */
export const RequestSupportGrantBody = z.object({
  businessNeed: bodyText('BUSINESS_NEED_REQUIRED', 2000),
  scope: GrantScopeInput,
  recordRefs: z
    .array(SupportRecordRef, { error: issue('INVALID_RECORD_REF', 'Name the records as a list of type:reference entries.') }).max(20, issue('TOO_MANY_RECORDS', 'Name at most 20 records.')).default([]),
  requestedDays: z
    .number({ error: issue('INVALID_DURATION', 'Enter the number of days.') })
    .int(issue('INVALID_DURATION', 'Enter whole days.'))
    .min(1, issue('INVALID_DURATION', 'At least one day.')),
});
export type RequestSupportGrantBody = z.input<typeof RequestSupportGrantBody>;

export const SupportGrantListQuery = listQueryWithSort(['requestedAt', 'expiresAt', 'status'] as const).extend({
  status: queryList(SupportAccessGrantsStatus).optional(),
  customerTenantId: IdParam.optional(),
  operatorUserId: IdParam.optional(),
  caseId: IdParam.optional(),
});
export type SupportGrantListQuery = z.input<typeof SupportGrantListQuery>;

export const EndSupportGrantBody = z.object({ reason: ReasonText });
export type EndSupportGrantBody = z.infer<typeof EndSupportGrantBody>;

// ---------------------------------------------------------------------------------------------------------
// Customer-side authorization (buyer organization administrators)
// ---------------------------------------------------------------------------------------------------------

/** A grant as the customer sees it, with the case subject and what support did under it. */
export const CustomerSupportGrant = SupportGrant.extend({
  caseSubject: z.string().min(1),
  requestedDays: z.number().int().min(1),
  activity: z.array(ActivityEntry),
});
export type CustomerSupportGrant = z.infer<typeof CustomerSupportGrant>;

export const CustomerGrantListQuery = listQueryWithSort(['requestedAt', 'expiresAt', 'status'] as const).extend({
  status: queryList(SupportAccessGrantsStatus).optional(),
});
export type CustomerGrantListQuery = z.input<typeof CustomerGrantListQuery>;

export const AuthorizeSupportGrantBody = z.object({
  /** Expiry of the window (at most `MAX_SUPPORT_GRANT_DAYS` after authorization). */
  expiresAt: Instant,
  /** The customer may narrow a requested scope to metadata only. */
  scope: GrantScopeInput.optional(),
  acknowledgement: confirmation(
    'ACKNOWLEDGEMENT_REQUIRED',
    'Confirm that support may read the named records, read-only, until the expiry.',
  ),
});
export type AuthorizeSupportGrantBody = z.infer<typeof AuthorizeSupportGrantBody>;

export const DecideSupportGrantBody = z.object({ reason: ReasonText });
export type DecideSupportGrantBody = z.infer<typeof DecideSupportGrantBody>;

// ---------------------------------------------------------------------------------------------------------
// Personal service cases and accommodation requests (COM-09)
// ---------------------------------------------------------------------------------------------------------

/** A case the caller opened, labelled with its organization (DD-21). Internal notes are never included. */
export const MySupportCase = z.object({
  id: Id,
  reference: z.string().regex(/^SC-\d{4}-\d{4}$/),
  organization: OrganizationLabel,
  category: SupportCasesCategory,
  subject: z.string().min(1),
  status: SupportCasesStatus,
  createdAt: Instant,
  updatedAt: Instant,
  closedAt: Instant.nullable(),
});
export type MySupportCase = z.infer<typeof MySupportCase>;

export const MySupportCaseDetail = MySupportCase.extend({
  description: z.string().min(1),
  resolution: z.string().nullable(),
  routedTo: CustomerLabel.nullable(),
  messages: z.array(SupportCaseMessage),
  /** Grants on the case (the customer sees every access request made on its behalf). */
  grants: z.array(SupportGrant),
});
export type MySupportCaseDetail = z.infer<typeof MySupportCaseDetail>;

export const MySupportCaseListQuery = listQueryWithSort(['createdAt', 'updatedAt', 'status'] as const).extend({
  status: queryList(SupportCasesStatus).optional(),
  category: queryList(SupportCasesCategory).optional(),
  tenantId: IdParam.optional(),
});
export type MySupportCaseListQuery = z.input<typeof MySupportCaseListQuery>;

/** Categories a person may open from the help centre (accessibility has its own form). */
export const MY_CASE_CATEGORIES = ['usage', 'access', 'submission_evidence', 'qualification', 'procurement_merits', 'contract_performance'] as const;
export const MyCaseCategory = z.enum(MY_CASE_CATEGORIES, {
  error: issue('INVALID_CATEGORY', 'Choose what the case is about.'),
});

/** Open a case for the organization named in X-Tenant-Id (row tenant). */
export const OpenMySupportCaseBody = z.object({
  category: MyCaseCategory,
  subject: CaseSubject,
  description: CaseDescription,
  /** Explicit acknowledgement that support cannot receive bids or make procurement decisions. */
  acknowledgesNotSubmissionChannel: confirmation(
    'NOT_SUBMISSION_CHANNEL_ACK_REQUIRED',
    'Confirm that you understand support cannot receive bids or decide deadlines or awards.',
  ),
});
export type OpenMySupportCaseBody = z.infer<typeof OpenMySupportCaseBody>;

export const ReplyMySupportCaseBody = z.object({
  body: bodyText('MESSAGE_REQUIRED', 8000),
});
export type ReplyMySupportCaseBody = z.infer<typeof ReplyMySupportCaseBody>;

/** Accommodation formats offered (PRD §19). */
export const ACCOMMODATION_FORMATS = ['screen_reader_document', 'large_print', 'sign_language_interpreter', 'extended_session_time', 'assisted_site_access', 'other'] as const;
export const AccommodationFormat = z.enum(ACCOMMODATION_FORMATS, {
  error: issue('INVALID_FORMAT', 'Choose the kind of assistance you need.'),
});
export type AccommodationFormat = z.infer<typeof AccommodationFormat>;

/** An accessibility accommodation request: opened as an `accessibility` support case for the row tenant. */
export const RequestAccommodationBody = z.object({
  format: AccommodationFormat,
  need: bodyText('NEED_REQUIRED', 4000),
  /** The event or document the need concerns, for example `T-2026-0007`. */
  relatedReference: optionalText(40).optional(),
  neededBy: CalendarDate.optional(),
  contactPreference: z.enum(['email', 'phone', 'in_app'], {
    error: issue('INVALID_CONTACT_PREFERENCE', 'Choose how we should contact you.'),
  }),
});
export type RequestAccommodationBody = z.infer<typeof RequestAccommodationBody>;

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

const SUPPORT_READ = ['ops.support.manage', 'ops.oversight.view'] as const;

export const listSupportCases = defineEndpoint({
  id: 'ops.operations.supportCases.list',
  method: 'GET',
  path: '/api/v1/ops/support-cases',
  audience: 'ops',
  permission: SUPPORT_READ,
  query: SupportCaseListQuery,
  response: pageOf(SupportCaseRow),
  errors: [],
  screens: ['OPS-04'],
});

export const getSupportCase = defineEndpoint({
  id: 'ops.operations.supportCases.get',
  method: 'GET',
  path: '/api/v1/ops/support-cases/:caseId',
  audience: 'ops',
  permission: SUPPORT_READ,
  params: SupportCaseParams,
  response: SupportCaseDetail,
  errors: [],
  screens: ['OPS-04'],
});

export const createSupportCase = defineEndpoint({
  id: 'ops.operations.supportCases.create',
  method: 'POST',
  path: '/api/v1/ops/support-cases',
  audience: 'ops',
  permission: 'ops.support.manage',
  body: CreateSupportCaseBody,
  response: SupportCaseDetail,
  idempotent: true,
  errors: ['CUSTOMER_CONTACT_NOT_MEMBER', 'SUPPORT_NOT_SUBMISSION_CHANNEL'],
  screens: ['OPS-04'],
});

export const assignSupportCase = defineEndpoint({
  id: 'ops.operations.supportCases.assign',
  method: 'POST',
  path: '/api/v1/ops/support-cases/:caseId/assign',
  audience: 'ops',
  permission: 'ops.support.manage',
  params: SupportCaseParams,
  body: AssignSupportCaseBody,
  response: SupportCaseDetail,
  errors: ['CASE_CLOSED', 'ASSIGNEE_NOT_OPERATOR'],
  screens: ['OPS-04'],
});

export const transitionSupportCase = defineEndpoint({
  id: 'ops.operations.supportCases.transition',
  method: 'POST',
  path: '/api/v1/ops/support-cases/:caseId/status',
  audience: 'ops',
  permission: 'ops.support.manage',
  params: SupportCaseParams,
  body: TransitionSupportCaseBody,
  response: SupportCaseDetail,
  errors: ['CASE_CLOSED', 'RESOLUTION_REQUIRED', 'BUSINESS_DISPUTE_MUST_ROUTE', 'CASE_TRANSITION_INVALID'],
  screens: ['OPS-04'],
});

export const addSupportCaseMessage = defineEndpoint({
  id: 'ops.operations.supportCases.addMessage',
  method: 'POST',
  path: '/api/v1/ops/support-cases/:caseId/messages',
  audience: 'ops',
  permission: 'ops.support.manage',
  params: SupportCaseParams,
  body: AddCaseMessageBody,
  response: SupportCaseMessage,
  idempotent: true,
  errors: ['CASE_CLOSED'],
  screens: ['OPS-04'],
});

export const routeSupportCaseToBuyer = defineEndpoint({
  id: 'ops.operations.supportCases.routeToBuyer',
  method: 'POST',
  path: '/api/v1/ops/support-cases/:caseId/route-to-buyer',
  audience: 'ops',
  permission: 'ops.support.manage',
  params: SupportCaseParams,
  body: RouteToBuyerBody,
  response: SupportCaseDetail,
  errors: ['CASE_CLOSED', 'ROUTE_TARGET_NOT_BUYER'],
  screens: ['OPS-04'],
});

export const requestSupportGrant = defineEndpoint({
  id: 'ops.operations.supportGrants.request',
  method: 'POST',
  path: '/api/v1/ops/support-cases/:caseId/access-grants',
  audience: 'ops',
  permission: 'ops.support.manage',
  params: SupportCaseParams,
  body: RequestSupportGrantBody,
  response: SupportGrant,
  idempotent: true,
  errors: [
    'CASE_CLOSED',
    'GRANT_ALREADY_ACTIVE',
    'GRANT_DURATION_TOO_LONG',
    'RECORD_REFS_REQUIRED',
    'SEALED_CONTENT_NOT_GRANTABLE',
  ],
  screens: ['OPS-04'],
});

export const listSupportGrants = defineEndpoint({
  id: 'ops.operations.supportGrants.list',
  method: 'GET',
  path: '/api/v1/ops/support-access-grants',
  audience: 'ops',
  permission: SUPPORT_READ,
  query: SupportGrantListQuery,
  response: pageOf(SupportGrant),
  errors: [],
  screens: ['OPS-04', 'OPS-06'],
});

export const endSupportGrant = defineEndpoint({
  id: 'ops.operations.supportGrants.end',
  method: 'POST',
  path: '/api/v1/ops/support-access-grants/:grantId/end',
  audience: 'ops',
  permission: 'ops.support.manage',
  params: SupportGrantParams,
  body: EndSupportGrantBody,
  response: SupportGrant,
  errors: ['GRANT_NOT_ACTIVE'],
  screens: ['OPS-04'],
});

export const listCustomerSupportGrants = defineEndpoint({
  id: 'buyer.operations.supportAccess.list',
  method: 'GET',
  path: '/api/v1/buyer/support-access-grants',
  audience: 'buyer',
  permission: 'org.support_access.authorize',
  query: CustomerGrantListQuery,
  response: pageOf(CustomerSupportGrant),
  errors: [],
  screens: ['OPS-04', 'ADM-17'],
  summary: 'Support access requests and grants into this organization, with what support did under each.',
});

export const getCustomerSupportGrant = defineEndpoint({
  id: 'buyer.operations.supportAccess.get',
  method: 'GET',
  path: '/api/v1/buyer/support-access-grants/:grantId',
  audience: 'buyer',
  permission: 'org.support_access.authorize',
  params: SupportGrantParams,
  response: CustomerSupportGrant,
  errors: [],
  screens: ['OPS-04', 'ADM-17'],
});

export const authorizeSupportGrant = defineEndpoint({
  id: 'buyer.operations.supportAccess.authorize',
  method: 'POST',
  path: '/api/v1/buyer/support-access-grants/:grantId/authorize',
  audience: 'buyer',
  permission: 'org.support_access.authorize',
  params: SupportGrantParams,
  body: AuthorizeSupportGrantBody,
  response: CustomerSupportGrant,
  errors: ['GRANT_NOT_REQUESTED', 'GRANT_EXPIRY_IN_PAST', 'GRANT_DURATION_TOO_LONG', 'GRANT_SCOPE_WIDENED'],
  screens: ['OPS-04', 'ADM-17'],
});

export const denySupportGrant = defineEndpoint({
  id: 'buyer.operations.supportAccess.deny',
  method: 'POST',
  path: '/api/v1/buyer/support-access-grants/:grantId/deny',
  audience: 'buyer',
  permission: 'org.support_access.authorize',
  params: SupportGrantParams,
  body: DecideSupportGrantBody,
  response: CustomerSupportGrant,
  errors: ['GRANT_NOT_REQUESTED'],
  screens: ['OPS-04', 'ADM-17'],
});

export const revokeSupportGrant = defineEndpoint({
  id: 'buyer.operations.supportAccess.revoke',
  method: 'POST',
  path: '/api/v1/buyer/support-access-grants/:grantId/revoke',
  audience: 'buyer',
  permission: 'org.support_access.authorize',
  params: SupportGrantParams,
  body: DecideSupportGrantBody,
  response: CustomerSupportGrant,
  errors: ['GRANT_NOT_ACTIVE'],
  screens: ['OPS-04', 'ADM-17'],
});

export const listMySupportCases = defineEndpoint({
  id: 'me.operations.supportCases.list',
  method: 'GET',
  path: '/api/v1/me/support-cases',
  audience: 'me',
  query: MySupportCaseListQuery,
  response: pageOf(MySupportCase),
  errors: [],
  screens: ['COM-09'],
});

export const getMySupportCase = defineEndpoint({
  id: 'me.operations.supportCases.get',
  method: 'GET',
  path: '/api/v1/me/support-cases/:caseId',
  audience: 'me',
  params: SupportCaseParams,
  response: MySupportCaseDetail,
  errors: [],
  screens: ['COM-09'],
});

export const openMySupportCase = defineEndpoint({
  id: 'me.operations.supportCases.open',
  method: 'POST',
  path: '/api/v1/me/support-cases',
  audience: 'me',
  rowTenant: true,
  body: OpenMySupportCaseBody,
  response: MySupportCaseDetail,
  idempotent: true,
  errors: ['SUPPORT_NOT_SUBMISSION_CHANNEL'],
  screens: ['COM-09'],
});

export const replyMySupportCase = defineEndpoint({
  id: 'me.operations.supportCases.reply',
  method: 'POST',
  path: '/api/v1/me/support-cases/:caseId/messages',
  audience: 'me',
  rowTenant: true,
  params: SupportCaseParams,
  body: ReplyMySupportCaseBody,
  response: SupportCaseMessage,
  idempotent: true,
  errors: ['CASE_CLOSED', 'SUPPORT_NOT_SUBMISSION_CHANNEL'],
  screens: ['COM-09'],
});

export const requestAccommodation = defineEndpoint({
  id: 'me.operations.accommodations.request',
  method: 'POST',
  path: '/api/v1/me/accommodation-requests',
  audience: 'me',
  rowTenant: true,
  body: RequestAccommodationBody,
  response: MySupportCaseDetail,
  idempotent: true,
  errors: ['NEEDED_BY_IN_PAST'],
  screens: ['COM-09'],
});

export const supportRoutes = {
  listSupportCases,
  getSupportCase,
  createSupportCase,
  assignSupportCase,
  transitionSupportCase,
  addSupportCaseMessage,
  routeSupportCaseToBuyer,
  requestSupportGrant,
  listSupportGrants,
  endSupportGrant,
  listCustomerSupportGrants,
  getCustomerSupportGrant,
  authorizeSupportGrant,
  denySupportGrant,
  revokeSupportGrant,
  listMySupportCases,
  getMySupportCase,
  openMySupportCase,
  replyMySupportCase,
  requestAccommodation,
} as const;
