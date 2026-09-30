/**
 * `defineEndpoint` and the typed helpers built on it (architecture-plan §3.10; docs/technical/07-api.md §9.3).
 *
 * An endpoint contract fixes, for both stages: the stable `id`, HTTP `method`, `path` under `/api/v1` with its
 * audience prefix, the `audience`, the required `permission`, zod schemas for `params`, `query`, `body` and the
 * success `response`, the success `status`, the declared business `errors` (UPPER_SNAKE codes), the PRD
 * `screens` that call it and whether it is an `idempotent` command that accepts an `Idempotency-Key` header
 * (DD-39).
 *
 * Tenant context (docs/technical/07-api.md §2.2, §3.1; DD-21):
 * - `public` and `me` reads send no `X-Tenant-Id`.
 * - `buyer`, `supplier` and `ops` send the ACTIVE tenant; its kind must match the audience.
 * - A `me` endpoint marked `rowTenant: true` acts on a row listed under `/me/*` and sends `X-Tenant-Id` equal to
 *   that ROW's tenant. Its `permission`, if any, is checked in the row's tenant.
 *
 * Permissions: `permission` is one code, or a non-empty list meaning "any of these" for shared widgets whose
 * rows belong to several domains (for example the approval panel on requests, tenders and contracts). The
 * domain service then applies the subject-specific check. Use `endpointPermissions()` / `isPermitted()`.
 *
 * `defineEndpoint` validates the definition when the module loads and throws on a malformed contract, so a
 * broken contract fails every test that imports it.
 */
import type { z } from 'zod';

import { AUDIENCES, ERROR_CODE_PATTERN } from './common.js';
import type { Audience } from './common.js';
import { isPermissionCode, permissionTenantKind } from './permissions.js';
import type { PermissionCode } from './permissions.js';

/** HTTP methods used by the API. */
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/** Success status codes an endpoint may declare. */
export const SUCCESS_STATUSES = [200, 201, 202, 204] as const;
export type SuccessStatus = (typeof SUCCESS_STATUSES)[number];

/** Every contract path starts with one of these. */
export const API_BASE = '/api/v1';
/** The public health check, the one path outside the audience prefixes. */
export const HEALTH_PATH = '/api/v1/health';

/** PRD screen id such as `COM-05`, `SUP-16`, `BUY-01`. */
export const SCREEN_ID_PATTERN = /^(COM|PUB|SUP|BUY|EVA|CON|ADM|OPS|REP)-\d{2}$/;
/** Endpoint id such as `approvals.decide` or `me.tasks.list`. */
export const ENDPOINT_ID_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;

/** One permission code, or a non-empty list meaning "any of these". */
export type EndpointPermission = PermissionCode | readonly [PermissionCode, ...PermissionCode[]];

/** The names of the `:param` segments of a path template. */
export type PathParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | PathParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

type AnySchema = z.ZodType;

/** The definition passed to `defineEndpoint`. */
export interface EndpointDefinition<
  Path extends string = string,
  Params extends AnySchema | undefined = AnySchema | undefined,
  Query extends AnySchema | undefined = AnySchema | undefined,
  Body extends AnySchema | undefined = AnySchema | undefined,
  Response extends AnySchema = AnySchema,
> {
  /** Stable identifier, unique across the catalog, for example `me.approvals.decide`. */
  readonly id: string;
  readonly method: HttpMethod;
  /** Path template under `/api/v1/<audience>/…` with `:name` parameters. */
  readonly path: Path;
  readonly audience: Audience;
  /** Required permission (see the module comment). Omitted only on `public` endpoints and plain `me` endpoints. */
  readonly permission?: EndpointPermission;
  /** Path parameters; required exactly when the path has `:name` segments, with the same keys. */
  readonly params?: Params;
  readonly query?: Query;
  readonly body?: Body;
  /** Success body schema. For a 204 use `z.null()`: the client resolves `null`. */
  readonly response: Response;
  /** Success status. Default: 200 (201 for an idempotent POST that creates a record). */
  readonly status?: SuccessStatus;
  /** Declared business error codes (UPPER_SNAKE). Platform codes (401/403/404/422/500) are implicit. */
  readonly errors: readonly string[];
  /** PRD screen ids that call this endpoint (at least one). */
  readonly screens: readonly [string, ...string[]];
  /** A command that creates records and accepts an optional `Idempotency-Key` header (DD-39). */
  readonly idempotent?: boolean;
  /** A `me` action on a listed row: `X-Tenant-Id` must equal the row's tenant (DD-21). */
  readonly rowTenant?: boolean;
  /** Short human description for the OpenAPI document. */
  readonly summary?: string;
}

