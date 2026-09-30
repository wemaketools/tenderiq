/**
 * Hooks shared by the contract pages.
 *
 * Prototype commands are static (foundation-contract §2.3): the next GET returns the fixture again, so a page shows
 * the outcome its last command returned (a success notice with the server's message) next to the record.
 */
import { useCallback, useState } from 'react';
import { useParams } from 'react-router';

import type { AnyEndpoint, EndpointRequest, EndpointResponse } from '@contracts/endpoint';

import { invalidateApiQueries, useApiMutation } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { useToast } from '../../../components/ui';
import type { ApiError } from '../../../api/client';
import { withContractMessage } from './errors';

/** A positive integer route parameter, or null when it is missing or malformed. */
export function useIdParam(name: string): number | null {
  const params = useParams();
  const raw = params[name];
  if (raw === undefined || !/^[1-9]\d*$/.test(raw)) return null;
  return Number(raw);
}

/** The official time zone of the active organization. */
export function useOfficialTimeZone(): string {
  return useActiveTenant()?.officialTimeZone ?? 'UTC';
}

/** The default currency of the active organization. */
export function useDefaultCurrency(): string {
  return useActiveTenant()?.defaultCurrency ?? 'BWP';
}

export interface ContractCommand<E extends AnyEndpoint> {
  /** Runs the command. Resolves the response, or null when it failed (the error is in `error`). */
  readonly run: (request: EndpointRequest<E>) => Promise<EndpointResponse<E> | null>;
  readonly pending: boolean;
  /** The failure with its translated business message. */
  readonly error: ApiError | null;
  readonly reset: () => void;
}

/**
 * A contracts command: on success it shows the outcome as a toast, re-runs the mounted contract queries and returns
 * the response; on failure it keeps the translated error for the dialog.
 */
export function useContractCommand<E extends AnyEndpoint>(
  endpoint: E,
  describe: (response: EndpointResponse<E>) => string,
  invalidate: string = endpoint.audience === 'supplier'
    ? 'supplier.contracts.'
    : 'buyer.contracts.',
): ContractCommand<E> {
  const mutation = useApiMutation(endpoint);
  const toast = useToast();
  const { mutate, reset } = mutation;
  const run = useCallback(
    async (request: EndpointRequest<E>): Promise<EndpointResponse<E> | null> => {
      try {
        const response = await mutate(request);
        toast.show(describe(response), 'success');
        invalidateApiQueries(invalidate);
        return response;
      } catch {
        return null;
      }
    },
    [mutate, toast, describe, invalidate],
  );
  return { run, pending: mutation.pending, error: withContractMessage(mutation.error), reset };
}

/** Which dialog of a page is open (`null` = none), with the record it acts on. */
export function useDialog<K extends string, T = null>(): {
  readonly open: K | null;
  readonly target: T | null;
  readonly show: (kind: K, target?: T) => void;
  readonly close: () => void;
} {
  const [state, setState] = useState<{ open: K | null; target: T | null }>({
    open: null,
    target: null,
  });
  const show = useCallback((kind: K, target?: T) => {
    setState({ open: kind, target: target ?? null });
  }, []);
  const close = useCallback(() => setState({ open: null, target: null }), []);
  return { open: state.open, target: state.target, show, close };
}
