/**
 * Small hooks shared by the supplier screens.
 *
 * Prototype commands are static (foundation-contract §2.3): the next GET returns the fixture again, so a page shows
 * the record its last command returned. A page that navigates after a create passes the new record in the router
 * state (`{ record }`), and the destination shows it until a newer command result arrives.
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { suppliersEndpoints } from '@contracts/suppliers';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';

/** The latest command result for the record `id`, seeded from the router state after a create. */
export function useCommandResult<T extends { readonly id: number }>(
  id: number | null,
): readonly [T | null, (record: T) => void] {
  const location = useLocation();
  const seeded = (location.state as { readonly record?: T } | null)?.record;
  const [latest, setLatest] = useState<T | null>(null);
  if (latest !== null && latest.id === id) return [latest, setLatest];
  if (seeded !== undefined && seeded.id === id) return [seeded, setLatest];
  return [null, setLatest];
}

/** A positive integer route parameter, or null when it is missing or malformed. */
export function useIdParam(name: string): number | null {
  const params = useParams();
  const raw = params[name];
  if (raw === undefined || !/^[1-9]\d*$/.test(raw)) return null;
  return Number(raw);
}

/**
 * The official time zone of the active organization (instants on these screens render in it). Without an active
 * organization (public pages) instants render in UTC, labelled as such, never in an assumed buyer zone.
 */
export function useOfficialTimeZone(): string {
  return useActiveTenant()?.officialTimeZone ?? 'UTC';
}

/**
 * The evidence currencies served by the API and the default for a new coverage amount: the active organization's
 * default currency, else the first currency of the list (no currency is hard-coded in the SPA).
 */
export function useEvidenceCurrencies(): {
  readonly codes: readonly string[];
  readonly defaultCurrency: string;
} {
  const reference = useApiQuery(suppliersEndpoints.referenceOptions, {});
  const tenantCurrency = useActiveTenant()?.defaultCurrency ?? null;
  const codes = (reference.data?.currencies ?? []).map((option) => option.code);
  const defaultCurrency = tenantCurrency ?? codes[0] ?? '';
  return {
    codes:
      defaultCurrency !== '' && !codes.includes(defaultCurrency)
        ? [defaultCurrency, ...codes]
        : codes,
    defaultCurrency,
  };
}

/**
 * Navigation that waits one render, so a form that just cleared its "unsaved changes" flag is not blocked by its own
 * UnsavedChangesGuard (the guard's child effect updates before this parent effect navigates).
 */
export function useDeferredNavigate(): (to: string, state?: unknown) => void {
  const navigate = useNavigate();
  const [target, setTarget] = useState<{ readonly to: string; readonly state?: unknown } | null>(
    null,
  );
  useEffect(() => {
    if (target !== null) void navigate(target.to, { state: target.state });
  }, [target, navigate]);
  return (to, state) => setTarget({ to, state });
}
