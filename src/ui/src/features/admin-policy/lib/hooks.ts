/**
 * Small hooks shared by the policy pages.
 *
 * Prototype commands are static (foundation-contract §2.3): the next GET returns the fixture again, so a page shows
 * the record its last command returned. A page that navigates after a create passes the new record in the router
 * state (`{ record }`), and the destination shows it until a newer command result arrives.
 */
import { useState } from 'react';
import { useLocation, useParams } from 'react-router';

import { useActiveTenant } from '../../../app/hooks';

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

/** The official time zone of the active organization (dates on these screens render in it). */
export function useOfficialTimeZone(): string {
  return useActiveTenant()?.officialTimeZone ?? 'UTC';
}
