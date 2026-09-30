/** Wording of a support access grant's window. */
import type { SupportGrant } from '@contracts/operations';

import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';

/** "from … to …" in the given zone, or "Not started" before authorization. */
export function grantWindow(grant: SupportGrant, timeZone: string): string {
  if (grant.startsAt === null || grant.expiresAt === null) {
    return t('ops.grants.notStarted');
  }
  return t('ops.grants.window', {
    from: formatDateTime(grant.startsAt, timeZone),
    to: formatDateTime(grant.expiresAt, timeZone),
  });
}
