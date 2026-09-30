/**
 * Test harness of the contracts pages: the API client's `call` is mocked by the test file
 * (`vi.mock('../../../api/client', …)`) and routed here by endpoint id; pages render inside the real providers with
 * a session holding the given permissions.
 */
import type { ReactElement } from 'react';
import { vi } from 'vitest';

import type { PermissionCode } from '@contracts/permissions';

import { ApiError, call } from '../../../api/client';
import { renderWithProviders } from '../../../test/render';
import { makeTenant, makeUser, signedInSession } from '../../../test/fixtures';

export type Route = unknown | ((request: unknown) => unknown);

export interface CallRecord {
  readonly id: string;
  readonly request: unknown;
}

/** Routes the mocked `call` by endpoint id. Unrouted endpoints answer 404. Returns the recorded calls. */
export function routeCalls(routes: Record<string, Route>): CallRecord[] {
  const calls: CallRecord[] = [];
  vi.mocked(call).mockImplementation((endpoint, request) => {
    calls.push({ id: endpoint.id, request });
    const route = routes[endpoint.id];
    if (route === undefined) {
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
      const value =
        typeof route === 'function' ? (route as (r: unknown) => unknown)(request) : route;
      return value instanceof Error ? Promise.reject(value) : Promise.resolve(value as never);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
  return calls;
}

/** A business failure as the client reports it. */
export function businessError(
  code: string,
  status = 409,
  detail = 'Refused by the server.',
): ApiError {
  return new ApiError({
    kind: status === 403 ? 'forbidden' : status === 422 ? 'validation' : 'conflict',
    status,
    title: 'Request refused',
    code,
    detail,
    endpointId: 'test',
  });
}

export function callsTo(calls: readonly CallRecord[], id: string): CallRecord[] {
  return calls.filter((item) => item.id === id);
}

export interface PageOptions {
  readonly permissions: readonly PermissionCode[];
  readonly route: string;
  readonly path: string;
  readonly kind?: 'buyer' | 'supplier';
  readonly userId?: number;
}

export function renderPage(element: ReactElement, options: PageOptions) {
  const kind = options.kind ?? 'buyer';
  const tenant =
    kind === 'buyer'
      ? makeTenant({ capacity: 'Contract Manager' }, options.permissions)
      : makeTenant(
          {
            tenantId: 4,
            kind: 'supplier',
            name: 'Tsodilo Engineering',
            slug: 'tsodilo',
            capacity: 'Managing Director',
          },
          options.permissions,
        );
  return renderWithProviders(element, {
    state: {
      session: signedInSession({
        activeTenant: tenant,
        user: makeUser({ id: options.userId ?? 19 }),
      }),
    },
    route: options.route,
    path: options.path,
  });
}