/** A defined endpoint: the definition with its resolved success status and path parameter names. */
export type Endpoint<
  Path extends string = string,
  Params extends AnySchema | undefined = AnySchema | undefined,
  Query extends AnySchema | undefined = AnySchema | undefined,
  Body extends AnySchema | undefined = AnySchema | undefined,
  Response extends AnySchema = AnySchema,
> = EndpointDefinition<Path, Params, Query, Body, Response> & {
  readonly status: SuccessStatus;
  readonly pathParams: readonly string[];
};

/** Any endpoint, for registries and middleware. */
export type AnyEndpoint = Endpoint<string, AnySchema | undefined, AnySchema | undefined, AnySchema | undefined, AnySchema>;

const PARAM_SEGMENT = /:([A-Za-z][A-Za-z0-9]*)/g;

/** The `:name` parameters of a path template, in order. */
export function pathParamNames(path: string): string[] {
  return [...path.matchAll(PARAM_SEGMENT)].map((match) => match[1] ?? '');
}

/** The audience a path belongs to by its prefix, or `null` when the prefix is not an audience. */
export function audienceOfPath(path: string): Audience | null {
  if (path === HEALTH_PATH) {
    return 'public';
  }
  for (const audience of AUDIENCES) {
    if (path === `${API_BASE}/${audience}` || path.startsWith(`${API_BASE}/${audience}/`)) {
      return audience;
    }
  }
  return null;
}

function shapeKeys(schema: AnySchema | undefined): string[] | null {
  if (schema === undefined) {
    return [];
  }
  const candidate: unknown = (schema as { shape?: unknown }).shape;
  if (candidate !== null && typeof candidate === 'object') {
    return Object.keys(candidate);
  }
  return null;
}

/** The permission codes of an endpoint (empty when it declares none). */
export function endpointPermissions(endpoint: Pick<EndpointDefinition, 'permission'>): readonly PermissionCode[] {
  const { permission } = endpoint;
  if (permission === undefined) {
    return [];
  }
  return typeof permission === 'string' ? [permission] : permission;
}

/** True when a caller holding `granted` may call the endpoint (no permission declared = allowed). */
export function isPermitted(
  endpoint: Pick<EndpointDefinition, 'permission'>,
  granted: Iterable<string> | ReadonlySet<string>,
): boolean {
  const required = endpointPermissions(endpoint);
  if (required.length === 0) {
    return true;
  }
  const held = granted instanceof Set ? (granted as ReadonlySet<string>) : new Set(granted);
  return required.some((code) => held.has(code));
}

/** How the client supplies `X-Tenant-Id` for an endpoint. */
export type TenantHeaderMode = 'none' | 'active' | 'row';

/** `none` for public and `me` reads, `active` for buyer/supplier/ops, `row` for `me` row actions (DD-21). */
export function tenantHeaderMode(endpoint: Pick<EndpointDefinition, 'audience' | 'rowTenant'>): TenantHeaderMode {
  if (endpoint.audience === 'public') {
    return 'none';
  }
  if (endpoint.audience === 'me') {
    return endpoint.rowTenant === true ? 'row' : 'none';
  }
  return 'active';
}

