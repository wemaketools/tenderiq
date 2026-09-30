/**
 * Test kit of the workspace screens: a session with chosen permissions and memberships, and a router for the
 * mocked `call` of the API client module. Responses are parsed with the endpoint's contract schema, so test data
 * stays contract-valid.
 *
 * Each test file mocks the client module itself (hoisted):
 * `vi.mock('../../../api/client', async (original) => ({ ...(await original<object>()), call: vi.fn() }));`
 */
import type { ReactElement } from 'react';
import { vi } from 'vitest';

import type { AnyEndpoint } from '@contracts/endpoint';
import type { PermissionCode } from '@contracts/permissions';

import { ApiError, call } from '../../../api/client';
import type { CallOptions } from '../../../api/client';
import { makeMembership, makeTenant, signedInSession } from '../../../test/fixtures';
import { renderWithProviders } from '../../../test/render';

export const MANAGER_PERMISSIONS: PermissionCode[] = [
  'approval.decide',
  'request.approve',
  'tender.view',
  'audit.view',
];

export const ADMIN_PERMISSIONS: PermissionCode[] = [
  'org.calendars.manage',
  'org.notifications.manage',
  'org.policy.approve',
];

export interface RenderPageOptions {
  readonly path: string;
  readonly route: string;
  readonly permissions?: readonly PermissionCode[];
  readonly kind?: 'buyer' | 'supplier';
  readonly capacity?: string;
}

export function renderPage(element: ReactElement, options: RenderPageOptions) {
  const kind = options.kind ?? 'buyer';
  const capacity = options.capacity ?? 'Procurement Manager';
  const tenant =
    kind === 'buyer'
      ? makeTenant({ capacity }, options.permissions ?? MANAGER_PERMISSIONS)
      : makeTenant(
          {
            tenantId: 4,
            kind: 'supplier',
            name: 'Tsodilo Engineering',
            slug: 'tsodilo',
            capacity,
          },
          options.permissions ?? ['supplier.notices.acknowledge'],
        );
  const membership =
    kind === 'buyer'
      ? makeMembership({ capacity })
      : makeMembership({
          tenantId: 4,
          tenantKind: 'supplier',
          tenantName: 'Tsodilo Engineering',
          tenantSlug: 'tsodilo',
          capacity,
        });
  return renderWithProviders(element, {
    path: options.path,
    route: options.route,
    state: { session: signedInSession({ activeTenant: tenant, memberships: [membership] }) },
    routes: [{ path: '*', element: <p data-testid="elsewhere">elsewhere</p> }],
  });
}

export interface RecordedCall {
  readonly id: string;
  readonly request: Record<string, unknown>;
  readonly options: CallOptions | undefined;
}

type Handler = (request: Record<string, unknown>) => unknown;

/** Routes `call(endpoint, request)` by endpoint id; unrouted calls fail with 404. Returns the recorded calls. */
export function routeCalls(handlers: Record<string, Handler>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  vi.mocked(call).mockImplementation(((
    endpoint: AnyEndpoint,
    request: Record<string, unknown>,
    options?: CallOptions,
  ) => {
    calls.push({ id: endpoint.id, request, options });
    const handler = handlers[endpoint.id];
    if (handler === undefined) {
      return Promise.reject(
        new ApiError({
          kind: 'not_found',
          status: 404,
          title: 'Not Found',
          endpointId: endpoint.id,
        }),
      );
    }
    try {
      return Promise.resolve(endpoint.response.parse(handler(request)));
    } catch (error) {
      return Promise.reject(error);
    }
  }) as typeof call);
  return calls;
}

export function businessError(
  endpointId: string,
  code: string,
  status = 409,
  fieldErrors: { field: string; code: string; message: string }[] = [],
): ApiError {
  return new ApiError({
    kind: status === 422 ? 'validation' : status === 403 ? 'forbidden' : 'conflict',
    status,
    title: 'Request refused',
    code,
    detail: 'Server detail.',
    fieldErrors,
    correlationId: 'corr-1',
    endpointId,
  });
}

/** The calls to one endpoint. */
export function callsTo(calls: readonly RecordedCall[], id: string): RecordedCall[] {
  return calls.filter((entry) => entry.id === id);
}
