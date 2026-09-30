/**
 * The single API client (brief §10, architecture-plan §3.10, docs/technical/09-frontend.md §10).
 *
 * `call(endpoint, { params, query, body }, options?)` builds the URL from the contract path under the relative base
 * `/api/v1`, and for every request:
 * - reads the access token PER REQUEST from the supabase-js session and sends `Authorization: Bearer` (not on
 *   public endpoints);
 * - sends `X-Tenant-Id` according to the contract: the active tenant for buyer, supplier and ops endpoints, the
 *   ROW's tenant (`options.tenantId`) for `me` row actions, nothing for `me` reads and public endpoints (DD-21);
 * - sends an `Idempotency-Key` on idempotent commands (DD-39), generated unless the caller passes one;
 * - normalizes problem+json into `ApiError` (`status`, `title`, `code`, `fieldErrors`, `correlationId`);
 * - on 401 signs the user out (through the adapter installed by AuthProvider) and rejects;
 * - in development builds parses the body with the contract's response schema, so drift between the UI, the mock API
 *   and the backend fails loudly.
 *
 * The client never imports supabase-js or the store: AuthProvider installs the adapters (`configureApiClient`).
 */
import { PROBLEM_CONTENT_TYPE, Problem } from '@contracts/common';
import type { FieldError } from '@contracts/common';
import { buildPath, buildQuery, tenantHeaderMode } from '@contracts/endpoint';
import type {
  AnyEndpoint,
  EndpointRequest,
  EndpointResponse,
  PathParamValue,
  QueryValue,
} from '@contracts/endpoint';

/** Hooks the client needs from the auth layer and the store. */
export interface ApiClientAdapters {
  /** The current access token, read per request (supabase-js refreshes it). `null` when signed out. */
  getAccessToken(): Promise<string | null>;
  /** The active tenant id from the session slice, or `null`. */
  getActiveTenantId(): number | null;
  /** Called once per 401 response: signs the user out. */
  onUnauthorized(): void;
}

const signedOutAdapters: ApiClientAdapters = {
  getAccessToken: () => Promise.resolve(null),
  getActiveTenantId: () => null,
  onUnauthorized: () => undefined,
};

let adapters: ApiClientAdapters = signedOutAdapters;

/** Installs the adapters (AuthProvider does this once). Returns a function restoring the previous ones. */
export function configureApiClient(next: ApiClientAdapters): () => void {
  const previous = adapters;
  adapters = next;
  return () => {
    adapters = previous;
  };
}

/** What went wrong, for rendering (restricted state, form errors, retry, sign-in). */
export type ApiErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'rate_limited'
  | 'server'
  | 'network'
  | 'contract'
  | 'tenant_required';

function kindOfStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 422 || status === 400) return 'validation';
  if (status === 409 || status === 412) return 'conflict';
  if (status === 429) return 'rate_limited';
  return 'server';
}

