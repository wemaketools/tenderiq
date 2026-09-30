/**
 * Data hooks over `call()` for feature pages and shared widgets (docs/technical/09-frontend.md §9).
 *
 * `useApiQuery(endpoint, request, options?)` fetches on mount and whenever the request, the active tenant or the
 * tenant epoch changes. Its cache key includes the tenant epoch, so data fetched under one tenant is never shown
 * under another (BR-02). While a new request runs, the previous data of the SAME endpoint and tenant stays visible
 * (`isFetching`), which avoids flicker when paging or filtering. Pass `null` as the request to skip the call.
 *
 * `useApiMutation(endpoint)` runs commands: `pending` disables submit buttons while a request is in flight (DD-39),
 * and `error` keeps the normalized problem for field errors and banners.
 *
 * `invalidateApiQueries(match)` re-runs every mounted query whose endpoint id matches (for example after a command
 * changed what a list shows).
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import type { AnyEndpoint, EndpointRequest, EndpointResponse } from '@contracts/endpoint';

import { useAppSelector } from '../app/hooks';
import { ApiError, call, isApiError } from './client';
import type { CallOptions } from './client';

// ---------------------------------------------------------------------------------------------------------
// Invalidation
// ---------------------------------------------------------------------------------------------------------

let invalidationVersion = 0;
const listeners = new Set<() => void>();
/** Recent invalidations (bounded): a query re-runs when a newer entry matches its endpoint. */
const invalidations: Array<{ version: number; predicate: (endpointId: string) => boolean }> = [];
const MAX_INVALIDATIONS = 200;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getInvalidationVersion(): number {
  return invalidationVersion;
}

/**
 * Re-runs mounted queries. `match` is an endpoint id, an id prefix ending with `.` (for example `me.tasks.`), or a
 * predicate. Without `match`, every query re-runs.
 */
export function invalidateApiQueries(match?: string | ((endpointId: string) => boolean)): void {
  invalidationVersion += 1;
  const predicate =
    match === undefined
      ? () => true
      : typeof match === 'function'
        ? match
        : (id: string) => (match.endsWith('.') ? id.startsWith(match) : id === match);
  invalidations.push({ version: invalidationVersion, predicate });
  if (invalidations.length > MAX_INVALIDATIONS) {
    invalidations.splice(0, invalidations.length - MAX_INVALIDATIONS);
  }
  for (const listener of listeners) {
    listener();
  }
}

/** The latest invalidation version that concerns this endpoint. */
function invalidationFor(endpointId: string, version: number): number {
  let latest = 0;
  for (const entry of invalidations) {
    if (entry.version <= version && entry.predicate(endpointId)) {
      latest = entry.version;
    }
  }
  return latest;
}

// ---------------------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------------------

export type QueryStatus = 'loading' | 'success' | 'error';

export interface QueryResult<T> {
  readonly status: QueryStatus;
  /** The data of the latest successful request (of the same endpoint and tenant) or `undefined`. */
  readonly data: T | undefined;
  readonly error: ApiError | null;
  /** A request is in flight (also true during a refresh that keeps showing `data`). */
  readonly isFetching: boolean;
  /** Runs the request again. */
  readonly reload: () => void;
}

interface QueryOptions {
  /** For `me` row reads that need a row tenant (rare); see `CallOptions.tenantId`. */
  readonly tenantId?: number;
}

interface Settled<T> {
  readonly key: string;
  readonly scope: string;
  readonly data: T | undefined;
  readonly error: ApiError | null;
}

function toApiError(endpointId: string, error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }
  return new ApiError({
    kind: 'network',
    status: 0,
    title: error instanceof Error ? error.message : 'The request failed.',
    endpointId,
  });
}

export function useApiQuery<E extends AnyEndpoint>(
  endpoint: E,
  request: EndpointRequest<E> | null,
  options: QueryOptions = {},
): QueryResult<EndpointResponse<E>> {
  const tenantEpoch = useAppSelector((state) => state.session.tenantEpoch);
  const activeTenantId = useAppSelector((state) => state.session.activeTenant?.tenantId ?? null);
  const version = useSyncExternalStore(subscribe, getInvalidationVersion);
  const [reloadToken, setReloadToken] = useState(0);

  const scope = JSON.stringify([
    endpoint.id,
    tenantEpoch,
    activeTenantId,
    options.tenantId ?? null,
  ]);
  const requestKey = request === null ? null : JSON.stringify(request);
  const key =
    requestKey === null
      ? null
      : `${scope}|${requestKey}|${reloadToken}|${invalidationFor(endpoint.id, version)}`;

  const [settled, setSettled] = useState<Settled<EndpointResponse<E>> | null>(null);

  useEffect(() => {
    if (key === null || requestKey === null) {
      return undefined;
    }
    const controller = new AbortController();
    const parsedRequest = JSON.parse(requestKey) as EndpointRequest<E>;
    const callOptions: CallOptions =
      options.tenantId === undefined
        ? { signal: controller.signal }
        : { signal: controller.signal, tenantId: options.tenantId };
    call(endpoint, parsedRequest, callOptions).then(
      (data) => {
        if (!controller.signal.aborted) {
          setSettled({ key, scope, data, error: null });
        }
      },
      (error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setSettled((previous) => ({
          key,
          scope,
          data: previous?.scope === scope ? previous.data : undefined,
          error: toApiError(endpoint.id, error),
        }));
      },
    );
    return () => controller.abort();
    // The key captures endpoint, request, tenant, reload and invalidation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  if (key === null) {
    return { status: 'loading', data: undefined, error: null, isFetching: false, reload };
  }
  const sameScope = settled !== null && settled.scope === scope;
  const current = settled !== null && settled.key === key;
  const data = sameScope ? settled.data : undefined;
  const error = current ? settled.error : null;
  const isFetching = !current;
  let status: QueryStatus;
  if (error !== null) {
    status = 'error';
  } else if (data !== undefined && (current || sameScope)) {
    status = 'success';
  } else {
    status = 'loading';
  }
  return { status, data, error, isFetching, reload };
}

// ---------------------------------------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------------------------------------

export interface MutationResult<E extends AnyEndpoint> {
  /** Runs the command; resolves the response or rejects with `ApiError` (also kept in `error`). */
  readonly mutate: (
    request: EndpointRequest<E>,
    options?: CallOptions,
  ) => Promise<EndpointResponse<E>>;
  readonly pending: boolean;
  readonly error: ApiError | null;
  readonly data: EndpointResponse<E> | undefined;
  readonly reset: () => void;
}

export function useApiMutation<E extends AnyEndpoint>(endpoint: E): MutationResult<E> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [data, setData] = useState<EndpointResponse<E> | undefined>(undefined);

  const mutate = useCallback(
    async (request: EndpointRequest<E>, options?: CallOptions): Promise<EndpointResponse<E>> => {
      setPending(true);
      setError(null);
      try {
        const response = await call(endpoint, request, options);
        setData(response);
        return response;
      } catch (caught) {
        const apiError = toApiError(endpoint.id, caught);
        setError(apiError);
        throw apiError;
      } finally {
        setPending(false);
      }
    },
    [endpoint],
  );

  const reset = useCallback(() => {
    setError(null);
    setData(undefined);
  }, []);

  return { mutate, pending, error, data, reset };
}
