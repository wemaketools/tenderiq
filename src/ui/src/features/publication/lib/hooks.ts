/**
 * Small hooks shared by the publication, public-portal and opportunities pages.
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

/**
 * The official time zone of the active organization, for its own records (publications, participants, pursuits).
 * Rows of another organization carry their buyer's zone (`buyer.officialTimeZone`) and render in it instead.
 */
export function useOfficialTimeZone(): string {
  return useActiveTenant()?.officialTimeZone ?? 'UTC';
}
