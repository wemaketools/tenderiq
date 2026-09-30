/**
 * Shared building blocks of every contract (architecture-plan §3.10; docs/technical/07-api.md §4, §5, §8).
 *
 * - Identifiers are JSON numbers (`bigint` identity columns, parsed as safe integers). Branded aliases and their
 *   validating constructors are available for code that must not mix id kinds (brief §5.6 `toTenantId`).
 * - Money, scores, rates and quantities are decimal STRINGS (DD-32); money always carries a currency code.
 * - Instants are ISO 8601 UTC strings with a `Z` suffix. Calendar dates are `YYYY-MM-DD`.
 * - Official deadlines travel with their IANA official time zone (BR-11, DD-33).
 * - Lists return `Page<T>` and accept the shared `ListQuery` (q, page, pageSize, sort, dir).
 * - Errors are RFC 7807 problem+json with `errors[{ field, code, message }]` and `correlationId`
 *   (brief §5.3). Zod messages follow the `"CODE|message"` convention.
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { DECIMAL_PATTERN } from './decimal.js';
import { TENANTS_KIND } from './enums.js';

// ---------------------------------------------------------------------------------------------------------
// Validation message convention
// ---------------------------------------------------------------------------------------------------------

/** Builds a zod message in the `"CODE|message"` convention (brief §5.3). */
export function issue(code: string, message: string): string {
  return `${code}|${message}`;
}

/** An UPPER_SNAKE code (exported below as `ERROR_CODE_PATTERN`). */
const ISSUE_CODE_PATTERN = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

/**
 * Splits a `"CODE|message"` zod message. Only an UPPER_SNAKE prefix (`ERROR_CODE_PATTERN`) is a code: zod's own
 * default messages also contain bars (for example `Invalid option: expected one of "a"|"b"`), and such a message,
 * like any message without a code, is returned whole under `INVALID`.
 */
export function splitIssueMessage(raw: string): { code: string; message: string } {
  const bar = raw.indexOf('|');
  const code = bar > 0 ? raw.slice(0, bar) : '';
  if (!ISSUE_CODE_PATTERN.test(code)) {
    return { code: 'INVALID', message: raw };
  }
  return { code, message: raw.slice(bar + 1) };
}

// ---------------------------------------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------------------------------------

/** A record id: a positive safe integer (`bigint generated always as identity`, parsed to a JS number). */
export const Id = z
  .number({ error: issue('INVALID_ID', 'Must be a numeric id.') })
  .int(issue('INVALID_ID', 'Must be an integer id.'))
  .positive(issue('INVALID_ID', 'Must be a positive id.'))
  .max(Number.MAX_SAFE_INTEGER, issue('INVALID_ID', 'Id is out of range.'));
export type Id = z.infer<typeof Id>;

/**
 * An id accepted from a path or query string: a JSON number, or its decimal digits as a string.
 * The output is always a number.
 */
export const IdParam = z
  .union([Id, z.string().regex(/^[1-9]\d{0,15}$/, issue('INVALID_ID', 'Must be a numeric id.'))])
  .transform((value) => Number(value))
  .pipe(Id);
export type IdParam = z.input<typeof IdParam>;

/** A nominal (branded) type: `Brand<number, 'TenantId'>` is not assignable from a plain number. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type TenantId = Brand<number, 'TenantId'>;
export type UserId = Brand<number, 'UserId'>;

/** Builds a validating constructor for a branded id (throws on anything but a positive safe integer). */
export function brandedId<B extends string>(brand: B): (value: number) => Brand<number, B> {
  return (value: number): Brand<number, B> => {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError(`Invalid ${brand}: ${String(value)}`);
    }
    return value as Brand<number, B>;
  };
}

/** The only constructor of a `TenantId` (brief §5.6). */
export const toTenantId = brandedId('TenantId');
/** The only constructor of a `UserId`. */
export const toUserId = brandedId('UserId');

/** Human reference such as `T-2026-0003`, `PR-2026-0001`, `RCPT-2026-000001` (blueprint §0, DD-09). */
export const Reference = z
  .string()
  .regex(/^[A-Z]{1,6}-[0-9A-Za-z]{1,12}(-[0-9A-Za-z]{1,12})?$/, issue('INVALID_REFERENCE', 'Not a reference.'));
export type Reference = z.infer<typeof Reference>;

/** URL-safe tenant slug (`tenants.slug`), for example `kwu` or `chobe-pipe`. */
export const Slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, issue('INVALID_SLUG', 'Use lowercase letters, digits and hyphens.'))
  .max(63, issue('INVALID_SLUG', 'At most 63 characters.'));
export type Slug = z.infer<typeof Slug>;

// ---------------------------------------------------------------------------------------------------------
// Decimals and money (DD-32)
// ---------------------------------------------------------------------------------------------------------

/** A decimal written as a string (`^-?\d+(\.\d+)?$`). Never a JS number. */
export const DecimalString = z
  .string({ error: issue('INVALID_DECIMAL', 'Must be a decimal string.') })
  .regex(DECIMAL_PATTERN, issue('INVALID_DECIMAL', 'Must be a decimal such as 1500000.00.'));
export type DecimalString = z.infer<typeof DecimalString>;

/** A non-negative decimal string (amounts that cannot be negative, such as a price or a limit). */
export const NonNegativeDecimalString = z
  .string({ error: issue('INVALID_DECIMAL', 'Must be a decimal string.') })
  .regex(/^\d+(\.\d+)?$/, issue('INVALID_DECIMAL', 'Must be a non-negative decimal such as 1500000.00.'));
export type NonNegativeDecimalString = z.infer<typeof NonNegativeDecimalString>;

/** An ISO 4217 currency code (`char(3)` CHECK `^[A-Z]{3}$`). */
export const CurrencyCode = z
  .string({ error: issue('INVALID_CURRENCY', 'Must be a currency code.') })
  .regex(/^[A-Z]{3}$/, issue('INVALID_CURRENCY', 'Use a three-letter currency code such as BWP.'));
export type CurrencyCode = z.infer<typeof CurrencyCode>;

/** Money: a decimal amount and its currency, always together (blueprint §0, DD-08). */
export const Money = z.object({
  amount: DecimalString,
  currency: CurrencyCode,
});
export type Money = z.infer<typeof Money>;

/** Money that cannot be negative. */
export const NonNegativeMoney = z.object({
  amount: NonNegativeDecimalString,
  currency: CurrencyCode,
});
export type NonNegativeMoney = z.infer<typeof NonNegativeMoney>;

/** A score, rate or weight (`numeric(12,6)`): a decimal string. A missing score is `null`, never `"0"` (AC-18). */
export const Score = DecimalString;
export type Score = z.infer<typeof Score>;

// ---------------------------------------------------------------------------------------------------------
// Time (BR-11, DD-33)
// ---------------------------------------------------------------------------------------------------------

/** An instant: ISO 8601 in UTC with a `Z` suffix, for example `2026-10-14T10:00:00Z` (`timestamptz`). */
export const Instant = z.iso.datetime({
  offset: false,
  local: false,
  error: issue('INVALID_INSTANT', 'Use an ISO 8601 UTC timestamp such as 2026-10-14T10:00:00Z.'),
});
export type Instant = z.infer<typeof Instant>;

/** A calendar date `YYYY-MM-DD` (`date` columns such as `holiday_date`, `target_date`). */
export const CalendarDate = z.iso.date(issue('INVALID_DATE', 'Use a date such as 2026-10-14.'));
export type CalendarDate = z.infer<typeof CalendarDate>;

