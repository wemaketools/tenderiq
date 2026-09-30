/**
 * RFC 7807 problem documents of the mock API (brief §5.3; docs/technical/07-api.md §4).
 *
 * - Every error body is `application/problem+json` with `type`, `title`, `status`, optional `detail`, `code`,
 *   `errors[{ field, code, message }]`, and `correlationId` (equal to the `x-correlation-id` header).
 * - `type` is `urn:tenderiq:problem:<code in kebab case>`, for example `urn:tenderiq:problem:validation-failed`.
 * - Every 5xx carries the constant sanitized detail; the real error is logged server-side only.
 * - `MockHttpError` is what handlers throw for declared business errors (`ctx.fail`, `ctx.notFound`).
 * - `TENANT_ACCESS_DENIED_PROBLEM` is the ONE identical 403 of every tenant failure (brief §5.1 step 7).
 */
import type { z } from 'zod';

import { PLATFORM_ERRORS, PROBLEM_CONTENT_TYPE, SANITIZED_SERVER_ERROR_DETAIL, splitIssueMessage } from '../../contracts/common.js';
import type { FieldError, Problem } from '../../contracts/common.js';

/** The problem `type` URI of an error code. */
export function problemType(code: string): string {
  return `urn:tenderiq:problem:${code.toLowerCase().replace(/_/g, '-')}`;
}

/** A problem document without its correlation id (added when the response is written). */
export type ProblemBody = Omit<Problem, 'correlationId'>;

/** Thrown by handlers (and middleware) to answer with a problem document. */
export class MockHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string | undefined;
  readonly fieldErrors: readonly FieldError[] | undefined;
  readonly headers: Readonly<Record<string, string>>;

  constructor(options: {
    status: number;
    code: string;
    title: string;
    detail?: string;
    fieldErrors?: readonly FieldError[];
    headers?: Record<string, string>;
  }) {
    super(`${options.status} ${options.code}`);
    this.name = 'MockHttpError';
    this.status = options.status;
    this.code = options.code;
    this.title = options.title;
    this.detail = options.detail;
    this.fieldErrors = options.fieldErrors;
    this.headers = options.headers ?? {};
  }

  toProblem(): ProblemBody {
    return {
      type: problemType(this.code),
      title: this.title,
      status: this.status,
      ...(this.detail === undefined ? {} : { detail: this.detail }),
      code: this.code,
      ...(this.fieldErrors === undefined ? {} : { errors: [...this.fieldErrors] }),
    };
  }
}

/** Builds the JSON response of a problem. */
export function problemResponse(
  problem: ProblemBody,
  correlationId: string,
  headers: Readonly<Record<string, string>> = {},
): Response {
  const body: Problem = { ...problem, correlationId };
  return new Response(JSON.stringify(body), {
    status: problem.status,
    headers: { 'content-type': PROBLEM_CONTENT_TYPE, ...headers },
  });
}

/** 401: no, invalid or expired token, or an account with no active persona. One body for every reason. */
export function unauthenticatedError(): MockHttpError {
  return new MockHttpError({
    status: PLATFORM_ERRORS.UNAUTHENTICATED,
    code: 'UNAUTHENTICATED',
    title: 'Authentication required',
    detail: 'Sign in again to continue.',
    headers: { 'www-authenticate': 'Bearer' },
  });
}

/** The ONE identical 403 of every tenant-context failure. */
export const TENANT_ACCESS_DENIED_PROBLEM: ProblemBody = Object.freeze({
  type: problemType('TENANT_ACCESS_DENIED'),
  title: 'Access denied',
  status: PLATFORM_ERRORS.TENANT_ACCESS_DENIED,
  detail: 'You cannot act in this organization.',
  code: 'TENANT_ACCESS_DENIED',
});

export function tenantAccessDeniedError(): MockHttpError {
  return new MockHttpError({
    status: TENANT_ACCESS_DENIED_PROBLEM.status,
    code: 'TENANT_ACCESS_DENIED',
    title: TENANT_ACCESS_DENIED_PROBLEM.title,
    detail: TENANT_ACCESS_DENIED_PROBLEM.detail ?? '',
  });
}

/** 403: an authenticated user in a valid tenant who lacks the endpoint's permission. */
export function forbiddenError(): MockHttpError {
  return new MockHttpError({
    status: PLATFORM_ERRORS.FORBIDDEN,
    code: 'FORBIDDEN',
    title: 'Permission required',
    detail: 'You do not have permission for this action in this organization.',
  });
}

/** 404: unknown route, or a record the caller cannot see. */
export function notFoundError(code = 'NOT_FOUND', detail = 'The requested resource was not found.'): MockHttpError {
  return new MockHttpError({ status: PLATFORM_ERRORS.NOT_FOUND, code, title: 'Not found', detail });
}

/** Maps zod issues to `{ field, code, message }` with the `"CODE|message"` convention (brief §5.3). */
export function fieldErrorsFromZod(issues: ReadonlyArray<z.ZodError['issues'][number]>, prefix: readonly PropertyKey[] = []): FieldError[] {
  return issues.map((issue) => {
    const { code, message } = splitIssueMessage(issue.message);
    const path = [...prefix, ...issue.path].map((segment) => String(segment));
    return { field: path.join('.'), code, message };
  });
}

/** 422: the request does not satisfy the contract schemas. */
export function validationError(fieldErrors: readonly FieldError[]): MockHttpError {
  return new MockHttpError({
    status: PLATFORM_ERRORS.VALIDATION_FAILED,
    code: 'VALIDATION_FAILED',
    title: 'Validation failed',
    detail: 'The request does not satisfy the contract.',
    fieldErrors,
  });
}

/** The sanitized 500 body (brief §5.3). */
export const INTERNAL_ERROR_PROBLEM: ProblemBody = Object.freeze({
  type: problemType('INTERNAL_ERROR'),
  title: 'Internal server error',
  status: PLATFORM_ERRORS.INTERNAL_ERROR,
  detail: SANITIZED_SERVER_ERROR_DETAIL,
  code: 'INTERNAL_ERROR',
});
