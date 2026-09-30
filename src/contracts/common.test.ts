import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  AUDIENCE_TENANT_KIND,
  CalendarDate,
  CurrencyCode,
  DEFAULT_PAGE_SIZE,
  DecimalString,
  FieldError,
  Id,
  IdParam,
  Instant,
  ListQuery,
  MAX_PAGE_SIZE,
  Money,
  NonNegativeMoney,
  OfficialDeadline,
  OrganizationLabel,
  PLATFORM_ERRORS,
  Problem,
  QueryBoolean,
  ReasonText,
  Reference,
  Slug,
  TimeZone,
  issue,
  listQueryWithSort,
  pageOf,
  paginate,
  queryList,
  splitIssueMessage,
  toTenantId,
} from './common.js';

/** The `code` of the first issue of a failed parse. */
function firstCode(schema: z.ZodType, value: unknown): string | undefined {
  const result = schema.safeParse(value);
  if (result.success) {
    return undefined;
  }
  const message = result.error.issues[0]?.message ?? '';
  return splitIssueMessage(message).code;
}

describe('CODE|message convention', () => {
  it('builds and splits a coded message', () => {
    const message = issue('REASON_REQUIRED', 'A reason is required.');
    expect(message).toBe('REASON_REQUIRED|A reason is required.');
    expect(splitIssueMessage(message)).toEqual({ code: 'REASON_REQUIRED', message: 'A reason is required.' });
  });

  it('keeps a bar inside the message part', () => {
    expect(splitIssueMessage('X|a|b')).toEqual({ code: 'X', message: 'a|b' });
  });

  it('falls back to INVALID for a message without a code', () => {
    expect(splitIssueMessage('plain')).toEqual({ code: 'INVALID', message: 'plain' });
  });
});

describe('identifiers', () => {
  it('accepts positive safe integers only', () => {
    expect(Id.parse(7)).toBe(7);
    expect(firstCode(Id, 0)).toBe('INVALID_ID');
    expect(firstCode(Id, -1)).toBe('INVALID_ID');
    expect(firstCode(Id, 1.5)).toBe('INVALID_ID');
    expect(firstCode(Id, '7')).toBe('INVALID_ID');
  });

  it('parses ids from path and query strings', () => {
    expect(IdParam.parse('42')).toBe(42);
    expect(IdParam.parse(42)).toBe(42);
    expect(IdParam.safeParse('042').success).toBe(false);
    expect(IdParam.safeParse('abc').success).toBe(false);
    expect(IdParam.safeParse('0').success).toBe(false);
  });

  it('constructs branded tenant ids only from valid numbers', () => {
    expect(toTenantId(3)).toBe(3);
    expect(() => toTenantId(0)).toThrow(TypeError);
    expect(() => toTenantId(2.5)).toThrow(TypeError);
  });

  it('validates references and slugs', () => {
    for (const ref of ['T-2026-0003', 'PR-2026-0001', 'RCPT-2026-000001', 'CMP-2026-0001', 'CR-0001']) {
      expect(Reference.safeParse(ref).success, ref).toBe(true);
    }
    expect(Reference.safeParse('t-2026-0003').success).toBe(false);
    expect(Slug.safeParse('chobe-pipe').success).toBe(true);
    expect(Slug.safeParse('Chobe Pipe').success).toBe(false);
    expect(Slug.safeParse('-kwu').success).toBe(false);
  });
});

describe('money and decimals (DD-32)', () => {
  it('accepts decimal strings and refuses numbers', () => {
    expect(DecimalString.parse('1500000.00')).toBe('1500000.00');
    expect(firstCode(DecimalString, 1500000)).toBe('INVALID_DECIMAL');
    expect(firstCode(DecimalString, '1,500,000')).toBe('INVALID_DECIMAL');
    expect(firstCode(DecimalString, '1e6')).toBe('INVALID_DECIMAL');
  });

  it('requires a three-letter currency with every amount', () => {
    expect(Money.parse({ amount: '120000.00', currency: 'BWP' })).toEqual({ amount: '120000.00', currency: 'BWP' });
    expect(Money.safeParse({ amount: '120000.00' }).success).toBe(false);
    expect(firstCode(CurrencyCode, 'bwp')).toBe('INVALID_CURRENCY');
    expect(firstCode(CurrencyCode, 'BWPX')).toBe('INVALID_CURRENCY');
  });

  it('allows a negative Money but not a negative NonNegativeMoney', () => {
    expect(Money.safeParse({ amount: '-5.00', currency: 'BWP' }).success).toBe(true);
    expect(NonNegativeMoney.safeParse({ amount: '-5.00', currency: 'BWP' }).success).toBe(false);
  });
});

describe('time (BR-11, DD-33)', () => {
  it('accepts ISO 8601 UTC instants with a Z suffix', () => {
    expect(Instant.parse('2026-10-14T10:00:00Z')).toBe('2026-10-14T10:00:00Z');
    expect(Instant.safeParse('2026-10-14T10:00:00.123Z').success).toBe(true);
  });

  it('rejects offsets, local times and dates as instants', () => {
    expect(firstCode(Instant, '2026-10-14T12:00:00+02:00')).toBe('INVALID_INSTANT');
    expect(firstCode(Instant, '2026-10-14T10:00:00')).toBe('INVALID_INSTANT');
    expect(firstCode(Instant, '2026-10-14')).toBe('INVALID_INSTANT');
  });

  it('accepts calendar dates only as YYYY-MM-DD', () => {
    expect(CalendarDate.parse('2026-12-25')).toBe('2026-12-25');
    expect(firstCode(CalendarDate, '25/12/2026')).toBe('INVALID_DATE');
    expect(firstCode(CalendarDate, '2026-02-30')).toBe('INVALID_DATE');
  });

  it('accepts IANA time zones and rejects offsets and unknown names', () => {
    expect(TimeZone.parse('Africa/Gaborone')).toBe('Africa/Gaborone');
    expect(TimeZone.parse('UTC')).toBe('UTC');
    expect(TimeZone.safeParse('America/Argentina/Buenos_Aires').success).toBe(true);
    expect(firstCode(TimeZone, '+02:00')).toBe('INVALID_TIME_ZONE');
    expect(firstCode(TimeZone, 'Mars/Olympus')).toBe('INVALID_TIME_ZONE');
  });

  it('carries an official deadline with its official time zone', () => {
    const deadline = { at: '2026-10-14T10:00:00Z', timeZone: 'Africa/Gaborone' };
    expect(OfficialDeadline.parse(deadline)).toEqual(deadline);
    expect(OfficialDeadline.safeParse({ at: '2026-10-14T10:00:00Z' }).success).toBe(false);
  });
});

