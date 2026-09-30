/**
 * A small `fetch` stub for SPA tests: routes are `"METHOD /path"` (query string ignored) mapped to a handler that
 * returns `{ status, body }`. Unrouted requests answer 404 problem+json. Every request is recorded.
 */
import { vi } from 'vitest';

export interface RecordedRequest {
  readonly method: string;
  readonly url: string;
  readonly path: string;
  readonly search: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

export interface MockResponse {
  readonly status?: number;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
}

export type MockHandler = (request: RecordedRequest) => MockResponse | Promise<MockResponse>;

export function problem(
  status: number,
  title: string,
  extra: Record<string, unknown> = {},
): MockResponse {
  return {
    status,
    headers: { 'content-type': 'application/problem+json' },
    body: { type: 'about:blank', title, status, correlationId: 'corr-test-1', ...extra },
  };
}

export function installFetch(routes: Record<string, MockHandler>) {
  const requests: RecordedRequest[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const parsed = new URL(url, 'http://localhost');
      const headers: Record<string, string> = {};
      new Headers(init?.headers).forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      const method = (init?.method ?? 'GET').toUpperCase();
      const request: RecordedRequest = {
        method,
        url,
        path: parsed.pathname,
        search: parsed.search,
        headers,
        body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      };
      requests.push(request);
      const handler = routes[`${method} ${parsed.pathname}`];
      const result = handler === undefined ? problem(404, 'Not Found') : await handler(request);
      const status = result.status ?? 200;
      return new Response(
        status === 204 || result.body === undefined ? null : JSON.stringify(result.body),
        {
          status,
          headers: { 'content-type': 'application/json', ...result.headers },
        },
      );
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, requests };
}
