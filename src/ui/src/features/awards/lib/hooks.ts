/**
 * Small hooks shared by the award and outcome pages.
 *
 * Prototype commands are static (foundation-contract §2.3): the next GET returns the fixture again, so a page shows
 * the record its last command returned. `useLatest` keeps the command result for the record it belongs to, and a
 * page that navigates after a create passes the new record in the router state (`{ record }`).
 */
import { useState } from 'react';
import { useLocation, useParams } from 'react-router';

import { useActiveTenant } from '../../../app/hooks';

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

/**
 * The newest command result for the record `key` (or the record seeded through the router state), else null.
 * `set` stores a newer result; a result for another record is ignored when the key changes.
 */
export function useLatest<T>(
  key: string | null,
  keyOf: (record: T) => string,
): readonly [T | null, (record: T) => void] {
  const location = useLocation();
  const seeded = (location.state as { readonly record?: T } | null)?.record;
  const [latest, setLatest] = useState<T | null>(null);
  if (latest !== null && keyOf(latest) === key) return [latest, setLatest];
  if (seeded !== undefined && keyOf(seeded) === key) return [seeded, setLatest];
  return [null, setLatest];
}
