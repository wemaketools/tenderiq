/**
 * The endpoint catalog: every endpoint map of the contracts in one place (architecture-plan §3.10, §5).
 *
 * Each contract module exports one `<domain>Endpoints` map built with `defineEndpoint`. The catalog aggregates
 * them for consumers that need the whole API surface (catalog-wide uniqueness and route-ambiguity checks,
 * documentation). It is maintained by the Integration step: domain agents add their map to their own module and
 * the integrator lists it here.
 */
import { approvalEndpoints } from './approvals.js';
import { auditEndpoints } from './audit.js';
import { calendarEndpoints } from './calendars.js';
import { documentEndpoints } from './documents.js';
import type { AnyEndpoint } from './endpoint.js';
import { notificationEndpoints } from './notifications.js';
import { sessionEndpoints } from './session.js';
import { taskEndpoints } from './tasks.js';

/** Every endpoint map, keyed by the contract module that defines it. */
export const ENDPOINT_MAPS = {
  session: sessionEndpoints,
  tasks: taskEndpoints,
  notifications: notificationEndpoints,
  approvals: approvalEndpoints,
  documents: documentEndpoints,
  audit: auditEndpoints,
  calendars: calendarEndpoints,
} as const;

export type EndpointModule = keyof typeof ENDPOINT_MAPS;

/** Every endpoint of the API, in module order. */
export const ENDPOINT_CATALOG: readonly AnyEndpoint[] = Object.freeze(
  Object.values(ENDPOINT_MAPS).flatMap((map) => Object.values(map) as AnyEndpoint[]),
);

const BY_ID: ReadonlyMap<string, AnyEndpoint> = new Map(ENDPOINT_CATALOG.map((endpoint) => [endpoint.id, endpoint]));

/** The endpoint with this id, or `undefined`. */
export function endpointById(id: string): AnyEndpoint | undefined {
  return BY_ID.get(id);
}

/**
 * Whether two path templates can match the same request path: same length, and every segment pair is equal or
 * has a `:param` on one side (a static segment facing a parameter makes the routing order-dependent).
 */
export function pathsCollide(left: string, right: string): boolean {
  const a = left.split('/');
  const b = right.split('/');
  if (a.length !== b.length || left === right) {
    return false;
  }
  return a.every((segment, index) => {
    const other = b[index] ?? '';
    return segment === other || segment.startsWith(':') || other.startsWith(':');
  });
}
