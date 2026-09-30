/**
 * Helpers shared by the workspace screens (COM-04 … COM-07, ADM-10, ADM-12): row organizations for `/me` actions
 * (DD-21), the display time zone, command results of the static prototype, route ids and translated business
 * error messages.
 */
import { useState } from 'react';
import { useLocation, useParams } from 'react-router';

import { ApiError, isApiError } from '../../../api/client';
import { useActiveTenant, useMemberships } from '../../../app/hooks';
import { describeError } from '../../../components/ui';
import { browserTimeZone } from '../../../lib/format';
import { hasTranslation, t } from '../../../lib/i18n';

/** The acting organization and capacity of a `/me` row action: the row's organization (DD-21). */
export interface RowOrganization {
  readonly name: string;
  readonly capacity: string | null;
}

/** Resolves the caller's capacity in the row's organization from the session memberships. */
export function useRowOrganization(): (organization: {
  readonly tenantId: number;
  readonly tenantName: string;
}) => RowOrganization {
  const memberships = useMemberships();
  return (organization) => {
    const membership = memberships.find(
      (item) => item.tenantId === organization.tenantId && item.status === 'active',
    );
    return { name: organization.tenantName, capacity: membership?.capacity ?? null };
  };
}

/** The active organizations of the caller, for the organization filter of the personal lists. */
export function useOrganizationOptions(): { value: string; label: string }[] {
  const memberships = useMemberships();
  const seen = new Set<number>();
  const options: { value: string; label: string }[] = [];
  for (const membership of memberships) {
    if (membership.status !== 'active' || seen.has(membership.tenantId)) continue;
    seen.add(membership.tenantId);
    options.push({ value: String(membership.tenantId), label: membership.tenantName });
  }
  return options;
}

/** Times on the personal screens render in the active organization's official zone (else the browser's). */
export function useDisplayTimeZone(): string {
  return useActiveTenant()?.officialTimeZone ?? browserTimeZone();
}

/** A positive integer route parameter, or null when it is missing or malformed. */
export function useIdParam(name: string): number | null {
  const params = useParams();
  const raw = params[name];
  if (raw === undefined || !/^[1-9]\d*$/.test(raw)) return null;
  return Number(raw);
}

/**
 * Prototype commands are static (foundation-contract §2.3): the next GET returns the fixture again, so a screen
 * shows the record its last command returned. A page reached after a create gets the record in the router state.
 */
export function useCommandResult<T extends { readonly id: number }>(
  id: number | null,
): readonly [T | null, (record: T | null) => void] {
  const location = useLocation();
  const seeded = (location.state as { readonly record?: T } | null)?.record;
  const [latest, setLatest] = useState<T | null>(null);
  if (latest !== null && latest.id === id) return [latest, setLatest];
  if (seeded !== undefined && seeded.id === id) return [seeded, setLatest];
  return [null, setLatest];
}

/** A number from a filter value, or undefined. */
export function positiveId(value: string): number | undefined {
  return /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
}

/** `'true'` / `'false'` filter values → boolean, `''` → undefined. */
export function triState(value: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/** A value of a closed list, or undefined (for enum filters kept as strings). */
export function oneOf<const V extends string>(
  value: string,
  allowed: readonly V[],
): V[] | undefined {
  return (allowed as readonly string[]).includes(value) ? [value as V] : undefined;
}

/** Drops undefined and empty-string entries of a query object. */
export function compact<T extends Record<string, unknown>>(query: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') result[key] = value;
  }
  return result as Partial<T>;
}

export type SortDirection = 'asc' | 'desc';

export function directionOf(value: string): SortDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

/** The translated message of a business error code (`<namespace>.errors.<CODE>`), if the catalog has one. */
function codeKey(error: ApiError, namespace: string): string | null {
  if (error.code === null) return null;
  const key = `${namespace}.errors.${error.code}`;
  return hasTranslation(key) ? key : null;
}

/** The message to show for a failed request. */
export function errorMessage(error: unknown, namespace: string): string {
  if (!isApiError(error)) return t('tasks.errors.unexpected');
  const key = codeKey(error, namespace);
  return key === null ? describeError(error) : t(key);
}

/** The same error with its detail replaced by the translated business message (for the shared dialogs). */
export function localizeError(error: ApiError | null, namespace: string): ApiError | null {
  if (error === null) return null;
  const key = codeKey(error, namespace);
  if (key === null) return error;
  // A translated business message is more specific than the generic 403/404 text the shared dialogs show.
  const kind = error.kind === 'forbidden' || error.kind === 'not_found' ? 'conflict' : error.kind;
  return new ApiError({
    kind,
    status: error.status,
    title: error.title,
    code: error.code,
    detail: t(key),
    fieldErrors: error.fieldErrors,
    correlationId: error.correlationId,
    endpointId: error.endpointId,
  });
}

/** Hours → "7 days", "2 days 4 hours", "4 hours" (reminder offsets and escalations). */
export function formatHours(hours: number): string {
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  if (days === 0) return t('tasks.duration.hours', { count: rest });
  if (rest === 0) return t('tasks.duration.days', { count: days });
  return t('tasks.duration.daysHours', {
    days: t('tasks.duration.days', { count: days }),
    hours: t('tasks.duration.hours', { count: rest }),
  });
}