/** Collects every problem of a definition (empty = valid). Exported for tests and the catalog check. */
export function validateEndpointDefinition(definition: EndpointDefinition): string[] {
  const problems: string[] = [];
  const { id, method, path, audience } = definition;
  if (!ENDPOINT_ID_PATTERN.test(id)) {
    problems.push(`id "${id}" must be dot-separated camelCase segments such as "me.tasks.list"`);
  }
  if (!(HTTP_METHODS as readonly string[]).includes(method)) {
    problems.push(`method "${method}" is not one of ${HTTP_METHODS.join(', ')}`);
  }
  if (!path.startsWith(`${API_BASE}/`) || /\/\/|\/$/.test(path) || !/^[A-Za-z0-9/:_-]+$/.test(path)) {
    problems.push(`path "${path}" must be a clean path under ${API_BASE}/`);
  }
  const pathAudience = audienceOfPath(path);
  if (pathAudience === null) {
    problems.push(`path "${path}" must start with ${API_BASE}/{${AUDIENCES.join('|')}} or be ${HEALTH_PATH}`);
  } else if (pathAudience !== audience) {
    problems.push(`audience "${audience}" does not match the path prefix "${pathAudience}"`);
  }
  if (path === HEALTH_PATH && method !== 'GET') {
    problems.push('the health check is GET only');
  }

  const permissions = definition.permission === undefined ? [] : endpointPermissions(definition);
  if (definition.permission !== undefined && permissions.length === 0) {
    problems.push('permission lists must not be empty');
  }
  for (const code of permissions) {
    if (!isPermissionCode(code)) {
      problems.push(`permission "${code}" is not in the catalog (permissions.ts)`);
      continue;
    }
    const kind = permissionTenantKind(code);
    const expected = audience === 'buyer' ? 'buyer' : audience === 'supplier' ? 'supplier' : audience === 'ops' ? 'operator' : null;
    if (expected !== null && kind !== expected && kind !== 'any') {
      problems.push(`permission "${code}" is a ${kind} permission but the audience is "${audience}"`);
    }
  }
  if (audience === 'public' && permissions.length > 0) {
    problems.push('public endpoints cannot require a permission');
  }
  if ((audience === 'buyer' || audience === 'supplier' || audience === 'ops') && permissions.length === 0) {
    problems.push(`${audience} endpoints must declare a permission`);
  }
  if (audience === 'me' && permissions.length > 0 && definition.rowTenant !== true) {
    problems.push('a me endpoint can only require a permission when it acts on a row tenant (rowTenant: true)');
  }
  if (definition.rowTenant === true && audience !== 'me') {
    problems.push('rowTenant applies only to me endpoints');
  }
  if (definition.rowTenant === true && method === 'GET') {
    problems.push('rowTenant marks actions; me reads need no X-Tenant-Id (DD-21)');
  }

  const names = pathParamNames(path);
  if (new Set(names).size !== names.length) {
    problems.push(`path "${path}" repeats a parameter name`);
  }
  const keys = shapeKeys(definition.params);
  if (names.length > 0 && definition.params === undefined) {
    problems.push(`path "${path}" has parameters but no params schema`);
  }
  if (names.length === 0 && definition.params !== undefined) {
    problems.push(`path "${path}" has no parameters but declares a params schema`);
  }
  if (keys !== null && definition.params !== undefined) {
    const missing = names.filter((name) => !keys.includes(name));
    const extra = keys.filter((key) => !names.includes(key));
    if (missing.length > 0 || extra.length > 0) {
      problems.push(`params keys [${keys.join(', ')}] must equal the path parameters [${names.join(', ')}]`);
    }
  }
  if ((method === 'GET' || method === 'DELETE') && definition.body !== undefined) {
    problems.push(`${method} endpoints cannot declare a body`);
  }
  if (definition.idempotent === true && method !== 'POST' && method !== 'PUT') {
    problems.push('only POST or PUT commands can be idempotent');
  }
  if (definition.screens.length === 0) {
    problems.push('at least one screen id is required');
  }
  for (const screen of definition.screens) {
    if (!SCREEN_ID_PATTERN.test(screen)) {
      problems.push(`screen "${screen}" is not a PRD screen id such as COM-05`);
    }
  }
  for (const code of definition.errors) {
    if (!ERROR_CODE_PATTERN.test(code)) {
      problems.push(`error code "${code}" must be UPPER_SNAKE`);
    }
  }
  if (new Set(definition.errors).size !== definition.errors.length) {
    problems.push('error codes must be unique');
  }
  return problems;
}

/**
 * Defines an endpoint contract. Throws when the definition is malformed (see `validateEndpointDefinition`).
 * The literal path type is kept, so `buildPath` checks parameter names at compile time.
 */
export function defineEndpoint<
  const Path extends string,
  Params extends AnySchema | undefined = undefined,
  Query extends AnySchema | undefined = undefined,
  Body extends AnySchema | undefined = undefined,
  Response extends AnySchema = AnySchema,
>(
  definition: EndpointDefinition<Path, Params, Query, Body, Response>,
): Endpoint<Path, Params, Query, Body, Response> {
  const problems = validateEndpointDefinition(definition);
  if (problems.length > 0) {
    throw new Error(`Invalid endpoint contract "${definition.id}": ${problems.join('; ')}.`);
  }
  const status: SuccessStatus =
    definition.status ?? (definition.method === 'POST' && definition.idempotent === true ? 201 : 200);
  return { ...definition, status, pathParams: pathParamNames(definition.path) };
}

// ---------------------------------------------------------------------------------------------------------
// Inferred request/response types
// ---------------------------------------------------------------------------------------------------------

type InputOf<S> = S extends AnySchema ? z.input<S> : undefined;
type OutputOf<S> = S extends AnySchema ? z.output<S> : undefined;

/** Path parameters the client supplies (input side of the params schema). */
export type EndpointParams<E> = E extends Endpoint<string, infer P, AnySchema | undefined, AnySchema | undefined, AnySchema>
  ? InputOf<P>
  : never;