/** A failed call: the normalized problem+json (`{ status, title, fieldErrors }`, brief §10). */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly title: string;
  readonly code: string | null;
  readonly detail: string | null;
  readonly fieldErrors: readonly FieldError[];
  readonly correlationId: string | null;
  readonly endpointId: string;

  constructor(init: {
    kind: ApiErrorKind;
    status: number;
    title: string;
    code?: string | null;
    detail?: string | null;
    fieldErrors?: readonly FieldError[];
    correlationId?: string | null;
    endpointId: string;
  }) {
    super(init.detail ?? init.title);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.title = init.title;
    this.code = init.code ?? null;
    this.detail = init.detail ?? null;
    this.fieldErrors = init.fieldErrors ?? [];
    this.correlationId = init.correlationId ?? null;
    this.endpointId = init.endpointId;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** Options of one call. */
export interface CallOptions {
  /** For `me` row actions (DD-21): the tenant of the row being acted on. Required by those endpoints. */
  readonly tenantId?: number;
  /** For idempotent commands: reuse a key when retrying the same user action. Generated when omitted. */
  readonly idempotencyKey?: string;
  readonly signal?: AbortSignal;
}

/** The base every contract path already starts with; kept for documentation and tests. */
export const API_BASE_URL = '/api/v1';

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function resolveTenantHeader(
  endpoint: AnyEndpoint,
  options: CallOptions | undefined,
): string | null {
  const mode = tenantHeaderMode(endpoint);
  if (mode === 'none') {
    return null;
  }
  const tenantId = mode === 'row' ? options?.tenantId : adapters.getActiveTenantId();
  if (tenantId === undefined || tenantId === null) {
    throw new ApiError({
      kind: 'tenant_required',
      status: 0,
      title:
        mode === 'row'
          ? 'This action needs the organization of the row it acts on.'
          : 'Select an organization first.',
      endpointId: endpoint.id,
    });
  }
  return String(tenantId);
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === '') {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function problemError(endpoint: AnyEndpoint, response: Response, payload: unknown): ApiError {
  const parsed = Problem.safeParse(payload);
  const correlationHeader = response.headers.get('x-correlation-id');
  if (parsed.success) {
    const problem = parsed.data;
    return new ApiError({
      kind: kindOfStatus(problem.status),
      status: problem.status,
      title: problem.title,
      code: problem.code ?? null,
      detail: problem.detail ?? null,
      fieldErrors: problem.errors ?? [],
      correlationId: problem.correlationId,
      endpointId: endpoint.id,
    });
  }
  return new ApiError({
    kind: kindOfStatus(response.status),
    status: response.status,
    title: response.statusText || `HTTP ${response.status}`,
    correlationId: correlationHeader,
    endpointId: endpoint.id,
  });
}

/**
 * Calls a contract endpoint and resolves its typed response (`null` for 204).
 * Throws `ApiError` for every failure, including network errors.
 */
export async function call<E extends AnyEndpoint>(
  endpoint: E,
  request: EndpointRequest<E>,
  options?: CallOptions,
): Promise<EndpointResponse<E>> {
  const { params, query, body } = request as {
    params?: Readonly<Record<string, PathParamValue>>;
    query?: Readonly<Record<string, QueryValue>>;
    body?: unknown;
  };
  const url = `${buildPath(endpoint.path, params ?? {})}${buildQuery(query)}`;
  const headers: Record<string, string> = { Accept: `application/json, ${PROBLEM_CONTENT_TYPE}` };

  const tenantHeader = resolveTenantHeader(endpoint, options);
  if (tenantHeader !== null) {
    headers['X-Tenant-Id'] = tenantHeader;
  }
  if (endpoint.audience !== 'public') {
    const token = await adapters.getAccessToken();
    if (token !== null) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  if (endpoint.idempotent === true) {
    headers['Idempotency-Key'] = options?.idempotencyKey ?? newIdempotencyKey();
  }
  let payload: string | undefined;
  if (body !== undefined && endpoint.method !== 'GET' && endpoint.method !== 'DELETE') {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: endpoint.method,
      headers,
      body: payload,
      credentials: 'same-origin',
      signal: options?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError({
      kind: 'network',
      status: 0,
      title: 'The service could not be reached.',
      endpointId: endpoint.id,
    });
  }

  if (!response.ok) {
    const problem = problemError(endpoint, response, await readJson(response));
    if (problem.status === 401) {
      adapters.onUnauthorized();
    }
    throw problem;
  }
  if (response.status === 204) {
    return null as EndpointResponse<E>;
  }
  const data = await readJson(response);
  if (import.meta.env.DEV) {
    const checked = endpoint.response.safeParse(data);
    if (!checked.success) {
      console.error(
        `API contract drift: the response of ${endpoint.id} does not match its contract schema.`,
        checked.error.issues,
      );
      throw new ApiError({
        kind: 'contract',
        status: response.status,
        title: 'The response did not match the API contract.',
        detail: checked.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('; '),
        correlationId: response.headers.get('x-correlation-id'),
        endpointId: endpoint.id,
      });
    }
    return checked.data as EndpointResponse<E>;
  }
  return data as EndpointResponse<E>;
}

/** The field errors of one input (`field` is the issue path, for example `amount.currency`). */
export function fieldErrorsFor(error: unknown, field: string): FieldError[] {
  if (!isApiError(error)) {
    return [];
  }
  return error.fieldErrors.filter(
    (item) => item.field === field || item.field.startsWith(`${field}.`),
  );
}