function isIanaTimeZone(value: string): boolean {
  if (value !== 'UTC' && !/^[A-Za-z]+(?:[/_+-][A-Za-z0-9]+)*$/.test(value)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** An IANA time zone name, for example `Africa/Gaborone` (`tenants.official_time_zone`, `tenders.official_time_zone`). */
export const TimeZone = z
  .string({ error: issue('INVALID_TIME_ZONE', 'Must be a time zone name.') })
  .refine(isIanaTimeZone, issue('INVALID_TIME_ZONE', 'Use an IANA time zone such as Africa/Gaborone.'));
export type TimeZone = z.infer<typeof TimeZone>;

/**
 * An official deadline: the instant plus the IANA official time zone of its event. The SPA renders it through
 * the OfficialDeadline component as `14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone` and never as a countdown
 * alone (BR-11, DD-33).
 */
export const OfficialDeadline = z.object({
  at: Instant,
  timeZone: TimeZone,
});
export type OfficialDeadline = z.infer<typeof OfficialDeadline>;

// ---------------------------------------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------------------------------------

/** Largest page size a list accepts. */
export const MAX_PAGE_SIZE = 100;
/** Page size when the query does not name one. */
export const DEFAULT_PAGE_SIZE = 25;

/** A non-negative integer from a query string or a JSON number. */
function queryInteger(code: string, min: number, max: number) {
  return z
    .union([z.number(), z.string().regex(/^\d{1,9}$/, issue(code, 'Must be a whole number.'))])
    .transform((value) => Number(value))
    .pipe(
      z
        .number()
        .int(issue(code, 'Must be a whole number.'))
        .min(min, issue(code, `Must be at least ${min}.`))
        .max(max, issue(code, `Must be at most ${max}.`)),
    );
}

/** A boolean from a query string (`true`/`false`) or JSON. */
export const QueryBoolean = z
  .union([z.boolean(), z.enum(['true', 'false'], { error: issue('INVALID_BOOLEAN', 'Use true or false.') })])
  .transform((value) => value === true || value === 'true');
export type QueryBoolean = z.input<typeof QueryBoolean>;

/** A list filter that accepts one value or several (repeated query parameters arrive as an array). */
export function queryList<T extends z.ZodType>(item: T) {
  return z.union([item, z.array(item)]).transform((value): Array<z.output<T>> => (Array.isArray(value) ? value : [value]));
}

/** Sort direction. */
export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export const SortDirection = z.enum(SORT_DIRECTIONS);
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/**
 * The shared list query: free-text search, 1-based page, page size (1..100, default 25), sort field and
 * direction. Domain lists extend it with their filters (status, owner, dates) and restrict `sort` with
 * `listQueryWithSort`.
 */
export const ListQuery = z.object({
  q: z.string().trim().max(200, issue('QUERY_TOO_LONG', 'At most 200 characters.')).optional(),
  page: queryInteger('INVALID_PAGE', 1, 100_000).default(1),
  pageSize: queryInteger('INVALID_PAGE_SIZE', 1, MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  sort: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/, issue('INVALID_SORT', 'Not a sortable field.'))
    .optional(),
  dir: SortDirection.default('asc'),
});
export type ListQuery = z.output<typeof ListQuery>;
export type ListQueryInput = z.input<typeof ListQuery>;

/** The shared list query with `sort` restricted to the given fields. */
export function listQueryWithSort<const F extends readonly [string, ...string[]]>(fields: F) {
  return ListQuery.extend({
    sort: z.enum(fields, { error: issue('INVALID_SORT', `Sort by one of: ${fields.join(', ')}.`) }).optional(),
  });
}

/** Page metadata of every list response. `total` counts only rows the caller may see (BR-43). */
export const PageMeta = z.object({
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE),
});
export type PageMeta = z.infer<typeof PageMeta>;

/** `Page<T>`: `{ items, total, page, pageSize }`. */
export function pageOf<T extends z.ZodType>(item: T) {
  return PageMeta.extend({ items: z.array(item) });
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Slices an already filtered and sorted array into a page (used by the mock API and by tests). */
export function paginate<T>(rows: readonly T[], page: number, pageSize: number): Page<T> {
  const start = (page - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), total: rows.length, page, pageSize };
}

// ---------------------------------------------------------------------------------------------------------
// problem+json (brief §5.3, docs/technical/07-api.md §4.2)
// ---------------------------------------------------------------------------------------------------------

/** One field-level failure: `field` is the issue path, `code` and `message` come from `"CODE|message"`. */
export const FieldError = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string(),
});
export type FieldError = z.infer<typeof FieldError>;

/** An RFC 7807 problem document. */
export const Problem = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  code: z.string().optional(),
  errors: z.array(FieldError).optional(),
  correlationId: z.string().min(1),
});
export type Problem = z.infer<typeof Problem>;

/** The media type of every error response. */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** The constant, sanitized detail of every 5xx (brief §5.3). */
export const SANITIZED_SERVER_ERROR_DETAIL =
  'An unexpected error occurred. Quote the correlation id when you contact support.';

/**
 * Platform error codes shared by every endpoint, with their HTTP status. Domain codes are declared per
 * endpoint in `errors` (UPPER_SNAKE); each one has exactly one HTTP status in `DOMAIN_ERROR_STATUS` below.
 */
export const PLATFORM_ERRORS = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  TENANT_ACCESS_DENIED: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;
export type PlatformErrorCode = keyof typeof PLATFORM_ERRORS;

/** Error codes are UPPER_SNAKE. */
export const ERROR_CODE_PATTERN: RegExp = ISSUE_CODE_PATTERN;

/** The HTTP statuses a declared business error may carry (docs/technical/07-api.md §4.4). */
export const DOMAIN_ERROR_STATUSES = [403, 404, 409, 410, 422] as const;
export type DomainErrorStatus = (typeof DOMAIN_ERROR_STATUSES)[number];

/**
 * Every declared business error code, grouped by its ONE HTTP status (brief §5.3, docs/technical/07-api.md §4.4).
 * Both stages send a code with this status wherever it occurs; the OpenAPI document lists each code under it.
 *
 * - 403: the caller is authenticated and in the tenant but this action is denied to them (assignment, SoD,
 *   authority, restricted content).
 * - 404: the record named by the path does not exist in the caller's scope.
 * - 409: the record's current state forbids the action (illegal transition, already done, stale version, hold).
 * - 410: a time-limited artefact (an upload slot or a signed download link) is gone.
 * - 422: the request refers to something invalid or breaks an input rule the schema cannot express
 *   (unknown referenced id in the body, date in the past, limit exceeded).
 *
 * A new code is added here in the same change that declares it on an endpoint; `validateErrorRegistry` and the
 * catalog test fail otherwise.
 */
