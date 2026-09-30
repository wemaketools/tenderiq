/**
 * Small hooks shared by the qualification pages.
 *
 * Prototype commands are static (DD-43): the next GET returns the fixture again, so a page shows the record its
 * last command returned and names the result in a toast.
 */
import { useParams } from 'react-router';

import { useActiveTenant } from '../../../app/hooks';

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

/** The default currency of the active organization (empty for an organization without one). */
export function useDefaultCurrency(): string {
  return useActiveTenant()?.defaultCurrency ?? '';
}

/** Runs a mutation and calls `onDone` with its result; failures stay in the mutation's `error`. */
export async function runCommand<T>(
  action: () => Promise<T>,
  onDone: (value: T) => void,
): Promise<void> {
  let value: T;
  try {
    value = await action();
  } catch {
    return;
  }
  onDone(value);
}
