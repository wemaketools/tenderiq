/**
 * Who is looking at the public portal (a visitor, a signed-in user, or a signed-in supplier organization) and
 * language display names.
 */
import { useActiveTenant, useAppSelector } from '../../../app/hooks';
import { sessionPhase } from '../../../app/sessionSelectors';

/** The display name of a language code, in English (the interface language). */
export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export interface PortalViewer {
  readonly signedIn: boolean;
  /** Signed in with a supplier organization active: participation continues in the supplier workspace. */
  readonly supplierName: string | null;
}

export function usePortalViewer(): PortalViewer {
  const session = useAppSelector((state) => state.session);
  const tenant = useActiveTenant();
  const signedIn = sessionPhase(session) === 'ready';
  return {
    signedIn,
    supplierName: signedIn && tenant !== null && tenant.kind === 'supplier' ? tenant.name : null,
  };
}
