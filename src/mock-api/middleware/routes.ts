/**
 * The mock route table: contract endpoints and their handlers (architecture-plan §3.10, §3.11).
 *
 * Handler modules never touch Hono directly. `register(app)` receives a `MockApp` and calls
 * `mockRoute(app, endpoint, handler)`; the routes are collected first and mounted by `createMockApp` afterwards.
 * That is what lets the registry load every module in isolation: a module whose registration fails is dropped as a
 * whole, and a module that claims a method + path another module already registered is rejected.
 */
import type { z } from 'zod';

import type { Page } from '../../contracts/common.js';
import type {
  AnyEndpoint,
  EndpointParsedBody,
  EndpointParsedParams,
  EndpointParsedQuery,
} from '../../contracts/endpoint.js';
import { matchPath } from '../../contracts/endpoint.js';
import type { AppEnvValue } from '../../server/lib/config/index.js';
import type { FixtureMembership, FixtureTenant, Persona, TenantAccess } from '../persona.js';
import type { OrganizationLabel, PersonRef } from '../../contracts/common.js';
import type { MockLogger } from './logger.js';

/** Read helpers over the platform fixtures, available to every handler. */
export interface FixtureHelpers {
  /** Slices already filtered and sorted rows by the request's `page`/`pageSize` (defaults 1 / 25). */
  page<T>(rows: readonly T[]): Page<T>;
  persona(userId: number): Persona | undefined;
  personRef(userId: number): PersonRef;
  organizationLabel(tenantId: number): OrganizationLabel;
  tenant(tenantId: number): FixtureTenant | undefined;
  tenantBySlug(slug: string): FixtureTenant | undefined;
  /** The caller's active memberships in active tenants (the `/me` scope, DD-21); empty without a persona. */
  activeMemberships(): FixtureMembership[];
}

/** What a handler receives. Everything is already validated against the contract. */
export interface MockHandlerContext<E extends AnyEndpoint> {
  readonly endpoint: E;
  /** The verified caller; `null` only on `public` endpoints. */
  readonly persona: Persona | null;
  /** The validated tenant (`buyer`/`supplier`/`ops`, and `me` row actions); `null` otherwise. */
  readonly tenant: TenantAccess | null;
  readonly params: EndpointParsedParams<E>;
  readonly query: EndpointParsedQuery<E>;
  readonly body: EndpointParsedBody<E>;
  /** The request time (use it instead of `new Date()` so a request sees one clock). */
  readonly now: Date;
  readonly correlationId: string;
  /** The optional `Idempotency-Key` header of idempotent commands (DD-39). */
  readonly idempotencyKey: string | null;
  readonly appEnv: AppEnvValue;
  readonly logger: MockLogger;
  readonly fixtures: FixtureHelpers;
  /** The caller; throws (500) on a public endpoint, where there is none. */
  requirePersona(): Persona;
  /** The tenant context; throws (500) where the endpoint has none. */
  requireTenant(): TenantAccess;
  /** Answers with a declared business error (`code` must be in the contract's `errors`, or a platform code). */
  fail(status: number, code: string, detail?: string): never;
  /** 404 for a record the caller cannot see (another tenant's record is simply not found). */
  notFound(detail?: string): never;
}

/** The success body a handler returns (the input side of the contract response schema). */
export type MockHandlerResult<E extends AnyEndpoint> = z.input<E['response']>;

export type MockHandler<E extends AnyEndpoint> = (
  context: MockHandlerContext<E>,
) => MockHandlerResult<E> | Promise<MockHandlerResult<E>>;

/** One registered route. */
export interface MockRouteRecord {
  readonly endpoint: AnyEndpoint;
  readonly handler: MockHandler<AnyEndpoint>;
  /** The handler module that registered it (for logs). */
  readonly module: string;
}

/** The registration surface handed to `register(app)`. */
export interface MockApp {
  /** Registers a contract endpoint; `mockRoute(app, endpoint, handler)` is the same call. */
  route<E extends AnyEndpoint>(endpoint: E, handler: NoInfer<MockHandler<E>>): void;
}

/** `METHOD /path/:` with parameter names erased, so `/x/:id` and `/x/:taskId` collide. */
export function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path.replace(/:[A-Za-z][A-Za-z0-9]*/g, ':')}`;
}

/** Collects routes; `createMockApp` mounts them. */
export class MockRouteCollector implements MockApp {
  readonly records: MockRouteRecord[] = [];
  private readonly keys = new Set<string>();
  private readonly ids = new Set<string>();

  constructor(private readonly moduleName: string) {}

  route<E extends AnyEndpoint>(endpoint: E, handler: NoInfer<MockHandler<E>>): void {
    const key = routeKey(endpoint.method, endpoint.path);
    if (this.keys.has(key)) {
      throw new Error(`Route ${key} is registered twice.`);
    }
    if (this.ids.has(endpoint.id)) {
      throw new Error(`Endpoint id ${endpoint.id} is registered twice.`);
    }
    this.keys.add(key);
    this.ids.add(endpoint.id);
    this.records.push({ endpoint, handler: handler as unknown as MockHandler<AnyEndpoint>, module: this.moduleName });
  }

  /** Adds every route of `other`; throws (adding nothing) when one collides with a route already here. */
  absorb(other: MockRouteCollector): void {
    for (const record of other.records) {
      const key = routeKey(record.endpoint.method, record.endpoint.path);
      if (this.keys.has(key)) {
        throw new Error(`Route ${key} is already registered by another module.`);
      }
      if (this.ids.has(record.endpoint.id)) {
        throw new Error(`Endpoint id ${record.endpoint.id} is already registered by another module.`);
      }
    }
    for (const record of other.records) {
      this.keys.add(routeKey(record.endpoint.method, record.endpoint.path));
      this.ids.add(record.endpoint.id);
      this.records.push(record);
    }
  }
}

/** Registers a contract endpoint with its handler (the call every handler module makes in `register(app)`). */
export function mockRoute<E extends AnyEndpoint>(app: MockApp, endpoint: E, handler: NoInfer<MockHandler<E>>): void {
  app.route(endpoint, handler);
}

/** Finds the route of a request, preferring static segments over parameters (`/me/tasks/summary` before `/:id`). */
export function findRoute(
  records: readonly MockRouteRecord[],
  method: string,
  path: string,
): { record: MockRouteRecord; rawParams: Record<string, string> } | null {
  let best: { record: MockRouteRecord; rawParams: Record<string, string>; score: number } | null = null;
  for (const record of records) {
    if (record.endpoint.method !== method) {
      continue;
    }
    const rawParams = matchPath(record.endpoint.path, path);
    if (rawParams === null) {
      continue;
    }
    const score = record.endpoint.path.split('/').filter((segment) => !segment.startsWith(':')).length;
    if (best === null || score > best.score) {
      best = { record, rawParams, score };
    }
  }
  return best === null ? null : { record: best.record, rawParams: best.rawParams };
}