describe('list query and pages', () => {
  it('applies defaults when the query is empty', () => {
    expect(ListQuery.parse({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, dir: 'asc' });
  });

  it('parses query-string values', () => {
    expect(ListQuery.parse({ q: ' pump ', page: '3', pageSize: '50', sort: 'dueAt', dir: 'desc' })).toEqual({
      q: 'pump',
      page: 3,
      pageSize: 50,
      sort: 'dueAt',
      dir: 'desc',
    });
  });

  it('rejects out-of-range pages and page sizes with coded errors', () => {
    expect(firstCode(ListQuery, { page: '0' })).toBe('INVALID_PAGE');
    expect(firstCode(ListQuery, { pageSize: String(MAX_PAGE_SIZE + 1) })).toBe('INVALID_PAGE_SIZE');
    expect(firstCode(ListQuery, { pageSize: 'ten' })).toBe('INVALID_PAGE_SIZE');
    expect(firstCode(ListQuery, { sort: 'drop table' })).toBe('INVALID_SORT');
  });

  it('restricts sort to declared fields', () => {
    const query = listQueryWithSort(['dueAt', 'title']);
    expect(query.parse({ sort: 'title' }).sort).toBe('title');
    expect(firstCode(query, { sort: 'priority' })).toBe('INVALID_SORT');
  });

  it('accepts one or many values for list filters', () => {
    const schema = z.object({ status: queryList(z.enum(['open', 'closed'])).optional() });
    expect(schema.parse({ status: 'open' })).toEqual({ status: ['open'] });
    expect(schema.parse({ status: ['open', 'closed'] })).toEqual({ status: ['open', 'closed'] });
    expect(schema.safeParse({ status: 'archived' }).success).toBe(false);
  });

  it('parses booleans from query strings', () => {
    expect(QueryBoolean.parse('true')).toBe(true);
    expect(QueryBoolean.parse('false')).toBe(false);
    expect(QueryBoolean.parse(true)).toBe(true);
    expect(QueryBoolean.safeParse('yes').success).toBe(false);
  });

  it('builds Page<T> schemas and paginates arrays', () => {
    const page = pageOf(z.object({ id: Id }));
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const second = paginate(rows, 2, 2);
    expect(second).toEqual({ items: [{ id: 3 }], total: 3, page: 2, pageSize: 2 });
    expect(page.parse(second)).toEqual(second);
    expect(page.safeParse({ items: [], total: -1, page: 1, pageSize: 25 }).success).toBe(false);
  });
});

describe('problem+json', () => {
  it('validates a 422 problem with field errors and a correlation id', () => {
    const problem = {
      type: 'about:blank',
      title: 'Validation failed',
      status: 422,
      code: 'VALIDATION_FAILED',
      errors: [{ field: 'reason', code: 'REASON_REQUIRED', message: 'A reason is required.' }],
      correlationId: 'c0ffee',
    };
    expect(Problem.parse(problem)).toEqual(problem);
    expect(FieldError.safeParse({ field: 'x', code: 'Y' }).success).toBe(false);
  });

  it('requires a correlation id and an error status', () => {
    expect(Problem.safeParse({ type: 't', title: 't', status: 422 }).success).toBe(false);
    expect(Problem.safeParse({ type: 't', title: 't', status: 200, correlationId: 'c' }).success).toBe(false);
  });

  it('maps the platform error codes to their statuses', () => {
    expect(PLATFORM_ERRORS.UNAUTHENTICATED).toBe(401);
    expect(PLATFORM_ERRORS.TENANT_ACCESS_DENIED).toBe(403);
    expect(PLATFORM_ERRORS.VALIDATION_FAILED).toBe(422);
  });
});

describe('audiences and labels', () => {
  it('maps each audience to the tenant kind it requires', () => {
    expect(AUDIENCE_TENANT_KIND).toEqual({
      public: null,
      me: null,
      buyer: 'buyer',
      supplier: 'supplier',
      ops: 'operator',
    });
  });

  it('labels /me rows with their organization (DD-21)', () => {
    expect(
      OrganizationLabel.parse({ tenantId: 2, tenantName: 'Kalahari Water Utilities (Pilot)', tenantKind: 'buyer' }),
    ).toEqual({ tenantId: 2, tenantName: 'Kalahari Water Utilities (Pilot)', tenantKind: 'buyer' });
    expect(OrganizationLabel.safeParse({ tenantId: 2, tenantName: 'X', tenantKind: 'public' }).success).toBe(false);
  });

  it('requires a non-blank reason', () => {
    expect(firstCode(ReasonText, '   ')).toBe('REASON_REQUIRED');
    expect(ReasonText.parse('  Late evidence  ')).toBe('Late evidence');
  });
});