const DOMAIN_ERRORS_BY_STATUS = {
  403: [
    'ACKNOWLEDGMENT_NOT_AUTHORIZED',
    'ANSWER_NOT_ASSIGNED',
    'AUTHORITY_EXCEEDED',
    'AUTHORITY_INSUFFICIENT',
    'CANNOT_REVIEW_OWN_DECLARATION',
    'CONFIDENTIALITY_NOT_ACCEPTED',
    'CORRECTION_SELF_APPROVAL',
    'CUMULATIVE_AUTHORITY_EXCEEDED',
    'DECISION_PERMISSION_MISSING',
    'DOCUMENT_ACCESS_NOT_GRANTED',
    'DOCUMENT_REQUIRES_INVITATION',
    'DOCUMENT_REQUIRES_REGISTRATION',
    'DOWNLOAD_NOT_PERMITTED',
    'FINANCIAL_EVIDENCE_RESTRICTED',
    'FINDING_OUTSIDE_ASSIGNMENT',
    'GRANT_NOT_HELD',
    'INVITATION_EMAIL_MISMATCH',
    'NEGOTIATOR_NOT_AUTHORIZED',
    'NOT_APPROVAL_REQUESTER',
    'NOT_ASSIGNED_APPROVER',
    'NOT_ASSIGNED_ASSESSOR',
    'NOT_ASSIGNED_EVALUATOR',
    'NOT_ASSIGNED_FINANCIAL_REVIEWER',
    'NOT_COMMITTEE_MEMBER',
    'NOT_NAMED_CONTRACT_MANAGER',
    'NOT_OPENING_OFFICER',
    'NOT_REQUEST_PARTY',
    'NOT_THE_PARTICIPANT',
    'NOT_YOUR_SIGNATURE',
    'REPORT_FAMILY_RESTRICTED',
    'REQUEST_PERMISSION_MISSING',
    'RESTRICTED_METADATA_REQUIRES_AUDIT_VIEW',
    'SELF_APPROVAL_BLOCKED',
    'SELF_APPROVAL_NOT_PERMITTED',
    'SELF_AUTHORITY_FORBIDDEN',
    'SELF_DELEGATION_FORBIDDEN',
    'SELF_GRANT_FORBIDDEN',
    'SIGNATORY_AUTHORITY_INSUFFICIENT',
    'SOD_SELF_APPROVAL_BLOCKED',
    'SOURCE_NOT_PERMITTED',
    'TASK_NOT_ASSIGNED_TO_CALLER',
  ],
  404: [
    'APPROVAL_NOT_FOUND',
    'ARTICLE_NOT_FOUND',
    'ASSIGNMENT_NOT_FOUND',
    'ATTACHMENT_NOT_FOUND',
    'BID_NOT_FOUND',
    'BUYER_NOT_FOUND',
    'CALENDAR_NOT_FOUND',
    'COMMERCIAL_EVALUATION_NOT_FOUND',
    'CUSTOM_FIELD_NOT_FOUND',
    'DECISION_NOT_FOUND',
    'DECLARATION_NOT_FOUND',
    'DOCUMENT_NOT_FOUND',
    'DOWNLOAD_LINK_INVALID',
    'ENTITLEMENT_NOT_IN_SUBSCRIPTION',
    'EVIDENCE_NOT_ATTACHED',
    'HOLIDAY_NOT_FOUND',
    'INFO_REQUEST_NOT_FOUND',
    'INVITATION_NOT_FOUND',
    'MEMBER_NOT_FOUND',
    'MODERATION_NOT_FOUND',
    'NOTICE_NOT_FOUND',
    'NOTIFICATION_NOT_FOUND',
    'OPPORTUNITY_NOT_FOUND',
    'PARTICIPANT_NOT_FOUND',
    'POLICY_PROFILE_NOT_FOUND',
    'POLICY_VERSION_NOT_FOUND',
    'PORTAL_NOT_AVAILABLE',
    'PORTAL_PROPOSAL_NOT_FOUND',
    'PRICING_ITEM_NOT_FOUND',
    'PROGRAM_VERSION_NOT_FOUND',
    'PUBLICATION_NOT_FOUND',
    'RECEIPT_NOT_FOUND',
    'REPORT_NOT_FOUND',
    'REQUIREMENT_NOT_FOUND',
    'REUSE_SOURCE_NOT_FOUND',
    'REVISION_NOT_FOUND',
    'RULE_NOT_FOUND',
    'SAVED_SEARCH_NOT_FOUND',
    'SCORE_NOT_FOUND',
    'SUBJECT_NOT_FOUND',
    'SUBSCRIPTION_NOT_FOUND',
    'SUPPLIER_NOT_FOUND',
    'TASK_NOT_FOUND',
    'TEMPLATE_NOT_FOUND',
    'TEMPLATE_VERSION_NOT_FOUND',
    'TENDER_NOT_FOUND',
    'UPLOAD_NOT_FOUND',
    'VERSION_NOT_FOUND',
    'WATCHLIST_ITEM_NOT_FOUND',
  ],
  409: [
    'ABNORMALLY_LOW_REVIEW_PENDING',
    'ACCESS_ALREADY_DECIDED',
    'ACCESS_ALREADY_GRANTED',
    'ACCESS_ALREADY_REQUESTED',
    'ACCESS_NOT_GRANTED',
    'ACCESS_NOT_REQUESTED',
    'ACCESS_NOT_REQUIRED',
    'ACKNOWLEDGMENT_NOT_REQUIRED',
    'ACTION_CLOSED',
    'ADDENDUM_ALREADY_ISSUED',
    'ADDENDUM_ALREADY_WITHDRAWN',
    'ADDENDUM_NOT_APPROVED',
    'ADDENDUM_NOT_DRAFT',
    'ADDENDUM_NOT_EDITABLE',
    'ADDENDUM_NOT_ISSUED',
    'ALREADY_ACKNOWLEDGED',
    'ALREADY_ARCHIVED',
    'ALREADY_ASSIGNED',
    'ALREADY_COMMITTEE_MEMBER',
    'ALREADY_DISMISSED',
    'ALREADY_FINAL_AWARDED',
    'ALREADY_GROUP_MEMBER',
    'ALREADY_INACTIVE',
    'ALREADY_INVITED',
    'ALREADY_MEMBER',
    'ALREADY_ON_TEAM',
    'ALREADY_PARTICIPATING',
    'ALREADY_PUBLISHED',
    'ALREADY_QUALIFIED',
    'ALREADY_RECONCILED',
    'ALREADY_REGISTERED',
    'ALREADY_SHARED',
    'ALREADY_WATCHED',
    'ALTERNATIVE_SESSION_FULL',
    'ANNOUNCEMENT_ARCHIVED',
    'ANNOUNCEMENT_NOT_DRAFT',
    'APPEAL_NOT_AVAILABLE',
    'APPEAL_WINDOW_CLOSED',
    'APPLICATION_ALREADY_OPEN',
    'APPLICATION_IN_PROGRESS',
    'APPLICATION_NOT_ASSIGNABLE',
    'APPLICATION_NOT_DECISION_PENDING',
    'APPLICATION_NOT_DRAFT',
    'APPLICATION_NOT_EDITABLE',
    'APPLICATION_NOT_UNDER_REVIEW',
    'APPLICATION_NOT_WITHDRAWABLE',
    'APPROVAL_ALREADY_PENDING',
    'APPROVAL_EXPIRED',
    'APPROVAL_INVALIDATED',
    'APPROVAL_NOT_PENDING',
    'APPROVAL_VERSION_MISMATCH',
    'ASSESSMENTS_INCOMPLETE',
    'ASSESSMENT_CONTENT_BLOCKED',
    'ASSESSMENT_INCOMPLETE',
    'ASSESSMENT_NOT_SUBMITTED',
    'ASSESSMENT_SUBMITTED',
    'ASSIGNEE_CONFLICT_DECLARED',
    'ASSIGNMENT_ALREADY_ACCEPTED',
    'ASSIGNMENT_ALREADY_ENDED',
    'ASSIGNMENT_CLOSED',
    'ASSIGNMENT_NOT_ACCEPTED',
    'ASSIGNMENT_VIA_GROUP',
    'AUDIENCE_WIDENING_REQUIRES_NEW_FIELD',
    'AUTHORITY_SUFFICIENT',
    'AWARD_CONDITIONS_UNMET',
    'BAFO_NOT_PERMITTED',
    'BATCH_CLOSED',
    'BID_ALREADY_EXISTS',
    'BID_EXCLUDED',
    'BID_NOT_ELIGIBLE',
    'BID_NOT_INVITED',
    'BID_NOT_OPENED',
    'BID_NOT_PREFERRED',
    'BID_WITHDRAWN',
    'BUSINESS_DISPUTE_MUST_ROUTE',
    'CALENDAR_IN_USE',
    'CALENDAR_IS_DEFAULT',
    'CALENDAR_NAME_TAKEN',
    'CALENDAR_NOT_APPROVED',
    'CALENDAR_NOT_DRAFT',
    'CALENDAR_RETIRED',
    'CANNOT_CHANGE_OWN_STATUS',
    'CANNOT_RESTRICT_SELF',
    'CASE_CLOSED',
    'CASE_DECIDED',
    'CASE_TRANSITION_INVALID',
    'CHAIR_ALREADY_ASSIGNED',
    'CHANGE_NOT_AGREEABLE',
    'CHANGE_NOT_AGREED',
    'CHANGE_NOT_ASSESSABLE',
    'CHANGE_NOT_ASSESSED',
    'CHANGE_NOT_PENDING_APPROVAL',
    'CHANGE_NOT_WITHDRAWABLE',
    'CHECKS_NOT_FAILED',
    'CHECKS_PENDING',
    'CHECK_REVISION_STALE',
    'CLARIFICATION_CONSOLIDATED',
    'CLARIFICATION_NOT_APPROVED',
    'CLARIFICATION_NOT_DRAFT',
    'CLARIFICATION_NOT_RESPONDED',
    'CLARIFICATION_OPEN',
    'CLOSEOUT_ALREADY_CLOSED',
    'CLOSEOUT_BLOCKED',
    'CLOSEOUT_NOT_CLOSED',
    'COMBINE_SOURCE_INVALID',
    'COMMENCEMENT_PRECONDITIONS_OPEN',
    'COMMERCIAL_ALREADY_APPROVED',
    'COMMERCIAL_ASSIGNMENT',
    'COMMITTEE_HAS_OPEN_WORK',
    'COMMITTEE_INACTIVE',
    'COMMITTEE_NAME_TAKEN',
    'COMPLAINT_ALREADY_CLOSED',
    'COMPLAINT_CLOSED',
    'COMPLAINT_NOT_DECIDED',
    'COMPLIANCE_DECIDED',
    'CONDITION_DUPLICATE',
    'CONDUCT_CASE_CLOSED',
    'CONFIDENTIALITY_ALREADY_ACCEPTED',
    'CONFIDENTIALITY_NOT_REQUIRED',
    'CONFIDENTIALITY_REVIEW_REQUIRED',
    'CONFLICT_ALREADY_DECLARED',
    'CONFLICT_DECLARATION_REQUIRED',
    'CONFLICT_UNRESOLVED',
    'CONTACT_CHANGE_NOT_PENDING',
    'CONTACT_CHANGE_PENDING',
    'CONTACT_EMAIL_DUPLICATE',
    'CONTACT_NOT_VERIFIED',
    'CONTACT_UNCHANGED',
    'CONTENT_HASH_MISMATCH',
    'CONTEXT_MISMATCH',
    'CONTINUITY_PLAN_INCOMPLETE',
    'CONTINUITY_PLAN_REQUIRED',
    'CONTRACT_ALREADY_SIGNED',
    'CONTRACT_CLOSED',
    'CONTRACT_NOT_ACTIVE',
    'CONTRACT_NOT_AWAITING_SIGNATURE',
    'CONTRACT_NOT_CLOSABLE',
    'CONTRACT_NOT_DRAFT',
    'CONTRACT_NOT_EDITABLE',
    'CONTRACT_NOT_ELIGIBLE',
    'CONTRACT_NOT_SIGNED',
    'CONTRACT_NOT_STARTED',
    'CONTRACT_NOT_UNDER_REVIEW',
    'CORRECTION_ALREADY_PENDING',
    'CORRECTION_PENDING',
    'CUSTOMER_AGREEMENT_REQUIRED',
    'CUSTOMER_ALREADY_REGISTERED',
    'CUSTOM_FIELD_ACTIVE',
    'CUSTOM_FIELD_INACTIVE',
    'CUSTOM_FIELD_KEY_TAKEN',
    'DEADLINE_NOT_REACHED',
    'DEBRIEF_ALREADY_REQUESTED',
    'DEBRIEF_NOT_AVAILABLE',
    'DEBRIEF_NOT_OPEN',
    'DEBRIEF_WINDOW_CLOSED',
    'DECISION_ALREADY_SUPERSEDED',
    'DECISION_NOT_AUTHORIZED',
    'DECISION_NOT_CURRENT',
    'DECISION_NOT_RECONSIDERABLE',
    'DECISION_NOT_RENEWABLE',
    'DECISION_SUPERSEDED',
    'DECISION_UNCHANGED',
    'DECLARATION_ALREADY_DECIDED',
    'DECLARATION_ALREADY_REVIEWED',
    'DECLARATION_HAS_NO_CONFLICT',
    'DEFINITION_ALREADY_IN_STATE',
    'DEFINITION_INACTIVE',
    'DELEGATE_CONFLICT',
    'DELEGATE_NOT_ACTIVE',
    'DELEGATION_ALREADY_ENDED',
    'DELEGATION_EXCEEDS_LIMIT',
    'DELEGATION_EXCEEDS_SCOPE',
    'DELEGATOR_HAS_NO_AUTHORITY',
    'DEPENDENCY_CYCLE',
    'DEPENDENCY_ORDER',
    'DIFFERENCE_NOT_APPROVED',
    'DILIGENCE_BLOCKING',
    'DILIGENCE_FAILED_FINDING',
    'DILIGENCE_FINDINGS_UNRESOLVED',
    'DISPOSAL_ALREADY_DECIDED',
    'DISPOSAL_BLOCKED_BY_HOLD',
    'DISPOSAL_NOT_APPROVED',
    'DISPOSAL_NOT_ELIGIBLE',
    'DISPUTE_CLOSED',
    'DOCUMENT_IS_REDACTED_COPY',
    'DOCUMENT_NOT_CONFIRMED',
    'DOCUMENT_NOT_EDITABLE',
    'DRAFT_REVISION_CHANGED',
    'DRAFT_VERSION_EXISTS',
    'DUPLICATE_ALREADY_DECIDED',
    'DUPLICATE_ALREADY_FLAGGED',
    'DUPLICATE_OPEN_COMPLAINT',
    'DUPLICATE_REPORT_NAME',
    'DUPLICATE_REVIEW_REQUIRED',
    'DUPLICATE_SAVED_SEARCH_NAME',
    'DUPLICATE_VIEW_NAME',
    'EMAIL_ALREADY_REGISTERED',
    'EMAIL_CHANNEL_NOT_ENABLED',
    'EMAIL_IN_USE',
    'ENVELOPE_IN_USE',
    'ENVELOPE_NOT_OPENED',
    'EQUAL_TREATMENT_ALREADY_CONFIRMED',
    'EQUAL_TREATMENT_CHECK_FAILED',
    'EQUAL_TREATMENT_NOT_CONFIRMED',
    'EVALUATION_NOT_SIGNED_OFF',
    'EVALUATOR_CONFLICTED',
    'EVALUATOR_NOT_ELIGIBLE',
    'EVIDENCE_ALREADY_ATTACHED',
    'EVIDENCE_ALREADY_WITHDRAWN',
    'EVIDENCE_EXPIRED',
    'EVIDENCE_NOT_CURRENT',
    'EVIDENCE_NOT_RENEWABLE',
    'EXCEPTION_ALREADY_INVESTIGATING',
    'EXCEPTION_ALREADY_RESOLVED',
    'EXCHANGE_RATE_MISSING',
    'EXCLUSION_ALREADY_ACTIVE',
    'EXCLUSION_ALREADY_DECIDED',
    'EXCLUSION_IN_PROGRESS',
    'EXCLUSION_NOT_APPROVED',
    'EXIT_EXPORT_IN_PROGRESS',
    'EXIT_EXPORT_NOT_READY',
    'EXPORT_FAILED',
    'EXPORT_NOT_READY',
    'EXTERNAL_CHANNEL_NOT_CONFIGURED',
    'FAIRNESS_REVIEW_CLOSED',
    'FAIRNESS_REVIEW_PENDING',
    'FALLBACK_ALREADY_RECORDED',
    'FALLBACK_BID_NOT_ELIGIBLE',
    'FALLBACK_NOT_AVAILABLE',
    'FIELD_IS_CONDITION_SOURCE',
    'FIELD_LOCKED_BY_ISSUED_FORMS',
    'FINAL_AWARD_APPROVAL_MISSING',
    'FINAL_AWARD_BLOCKED_BY_HOLD',
    'FINAL_OFFER_ROUND_OPEN',
    'FINANCIAL_REVIEW_REQUIRED',
    'FINDINGS_INCOMPLETE',
    'FUNDING_NOT_CONFIRMED',
    'GRANT_ALREADY_ACTIVE',
    'GRANT_ALREADY_ENDED',
    'GRANT_NOT_ACTIVE',
    'GRANT_NOT_REQUESTED',
    'GROUP_INACTIVE',
    'GROUP_NAME_TAKEN',
    'HANDOVER_NOT_ACCEPTED',
    'HANDOVER_NOT_APPLICABLE',
    'HANDOVER_NOT_DRAFT',
    'HANDOVER_NOT_SUBMITTED',
    'HAS_ACTIVE_CHILDREN',
    'HELP_ARTICLE_ARCHIVED',
    'HELP_ARTICLE_NOT_DRAFT',
    'HOLD_ALREADY_ACTIVE',
    'HOLD_ALREADY_RELEASED',
    'HOLD_BLOCKS_ACTION',
    'HOLD_BLOCKS_CONTRACT',
    'HOLD_BLOCKS_SIGNATURE',
    'HOLD_BLOCKS_START',
    'HOLD_NOT_ACTIVE',
    'HOLD_STILL_ACTIVE',
    'HOLIDAY_ALREADY_EXISTS',
    'IDENTITY_ALREADY_VERIFIED',
    'IDENTITY_CHANGE_ALREADY_DECIDED',
    'IDENTITY_CHANGE_ALREADY_PENDING',
    'IDENTITY_CHANGE_NOT_SUBMITTED',
    'IMPACT_DUPLICATE',
    'IMPACT_NOT_ACKNOWLEDGED',
    'IMPACT_REVIEW_REQUIRED',
    'INCIDENT_ALREADY_RESOLVED',
    'INDEPENDENT_OWNER_REQUIRED',
    'INFO_REQUEST_CLOSED',
    'INFO_REQUEST_NOT_OPEN',
    'INFO_REQUEST_UNANSWERED',
    'INTEGRATION_NAME_TAKEN',
    'INTEGRATION_NOT_ACTIVE',
    'INTEGRATION_RETIRED',
    'INTEGRATION_TRANSITION_INVALID',
    'INTENT_ALREADY_ISSUED',
    'INTENT_NOT_NOTIFIED',
    'INTENT_UNCHANGED',
    'INTERNAL_APPROVAL_REQUIRED',
    'INVALID_COMPLAINT_TRANSITION',
    'INVALID_TRANSITION',
    'INVITATION_ALREADY_ACCEPTED',
    'INVITATION_ALREADY_CLAIMED',
    'INVITATION_ALREADY_PENDING',
    'INVITATION_EXPIRED',
    'INVITATION_NOT_PENDING',
    'INVITATION_NOT_REISSUABLE',
    'INVITATION_NOT_REVOCABLE',
    'INVITATION_ONLY',
    'INVITATION_REVOKED',
    'INVITATION_SUPERSEDED',
    'INVITEE_NOT_ELIGIBLE',
    'INVITE_NOT_OPEN',
    'INVOICE_ALREADY_DISPUTED',
    'INVOICE_ALREADY_PAID',
    'INVOICE_DUPLICATE_REFERENCE',
    'ITEM_CODE_TAKEN',
    'LAST_ADMINISTRATOR',
    'LAST_BID_MANAGER',
    'LAST_CONTRACTING_ENTITY',
    'LATE_DISPOSITION_ALREADY_RECORDED',
    'LATE_DISPOSITION_REQUIRED',
    'LIMIT_ALREADY_ENDED',
    'LIMIT_OVERLAPS',
    'LINK_CYCLE',
    'LIVE_OBLIGATIONS_REMAIN',
    'LOT_ALREADY_DECIDED',
    'LOT_CANCELLED',
    'LOT_NOT_ELIGIBLE',
    'LOT_NOT_OPEN',
    'LOT_NOT_SELECTED',
    'LOT_OUTCOME_NOT_AWARDABLE',
    'LOT_OUTCOME_NOT_FINAL',
    'LOT_REQUIRED',
    'MANDATE_NOT_APPROVED',
    'MANDATORY_REQUIRES_ADDENDUM',
    'MANDATORY_RULE_NOT_DEACTIVATABLE',
    'MANDATORY_SESSION_NEEDS_ALTERNATIVE',
    'MANUAL_FALLBACK_NOT_DOCUMENTED',
    'MANUAL_FALLBACK_REQUIRED',
    'MEMBERSHIP_NOT_ACTIVE',
    'MEMBERSHIP_NOT_PENDING',
    'MEMBERSHIP_NOT_REVOKED',
    'MEMBERSHIP_REQUEST_NOT_PENDING',
    'MEMBERSHIP_REQUEST_PENDING',
    'MEMBER_ALREADY_DEACTIVATED',
    'MEMBER_ALREADY_ENDED',
    'MEMBER_NOT_ACTIVE',
    'MEMBER_NOT_SUSPENDED',
    'METHOD_NOT_PERMITTED',
    'MINUTES_ALREADY_PUBLISHED',
    'MODERATED_SCORE_MISSING',
    'MODERATION_FINALIZED',
    'NEGOTIATION_EXISTS',
    'NEGOTIATION_NOT_ACTIVE',
    'NEGOTIATION_NOT_PERMITTED',
    'NON_PRICE_MODERATION_OPEN',
    'NOTHING_OUTSTANDING',
    'NOTICE_ALREADY_ACKNOWLEDGED',
    'NOTICE_ALREADY_ISSUED',
    'NOTICE_EXISTS',
    'NOTICE_HAS_NO_TERMS',
    'NOTICE_NOT_ACKNOWLEDGED',
    'NOTICE_NOT_AVAILABLE',
    'NOTICE_NOT_DRAFT',
    'NOTICE_NOT_EDITABLE',
    'NOTICE_NOT_ISSUED',
    'NOTICE_NOT_OPEN',
    'NOT_AN_ATTENDANCE_EXCEPTION',
    'NOT_AN_INVITATION',
    'NOT_A_PARTICIPANT',
    'NOT_CURRENT_STEP',
    'NOT_DISMISSED',
    'NOT_EXTERNAL_CHANNEL',
    'NOT_FLAGGED_ABNORMALLY_LOW',
    'NOT_GROUP_MEMBER',
    'NOT_INVITED',
    'NOT_SCHEDULED',
    'NO_APPROVED_OUTCOME',
    'NO_BASE_VERSION',
    'NO_EFFECTIVE_SUBMISSION',
    'NO_FINAL_AWARD',
    'NO_HIGHER_AUTHORITY',
    'NO_OFFBOARDING_PLAN',
    'NO_OUTSTANDING_ACKNOWLEDGMENTS',
    'NO_PENDING_CORRECTION',
    'NO_PENDING_INVITATIONS',
    'OBLIGATION_CLOSED',
    'OBLIGATION_NOT_OPEN',
    'OBLIGATION_NOT_OVERDUE',
    'OBLIGATION_NOT_UNDER_REVIEW',
    'OBLIGATION_NO_EVIDENCE',
    'OBLIGATION_WRONG_PARTY',
    'OFFBOARDING_ALREADY_REQUESTED',
    'OFFBOARDING_NOT_APPLICABLE',
    'OFFBOARDING_PLAN_ALREADY_AGREED',
    'OFFBOARDING_PLAN_EXISTS',
    'OFFBOARDING_PLAN_LOCKED',
    'OFFBOARDING_PLAN_NOT_READY',
    'OFFBOARDING_TRANSITION_INVALID',
    'ONBOARDING_ITEMS_OPEN',
    'ONBOARDING_NOT_APPLICABLE',
    'OPEN_EXCEPTIONS_BLOCK_RETIRE',
    'OPEN_INFO_REQUESTS',
    'OPEN_WORK_EXISTS',
    'OPEN_WORK_NOT_REASSIGNED',
    'OPPORTUNITY_CLOSED',
    'OUTCOME_CONTRADICTS_CHECKS',
    'OUTCOME_NOTICES_ALREADY_ISSUED',
    'OWNER_NOT_ACTIVE',
    'OWNER_NOT_INDEPENDENT',
    'OWNER_REQUIRED',
    'OWN_ASSESSMENT_NOT_SUBMITTED',
    'PARTICIPANT_ALREADY_CONFIRMED',
    'PLAN_ALREADY_APPROVED',
    'PLAN_HAS_BLOCKING_ISSUES',
    'PLAN_ITEM_LOCKED',
    'PLAN_ITEM_NOT_ACTIVE',
    'PLAN_ITEM_NOT_SCHEDULED',
    'PLAN_VERSION_CONFLICT',
    'POLICY_DRAFT_EXISTS',
    'POLICY_PROFILE_NAME_TAKEN',
    'POLICY_PROFILE_RETIRED',
    'POLICY_REVIEW_IN_PROGRESS',
    'POLICY_VERSION_IMMUTABLE',
    'POLICY_VERSION_IN_REVIEW',
    'POLICY_VERSION_IS_CURRENT',
    'POLICY_VERSION_NOT_APPROVED',
    'POLICY_VERSION_NOT_DRAFT',
    'POLICY_VERSION_NOT_IN_REVIEW',
    'PORTAL_NOTICES_DISABLED',
    'PORTAL_PROPOSAL_IN_REVIEW',
    'PORTAL_PROPOSAL_NOT_DRAFT',
    'PORTAL_PROPOSAL_NOT_IN_REVIEW',
    'PORTAL_PROPOSAL_UNCHANGED',
    'POSSIBLE_DUPLICATE_SUPPLIER',
    'POSSIBLE_DUPLICATE_UNACKNOWLEDGED',
    'PREFERRED_BIDDER_ACTIVE',
    'PREFERRED_BIDDER_NOT_ACTIVE',
    'PREPARATION_TIME_TOO_SHORT',
    'PRICE_GATE_ALREADY_RELEASED',
    'PRICE_GATE_NOT_APPLICABLE',
    'PRICE_GATE_NOT_RELEASED',
    'PRICING_REQUIRES_PERMISSION',
    'PROCEDURE_NOT_PERMITTED',
    'PROCEDURE_THRESHOLD_EXCEEDED',
    'PROCESS_DECISION_PENDING',
    'PROCESS_DECISION_REQUIRED',
    'PROGRAM_HAS_OPEN_APPLICATIONS',
    'PROGRAM_NAME_DUPLICATE',
    'PROGRAM_RETIRED',
    'PUBLICATION_HOLD_ACTIVE',
    'PUBLICATION_NOT_FAILED',
    'PUBLIC_NOTICE_ALREADY_PUBLISHED',
    'PUBLIC_NOTICE_NOT_EDITABLE',
    'PUBLIC_NOTICE_REVIEW_INCOMPLETE',
    'PUBLIC_OPENING_NOT_REQUIRED',
    'PUBLIC_SUMMARY_ALREADY_RELEASED',
    'PURSUIT_NOT_STARTED',
    'QUALIFICATION_GATE_NOT_MET',
    'QUESTION_ALREADY_ANSWERED',
    'QUESTION_CLOSED',
    'QUESTION_NOT_IN_REVIEW',
    'QUESTION_NOT_LATE',
    'QUORUM_NOT_MET',
    'QUORUM_WOULD_BREAK',
    'RATIONALE_REQUIRED',
    'READINESS_BLOCKED',
    'READINESS_BLOCKING',
    'REASSIGNEE_CONFLICTED',
    'REASSIGNEE_NOT_ELIGIBLE',
    'REASSIGNMENT_ALREADY_REQUESTED',
    'RECEIPT_NOT_EFFECTIVE',
    'RECIPIENT_NOT_FAILED',
    'RECOMMENDATION_ALREADY_OPEN',
    'RECOMMENDATION_NOT_APPROVED',
    'RECOMMENDATION_NOT_AWAITING_APPROVAL',
    'RECOMMENDATION_NOT_EDITABLE',
    'RECONSIDERATION_ALREADY_REQUESTED',
    'RECONSIDERATION_WINDOW_CLOSED',
    'RECORDS_PENDING',
    'RECORD_ALREADY_DECIDED',
    'REFERENCES_NOT_PERMITTED',
    'REFERENCE_CONSENT_REQUIRED',
    'REFERENCE_FEEDBACK_RECORDED',
    'REF_CODE_TAKEN',
    'REGISTRATION_CLOSED',
    'REGISTRATION_NOT_ACTIVE',
    'REGISTRATION_NOT_PENDING',
    'RELATIONSHIP_REQUIRED',
    'RELEASE_ALREADY_APPROVED',
    'RELEASE_APPROVAL_INVALIDATED',
    'RELEASE_APPROVAL_MISSING',
    'RELEASE_APPROVAL_PENDING',
    'RELEASE_NOT_READY',
    'RENEWAL_ALREADY_DECIDED',
    'RENEWAL_ALREADY_REQUESTED',
    'RENEWAL_DEADLINE_PASSED',
    'RENEWAL_NOT_APPROVED',
    'REPORT_ALREADY_HANDED_OFF',
    'REPORT_NOT_DRAFT',
    'REPORT_NOT_IN_SIGNOFF',
    'REPORT_NOT_READY',
    'REPORT_NOT_SIGNED_OFF',
    'REQUEST_ALREADY_CONVERTED',
    'REQUEST_NOT_APPROVED',
    'REQUEST_NOT_EDITABLE',
    'REQUEST_NOT_OPEN',
    'REQUIREMENT_LOT_NOT_SELECTED',
    'RESPONSE_DEADLINE_PASSED',
    'RESPONSIBILITY_REQUIRES_AUTHORITY',
    'RESTRICTION_ALREADY_ENDED',
    'RESTRICTION_APPLIES',
    'RESTRICTION_CONFLICT_PENDING',
    'RESULTS_SIGNED_OFF',
    'RETENTION_CLASS_REQUIRED',
    'RETENTION_SHORTER_THAN_LIVE_OBLIGATIONS',
    'REVIEW_ALREADY_COMPLETED',
    'REVIEW_ALREADY_FINALIZED',
    'REVIEW_ALREADY_RECORDED',
    'REVIEW_NOT_DRAFT',
    'REVIEW_NOT_SHARED',
    'REVIEW_PERIOD_OVERLAPS',
    'REVIEW_REQUIRED',
    'REVISION_CONFLICT',
    'REVISION_NOT_EDITABLE',
    'REVISION_NOT_SUBMITTABLE',
    'RFI_FINDINGS_REQUIRED',
    'ROLE_ALREADY_ASSIGNED',
    'ROLE_CODE_TAKEN',
    'ROLE_HAS_ACTIVE_ASSIGNMENTS',
    'ROLE_INACTIVE',
    'ROUND_NOT_APPROVED',
    'ROUND_NOT_AWAITING_RESPONSE',
    'ROUND_NOT_CANCELLABLE',
    'ROUND_NOT_ISSUABLE',
    'ROUND_NOT_OPEN',
    'RULE_ALREADY_EXISTS',
    'RULE_STATUS_UNCHANGED',
    'SAME_AS_CURRENT',
    'SAVED_VIEW_LIMIT_REACHED',
    'SCORE_NOT_SUBMITTED',
    'SCORE_UNCHANGED',
    'SCREENING_ALREADY_REVIEWED',
    'SCREENING_UNREVIEWED',
    'SEALED_CONTENT_NOT_REDACTABLE',
    'SECURITY_ALREADY_RELEASED',
    'SECURITY_RELEASE_NOT_APPROVED',
    'SEGREGATION_OF_DUTIES',
    'SELF_REVIEW_BLOCKED',
    'SELF_REVIEW_NOT_ALLOWED',
    'SERVICE_ACTION_RESOLVED',
    'SESSION_ALREADY_ABORTED',
    'SESSION_ALREADY_COMPLETED',
    'SESSION_ALREADY_HELD',
    'SESSION_ALREADY_SCHEDULED',
    'SESSION_CANCELLED',
    'SESSION_FULL',
    'SESSION_NOT_COMPLETED',
    'SESSION_NOT_EDITABLE',
    'SESSION_NOT_HELD',
    'SESSION_NOT_OPEN',
    'SESSION_NOT_OPEN_FOR_FINDINGS',
    'SESSION_NOT_STARTED',
    'SESSION_TYPE_NOT_PERMITTED',
    'SHARE_ALREADY_WITHDRAWN',
    'SHORTLIST_EXISTS',
    'SHORTLIST_NOT_APPROVED',
    'SHORTLIST_NOT_EDITABLE',
    'SIGNATORY_ALREADY_LISTED',
    'SIGNATURE_ALREADY_RECORDED',
    'SIGNING_LIMIT_REQUIRES_SIGNATORY',
    'SIGNOFF_ALREADY_DECIDED',
    'SLUG_TAKEN',
    'SOD_CONFLICT',
    'SOD_POLICY_UNCHANGED',
    'STAGE_ALREADY_OPENED',
    'STAGE_OUT_OF_ORDER',
    'STAGE_TRANSITION_INVALID',
    'STANDING_NOT_ASSESSED',
    'STANDSTILL_NOT_ACTIVE',
    'STANDSTILL_NOT_COMPLETE',
    'STATUS_TRANSITION_INVALID',
    'STRATEGY_ALREADY_USED',
    'STRATEGY_EXISTS',
    'STRATEGY_NOT_APPROVED',
    'STRATEGY_NOT_EDITABLE',
    'STRUCTURE_CODE_TAKEN',
    'STRUCTURE_NAME_TAKEN',
    'SUBJECT_NOT_READY_FOR_APPROVAL',
    'SUBJECT_VERSION_MISMATCH',
    'SUBMISSION_ALREADY_RECEIVED',
    'SUBMISSION_AUTHORITY_UNCHANGED',
    'SUBMISSION_FAILED',
    'SUBMISSION_LATE',
    'SUBMISSION_WINDOW_CLOSED',
    'SUBSCRIPTION_ENDED',
    'SUBSCRIPTION_EXISTS',
    'SUBSCRIPTION_TRANSITION_INVALID',
    'SUPPLIER_AGREEMENT_PENDING',
    'SUPPLIER_ALREADY_AGREED',
    'SUPPLIER_ALREADY_PARTICIPANT',
    'SUPPLIER_NOT_ELIGIBLE_FOR_REQUEST',
    'SUPPLIER_NOT_QUALIFIED',
    'SUPPLIER_RESPONSE_PENDING',
    'SUPPLIER_RESTRICTED',
    'SYSTEM_ROLE_READ_ONLY',
    'TASK_COMPLETED_BY_SOURCE_ACTION',
    'TASK_NOT_OPEN',
    'TASK_TENANT_MISMATCH',
    'TEAM_MEMBER_ALREADY_ASSIGNED',
    'TEAM_MEMBER_ALREADY_REMOVED',
    'TEMPLATE_NAME_TAKEN',
    'TEMPLATE_NOT_APPROVED',
    'TEMPLATE_RETIRED',
    'TEMPLATE_REVISION_EXISTS',
    'TEMPLATE_VERSION_IMMUTABLE',
    'TEMPLATE_VERSION_IN_REVIEW',
    'TEMPLATE_VERSION_NOT_DRAFT',
    'TEMPLATE_VERSION_NOT_IN_REVIEW',
    'TENDER_ALREADY_LINKED',
    'TENDER_CLOSED',
    'TENDER_LOCKED',
    'TENDER_NOT_ACCEPTING_QUESTIONS',
    'TENDER_NOT_AMENDABLE',
    'TENDER_NOT_AT_AWARD_STAGE',
    'TENDER_NOT_CLOSED',
    'TENDER_NOT_EDITABLE',
    'TENDER_NOT_IN_ASSESSMENT',
    'TENDER_NOT_OPEN',
    'TENDER_NOT_READY',
    'TENDER_NOT_RELEASED',
    'TERMS_ALREADY_ACCEPTED',
    'TRIGGER_ALREADY_CLOSED',
    'TRIGGER_ALREADY_OPEN',
    'UNDERTAKING_VERSION_OUTDATED',
    'UNRESOLVED_SERVICE_INCIDENT',
    'UPLOAD_ALREADY_CONFIRMED',
    'UPLOAD_NOT_RECEIVED',
    'USER_DEACTIVATED',
    'USER_NOT_ACTIVE',
    'VALUE_INACTIVE',
    'VERIFICATION_REQUEST_NOT_OPEN',
    'VERIFICATION_REQUEST_OPEN',
    'VERSION_MISMATCH',
    'VERSION_NOT_CONFIRMED',
    'VERSION_NOT_DRAFT',
    'WORKING_REVISION_EXISTS',
    'WORK_ITEM_NOT_OPEN',
  ],
  410: [
    'DOWNLOAD_LINK_EXPIRED',
    'UPLOAD_EXPIRED',
  ],
  422: [
    'AFFECTED_LOTS_REQUIRED',
    'ALLOCATION_EXCEEDS_AWARD',
    'ALTERNATIVES_NOT_ALLOWED',
    'ALTERNATIVE_NOT_IN_TENDER',
    'ALTERNATIVE_SESSION_REQUIRED',
    'AMENDMENT_NOTE_REQUIRED',
    'ANSWER_REQUIRED',
    'ANSWER_TYPE_MISMATCH',
    'APPROVER_NOT_AUTHORIZED',
    'ASSESSOR_NOT_ELIGIBLE',
    'ASSIGNEE_CANNOT_VIEW_PRICING',
    'ASSIGNEE_NOT_ELIGIBLE',
    'ASSIGNEE_NOT_ON_TEAM',
    'ASSIGNEE_NOT_OPERATOR',
    'AUTHORITY_EXCEEDS_PROPOSED_VALUE',
    'BAFO_NOT_PERMITTED_BY_POLICY',
    'BUSINESS_OWNER_NOT_MEMBER',
    'BUYER_UNKNOWN',
    'CANDIDATE_MISSING',
    'CAPACITY_BELOW_REGISTRATIONS',
    'CATEGORY_NOT_FOUND',
    'CATEGORY_UNKNOWN',
    'CELL_NOT_IN_SCOPE',
    'CHANGE_AREA_REQUIRED',
    'CHECK_NOT_ON_BID',
    'CHOICE_NOT_ALLOWED',
    'CLAIM_EMAIL_MISMATCH',
    'CLASSIFICATION_NOT_PERMITTED',
    'CLASSIFICATION_NOT_WIDER',
    'COMBINE_CURRENCY_MISMATCH',
    'COMBINE_SELF',
    'CONDITIONS_NOT_PERMITTED',
    'CONDITION_CYCLE',
    'CONDITION_FIELD_NOT_FOUND',
    'CONDITION_VALUE_INVALID',
    'CONFIDENTIALITY_ACCEPTANCE_REQUIRED',
    'CONFIDENTIAL_PLACEHOLDER_NOT_ALLOWED',
    'CONFIRMATION_BEFORE_PUBLICATION',
    'CONSOLIDATION_DIFFERENT_BID',
    'CONSOLIDATION_SELF',
    'CONTENT_TYPE_NOT_ALLOWED',
    'COVERAGE_REQUIRED',
    'CRITERION_NOT_FOUND',
    'CRITERION_NOT_IN_PLAN',
    'CRITERION_NOT_IN_VERSION',
    'CURRENCY_BASIS_UNAVAILABLE',
    'CURRENCY_MISMATCH',
    'CURRENCY_NOT_ACCEPTED',
    'CURRENCY_REQUIRED_FOR_AMOUNT',
    'CUSTOMER_CONTACT_NOT_MEMBER',
    'CUSTOM_FIELDS_INCOMPLETE',
    'DEADLINE_IN_PAST',
    'DECISION_OWNER_NOT_ELIGIBLE',
    'DECISION_ROLE_UNKNOWN',
    'DECLARATION_NOT_REQUIRED',
    'DEFER_DATE_NOT_FUTURE',
    'DELEGATE_NOT_AUTHORIZED',
    'DEPENDENCY_NOT_FOUND',
    'DIFFERENCE_EXPLANATION_REQUIRED',
    'DIRECT_AWARD_GROUNDS_REQUIRED',
    'DOCUMENT_NOT_IN_TENDER',
    'DUE_DATE_IN_PAST',
    'DUE_DATE_NOT_FUTURE',
    'DUPLICATE_EVENT_TYPE',
    'EFFECTIVE_DATE_IN_PAST',
    'END_DATE_IN_PAST',
    'ENTITY_TYPE_NOT_AUDITED',
    'ENTRY_BID_UNKNOWN',
    'ENVELOPE_NOT_IN_PLAN',
    'EVENT_TYPE_PROCEDURE_MISMATCH',
    'EVIDENCE_NOT_FOUND',
    'EVIDENCE_REQUIRED',
    'EVIDENCE_SUBJECT_NOT_FOUND',
    'EVIDENCE_TYPES_NOT_COVERED',
    'EVIDENCE_TYPE_MISMATCH',
    'EXTENSION_NOT_LATER',
    'EXTERNAL_CONFIRMATION_REQUIRED',
    'FIELD_NOT_IN_FAMILY',
    'FIELD_ORDER_INCOMPLETE',
    'FILE_TOO_LARGE',
    'FINANCIAL_PERIOD_IN_FUTURE',
    'FINANCIAL_REVIEWER_NOT_ELIGIBLE',
    'FINANCIAL_REVIEWER_REQUIRED',
    'FINDING_EFFECT_NOT_ALLOWED',
    'FINDING_OWNER_NOT_ELIGIBLE',
    'FORMAL_NOTICE_NOT_ANNOUNCEMENT',
    'FUNDING_BELOW_ESTIMATE',
    'FUNDING_CURRENCY_MISMATCH',
    'FUNDING_REVIEW_REQUIRED',
    'GRANT_DATES_INVALID',
    'GRANT_DURATION_TOO_LONG',
    'GRANT_EXPIRY_IN_PAST',
    'GRANT_SCOPE_WIDENED',
    'GRANT_TOO_LONG',
    'GROUP_NOT_FOUND',
    'HANDOVER_INCOMPLETE',
    'HOLD_SUBJECT_NOT_FOUND',
    'IMPACT_TENDER_NOT_FOUND',
    'INCLUDED_BELOW_THRESHOLD',
    'INVALID_DATE_RANGE',
    'INVALID_VALUE_RANGE',
    'INVITATION_EXPIRY_INVALID',
    'INVOICE_EXCEEDS_REMAINING_CEILING',
    'LEAD_MUST_BE_SUPPLIER',
    'LEGAL_ENTITY_INACTIVE',
    'LIMIT_DATES_INVALID',
    'LINKED_TENDER_NOT_FOUND',
    'LINK_TARGET_NOT_ELIGIBLE',
    'LINK_TO_SELF',
    'LOT_DEADLINE_BEFORE_RELEASE',
    'LOT_NOT_FOUND',
    'LOT_NOT_IN_TENDER',
    'LOT_OUTCOME_MISSING',
    'LOT_OUTCOME_OTHER_TENDER',
    'MANDATORY_ANSWERS_MISSING',
    'MANDATORY_AREA_MISSING',
    'MANDATORY_EVENT_LOCKED',
    'MANDATORY_EVENT_NOT_MUTABLE',
    'MANDATORY_EVIDENCE_MISSING',
    'MATCH_TOKEN_INVALID',
    'MAX_LOTS_EXCEEDED',
    'MEASURE_NOT_FOUND',
    'MEETING_AFTER_DUE_DATE',
    'MINUTES_DOCUMENT_NOT_OF_SESSION',
    'MISSING_EVIDENCE_NOT_A_PASS',
    'NA_NOT_DECLARED',
    'NA_REASON_MISSING',
    'NEEDED_BY_IN_PAST',
    'NEGOTIATION_NOT_PERMITTED_BY_POLICY',
    'NEGOTIATOR_NOT_ELIGIBLE',
    'NEW_DEADLINE_IN_PAST',
    'NEW_DEADLINE_WITHOUT_SUBMISSION_CHANGE',
    'NOTE_REQUIRED_FOR_BLOCKED',
    'NOTICE_INCOMPLETE',
    'NOT_APPLICABLE_NOT_PERMITTED',
    'NO_ELIGIBLE_APPROVER',
    'NO_ESCALATION_CONTACT',
    'NO_TERMS_TO_ACCEPT',
    'OBLIGATION_NOT_FOUND',
    'ORGANIZATION_NOT_IN_SCOPE',
    'OUTCOME_REQUIRED',
    'OWNER_LACKS_PERMISSION',
    'OWNER_NOT_ACTIVE_MEMBER',
    'OWNER_NOT_ELIGIBLE',
    'OWNER_NOT_MEMBER',
    'PARENT_CYCLE',
    'PARENT_INACTIVE',
    'PARENT_NOT_FOUND',
    'PARENT_SUPPORT_REQUIRED',
    'PARTIAL_BIDS_NOT_ALLOWED',
    'PARTICIPANT_NOT_ELIGIBLE',
    'PERMISSION_NOT_GRANTABLE',
    'PERMISSION_WRONG_TENANT_KIND',
    'PRICING_ACCESS_NOT_PERMITTED',
    'PRIMARY_CONTACT_NOT_MEMBER',
    'PRIMARY_CONTACT_REQUIRED',
    'PROGRAM_NOT_OPEN',
    'PROGRAM_UNKNOWN',
    'PROPOSED_VALUE_UNCHANGED',
    'PUBLIC_AUDIENCE_NOT_PERMITTED',
    'PURSUIT_OWNER_NOT_MEMBER',
    'QUALIFICATION_PROGRAM_NOT_FOUND',
    'QUALITY_ISSUES_UNRESOLVED',
    'QUESTION_NOT_IN_TENDER',
    'REASSIGN_TO_SELF',
    'RECIPIENT_NOT_ASSESSOR',
    'RECIPIENT_NOT_AUTHORIZED',
    'RECIPIENT_ROLE_NOT_ALLOWED',
    'RECORD_REFS_REQUIRED',
    'REFERENCE_NOT_FOUND',
    'REGISTRATION_DEADLINE_AFTER_START',
    'REGISTRATION_NOT_IN_SESSION',
    'RELATED_RECORD_NOT_FOUND',
    'RELATED_TYPE_NOT_SUPPORTED',
    'RELATIONSHIP_UNCHANGED',
    'RENEWAL_NOT_LATER',
    'RENEWAL_OPTION_NOT_APPLICABLE',
    'REPLACEMENT_NOT_ACKNOWLEDGED',
    'REPORTING_PERIOD_REQUIRED',
    'REQUEST_INCOMPLETE',
    'REQUIREMENT_NOT_IN_TENDER',
    'RESOLUTION_REQUIRED',
    'RESOLVED_AT_REQUIRED',
    'RESOLVED_BEFORE_START',
    'RESPONSE_TIME_ASSESSMENT_REQUIRED',
    'RESULTING_DECISION_REQUIRED',
    'REVIEW_DATE_IN_PAST',
    'REVIEW_NOT_FOUND',
    'ROLE_NOT_GRANTABLE',
    'ROUTE_TARGET_NOT_BUYER',
    'SAME_SUPPLIER',
    'SANITIZED_TEXT_NAMES_SUPPLIER',
    'SCHEDULED_BEFORE_CLOSING',
    'SCHEDULE_AFTER_DEADLINE',
    'SCHEDULE_DATE_REQUIRED',
    'SCHEDULE_IN_PAST',
    'SCHEDULE_REQUIRES_RECIPIENTS',
    'SCOPE_EXCEEDS_PROGRAM',
    'SCOPE_NOT_FOUND',
    'SCOPE_OUTSIDE_PROGRAM',
    'SCORE_OUT_OF_SCALE',
    'SEALED_CONTENT_NOT_GRANTABLE',
    'SELF_APPROVAL_NOT_ALLOWED',
    'SERVICE_OWNER_NOT_OPERATOR',
    'SESSION_END_BEFORE_START',
    'SESSION_IN_PAST',
    'SOD_INCOMPATIBLE_PERMISSIONS',
    'SOURCE_NOT_FOUND',
    'SPLIT_CURRENCY_MISMATCH',
    'SPLIT_TOTAL_MISMATCH',
    'START_IN_FUTURE',
    'STRATEGY_INCOMPLETE',
    'SUPPLIER_NOT_PARTICIPANT',
    'SUPPLIER_PARTY_MISMATCH',
    'SUPPORT_NOT_SUBMISSION_CHANNEL',
    'SURVIVING_TENANT_INVALID',
    'TEAM_ROLE_NOT_PERMITTED',
    'TEMPLATE_PLACEHOLDER_UNKNOWN',
    'TENDER_NOT_AVAILABLE',
    'TOPIC_NOT_AUTHORIZED',
    'TOTALS_DO_NOT_RECONCILE',
    'TRIGGER_NOT_FOUND',
    'UNKNOWN_BID',
    'UNKNOWN_BUYER',
    'UNKNOWN_CATEGORY',
    'UNKNOWN_CURRENCY',
    'UNSUPPORTED_FILE_TYPE',
    'UPLOAD_HASH_MISMATCH',
    'UPLOAD_SIZE_MISMATCH',
    'USER_NOT_MEMBER',
  ],
} as const satisfies Record<DomainErrorStatus, readonly string[]>;

