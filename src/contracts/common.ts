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

/** Splits a `"CODE|message"` zod message; a message without a code gets `INVALID`. */
export function splitIssueMessage(raw: string): { code: string; message: string } {
  const bar = raw.indexOf('|');
  if (bar <= 0) {
    return { code: 'INVALID', message: raw };
  }
  return { code: raw.slice(0, bar), message: raw.slice(bar + 1) };
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
 * endpoint in `errors` (UPPER_SNAKE) and mapped to statuses by the domain in Stage B.
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
export const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

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
