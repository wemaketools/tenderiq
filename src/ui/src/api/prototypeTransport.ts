/**
 * The Stage A prototype transport (DD-50, architecture-plan §3.11): the static prototype has no server, so every
 * `/api/v1` request is answered in the browser by the mock API (`src/mock-api/browser.ts`), the same Hono app, with
 * the same contracts, middleware and fixtures, that the mock API tests exercise.
 *
 * This is the ONE SPA module allowed to import `src/mock-api` (lint rule). The mock API and its fixtures load as a
 * separate chunk on the first request, so the first screen does not wait for them.
 */
import type { MockApi } from '../../../mock-api/app';
import type { ApiTransport } from './client';

let pending: Promise<MockApi> | null = null;

function mockApi(): Promise<MockApi> {
  pending ??= import('../../../mock-api/browser')
    .then(({ createBrowserMockApi }) =>
      createBrowserMockApi({ appEnv: import.meta.env.DEV ? 'local' : 'preview' }),
    )
    .catch((error: unknown) => {
      // A failed chunk load (for example a dropped connection) is retried on the next request.
      pending = null;
      throw error;
    });
  return pending;
}

/** Answers a request with the in-browser mock API. */
export const prototypeTransport: ApiTransport = async (url, init) => {
  const api = await mockApi();
  return api.fetch(new Request(new URL(url, window.location.origin), init));
};