function buildDomainErrorStatus(): ReadonlyMap<string, DomainErrorStatus> {
  const map = new Map<string, DomainErrorStatus>();
  for (const status of DOMAIN_ERROR_STATUSES) {
    for (const code of DOMAIN_ERRORS_BY_STATUS[status]) {
      if (map.has(code)) {
        throw new Error(`Error code ${code} is registered under two statuses.`);
      }
      if (!ERROR_CODE_PATTERN.test(code)) {
        throw new Error(`Error code ${code} is not UPPER_SNAKE.`);
      }
      map.set(code, status);
    }
  }
  return map;
}

/** Code → HTTP status of every declared business error. */
export const DOMAIN_ERROR_STATUS: ReadonlyMap<string, DomainErrorStatus> = buildDomainErrorStatus();

/**
 * The one HTTP status of an error code: a platform code (`PLATFORM_ERRORS`) or a declared business code
 * (`DOMAIN_ERROR_STATUS`). `undefined` for an unregistered code.
 */
export function errorStatus(code: string): number | undefined {
  if (Object.hasOwn(PLATFORM_ERRORS, code)) {
    return PLATFORM_ERRORS[code as PlatformErrorCode];
  }
  return DOMAIN_ERROR_STATUS.get(code);
}

// ---------------------------------------------------------------------------------------------------------
// Audiences and organizations
// ---------------------------------------------------------------------------------------------------------

