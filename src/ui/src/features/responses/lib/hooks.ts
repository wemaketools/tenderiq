/**
 * Small hooks shared by the response pages.
 */
import { useParams } from 'react-router';

import { useActiveTenant, useAppSelector } from '../../../app/hooks';

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

/** The signed-in user's id (to recognize the caller's own approvals and assignments). */
export function useCurrentUserId(): number | null {
  return useAppSelector((state) => state.session.user?.id ?? null);
}

/** The acting organization and capacity sent with consequential commands (COM-02). */
export function useActingContext(): {
  readonly tenantId: number;
  readonly capacity: string;
} | null {
  const tenant = useActiveTenant();
  if (tenant === null) return null;
  return { tenantId: tenant.tenantId, capacity: tenant.capacity ?? tenant.name };
}