/** Query the client supplies. */
export type EndpointQuery<E> = E extends Endpoint<string, AnySchema | undefined, infer Q, AnySchema | undefined, AnySchema>
  ? InputOf<Q>
  : never;
/** Body the client sends. */
export type EndpointBody<E> = E extends Endpoint<string, AnySchema | undefined, AnySchema | undefined, infer B, AnySchema>
  ? InputOf<B>
  : never;
/** Parsed path parameters the server receives. */
export type EndpointParsedParams<E> = E extends Endpoint<string, infer P, AnySchema | undefined, AnySchema | undefined, AnySchema>
  ? OutputOf<P>
  : never;
/** Parsed query the server receives. */
export type EndpointParsedQuery<E> = E extends Endpoint<string, AnySchema | undefined, infer Q, AnySchema | undefined, AnySchema>
  ? OutputOf<Q>
  : never;
/** Parsed body the server receives. */
export type EndpointParsedBody<E> = E extends Endpoint<string, AnySchema | undefined, AnySchema | undefined, infer B, AnySchema>
  ? OutputOf<B>
  : never;
/** Success body the client receives. */
export type EndpointResponse<E> = E extends Endpoint<string, AnySchema | undefined, AnySchema | undefined, AnySchema | undefined, infer R>
  ? z.output<R>
  : never;

type OptionalKey<K extends string, V> = [V] extends [undefined] ? { readonly [P in K]?: undefined } : { readonly [P in K]: V };

/**
 * The arguments of a call: `{ params, query, body }`, each required exactly when the endpoint declares it.
 * A query whose fields are all optional may still be omitted by passing `{}`.
 */
export type EndpointRequest<E> = OptionalKey<'params', EndpointParams<E>> &
  OptionalKey<'query', EndpointQuery<E>> &
  OptionalKey<'body', EndpointBody<E>>;

// ---------------------------------------------------------------------------------------------------------
// Path and query builders
// ---------------------------------------------------------------------------------------------------------

/** Values accepted in a path segment. */
export type PathParamValue = string | number;

/** Fills a path template: `buildPath('/api/v1/me/tasks/:taskId', { taskId: 7 })` → `/api/v1/me/tasks/7`. */
export function buildPath<const P extends string>(
  path: P,
  params: { readonly [K in PathParamNames<P>]: PathParamValue },
): string;
export function buildPath(path: string, params: Readonly<Record<string, PathParamValue>>): string;
export function buildPath(path: string, params: Readonly<Record<string, PathParamValue>>): string {
  return path.replace(PARAM_SEGMENT, (_segment: string, name: string) => {
    const value = params[name];
    if (value === undefined || value === '') {
      throw new Error(`Missing path parameter "${name}" for ${path}.`);
    }
    return encodeURIComponent(String(value));
  });
}

/** Values accepted in a query string. Arrays repeat the key; `undefined` and `null` are skipped. */
export type QueryValue = string | number | boolean | null | undefined | ReadonlyArray<string | number | boolean>;

/**
 * Serializes a query object: `buildQuery({ q: 'pump', status: ['open', 'closed'], page: 2 })` →
 * `?q=pump&status=open&status=closed&page=2`. Keys are emitted in insertion order; empty result → `''`.
 */
export function buildQuery(query: Readonly<Record<string, QueryValue>> | undefined): string {
  if (query === undefined) {
    return '';
  }
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    const values = Array.isArray(value) ? (value as ReadonlyArray<string | number | boolean>) : [value as string | number | boolean];
    for (const item of values) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
    }
  }
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

/** The full request URL of an endpoint: filled path plus query string. */
export function buildUrl(
  endpoint: Pick<EndpointDefinition, 'path'>,
  params: Readonly<Record<string, PathParamValue>> = {},
  query?: Readonly<Record<string, QueryValue>>,
): string {
  return `${buildPath(endpoint.path, params)}${buildQuery(query)}`;
}

/** Matches a concrete URL path against an endpoint's template and returns the raw parameters, or `null`. */
export function matchPath(template: string, actual: string): Record<string, string> | null {
  const templateParts = template.split('/');
  const actualParts = actual.split('/');
  if (templateParts.length !== actualParts.length) {
    return null;
  }
  const params: Record<string, string> = {};
  for (let index = 0; index < templateParts.length; index += 1) {
    const expected = templateParts[index] ?? '';
    const got = actualParts[index] ?? '';
    if (expected.startsWith(':')) {
      if (got === '') {
        return null;
      }
      try {
        params[expected.slice(1)] = decodeURIComponent(got);
      } catch {
        return null;
      }
    } else if (expected !== got) {
      return null;
    }
  }
  return params;
}