/** API audience partitions (architecture-plan §3.1; docs/technical/07-api.md §2.2). */
export const AUDIENCES = ['public', 'me', 'buyer', 'supplier', 'ops'] as const;
export const Audience = z.enum(AUDIENCES);
export type Audience = (typeof AUDIENCES)[number];

/** The tenant kind an audience requires (`null`: no tenant context). */
export const AUDIENCE_TENANT_KIND = {
  public: null,
  me: null,
  buyer: 'buyer',
  supplier: 'supplier',
  ops: 'operator',
} as const satisfies Record<Audience, (typeof TENANTS_KIND)[number] | null>;

/** Tenant kind (`tenants.kind`). */
export const TenantKind = z.enum(TENANTS_KIND);
export type TenantKind = z.infer<typeof TenantKind>;

/**
 * The organization label of a row in a `/me` list (DD-21): `/me` lists span every active membership, and each row
 * names its organization. Acting on the row sends `X-Tenant-Id: tenantId`.
 */
export const OrganizationLabel = z.object({
  tenantId: Id,
  tenantName: z.string().min(1),
  tenantKind: TenantKind,
});
export type OrganizationLabel = z.infer<typeof OrganizationLabel>;

/** A person reference shown on records (owner, assignee, approver). */
export const PersonRef = z.object({
  userId: Id,
  fullName: z.string().min(1),
});
export type PersonRef = z.infer<typeof PersonRef>;

/** A person reference with the capacity (membership title) they acted in (BR-02). */
export const ActorRef = PersonRef.extend({
  capacity: z.string().nullable(),
});
export type ActorRef = z.infer<typeof ActorRef>;

/** Free text with a sane upper bound for reasons and notes. */
export const ReasonText = z
  .string({ error: issue('REASON_REQUIRED', 'A reason is required.') })
  .trim()
  .min(1, issue('REASON_REQUIRED', 'A reason is required.'))
  .max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.'));

/** An in-app link path such as `/buyer/tenders/3`. Never an absolute URL. */
export const LinkPath = z
  .string()
  .regex(/^\/[A-Za-z0-9\-._~/%?=&:]*$/, issue('INVALID_LINK', 'Must be an in-app path starting with /.'));
export type LinkPath = z.infer<typeof LinkPath>;

/** Any JSON value (audit before/after snapshots, report filter configs). */
export const JsonObject = z.record(z.string(), z.json());
export type JsonObject = z.infer<typeof JsonObject>;
